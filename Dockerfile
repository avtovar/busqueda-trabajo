# =============================================================================
# Imagen de producción del stack COMPLETO (frontend compilado + backend Node).
# =============================================================================
# -----------------------------------------------------------------------------
# Para qué sirve esta imagen
# -----------------------------------------------------------------------------
# La app tiene dos partes y en producción se sirven desde el MISMO proceso:
#   - server/  → la API Node (ofertas, historial, cartas, consultoras)
#   - frontend/dist/ → la UI React ya compilada por Vite
#
# Esta imagen guarda las dos juntas, así que con `docker run` alcanza: un solo
# contenedor, un solo puerto (3000) y la app completa funcionando.
#
# OJO con la diferencia con GitHub Pages (deploy-pages.yml): Pages NO puede
# correr esta imagen, solo sirve archivos estáticos. Si querés la app real
# funcionando, es esta imagen la que tenés que desplegar.
#
# -----------------------------------------------------------------------------
# CÓMO CONSTRUIRLA Y CORRERLA
# -----------------------------------------------------------------------------
#   docker build -t buscador-trabajo .
#   docker run -d --name buscador -p 3000:3000 buscador-trabajo
#
#   # Con el token de Apify (para la búsqueda en LinkedIn):
#   docker run -d --name buscador -p 3000:3000 \
#     -e APIFY_API_TOKEN=tu_token \
#     -v buscador-data:/app/data \
#     buscador-trabajo
#
# OJO: ninguno de los dos comandos de arriba es obligatorio ni cobra. La imagen
# NO necesita APIFY_API_TOKEN ni para construirse ni para arrancar: el token se
# lee en tiempo de ejecución y solo lo usa `POST /api/linkedin-search`. Todo lo
# demás — ofertas, matching, historial, cartas, CV, consultoras y el propio
# /api/health — funciona igual sin él, y sin él nada llama a Apify. Agregalo
# solo cuando quieras realmente la búsqueda en LinkedIn, sabiendo que cada
# ejecución del actor se factura.
#
# -----------------------------------------------------------------------------
# ⚠️  SOBRE EL VOLUMEN /app/data — LEÉ ESTO, ES LO MÁS IMPORTANTE
# -----------------------------------------------------------------------------
# El servidor guarda su estado en DOS archivos JSON dentro de `data/`:
#     data/history.json            → qué ofertas viste y cuándo
#     data/consultoras-status.json → con qué empresas te contactaste
#
# Esas rutas NO se calculan con process.cwd(): salen de `import.meta.url`, así
# que son SIEMPRE <carpeta del server>/../data, o sea /app/data dentro del
# contenedor. Por eso el VOLUME de abajo apunta exactamente a ese lugar.
#
# Qué pasa si no montás un volumen: Docker mete /app/data en la capa
# efímera del contenedor. Cada vez que redeployás (que es CADA deploy, porque
# sale una imagen nueva) el contenedor se recrea desde cero y tu historial y tu
# tracker de consultoras se BORRAN. Es la forma más fácil de perder datos sin
# darte cuenta, porque el error es silencioso: la app sigue funcionando, solo
# que "olvidó" todo.
#
# Por eso el VOLUME está declarado en la imagen: Docker crea un volumen
# anónimo automáticamente si no le pasás uno con -v, y ese volumen SOBREVIVE
# a la recreación del contenedor. Igual, para poder hacer backup o abrir el
# JSON desde el host, conviene un volumen con nombre explícito:
#
#   docker volume create buscador-data
#   docker run -v buscador-data:/app/data ...
#
# En un orquestador (Docker Swarm, Kubernetes, Render, Railway, Fly.io) lo
# mismo se traduce a un PersistentVolumeClaim montado en /app/data, o a la
# opción "disco persistente" del proveedor apuntando a ese path.
#
# -----------------------------------------------------------------------------
# POR QUÉ ES MULTI-STAGE
# -----------------------------------------------------------------------------
# En el stage `build` se compila el frontend con Vite. Eso necesita
# node_modules de desarrollo (Vite, el plugin de React, Babel, etc.), que
# ocupan cientos de MB y NO sirven para ejecutar la app.
#
# En el stage `runtime` se copia de cero SOLO lo necesario: node_modules de
# producción (solo `dotenv`), el código del server y el dist ya compilado.
# Resultado: una imagen de ~180 MB en vez de ~700 MB, con menos superficie de
# ataque (Vite y esbuild no están para que nadie los exploten) y menos
# contexto que se le copia a Docker en cada build.
# =============================================================================

# -----------------------------------------------------------------------------
# STAGE 1 — build: compilar el frontend React con Vite.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Primero se copian SOLO los package.json y el lockfile, y se instalan. Esta
# es la técnica de "capa de caché de dependencias": mientras el lockfile no
# cambie, Docker reutiliza la capa de `npm ci` de builds anteriores y no
# reinstala nada. Si se copiaran también los fuentes antes del install, cada
# cambio en un .jsx invalidaría la capa y se reinstalaría todo.
COPY frontend/package.json frontend/package-lock.json ./frontend/
# `npm ci` y no `npm install`: instala exactamente las versiones del lockfile
# y falla si el lock está desincronizado con el package.json. Es el mismo
# criterio que usa el CI, así que la imagen se construye con las mismas
# dependencias que se verificaron.
RUN cd frontend && npm ci

# Ahora sí se copia el código del frontend y se compila.
COPY frontend/ ./frontend/
# `npm run build` = `vite build` → deja todo en frontend/dist (ver outDir en
# frontend/vite.config.js).
RUN cd frontend && npm run build

# -----------------------------------------------------------------------------
# STAGE 2 — runtime: la imagen final, mínima.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runtime

# NODE_ENV=production: desactiva behaviours de desarrollo de npm y avisa a
# algunas librerías de que están en producción.
# PORT=3000: el server lee process.env.PORT (server/index.js), y Docker puede
# sobreescribirlo con `-e PORT=8080` o con `--env-file`. Ojo: si cambiás el
# puerto, el `EXPOSE` y el mapeo `-p` tienen que ir juntos con el.
ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# Dependencias de producción del backend. Acá hay UNO solo: dotenv.
# Se copia primero el package.json para poder instalar, y recién después el
# código (misma razón de caché que en el stage de build).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# El código del backend. server/ entero porque hay imports cruzados entre
# módulos (index.js importa cvProfile.js, matcher.js, etc.).
COPY server/ ./server/

# El frontend YA COMPILADO, desde el stage anterior.
#
# ⚠️  LA RUTA ES CRÍTICA Y NO ES OPCIONAL. En server/index.js:
#       const __dirname = fileURLToPath(new URL('.', import.meta.url));
#       const PUBLIC_DIR = join(__dirname, '..', 'frontend', 'dist');
#     Como __dirname es /app/server, el servidor busca los estáticos en
#     /app/frontend/dist. Si el dist se copiara a /app/dist la API seguiría
#     funcionando pero la web devolvería 404 en cada archivo, así que esta
#     línea tiene que replicar EXACTAMENTE esa estructura de carpetas.
COPY --from=build /app/frontend/dist ./frontend/dist

# La carpeta data/ se crea vacía para que exista aunque no se monte un volumen.
# Además se le da la propiedad al usuario 'node' (que ya existe en la imagen
# oficial) para que pueda escribir adentro sin necesidad de ser root.
RUN mkdir -p /app/data && chown -R node:node /app/data

# ── VOLUMEN DE PERSISTENCIA ───────────────────────────────────────────────────
# Declara /app/data como volumen. Docker lo inicializa con el contenido de la
# imagen (vacío) y, si no se especifica uno con -v, crea un volumen anónimo que
# sobrevive a los redeploys. Leer el bloque de arriba para el porqué.
VOLUME ["/app/data"]

# Baja de privilegios. El usuario por defecto de node:20-alpine es root, y un
# contenedor corriendo como root que termina con una vulnerabilidad de escape
# es el peor escenario posible. Con 'node' el proceso no puede tocar nada
# fuera de /app.
USER node

# Documenta el puerto. EXPOSE es informativo (no publica nada por sí solo), pero
# es lo que usan las plataformas de PaaS para saber a dónde mandar el tráfico:
# si no lo declarás, muchas no saben qué puerto escuchar.
EXPOSE 3000

# ── HEALTHCHECK ───────────────────────────────────────────────────────────────
# El orquestador (o tu `docker ps`) puede preguntar "¿esta imagen está sana?".
# Se usa el endpoint /api/health, que no toca la red externa ni necesita el
# token de Apify, así que responde al instante y sin falsos positivos.
#
# Por qué importa el detalle del costo: este chequeo corre SOLO, cada 30 s,
# mientras el contenedor está vivo, sin que nadie lo pida. Si apuntara a un
# endpoint de pago (tipo /api/linkedin-search), la factura crecería sola con el
# contenedor encendido. /api/health no consulta bolsas de empleo ni llama a
# ningún actor de Apify: solo responde que hay alguien escuchando. Además,
# /api/health no necesita `APIFY_API_TOKEN`, así que la imagen es sana
# EXACTAMENTE igual sin token, que es el caso por defecto de este proyecto.
# O sea: arrancar la imagen tal cual, sin `-e APIFY_API_TOKEN`, no cuesta nada.
#
# `process.exit(0)` = sano, `process.exit(1)` = unhealthy. El orquestador
# usa el código de salida, no la respuesta.
#
# --start-period 10s: los primeros 10 s no cuentan fallos, para darle tiempo al
# server de terminar de arrancar. Después, 3 fallos seguidos y se reinicia.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# ── CMD ───────────────────────────────────────────────────────────────────────
# Forma "exec": Node queda como PID 1 del contenedor, así que recibe las señales
# de SIGTERM/SIGINT directamente. Si estuviera detrás de un shell (`sh -c`),
# el contenedor no se bajaría limpio en un `docker stop`.
CMD ["node", "server/index.js"]
