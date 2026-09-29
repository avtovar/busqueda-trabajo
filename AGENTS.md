# AGENTS.md — Buscador de Empleo QA

Instrucciones para sesiones de OpenCode. Todo lo de acá se verificó leyendo el código
y la configuración; si algo deja de ser cierto, actualizá este archivo.

**Leé también [`MEMORIA.md`](MEMORIA.md)**: tiene el contexto de trabajo que no se deduce
del código —el diagnóstico de los problemas que se reportó, qué se corrigió a medias y
qué quedó pendiente. Sobre todo la sección 4 (trabajo de frontend sin hacer) y la 5
(la forma correcta de probar el endpoint de Apify sin gastar).

## Comandos

| Comando | Qué hace de verdad |
|---|---|
| `npm start` | `npm run build && node server/index.js`. Compila primero, después levanta. |
| `npm run build` | OJO: es `npm --prefix frontend install && npm --prefix frontend run build`. **Instala dependencias cada vez** (golpe de red). Para iterar rápido usá `npm --prefix frontend run build`, que solo compila. |
| `npm run dev` | Solo backend, con `node --watch`. **No compila el frontend**: sin `dist/` actualizado vas a ver la app vieja. |
| `npm run dev:frontend` | Vite en el 5173, con proxy de `/api` al 3000. Hay que correr los dos a la vez. |
| `bash busqueda_de_trbajosh.sh` | Solo bash (Git Bash / WSL / Linux / macOS). Desde PowerShell no funciona. |
| `PORT=3100 node server/index.js` | Puerto configurable. El CI usa 3100 para no chocar con nada. |

**No hay linter, ni formateador, ni typecheck, ni framework de tests.** No los busques
ni los agregues: la verificación es manual (ver abajo).

## Verificación (es lo único que hay)

```bash
# 1. Sintaxis del backend, sin ejecutar nada
node --check server/index.js && node --check server/portal.js   # repetí por archivo

# 2. Que el JSX compila (detecta imports rotos, el error más común)
npm --prefix frontend run build

# 3. Que el server arranca y responde
PORT=3100 node server/index.js &
curl -fsS localhost:3100/api/health
curl -fsS localhost:3100/api/jobs?region=argentina
curl -fsS localhost:3100/api/history?region=argentina
```

Si tocaste `frontend/src`, el paso 2 es obligatorio: sin build, `server/index.js`
sirve el `dist/` viejo y vas a "verificar" código que no está en pantalla.

## La regla que más cuesta aprender: Apify cuesta plata

`POST /api/linkedin-search` **ejecuta un actor de Apify que se factura por ejecución**.
No es una API gratuita como las demás fuentes.

- **Nunca la llames para "probar que anda"**, ni en un test, ni en un smoke test, ni
  para verificar un cambio. Verificá el resto de los endpoints: son gratis.
- `server/jobSources.js` (Remotive, Arbeitnow, Himalayas, RemoteOK, Jobicy) es el
  camino gratis. Ese módulo **no menciona Apify en ningún lado**, y por eso el CI puede
  pegarle a `/api/jobs` sin riesgo de cobro. No lo "conectes" a Apify.
- `ci.yml` tiene tres capas para que el pipeline no pueda cobrar: el check de
  `/api/linkedin-search` está comentado a propósito, hay un guard que **falla el job**
  si `APIFY_API_TOKEN` está definido en el entorno, y un `grep` busca el prefijo real
  de los tokens (`apifsk_`) en todos los archivos versionados. Si tocás `ci.yml`,
  no reactivés el check sin que te lo pidan explícitamente.
- Nunca leas, imprimas ni commitees el valor de `APIFY_API_TOKEN` de `.env`.

## Arquitectura: lo que no se deduce de los nombres

- **Un solo proceso sirve la API y el frontend.** `server/index.js` resuelve estáticos
  desde `join(__dirname, '..', 'frontend', 'dist')`. Si no compilaste, `GET /` da 404.
  `frontend/dist` está en `.gitignore`: es build artifact, no se versiona.
- **No hay base de datos.** Son dos JSON planos en `data/` (`history.json` y
  `consultoras-status.json`), con mutex, escritura atómica `.tmp`+rename, y un `.bak`.
  `data/` está en `.gitignore` y contiene datos reales del usuario.
- **Para no ensuciar `data/` en pruebas**, sobreescribí la carpeta con las variables
  `HISTORY_DATA_DIR` y `CONSULTORAS_DATA_DIR` (las leen `server/history.js:20` y
  `server/consultorasStore.js:20`) apuntando a un temp. Si vas a tocar `data/` de
  verdad, hacé backup primero: `history.json` tiene el historial real y no hay forma
  de recuperarlo si se pisa.
- **`server/portal.js` es el paso obligatorio antes de responder ofertas.** `withPortal()`
  agrega `portal` y `sourceUrl` y devuelve una **copia**; nunca hay que mutar los
  objetos de `cache` ni de `lastApifyJobs`. Si agregás un endpoint que devuelve ofertas,
  pasalo por `enrichJob`/`enrichJobs`/`enrichRegions` de `server/index.js`, si no el
  frontend recibe ofertas sin portal ni link de origen.
- **`server/matcher.js` es lógica de negocio, no plumbing.** `rankByRegion()` saca las
  ofertas con score 0 y las reparte en 7 buckets fijos; `assignRegion()` combina
  `regionGuess` con el texto de `location`. Que una oferta caiga en otro bucket del
  pedido es un comportamiento conocido, no un bug a arreglar de paso.
- **El historial se escribe en un solo lugar:** `recordSearch()` en `server/history.js`.
  Cualquier fuente nueva que quiera persistirse tiene que pasar por ahí. Ojo: en
  Windows la escritura atómica hace `rm` + `rename`, así que hay una ventana en la que
  el archivo no existe.
- **Las 7 regiones** son claves fijas (`argentina`, `europa`, `eeuu`, `mexico`, `peru`,
  `colombia`, `chile`) y están repetidas en varios módulos: si agregás una, tocá
  `matcher.js`, `apifyLinkedin.js` y los `REGION_LOCATION` del frontend.

## Convenciones del repo

- **Comentarios `// ↑` en JS/JSX y `/* */` en CSS, en español, explicando el porqué**
  (no el qué). Son densos y están en casi todas las líneas. Es una convención real del
  proyecto, no decoración: el código nuevo va con el mismo estilo o parece que no es del
  proyecto.
- ESM (`"type": "module"`), `node:http` a pelo, sin Express. **`dotenv` es la única
  dependencia de runtime**: no agregues otra sin justificación fuerte.
- 2 espacios, comillas simples, punto y coma, funciones flecha.
- Si agregás un endpoint, actualizá la tabla de la API del `README.md` (el README es
  la documentación real del proyecto y está más completo que `DOCUMENTACION.md`).

## Estado actual (verificado al 2026-09-29)

Hay trabajo **aplicado en el working tree pero sin commitear** que cambia el contrato:

- Ya está en `server/`: el límite de Apify es configurable (`APIFY_MAX_RESULTS`, default
  200, clamp 20..1000, paginado hasta 8 páginas), `/api/linkedin-search` **sí** persiste
  en el historial y devuelve `{ jobs, regions, stats, saved, checkedAt }`, existe
  `server/portal.js`, y `history.js` recuperó del `.bak` y dejó de colisionar la clave.
- **El frontend todavía NO consume nada de eso**: `Toolbar.jsx` sigue diciendo
  "limitada a 50 resultados" (ya es falso), y `JobList.jsx` / `JobDetailModal.jsx` no
  renderizan `portal`, `sourceUrl`, `saved` ni `stats`. Es el trabajo pendiente natural.
- `.github/workflows/` tiene 3 workflows (`ci.yml`, `deploy-pages.yml`, `docker.yml`).
  El `Dockerfile` es multi-stage y **depende de que el build quede exactamente en
  `frontend/dist`**: si se copia a otro lado, la API sigue andando pero los assets dan 404.

Esto es el resumen; el detalle de cada punto, con los `archivo:línea` del diagnóstico,
está en [`MEMORIA.md`](MEMORIA.md) secciones 3 y 4. Actualizá los dos juntos si cambia.
