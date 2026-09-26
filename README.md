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

Es la única variable que aporta una funcionalidad extra. Sin ella:

- El resto de fuentes en vivo (Remotive, Arbeitnow, Himalayas, RemoteOK, Jobicy) sigue funcionando.
- El matching, el historial, las cartas, el CV y el directorio de consultoras siguen funcionando.
- Únicamente el botón de búsqueda en LinkedIn devuelve un error `503` con un mensaje claro.

Si lo configurás mal (token rechazado), la API responde `502` explicando el problema. Nunca se expone el valor del token en las respuestas de la API.

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
| `GET` | `/api/profile` | Devuelve el perfil del candidato (skills, experiencia, zonas) que se usa para el matching. |
| `GET` | `/api/jobs?region=X` | Lista de ofertas de una región, con su % de match ya calculado. Sin `region` usa `argentina`. |
| `GET` | `/api/job?q=ID` | Detalle de una oferta puntual a partir de su ID. |
| `GET` | `/api/cover-letter?region=X&id=Y` | Carta de presentación generada para esa oferta, en el idioma de la región. |
| `GET` | `/api/analytics` | Análisis de mercado: demanda de skills, brechas, match promedio por región y recomendaciones. |
| `GET` | `/api/consultoras` | Directorio curado de consultoras QA. |
| `POST` | `/api/consultoras/status` | Actualiza el estado de contacto de una consultora. |
| `GET` | `/api/history?region=X` | Historial de ofertas vistas para esa región. |
| `POST` | `/api/refresh` | Fuerza una refresco de las fuentes en vivo. |
| `POST` | `/api/linkedin-search` | Busca ofertas en LinkedIn vía Apify. Envía el body `{ "region": "..." }`. Requiere `APIFY_API_TOKEN`. |

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
