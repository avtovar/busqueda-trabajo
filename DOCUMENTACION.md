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
- `frontend/src/utils.js` — Helpers puros: color del match, días desde una fecha, URL de búsqueda LinkedIn, clases por categoría.
- `frontend/src/styles.css` — Todos los estilos de la app (tema oscuro, cards, modales, análisis, responsive).
- `frontend/src/components/CvPanel.jsx` — Panel lateral con el CV de Ali (avatar, sobre mí, skills, enlaces).
- `frontend/src/components/RegionTabs.jsx` — Pestañas de región (países + Propuesta de Interés + Consultoras).
- `frontend/src/components/Toolbar.jsx` — Barra de acciones: actualizar búsqueda, alternar historial, buscar en LinkedIn.
- `frontend/src/components/JobList.jsx` — Lista de tarjetas de oferta con paginación y badge de historial.
- `frontend/src/components/JobDetailModal.jsx` — Modal de detalle de una oferta: resumen, skills, descripción, copiar CV, generar carta.
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

---

**Autor y creador:** Ali Valentin Tovar Morales · QA Engineer

*Documentado por Ali Valentin Tovar Morales*