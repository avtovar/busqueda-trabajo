// Historial persistente de búsquedas: guarda cada oferta vista en disco
// (data/history.json) para poder mostrar "últimos 30 días" aunque el server
// se reinicie. No usa base de datos, es un archivo JSON simple.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DATA_FILE = join(DATA_DIR, 'history.json');
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

async function ensureDir() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch {
    // ya existe
  }
}

function keyOf(job) {
  return `${job.title}::${job.company}`.toLowerCase().replace(/[^a-z0-9:]+/g, ' ').trim();
}

async function load() {
  try {
    const raw = await readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { lastRun: 0, entries: {} };
  }
}

async function save(history) {
  await ensureDir();
  await writeFile(DATA_FILE, JSON.stringify(history), 'utf-8');
}

// Registra las ofertas de la búsqueda actual (por región) en el historial.
// - Si una oferta ya existía, actualiza lastSeen (sigue activa) y conserva firstSeen.
// - Si es nueva, la agrega con firstSeen = ahora.
// - Purga entradas con más de 30 días sin aparecer en ninguna búsqueda.
export async function recordSearch(rankedByRegion) {
  const history = await load();
  const now = Date.now();

  for (const [region, jobs] of Object.entries(rankedByRegion)) {
    for (const job of jobs) {
      const key = keyOf(job);
      const existing = history.entries[key];
      history.entries[key] = {
        job,
        region,
        firstSeen: existing ? existing.firstSeen : now,
        lastSeen: now,
      };
    }
  }

  const cutoff = now - RETENTION_MS;
  for (const [key, entry] of Object.entries(history.entries)) {
    if (entry.lastSeen < cutoff) delete history.entries[key];
  }

  history.lastRun = now;
  await save(history);
  return history;
}

// Devuelve las ofertas de los últimos 30 días para una región, marcando
// cuáles siguen "activas" (aparecieron en la última búsqueda) y cuáles no.
export async function getHistoryForRegion(region) {
  const history = await load();
  const cutoff = Date.now() - RETENTION_MS;
  return Object.values(history.entries)
    .filter((e) => e.region === region && e.lastSeen >= cutoff)
    .map((e) => ({
      ...e.job,
      active: e.lastSeen === history.lastRun,
      firstSeen: e.firstSeen,
      lastSeen: e.lastSeen,
    }))
    .sort((a, b) => b.lastSeen - a.lastSeen || b.firstSeen - a.firstSeen);
}
