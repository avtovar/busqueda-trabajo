import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROFILE } from './cvProfile.js';
import { fetchJobs } from './jobSources.js';
import { rankByRegion } from './matcher.js';
import { generateCoverLetter, summarize } from './coverLetter.js';
import { DEMO_JOBS } from './demoData.js';

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

// Cache de la última búsqueda (30 min)
let cache = { data: null, at: 0, online: false };
const TTL = 30 * 60 * 1000;

// Devuelve { regions, _online } con datos DEMO como respaldo cuando las fuentes
// en vivo están bloqueadas o no devuelven ofertas. Así la app funciona siempre.
async function getRanked() {
  const now = Date.now();
  if (cache.data && now - cache.at < TTL) return cache.data;
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
  }
  cache = { data: { regions: ranked, _online: online }, at: now, online };
  return cache.data;
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
