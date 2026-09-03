// Guarda el estado de contacto de cada consultora (Sin contactar, Contactado,
// Respondió, Entrevista agendada, Descartada) en disco, para que no se
// pierda al reiniciar el server. Mismo patrón que history.js.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DATA_FILE = join(DATA_DIR, 'consultoras-status.json');

export const ESTADOS = ['Sin contactar', 'Contactado', 'Respondió', 'Entrevista agendada', 'Descartada'];

async function ensureDir() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch {
    // ya existe
  }
}

export async function loadStatus() {
  try {
    const raw = await readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {}; // { [consultoraId]: { estado, fecha, notas, updatedAt } }
  }
}

export async function setStatus(id, { estado, fecha, notas }) {
  if (estado && !ESTADOS.includes(estado)) {
    throw new Error('estado inválido');
  }
  const all = await loadStatus();
  const prev = all[id] || {};
  all[id] = {
    estado: estado ?? prev.estado ?? 'Sin contactar',
    fecha: fecha ?? prev.fecha ?? '',
    notas: notas ?? prev.notas ?? '',
    updatedAt: Date.now(),
  };
  await ensureDir();
  await writeFile(DATA_FILE, JSON.stringify(all), 'utf-8');
  return all[id];
}
