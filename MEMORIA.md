# MEMORIA.md — Contexto de trabajo

Archivo de memoria del proyecto. **No es documentación general**: para cómo está armado
el proyecto están `README.md` (completo), `AGENTS.md` (instrucciones para agentes) y
`DOCUMENTACION.md`. Acá queda lo que costó trabajo descubrir: el diagnóstico de un
reporte concreto, qué se corrigió y qué queda a medio hacer.

Última actualización real: **2026-09-29**.

---

## 1. El reporte que originó todo

El usuario reportó textualmente:
> "solo trabaja en la actualización de la base de datos cuando se actualiza con Apify,
> solo me da los 50 y no los guarda en la base de dato y otra no me da el link que me
> lleve a la búsqueda o que me oriente de donde salió esa oferta"

Traducido a tres defectos concretos:

| # | Lo que el usuario veía | Lo que pasaba en realidad |
|---|---|---|
| A | "solo me da los 50" | El tope de 50 era **nuestro**, no de Apify. El actor admite ~1000. |
| B | "no los guarda en la base de datos" | Las ofertas de Apify **nunca** se persistían: faltaba la llamada. |
| C | "no me da el link ni de dónde salió" | El link no se renderizaba en la lista, y muchas ofertas no lo tienen. |

---

## 2. Diagnóstico con evidencia (antes de tocar nada)

### A. El límite de 50

- `server/apifyLinkedin.js:30` — `const MAX_RESULTS = 50;` hardcodeado.
- `server/apifyLinkedin.js:238` — se mandaba como `limitPerSource` en el body al actor.
  El actor `curious_coder~linkedin-jobs-scraper` documenta que si se omite ese campo
  scrapea "as many as LinkedIn returns (up to ~1000)".
- El texto de la UI lo recitaba: `Toolbar.jsx:175-177` decía "limitada a 50 resultados".

No era un límite de plataforma: era una decisión de código, y el actor pagaba igual.

### B. Nunca se guardaban (este era el bug de verdad)

- `server/index.js:235-248` (versión vieja): el handler de `POST /api/linkedin-search`
  llamaba a `searchLinkedInWithApify()` y hacía `sendJSON()`. Fin. **Sin `recordSearch()`.**
- `recordSearch()` (`server/history.js:247`) solo se llamaba desde `getRanked()` en
  `server/index.js:151`, que usa exclusivamente `fetchJobs()` (APIs gratuitas) + `CURATED_JOBS`.
- **Prueba empírica:** `data/history.json` tenía 229 entradas y **0** con
  `source: "LinkedIn / Apify"`, y **0** ids con prefijo `linkedin-`.

Consecuencia: los 50 vivían solo en el estado de React (`App.jsx:237`) y se perdían con
F5, al cambiar de región, al tocar "Actualizar búsqueda" o al togglear el historial.
El botón "Actualizar" (`POST /api/refresh`) ni siquiera llama a Apify: reemplaza la lista
de 50 por la de las fuentes gratuitas. De ahí la sensación de "se pierden".

### C. Link y origen

- El modelo **sí** tenía `applyUrl` y `source`, y la API los exponía. El problema era de
  renderizado y de ciclo de vida, no de contrato de datos.
- `JobList.jsx` renderiza `{job.company} · {job.source}` (línea 278) pero **no renderiza
  `applyUrl` en ningún punto de la tarjeta**. El link solo existía en el modal.
- `JobDetailModal.jsx:168` muestra el botón solo si `job.applyUrl && job.applyUrl !== '#'`.
- **18 de 57 ofertas curadas tienen `applyUrl: ''`** y 16 entradas del historial también.
  Para esas, no había ningún destino en ninguna parte de la app.
- Para Apify el link sí llegaba (`mapJob` exige `link` o descarta la oferta), pero como
  no se guardaban, el usuario nunca llegaba a ver el botón.
- Bonus: `GET /api/job?q=<id>` y `/api/cover-letter` buscan solo en la caché de
  `getRanked()`, así que para un id `linkedin-*` **daban 404 siempre** y el detalle y la
  carta degradaban.

### Pérdidas silenciosas que rodeaban el problema

- `matcher.js:184` — `if (match.score <= 0) continue;` descarta ofertas no-QA sin avisar.
- `apifyLinkedin.js` (viejo) línea 305 — `const jobs = ranked[region] || []` tiraba
  **todos** los otros buckets. Causa concreta: `assignRegion()` (`matcher.js:149-170`) mira
  el texto de `location` y pisa el `regionGuess`, así que una oferta buscada para Argentina
  con `location: "Berlin"` caía en el bucket `europa` y desaparecía.
- `history.js` vieja `keyOf()` = `título::empresa`: dos ofertas del mismo puesto en la misma
  empresa **se pisaban**, y con 200 ofertas de LinkedIn pasaba constantemente.
- `history.js` vieja línea 206: `if (err.code === 'ENOENT') return emptyHistory();` — si el
  archivo desaparecía, devolvía vacío **sin intentar el `.bak`**, que es justo cuando serviría.
  Peor: `save()` escribía `DATA_FILE` **y** `BAK_FILE` desde el mismo objeto vacío, así que
  no quedaba red de seguridad.

---

## 3. Lo que se corrigió (backend)

El registro siguiente resume el cambio original del backend; el estado de Git mencionado
en la versión anterior de esta memoria era una foto histórica y no describe el working tree actual.

- **Límite configurable** — `apifyLinkedin.js`: `maxResults(limit)` con prioridad
  `limit` del body > `APIFY_MAX_RESULTS` > `200`, clamp 20..1000. La implementación
  anterior creaba hasta 8 URLs y enviaba el límite entero como `limitPerSource` para
  cada una. Esto multiplicaba la cantidad solicitada; el parámetro es un máximo *por
  URL*, según el esquema público del actor. La corrección actual manda una sola URL,
  dejando que el actor la pagine hasta el límite solicitado. Se mantiene el timeout
  síncrono de Apify en 300 s y el del cliente en 320 s.
- **Persistencia** — `index.js:292-352`: el handler ahora llama a `recordSearch(data.regions || {})`
  con **todos** los buckets, no solo el pedido. Devuelve `saved: { ok, total, message }`.
  Si el guardado falla **no se rompe la búsqueda** (el usuario ya pagó la ejecución) pero
  el error queda en la respuesta y en `console.error` — se terminó el `catch {}` mudo.
- **`lastApifyJobs`** — `index.js:110`, `findById()` lo consulta como fallback, así que
  `/api/job` y `/api/cover-letter` resuelven ids `linkedin-*`.
- **Sin pérdidas de información** — la respuesta ahora incluye `regions` (todos los buckets),
  `stats` (recibidos/duplicados/sinLink/viejas/sinMatch/otrasRegiones) y `checkedAt`.
  Antes nada de esto se reportaba, por eso el usuario veía "faltan ofertas" sin explicación.
- **`server/portal.js` (nuevo)** — `portalOf(job)`, `searchUrlFor(job)`, `withPortal(job)`.
  Agrega los campos `portal` (nombre corto: `LinkedIn`, `Remotive`, `Arbeitnow`, `Himalayas`,
  `RemoteOK`, `Jobicy`, `Curada`, `Demo`) y `sourceUrl` (link a la **búsqueda** en el portal,
  no a la oferta) para que siempre haya una forma de orientarse aunque falte `applyUrl`.
  `withPortal()` devuelve una **copia**: nunca mutar `cache` ni `lastApifyJobs`.
- **Bugs de pérdida de datos en `history.js`** — `keyOf()` ahora incluye un slug del link,
  con `legacyKeyOf()` para leer/migrar las 229 entradas viejas (la lectura itera sobre
  `Object.entries`, nunca busca por clave, así que no se rompe nada). `load()` ahora intenta
  el `.bak` en `ENOENT` vía `readBak()`, y `save()` ya no pisa el `.bak` con un estado peor.

### Verificado funcionando (smoke test real, 2026-09-29)

Con `HISTORY_DATA_DIR` y `CONSULTORAS_DATA_DIR` apuntando a un temp, puerto 3100:

- `GET /api/health` → `200` `{"ok":true,...}`
- `GET /api/jobs?region=argentina` → `200`, 25 ofertas, **con `portal` y `sourceUrl` ya poblados**
- `GET /api/history?region=argentina` → `200`, 25 ofertas con `portal`
- El `data/history.json` real quedó **intacto**: sigue con 229 entradas y 0 de LinkedIn.
  El override por env fue lo que protegió los datos reales. Confirmar ese paso SIEMPRE.

### Prueba real con Apify (2026-09-29 18:09) — APROBADA, contra la base real

Autorizada explícitamente por el usuario. Corrida única, con el token real:

```
POST /api/linkedin-search  { "region": "argentina", "limit": 50 }   →  64.4 s
```

| Qué se comprobó | Resultado |
|---|---|
| Entradas antes → después | 229 → **307** |
| Pérdidas | **0** (comparación clave por clave contra el backup previo) |
| Agregadas | **78**, todas `source: "LinkedIn / Apify"` |
| Con `applyUrl` real | **78 / 78** |
| Con `portal` definido | **78 / 78** (`LinkedIn` en todas) |
| `.bak` vs `history.json` | mismo SHA-256 → los dos escritos |
| `.tmp` huérfanos | ninguno (la escritura atómica cerró bien) |

**Persistencia tras apagar todo** (lo que pidió verificar el usuario): se bajó el proceso
del server, se arrancó uno **nuevo** y `GET /api/history?region=argentina` devolvió las
**78 ofertas de LinkedIn intactas**, con link, portal y `activo=true`. Los datos viven en
disco, no en memoria. La persistencia funciona.

La prueba histórica confirmó la persistencia y también dejó en evidencia la
multiplicación que luego se corrigió:

- **Pedir 50 guardó 78.** `pageCount(50)` generó 2 URLs, con un máximo de 50 resultados
  por URL: ~100 crudos → 78 únicos con score > 0. `recordSearch()` recibió todos los
  buckets, incluidas las ofertas que `assignRegion()` ubicó en otra región. Esa cantidad
  superior al límite no era comportamiento deseado: el límite se aplicaba por URL y la
  implementación actual ya envía una sola.
- **La clave con link funciona en la práctica.** En la muestra hay *dos* entradas con el
  mismo título y la misma empresa (FullStack, "QA Automation Engineer Lead") pero con
  `applyUrl` distinto: quedaron separadas. Con la `keyOf` vieja se habrían pisado y se
  habría perdido una.

Lo que **no** se pudo verificar: la forma exacta de la respuesta (`stats`, `saved`,
`checkedAt`) y si la pantalla los muestra, porque el script de la prueba falló al guardar
el JSON de respuesta (las barras invertidas de la ruta se interpretaron como escapes de
JavaScript). El efecto en la base sí quedó comprobado. Para reverificar la respuesta sin
gastar de nuevo, usar comillas dobles o `path.join` en el runner.

### Trampa de la prueba: el puerto

`server/index.js:51` lee `PORT` del entorno, pero **`$env:PORT` en PowerShell tiene que
setearse ANTES de `Start-Process`**: si se setea después, el hijo no lo hereda y el server
arranca en el 3000. El 3000 suele estar tomado por la app del propio usuario, y el server
muerre con `EADDRINUSE` sin avisar nada útil. Para las pruebas, usar 3100.

---

## 4. Frontend de LinkedIn — implementado

El frontend ahora permite elegir el límite y lo manda en el body del POST. Muestra el
resultado del guardado, el momento de la última corrida y las estadísticas de descarte.
Las tarjetas y el modal presentan el portal y usan el link directo o, si falta, la URL
de búsqueda del portal. `App.jsx` también conserva los buckets de todas las regiones de
la respuesta, de modo que las ofertas reclasificadas no se pierden al cambiar de pestaña.

La interfaz presenta el número pedido como máximo. LinkedIn puede devolver menos ofertas
únicas tras aplicar disponibilidad, fecha, link, deduplicación y match con el CV.

---

## 5. La trampa que casi cuesta plata (leer antes de probar nada)

Intenté probar que `POST /api/linkedin-search` devuelve `503` sin token, y **fallé la forma**:
puse `APIFY_API_TOKEN=''` en el proceso *cliente* del `node -e`, no en el del servidor. Pero
`server/index.js:9` hace `import 'dotenv/config'`, o sea que **el token se lee del `.env` al
arrancar el servidor**. El cliente no tiene ningún poder sobre eso: la petición salió con el
token real y arranca a ejecutar el actor de Apify. Lo corté a los 20 s matando el proceso,
así que probablemente se arrancó a facturar una ejecución.

**La forma correcta de probar el camino sin token es arrancar el servidor SIN token**, no
enviar la variable desde otro proceso. O directamente no probar ese endpoint: los demás son
gratis y verifican lo mismo.

Corolario: **el token se lee una vez, al arrancar**. Cambiar `.env` exige reiniciar el server.

---

## 6. Restricciones que hay que respetar siempre

- `POST /api/linkedin-search` **se factura por ejecución**. No llamarlo para "probar que
  anda". `server/jobSources.js` (Remotive, Arbeitnow, Himalayas, RemoteOK, Jobicy) es el
  camino gratis y **no menciona Apify en ningún lado** — por eso el CI puede pegarle a
  `/api/jobs` sin riesgo. No conectarlo a Apify.
- `ci.yml` tiene tres capas para que el pipeline no pueda cobrar: el check de
  `/api/linkedin-search` está comentado a propósito, hay un guard que **falla el job** si
  `APIFY_API_TOKEN` está definido, y un `grep` del prefijo real `apifsk_` sobre los archivos
  versionados. No reactivés el check sin que lo pidan explícitamente.
- Nunca leer, imprimir ni commitear el valor de `APIFY_API_TOKEN` de `.env`.
- `data/` tiene datos reales del usuario. Para pruebas: `HISTORY_DATA_DIR` y
  `CONSULTORAS_DATA_DIR` a un temp. Si hay que tocarlo de verdad, backup primero.
- `no_subir/` y `.env` nunca se suben.

---

## 7. Mantenimiento de documentación

- `README.md` describe el contrato actual y el uso de una sola URL para evitar multiplicar
  el límite por cada URL enviada al actor.
- `DOCUMENTACION.md` conserva secciones históricas del CI; si se cambia el endpoint o su
  política de costo, sincronizar esa sección con el contrato de `README.md`.
