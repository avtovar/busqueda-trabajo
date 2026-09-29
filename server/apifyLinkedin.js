// ↑ Módulo del backend que busca ofertas REALES en LinkedIn.
// ↑ LinkedIn no ofrece una API pública para buscar empleo, así que se usa un actor de Apify:
//   un servicio que "navega" la web por nosotros y devuelve lo que encontró en JSON.
//   Este archivo arma la URL de búsqueda, llama al actor y traduce su respuesta cruda al
//   mismo formato interno de oferta que ya usan las demás fuentes del proyecto.

// ↑ El perfil del candidato: la "fuente de verdad" de keywords y de skills con peso.
//   De acá salen los términos con los que se va a buscar en LinkedIn.
import { PROFILE } from './cvProfile.js';
// ↑ El módulo que calcula el match con el CV y ordena las ofertas por región.
//   Lo usamos al final, para que las mejores ofertas queden arriba.
import { rankByRegion } from './matcher.js';

// ↑ Diccionario clave-de-región -> texto que LinkedIn entiende como "location".
//   Existe porque adentro del proyecto las regiones usan nombres cortos y neutros
//   ('europa', 'eeuu') que LinkedIn no reconoce: hay que traducirlos al nombre real
//   del país o continente. Si una región no está en esta tabla, no se puede buscar.
const REGION_LOCATIONS = {
  argentina: 'Argentina',
  mexico: 'México',
  peru: 'Perú',
  colombia: 'Colombia',
  chile: 'Chile',
  europa: 'Europe',
  eeuu: 'United States',
};

// ↑ DEFAULT del tope de ofertas por búsqueda. Antes era una constante fija (50) y
//   eso era una decisión del PROYECTO, no un límite de Apify: el actor
//   `curious_coder~linkedin-jobs-scraper` aguanta ~1000 ofertas por ejecución.
//   Con 200 por defecto la búsqueda cubre de sobra lo que una persona llega a
//   mirar, sin pagar ni renderizar de más.
const DEFAULT_MAX_RESULTS = 200;
// ↑ Cota dura del clamp: nunca menos de 20 (por debajo no hay búsqueda) ni más
//   de 1000 (más allá el actor no rinde y el costo se dispara por nada).
const MIN_RESULTS = 20;
const MAX_RESULTS_CAP = 1000;
// ↑ LinkedIn devuelve ~25 ofertas por página de búsqueda. Este número es el que
//   convierte "cuántas ofertas quiero" en "cuántas páginas tengo que pedir".
const RESULTS_PER_PAGE = 25;
// ↑ Máximo de páginas por corrida. Es lo que rompe el techo de ~1000 resultados
//   POR URL: más allá de 8 páginas ya son 200 ofertas y no aporta nada nuevo.
//   El factor limitPerSource del actor reparte el total entre TODAS las URLs, así
//   que 8 páginas son 8 x 25 = 200, exactamente el default.
const MAX_PAGES = 8;
// ↑ Timeout de la ejecución, en SEGUNDOS, que va en la query string de Apify.
//   300 es el MÁXIMO que acepta el endpoint síncrono de Apify (por arriba
//   devuelve 408), así que es el techo real de esta integración. Antes eran 180,
//   insuffcientes en cuanto se piden varias páginas.
const APIFY_TIMEOUT_S = 300;
// ↑ Temporizador del AbortController, en MILISEGUNDAS. Tiene que ser SIEMPRE
//   MAYOR que el de Apify (300 s) para que el error lo veamos nosotros con un
//   mensaje claro y no una respuesta de error de Apify: 320 s = 300 + 20 s de
//   margen para el viaje de ida y vuelta de la respuesta.
const CLIENT_TIMEOUT_MS = 320_000;
// ↑ Ventana temporal: nos interesan solo ofertas publicadas en los últimos 30 días.
//   Si la ventana fuera muy amplia, la búsqueda devolvería ruido (vacantes viejas y cerradas).
const DAYS_BACK = 30;

// ↑ Resuelve cuántas ofertas se van a pedir, aplicando el MISMO clamp en los tres
//   orígenes posibles. El clamp es duro a propósito: si alguien pone 5000 en el
//   .env o en el body, el actor cobraría por 5000 ofertas que ni se van a mirar.
//   Number() tolera que el valor venga como texto (siempre es así en process.env)
//   y que sea decimal; el isFinite descarta NaN, que es lo que devuelve Number('').
export function maxResults(limit) {
  const clamp = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_RESULTS;
    return Math.min(MAX_RESULTS_CAP, Math.max(MIN_RESULTS, Math.round(n)));
  };
  // ↑ PRIORIDAD 1: el `limit` explícito del body del request (lo manda el frontend).
  if (limit !== undefined && limit !== null && limit !== '') return clamp(limit);
  // ↑ PRIORIDAD 2: la variable de entorno APIFY_MAX_RESULTS (config del proyecto).
  const fromEnv = process.env.APIFY_MAX_RESULTS;
  if (fromEnv !== undefined && fromEnv !== '') return clamp(fromEnv);
  // ↓ PRIORIDAD 3: el default de arriba.
  return DEFAULT_MAX_RESULTS;
}

// ↑ Cuántas páginas de resultados hay que pedir para llegar al límite pedido.
//   El mínimo es 1 (nunca se pide cero páginas) y el máximo MAX_PAGES.
function pageCount(limit) {
  return Math.min(MAX_PAGES, Math.max(1, Math.ceil(limit / RESULTS_PER_PAGE)));
}

// ↑ Arma el texto de la query de búsqueda, algo como: qa OR "test automation" OR cypress.
//   Divide para conquistar: en vez de una sola búsqueda enorme, muchos términos chicos
//   unidos con OR amplían lo que encontramos sin abrir demasiado los resultados.
function buildProfileKeywords() {
  // ↑ Un Map usado como set: guarda "clave normalizada" -> "término original".
  //   Sirve para DEDUPLICAR sin perder las mayúsculas: si aparecen "QA" y "qa", la clave
  //   en minúsculas es la misma, así que solo sobrevive el primero. Además, consultar por
  //   clave es una operación instantánea, mientras que buscar en un array hay que recorrerlo.
  const terms = new Map();
  // ↑ Paso 1: de PROFILE.keywords nos quedamos con las que hablan de QA/testing.
  //   La primera condición exige una de estas palabras: qa, quality, test, automation o sdet.
  //   La segunda deja afuera 'sdft' a propósito: está en el perfil como keyword, pero
  //   no sirve como término de búsqueda.
  const roleKeywords = (PROFILE.keywords || []).filter((term) => (
    /(qa|quality|test|automation|sdet)/i.test(term) && !/^sdft$/i.test(term)
  ));
  // ↑ Paso 2: los skills del CV con peso 0.9 o más (los más importantes) que además
  //   sean de QA. El peso se pasa por Number() porque en el perfil están guardados como texto.
  const coreSkills = Object.entries(PROFILE.skills || {})
    .filter(([name, weight]) => Number(weight) >= 0.9 && /(qa|quality|test|automation)/i.test(name))
    .map(([name]) => name);

  // ↑ Paso 3: juntamos las dos listas y las vamos metiendo en el Map, que deduplica solo.
  for (const term of [...roleKeywords, ...coreSkills]) {
    const normalized = term.trim().toLowerCase();
    if (normalized && !terms.has(normalized)) terms.set(normalized, term.trim());
  }

  // ↑ Paso 4: los términos CON espacios van entre comillas, porque LinkedIn interpreta
  //   el OR sobre palabras sueltas: sin comillas, "test automation" se rompería en dos.
  return [...terms.values()]
    .map((term) => (/\s/.test(term) ? `"${term}"` : term))
    .join(' OR ');
}

// ↑ Construye la URL de búsqueda de LinkedIn para una región Y una página.
//   Se usa el objeto URL + searchParams en vez de concatenar strings a mano: él se
//   encarga de escapar los caracteres especiales y los acentos, y arma el "?" y los "&".
//   `pageNum` es el número de página del listado (0 = primera): antes estaba
//   hardcodeado en 0, y por eso una sola URL topaba en ~1000 resultados.
function searchUrl(region, pageNum = 0) {
  const url = new URL('https://www.linkedin.com/jobs/search/');
  // ↑ position=1 es el desplazamiento del listado: la primera oferta es la número 1
  url.searchParams.set('position', '1');
  // ↑ pageNum: la página que se está pidiendo (0, 1, 2...). Cada página trae
  //   ~25 ofertas nuevas, así que esto es lo que permite pedir más de 1000.
  url.searchParams.set('pageNum', String(pageNum));
  // ↑ keywords: la query que armamos arriba, envuelta en paréntesis
  url.searchParams.set('keywords', `(${buildProfileKeywords()})`);
  // ↑ location: la traducción de la región, sacada de REGION_LOCATIONS
  url.searchParams.set('location', REGION_LOCATIONS[region]);
  // ↑ f_TPR es el filtro de "publicada en las últimas X". Lleva el prefijo r (recundos)
  //   y el número de segundos: 30 días * 24 h * 60 min * 60 s. O sea, el filtro de fecha.
  url.searchParams.set('f_TPR', `r${DAYS_BACK * 24 * 60 * 60}`);
  return url.toString();
}

// ↑ Arma TODAS las URLs de la búsqueda: las páginas 0..N-1 de la misma query.
//   El actor acepta un array de URLs y reparte `limitPerSource` entre todas, así
//   que limitar la cantidad de páginas es lo que mantiene el costo acotado.
function searchUrls(region, limit) {
  return Array.from({ length: pageCount(limit) }, (_, page) => searchUrl(region, page));
}

// ↑ Normalizador "tolera cualquier cosa": convierte en texto plano lo que venga de Apify.
//   El actor no garantiza el tipo de cada campo (a veces string, a veces número o lista),
//   así que antes de usar un dato lo pasamos por acá y siempre sale un string limpio.
function asText(value) {
  // ↑ Si es una lista, mapeamos cada elemento y unimos con ' · '.
  //   La RECURSIÓN es la clave: dentro del map llamamos a asText otra vez, así que si un
  //   elemento es otra lista, esa lista también se resuelve sola, hasta llegar al texto.
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(' · ');
  // ↑ Si es string o número, lo pasamos a texto y le quitamos los espacios sobrantes.
  //   Cualquier otro tipo (null, undefined, objeto) devuelve '' en vez de romper el código.
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

// ↑ Normaliza la fecha de publicación. El problema que resuelve: el actor devuelve la
//   fecha en formatos distintos (un número que puede ser segundos o milisegundos, o un
//   string). Si no lo unificamos, new Date() nos da resultados equivocados o inválidos.
function normalizeDate(job) {
  // ↑ Probamos tres nombres de campo por orden de prioridad. El ?? (doble interrogación)
  //   significa "usá el primero que no sea null ni undefined".
  const raw = job.postedAtTimestamp ?? job.postedAt ?? job.date ?? '';
  if (!raw) return '';
  const numeric = Number(raw);
  // ↑ ¿Es un número entero escrito solo con dígitos? El /^\d+$/ lo evita: sin él, un
  //   string como "2024-01-05" o "1.5e9" se confundiría con un timestamp.
  const date = Number.isFinite(numeric) && /^\d+$/.test(String(raw))
    // ↑ El umbral 1e12 (un billón) decide la escala: los timestamps en MILISEGUNDOS
    //   tienen 13 dígitos (1.700.000.000.000) y los de SEGUNDOS tienen 10 (1.700.000.000).
    //   Si el número es chico, son segundos y hay que multiplicarlo por 1000.
    ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
    // ↑ Si no es un número, se lo pasamos tal cual a new Date() y que JS lo interprete.
    : new Date(raw);
  // ↑ Si la fecha quedó inválida (NaN) devolvemos '' en vez de un "Invalid Date"
  //   que después rompería el filtro de ofertas viejas.
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

// ↑ Traduce UNA oferta cruda de Apify al formato interno que usa el resto de la app.
//   Devuelve { job, reason }: `job` es null cuando la oferta no sirve (y `reason`
//   dice POR QUÉ, para que la estadística de la respuesta no tenga que adivinarlo).
//   Antes devolvía solo `job` o `null` y los descartes eran invisibles.
function mapJob(job, region, sourceUrl) {
  // ↑ Lectura tolerante: cada campo tiene alternativas porque no siempre llega con el
  //   mismo nombre (por ejemplo la empresa puede venir como companyName o como company).
  const title = asText(job.title);
  const company = asText(job.companyName || job.company);
  const link = asText(job.link || job.jobUrl || job.applyUrl);
  // ↑ Descarte obligatorio: si falta el título, la empresa o el link no se puede mostrar
  //   la tarjeta ni el botón de postulación, así que la oferta no vale nada.
  if (!title || !company || !link) return { job: null, reason: 'sinLink' };

  // ↑ Descripción en texto plano: descriptionText ya viene limpia, pero si no existe
  //   caemos en descriptionHtml y ahí sí hay que limpiar el HTML a mano.
  const description = asText(job.descriptionText)
    // ↑ /<[^>]*>/g reemplaza todo lo que parezca una etiqueta por un espacio. Se pone un
    //   espacio y no vacío a propósito: si no, "dev</b>qa" se volvería "devqa".
    //   El segundo replace(/\s+/g, ' ') colapsa todos los espacios que quedaron pegados.
    || asText(job.descriptionHtml).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  // ↑ Tags: juntamos los que trae el actor con los campos sueltos (nivel de seniority,
  //   tipo de contrato, función, industria) y el filter(Boolean) se queda solo con los
  //   que tienen texto, tirando los vacíos.
  const tags = [
    ...(Array.isArray(job.tags) ? job.tags.map(asText) : []),
    asText(job.seniorityLevel),
    asText(job.employmentType),
    asText(job.jobFunction),
    asText(job.industries),
  ].filter(Boolean);
  const salary = asText(job.salaryInfo || job.salary);
  const date = normalizeDate(job);

  // ↑ Filtro de ofertas viejas: si la fecha existe y es más antigua que la ventana de
  //   DAYS_BACK, la oferta se descarta. Ojo el "y": si NO hay fecha la oferta pasa,
  //   porque no tenemos información para juzgarla.
  if (date && Date.now() - new Date(date).getTime() > DAYS_BACK * 24 * 60 * 60 * 1000) {
    return { job: null, reason: 'vieja' };
  }

  return {
    job: {
      // ↑ El id lleva el prefijo "linkedin-" porque tiene que ser único entre TODAS las
      //   fuentes: si viniera el mismo id que en otra fuente, se pisarían en el historial.
      //   El link funciona como id de respaldo cuando el actor no trae id.
      id: `linkedin-${asText(job.id || job.jobId) || link}`,
      // ↑ source deja constancia de dónde vino la oferta (se ve en la UI y en el historial)
      source: 'LinkedIn / Apify',
      // ↑ Acá el portal es SIEMPRE LinkedIn y se pone en el momento del scrape, sin
      //   pasar por server/portal.js: es el único lugar donde se sabe con certeza.
      portal: 'LinkedIn',
      // ↑ sourceUrl = la URL real de búsqueda que se usó para traer esta oferta, que
      //   es la página 0 (la primera) de los mismos filtros de esta corrida. El
      //   fallback cubre el caso de que se llame a mapJob() sin el dato.
      sourceUrl: sourceUrl || searchUrl(region, 0),
      title,
      company,
      // ↑ Si la oferta no dice dónde está, se asume la región que el usuario pidió buscar
      location: asText(job.location) || REGION_LOCATIONS[region],
      // ↑ regionGuess deja la huella de la región buscada; matcher.js la usa como pista
      //   para decidir en qué bucket del ranking entra cada oferta.
      regionGuess: region,
      applyUrl: asText(job.applyUrl) || link,
      description,
      tags,
      salary,
      date,
    },
    // ↓ Oferta válida: no hay motivo de descarte.
    reason: null,
  };
}

// ↑ Crea un error que además viaja con su código de estado HTTP.
//   El truco es Object.assign: le "pega" la propiedad statusCode al objeto Error. Así, en
//   el catch del servidor se puede leer error.statusCode y responder con ese código en
//   lugar de un 500 genérico. Por eso los errores se tiran con `throw` y no con `return`.
function httpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

// ↑ FUNCIÓN PRINCIPAL del módulo: busca ofertas de LinkedIn para una región.
//   Recibe la clave de región ('argentina', 'europa'...) y un objeto de opciones
//   (`{ limit }`, opcional) y devuelve el mismo paquete { region, jobs, total... }
//   que devuelven las demás fuentes de empleo, MÁS `regions` (todos los buckets)
//   y `stats` (el detalle de lo que se descartó, que antes se perdía en silencio).
export async function searchLinkedInWithApify(region, options = {}) {
  // ↑ Validación de entrada: si la región no existe en el diccionario no hay forma de
  //   armar la URL, así que cortamos acá con 400 (la petición del cliente está mal).
  if (!REGION_LOCATIONS[region]) throw httpError('Región no válida.', 400);

  // ↑ LECTURA DEL TOKEN. OJO, regla de oro: el token NUNCA se escribe en el código.
  //   Sale de process.env.APIFY_API_TOKEN, que Node carga desde el archivo local .env,
  //   y el .env está en .gitignore, así que nunca se sube al repositorio.
  const token = process.env.APIFY_API_TOKEN;
  // ↑ Si no está configurado, la culpa es del servidor y no de quien está buscando,
  //   por eso el 503 (servicio no disponible) y no un 400.
  if (!token) {
    throw httpError('Falta APIFY_API_TOKEN. Configúralo en el archivo local .env y reinicia el servidor.', 503);
  }

  // ↑ Se resuelve el límite UNA sola vez y de ahí salen las páginas a pedir, así
  //   el número que se le pasa a Apify y el que se reporta en resultLimit son
  //   siempre el mismo (antes el `resultLimit` era un 50 que no era real).
  const limit = maxResults(options.limit);
  const pages = searchUrls(region, limit);
  // ↑ La página 0 es la búsqueda "principal": es la que va como sourceUrl de cada
  //   oferta, porque es la que el usuario puede volver a abrir para repetirla.
  const sourceUrl = pages[0];

  // ↑ TIMEOUT. El scrape de LinkedIn puede tardar minutos. El combo AbortController +
  //   setTimeout es un temporizador que cancela el fetch si la respuesta no llega a tiempo;
  //   sin esto el servidor quedaría esperando indefinidamente.
  const controller = new AbortController();
  //   320 s contra los 300 s de Apify: SIEMPRE por encima, para que el error lo veamos
  //   nosotros (504, con mensaje propio) y no una respuesta de error de Apify (408).
  const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  let response;
  try {
    // ↑ Endpoint "run-sync-get-dataset-items": lanza el actor y ESPERA el resultado en la
    //   misma respuesta (es la forma síncrona de la API de Apify).
    //   - format=json: la respuesta viene como JSON y no como CSV.
    //   - clean=true: Apify borra del dataset los campos que vinieron vacíos.
    //   - timeout=300: segundos máximos que Apify espera antes de cortar la ejecución
    //     (es su máximo para la API síncrona; subió desde 180 porque ahora se piden
    //     hasta 8 páginas y 180 s se quedaban cortos a mitad de camino).
    response = await fetch(
      `https://api.apify.com/v2/acts/curious_coder~linkedin-jobs-scraper/run-sync-get-dataset-items?format=json&clean=true&timeout=${APIFY_TIMEOUT_S}`,
      {
        // ↑ Va por POST (y no GET) porque la configuración de la ejecución viaja en el cuerpo
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // ↑ El token viaja en el header Authorization como "Bearer <token>": es la forma
          //   estándar de autenticarse en Apify, como una chave que abre la puerta.
          Authorization: `Bearer ${token}`,
        },
        // ↑ Cuerpo de la ejecución: las URLs que armamos arriba y cuántas ofertas pedir
        body: JSON.stringify({
          // ↓ Varias páginas, no una sola: es lo que rompe el techo de ~1000 resultados
          //   POR URL de LinkedIn. Con una sola URL(pageNum=0) el actor no tenía de
          //   dónde sacar más ofertas, por más que se le pidieran.
          urls: pages,
          // ↓ El tope va acá, ya configurado (limit del body > APIFY_MAX_RESULTS > 200)
          //   y acotado al rango 20..1000. El actor reparte este total entre las URLs.
          limitPerSource: limit,
          // ↑ autoConvertToAiSearch: el actor devuelve el texto ya limpio, listo para
          //   que el matcher lo compare contra el CV.
          autoConvertToAiSearch: true,
          // ↑ Los dos que están en false es porque no los usamos: no necesitamos datos
          //   de la empresa, y no nos interesa que parta los resultados por ciudad.
          scrapeCompany: false,
          splitByLocation: false,
        }),
        // ↑ El signal del AbortController es lo que permite cortar el fetch a los 320 s
        signal: controller.signal,
      }
    );
  } catch (error) {
    // ↑ Acá solo llegan errores de red o del temporizador (si la respuesta fue 401, 402 o
    //   500 no se entra por acá: eso se revisa más abajo con response.status).
    //   AbortError = lo cortó nuestro temporizador, así que la respuesta es 504 (timeout).
    if (error.name === 'AbortError') throw httpError('Apify tardó demasiado en responder. Prueba de nuevo más tarde.', 504);
    //   Cualquier otro fallo de conexión se reporta como 502 (no se pudo obtener la respuesta).
    throw httpError('No se pudo conectar con Apify.', 502);
  } finally {
    // ↑ finally se ejecuta SIEMPRE, haya éxito o error, así que el temporizador se apaga
    //   sí o sí. Si lo dejáramos vivo, después intentaría cerrar una conexión ya terminada.
    clearTimeout(timeout);
  }

  // ↑ TRADUCCIÓN DE ERRORES de Apify a mensajes que el usuario entienda:
  //   401/403 = token inválido o sin permiso para este actor -> hay que arreglar el .env.
  if (response.status === 401 || response.status === 403) {
    throw httpError('Apify rechazó el token. Revísalo en el archivo local .env.', 502);
  }
  //   402 = "Payment Required": la cuenta de Apify se quedó sin saldo/créditos.
  //   Acá sí se reenvía el 402 al cliente, porque es un problema de la cuenta del usuario.
  if (response.status === 402) {
    throw httpError('Apify no tiene saldo disponible para ejecutar esta búsqueda.', 402);
  }
  // ↑ Cualquier otro error (500, 429, etc.) se reporta tal cual llegó.
  if (!response.ok) throw httpError(`El actor de Apify respondió con error HTTP ${response.status}.`, 502);

  let items;
  try {
    // ↑ Lectura DEFENSIVA: si el cuerpo no es JSON válido, response.json() revienta con
    //   una excepción poco clara; el catch la convierte en un error controlado y con mensaje.
    items = await response.json();
  } catch {
    throw httpError('Apify devolvió una respuesta que no es JSON válido.', 502);
  }
  // ↑ Antes de recorrerlo verificamos que sea una lista: si devolvió un objeto o un
  //   string, el for...of de abajo no funcionaría y el error sería incomprensible.
  if (!Array.isArray(items)) throw httpError('Apify devolvió un formato de resultados inesperado.', 502);

  // ↑ ESTADÍSTICAS de la corrida. Antes no existía nada de esto y las ofertas
  //   perdidas eran invisibles: no se distinguía "no vino" de "vino y se descartó".
  //   Todos los campos son números, para que el frontend pueda mostrarlos tal cual.
  const stats = {
    // ↓ Lo que devolvió el actor, antes de tocar nada.
    recibidos: items.length,
    // ↓ Válidas y deduplicadas: las que realmente pueden mostrarse.
    guardados: 0,
    // ↓ Mismo id dos veces (LinkedIn a veces repite la oferta entre páginas).
    duplicados: 0,
    // ↓ Sin título, sin empresa o sin link: no se pueden mostrar ni se puede postear.
    sinLink: 0,
    // ↓ Publicadas hace más de DAYS_BACK días.
    viejas: 0,
    // ↓ El matcher les dio score 0: no son de QA o no matchean con el CV.
    sinMatch: 0,
    // ↓ Matchean, pero assignRegion() las metió en OTRO bucket que el pedido.
    //   Este es el número que antes no existía, y es el que más se perdía: una
    //   oferta buscada para Argentina con location "Berlin" caía en `europa` y
    //   desaparecía de la respuesta sin dejar rastro.
    otrasRegiones: 0,
  };

  // ↑ DEDUPLICACIÓN final. El Map indexa por id, así que si dos ofertas traen el mismo id
  //   solo se guarda la primera y la segunda se descarta.
  const unique = new Map();
  for (const item of items) {
    // ↓ mapJob devuelve { job, reason }: el motivo sirve para sumar al contador
    //   correspondiente sin volver a preguntar por qué no se guardó.
    const { job, reason } = mapJob(item, region, sourceUrl);
    if (!job) {
      if (reason === 'sinLink') stats.sinLink += 1;
      else if (reason === 'vieja') stats.viejas += 1;
      continue;
    }
    if (unique.has(job.id)) {
      stats.duplicados += 1;
      continue;
    }
    unique.set(job.id, job);
  }
  stats.guardados = unique.size;

  // ↑ rankByRegion (de matcher.js) recalcula el match de cada oferta contra el CV y
  //   devuelve un objeto { region: [ofertas ordenadas de mejor match a peor] },
  //   dejando afuera las que dio score 0.
  const ranked = rankByRegion([...unique.values()]);
  // ↓ Cuántas ofertas sobrevivieron al ranking, sumadas de TODOS los buckets.
  const rankedTotal = Object.values(ranked).reduce((acc, list) => acc + list.length, 0);
  // ↓ Lo que entró al ranking pero el matcher descartó por score 0.
  stats.sinMatch = stats.guardados - rankedTotal;
  // ↑ Acá sigue el bucket que pidió el usuario, que es lo que el frontend ya
  //   consume como `jobs` (el contrato no cambia).
  const jobs = ranked[region] || [];
  // ↓ Y lo que cayó en los otros buckets: no se tira, ahora viaja en `regions`.
  stats.otrasRegiones = rankedTotal - jobs.length;

  // ↑ Paquete de salida: es el mismo contrato que consumen las demás fuentes, así que el
  //   frontend recibe siempre la misma forma y no necesita saber de dónde vinieron los datos.
  return {
    region,
    jobs,
    total: jobs.length,
    // ↑ `regions` = TODOS los buckets del ranking, no solo el pedido. Es lo que
    //   faltaba para que una oferta buscada para Argentina y clasificada en europa
    //   no se perdiera: ahora sigue llegando, en su propio bucket.
    regions: ranked,
    // ↑ `stats` = el detalle numérico de lo que se perdió, para que sea diagnosticable.
    stats,
    // ↑ _online = true marca que la búsqueda fue real, no datos de demostración
    _online: true,
    source: 'LinkedIn / Apify',
    // ↑ checkedAt: la hora exacta del scrape, para que la UI pueda mostrar "actualizado hace..."
    checkedAt: new Date().toISOString(),
    // ↓ resultLimit ahora es el límite REAL de esta corrida (antes siempre 50).
    resultLimit: limit,
    // ↓ Cuántas páginas de LinkedIn se pidieron: sirve para entender por qué una
    //   búsqueda trajo menos de lo esperado (LinkedIn puede tener menos de 25 por página).
    pages: pages.length,
    // ↓ La URL de búsqueda usada, que es la que viaja también como sourceUrl de cada oferta.
    searchUrl: sourceUrl,
  };
}