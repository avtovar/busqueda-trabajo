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

// ↑ Techo de ofertas por búsqueda. Es un límite de costo y de usabilidad: el actor de
//   Apify cobra por ejecución, y tampoco tiene sentido traer 500 resultados a renderizar.
const MAX_RESULTS = 50;
// ↑ Ventana temporal: nos interesan solo ofertas publicadas en los últimos 30 días.
//   Si la ventana fuera muy amplia, la búsqueda devolvería ruido (vacantes viejas y cerradas).
const DAYS_BACK = 30;

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

// ↑ Construye la URL de búsqueda de LinkedIn para una región.
//   Se usa el objeto URL + searchParams en vez de concatenar strings a mano: él se
//   encarga de escapar los caracteres especiales y los acentos, y arma el "?" y los "&".
function searchUrl(region) {
  const url = new URL('https://www.linkedin.com/jobs/search/');
  // ↑ position=1 es el desplazamiento del listado: la primera oferta es la número 1
  url.searchParams.set('position', '1');
  // ↑ pageNum=0: pedimos la primera página de resultados
  url.searchParams.set('pageNum', '0');
  // ↑ keywords: la query que armamos arriba, envuelta en paréntesis
  url.searchParams.set('keywords', `(${buildProfileKeywords()})`);
  // ↑ location: la traducción de la región, sacada de REGION_LOCATIONS
  url.searchParams.set('location', REGION_LOCATIONS[region]);
  // ↑ f_TPR es el filtro de "publicada en las últimas X". Lleva el prefijo r (recundos)
  //   y el número de segundos: 30 días * 24 h * 60 min * 60 s. O sea, el filtro de fecha.
  url.searchParams.set('f_TPR', `r${DAYS_BACK * 24 * 60 * 60}`);
  return url.toString();
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
//   Devuelve null cuando la oferta no sirve, así el llamador la descarta sin preguntar.
function mapJob(job, region) {
  // ↑ Lectura tolerante: cada campo tiene alternativas porque no siempre llega con el
  //   mismo nombre (por ejemplo la empresa puede venir como companyName o como company).
  const title = asText(job.title);
  const company = asText(job.companyName || job.company);
  const link = asText(job.link || job.jobUrl || job.applyUrl);
  // ↑ Descarte obligatorio: si falta el título, la empresa o el link no se puede mostrar
  //   la tarjeta ni el botón de postulación, así que la oferta no vale nada.
  if (!title || !company || !link) return null;

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
  if (date && Date.now() - new Date(date).getTime() > DAYS_BACK * 24 * 60 * 60 * 1000) return null;

  return {
    // ↑ El id lleva el prefijo "linkedin-" porque tiene que ser único entre TODAS las
    //   fuentes: si viniera el mismo id que en otra fuente, se pisarían en el historial.
    //   El link funciona como id de respaldo cuando el actor no trae id.
    id: `linkedin-${asText(job.id || job.jobId) || link}`,
    // ↑ source deja constancia de dónde vino la oferta (se ve en la UI y en el historial)
    source: 'LinkedIn / Apify',
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
  };
}

// ↑ Crea un error que además viaja con su código de estado HTTP.
//   El truco es Object.assign: le "pega" la propiedad statusCode al objeto Error. Así, en
//   el catch del servidor se puede leer error.statusCode y responder con ese código en
//   lugar de un 500 genérico. Por eso los errores se tiran con `throw` y no con `return`.
function httpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

// ↑ FUNCIÓN PRINCIPAL del módulo (la única que se exporta): busca ofertas de LinkedIn
//   para una región. Recibe la clave de región ('argentina', 'europa'...) y devuelve el
//   mismo paquete { region, jobs, total... } que devuelven las demás fuentes de empleo.
export async function searchLinkedInWithApify(region) {
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

  // ↑ TIMEOUT. El scrape de LinkedIn puede tardar minutos. El combo AbortController +
  //   setTimeout es un temporizador que cancela el fetch si la respuesta no llega a tiempo;
  //   sin esto el servidor quedaría esperando indefinidamente.
  const controller = new AbortController();
  //   190 segundos: un poco MENOS que el timeout=180s que le pasamos a Apify en la URL,
  //   para que el error lo veamos nosotros y no una respuesta de error de Apify.
  const timeout = setTimeout(() => controller.abort(), 190_000);
  let response;
  try {
    // ↑ Endpoint "run-sync-get-dataset-items": lanza el actor y ESPERA el resultado en la
    //   misma respuesta (es la forma síncrona de la API de Apify).
    //   - format=json: la respuesta viene como JSON y no como CSV.
    //   - clean=true: Apify borra del dataset los campos que vinieron vacíos.
    //   - timeout=180: segundos máximos que Apify espera antes de cortar la ejecución.
    response = await fetch(
      'https://api.apify.com/v2/acts/curious_coder~linkedin-jobs-scraper/run-sync-get-dataset-items?format=json&clean=true&timeout=180',
      {
        // ↑ Va por POST (y no GET) porque la configuración de la ejecución viaja en el cuerpo
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // ↑ El token viaja en el header Authorization como "Bearer <token>": es la forma
          //   estándar de autenticarse en Apify, como una chave que abre la puerta.
          Authorization: `Bearer ${token}`,
        },
        // ↑ Cuerpo de la ejecución: la URL que armamos arriba y cuántas ofertas pedir
        body: JSON.stringify({
          urls: [searchUrl(region)],
          limitPerSource: MAX_RESULTS,
          // ↑ autoConvertToAiSearch: el actor devuelve el texto ya limpio, listo para
          //   que el matcher lo compare contra el CV.
          autoConvertToAiSearch: true,
          // ↑ Los dos que están en false es porque no los usamos: no necesitamos datos
          //   de la empresa, y no nos interesa que parta los resultados por ciudad.
          scrapeCompany: false,
          splitByLocation: false,
        }),
        // ↑ El signal del AbortController es lo que permite cortar el fetch a los 190 s
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

  // ↑ DEDUPLICACIÓN final. El Map indexa por id, así que si dos ofertas traen el mismo id
  //   solo se guarda la primera y la segunda se descarta.
  const unique = new Map();
  for (const item of items) {
    const job = mapJob(item, region);
    // ↑ mapJob devuelve null para las ofertas incompletas o viejas: el `job &&` las descarta
    //   sin necesidad de escribir un if aparte.
    if (job && !unique.has(job.id)) unique.set(job.id, job);
  }

  // ↑ rankByRegion (de matcher.js) recalcula el match de cada oferta contra el CV y
  //   devuelve un objeto { region: [ofertas ordenadas de mejor match a peor] },
  //   dejando afuera las que dio score 0.
  const ranked = rankByRegion([...unique.values()]);
  // ↑ Acá solo nos interesa UN bucket: el de la región que pidió el usuario.
  //   (Ojo: ranked trae todas las regiones, así que hay que elegir la nuestra.)
  const jobs = ranked[region] || [];
  // ↑ Paquete de salida: es el mismo contrato que consumen las demás fuentes, así que el
  //   frontend recibe siempre la misma forma y no necesita saber de dónde vinieron los datos.
  return {
    region,
    jobs,
    total: jobs.length,
    // ↑ _online = true marca que la búsqueda fue real, no datos de demostración
    _online: true,
    source: 'LinkedIn / Apify',
    // ↑ checkedAt: la hora exacta del scrape, para que la UI pueda mostrar "actualizado hace..."
    checkedAt: new Date().toISOString(),
    resultLimit: MAX_RESULTS,
  };
}