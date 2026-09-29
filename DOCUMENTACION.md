# Documentación - busqueda_trabajo

Sistema web para encontrar las mejores ofertas de empleo QA adaptadas al CV de **Ali Tovar (QA Engineer)**. Un backend Node (sin framework) consulta bolsas de empleo en vivo (Remotive, Arbeitnow, Himalayas, RemoteOK, Jobicy) y también busca en LinkedIn mediante un actor de **Apify**, calcula el % de match de cada oferta contra el perfil del candidato, las clasifica por región (Argentina, México, Perú, Colombia, Chile, Europa, EE.UU.) y las muestra en un frontend React + Vite. Incluye historial de 30+ días, generador de cartas de presentación, directorio de 133 consultoras QA con tracker de contacto, y una página de "Propuesta de Interés" que compara el mercado vs. el CV y genera recomendaciones.

## Estructura

- `server/index.js` — Servidor HTTP (sin framework): sirve la API JSON y el frontend compilado (`frontend/dist`).
- `server/cvProfile.js` — Fuente de verdad del perfil de Ali: skills con pesos, keywords, marketSkills (para detectar brechas) y regiones.
- `server/jobSources.js` — Agregador de fuentes de empleo en vivo (fetch a APIs públicas) + clasificación de región y deduplicación.
- `server/apifyLinkedin.js` — Búsqueda de ofertas en LinkedIn a través de un actor de Apify (LinkedIn no tiene API pública para buscar ofertas). Arma la query con las keywords del CV y rankea el resultado.
- `server/matcher.js` — Motor de matching: calcula el score 0-100 de cada oferta y asigna la región.
- `server/analytics.js` — Analítica de mercado: demanda de skills, brechas del CV, recomendaciones automáticas (página "Propuesta de Interés").
- `server/coverLetter.js` — Genera carta de presentación personalizada (es/en según la región) y resumen de empresa.
- `server/history.js` — Historial persistente de ofertas vistas (se guarda en `data/history.json`).
- `server/consultoras.js` — Directorio curado de 133 consultoras QA (dato estático).
- `server/consultorasStore.js` — Tracker de contacto por consultora (estado, fecha, notas) guardado en `data/consultoras-status.json`.
- `server/curatedJobs.js` — Catálogo de ofertas relevadas a mano (bolsas propias, mail, portales, LinkedIn) que se suman a la búsqueda.
- `server/demoData.js` — Ofertas de ejemplo que se muestran cuando las fuentes en vivo fallan (modo demo).
- `frontend/index.html` — HTML raíz de la SPA: un `<div id="root">` vacío donde React dibuja toda la interfaz.
- `frontend/vite.config.js` — Configuración de Vite: plugin de React, carpeta de salida (`dist`) y puerto del dev server.
- `frontend/src/main.jsx` — Punto de entrada de React: renderiza `App` dentro de `#root`.
- `frontend/src/App.jsx` — Componente raíz: maneja estado global (región, vista live/historial, modales) y orquesta todas las secciones.
- `frontend/src/api.js` — Capa de acceso a la API del backend, con datos de respaldo si el server está caído.
- `frontend/src/utils.js` — Helpers puros: color del match, **detección de idioma (castellano/inglés) de cada oferta a partir de su texto, con caché por id**, días desde una fecha, URL de búsqueda LinkedIn, clases por categoría.
- `frontend/src/styles.css` — Todos los estilos de la app (tema oscuro, cards, modales, etiqueta de idioma, análisis, responsive).
- `frontend/src/components/CvPanel.jsx` — Panel lateral con el CV de Ali (avatar, sobre mí, skills, enlaces).
- `frontend/src/components/RegionTabs.jsx` — Pestañas de región (países + Propuesta de Interés + Consultoras).
- `frontend/src/components/Toolbar.jsx` — Barra de acciones: actualizar búsqueda, alternar historial, buscar en LinkedIn y filtrar por % de match mínimo (presets 0/25/50/100 + valor a medida de 80 a 100, que queda guardado en el navegador).
- `frontend/src/components/LanguageBadge.jsx` — Etiqueta informativa "ES"/"EN" con el idioma detectado de la oferta. Es un `<span>` (no un botón): no filtra ni hace nada, y si la confianza es baja se atenúa.
- `frontend/src/components/JobList.jsx` — Lista de tarjetas de oferta con paginación, badge de historial y la etiqueta de idioma junto al % de match.
- `frontend/src/components/JobDetailModal.jsx` — Modal de detalle de una oferta: resumen, skills, descripción, etiqueta de idioma, copiar CV, generar carta.
- `frontend/src/components/LetterModal.jsx` — Modal que muestra la carta de presentación generada y permite copiarla/descargarla.
- `frontend/src/components/ConsultorasList.jsx` — Lista de consultoras QA con filtro por categoría y tracker de contacto.
- `frontend/src/components/AnalysisPage.jsx` — Página "Propuesta de Interés": gráficos de barras, brechas, fortalezas y recomendaciones.
- `busqueda_de_trbajosh.sh` — Script de arranque para Linux/macOS/WSL: compila, levanta el server, espera a que responda y abre el navegador.
- `.env.example` — Plantilla de variables de entorno (token vacío). Se copia a `.env`, que **nunca** se sube a Git.
- `data/` — Datos de runtime (NO se suben a GitHub, están en `.gitignore`): historial y estado de consultoras.
- `no_subir/` — Carpeta local privada (NO se sube nunca).
- `README.md` — Instalación, comandos, variables de entorno y referencia de la API.

## Comandos

```
npm start            -> compila frontend + levanta el server en :3000 (producción)
npm run dev          -> levanta SOLO el server con auto-reload (node --watch)
npm run build        -> instala y compila el frontend con Vite
npm run dev:frontend -> levanta el dev server de Vite (solo frontend)
```

En Linux, macOS o WSL hay un atajo que hace todo lo anterior y además abre el navegador:

```bash
cp .env.example .env   # opcional: solo si vas a usar la búsqueda con Apify
bash busqueda_de_trbajosh.sh
```

La API queda disponible en `http://localhost:3000/api/*` y el frontend compilado en la raíz.

### Variables de entorno

| Variable | Obligatoria | Default | Para qué sirve |
| -------- | ----------- | ------- | -------------- |
| `APIFY_API_TOKEN` | No | — | Habilita la búsqueda en LinkedIn vía Apify. Sin ella, el resto de la app funciona igual. |
| `PORT` | No | `3000` | Puerto del servidor HTTP. |

## Conceptos clave que se ven en este proyecto

1. **Backend Node sin framework** — el server usa solo módulos nativos de Node (`node:http`, `node:fs/promises`, `node:path`) y enruta a mano por `url.pathname`.
2. **`fetch` nativo + `Promise.allSettled`** — se consultan varias fuentes de empleo en paralelo; si una falla, las demás siguen sin romper la búsqueda.
3. **Matching por texto (regex)** — el score se calcula buscando skills del perfil dentro del título/descripción/tags de cada oferta, con palabras completas (no subcadenas) para evitar falsos positivos.
4. **Motores de región** — se detecta si la ubicación menciona Argentina/Europa/EEUU/Latam y se asigna la oferta a un bucket por región antes de rankearla.
5. **Historial en archivo JSON** — sin base de datos: `history.js` lee/escribe `data/history.json` para que las ofertas vistas persistan entre reinicios.
6. **React con hooks** — `useState` para el estado local, `useEffect` para la carga inicial y `useCallback` para las funciones que se pasan a componentes hijos.
7. **Props y eventos** — los componentes hijos reciben datos y callbacks por props (ej. `onOpen`, `onSelect`, `onRefresh`) y los disparan desde la vista.
8. **Las regiones "virtuales"** — `analisis` y `consultoras` no son países: son pestañas que cambian por completo lo que muestra el panel derecho.
9. **Cleanup de regex** — se escapan los caracteres especiales de cada skill (`escapeReg`) y se usa `\b`/bordes de palabra para que "qa" no matchee dentro de "quality".
10. **Los pesos del CV** — cada skill de `cvProfile.js` tiene un número entre 0 y 1 que dice cuánto vale para el candidato. El score no es "cuántas skills matchean", sino "cuánto pesan las que matchean".
11. **LinkedIn vía Apify (tercero)** — no se puede scrapear LinkedIn directo desde el navegador por CORS, así que se delega a un actor de Apify. La clave viaja en el header `Authorization: Bearer` y se lee de `process.env`, nunca hardcodeada.
12. **`AbortController` como timeout** — las búsquedas externas pueden colgarse; el `AbortController` + `setTimeout` cortan la espera y devuelven un error 504 en vez de dejar la request viva para siempre.
13. **Secretos fuera del repo** — `.env` está en `.gitignore` y solo existe `.env.example` con el valor vacío. El `.env` real vive únicamente en la máquina de cada uno.
14. **`set -Eeuo pipefail` en bash** — `-e` corta ante un error, `-u` trata una variable no definida como error, y `pipefail` hace fallar un pipe si falla cualquiera de sus partes. Con eso, un fallo silencioso no se cuela.
15. **`trap` para limpiar procesos** — si el usuario corta el script con Ctrl+C, el `trap` mata el proceso del servidor para no dejar un proceso zombie ocupando el puerto.

## Árbol de dependencias (frontend)

```
frontend/index.html
  └─ frontend/src/main.jsx
       ├─ styles.css              ✅ importado (estilos globales)
       └─ App.jsx                 ✅
            ├─ components/CvPanel.jsx          ✅
            ├─ components/RegionTabs.jsx       ✅
            ├─ components/Toolbar.jsx          ✅
            ├─ components/JobList.jsx          ✅
            ├─ components/ConsultorasList.jsx  ✅
            ├─ components/AnalysisPage.jsx     ✅
            ├─ components/JobDetailModal.jsx   ✅
            ├─ components/LetterModal.jsx      ✅
            └─ api.js             ✅ (utilizado por App y ConsultorasList)

Configuración del bundler:
  frontend/vite.config.js  ✅ lo lee Vite automáticamente al buildear

Backend (server/)
index.js  →  cvProfile.js · jobSources.js → matcher.js · coverLetter.js · history.js
          →  apifyLinkedin.js (búsqueda en LinkedIn; usa cvProfile + matcher)
          →  consultoras.js → consultorasStore.js · analytics.js · demoData.js
          →  curatedJobs.js (se suma a las fuentes en vivo en la búsqueda)
```

## API / Endpoints

| Método | Ruta | Qué hace |
| ------ | ---- | -------- |
| GET | `/api/profile` | Devuelve el perfil estructurado de Ali (skills, keywords, regiones). |
| GET | `/api/jobs?region=X` | Ofertas rankeadas de la región X (argentina, europa, eeuu, mexico, peru, colombia, chile). |
| GET | `/api/job?q=ID` | Detalle de una oferta (por id) + resumen de empresa/skills. |
| GET | `/api/cover-letter?region=X&id=Y` | Carta de presentación generada (es/en según la región). |
| POST | `/api/refresh` | Refresca la búsqueda ahora (ignora la caché de 30 min). |
| POST | `/api/linkedin-search` | Busca ofertas en LinkedIn vía Apify para la región del body (`{ "region": "argentina" }`). Requiere `APIFY_API_TOKEN`. Errores: 400 región inválida, 402 sin saldo, 503 sin token, 504 timeout. |
| GET | `/api/history?region=X` | Ofertas vistas desde enero 2026 para la región X (marca activas/inactivas). |
| GET | `/api/analytics` | Agregado de mercado: demanda por skill, brechas, recomendaciones. |
| GET | `/api/consultoras` | Listado de consultoras con su estado de contacto persistido. |
| POST | `/api/consultoras/status` | Guarda el estado/notas de contacto de una consultora. |
| GET | `/api/health` | Endpoint de vida: `{"ok":true,"uptime":<segundos>,"ts":"<ISO>"}`. No toca red externa ni necesita `APIFY_API_TOKEN`, así que responde siempre al instante. Lo usan el `HEALTHCHECK` del `Dockerfile` y el smoke test de GitHub Actions. |

## CI/CD (GitHub Actions)

Esta es la referencia técnica de *por qué* el pipeline está armado así. Para el *cómo se usa* (requisitos, secretos, comandos y Docker local) está la sección `## CI/CD y despliegue` del `README.md`.

El pipeline vive en tres archivos de `.github/workflows/` y en el `Dockerfile` de la raíz. Los dos carriles de publicación no son excluyentes:

| Archivo | Tipo | Qué publica | Qué NO puede hacer |
| ------- | ---- | ------------ | ------------------ |
| `ci.yml` | CI | Nada: solo verifica | **No puede gastar plata.** El único check capaz de llamar a una API de pago está comentado, hay un guard que falla si aparece un token, y el job `security` escanea el prefijo real de Apify en los archivos versionados |
| `deploy-pages.yml` | CD | La UI estática en GitHub Pages | No puede ejecutar el backend: sin él, `/api/*` da 404 |
| `docker.yml` + `Dockerfile` | CD | La imagen con el stack completo en GHCR | No necesita ningún secreto ni llama a Apify: el build es reproducible sin token |

El detalle de la política de costos está en su propia sección, más abajo: [Política de costos](#política-de-costos-por-qué-el-pipeline-nunca-llama-a-apify).

### `ci.yml` — decisiones de diseño

| Decisión | Por qué |
| -------- | ------- |
| `npm ci` en vez de `npm install` | `npm ci` borra `node_modules` e instala exactamente lo que dice el lockfile, sin resolver versiones ni tocar el lockfile. Es la diferencia entre "funciona en mi máquina" y "funciona en todas partes": si el lock y el `package.json` no coinciden, falla en el CI en lugar de fallar en producción. |
| `node --check` como verificador de sintaxis | Es un **parser**, no un linter: lee el archivo y devuelve error si hay una llave sin cerrar o un paréntesis desbalanceado, pero **no ejecuta el código** (no levanta el server, no pega a la red), así que es seguro. Como el `package.json` raíz tiene `"type": "module"`, Node lo interpreta como ESM y los `import` de cada módulo pasan la validación. Es el parser de la casa: el proyecto no tiene ESLint ni tests, y esto detecta al menos los errores que romperían el arranque. |
| El smoke test escribe un `.env` **vacío** a propósito | El CI no puede tener el token real de Apify, y no lo necesita. Además, el arranque sin secreto es el caso por defecto de cualquiera que clone el repo, así que ese es el escenario que hay que probar. |
| Un **guard de costo** que falla el job si hay `APIFY_API_TOKEN` | Es lo que hace verdadera la promesa de "el pipeline no cuesta plata". Va primero, antes de arrancar el server, así que cuando hay un token configurado por error no llega a existir un proceso capaz de llamar a Apify. También mira el `.env` que escribe el propio job, por si alguien edita esa línea. |
| El `env:` del step fija `APIFY_API_TOKEN: ''` | No es higiene de configuración, es una decisión de **costo**: es lo que garantiza que ninguna ruta pueda cobrar. Un `env:` de step pisa cualquier Secret con el mismo nombre, así que el token no llega al proceso ni aunque alguien lo haya definido. Va en el step y no como variable global del workflow para que el alcance sea el más chico posible. |
| `trap cleanup EXIT` mata el proceso del server | Sin el `trap`, un `set -e` cortaría el script dejando un Node huérfano ocupando el puerto. Con el `trap` en `EXIT`, el cleanup corre pase lo que pase: error, timeout o éxito. |
| `timeout-minutes` en cada job | Un job colgado consume minutos facturables del runner sin aportar información útil. Es un timebox: preferís un corte con el log del log a un job que dura 6 horas. |
| El job `security` usa `needs: validate` | Si el código ni siquiera compila, no tiene sentido auditar dependencias. Encadenando el job, el runner se libera antes y **el log del error real queda arriba de todo**, sin ruido de auditoría abajo. |
| Permisos `contents: read` en todo el CI | El CI solo lee código. Declarar el token más poderoso posible deja cualquier paso que publique bloqueado por defecto: si algún día alguien agrega uno, hay que pensarlo. |
| El escaneo de archivos usa `git ls-files` en vez de gitleaks | gitleaks exige licencia para organizaciones con cierto tamaño y agrega una dependencia externa que puede caerse. `git ls-files` devuelve **la lista exacta de archivos que Git está por subir**, que es la fuente de verdad real, y ya viene con Git: cero dependencias, cero licencias. |
| El escaneo valida también el contenido de `.env.example` | Los greps de nombres de archivo no lo ven, porque `.env.example` es legal. Pero si alguien pegó el token real en la plantilla, eso sí es una fuga: el archivo tiene que seguir con `APIFY_API_TOKEN=` vacío. |
| Un `grep` de contenido busca `apifsk_` en los archivos versionados | Los chequeos anteriores miran **nombres** de archivo y de variable. Este mira el **valor**, y es el único que encuentra un token pegado dentro de un `.md`, un `.json` o un `.yaml`. Cortar en el push es mucho más barato que cortar en la factura de Apify, y además cierra el camino más obvio para que un token filtrado termine en un Secret de GitHub. |
| El patrón del `grep` exige el prefijo **más un cuerpo largo** | Un `grep` del prefijo a secas se dispararía con la documentación del propio repo, que lo menciona para explicarlo: en el bloque de comentarios del propio `ci.yml` y en el bloque de Secrets de `docker.yml`. El patrón `apifsk_[A-Za-z0-9]{20,}` separa "hablar del token" de "tener el token": un token real son decenas de caracteres aleatorios después del prefijo, y un texto que lo nombra nunca va a tener 20 alfanuméricos pegados atrás |
| El paso de los `*.log` casi siempre pasa en verde | Los logs (`stdout.log`, `server-err.log`, `stderr.log`...) **están en el disco** pero en `.gitignore`, así que no aparecen en `git ls-files`. Que el chequeo confirme eso es justamente el objetivo: que nadie los esté subiendo sin darse cuenta. |
| `\|\| true` dentro de cada `grep` del escaneo | Sin eso, `set -o pipefail` hace que un `grep` sin coincidencias (código de salida 1) aborte el script entero, que es exactamente el resultado que significa "todo bien". |
| El log del server se sube como artifact solo si el job falló | `if: failure()` en el `upload-artifact`: no gastar espacio en runnings que pasaron, y tener el log a mano cuando algo se rompió. |

El smoke test, endpoint por endpoint:

| Petición | Esperado | Qué está probando en realidad |
| -------- | -------- | ------------------------------ |
| `GET /api/health` | `200` + `ok:true` | El proceso arrancó y el enrutado funciona. Es el único endpoint que no depende de nada externo, así que sirve de señal de vida. |
| `GET /api/profile` | `200` | Que todos los imports del server (`cvProfile`, `matcher`, ...) estén resueltos. No toca la red. |
| `GET /api/consultoras` | `200` | Que el server pueda leer y escribir `data/`. En Docker esa carpeta es un volumen, y este paso es el que avisa si la ruta dejara de existir. |
| `GET /api/jobs?region=argentina` | `200` | El camino más pesado: unas 7 llamadas a bolsas de empleo **públicas y gratuitas** (Remotive, Arbeitnow, Himalayas, RemoteOK, Jobicy). `server/jobSources.js` no menciona Apify en ningún lado, así que desde acá es imposible llegar a una API de pago. Por eso este check queda activo. |
| `POST /api/linkedin-search` | — | **Comentado a propósito: es el único check capaz de gastar plata.** Ver la política de costos de abajo. |
| `GET /` | `200` con `<div id="root"` | **Atiente el backend con la build del frontend.** El server sirve `PUBLIC_DIR` como estático, así que este paso falla si se mueve `join(__dirname, '..', 'frontend', 'dist')` o si el build no llegó. |
| `GET /ruta-inexistente` | `404` | Que el fallback estático no explote ni devuelva el index con un 200. |

### Política de costos: por qué el pipeline nunca llama a Apify

Decisión del owner del proyecto: **el CI no debe gastar plata.** En esta app hay una sola funcionalidad que puede generar un cargo real, y el diseño del pipeline existe para que esa funcionalidad nunca se ejecute en una automatización.

#### De dónde viene el riesgo

`server/apifyLinkedin.js` es el **único** módulo del proyecto que llama a Apify, y lo hace contra `https://api.apify.com/v2/acts/curious_coder~linkedin-jobs-scraper/...`, o sea el actor `curious_coder~linkedin-jobs-scraper`. Ese endpoint se factura **por ejecución**.

`server/jobSources.js` —el módulo detrás de `/api/jobs`— no menciona Apify en ningún lado: consulta solo APIs públicas y gratuitas. `Dockerfile` tampoco: su `HEALTHCHECK` va contra `/api/health`, que no hace llamadas externas. O sea que hay **un solo camino** en todo el proyecto capaz de cobrar, y es `POST /api/linkedin-search`.

#### Por qué igual se comenta el check, si hoy no costaría nada

Este es el punto que hay que entender bien, porque sin él el comentario se lee como paranoia y termina borrado en la próxima refactorización:

| Línea de `apifyLinkedin.js` | Qué pasa |
| --- | --- |
| ~203 | Se lee `process.env.APIFY_API_TOKEN` |
| ~206-208 | Si está vacío, se lanza `httpError(..., 503)` y la función termina |
| ~224 | Recién acá está el `fetch` a `api.apify.com` |

La validación del token es **anterior** al `fetch`. Sin token, el endpoint devuelve `503` y **jamás sale a la red**: hoy ese check no costaría un peso.

El riesgo real era la dependencia de una condición **externa**. La garantía de costo quedaba atada a un factor que el repo no controla: que nadie haya definido `APIFY_API_TOKEN` como Secret. Basta con que alguien lo haga —por la razón más inocente del mundo, "dejemos probado el botón de LinkedIn"— para que el actor empiece a ejecutarse en cada push. Y ese gasto **no aparece en el log del job**: aparece en la factura de Apify, semanas después, sin ninguna pista de qué commit lo empezó.

Comentar el check invierte la dependencia. Ahora la garantía es del repo, no del estado de un panel de configuración: **por diseño, el pipeline no puede generar costo.**

#### Las tres capas, y por qué hace falta más de una

| Capa | Dónde | Qué previene |
| ---- | ----- | ------------ |
| 1. Check comentado | Smoke test de `ci.yml` | Que exista una línea activa capaz de llamar al actor de pago |
| 2. Guard de costo | Antes de arrancar el server, en el mismo smoke test | Que un Secret agregado por error habilite esa línea. Falla con `::error::` y mensaje explícito |
| 3. Escaneo de `apifsk_` | Job `security` | Que un token con valor real llegue a existir en el repo. Corta en el push, y de paso cierra el camino más obvio para que alguien lo copie a un Secret |

Ninguna de las tres alcanza sola. La capa 1 sola depende del estado del panel de Secrets; la capa 2 sola no impide que el token quede escrito en un archivo; la capa 3 sola no impide que alguien lo configure en la UI de GitHub.

#### Cuándo querer evaluar si vale la pena pagar Apify

**El lugar exacto a tocar es el check comentado del smoke test en `.github/workflows/ci.yml`**, en la línea comentada `check POST /api/linkedin-search 503`, dentro del step *"Smoke test: arrancar el server y consultar la API"*. Los pasos exactos están escritos en el mismo bloque de comentarios del archivo, y en el `README.md`. En resumen:

1. Descomentar esa línea.
2. Definir `APIFY_API_TOKEN` como Secret del repositorio y quitar el `env:` del step que hoy lo fuerza a cadena vacía.
3. **Comentar el guard de costo del mismo step.** Hace falta sí o sí: ese guard falla justamente cuando el token está presente, así que con el Secret configurado el job cortaría antes de llegar al check.
4. Correrlo con `workflow_dispatch` manual, no en cada push.

Qué tener en cuenta al decidir, sin volverlo un informe de mercado:

| Factor | Dato concreto |
| ------ | ------------- |
| Modelo de cobro | Apify factura **por ejecución** del actor, no por consulta. El costo escala con la cantidad de búsquedas, no con la cantidad de usuarios |
| Volumen de una corrida | `MAX_RESULTS = 50`, que se manda como `limitPerSource` al actor y vuelve como `resultLimit` en la respuesta |
| Modo de la llamada | `run-sync-get-dataset-items` es **síncrono**: lanza el actor y espera el dataset terminado. El `timeout` del request es de **180 s** |
| Impacto en el CI | Esos 180 s tienen que entrar en el `timeout-minutes` del job (hoy 10), y el `--max-time` del `check` (hoy 90 s) necesitaría un margen mayor |
| Unicidad | Al reactivarlo, ese pasa a ser **el único** check del pipeline capaz de gastar plata. Los demás siguen siendo gratuitos |
| Recomendación de diseño | Si se activa, manual y consciente. Un deploy automático que corre en cada push convierte cada commit en un gasto posible, que es exactamente el escenario que esta política busca cerrar |

#### Dos caminos independientes: `.env` local y Secret de GitHub

Vale la pena dejarlo explícito porque es donde más se confunde:

- **El `.env` local** habilita la búsqueda en LinkedIn **en tu máquina**, cuando abrís la app y pulsás el botón. No obliga a tocar nada del pipeline.
- **El Secret de GitHub** solo tendría sentido si se activara la búsqueda **dentro del CI**. Hoy está desactivado a propósito, y por eso `ci.yml` falla si lo encuentra.

Configurar el Secret **no** obliga a tocar el `.env` local, y viceversa. Son dos caminos separados: el primero es de uso diario del owner, el segundo es una decisión de infraestructura que por ahora se dejó sin tomar.

> [!NOTE]
> **Vulnerabilidades conocidas del frontend:** quedan 2 `high` en `devDependencies` — `GHSA-fx2h-pf6j-xcff` (Vite, bypass de `server.fs.deny` en Windows) y `GHSA-67mh-4wv8-2f99` (esbuild, solo dev server). Por eso `FRONTEND_AUDIT_LEVEL` es `critical` y no `high`: Vite y esbuild compilan, pero no llegan al bundle del navegador ni a la imagen final, así que no son riesgo de producción. La raíz sí usa umbral `high`, porque `dotenv` es la única dependencia que se ejecuta en producción. Para cerrarlas: Vite `>= 6.4.3` y `FRONTEND_AUDIT_LEVEL: high`.

### `deploy-pages.yml` — decisiones de diseño

| Decisión | Por qué |
| -------- | ------- |
| El build pasa `--base` con `steps.pages.outputs.base_path` | El proyecto vive en un subdirectorio (`https://<usuario>.github.io/busqueda_trabajo/`). Sin `base`, Vite asume `/` y genera los assets en la raíz del dominio, donde no existen: **la página publicada sale en blanco**. El `base` sale de la propia salida de `configure-pages`, así que no está hardcodeado y se adapta solo. |
| `404.html` es una copia exacta de `index.html` | GitHub Pages es un servidor de archivos estáticos, no una SPA server: si alguien entra a `/mi-ruta`, busca un archivo llamado literalmente `mi-ruta`, no lo encuentra y devuelve su propio 404 en lugar de la app. Copiar el `index.html` resuelve el caso, y funciona porque **esta SPA no usa react-router** (las pestañas son estado dentro de `App.jsx`, no URLs): React monta igual y todo navega. |
| `grep '/assets/'` en el `index.html` antes de subir | Detecta un `base` mal configurado **antes** de gastar un deploy. El síntoma en producción es una página en blanco, que es de las fallas más difíciles de diagnosticar a posteriori. |
| El artifact es `frontend/dist` y no `.` | Pages debe ver únicamente lo que genera Vite. El workflow anterior subía `path: '.'`, o sea el repositorio entero: publicaba los logs del servidor, la carpeta `server/` y cualquier otra cosa del working tree. |
| `cancel-in-progress: false` con `group: pages` | **Nunca** se cancela un deploy a medio hacer: el sitio quedaría inconsistente, con parte del artifact viejo y parte del nuevo. Todos los deploys comparten el grupo `pages` para que dos pushes seguidos no se pisen. En el CI y en Docker sí se cancela, porque ahí el run que quedó atrás ya no le sirve a nadie. |
| `id-token: write` | Pages valida con OIDC que el deploy viene de un workflow legítimo y no de alguien con un token robado. **Nunca uses un PAT para esto**: el token de OIDC es de vida corta y está atado a este workflow. |
| Un solo job en vez de build + deploy | El artifact de Pages pesa unos cientos de KB. Partirlo en dos jobs agregaría una subida y una descarga entre runners sin ganar nada. |
| `paths:` en el trigger | Un cambio en un `.md` o en un archivo de `server/` no cambia un byte de la UI estática. El filtro evita gastar un runner y redesplegar lo mismo. |
| `environment: github-pages` | Es lo que ata el job al environment de Pages y lo que genera el `page_url` que se muestra en la pestaña Deployments. |

> [!WARNING]
> **El paso que hay que hacer una sola vez a mano:** en `Settings → Pages → Build and deployment → Source` hay que elegir **"GitHub Actions"**. Mientras quede en "Deploy from a branch", GitHub ignora el workflow y la URL muestra un 404 sin explicación. Ningún ajuste en el YAML lo arregla.

### `docker.yml` y `Dockerfile` — decisiones de diseño

| Decisión | Por qué |
| -------- | ------- |
| Imagen `multi-stage` (`build` → `runtime`) | Vite, esbuild y el resto de las `devDependencies` son cientos de MB que **no se necesitan para ejecutar** la app. El stage `runtime` copia de cero solo `dotenv`, `server/` y el `dist` ya compilado: ~180 MB en vez de ~700 MB, y de paso Vite y esbuild no quedan en la imagen para que nadie los exploten. |
| `COPY package.json package-lock.json` **antes** del `npm ci` | Es la técnica de la capa de caché de dependencias: mientras el lockfile no cambie, Docker reutiliza la capa del `npm ci` de builds anteriores. Si se copiaran también los fuentes antes del install, cada cambio en un `.jsx` invalidaría esa capa y se reinstalaría todo. |
| `npm ci --omit=dev` en el stage `runtime` | Reinstala desde el lockfile y descarta las `devDependencies` otra vez, por si el contexto del build las trajo pegadas. |
| `cache-to: type=gha,mode=max` | `mode=max` guarda **todas** las capas intermedias, no solo la final. Sin las capas del stage de build de React, la próxima compilación del frontend no se podría cachear. Con `cache-from: type=gha`, el build típico baja de ~90 s a menos de 30 s. |
| El token de Apify **no** se pasa como `ARG` ni como `--secret` del build | Los `ARG` de un build quedan grabados en el historial de la imagen: `docker history` los muestra y cualquiera con acceso al registry los lee. El token no se necesita para construir, así que la imagen se arma sin él y se pasa **en tiempo de ejecución** con `-e APIFY_API_TOKEN=...` o con el Secret del orquestador. |
| `CMD ["node", "server/index.js"]` en forma exec | Node queda como **PID 1** del contenedor y recibe `SIGTERM` directamente, así que `docker stop` baja limpio. Detrás de un shell (`sh -c`) la señal se perdería y el contenedor terminaría por `SIGKILL`. |
| `USER node` | El usuario por defecto de `node:20-alpine` es root, y un contenedor root con una vulnerabilidad de escape es el peor escenario posible. Con `node` el proceso no puede tocar nada fuera de `/app`. |
| `HEALTHCHECK` contra `/api/health` | Un health check que consulta bolsas de empleo externas daría falsos positivos por culpa de la red de un tercero. `/api/health` no toca red externa ni necesita `APIFY_API_TOKEN`, así que mide lo único que importa: **el proceso está sirviendo**. El orquestador lee el código de salida, no la respuesta. Y hay una razón de costo que va más allá de la fiabilidad: este chequeo corre **solo, cada 30 s, mientras el contenedor está vivo**. Si apuntara a un endpoint de pago, la factura crecería sin que nadie la pidiera. Por eso `/api/health` es el único candidato aceptable, y no solo por los falsos positivos |
| `VOLUME ["/app/data"]` declarado en la imagen | Ver la sección de persistencia de abajo. |
| Se publica con el `GITHUB_TOKEN` y `packages: write` | Es el token que GitHub inyecta en cada workflow, con vida corta y scopeado a este repo. **No hay que crear ni rotar ningún PAT para publicar.** |
| `PUBLISH_TO_GHCR` como `vars` (no `secrets`) | No es un secreto: es un interruptor. Va en `Settings → Secrets and variables → Actions → Variables`. El `!` en `push: ${{ vars.PUBLISH_TO_GHCR != 'false' }}` hace que el default sea publicar y apagar el push sea lo excepcional. |
| Tag `sha-<7>` además de `latest` | `latest` se mueve siempre; el tag por commit es **inmutable** y es lo que hace posible un rollback real: volvés a una imagen que se sabe que andaba, en lugar de adivinar. |
| `cancel-in-progress: true` en Docker | Al revés que en Pages: acá el build que quedó atrás ya no le sirve a nadie, y cancelarlo libera el runner más rápido. |
| Commentado a propósito el bloque de deploy por SSH | El workflow **no** necesita secretos hoy. Dejar el bloque comentado documenta cómo se haría sin que un `secrets.X` sin configurar mande warnings en cada run. Y ese `docker run` es el **único** lugar del pipeline donde el token se usaría de verdad, porque es el único que levanta la app real para usuarios. Por eso no está automatizado: se corre a mano, bajo control del owner, que es lo apropiado para una API que se factura |
| El build no necesita ningún secreto, ni siquiera un `ARG` propio | Compila React e instala `dotenv`: nada de eso lee `APIFY_API_TOKEN`, que se consulta en tiempo de ejecución y solo si alguien llama a `POST /api/linkedin-search`. Consecuencia práctica: la imagen se puede construir y publicar desde un fork o desde un Pull Request sin exponer nada **y sin gastar nada**, porque no hay ningún camino de cobro en este workflow |

### `.dockerignore` — por qué importa más de lo que parece

| Exclusión | Motivo |
| --------- | ------ |
| `.env`, `.env.*`, `*.env` | **Seguridad.** Los layers de una imagen no se borran: se agrega una capa nueva encima. Que un archivo no esté excluido no significa "no se ve", significa **que queda adentro para siempre**, y `docker history` lo delata. Un `docker build .` desde la máquina de alguien pondría el token de Apify y el material de `no_subir/` dentro de la imagen, que después se publica en un registry. |
| `no_subir/` | Mismo motivo, más lo obvio: es material personal que no tiene por qué viajar a ningún lado. |
| `data/` | Es estado de runtime de la máquina de quien compila. En la imagen `/app/data` se crea vacía y se persiste con el volumen. |
| `node_modules`, `**/node_modules` | Cientos de MB que se transmiten y comprimen en cada build, y que se reinstalan adentro con `npm ci` igual. Además, el `node_modules` de Windows tiene archivos que **no existen en Linux** (y al revés): mandarlo rompe la imagen. |
| `frontend/dist`, `dist` | La imagen genera su propio dist. Copiar el local además rompe la caché y podría meter un dist viejo o compilado con el `--base` de Pages. |
| `*.log`, `logs`, `npm-debug.log*` | Son la salida de procesos que corrieron localmente, no parte de la app, y pueden tener fragmentos de URLs con tokens. |
| `.git`, `.github`, `.gitignore` | La historia del repo pesa y no sirve para nada adentro. Excluir `.git` también evita filtrar datos de otros commits por accidente. |
| `*.sh`, `README.md`, `DOCUMENTACION.md`, `LICENSE` | El launcher es para tu máquina y los `.md` no se ejecutan: ocupan espacio y solo confunden a quien lea la imagen. |

### `GET /api/health` — el endpoint que sostiene el pipeline

Es el endpoint más chico del proyecto y el que más uso tiene dentro de la infraestructura:

```json
{ "ok": true, "uptime": 1234, "ts": "2026-01-15T12:00:00.000Z" }
```

| Campo | Qué es |
| ----- | ------ |
| `ok` | Siempre `true`. Si el server no puede responder, no hay respuesta: eso es lo que hace útil al endpoint. |
| `uptime` | Segundos desde que arrancó el proceso, redondeados. Sirve para distinguir "recién arrancó" de "lleva rato caído y arrancó solo". |
| `ts` | Fecha y hora ISO del momento de la respuesta. |

Tres propiedades, y las tres importan:

1. **No consulta bolsas de empleo externas.** `/api/jobs` puede tardar 30 segundos o fallar por la red de un tercero; `/api/health` responde siempre al instante. Un health check que dependa de la red externa mide la salud de otro servicio, no la del contenedor.
2. **No lee disco ni necesita `APIFY_API_TOKEN`.** Corre en el mismo orden que el resto de las rutas y antes de cualquier dependencia externa, así que sirve como señal de vida incluso en el caso por defecto, sin ningún secreto configurado.
3. **No consulta el estado de la app.** No valida que las bolsas estén funcionando bien. Para eso está `/api/jobs`. `/api/health` responde una sola pregunta: *¿hay alguien escuchando?*

Lo usan dos consumidores:

- El `HEALTHCHECK` del `Dockerfile`, que hace `fetch` a `127.0.0.1:$PORT/api/health` y sale con `0` si `r.ok`, o con `1` si no. El orquestador lee el código de salida.
- El smoke test de `ci.yml`, que lo usa como señal de arranque en la espera activa y después valida que la respuesta traiga `ok:true`.

### Persistencia en la imagen

`VOLUME ["/app/data"]` existe por una razón concreta: las rutas de los archivos de datos no se calculan con `process.cwd()`, salen de `import.meta.url`, así que son **siempre** `<carpeta del server>/../data`, o sea `/app/data` en el contenedor.

El fallo que previene es el peor de los modos de fallo posibles: **si no se monta un volumen, cada redeploy borra el historial y el tracker de consultoras, y no hay ningún error.** La app sigue funcionando, solo que "olvidó" todo. Docker inicializa el volumen con el contenido de la imagen (vacía) y, si no se pasa uno con `-v`, crea un volumen anónimo que sobrevive a la recreación del contenedor. Aun así, conviene un volumen con nombre explícito para poder hacer backup o abrir el JSON desde el host:

```bash
docker volume create buscador-data
docker run -v buscador-data:/app/data ...
```

En un orquestador (Swarm, Kubernetes, Fly.io, Render, Railway) es lo mismo, traducido a un `PersistentVolumeClaim` o a la opción de disco persistente del proveedor, montado en `/app/data`.

### Los dos workflows que se eliminaron

| Workflow | Por qué se eliminó |
| -------- | ----------------- |
| `jekyll-gh-pages.yml` | Es la plantilla de Jekyll que GitHub crea al marcar el repo como "GitHub Pages". Este proyecto no usa Jekyll ni tiene `_config.yml`: el workflow compila con `actions/jekyll-build-pages` y sube un `_site` que no es la app. |
| `static.yml` | Subía el repositorio **entero** como sitio estático (`path: '.'`). Publicaba los logs del servidor, la carpeta `server/` y cualquier otra cosa del working tree. Además no compilaba nada: sin build de Vite, tampoco podía servir la app. |

Los dos eran la configuración por defecto de un repo nuevo de GitHub, no una decisión de este proyecto. `deploy-pages.yml` los reemplaza: compila con Vite, respeta el `base` de Pages y sube solo `frontend/dist`.

---

**Autor y creador:** Ali Valentin Tovar Morales · QA Engineer

*Documentado por Ali Valentin Tovar Morales*