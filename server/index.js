import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROFILE } from './cvProfile.js';
import { fetchJobs } from './jobSources.js';
import { rankByRegion } from './matcher.js';
import { generateCoverLetter, summarize } from './coverLetter.js';
import { DEMO_JOBS } from './demoData.js';
import { recordSearch, getHistoryForRegion } from './history.js';
import { CONSULTORAS } from './consultoras.js';
import { loadStatus, setStatus, ESTADOS } from './consultorasStore.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;

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

function sendJSON(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy(); // límite de seguridad, 1MB
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

// Cache de la última búsqueda (30 min)
let cache = { data: null, at: 0, online: false };
const TTL = 30 * 60 * 1000;
let refreshing = null; // evita refrescos simultáneos si se clickea 2 veces

// Devuelve { regions, _online } con datos DEMO como respaldo cuando las fuentes
// en vivo están bloqueadas o no devuelven ofertas. Así la app funciona siempre.
// force=true ignora el cache y vuelve a consultar las fuentes ahora mismo
// (lo usa el botón "Actualizar búsqueda").
async function getRanked(force = false) {
  const now = Date.now();
  if (!force && cache.data && now - cache.at < TTL) return cache.data;
  if (refreshing) return refreshing; // ya hay un refresh en curso, esperalo
  refreshing = (async () => {
    let jobs = [];
    try {
      jobs = await fetchJobs();
    } catch {
      jobs = [];
    }
    let ranked = rankByRegion(jobs);
    const hasAny = Object.values(ranked).some((l) => l.length > 0);
    let online = true;
    if (!hasAny) {
      // Respaldo demo: las ofertas demo ya vienen clasificadas por región,
      // así que se usan tal cual (no se re-asignan regiones).
      ranked = Object.fromEntries(
        Object.entries(DEMO_JOBS).map(([region, list]) => [region, [...list].sort((a, b) => b.score - a.score)])
      );
      online = false;
    } else {
      // Solo se guarda en el historial de 30 días cuando hay datos reales
      // (evita ensuciar el historial con ofertas demo).
      try {
        await recordSearch(ranked);
      } catch {
        // si falla el guardado en disco, no bloquea la búsqueda
      }
    }
    cache = { data: { regions: ranked, _online: online }, at: Date.now(), online };
    return cache.data;
  })();
  try {
    return await refreshing;
  } finally {
    refreshing = null;
  }
}

// Busca una oferta por id en todas las regiones
function findById(data, id) {
  for (const list of Object.values(data.regions)) {
    const f = list.find((j) => j.id === id);
    if (f) return f;
  }
  return null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // ---------- API ----------
  if (url.pathname === '/api/profile') {
    return sendJSON(res, 200, PROFILE);
  }
  if (url.pathname === '/api/jobs') {
    const region = (url.searchParams.get('region') || 'argentina');
    const data = await getRanked();
    return sendJSON(res, 200, { region, jobs: data.regions[region] || [], _online: data._online });
  }
  if (url.pathname === '/api/job') {
    const query = url.searchParams.get('q') || '';
    const data = await getRanked();
    const found = findById(data, query);
    if (!found) return sendJSON(res, 404, { error: 'not found' });
    return sendJSON(res, 200, { job: found, summary: summarize(found) });
  }
  if (url.pathname === '/api/cover-letter') {
    const region = url.searchParams.get('region') || 'argentina';
    const id = url.searchParams.get('id') || '';
    const data = await getRanked();
    const found = findById(data, id);
    if (!found) return sendJSON(res, 404, { error: 'not found' });
    return sendJSON(res, 200, generateCoverLetter(found, region));
  }
  if (url.pathname === '/api/refresh' && req.method === 'POST') {
    const data = await getRanked(true);
    return sendJSON(res, 200, { ok: true, _online: data._online, at: Date.now() });
  }
  if (url.pathname === '/api/history') {
    const region = url.searchParams.get('region') || 'argentina';
    try {
      const jobs = await getHistoryForRegion(region);
      return sendJSON(res, 200, { region, jobs });
    } catch {
      return sendJSON(res, 200, { region, jobs: [] });
    }
  }

  if (url.pathname === '/api/consultoras') {
    const status = await loadStatus();
    const list = CONSULTORAS.map((c) => ({
      ...c,
      estado: status[c.id]?.estado || 'Sin contactar',
      fecha: status[c.id]?.fecha || '',
      notas: status[c.id]?.notas || '',
    }));
    return sendJSON(res, 200, { consultoras: list, estados: ESTADOS });
  }
  if (url.pathname === '/api/consultoras/status' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { id, estado, fecha, notas } = body;
      if (!id || !CONSULTORAS.some((c) => c.id === id)) {
        return sendJSON(res, 400, { error: 'id de consultora inválido' });
      }
      const saved = await setStatus(id, { estado, fecha, notas });
      return sendJSON(res, 200, { ok: true, id, ...saved });
    } catch (e) {
      return sendJSON(res, 400, { error: e.message || 'solicitud inválida' });
    }
  }

  // ---------- Archivos estáticos ----------
  let pathname = url.pathname;
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  const filePath = join(PUBLIC_DIR, pathname);
  const ext = extname(filePath);
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('404 - Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Buscador de empleo corriendo en http://localhost:${PORT}`);
  console.log('   Perfil: QA Engineer - Ali Tovar');
});
