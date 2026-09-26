# Buscador de Empleo QA

> Sistema web que consulta bolsas de empleo en vivo, calcula el porcentaje de compatibilidad (% match) de cada oferta contra el CV de **Ali Tovar (QA Engineer)** y las ordena por región, para no perder tiempo leyendo ofertas que no encajan.

No es un portal de empleo genérico: es una herramienta de búsqueda dirigida. Un candidato tiene cientos de ofertas abiertas y muy pocas le sirven. Acá cada oferta llega con un número del 0 al 100 que dice cuánta chance real hay de que encaje, y con material listo para enviar.

---

## Qué hace

**Matching inteligente**

Calcula un % de match entre cada oferta y el perfil del candidato, cruzando skills, título, seniority y ubicación. El resultado ordena la lista: lo mejor recomendado arriba, no lo más reciente.

**Ofertas en vivo de varias fuentes**

Agrega resultados de Remotive, Arbeitnow, Himalayas, RemoteOK y Jobicy, más un scraper de LinkedIn vía Apify y un set de ofertas curadas a mano. Sin base de datos: se consulta y se clasifica en el momento.

**Clasificación por región**

Siete regiones reales — Argentina, México, Perú, Colombia, Chile, Europa y Estados Unidos — más dos pestañas virtuales que no son países:

| Pestaña | Qué es |
|---|---|
| `analisis` | Propuesta de Interés: análisis de mercado con demanda de skills, brechas y recomendaciones |
| `consultoras` | Directorio de empresas objetivo con tracker de contacto |

**Historial persistente de ofertas vistas**

Cada oferta visitada queda registrada. Al volver a buscarla, el sistema la marca para que no pierdas tiempo en algo que ya revisaste. El historial sobrevive a los reinicios del servidor porque vive en disco.

**Generador de cartas de presentación**

Produce una carta de presentación adaptada a cada oferta, redactada en español o en inglés según la región de destino. Se abre en una ventana lista para copiar y pegar.

**Directorio de consultoras QA**

Un directorio curado a mano de **133 empresas** con práctica QA en Argentina: consultoras IT, empresas especializadas en QA, staffing y recruiting, bancos y fintech, multinacionales con oficina en el país y organismos públicos. Incluye filtro por categoría y un tracker para marcar con qué empresas ya te contactaste.

**Análisis de mercado**

Una página que responde preguntas concretas: qué skills piden las vacantes, cuáles ya cubrís, cuáles son brechas reales, en qué región hay más match promedio y qué conviene sumar a tu perfil.

**CV adaptado por oferta**

Genera una versión del CV ajustada a los requisitos de cada vacante, lista para copiar.

**Búsqueda directa en LinkedIn**

Busca ofertas en LinkedIn on demand a través de Apify, sin necesidad de scraping continuo.

---

## Stack / tecnologías

| Capa | Tecnología | Detalle |
|---|---|---|
| Runtime | Node.js | `>=18` (probado con Node 20+) |
| Módulos | ESM | `"type": "module"` en `package.json` |
| Backend | Node nativo | `node:http`, `node:fs/promises`, `node:path` — sin Express ni framework |
| Frontend | React 18 | `^18.3.1`, con `@vitejs/plugin-react` |
| Bundler | Vite | `^5.4.8` |
| Dependencias de runtime | `dotenv` | La única dependencia del backend: `^18.0.4` |
| Datos | JSON en disco | Sin base de datos: `data/*.json` |
| Scraper opcional | Apify | Solo si se configura `APIFY_API_TOKEN` |

Una decisión de diseño importante: **el backend no tiene framework.** Todo el enrutado, el parseo de queries y el servido de estáticos está hecho con módulos nativos de Node. Eso mantiene las dependencias en cero y hace que el proyecto arranque sin build step en el servidor.

El servidor también sirve el frontend ya compilado desde `frontend/dist/`, así que en producción hay un único proceso y un único puerto.

---

## Requisitos previos

- **Node.js 18 o superior** — verificá con `node --version`
- **npm** (viene con Node)
- Opcional: un token de [Apify](https://apify.com) solo si querés usar la búsqueda en LinkedIn

No hace falta clonar nada extra ni instalar base de datos. El proyecto se levanta con `npm install` y un comando.

---

## Instalación y ejecución

### 1. Instalá las dependencias

```bash
git clone <url-del-repositorio> busqueda_trabajo
cd busqueda_trabajo
npm install
```

### 2. Levantá la aplicación

```bash
npm start
```

Esto compila el frontend con Vite y levanta el servidor. Cuando veas el mensaje de arranque, abrí:

```
http://localhost:3000
```

### En Linux, macOS o WSL

Hay un script que hace todo el trabajo por vos: compila, levanta el servidor, espera a que la API responda y abre el navegador solo.

```bash
bash busqueda_de_trbajosh.sh
```

El servidor queda corriendo en primer plano. Para detenerlo, `Ctrl+C`.

> Nota: la primera consulta a las bolsas de empleo externas puede tardar unos segundos. El script espera hasta 90 segundos a que el servidor esté listo antes de abrir el navegador.

---

## Variables de entorno

Las variables se leen de un archivo `.env` en la raíz del proyecto, cargado con `dotenv`. El repositorio incluye `.env.example` con la plantilla.

**Para crear tu `.env`:**

```bash
# Linux / macOS / WSL
cp .env.example .env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

Después editá `.env` y completá lo que necesites.

| Variable | Requerida | Default | Para qué sirve |
|---|---|---|---|
| `APIFY_API_TOKEN` | No (opcional) | — | Habilita la búsqueda en LinkedIn vía Apify. Sin este token, **todas las demás funciones funcionan igual**. |
| `PORT` | No | `3000` | Puerto donde escucha el servidor. Cambialo si el 3000 ya está ocupado. |

> [!WARNING]
> **El archivo `.env` nunca se sube a Git.** Está listado en `.gitignore` junto con `*.env`, `*.pem`, `*.key` y `secrets/`. Asegurate de no pegues el token en un chat, en un issue ni en un commit.

### Sobre `APIFY_API_TOKEN`

Es la única variable que aporta una funcionalidad extra, y es la única funcionalidad del proyecto que puede generar un costo: la búsqueda en LinkedIn lanza un actor de Apify que **se factura por ejecución**. Sin ella:

- El resto de fuentes en vivo (Remotive, Arbeitnow, Himalayas, RemoteOK, Jobicy) sigue funcionando. Son APIs públicas y gratuitas, y no tienen nada que ver con Apify.
- El matching, el historial, las cartas, el CV y el directorio de consultoras siguen funcionando.
- Únicamente el botón de búsqueda en LinkedIn devuelve un error `503` con un mensaje claro.

Si lo configurás mal (token rechazado), la API responde `502` explicando el problema. Nunca se expone el valor del token en las respuestas de la API.

Dos aclaraciones que suelen confundir, porque son caminos **independientes** entre sí:

| | Para qué sirve el token |
|---|---|
| **`.env` local** | Que la búsqueda en LinkedIn funcione **en tu máquina**, cuando abrís la app y pulsás el botón. No obliga a tocar nada más |
| **Secret de GitHub** | Solo si algún día activás esa búsqueda **dentro del CI**. Hoy el owner decidió no hacerlo, y por eso `ci.yml` tiene un guard que falla si el Secret está presente. Configurarlo en GitHub **no** habilita tu `.env` local, y tocar el `.env` local **no** habilita nada en el pipeline |

El CI no lo usa y no lo necesita. Para el detalle de por qué está comentado ese check y cómo se reactivaría, ver [`### ci.yml`](#ciyml--verificación-automática).

---

## Comandos disponibles

| Comando | Qué hace |
|---|---|
| `npm start` | Compila el frontend y levanta el servidor en el puerto 3000. Es el comando para producción. |
| `npm run dev` | Levanta solo el servidor con auto-reload (`node --watch`). No compila el frontend: usalo con `npm run dev:frontend` en paralelo. |
| `npm run build` | Instala las dependencias del frontend y compila con Vite a `frontend/dist/`. |
| `npm run dev:frontend` | Levanta el dev server de Vite (puerto 5173) con hot reload. Proxy de `/api` hacia el puerto 3000. |
| `bash busqueda_de_trbajosh.sh` | Solo en Linux/macOS/WSL. Compila, levanta, espera y abre el navegador. |

### Desarrollo con recarga en caliente

Para trabajar sobre el frontend necesitás los dos procesos:

```bash
# Terminal 1 — el backend
npm run dev

# Terminal 2 — el frontend con hot reload
npm run dev:frontend
```

En este modo el frontend se sirve en `http://localhost:5173` y redirige las llamadas a `/api` hacia `http://localhost:3000`.

---

## API / endpoints

Todos los endpoints responden JSON. El servidor escucha en `PORT` (3000 por defecto).

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/health` | Comprobación de vida: devuelve `{ ok, uptime, ts }`. No toca la red externa ni necesita `APIFY_API_TOKEN`, así que responde al instante. La usan el `HEALTHCHECK` del `Dockerfile` y el smoke test del CI. |
| `GET` | `/api/profile` | Devuelve el perfil del candidato (skills, experiencia, zonas) que se usa para el matching. |
| `GET` | `/api/jobs?region=X` | Lista de ofertas de una región, con su % de match ya calculado. Sin `region` usa `argentina`. |
| `GET` | `/api/job?q=ID` | Detalle de una oferta puntual a partir de su ID. |
| `GET` | `/api/cover-letter?region=X&id=Y` | Carta de presentación generada para esa oferta, en el idioma de la región. |
| `GET` | `/api/analytics` | Análisis de mercado: demanda de skills, brechas, match promedio por región y recomendaciones. |
| `GET` | `/api/consultoras` | Directorio curado de consultoras QA. |
| `POST` | `/api/consultoras/status` | Actualiza el estado de contacto de una consultora. |
| `GET` | `/api/history?region=X` | Historial de ofertas vistas para esa región. |
| `POST` | `/api/refresh` | Fuerza una refresco de las fuentes en vivo. |
| `POST` | `/api/linkedin-search` | Busca ofertas en LinkedIn vía Apify. Envía el body `{ "region": "..." }`. Requiere `APIFY_API_TOKEN`. **Es la única ruta que puede costar plata**: ejecuta un actor de Apify que se factura por ejecución. Sin token devuelve `503` y ni siquiera sale a la red |

### Ejemplos

```bash
# Ofertas de México ordenadas por match
curl "http://localhost:3000/api/jobs?region=mexico"

# Análisis de mercado completo
curl "http://localhost:3000/api/analytics"

# Carta de presentación para una oferta puntual
curl "http://localhost:3000/api/cover-letter?region=argentina&id=remotive-123456"

# Búsqueda en LinkedIn para Europa
curl -X POST "http://localhost:3000/api/linkedin-search" \
  -H "Content-Type: application/json" \
  -d '{"region":"europa"}'
```

### Códigos de error relevantes

| Código | Causa |
|---|---|
| `503` | Falta `APIFY_API_TOKEN` y se intentó una búsqueda en LinkedIn. |
| `502` | Apify rechazó el token o su actor respondió con error. |

---

## Estructura del proyecto

```
busqueda_trabajo/
├── package.json              # Scripts y dependencias del proyecto raíz
├── .env.example              # Plantilla de variables de entorno
├── .gitignore                # Excluye .env, data/, no_subir/ y node_modules/
├── busqueda_de_trbajosh.sh   # Script de arranque para Linux/macOS/WSL
│
├── server/                   # Backend Node sin framework
│   ├── index.js              # Servidor HTTP, enrutado y estáticos
│   ├── jobSources.js         # Consultas a Remotive, Arbeitnow, Himalayas, RemoteOK, Jobicy
│   ├── apifyLinkedin.js      # Scraper de LinkedIn vía Apify (opcional)
│   ├── curatedJobs.js        # Ofertas curadas a mano
│   ├── matcher.js            # Cálculo del % de match y bucketing por región
│   ├── cvProfile.js          # Perfil del candidato y datos del CV
│   ├── coverLetter.js        # Generador de cartas (es/en)
│   ├── history.js            # Historial persistente de ofertas vistas
│   ├── consultoras.js        # Directorio curado de consultoras QA
│   ├── consultorasStore.js   # Persistencia del estado de contacto
│   ├── analytics.js          # Análisis de mercado
│   └── demoData.js           # Datos de respaldo si falla la red
│
├── frontend/                 # App React + Vite
│   ├── src/
│   │   ├── App.jsx           # Componente raíz y ruteo de pestañas
│   │   ├── api.js            # Cliente de la API
│   │   ├── utils.js          # Helpers de formato
│   │   └── components/       # Toolbar, RegionTabs, JobList, modales, etc.
│   ├── vite.config.js        # Puerto 5173 + proxy a la API
│   └── dist/                 # Build de producción (generado)
│
├── data/                     # Datos de runtime — ignorado por Git
│   ├── history.json          # Historial de ofertas vistas
│   └── consultoras-status.json  # Estado de contacto por consultora
│
└── no_subir/                 # Material personal — ignorado por Git
```

---

## Privacidad y datos locales

Este proyecto está diseñado para que **nada de lo tuyo salga de tu máquina**.

**Todo el estado se guarda en `data/`, en disco y en tu equipo:**

- `data/history.json` — qué ofertas viste y cuándo
- `data/consultoras-status.json` — con qué empresas te contactaste y qué respondieron

Son archivos JSON planos. No hay base de datos, no hay servidor externo, no hay analítica ni telemetría. Podés abrir cualquiera de los dos con un editor de texto y ver exactamente qué hay adentro, o borrarlos para empezar de cero.

La carpeta `data/` está en `.gitignore`, así que tu historial nunca se sube al repositorio ni se comparte por accidente.

**`no_subir/`** es una carpeta local para material personal y sensible. Está primera en el `.gitignore` por una razón: **nunca se sube a Git.** Si alguna vez creás archivos ahí, mantenelos ahí.

> [!IMPORTANT]
> Nunca commitees tu `.env` ni la carpeta `no_subir/`. Ejecutá `git status` antes de cada `git add` para confirmar exactamente qué se va a subir.

**Sobre las fuentes externas:** el sistema consulta bolsas de empleo públicas (Remotive, Arbeitnow, Himalayas, RemoteOK, Jobicy) y, solo si lo activás con tu token, LinkedIn vía Apify. Esas consultas van solo de tu máquina a esos servicios. Nunca se envía tu CV, tu nombre ni ningún dato tuyo a esas APIs: se envía el término de búsqueda, nada más.

---

## Cómo contribuir

1. **Fork** el repositorio y creá una rama con un nombre descriptivo.
2. Instalá dependencias con `npm install`.
3. Levantá el entorno de desarrollo con `npm run dev` + `npm run dev:frontend`.
4. Mantené el estilo del código existente: ESM, módulos nativos de Node en el backend, sin frameworks nuevos.
5. Si agregás un endpoint, actualizá la tabla de la API en este README.
6. Abrí un Pull Request describiendo qué cambiaste y por qué.

**Convenciones del proyecto**

- Comentarios explicativos en español, usando `// ↑` en JS/JSX y `/* */` en CSS, siguiendo el estilo ya presente en el código.
- Sin dependencias de runtime nuevas salvo necesidad justificada: el backend se mantiene con los módulos nativos de Node.
- Ningún secreto, token ni dato personal en el repositorio.

---

## CI/CD y despliegue

Hay tres workflows en `.github/workflows/`. Si nunca usaste GitHub Actions, la idea es esta: un *workflow* es un archivo YAML que GitHub ejecuta solo cuando pasa algo (un push, un Pull Request) o cuando alguien lo dispara a mano desde la pestaña **Actions**. Adentro, cada workflow tiene *jobs* (tareas grandes) y cada job tiene *steps* (pasos concretos). Si un paso falla, el job se marca en rojo y el pipeline se detiene ahí: no se publica nada.

| Workflow | Cuándo corre | Qué hace |
|---|---|---|
| `ci.yml` | En cada push a `main` y en cada Pull Request | Verifica que el código esté sano: sintaxis, instalación limpia, build del frontend y un arranque real del servidor. No publica nada. |
| `deploy-pages.yml` | En cada push a `main` que toque `frontend/**`, el `Dockerfile` o los workflows. También manual | Compila el frontend y lo sube a GitHub Pages como demo visual de la interfaz. |
| `docker.yml` | En cada push a `main` que toque el `Dockerfile`, `.dockerignore`, `server/**`, `frontend/**` o un `package.json`. También manual | Construye la imagen Docker con el stack completo y la publica en el GitHub Container Registry (GHCR). |

Los tres conviven. `ci.yml` es la puerta de entrada: es el que te dice si lo que bajaste de `main` funciona. Los otros dos son los dos carriles de publicación, y se complementan en lugar de excluirse (la diferencia está explicada más abajo).

### `ci.yml` — verificación automática

Es el workflow que no publica nada. Su trabajo es fallar acá y no en producción.

> [!IMPORTANT]
> ### 💰 El pipeline no cuesta plata. Por diseño, no por casualidad.
>
> En este repositorio hay una sola funcionalidad que puede generar un cargo real: la búsqueda en LinkedIn, que llama al actor `curious_coder~linkedin-jobs-scraper` de Apify y **se factura por ejecución**. Por decisión del owner, el pipeline no la toca nunca. Está implementado con tres capas que se defienden entre sí:
>
> 1. **El check está comentado.** El `check POST /api/linkedin-search` del smoke test está comentado a propósito. Es el único check del pipeline que podía terminar en una llamada de pago.
> 2. **Un guard corta el job.** Si `APIFY_API_TOKEN` aparece definido en el entorno, el job falla con un `::error::` antes de arrancar el server. O sea: aunque alguien defina el Secret por error, el CI no llega a ejecutar nada.
> 3. **Un escaneo de contenido.** El job `security` busca el prefijo real de los tokens de Apify (`apifsk_` seguido de su cuerpo) en **todos los archivos versionados**, y falla si lo encuentra. Corta la fuga en el push, mucho antes de que alguien copie ese token a un Secret.
>
> **Matiz honesto, porque sin esto el comentario se lee como paranoia:** hoy ese check **no costaría nada**. En `server/apifyLinkedin.js` el token se valida *antes* de la llamada —se lee en la línea ~203 y en las ~206-208 se lanza un `503` si está vacío— y el `fetch` a `api.apify.com` recién está en la línea ~224. Sin token, el endpoint devuelve `503` y jamás sale a la red. El riesgo real era otro: que el CI dependiera de una condición **externa** (que el token no esté configurado) que cualquiera puede cambiar sin querer y sin enterarse, y entonces el actor empezaría a ejecutarse en cada push con el cargo apareciendo en la factura de Apify, no en el log del job. Por eso igual se comenta: para garantizar por diseño que el pipeline no pueda cobrar, sin depender de que hoy el secreto no esté puesto.
>
> #### Cómo reactivarlo, si algún día conviene pagarlo
>
> | Paso | Qué hacer |
> |---|---|
> | 1 | Descomentar la línea `check POST /api/linkedin-search 503` del smoke test, en `.github/workflows/ci.yml` |
> | 2 | Definir `APIFY_API_TOKEN` como Secret del repositorio, **y sacarlo del `env:` del step**, que hoy lo fuerza a cadena vacía |
> | 3 | Comentar el guard de costo. Es obligatorio: ese guard falla justamente cuando el token está presente, así que con el Secret configurado el job cortaría antes de llegar al check |
> | 4 | Correrlo con `workflow_dispatch` **manual**, no en cada push. Un actor que se factura por ejecución, en un check que corre en cada push, es un gasto recurrente |
>
> Al reactivarlo conviene tener en cuenta que ese actor cobra por ejecución, que trae hasta `MAX_RESULTS=50` ofertas, y que usa el endpoint `run-sync-get-dataset-items`, que es **síncrono** y puede tardar hasta 180 segundos: eso también tiene que entrar en el `timeout-minutes` del job.

#### Job `validate` — ¿el código está entero y arranca de verdad?

| Paso | Qué hace | Por qué importa |
|---|---|---|
| `node --check` sobre todos los `server/*.js` | Parsea cada archivo del backend y falla si hay sintaxis inválida | Solo lee el código, no lo ejecuta. Detecta la llave sin cerrar o el paréntesis desbalanceado que romperían el arranque, sin necesidad de un linter |
| `npm ci` en la raíz | Instala las dependencias del backend desde `package-lock.json`, borrando `node_modules` | Reproduce exactamente lo que tenés instalado. Si el lockfile está desincronizado con el `package.json`, falla acá en vez de "funcionar a veces" |
| `npm ci` en `frontend/` (con caché) | Lo mismo para el frontend, reutilizando la caché de npm | La caché se ancla a `frontend/package-lock.json`, así que la instalación pasa de ~40 s a ~5 s |
| `npm run build` (Vite) | Compila el frontend a `frontend/dist` | Es la verificación de valor más alta: si el JSX tiene un error o un import está mal escrito, falla acá y no cuando alguien despliega y ve una página en blanco |
| Comprobar `frontend/dist/index.html` | Verifica que el build haya generado ese archivo | Un build que "termina bien" sin `index.html` es un build inservible |
| Smoke test real | Levanta el server y le pega a la API | Ningún linter reemplaza arrancar el proceso de verdad |

El smoke test es la parte que vale la pena mirar. Seis decisiones:

| Decisión | Por qué |
|---|---|
| Usa el puerto `3100` y no el `3000` | Para no chocar con nada que pueda estar escuchando en el runner |
| Escribe un `.env` **vacío** a propósito | El CI no puede tener el token real de Apify —y no lo necesita—. De paso comprueba lo que más le importa al usuario: que la app arranca y degrada bien sin secreto, que es el estado por defecto de un clone nuevo |
| Un **guard de costo** corta el job si `APIFY_API_TOKEN` está definido | Es la barrera que hace válida la promesa de costo cero. Corre antes de arrancar el server, así que ni siquiera llega a haber un proceso capaz de llamar a Apify. También verifica que el `.env` que escribe el propio job siga con el token vacío, por si alguien edita esa línea |
| El `env:` del step fuerza `APIFY_API_TOKEN: ''` | No es higiene, es una decisión de **costo**: con la cadena vacía, la condición "no hay token" deja de depender de que nadie haya configurado un Secret. Un `env:` de step pisa cualquier Secret con el mismo nombre, así que el token no llega al proceso ni por error |
| Un `trap` mata el proceso aunque el script falle | Sin eso, un error con `set -e` dejaría un Node huérfano ocupando el puerto |
| Si el proceso muere durante el arranque, imprime el log del server y falla en el acto | Mejor que esperar 30 segundos a un timeout que no dice qué pasó |

Después consulta los endpoints de verdad:

| Petición | Resultado esperado | Qué comprueba |
|---|---|---|
| `GET /api/health` | `200` con `ok:true` | Que el server arrancó. Es el endpoint de vida: no toca red externa ni necesita `APIFY_API_TOKEN` |
| `GET /api/profile` | `200` | Que todos los imports del server estén bien resueltos. Es un dato estático |
| `GET /api/consultoras` | `200` | Que el server pueda leer y escribir en la carpeta `data/`, que en Docker va montada como volumen |
| `GET /api/jobs?region=argentina` | `200` | El endpoint más pesado: hace unas 7 llamadas de red a **bolsas de empleo públicas y gratuitas** (Remotive, Arbeitnow, Himalayas, RemoteOK, Jobicy), a través de `server/jobSources.js`. Ese módulo no menciona Apify en ningún lado, así que **desde acá es imposible llegar a una API de pago**: por eso este check sigue activo. Es la prueba de que la búsqueda no revienta |
| `POST /api/linkedin-search` | — | **Comentado a propósito: requiere Apify y tiene costo.** Ver el bloque de arriba. Si algún día molesta `/api/jobs` por lentitud o intermitencia en el runner, comentá esa línea y nada más: el script sigue siendo válido |
| `GET /` | `200` con el `index.html` de React | Ata el backend con la build del frontend: el server sirve `frontend/dist` como estático. Si esa ruta se rompe, falla acá |
| `GET /ruta-inexistente` | `404` | Que el fallback estático no tire |

#### Job `security` — ¿hay vulnerabilidades o secretos subidos?

| Chequeo | Qué bloquea |
|---|---|
| `npm audit` en la raíz, umbral `high` | Cualquier vulnerabilidad alta o crítica. El umbral es estricto porque `dotenv` es la **única** dependencia de runtime que viaja a producción |
| `npm audit` en `frontend/`, umbral `critical` | Vulnerabilidades críticas. Vite y esbuild son `devDependencies`: compilan, pero no llegan ni al bundle que ve el navegador ni a la imagen final |
| Escaneo con `git ls-files` | Que esté versionado un `.env`, cualquier `.env.*` salvo `.env.example`, algo bajo `no_subir/`, un `*.log`, `data/` o `node_modules/` |
| Inspección de `.env.example` | Que alguien haya pegado un `APIFY_API_TOKEN=` con valor real en la plantilla |
| Escaneo de contenido con `grep` del prefijo `apifsk_` | Un **token de Apify con valor real** en cualquier archivo versionado, esté donde esté. Los chequeos de arriba miran nombres de archivo y de variable; este mira el valor. El patrón exige el prefijo seguido de un cuerpo largo, así que los textos que nombran el prefijo (como este) no disparan un falso positivo |

El escaneo usa `git ls-files`, que devuelve la lista exacta de archivos que Git está por subir. Los `*.log` que hay hoy en el disco están en `.gitignore`, así que no aparecen en esa lista: el chequeo confirma justamente que no se los está por subir.

> [!NOTE]
> **Aviso conocido:** quedan 2 vulnerabilidades `high` en las `devDependencies` del frontend — `GHSA-fx2h-pf6j-xcff` (Vite, bypass de `server.fs.deny` en Windows) y `GHSA-67mh-4wv8-2f99` (esbuild, solo afecta al dev server). **No llegan a producción**, porque Vite y esbuild solo se usan para compilar: el pipeline las reporta como advertencia, no como error. Para endurecer el gate, actualizá Vite a `>= 6.4.3` y cambiá `FRONTEND_AUDIT_LEVEL` a `high` en `ci.yml`.

### `deploy-pages.yml` — la interfaz en GitHub Pages

> [!IMPORTANT]
> **Paso obligatorio, una sola vez por repositorio.** Antes de que este workflow sirva para algo, entrá a **Settings → Pages → Build and deployment → Source** y elegí **"GitHub Actions"**. Si queda en "Deploy from a branch", GitHub **ignora el workflow por completo** y la URL te muestra un 404 sin explicación útil. Recién después de cambiar eso, hacé un push a `main` o corré el workflow a mano.

Qué hace, en orden:

1. Compila con el `--base` que reporta Pages.
2. Copia `index.html` a `404.html`.
3. Sube **solo `frontend/dist`** como artifact.
4. Despliega.

Sobre el `--base`: el proyecto vive en un subdirectorio (`https://<usuario>.github.io/busqueda_trabajo/`). Sin ese parámetro, Vite asumiría que la app vive en la raíz del dominio y pediría los assets en `/assets/...`, donde no están: **la página sale en blanco**. Por eso el workflow compila con `npm run build -- --base=...` en lugar del `npm run build` pelado.

Sobre el `404.html`: GitHub Pages es un servidor de archivos estáticos, no una SPA server. Si alguien entra a una subruta directa, Pages busca un archivo con ese nombre exacto, no lo encuentra y muestra su propio 404 en vez de la app. Copiar `index.html` a `404.html` resuelve el caso: React monta igual, porque esta SPA no usa react-router (las pestañas son estado dentro de `App.jsx`, no URLs).

Sobre el artifact: el `path` es `frontend/dist` y no `.`. Subir el repositorio entero significaba publicar también los logs del servidor y la carpeta `server/`.

> [!WARNING]
> **Limitación arquitectónica: GitHub Pages no puede ejecutar el backend.** Esta aplicación tiene una API real, así que en Pages la interfaz se ve y se navega, pero **todas las llamadas a `/api/*` devuelven 404**. Sirve como demo visual, no como aplicación funcional. Para la app real, el carril es el de Docker, que sigue.

### `docker.yml` — la app real, publicada como imagen

Este es el carril de producción. Construye la imagen con el stack completo (frontend compilado + backend Node) y la publica en el **GitHub Container Registry**, el registry de paquetes que ya viene incluido en cada repo de GitHub, con dos tags:

| Tag | Para qué sirve |
|---|---|
| `latest` | La versión buena más reciente. Es la que se tira en un despliegue corriente |
| `sha-<7 caracteres>` | El commit exacto, **inmutable**. Si la de `main` rompió algo, `docker pull ...:sha-a1b2c3d` y volvés a una imagen que se sabía que andaba |

Usa el `GITHUB_TOKEN` con permiso `packages: write`, o sea el token que GitHub le inyecta a cada workflow automáticamente. **No hay que configurar ningún PAT para publicar.**

> [!NOTE]
> **Este workflow no necesita ningún secreto y nunca llama a Apify.** El build es reproducible sin token (ningún `ARG` ni `--secret` lo lee: el token se consulta en tiempo de ejecución), y el `HEALTHCHECK` de la imagen consulta `/api/health`, que no hace llamadas externas. Por eso la imagen se puede construir y publicar desde un fork o desde un Pull Request sin exponer nada y sin gastar nada. El token se pasa únicamente en el `docker run` del despliegue real, que hoy está comentado a propósito.

> [!NOTE]
> El paquete se crea **privado** la primera vez. Para que cualquiera pueda bajarlo sin cuenta, pasalo a público desde la pestaña **Packages** del repo → hacé clic en el paquete → **Change visibility → Public**. Si el paquete queda privado, un servidor con Docker pelado necesita un PAT classic con scope `read:packages` y un `docker login ghcr.io`.

### `Dockerfile` — una imagen de 180 MB en vez de 700 MB

Es `multi-stage`: dos etapas dentro del mismo archivo.

| Etapa | Qué hace |
|---|---|
| `build` | Instala las dependencias del frontend y compila con Vite. Acá viven Vite, esbuild y el resto de las `devDependencies` |
| `runtime` | Copia **solo** lo necesario: `dotenv`, `server/` y el `dist` ya compilado desde la etapa anterior. Corre como el usuario `node` (no-root), expone el 3000 y define un `HEALTHCHECK` contra `/api/health` |

Además del tamaño, esto reduce la superficie de ataque: Vite y esbuild no quedan en la imagen final.

La imagen **no necesita `APIFY_API_TOKEN` ni para construirse ni para arrancar**. Ese endpoint de vida es justamente el que se eligió para el `HEALTHCHECK` porque corre solo cada 30 segundos mientras el contenedor está vivo: si apuntara a una API de pago, la factura crecería sin que nadie pidiera nada.

> [!IMPORTANT]
> La ruta `/app/frontend/dist` es crítica. El server calcula los estáticos desde su propia carpeta (`join(__dirname, '..', 'frontend', 'dist')`), así que la imagen tiene que replicar exactamente esa estructura de carpetas. Si el `dist` se copiara a otro lado, **la API seguiría funcionando pero todos los assets darían 404**.

### Persistencia de datos

El server guarda dos archivos: `data/history.json` (ofertas vistas) y `data/consultoras-status.json` (tracker de consultoras). La imagen declara `VOLUME /app/data`.

> [!WARNING]
> **Si no se monta un volumen, cada redeploy borra el historial y el tracker de consultoras.** El fallo es silencioso: la app sigue funcionando, solo que "olvidó" todo. Docker crea un volumen anónimo que sobrevive a la recreación del contenedor, pero conviene uno con nombre explícito para poder hacer backup o abrir el JSON desde el host.

En Docker:

```bash
docker volume create buscador-data

docker run -d --name buscador -p 3000:3000 \
  -e APIFY_API_TOKEN=tu_token \
  -v buscador-data:/app/data \
  buscador-trabajo
```

En un PaaS (Fly.io, Render, Railway, Kubernetes) es lo mismo: un disco persistente montado en `/app/data`.

### Secrets y variables de GitHub

Van en **Settings → Secrets and variables → Actions**.

| Nombre | Tipo | Para qué | ¿Obligatorio? |
|---|---|---|---|
| `APIFY_API_TOKEN` | Secret | Tu token de [console.apify.com](https://console.apify.com), para la búsqueda en LinkedIn. **Opcional en todas partes** | No. La app arranca y degrada sin él: `/api/linkedin-search` responde `503` |
| `PUBLISH_TO_GHCR` | Variable | Ponele `false` para construir la imagen sin publicarla | No |
| `ENABLE_GHCR_PULL_CHECK` | Variable | `true` agrega un paso que verifica que la imagen se pueda bajar sin login | No |

> [!IMPORTANT]
> **No lo configures en GitHub Actions.** El pipeline no lo usa y no lo necesita: `ci.yml` tiene un guard que **falla el job** si encuentra `APIFY_API_TOKEN` en su entorno, precisamente para que nadie lo active sin querer y termine pagando por cada push. Si algún día querés probar la búsqueda en LinkedIn en el CI, tenés que seguir los pasos de [Cómo reactivarlo](#cómo-reactivarlo-si-algún-día-conviene-pagarlo) —que incluyen desactivar ese guard a propósito y correrlo manual, no en cada push.
>
> El Secret solo tiene sentido para el **despliegue real** (el `-e APIFY_API_TOKEN` del `docker run` en un VPS, Fly.io, Render, etc.). La app en **Pages y en GHCR funciona sin ese Secret**, y la imagen se construye sin él.

> [!NOTE]
> El token de Apify **nunca se hornea en la imagen**. No se pasa como `ARG` ni como `--secret` del build, porque los `ARG` quedan grabados en el historial de la imagen para siempre. Viaja en tiempo de ejecución, con `-e APIFY_API_TOKEN=...` o con el Secret del orquestador.

### Correr los workflows a mano

Los tres tienen `workflow_dispatch`, así que podés dispararlos desde la pestaña **Actions** del repo, con el botón **Run workflow**. Sirve, por ejemplo, para republicar `latest` sin tocar una línea de código.

### Docker local

```bash
# Construir la imagen
docker build -t buscador-trabajo .

# Correrla con volumen persistente y el token de Apify
docker run -d --name buscador -p 3000:3000 \
  -e APIFY_API_TOKEN=tu_token \
  -v buscador-data:/app/data \
  buscador-trabajo

# Bajar la imagen ya publicada por el workflow
docker pull ghcr.io/<usuario>/busqueda_trabajo:latest
```

### Nota: los dos workflows que se eliminaron

El repositorio traía dos workflows de Pages que no correspondían a este proyecto y se borraron:

| Workflow eliminado | Por qué |
|---|---|
| `jekyll-gh-pages.yml` | Es la plantilla de Jekyll que crea GitHub al marcar el repo como "GitHub Pages". Acá no hay Jekyll ni `_config.yml`: el workflow no aplicaba |
| `static.yml` | Subía el repositorio **entero** como sitio estático (`path: .`), publicando los logs del servidor, la carpeta `server/` y todo lo demás del working tree |

---

## Licencia

Este proyecto usa licencia **MIT**.

El archivo `LICENSE` todavía no está en el repositorio. Para completar la licencia, agregá un `LICENSE` en la raíz con el siguiente contenido:

```text
MIT License

Copyright (c) 2026 Ali Valentin Tovar Morales

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

**Autor:** Ali Valentin Tovar Morales · QA Engineer

*Documentado por Ali Valentin Tovar Morales*
