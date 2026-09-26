// ============================================================================
// Servidor HTTP del buscador de empleo QA (Node sin framework).
// Este archivo es el "cerebro" del backend: enruta a mano cada request hacia
// la API correspondiente (perfil, ofertas, cartas, historial, analítica,
// consultoras) y además sirve los archivos compilados del frontend React.
// ============================================================================

// ↑ Módulo nativo de Node para crear el servidor con HTTP
import 'dotenv/config';
import { createServer } from 'node:http';
// ↑ Lee archivos del disco (lo usa para servir el frontend compilado)
import { readFile } from 'node:fs/promises';
// ↑ Arma rutas de archivos y detecta la extensión para elegir el Content-Type
import { join, extname } from 'node:path';
// ↑ Convierte la URL del módulo actual en una ruta de carpeta válida
import { fileURLToPath } from 'node:url';
// ↑ Perfil estructurado de Ali (skills, keywords, regiones): se sirve en /api/profile
import { PROFILE } from './cvProfile.js';
// ↑ Agregador que trae las ofertas desde las bolsas de empleo en vivo
import { fetchJobs } from './jobSources.js';
// ↑ Ranking maestro: asigna región a cada oferta y calcula su % de match
import { rankByRegion } from './matcher.js';
// ↑ Genera la carta de presentación y el resumen de empresa de una oferta
import { generateCoverLetter, summarize } from './coverLetter.js';
// ↑ Ofertas demo de respaldo, por si las fuentes en vivo no responden
import { DEMO_JOBS } from './demoData.js';
// ↑ Ofertas cargadas a mano (mail/portal/LinkedIn) que siempre entran a la búsqueda
import { CURATED_JOBS } from './curatedJobs.js';
// ↑ Historial persistente: registra ofertas vistas y las devuelve por región
import { recordSearch, getHistoryForRegion, expireOldJobs } from './history.js';
// ↑ Directorio estático de consultoras QA (dato curado)
import { CONSULTORAS } from './consultoras.js';
// ↑ Tracker de contacto por consultora: lee y guarda el estado en disco
import { loadStatus, setStatus, ESTADOS } from './consultorasStore.js';
// ↑ Analítica de mercado: demanda, brechas y recomendaciones automáticas
import { buildAnalytics } from './analytics.js';
import { searchLinkedInWithApify } from './apifyLinkedin.js';

// ↑ Resuelve la carpeta de este archivo para ubicar el resto de las rutas
const __dirname = fileURLToPath(new URL('.', import.meta.url));
// El frontend ahora es una app React compilada con Vite (ver /frontend).
// `npm start` corre `npm run build` antes de levantar el server, así que esta
// carpeta siempre existe cuando el server arranca en producción.
// ↑ Carpeta del frontend ya compilado por Vite (se genera con npm run build)
const PUBLIC_DIR = join(__dirname, '..', 'frontend', 'dist');
// ↑ Puerto de escucha: toma la variable PORT del entorno o usa el 3000
const PORT = process.env.PORT || 3000;

// ↑ Mapa de extensión -> Content-Type: le dice al navegador cómo interpretar cada archivo
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
};

// ↑ Helper que responde cualquier dato como JSON con el código HTTP indicado
function sendJSON(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// ↑ Lee el cuerpo de una petición POST y lo interpreta como JSON
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    // ↑ Va acumulando los "pedazos" (chunks) que viajan por la red
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy(); // límite de seguridad, 1MB
    });
    // ↑ Cuando llega todo el body, intenta parsearlo como JSON
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        // ↑ Si el JSON viene mal formado, se rechaza con un error descriptivo
        reject(new Error('JSON inválido'));
      }
    });
    // ↑ Si la conexión se corta a mitad de camino, también se rechaza
    req.on('error', reject);
  });
}

// Cache de la última búsqueda (30 min)
// ↑ Guarda en memoria la última búsqueda para no volver a golpear las APIs
let cache = { data: null, at: 0, online: false };
// ↑ TTL = tiempo de vida de la caché: 30 minutos expresados en milisegundos
const TTL = 30 * 60 * 1000;
let refreshing = null; // evita refrescos simultáneos si se clickea 2 veces

// Devuelve { regions, _online } con datos DEMO como respaldo cuando las fuentes
// en vivo están bloqueadas o no devuelven ofertas. Así la app funciona siempre.
// force=true ignora el cache y vuelve a consultar las fuentes ahora mismo
// (lo usa el botón "Actualizar búsqueda").
// ↑ Obtiene las ofertas rankeadas por región. force=true ignora la caché
async function getRanked(force = false) {
  const now = Date.now();
  // ↑ Si la caché es reciente y no pedimos refresco, devolvemos lo ya guardado
  if (!force && cache.data && now - cache.at < TTL) return cache.data;
  if (refreshing) return refreshing; // ya hay un refresh en curso, esperalo
  // ↑ Inicia el refresco como una promesa compartida (todos esperan el mismo)
  refreshing = (async () => {
    let jobs = [];
    // ↑ Consulta las bolsas en vivo; si todo falla, la lista queda vacía
    try {
      jobs = await fetchJobs();
    } catch {
      jobs = [];
    }
    // Ofertas relevadas a mano (bolsas propias: mail/portal/LinkedIn) siempre
    // se incluyen en la búsqueda, exclusivas de la región Argentina.
    jobs = [...jobs, ...CURATED_JOBS];
    // ↑ Ranking maestro: calcula el match y agrupa las ofertas por región
    let ranked = await expireOldJobs(rankByRegion(jobs));
    // ↑ ¿Hubo al menos una oferta real en alguna región?
    const hasAny = Object.values(ranked).some((l) => l.length > 0);
    let online = true;
    if (!hasAny) {
      // Respaldo demo: las ofertas demo ya vienen clasificadas por región,
      // así que se usan tal cual (no se re-asignan regiones).
      // ↑ Modo demo: sin ofertas en vivo, usamos los datos de respaldo
      ranked = Object.fromEntries(
        Object.entries(DEMO_JOBS).map(([region, list]) => [region, [...list].sort((a, b) => b.score - a.score)])
      );
      online = false;
    } else {
      // Solo se guarda en el historial cuando hay datos reales
      // (evita ensuciar el historial con ofertas demo).
      // ↑ Persiste las ofertas vistas SOLO si son datos reales (no demo)
      try {
        await recordSearch(ranked);
      } catch {
        // si falla el guardado en disco, no bloquea la búsqueda
      }
    }
    // ↑ Guarda el resultado fresco en la caché junto con su timestamp
    cache = { data: { regions: ranked, _online: online }, at: Date.now(), online };
    return cache.data;
  })();
  // ↑ Espera a que termine el refresco y libera la bandera aunque falle
  try {
    return await refreshing;
  } finally {
    refreshing = null;
  }
}

// Busca una oferta por id en todas las regiones
// ↑ Recorre las listas de todas las regiones hasta dar con el id pedido
function findById(data, id) {
  for (const list of Object.values(data.regions)) {
    const f = list.find((j) => j.id === id);
    if (f) return f;
  }
  return null;
}

// ↑ Crea el servidor HTTP: cada request que llega entra a esta función
const server = createServer(async (req, res) => {
  // ↑ Parsea la URL para leer el pathname y los parámetros (?region=, ?q=, etc.)
  const url = new URL(req.url, `http://${req.headers.host}`);

  // ---------- API ----------
  // ↑ Endpoint /api/profile: entrega el perfil de Ali para el panel del CV
  if (url.pathname === '/api/profile') {
    return sendJSON(res, 200, PROFILE);
  }
  // ↑ Endpoint /api/jobs: devuelve las ofertas rankeadas de la región elegida
  if (url.pathname === '/api/jobs') {
    // ↑ Lee la región del query (?region=...) y usa 'argentina' si no viene
    const region = (url.searchParams.get('region') || 'argentina');
    // ↑ Obtiene (o reutiliza de caché) la búsqueda completa
    const data = await getRanked();
    // ↑ Filtra las ofertas de la región pedida (o lista vacía si no hay)
    const jobs = data.regions[region] || [];
    return sendJSON(res, 200, { region, jobs, total: jobs.length, _online: data._online });
  }
  // ↑ Endpoint /api/job: detalle de UNA oferta + resumen de empresa/skills
  if (url.pathname === '/api/job') {
    // ↑ Lee el id de la oferta desde ?q=...
    const query = url.searchParams.get('q') || '';
    const data = await getRanked();
    const found = findById(data, query);
    // ↑ Si el id no existe entre las ofertas, respondemos 404
    if (!found) return sendJSON(res, 404, { error: 'not found' });
    // ↑ Devuelve la oferta completa más el resumen que usa la carta
    return sendJSON(res, 200, { job: found, summary: summarize(found) });
  }
  // ↑ Endpoint /api/cover-letter: genera la carta de presentación (es/en)
  if (url.pathname === '/api/cover-letter') {
    // ↑ Lee región e id de la oferta desde el query de la URL
    const region = url.searchParams.get('region') || 'argentina';
    const id = url.searchParams.get('id') || '';
    const data = await getRanked();
    const found = findById(data, id);
    // ↑ Si no encuentra la oferta, devuelve 404
    if (!found) return sendJSON(res, 404, { error: 'not found' });
    // ↑ Arma la carta completa (idioma + asunto + cuerpo) y la envía
    return sendJSON(res, 200, generateCoverLetter(found, region));
  }
  // ↑ Endpoint /api/refresh: fuerza una búsqueda nueva, ignorando la caché
  if (url.pathname === '/api/refresh' && req.method === 'POST') {
    // ↑ force=true obliga a volver a consultar las fuentes en este momento
    const data = await getRanked(true);
    return sendJSON(res, 200, { ok: true, _online: data._online, at: Date.now() });
  }
  if (url.pathname === '/api/linkedin-search' && req.method === 'POST') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      return sendJSON(res, 400, { error: 'Solicitud JSON inválida.' });
    }
    try {
      const data = await searchLinkedInWithApify(body.region || 'argentina');
      return sendJSON(res, 200, data);
    } catch (error) {
      return sendJSON(res, error.statusCode || 502, { error: error.message || 'Falló la búsqueda de LinkedIn.' });
    }
  }
  // ↑ Endpoint /api/history: devuelve las ofertas vistas de una región
  if (url.pathname === '/api/history') {
    // ↑ Lee la región del query y elige 'argentina' si no llega
    const region = url.searchParams.get('region') || 'argentina';
    try {
      const jobs = await getHistoryForRegion(region);
      return sendJSON(res, 200, { region, jobs });
    } catch {
      // ↑ Si algo falla, se responde una lista vacía en vez de romper la app
      return sendJSON(res, 200, { region, jobs: [] });
    }
  }

  // ↑ Endpoint /api/analytics: analítica de mercado para la "Propuesta de Interés"
  if (url.pathname === '/api/analytics') {
    const data = await getRanked();
    // ↑ Escanea todas las regiones y calcula demanda, brechas y recomendaciones
    return sendJSON(res, 200, buildAnalytics(data.regions));
  }
  // ↑ Endpoint /api/consultoras: lista las consultoras con su estado de contacto
  if (url.pathname === '/api/consultoras') {
    // ↑ Carga el estado guardado en disco para combinarlo con el directorio
    const status = await loadStatus();
    // ↑ Une el directorio con el estado guardado y ordena por nombre
    const list = CONSULTORAS.map((c) => ({
      ...c,
      estado: status[c.id]?.estado || 'Sin contactar',
      fecha: status[c.id]?.fecha || '',
      notas: status[c.id]?.notas || '',
    }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    return sendJSON(res, 200, { consultoras: list, estados: ESTADOS });
  }
  // ↑ Endpoint /api/consultoras/status: guarda el estado de contacto de una consultora
  if (url.pathname === '/api/consultoras/status' && req.method === 'POST') {
    try {
      // ↑ Lee el body JSON de la petición
      const body = await readBody(req);
      const { id, estado, fecha, notas } = body;
      // ↑ Valida que la consultora exista en el directorio antes de guardar
      if (!id || !CONSULTORAS.some((c) => c.id === id)) {
        return sendJSON(res, 400, { error: 'id de consultora inválido' });
      }
      // ↑ Persiste el nuevo estado en disco y devuelve lo guardado
      const saved = await setStatus(id, { estado, fecha, notas });
      return sendJSON(res, 200, { ok: true, id, ...saved });
    } catch (e) {
      // ↑ Cualquier error de validación se responde como solicitud inválida
      return sendJSON(res, 400, { error: e.message || 'solicitud inválida' });
    }
  }

  // ---------- Archivos estáticos ----------
  // ↑ Si no es una ruta de la API, servimos los archivos del frontend compilado
  let pathname = url.pathname;
  // ↑ La raíz del sitio carga el index.html de la app
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  // ↑ Convierte la URL en una ruta real dentro de frontend/dist
  const filePath = join(PUBLIC_DIR, pathname);
  // ↑ Extrae la extensión del archivo para elegir el Content-Type correcto
  const ext = extname(filePath);
  try {
    // ↑ Intenta leer el archivo desde el disco y enviarlo al navegador
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    // ↑ Si el archivo no existe, responde un 404 simple
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('404 - Not Found');
  }
});

// ↑ Pone el server a escuchar: la app queda disponible en http://localhost:3000
server.listen(PORT, () => {
  console.log(`🚀 Buscador de empleo corriendo en http://localhost:${PORT}`);
  console.log('   Perfil: QA Engineer - Ali Tovar');
});
