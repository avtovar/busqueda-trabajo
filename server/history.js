// ============================================================================
// Historial persistente de búsquedas: guarda cada oferta vista en disco
// (data/history.json) para poder mostrarlo aunque el server se reinicie.
// No usa base de datos, es un archivo JSON simple.
// ============================================================================

// ↑ Importa las funciones de archivos del módulo nativo (leer, escribir, renombrar,
//   copiar, borrar, crear carpeta). rename+copy son los que hacen posible guardar sin
//   dejar nunca un JSON a medio escribir.
import { readFile, writeFile, mkdir, rename, copyFile, rm } from 'node:fs/promises';
// ↑ Une rutas de manera segura según el sistema operativo
import { join } from 'node:path';
// ↑ Convierte la URL de este módulo en una ruta de archivo válida
import { fileURLToPath } from 'node:url';

// ↑ Carpeta de este módulo, para construir rutas relativas desde ella
const __dirname = fileURLToPath(new URL('.', import.meta.url));
// ↑ Carpeta data/ (raíz del proyecto) donde viven los archivos de runtime.
//   Se puede pisar con HISTORY_DATA_DIR para probar sin tocar los datos reales.
const DATA_DIR = process.env.HISTORY_DATA_DIR || join(__dirname, '..', 'data');
// ↑ Ruta completa del archivo JSON del historial
const DATA_FILE = join(DATA_DIR, 'history.json');
// ↑ Copia del ÚLTIMO guardado exitoso. OJO: no se arma copiando DATA_FILE, sino
//   escribiéndola desde memoria (ver save()). Esa es la diferencia entre "red de
//   seguridad que existe siempre" y "red que a veces no existe": antes el .bak se
//   armaba con copyFile(DATA_FILE) ANTES de guardar, y en la primera escritura de la
//   vida del archivo DATA_FILE todavía no existía, el copyFile fallaba en silencio y
//   no quedaba .bak. Si el archivo se rompía después, recoverCorrupt() no tenía red y
//   devolvía un historial VACÍO: 200 ofertas perdidas.
const BAK_FILE = join(DATA_DIR, 'history.json.bak');
// ↑ Archivo transitorio: se escribe acá primero y después se renombra a DATA_FILE
const TMP_FILE = join(DATA_DIR, 'history.json.tmp');
// ↑ El .bak se escribe atómicamente también, con su propio .tmp contiguo al destino
const BAK_TMP_FILE = join(DATA_DIR, 'history.json.bak.tmp');
// ↑ Cuánto tiempo se conserva una oferta en el historial: 6 meses
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

// Normaliza una clave: minúsculas y solo [a-z0-9:], cualquier otra cosa pasa a
// ser un espacio. Es lo que hace comparables "QA Engineer :: Acme" y
// "qa-engineer::acme". Se extrajo de keyOf() para que la clave NUEVA y la clave
// VIEJA (que se sigue soportando) se normalicen exactamente con la misma regla.
// ↑ Normalizador de claves, compartido por keyOf() y legacyKeyOf()
function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9:]+/g, ' ').trim();
}

// ↑ "Apellido" de la oferta para la clave: sale del id, y si no hay id del link.
//   Se limpian el protocolo y todo lo que va después del ? o del # porque esos
//   partes cambian entre publicaciones de la misma oferta (utm_source, etc.) y
//   justamente por eso dos urls de la MISMA oferta tienen que dar la MISMA clave.
function linkSlug(job) {
  const raw = job?.id || job?.applyUrl || '';
  return String(raw)
    .replace(/^[a-z]+:\/\//i, '')
    .replace(/[?#].*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ↑ Llave única por oferta: "título::empresa::<slug del id o del link>".
//   ANTES era solo "título::empresa", y eso era un bug de pérdida de datos: dos
//   ofertas DISTINTAS del mismo puesto en la misma empresa (dos vacancies del
//   mismo cargo, o la misma vacante publicada en dos ciudades) se pisaban entre
//   sí. La segunda reescribía `entry.job` entero y de la primera solo sobrevivían
//   `firstSeen` y la unión de regiones: una oferta desaparecía del historial sin
//   dejar rastro. Con 200 ofertas de LinkedIn por corrida eso pasaba todo el rato.
//   Agregar el link al final de la clave separa las dos sin romper nada.
function keyOf(job) {
  const base = `${job.title}::${job.company}`;
  const slug = linkSlug(job);
  // ↓ Si la oferta no tiene ni id ni link (no debería pasar, pero no se depende de eso),
  //   se degrada a la clave de siempre, que es la que leen las entradas viejas.
  return normalizeKey(slug ? `${base}::${slug}` : base);
}

// ↑ La clave QUE SE USABA ANTES ("título::empresa" sin el link). No se borra
//   del código: se necesita para migrar en caliente las 229 entradas que ya
//   están en data/history.json con el formato viejo (ver recordSearch).
//   Leer no se rompe: getHistoryForRegion() y las purgas ITERAN sobre
//   Object.values/Object.entries de history.entries, nunca buscan por clave, así
//   que las entradas viejas se siguen mostrando exactamente igual.
function legacyKeyOf(job) {
  return normalizeKey(`${job.title}::${job.company}`);
}

// Una oferta puede caer en más de una región en la misma corrida (el matcher la
// clasifica en una sola, pero la misma oferta puede aparecer en listas distintas),
// y antes de corregir eso cada entrada guardaba UN solo `region` como texto: la
// segunda región pisaba a la primera y la oferta desaparecía de un historial.
// Ahora cada entrada guarda `regions: string[]` y al escribir se UNEN, nunca se pisan.
// ↑ Lee las regiones de una entrada aceptando el esquema viejo (`region` string) y
//   el nuevo (`regions` array), para que data/history.json siga siendo compatible
function regionsOf(entry) {
  if (Array.isArray(entry?.regions)) return entry.regions;
  if (typeof entry?.region === 'string') return [entry.region]; // migración del esquema viejo
  return [];
}

// Mutex: cadena de promesas donde cada operación espera a que termine la anterior.
// Sin esto, dos llamadas concurrentes (un refresh + un GET /api/history, por ejemplo)
// hacen load → mutar → save del archivo COMPLETO: la segunda escribe sobre el estado
// que la primera todavía no había guardado y una de las dos se pierde.
// ↑ Envuelve una operación para que sea la única en curso sobre el archivo
let queue = Promise.resolve();
function withLock(fn) {
  // ↑ Se encola detrás de lo que ya estaba corriendo (también si aquello falló, por
  //   eso el doble handler: así una promesa rechazada no envenena la cola)
  const run = queue.then(fn, fn);
  // ↓ La cola solo guarda el "settlement" (éxito o error) para seguir avanzando
  queue = run.then(() => {}, () => {});
  return run;
}

// ↑ Estructura vacía válida del historial (la primera vez y el peor caso)
function emptyHistory() {
  return { lastRun: 0, entries: {} };
}

// ↑ Valida que lo parseado tenga la forma esperada: { lastRun, entries: {…} }.
//   Si un JSON "parsea" pero no es un historial (por ejemplo otro objeto), hay que
//   tratarlo como roto igual que un JSON inválido.
function hasValidShape(data) {
  return !!data && typeof data === 'object' && !Array.isArray(data)
    && !!data.entries && typeof data.entries === 'object' && !Array.isArray(data.entries);
}

// La escritura atómica es la parte que comparten save() y la recuperación de un
// archivo roto, así que vive una sola vez acá. Escribe en un .tmp contiguo y después
// renombra al nombre final, porque writeFile() vacía el destino antes de escribir y
// un proceso muerto (Ctrl+C, reinicio) dejaba un history.json truncado que, con la
// carga permisiva anterior, se convertía en pérdida total del historial.
// ↑ Escribe `data` de forma atómica en `target` (por defecto DATA_FILE): .tmp + rename,
//   con el reintento de Windows. Se generalizó con `target`/`tmp` para poder escribir el
//   .bak con el MISMO mecanismo: si el .bak se armara con copyFile() quedaría un
//   archivo entero o nada, y además dependería de lo que hubiera en DATA_FILE.
//   NO toma el lock a propósito: la llaman cosas que ya lo tienen tomado
//   (save, setStatus) y recoverCorrupt(), que se dispara desde dentro de load().
async function writeAtomic(data, target = DATA_FILE, tmp = TMP_FILE) {
  // ↑ Garantiza la carpeta antes de escribir el JSON
  await ensureDir();
  // ↑ Se escribe primero en el .tmp contiguo al destino
  await writeFile(tmp, JSON.stringify(data), 'utf-8');
  try {
    // ↑ rename() es atómico dentro del mismo disco: el contenido pasa de .tmp al
    //   nombre final de un solo golpe, nunca queda un history.json a medio escribir
    await rename(tmp, target);
  } catch (err) {
    // ↑ En Windows rename() puede ser rechazado (EPERM/EACCES/EEXIST) si el destino
    //   está tomado: se borra el destino y se reintenta
    if (err.code !== 'EPERM' && err.code !== 'EACCES' && err.code !== 'EEXIST') throw err;
    await rm(target, { force: true });
    await rename(tmp, target);
  } finally {
    // ↑ Nunca queda un .tmp colgado: si el rename funcionó ya no existe, y si falló
    //   se limpia para no ensuciar data/
    await rm(tmp, { force: true });
  }
}

// Recuperación ante un historial roto. Primero se preserva el archivo culpable como
// evidencia (data/history-corrupto-<timestamp>.json) para no perder nada, después se
// intenta volver desde el .bak y solo si tampoco hay copia buena se arranca de cero.
// Antes esto devolvía { entries: {} } en silencio y el siguiente save() pisaba las
// 200+ ofertas del usuario sin dejar rastro.
// ↑ Preserva el archivo roto, avisa por consola y devuelve lo que se pueda recuperar
async function recoverCorrupt(reason) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const evidence = join(DATA_DIR, `history-corrupto-${stamp}.json`);
  try {
    await copyFile(DATA_FILE, evidence);
    // ↑ El archivo roto ya está a salvo, así que se borra del lugar. Antes el motivo
    //   era que el save() siguiente lo copiara como .bak (pise de la versión buena);
    //   hoy eso ya no puede pasar porque save() arma el .bak desde memoria (ver save()).
    //   Borrarlo mantiene data/ limpio y deja que la escritura de abajo sea limpia
    await rm(DATA_FILE, { force: true });
  } catch {
    // sin evidencia posible (permisos, etc.): igual se avisa y se sigue con el .bak
  }
  // FOLLOW-UP (no hecho acá a propósito): los archivos history-corrupto-<ts>.json se
  //   acumulan para siempre, y encima se crean uno por corrupción aunque la recuperación
  //   venga del .bak y no haya nada que perder. Lo razonable sería rotarlos (borrar los
  //   de más de N o de más de X días), pero es un cambio de comportamiento del disco
  //   que no hace falta para que el .bak sea confiable, así que va en su propio PR.
  console.error(`[history] ${DATA_FILE} está corrupto (${reason}). Copia preservada en ${evidence}.`);
  // ↑ Primero se decide QUÉ se recuperó, y al final se escribe abajo
  let recovered = emptyHistory();
  // ↓ readBak() es el mismo helper que usa load() en el ENOENT: una sola definición
  //   de "qué es un .bak válido" para los dos caminos de recuperación.
  const backup = await readBak();
  if (backup) {
    console.error(`[history] Historial recuperado desde ${BAK_FILE} (${countEntries(backup)} ofertas).`);
    recovered = backup;
  }
  // ↓ (...si tampoco hay copia buena, `recovered` sigue siendo el historial vacío,
  //   con la evidencia ya guardada y el aviso por consola ya hecho arriba.)
  // ↑ Lo recuperado se ESCRIBE DE VUELTA en el archivo final, no se devuelve solo en
  //   memoria. Motivo: load() tiene callers que nunca guardan. getHistoryForRegion() y
  //   expireOldJobs() solo hacen save() si purgaron algo vencido ("changed"), y en el
  //   caso normal no purgan nada, así que el DATA_FILE que este función acaba de borrar
  //   se quedaba borrado. La petición siguiente caía en ENOENT → historial vacío en
  //   silencio: la corrupción de UN evento terminaba, un request después, en la pérdida
  //   total que veníamos arreglando. O sea, el fix de BUG-1 quedaba incompleto.
  //   Ojo con el .bak: acá NO se copia DATA_FILE → BAK_FILE, y ya no hace falta ni
  //   acordarse dearlo intacto. El .bak se escribe DESDE MEMORIA en cada save()
  //   (ver abajo), así que ni un archivo roto ni uno con forma rara pueden pisarlo:
  //   el "pisar el .bak" era cosa del viejo copyFile(DATA_FILE, BAK_FILE) de save().
  await writeAtomic(recovered);
  // ↓ La marca de agua sube con lo recuperado: el .bak que hay en disco contiene
  //   exactamente esto, así que ningún save() posterior puede empeorarlo.
  return rememberLoaded(recovered);
}

// Lee el historial completo del disco, distinguiendo cuatro casos que antes eran
// todos el mismo: no existe todavía, no existe pero SÍ hay .bak, no parsea, o
// parsea con otra forma.
// ↑ Intenta leer el .bak. Se usa tanto por load() en el ENOENT como por
//   recoverCorrupt(), así que la forma de decidir si es válido está en un solo
//   lugar. Devuelve null si no hay archivo, no parsea o no tiene la forma esperada.
async function readBak() {
  try {
    const backup = JSON.parse(await readFile(BAK_FILE, 'utf-8'));
    return hasValidShape(backup) ? backup : null;
  } catch {
    // sin archivo, ilegible o con otra forma: no hay nada que recuperar
    return null;
  }
}

// ↑ ¿Cuántas entradas tiene un historial? Lo usa el guard del .bak (ver save())
//   y el aviso de recuperación. Object.keys sobre un objeto vacío da 0, nunca falla.
function countEntries(history) {
  return Object.keys(history?.entries || {}).length;
}

// ↑ "Marca de agua" del .bak: la mayor cantidad de entradas que se ha visto en un
//   historial BUENO. Es lo que impide que un estado peor pise la red de seguridad.
let bakWatermark = 0;

// ↑ Registra un historial recién cargado y actualiza la marca de agua del .bak.
//   Si vino de un archivo con forma válida, sus entradas son un estado confiable.
function rememberLoaded(history) {
  bakWatermark = Math.max(bakWatermark, countEntries(history));
  return history;
}

// ↑ Carga el historial desde disco. Ahora el ENOENT también intenta el .bak:
//   antes devolvía vacío y el siguiente save() recortaba los dos archivos a cero.
async function load() {
  let raw;
  try {
    raw = await readFile(DATA_FILE, 'utf-8');
  } catch (err) {
    // ENOENT: el archivo no está. Hay dos situaciones MUY distintas detrás:
    //   (a) todavía nunca se guardó nada (primera vez) → vacío, es lo normal;
    //   (b) se borró, se movió o se perdió → y en ese caso el .bak es justamente
    //       la red que existe para esto. Antes los dos casos caían en el mismo
    //       `return emptyHistory()` y (b) terminaba con los DOS archivos vacíos:
    //       el siguiente save() escribía {} en DATA_FILE y en el .bak, y las 200+
    //       ofertas del usuario se perdían de forma permanente y silenciosa.
    if (err.code === 'ENOENT') {
      const fromBak = await readBak();
      if (fromBak) {
        // ↑ Aviso por consola: recuperar en silencio deja la impresión de que el
        //   historial estaba vacío, que es lo contrario de lo que pasó.
        console.error(`[history] ${DATA_FILE} no existe. Historial recuperado desde ${BAK_FILE} (${countEntries(fromBak)} ofertas).`);
        return rememberLoaded(fromBak);
      }
      // ↓ No hay .bak: sí es la primera vez de verdad, historial vacío.
      return rememberLoaded(emptyHistory());
    }
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
  if (hasValidShape(parsed)) return rememberLoaded(parsed);
  return recoverCorrupt('el JSON no tiene la forma { lastRun, entries: {…} }');
}

// Escribe el historial completo: primero el destino final y después el .bak, los dos
// atómicamente y los dos desde el MISMO objeto `history` que está en memoria.
// - El .bak se arma desde memoria, nunca con copyFile(DATA_FILE): así (a) existe desde
//   la primera escritura, porque no depende de que haya un archivo anterior que copiar,
//   y (b) no puede quedar con la forma de un archivo roto, porque lo que se serializa
//   acabamos de construir nosotros y ya pasó por hasValidShape().
// - El orden importa: si el proceso se muere entre las dos escrituras, DATA_FILE ya es
//   el contenido nuevo (válido) y el .bak es el anterior (también válido). Al revés
//   habría una ventana sin DATA_FILE bueno y sin .bak bueno.
// - El .bak queda igual al último guardado exitoso, no al anterior a él: no se pierde
//   nada por no guardar la versión previa, porque DATA_FILE nunca queda a medias.
// - GUARD DEL .BAK: si este guardado tiene MENOS entradas que el mejor historial que
//   ya se vio, el .bak NO se escribe. Antes se escribía siempre, y como los dos
//   archivos se armaban desde el mismo objeto en memoria, un estado degradado
//   (por ejemplo una carga que vino vacía) dejaba los DOS archivos truncados: no
//   quedaba red de seguridad en ningún lado. Con el guard, el .bak conserva el mejor
//   estado conocido y es la red real.
// ↑ Guarda el historial de forma atómica, y después el .bak con el mismo mecanismo
async function save(history) {
  // ↑ Primero el destino final: si esto falla, el error sube y el .bak queda como era
  await writeAtomic(history);
  const entries = countEntries(history);
  // ↓ Solo se renueva la red si este estado es al menos tan bueno como el mejor
  //   conocido. `>=` (y no `>`) para poder refrescar el .bak con el mismo tamaño.
  if (entries >= bakWatermark) {
    await writeAtomic(history, BAK_FILE, BAK_TMP_FILE);
    // ↑ La marca de agua es un máximo: nunca baja, así un estado degradado seguido
    //   de uno bueno no vuelve a habilitar la escritura de uno peor.
    bakWatermark = entries;
  } else {
    // ↑ Aviso por consola: la pérdida de ofertas tiene que ser visible, no una
    //   sorpresa silenciosa en la próxima corrupción.
    console.error(`[history] ${BAK_FILE} NO se sobrescribió: este guardado tiene ${entries} ofertas y la mejor copia conocida tiene ${bakWatermark}.`);
  }
}

// Registra las ofertas de la búsqueda actual (por región) en el historial.
// - Si una oferta ya existía, actualiza lastSeen (sigue activa) y conserva firstSeen.
// - Si es nueva, la agrega con firstSeen = ahora.
// - Si la oferta aparece en varias regiones, se las guardan todas (regions).
// - Purga ofertas publicadas (o vistas por primera vez) hace más de 6 meses.
// ↑ Registra todas las ofertas de la búsqueda actual (agrupadas por región)
export async function recordSearch(rankedByRegion) {
  // ↑ Todo el ciclo leer→mutar→guardar va dentro del lock: si dos búsquedas
  //   terminan a la vez (refresh + click en otra tab), la segunda espera a que la
  //   primera escriba y no pisa lo que la primera acaba de registrar
  return withLock(async () => {
    // ↑ Carga lo ya guardado y toma la hora actual como "visto ahora"
    const history = await load();
    const now = Date.now();

    // ↑ Recorre cada región y cada oferta para actualizar el historial
    for (const [region, jobs] of Object.entries(rankedByRegion)) {
      for (const job of jobs) {
        const key = keyOf(job);
        // ↑ ¿Ya habíamos visto esta oferta con la clave NUEVA?
        let existing = history.entries[key];
        // ↓ MIGRACIÓN EN CALIENTE de las entradas viejas (clave "título::empresa",
        //   sin el link). No hace falta tocar data/history.json: cuando la oferta
        //   vuelve a aparecer en una búsqueda, se la busca por la clave vieja, se
        //   heredan su firstSeen y sus regiones, y la entrada vieja se elimina.
        //   Sin esto, cambiar la clave duplicaría cada oferta en la lista: la vieja
        //   (que ya nadie vuelve a tocar) y la nueva. Que se migren de a una es
        //   exactamente lo que hace que el cambio sea retrocompatible de verdad.
        if (!existing) {
          const legacyKey = legacyKeyOf(job);
          // ↓ Solo se migra si la clave vieja existe de verdad. Si varias ofertas
          //   comparten título::empresa (el bug original), la PRIMERA que se
          //   encuentra se lleva la entrada vieja y las demás, que son ofertas
          //   DISTINTAS, entran con su propia clave nueva: ninguna se pierde.
          if (legacyKey !== key && history.entries[legacyKey]) {
            const legacy = history.entries[legacyKey];
            // ↓ Se borra la entrada vieja ahora (no "después"): si no, la oferta
            //   quedaría DOS veces en la lista, una con la clave vieja y otra con
            //   la nueva, y el usuario vería el mismo puesto duplicado.
            delete history.entries[legacyKey];
            // ↑ La entrada migrada conserva su firstSeen y sus regiones previas
            existing = legacy;
          }
        }
        // ↑ Une la región nueva con las que ya tenía: una oferta puede caer en más
        //   de una región y antes la segunda pisaba a la primera (se perdía el historial)
        const seen = regionsOf(existing);
        history.entries[key] = {
          job,
          regions: seen.includes(region) ? seen : [...seen, region],
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
  });
}

export async function expireOldJobs(rankedByRegion) {
  // ↑ Mismo lock que recordSearch: esta función también borra entradas del archivo
  return withLock(async () => {
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
  });
}

// Devuelve las ofertas registradas en los últimos 6 meses para una región, marcando
// cuáles siguen "activas" (aparecieron en la última búsqueda) y cuáles no.
// ↑ Devuelve las ofertas vistas de una región, marcando cuáles siguen activas
export async function getHistoryForRegion(region) {
  // ↑ Aunque sea una lectura, purga las entradas vencidas: por eso va bajo el lock
  return withLock(async () => {
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
    // ↑ Filtra por región (la oferta cuenta si estuvo en esa región en cualquier
    //   corrida) y dentro de la ventana de tiempo permitida
    return Object.values(history.entries)
      .filter((e) => regionsOf(e).includes(region) && effectiveStart(e.job, e.firstSeen, Date.now()) >= cutoff)
      .map((e) => ({
        ...e.job,
        // ↑ "Activa" = apareció en la ÚLTIMA búsqueda (lastSeen == lastRun)
        active: e.lastSeen === history.lastRun,
        firstSeen: e.firstSeen,
        lastSeen: e.lastSeen,
      }))
      // ↑ Ordena por lastSeen y empata con firstSeen (más recientes primero)
      .sort((a, b) => b.lastSeen - a.lastSeen || b.firstSeen - a.firstSeen);
  });
}
