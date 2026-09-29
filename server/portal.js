// ============================================================================
// Portal de origen: responde "¿de DÓNDE salió esta oferta?".
// El modelo de oferta tenía dos campos de procedencia y ninguno servía:
//   - `source`  -> texto libre. Hay 44 valores distintos ('Directo (link)',
//                  'Reclutador (LinkedIn)', 'QA Watcher (via LinkedIn)'...)
//                  porque cada curador escribió el que quiso.
//   - `applyUrl`-> adónde POSTULAR, no de dónde se leyó la oferta.
// Lo que faltaba eran los dos campos que el frontend consume:
//   - `portal`    -> nombre corto y legible del portal: 'LinkedIn', 'Remotive',
//                    'Arbeitnow', 'Himalayas', 'RemoteOK', 'Jobicy', 'Curada',
//                    'Demo'.
//   - `sourceUrl` -> link a la PÁGINA DE BÚSQUEDA de ese portal, para poder
//                    volver a encontrar la oferta (y no la oferta en sí, que
//                    puede haber expirado). Puede ser '' si no se puede deducir.
// Este módulo es el ÚNICO lugar donde se decide eso, y se aplica de forma
// central en server/index.js (ver withPortal) para no editar a mano las 57
// entradas de curatedJobs.js ni las 5 fuentes de jobSources.js.
// ============================================================================

// ↑ ORDEN de detección: gana la PRIMERA coincidencia. LinkedIn va primero a
//   propósito, porque es el portal que más formas distintas toma en el campo
//   `source` del proyecto ('Reclutador (LinkedIn)', 'Capgemini (LinkedIn)',
//   'QA Watcher (via LinkedIn)'): todas son, de hecho, ofertas de LinkedIn.
// ↑ Cada entrada es un regex que se prueba contra `source` + `applyUrl` en
//   minúsculas. Los casos con riesgo de falso positivo (occ, indeed, demo) usan
//   límites de palabra en vez de "substring suelto": 'occ' aparece adentro de
//   'occupational', 'recOccurred' o cualquier host que lo contenga de pasada.
const PORTAL_PATTERNS = [
  { portal: 'LinkedIn', re: /linkedin/i },
  { portal: 'Remotive', re: /remotive/i },
  { portal: 'Arbeitnow', re: /arbeitnow/i },
  { portal: 'Himalayas', re: /himalayas/i },
  { portal: 'RemoteOK', re: /remote[\s-]?ok/i },
  { portal: 'Jobicy', re: /jobicy/i },
  { portal: 'Computrabajo', re: /computrabajo/i },
  { portal: 'Indeed', re: /indeed/i },
  { portal: 'InfoJobs', re: /infojobs/i },
  { portal: 'Glassdoor', re: /glassdoor/i },
  { portal: 'OCC', re: /(?:^|[^a-z0-9])occ(?:[^a-z0-9.]|$)|occ\.fr|observatoire/i },
  { portal: 'Demo', re: /(?:^|[^a-z0-9])demos?(?:[^a-z0-9]|$)|simulad|demostrativ/i },
];

// ↑ Valor por defecto SEGURO: si no se reconoce la procedencia, la oferta se
//   considera curada a mano. Es el mejor default porque nunca miente: una
//   oferta sin portal identificado sí viene de una bolsa propia, de un mail o
//   de un link que pasó alguien, no de LinkedIn ni de Remotive.
const DEFAULT_PORTAL = 'Curada';

// ↑ URL de BÚSQUEDA por texto. Solo estos portales aceptan una query: el
//   resultado se arma pegándole la query escapada al final.
const PORTAL_QUERY_SEARCH = {
  Remotive: 'https://remotive.com/remote-jobs/search?query=',
};

// ↑ URL de listado o home para los portales SIN buscador por texto (no existe
//   un parámetro de búsqueda que se pueda adivinar, y pegar la query al final de
//   'https://remoteok.com/remote-jobs' produciría una URL rota). Con estos se
//   devuelve la URL tal cual, sin concatenarle nada.
const PORTAL_LISTING = {
  Arbeitnow: 'https://www.arbeitnow.com/',
  Himalayas: 'https://himalayas.app/jobs',
  RemoteOK: 'https://remoteok.com/remote-jobs',
  Jobicy: 'https://jobicy.com/',
  LinkedIn: 'https://www.linkedin.com/jobs/search/',
  Computrabajo: 'https://www.computrabajo.com/',
  Indeed: 'https://www.indeed.com/',
  InfoJobs: 'https://www.infojobs.net/',
  Glassdoor: 'https://www.glassdoor.com/',
  OCC: 'https://www.occ.fr/',
};

// ↑ Texto con el que se busca la oferta: título + empresa. Se recorta a 120
//   caracteres porque los títulos largos producen URLs imposibles de mostrar.
function queryOf(job) {
  return `${job?.title || ''} ${job?.company || ''}`.replace(/\s+/g, ' ').trim().slice(0, 120);
}

// ↑ Deriva el nombre del portal a partir de `source` y de la URL de postulación.
//   Es una función PURA: no toca el objeto, solo devuelve un string. Se puede
//   llamar en cualquier momento (incluso con una oferta incompleta) y siempre
//   devuelve algo utilizable.
export function portalOf(job) {
  // ↓ `source` va primero y `applyUrl` después: si el source dice LinkedIn pero
  //   el link es de otra bolsa, el patrón de LinkedIn igual gana, que es lo que
  //   quiere el usuario (le importa dónde se encontró la oferta).
  const source = String(job?.source || '');
  const url = String(job?.applyUrl || '');
  const haystack = `${source} ${url}`;
  for (const { portal, re } of PORTAL_PATTERNS) {
    if (re.test(haystack)) return portal;
  }
  // ↑ El '#' SOLO se mira en `source` (nunca en la URL) para no inventar un
  //   portal a partir de un ancla de navegación como '.../oferta#postular'.
  if (source.includes('#')) return 'Demo';
  // ↓ Caída final: curada (bolsa propia, mail, link manual, recruiters, etc.)
  return DEFAULT_PORTAL;
}

// ↑ Arma el link con el que se puede volver a buscar la oferta en su portal.
//   NO es la URL de la oferta: es la página de resultados de una búsqueda que,
//   muy probablemente, la vuelva a listar. Para los portales sin buscador por
//   texto devuelve la home/listado, y para los que no tienen dónde buscar
//   (Demo, Curada) devuelve ''.
export function searchUrlFor(job) {
  // ↓ Si la oferta ya trae sourceUrl (por ejemplo la de Apify, que se arma en
  //   el momento del scrape con los mismos filtros reales), esa gana siempre.
  if (job?.sourceUrl) return job.sourceUrl;

  const portal = job?.portal || portalOf(job);

  if (portal === 'LinkedIn') {
    // ↑ URL + searchParams en vez de concatenar: él escapa los acentos, los
    //   espacios y los &, que en un título de oferta aparecen siempre.
    const url = new URL(PORTAL_LISTING.LinkedIn);
    // ↓ Los MISMOS dos campos que se usan para buscar (keywords + location),
    //   para que el link devuelva un resultado parecido al que originó la oferta.
    url.searchParams.set('keywords', queryOf(job));
    // ↑ Si la oferta no dice dónde está, se omite el location en vez de mandar
    //   "undefined": una búsqueda por todo el mundo es más útil que una rota.
    if (job?.location) url.searchParams.set('location', String(job.location));
    return url.toString();
  }

  // ↓ Portal con buscador por texto: se le pega la query ya escapada.
  const withQuery = PORTAL_QUERY_SEARCH[portal];
  if (withQuery) return withQuery + encodeURIComponent(queryOf(job));

  // ↓ Portal sin buscador por texto: se devuelve su listado, sin inventar query.
  return PORTAL_LISTING[portal] || '';
}

// ↑ Enriquecimiento central: devuelve una COPIA de la oferta con `portal` y
//   `sourceUrl` ya resueltos. Nunca pisa valores que ya vengan (una oferta de
//   Apify ya viene con su portal y su URL de búsqueda reales), y nunca muta el
//   objeto original: los objetos de CURATED_JOBS, DEMO_JOBS y la caché de
//   getRanked() son compartidos entre requests, así que mutarlos filtraría
//   datos de un request a otro.
export function withPortal(job) {
  // ↑ Defensa: si no es un objeto (por ejemplo una lista vacía que se coló),
  //   se devuelve tal cual y no se rompe nada aguas arriba.
  if (!job || typeof job !== 'object') return job;
  return {
    ...job,
    // ↓ `||` y no `??`: un string vacío también tiene que rellenarse.
    portal: job.portal || portalOf(job),
    sourceUrl: job.sourceUrl || searchUrlFor(job),
  };
}
