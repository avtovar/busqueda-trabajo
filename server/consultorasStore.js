// ============================================================================
// Tracker de contacto de consultoras: guarda qué estado tiene cada consultora
// (Sin contactar, Contactado, Respondió, Entrevista agendada, Descartada)
// junto con la fecha y las notas. Persiste todo en data/consultoras-status.json
// usando el mismo patrón de archivo JSON que history.js.
// ============================================================================

// ↑ Importa las funciones de archivos del módulo nativo de Node.
//   rename/copyFile son los que permiten guardar sin dejar nunca un JSON a medio escribir.
import { readFile, writeFile, mkdir, rename, copyFile, rm } from 'node:fs/promises';
// ↑ Une rutas de forma segura según el sistema operativo
import { join } from 'node:path';
// ↑ Convierte la URL de este módulo en una ruta de archivo válida
import { fileURLToPath } from 'node:url';

// ↑ Carpeta de este módulo, para construir rutas relativas desde ella
const __dirname = fileURLToPath(new URL('.', import.meta.url));
// ↑ Carpeta data/ (raíz del proyecto) donde se persistió todo antes.
//   Se puede pisar con CONSULTORAS_DATA_DIR para probar sin tocar los datos reales.
const DATA_DIR = process.env.CONSULTORAS_DATA_DIR || join(__dirname, '..', 'data');
// ↑ Ruta del archivo JSON que guarda el estado de todas las consultoras
const DATA_FILE = join(DATA_DIR, 'consultoras-status.json');
// ↑ Copia del ÚLTIMO guardado exitoso. Mismo criterio que en history.js: NO se arma
//   copiando DATA_FILE sino escribiéndola desde memoria (ver setStatus), así existe
//   desde la primera escritura y nunca puede quedar con la forma de un archivo roto
const BAK_FILE = join(DATA_DIR, 'consultoras-status.json.bak');
// ↑ Archivo transitorio: se escribe acá y después se renombra al nombre final
const TMP_FILE = join(DATA_DIR, 'consultoras-status.json.tmp');
// ↑ El .bak también se escribe atómicamente, con su propio .tmp contiguo al destino
const BAK_TMP_FILE = join(DATA_DIR, 'consultoras-status.json.bak.tmp');

// ↑ Estados posibles en orden lógico: de "no contacté" hasta "descartada"
export const ESTADOS = ['Sin contactar', 'Contactado', 'Respondió', 'Entrevista agendada', 'Descartada'];

// ↑ Crea la carpeta data/ si no existe (igual que en history.js)
async function ensureDir() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch {
    // ya existe
  }
}

// Mutex (igual que history.js): sin esto, dos guardados simultáneos hacen
// load → mutar → writeFile del archivo COMPLETO y el segundo pisa al primero.
// ↑ Serializa las operaciones para que solo una esté en curso a la vez
let queue = Promise.resolve();
function withLock(fn) {
  const run = queue.then(fn, fn); // espera a la anterior, haya terminó bien o mal
  queue = run.then(() => {}, () => {});
  return run;
}

// ↑ Lee el estado persistido de todas las consultoras desde el disco
export async function loadStatus() {
  let raw;
  try {
    raw = await readFile(DATA_FILE, 'utf-8');
  } catch (err) {
    // ENOENT: todavía nunca se guardó nada (primera vez) → objeto vacío, es normal
    if (err.code === 'ENOENT') return {};
    return recoverCorrupt(`no se pudo leer: ${err.message}`);
  }
  // ↑ El parseo va en su propio try para que ningún otro paso reingrese a recoverCorrupt
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // JSON a medio escribir (el proceso murió durante un writeFile) cae acá
    return recoverCorrupt('el contenido no es JSON válido');
  }
  // ↑ Valida la forma: si "parsea" pero no es un objeto plano, está corrupto
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  return recoverCorrupt('el JSON no tiene la forma { [id]: { estado, fecha, notas } }');
}

// La escritura atómica es la parte que comparten setStatus() y la recuperación de un
// archivo roto, así que vive una sola vez acá (mismo criterio que en history.js).
// ↑ Escribe `data` de forma atómica en `target` (por defecto DATA_FILE): .tmp + rename,
//   con el reintento de Windows. Se generalizó con `target`/`tmp` para poder escribir el
//   .bak con el MISMO mecanismo, sin depender de lo que hubiera en DATA_FILE.
//   NO toma el lock a propósito: setStatus() la llama con el lock ya tomado
//   y recoverCorrupt() se dispara desde loadStatus(), que se usa tanto con como sin
//   lock → tomarlo acá sería un deadlock esperando.
async function writeAtomic(data, target = DATA_FILE, tmp = TMP_FILE) {
  // ↑ Garantiza la carpeta antes de escribir
  await ensureDir();
  await writeFile(tmp, JSON.stringify(data), 'utf-8');
  try {
    // ↑ rename() es atómico dentro del mismo disco: nunca queda un archivo a medias
    await rename(tmp, target);
  } catch (err) {
    // ↑ En Windows rename() puede ser rechazado si el destino está tomado
    if (err.code !== 'EPERM' && err.code !== 'EACCES' && err.code !== 'EEXIST') throw err;
    await rm(target, { force: true });
    await rename(tmp, target);
  } finally {
    // ↑ Nunca queda un .tmp colgado
    await rm(tmp, { force: true });
  }
}

// Ante un archivo roto: primero se preserva como evidencia (nada se pisa), después
// se intenta volver desde el .bak. Antes devolvía {} en silencio y el siguiente
// guardado borraba todos los estados de contacto que el usuario había cargado.
// ↑ Preserva el archivo roto, avisa por consola y devuelve lo que se pueda recuperar
async function recoverCorrupt(reason) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const evidence = join(DATA_DIR, `consultoras-status-corrupto-${stamp}.json`);
  try {
    await copyFile(DATA_FILE, evidence);
    // ↑ El roto ya está a salvo, así que se borra del lugar. Antes el motivo era que el
    //   guardado siguiente lo copiara como .bak (pise de la versión buena); hoy eso ya
    //   no puede pasar porque el .bak se arma desde memoria (ver setStatus)
    await rm(DATA_FILE, { force: true });
  } catch {
    // sin evidencia posible: igual se avisa y se sigue con el .bak
  }
  // FOLLOW-UP (no hecho acá a propósito): los archivos consultoras-status-corrupto-<ts>.json
  //   se acumulan para siempre, y se crean uno por corrupción aunque la recuperación
  //   venga del .bak y no haya nada que perder. Rotarlos (los de más de N o de más de X
  //   días) es un cambio de comportamiento del disco que no hace falta para que el .bak
  //   sea confiable: va en su propio PR.
  console.error(`[consultoras] ${DATA_FILE} está corrupto (${reason}). Copia preservada en ${evidence}.`);
  // ↑ Primero se decide QUÉ se recuperó, y al final se escribe abajo
  let recovered = {};
  try {
    const backup = JSON.parse(await readFile(BAK_FILE, 'utf-8'));
    if (backup && typeof backup === 'object' && !Array.isArray(backup)) {
      console.error(`[consultoras] Estado recuperado desde ${BAK_FILE}.`);
      recovered = backup;
    }
  } catch {
    // tampoco hay copia buena: se empieza de cero, con la evidencia ya guardada
  }
  // ↑ Lo recuperado se ESCRIBE DE VUELTA en el archivo final, no se devuelve solo en
  //   memoria. Motivo (mismo que en history.js): loadStatus() es público y lo llama
  //   GET /api/consultoras SIN guardar nunca, así que el DATA_FILE que esta función
  //   acaba de borrar se quedaba borrado y la lectura siguiente devolvía {} en
  //   silencio, perdiendo todos los estados de contacto. Y no se copia DATA_FILE →
  //   .bak: ya no hace falta acordarse, porque el .bak se escribe DESDE MEMORIA en
  //   setStatus() (abajo) y ni un archivo roto ni uno con forma rara pueden pisarlo.
  await writeAtomic(recovered);
  return recovered;
}

// ↑ Actualiza y guarda el estado de UNA consultora en el archivo
export async function setStatus(id, { estado, fecha, notas }) {
  // ↑ Valida que el estado enviado esté dentro de la lista permitida
  if (estado && !ESTADOS.includes(estado)) {
    throw new Error('estado inválido');
  }
  // ↑ Todo el ciclo leer→mutar→guardar va bajo el lock (si no, dos guardados
  //   simultáneos se pisan y se pierde el estado de una consultora)
  return withLock(async () => {
    // ↑ Carga el estado actual de todas las consultoras
    const all = await loadStatus();
    // ↑ Toma lo previo de esta consultora (o un objeto vacío si no existe)
    const prev = all[id] || {};
    // ↑ Conserva lo anterior si un campo no viene; updatedAt siempre se renueva
    all[id] = {
      estado: estado ?? prev.estado ?? 'Sin contactar',
      fecha: fecha ?? prev.fecha ?? '',
      notas: notas ?? prev.notas ?? '',
      updatedAt: Date.now(),
    };
    // ↑ Primero el destino final y después el .bak, los dos atómicamente (writeAtomic),
    //   los dos desde el MISMO objeto `all` que está en memoria:
    //   - el .bak desde memoria y no con copyFile(DATA_FILE) para que exista desde la
    //     primera escritura (si no, no había archivo anterior que copiar y el
    //     recoverCorrupt() posterior no tenía de dónde volver) y para que no pueda
    //     quedar con la forma de un archivo roto
    //   - el orden destino→.bak para que, si el proceso muere en el medio, el archivo
    //     final ya sea el contenido nuevo válido y el .bak el anterior: los dos buenos
    await writeAtomic(all);
    // ↑ El .bak queda igual al último guardado exitoso: no se pierde nada por no
    //   guardar la versión previa, porque DATA_FILE nunca queda a medias
    await writeAtomic(all, BAK_FILE, BAK_TMP_FILE);
    return all[id];
  });
}
