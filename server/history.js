// ============================================================================
// Historial persistente de búsquedas: guarda cada oferta vista en disco
// (data/history.json) para poder mostrarlo aunque el server se reinicie.
// No usa base de datos, es un archivo JSON simple.
// ============================================================================

// ↑ Importa las funciones de archivos del módulo nativo (leer, escribir, crear carpeta)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
// ↑ Une rutas de manera segura según el sistema operativo
import { join } from 'node:path';
// ↑ Convierte la URL de este módulo en una ruta de archivo válida
import { fileURLToPath } from 'node:url';

// ↑ Carpeta de este módulo, para construir rutas relativas desde ella
const __dirname = fileURLToPath(new URL('.', import.meta.url));
// ↑ Carpeta data/ (raíz del proyecto) donde viven los archivos de runtime
const DATA_DIR = join(__dirname, '..', 'data');
// ↑ Ruta completa del archivo JSON del historial
const DATA_FILE = join(DATA_DIR, 'history.json');
const RETENTION_MONTHS = 6;

function retentionCutoff(now = Date.now()) {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  return cutoff.getTime();
}

function publicationTime(job) {
  const raw = job?.date ?? job?.postedAtTimestamp ?? job?.postedAt;
  if (raw === undefined || raw === null || raw === '') return null;
  const numeric = Number(raw);
  const timestamp = /^\d{10,13}$/.test(String(raw))
    ? (numeric < 1e12 ? numeric * 1000 : numeric)
    : new Date(raw).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function effectiveStart(job, firstSeen, now) {
  return publicationTime(job) ?? firstSeen ?? now;
}

// ↑ Crea la carpeta data/ si no existe (recursive evita errores si ya está)
async function ensureDir() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch {
    // ya existe
  }
}

// ↑ Llave única por oferta: "título::empresa" normalizada (misma idea que dedupeKey)
function keyOf(job) {
  return `${job.title}::${job.company}`.toLowerCase().replace(/[^a-z0-9:]+/g, ' ').trim();
}

// ↑ Lee el historial completo desde el disco; si no existe, arranca vacío
async function load() {
  try {
    const raw = await readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    // ↑ Primera vez (o archivo roto): devuelve la estructura inicial
    return { lastRun: 0, entries: {} };
  }
}

// ↑ Escribe el historial completo en disco (sobrescribe el archivo anterior)
async function save(history) {
  // ↑ Garantiza la carpeta antes de escribir el JSON
  await ensureDir();
  await writeFile(DATA_FILE, JSON.stringify(history), 'utf-8');
}

// Registra las ofertas de la búsqueda actual (por región) en el historial.
// - Si una oferta ya existía, actualiza lastSeen (sigue activa) y conserva firstSeen.
// - Si es nueva, la agrega con firstSeen = ahora.
// - Purga entradas con lastSeen anterior al 1 de enero de 2026.
// ↑ Registra todas las ofertas de la búsqueda actual (agrupadas por región)
export async function recordSearch(rankedByRegion) {
  // ↑ Carga lo ya guardado y toma la hora actual como "visto ahora"
  const history = await load();
  const now = Date.now();

  // ↑ Recorre cada región y cada oferta para actualizar el historial
  for (const [region, jobs] of Object.entries(rankedByRegion)) {
    for (const job of jobs) {
      const key = keyOf(job);
      // ↑ ¿Ya habíamos visto esta oferta? (para conservar su firstSeen)
      const existing = history.entries[key];
      // ↑ Si existía, mantiene el primer día visto; si es nueva, usa "ahora"
      history.entries[key] = {
        job,
        region,
        firstSeen: existing ? existing.firstSeen : now,
        lastSeen: now,
      };
    }
  }

  const cutoff = retentionCutoff(now);
  // Purga ofertas publicadas o vistas por primera vez hace más de seis meses.
  for (const [key, entry] of Object.entries(history.entries)) {
    if (effectiveStart(entry.job, entry.firstSeen, now) < cutoff) delete history.entries[key];
  }

  // ↑ Marca la hora de esta corrida: sirve para saber qué quedó "activo"
  history.lastRun = now;
  await save(history);
  return history;
}

export async function expireOldJobs(rankedByRegion) {
  const history = await load();
  const now = Date.now();
  const cutoff = retentionCutoff(now);
  let changed = false;
  const filtered = {};

  for (const [region, jobs] of Object.entries(rankedByRegion)) {
    filtered[region] = jobs.filter((job) => {
      const key = keyOf(job);
      const entry = history.entries[key];
      const keep = effectiveStart(job, entry?.firstSeen, now) >= cutoff;
      if (!keep && entry) {
        delete history.entries[key];
        changed = true;
      }
      return keep;
    });
  }

  for (const [key, entry] of Object.entries(history.entries)) {
    if (effectiveStart(entry.job, entry.firstSeen, now) < cutoff) {
      delete history.entries[key];
      changed = true;
    }
  }

  if (changed) await save(history);
  return filtered;
}

// Devuelve las ofertas registradas desde el 1 de enero de 2026 para una región,
// marcando cuáles siguen "activas" (aparecieron en la última búsqueda) y cuáles no.
// ↑ Devuelve las ofertas vistas de una región, marcando cuáles siguen activas
export async function getHistoryForRegion(region) {
  const history = await load();
  const cutoff = retentionCutoff();
  let changed = false;
  for (const [key, entry] of Object.entries(history.entries)) {
    if (effectiveStart(entry.job, entry.firstSeen, Date.now()) < cutoff) {
      delete history.entries[key];
      changed = true;
    }
  }
  if (changed) await save(history);
  // ↑ Filtra por región y dentro de la ventana de tiempo permitida
  return Object.values(history.entries)
    .filter((e) => e.region === region && effectiveStart(e.job, e.firstSeen, Date.now()) >= cutoff)
    .map((e) => ({
      ...e.job,
      // ↑ "Activa" = apareció en la ÚLTIMA búsqueda (lastSeen == lastRun)
      active: e.lastSeen === history.lastRun,
      firstSeen: e.firstSeen,
      lastSeen: e.lastSeen,
    }))
    // ↑ Ordena por lastSeen y empata con firstSeen (más recientes primero)
    .sort((a, b) => b.lastSeen - a.lastSeen || b.firstSeen - a.firstSeen);
}
