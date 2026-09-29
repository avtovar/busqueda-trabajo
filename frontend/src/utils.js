// ============================================================================
// Utilidades del frontend: funciones chicas que SOLO transforman datos.
// Almost todas son PURAS: misma entrada -> misma salida, sin guardar estado, sin
// tocar la red y sin modificar lo que reciben (como una calculadora: mismos
// números, mismo resultado). Por eso son fáciles de testear: les pasás un dato
// y comparáis la salida con lo esperado, sin levantar la app entera.
// Única salvedad: daysAgo() consulta el reloj (Date.now()), así que su resultado
// cambia con el paso del tiempo; el resto es 100% determinista.
// Los componentes importan estas funciones en vez de repetir la lógica.
// ============================================================================

// Devuelve la clase CSS que pinta el color del % de match según el score.
// Verde = match alto (>=75), amarillo = medio (>=50), rojo = bajo.
// ↑ Recibe el score (0-100) y devuelve el NOMBRE de una clase, no un color:
//   matchClass(96) -> 'match-high'. El color de verdad está en el CSS, así que
//   cambiar el color del % de match se hace en un solo lugar.
export function matchClass(score) {
  // ↑ Si el score pasa 75, la tarjeta se pinta verde (match-high).
  if (score >= 75) return 'match-high';
  // ↑ Entre 50 y 74, amarillo (match-mid).
  if (score >= 50) return 'match-mid';
  // ↑ Menos de 50, rojo (match-low).
  return 'match-low';
}

// ============================================================================
// DETECCIÓN DE IDIOMA DE LA OFERTA (castellano / inglés)
// ============================================================================
// ¿POR QUÉ SE CALCULA EN EL NAVEGADOR Y NO EN EL SERVIDOR?
//  1) Las ~220 ofertas ya guardadas en data/history.json NO traen ningún campo de
//     idioma, y no lo van a traer sin volver a scrapear (cada corrida gasta créditos
//     de Apify). Si el cálculo fuera del server, las ofertas viejas quedarían sin
//     etiqueta para siempre; en el cliente se detectan al instante, sin gastar nada.
//  2) El filtro de "% de match mínimo" que se agregó hace poco también es 100%
//     cliente, así queda consistente: las dos features de la tarjeta se calculan igual.
//  3) Funciona al instante sobre búsqueda en vivo, historial y datos demo.
// Restricciones que esto impone (y por eso el código es como es):
//  - PURA: no toca la red, no muta lo que recibe, ni timers. Lo único que guarda
//    estado es el Map de caché de más abajo, y solo como memoización.
//  - SOLO palabras funcionales en ASCII: los datos vienen con "mojibake"
//    (se ven así: "Automatizaci�n", "an�alista", "t cnico"), o sea que los
//    caracteres acentuados llegan ROTOS. Un diccionario con acentos fallaría en
//    silencio, así que acá no se usa ni uno.
//  - SIN jerga técnica: "QA", "SDET", "Automation", "Engineer", "Test", "Senior",
//    "Selenium"... son las MISMAS palabras en castellano y en inglés, así que no
//    sirven para distinguir nada. Lo que sí distingue son las palabras funcionales.
// ============================================================================

export const LANG_SHORT = { es: 'ES', en: 'EN' };
// ↑ 'ES' / 'EN' son las DOS ÚNICAS etiquetas que se muestran. No se agrega un tercer
//   estado (tipo "otro idioma") porque el usuario pidió solo castellano e inglés.
export const LANG_NAME = { es: 'castellano', en: 'inglés' };
// ↑ La palabra entera, que va en el tooltip y en el texto que leen los lectores de
//   pantalla: en la tarjeta corta alcanza con "ES", pero al leerlo en voz alta o al
//   pasar el mouse tiene que decir "castellano" y no una sigla.

export const LANG_LOW_CONFIDENCE = 0.35;
// ↑ Por debajo de este valor la detections se marca como "dudosa" y la interfaz la
//   atenúa. El número no es arbitrario: con la fórmula de abajo la confianza es
//   (diferencia entre idiomas / total de señales) × (cuánta evidencia hay). Confianza
//   plena necesita ~6 palabras funcionales coincidentes en el texto; con menos de
//   eso no hay base para asegura nada, así que se atenúa a propósito.

const LANG_MIN_EVIDENCE = 6;
// ↑ Cantidad de señales (ya ponderadas) a partir de la cual la confianza vale 1.
//   6 es un valor conservador: por debajo, una sola palabra suelta decide el idioma
//   y no es confiable.
const DESCRIPTION_WEIGHT = 0.7;
const TITLE_WEIGHT = 0.3;
// ↑ La descripción pesa 70% y el título 30%. Motivo documentado: hay títulos
//   REALES bilingües, por ejemplo
//   "Ingeniero de Automatización de Pruebas / Test Automation Engineer" (Peraton),
//   donde el título trae palabras de los dos idiomas y la descripción es la que de
//   verdad dice en qué idioma está escrita la oferta.
const TIE_MARGIN = 0.05;
// ↑ Diferencia de puntaje (normalizada) que se considera empate. Ver la regla de
//   desempate completa en detectJobLanguage().
const FOREIGN_CONFIDENCE_CAP = 0.3;
// ↑ Tope de confianza cuando el texto parece estar en un idioma que NO es es/en
//   (alemán, francés, portugués...). Ver FOREIGN_WORDS más abajo.

const ES_FUNCTION_WORDS = new Set([
  // Artículos, preposiciones y pronombres: aparecen en cada renglón de un texto en
  // castellano y ninguno de ellos existe como palabra en inglés.
  'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'en', 'para', 'con',
  'sin', 'sobre', 'que', 'se', 'del', 'al', 'por', 'como', 'su', 'sus', 'lo', 'nos',
  'nuestro', 'nuestra', 'nuestros', 'nuestras', 'cada', 'son', 'tiene', 'tienen',
  'hace', 'hacer', 'hemos', 'somos', 'usted', 'ustedes',
  // Verbos y sustantivos típicos de un aviso de empleo en castellano.
  'empresa', 'buscar', 'buscamos', 'busca', 'buscando', 'trabajo', 'trabaja',
  'trabajar', 'trabajamos', 'experiencia', 'experiencias', 'requerida', 'requerido',
  'requeridos', 'requerimos', 'requiere', 'requisito', 'requisitos',
  'responsabilidades', 'funciones', 'tareas', 'actividades', 'oportunidad',
  'oportunidades', 'puesto', 'puestos', 'vacante', 'vacantes', 'candidato',
  'candidatos', 'personas', 'cliente', 'clientes', 'excluyente', 'deseable',
  'deseables', 'indispensable', 'preferible', 'sueldo', 'salario', 'jornada',
  'turno', 'turnos', 'beneficios', 'remoto', 'remota', 'presencial', 'mediante',
  'ofrecemos', 'enviar', 'postular', 'postula', 'cv',
  // ↑ 'cv' son 2 letras y NO existe como palabra en inglés; en las ofertas
  //   hispanas es de las palabras que más veces se repite ("enviar CV", "su CV").
  //   OJO: 'es' (verbo ser) quedó FUERA a propósito: aparece en URLs y en
  //   Siglas tipo "es.linkedin.com", y un falso positivo de esos no vale la pena.
]);
// ↑ Se arman con new Set() para que la búsqueda sea O(1) en vez de recorrer un
//   array con .includes() por cada token de cada oferta.

const EN_FUNCTION_WORDS = new Set([
  'the', 'and', 'for', 'with', 'you', 'your', 'yours', 'our', 'we', 'us', 'are',
  'was', 'were', 'be', 'is', 'will', 'would', 'should', 'could', 'shall', 'may',
  'must', 'this', 'that', 'these', 'those', 'from', 'have', 'has', 'had', 'not',
  'all', 'any', 'who', 'what', 'when', 'where', 'which', 'while', 'about', 'into',
  'over', 'under', 'of', 'to', 'in', 'on', 'at', 'an', 'as', 'by', 'or', 'if',
  'it', 'its', 'they', 'them', 'their', 'there', 'than', 'then', 'also', 'can',
  // Verbos y sustantivos típicos de un job post en inglés.
  'job', 'jobs', 'work', 'works', 'working', 'experience', 'experienced',
  'required', 'require', 'requires', 'requiring', 'apply', 'applicant', 'company',
  'companies', 'team', 'teams', 'role', 'roles', 'position', 'positions',
  'responsibilities', 'responsibility', 'qualifications', 'requirements', 'years',
  'skills', 'skill', 'including', 'include', 'includes', 'candidate', 'candidates',
  'opportunity', 'opportunities', 'location', 'salary', 'benefits', 'employment',
  'duties', 'please', 'send', 'resume', 'ability', 'offer', 'offers', 'time',
  // ↑ 'no', 'one', 'full', 'part', 'other', 'like', 'work' y otros que SÍ existen
  //   en castellano ('no', 'uno', 'todo', 'parte', 'otro', 'como') quedaron FUERA a
  //   propósito: son palabras compartidas y no distinguen nada.
]);

// Palabras funcionales de idiomas que el proyecto NO tiene que mostrar (alemán,
// francés, portugués, italiano). NO se usan para cambiar la etiqueta: solo para
// BAJAR la confianza, porque el usuario pidió solo dos idiomas y una oferta en
// alemán tiene que salir como "estimado", no como un "castellano" con toda
// seguridad. Son todas ASCII y ninguna aparece en las dos listas de arriba
// (o sea: ninguna es ambigua entre castellano/inglés), por eso sirven de alarma.
// Se pueden escribir con y sin acento porque la limpieza de diacríticos (NFD) de
// más abajo convierte "für" en "fur" y "não" en "nao" automáticamente.
const FOREIGN_WORDS = new Set([
  // Alemán
  'und', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einer',
  'ist', 'sind', 'wir', 'du', 'dich', 'dein', 'ihre', 'mit', 'von', 'zum', 'zur',
  'sich', 'nicht', 'auch', 'werden', 'durch', 'sowie', 'dass', 'haben', 'sein',
  'oder', 'aber', 'wenn', 'unser', 'unsere', 'eure', 'werdet', 'bei', 'aus', 'euch',
  'fur', 'uber', 'dich', 'mochtest', 'werden',
  // Francés
  'est', 'sont', 'une', 'dans', 'avec', 'vous', 'votre', 'cette', 'aux', 'notre',
  'ainsi', 'leur', 'tout', 'toute', 'nous', 'des', 'du', 'et', 'sur', 'qui', 'quoi',
  'dont', 'aussi', 'etre', 'elle', 'elles',
  // Portugués
  'voce', 'nao', 'sao', 'seu', 'sua', 'uma', 'atende', 'vagas', 'atualizada',
  // Italiano
  'sono', 'della', 'delle', 'nella', 'nel',
]);

// Limpia el texto antes de contar palabras: le saca el HTML, las URLs y los
// correos, y después pasa todo a minúsculas sin tildes ni signos.
// ↑ Por qué: las descripciones vienen con HTML (<p>, <li>, <strong>…) y con URLs.
//   Si no los sacáramos, "es" de "https://es.linkedin.com" y "in" de
//   "https://lnkd.in/xyz" se contarían como palabras del castellano/inglés y
//   falsearían el resultado. También se borran las entidades (&amp;, &nbsp;).
function cleanLangText(value) {
  if (typeof value !== 'string' || !value) return '';
  // ↑ Sin descripción (undefined, null, "") devuelve texto vacío y listo: el
  //   detector después decide con el título, que es el caso borde pedido.
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\S+@\S+/g, ' ')
    .replace(/&\w{2,8};/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // ↑ normalize('NFD') separa "á" en "a" + un carácter combinante invisible;
    //   este replace borra esos caracteres combinantes y deja la letra pelada.
    .replace(/[^a-z0-9]+/g, ' ');
    // ↑ Cualquier corrida que no sea letra o número (puntuación, %, +, /) pasa a
    //   ser un espacio: así "C++", "QA/SDET" o "(m/w/d)" se parten en tokens.
}

// Cuenta cuántas palabras funcionales de cada idioma hay en un texto.
// ↑ Devuelve TRES números: cuántas señales de castellano, cuántas de inglés y
//   cuántas de "otro idioma" (para la alarma de confianza). No hace falta el total
//   de tokens: la evidencia se mide sobre las señales, no sobre el largo del texto.
function countLangSignals(value) {
  const esWords = ES_FUNCTION_WORDS;
  const enWords = EN_FUNCTION_WORDS;
  let es = 0;
  let en = 0;
  let foreign = 0;
  for (const token of cleanLangText(value).split(' ')) {
    if (token.length < 2 || /^\d+$/.test(token)) continue;
    // ↑ Se descartan los tokens de 1 carácter y los que son solo números: son
    //   ruido (letras sueltas de etiquetas HTML, años, cantidades, "(m/w/d)").
    if (esWords.has(token)) es += 1;
    else if (enWords.has(token)) en += 1;
    else if (FOREIGN_WORDS.has(token)) foreign += 1;
  }
  return { es, en, foreign };
}

// ¿En qué idioma está escrita la oferta? Devuelve SIEMPRE un idioma ('es' o 'en'),
// pero además devuelve cuán segura está esa respuesta, para que la interfaz
// pueda atenuar los casos dudosos en vez de mentir con una certeza falsa.
// ↑ Es la función que usan la tarjeta (JobList) y el modal (JobDetailModal).
export function detectJobLanguage(job) {
  const source = job || {};
  // ↑ Si no llega ninguna oferta, se trabaja con un objeto vacío: la función
  //   nunca tira, así un dato raro no rompe el render de la lista.

  const desc = countLangSignals(source.description);
  const title = countLangSignals(source.title);
  // ↑ Se cuentan por separado para poder PONDERARlos distinto: la descripción vale
  //   70% y el título 30% (ver DESCRIPTION_WEIGHT / TITLE_WEIGHT arriba).

  const es = desc.es * DESCRIPTION_WEIGHT + title.es * TITLE_WEIGHT;
  const en = desc.en * DESCRIPTION_WEIGHT + title.en * TITLE_WEIGHT;
  const foreign = desc.foreign + title.foreign;
  // ↑ Señales de "otro idioma". No eligen el idioma (el usuario pidió solo es/en),
  //   solo sirven para bajar la confianza si llegan a dominar el texto.
  const total = es + en;
  // ↑ "total" es la cantidad de evidencia acumulada, ya ponderada.

  const margin = total > 0 ? (es - en) / total : 0;
  // ↑ El margen va de -1 (todo inglés) a +1 (todo castellano) pasando por 0
  //   (empate). Es un número entre -1 y 1 y no depende del largo del texto, así
  //   una descripción gigante no "pesa" más que una corta: pesa lo mismo.

  // ---- REGLA DE DESEMPATE (documentada a propósito) ----
  // Cuando el margen es ~0 no hay ganador, así que se desempata en este orden:
  //   1) el idioma con más señales en la DESCRIPCIÓN (que es la parte que manda),
  //   2) si ahí también hay empate, el que tenga más señales en el TÍTULO,
  //   3) si tampoco, castellano, que es el idioma de la propia interfaz: entre las
  //      dos opciones es la menos sorprendente para el usuario que está mirando.
  // ↓
  let lang = margin > 0 ? 'es' : 'en';
  if (Math.abs(margin) <= TIE_MARGIN) {
    if (desc.es !== desc.en) lang = desc.es > desc.en ? 'es' : 'en';
    else if (title.es !== title.en) lang = title.es > title.en ? 'es' : 'en';
    else lang = 'es';
  }

  // ---- CONFIANZA ----
  // Es (cuánta diferencia hubo) × (cuánta evidencia hubo). Los dos factores hacen
  // falta: con 1 sola palabra suelta la diferencia es total (margen 1) pero la
  // evidencia es nula, y decir "ES" con toda seguridad ahí sería mentira.
  let confidence = Math.abs(margin) * Math.min(1, total / LANG_MIN_EVIDENCE);
  if (total === 0) confidence = 0;
  // ↑ Sin ni una palabra funcional (ej. el título pelado "QA Automation Engineer")
  //   no hay nada que decidir: se devuelve el idioma de la interfaz pero con
  //   confianza 0, y la interfaz lo muestra atenuado diciendo que es una estimación.
  if (foreign > Math.max(es, en)) confidence = Math.min(confidence, FOREIGN_CONFIDENCE_CAP);
  // ↑ Si el texto está claramente en un idioma que NO es es/en, la confianza se
  //   topa (no se cambia la etiqueta: el usuario pidió solo estos dos idiomas) y
  //   la interfaz lo muestra atenuado. Germanas como "Testingenieur:in ..." o
  //   "Werkstudent (m/w/d)" caen acá: es una aproximación, no una traducción.

  return {
    lang,
    confidence,
    weak: confidence < LANG_LOW_CONFIDENCE,
    // ↑ 'weak' ya viene calculado con el umbral, así los dos componentes que
    //   muestran la etiqueta no reimplementan la regla.
    source: desc.es + desc.en > 0 ? 'descripcion' : 'titulo',
    // ↑ De dónde salió la decisión, para poder explicarlo si hay que medir.
  };
}

const langCache = new Map();
// ↑ CACHÉ DE RESULTADOS. Por qué hace falta: JobList se vuelve a dibujar en cada
//   cambio de tema, al abrir/cerrar el modal, al cambiar de página y al ordenar.
//   Sin caché, cada dibujado volvería a limpiar y tokenizar las ~220 descripciones
//   largas del historial: trabajo puro de CPU repetido muchas veces por segundo.
//   Solo se escribe desde acá, es privado del módulo, así que es seguro.
const LANG_CACHE_MAX = 2000;
// ↑ Techo de seguridad: si algún día se acumulan más entradas (búsquedas en vivo
//   con ids siempre nuevos), se vacía el Map. Evita que crezca sin límite.

function langCacheKey(job) {
  // ↑ Clave de la caché: el id de la oferta si viene; si no, título::empresa,
  //   que es como el propio proyecto ya identifica ofertas sin id.
  const base = job?.id ? String(job.id) : `${job?.title || ''}::${job?.company || ''}`;
  return `${base}#${(job?.description || '').length}:${(job?.title || '').length}`;
  // ↑ Los dos números al final son la HUELLA del texto. Si una oferta con el mismo
  //   id llega de nuevo pero con otra descripción (la búsqueda en vivo reemplaza el
  //   historial), la huella cambia y se recalcula: así la caché NUNCA devuelve el
  //   idioma de una oferta anterior que compartía el id. Y son solo dos números,
  //   así que el costo de verificar es despreciable.
}

// Igual que detectJobLanguage(), pero usando (y llenando) la caché de arriba.
// ↑ Esta es la que llaman los componentes: la lógica real vive en la función pura
//   de más arriba, que es la que se puede testear sin cachear nada.
export function jobLanguageInfo(job) {
  const key = langCacheKey(job);
  const cached = langCache.get(key);
  if (cached) return cached;
  // ↑ Hit de caché: se devuelve el mismo objeto, sin volver a tokenizar nada.
  const info = detectJobLanguage(job);
  if (langCache.size >= LANG_CACHE_MAX) langCache.clear();
  langCache.set(key, info);
  return info;
}

// Texto del tooltip de la etiqueta. Vive acá y no en los componentes para que la
// tarjeta y el modal digan EXACTAMENTE lo mismo.
// ↑ Igual se marca con el nombre del idioma completo ("castellano"), porque en la
//   tarjeta la sigla "ES" sola no le dice nada a quien pasa el mouse.
export function langBadgeTitle(info) {
  const name = LANG_NAME[info.lang] || '';
  if (info.confidence === 0) {
    return `No hay texto suficiente para detectar el idioma; se muestra ${name} por defecto.`;
  }
  // ↑ Confianza 0 = ni una palabra funcional en título ni descripción: el valor
  //   mostrado es el de la interfaz, no una detección. Conviene decirlo explícito.
  if (info.weak) {
    return `Oferta en ${name} (estimado: hay poco texto para confirmarlo).`;
  }
  return `Oferta en ${name} (detectado del ${info.source === 'titulo' ? 'título' : 'texto'}).`;
}

// ============================================================================
// PROCEDENCIA DE LA OFERTA: de dónde salió y adónde ir.
// ============================================================================
// Por qué vive acá y no en cada componente: el badge de portal se dibuja en la
// tarjeta (JobList) Y en el modal (JobDetailModal), y además el modal tiene que
// decidir a dónde lleva el botón principal. Si cada uno reimplementara la regla,
// el día que aparezca un portal nuevo uno de los dos queda mintiendo. Es el mismo
// criterio que ya se usa con matchClass() y la etiqueta de idioma: la decisión
// se toma UNA vez y los dos lugares la pintan igual.

const PORTAL_ICONS = {
  LinkedIn: '💼',
  Remotive: '🌍',
  Arbeitnow: '🛠️',
  Himalayas: '⛰️',
  RemoteOK: '🔌',
  Jobicy: '📡',
  Computrabajo: '📋',
  Indeed: '📰',
  InfoJobs: '🗞️',
  Glassdoor: '👀',
  OCC: '🎓',
  Demo: '🧪',
  Curada: '📌',
};
// ↑ Un icono por portal. Son emojis y no SVG a propósito: el proyecto ya los usa
//   en toda la interfaz (📍, 💰, 🕒…) y así no hay ni un <img> que cargar.

const PORTAL_LIKE = [
  { portal: 'LinkedIn', re: /linkedin/i },
  { portal: 'Demo', re: /(?:^|[^a-z0-9])demos?(?:[^a-z0-9]|$)|simulad/i },
  { portal: 'Curada', re: /curad/i },
];
// ↑ Solo los tres que se pueden deducir de `source` con confianza. El resto de
//   los portales (Remotive, Arbeitnow...) NUNCA están en `source`: llegan por
//   `portal` desde server/portal.js. Si `portal` no vino y `source` no dice nada
//   reconocible, se cae en 'Curada', que es el mismo default del backend y no
//   inventa una procedencia que nadie verificó.

// ¿Es un link usable? Filtra los tres "no links" que circulan en la base:
// vacío, '#' (ancla de navegación) y los que no son http(s).
// ↑ Es exactamente el motivo por el que 18 ofertas curadas se quedaban sin
//   destino en pantalla: la condición anterior solo miraba truthiness, y '#' es
//   truthy. Chequear el esquema además evita abrir 'javascript:...' o un 'www'
//   sin protocolo.
export function usableUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw === '#') return '';
  return /^https?:\/\//i.test(raw) ? raw : '';
}

// Nombre del portal que se muestra en el badge.
// ↑ Prioridad: `portal` (lo calcula server/portal.js con los patrones del link),
//   después lo que se pueda deducir de `source`, y al final 'Curada'. El `source`
//   legacy ("Reclutador (LinkedIn)", "Directo (link)") NO se muestra como nombre
//   de portal: es texto libre y hay 44 variantes distintas.
export function portalLabel(job) {
  const explicit = typeof job?.portal === 'string' ? job.portal.trim() : '';
  if (explicit) return explicit;
  const source = String(job?.source || '');
  for (const { portal, re } of PORTAL_LIKE) {
    if (re.test(source)) return portal;
  }
  return 'Curada';
}

// Todo lo que la interfaz necesita saber del portal en una sola llamada:
// el nombre, la clase CSS (derivada del nombre, así un portal nuevo se estiliza
// solo con la clase genérica) y el icono.
export function portalInfo(job) {
  const name = portalLabel(job);
  return {
    name,
    icon: PORTAL_ICONS[name] || '🔗',
    // ↓ 'linkedin' / 'remoteok' / 'curada': minúsculas y sin espacios ni acentos,
    //   para poder escribir `portal-linkedin` en el CSS sin clases rarísimas.
    slug: name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-'),
  };
}

// Destino de una oferta: SIEMPRE el mejor disponible, nunca undefined.
// ↑ Este es el fix de "no me da el link que me lleve a la búsqueda": la función
//   tiene una sola regla de prioridad y la usan los dos componentes, así que una
//   oferta sin `applyUrl` igual cae a `sourceUrl` y solo se queda sin destino si
//   de verdad no hay ningún link en toda la base.
export function jobDestination(job, { langIsEn = false } = {}) {
  const applyUrl = usableUrl(job?.applyUrl);
  const sourceUrl = usableUrl(job?.sourceUrl);
  const portal = portalInfo(job).name;
  if (applyUrl) {
    return {
      url: applyUrl,
      kind: 'apply',
      label: langIsEn ? `Apply on ${portal}` : `Aplicar en ${portal}`,
      icon: '🔗',
      title: langIsEn
        ? `Open the job offer at ${portal} in a new tab`
        : `Abrir la oferta en ${portal} (se abre en otra pestaña)`,
    };
  }
  if (sourceUrl) {
    return {
      url: sourceUrl,
      kind: 'search',
      label: langIsEn ? `Search on ${portal}` : `Buscar en ${portal}`,
      icon: '🔎',
      // ↑ NO es el link de la oferta sino la página de búsqueda del portal: por
      //   eso el texto lo dice explícito, para no hacer creer que se abre la
      //   publicación cuando en realidad se abre cómo encontrarla.
      title: langIsEn
        ? `This job has no direct link; open the ${portal} search to find it`
        : `Esta oferta no tiene link directo: abrí la búsqueda en ${portal} para encontrarla`,
    };
  }
  return null;
  // ↑ Sin ningún link: el llamador TIENE que decirlo en pantalla (no esconder el
  //   botón en silencio), porque si no el usuario no entiende qué pasó.
}

// Texto honesto para cuando no hay ningún destino posible.
// ↑ Se muestra explícitamente en vez de no renderizar nada: 18 de las 57 ofertas
//   curadas están en este caso, y un botón que aparece y desaparece según la
//   oferta hace pensar que la app falló.
export function noDestinationText(job, { langIsEn = false } = {}) {
  const portal = portalInfo(job).name;
  if (langIsEn) return `No direct link for this job: contact ${portal} directly.`;
  return `Sin link directo: contactá por ${portal}.`;
}

// Convierte una fecha (timestamp) en "cuántos días pasaron desde esa fecha".
// Útil para el historial: "Vista hace 3 días", "Vista hoy", etc.
// ↑ Ejemplo: si `ts` es el instante de hace 3 días, devuelve 3.
//   Si no hay fecha guardada (undefined, null, 0), devuelve null y listo.
export function daysAgo(ts) {
  // ↑ `!ts` es true con null, undefined, 0 o ""; en todos esos casos no hay fecha.
  if (!ts) return null;
  // Resta el timestamp guardado al tiempo actual y divide por los ms de un día.
  // ↑ Math.floor() redondea hacia abajo: 3 días y 2 horas dan 3, nunca 3.08.
  return Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
}

// "Actualizado hace 3 minutos / hace 2 horas / hace 6 días".
// ↑ NO existe daysAgo() para esto: daysAgo redondea a días enteros, y para la
//   hora del scrape eso serviría solo a partir de las 24 h, cuando al usuario le
//   importa justo lo contrario ("¿la busqué hace un minuto o hace tres días?").
//   Acepta las tres formas que puede mandar el backend: ISO ('2026-09-29T18:09'),
//   epoch en milisegundos (checkedAt de algunas fuentes) o epoch en segundos.
//   Devuelve null si no hay fecha o no se puede parsear, para que quien llame
//   decida si muestra nada o un texto genérico. No es memoizable a propósito: son
//   lecturas de reloj, y llamarlo una vez por render es exactamente lo que se
//   quiere (el texto tiene que envejecer mientras la pestaña está abierta).
export function timeAgo(value) {
  const raw = typeof value === 'string' ? value.trim() : value;
  if (raw === null || raw === undefined || raw === '') return null;
  // ↑ 'String(raw).trim()' convierte cualquier tipo a texto, pero acá se descarta
  //   el caso vacío explícitamente porque Date.parse('') da NaN igual.
  let ts = NaN;
  if (typeof raw === 'number') ts = raw < 1e12 ? raw * 1000 : raw;
  // ↑ 10 dígitos = segundos, 13 dígitos = milisegundos (mismo criterio que
  //   formatDisplayDate y publicationTimestamp, para no tener tres reglas).
  else if (/^\d{10,13}$/.test(raw)) {
    const numeric = Number(raw);
    ts = numeric < 1e12 ? numeric * 1000 : numeric;
  } else ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return null;
  // ↑ NaN es la señal de "esto no es una fecha": se devuelve null en vez de
  //   "hace NaN minutos", que es lo que se ve si no se chequea.

  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  // ↑ Math.max(0, ...) porque un reloj de la máquina atrasado daría negativos
  //   ("hace -3 minutos"), que es peor que decir "recién" cuando no es así.
  if (seconds < 60) return 'hace instantes';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} minuto${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} hora${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día${days === 1 ? '' : 's'}`;
}

// ↑ Convierte cualquier fecha que mande el backend en texto legible en español:
//   "2026-03-14" -> "14 de mar de 2026". Devuelve null si no hay fecha, y el
//   texto ORIGINAL si la fecha es inválida (mejor mostrar algo raro que nada).
export function formatDisplayDate(value) {
  // ↑ Puede llegar la fecha de tres formas distintas, y hay que reconocerlas.
  if (!value) return null;
  // ↑ Lo pasamos a texto, le sacamos los espacios y probamos si es un número
  //   (por si lo que llegó fue un timestamp y no una fecha).
  const raw = String(value).trim();
  const numeric = Number(raw);
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  // ↑ Regex: ¿el texto tiene forma "AAAA-MM-DD"? Si sí, captura año, mes y día.
  const date = dateOnly
    // ↑ new Date(año, mes, día): OJO, en JavaScript los meses arrancan en 0
    //   (enero=0), por eso al mes se le resta 1.
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    // ↑ Si no es "AAAA-MM-DD", puede ser un timestamp de Unix ("1739...").
    : /^\d{10,13}$/.test(raw)
      // ↑ 10 dígitos = segundos y 13 dígitos = milisegundos. El 1e12 es un
      //   billón: si el número es menor, viene en segundos y hay que x1000.
      ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
      // ↑ Si no matchea con nada de lo anterior, se lo dejamos a new Date()
      //   ("hace 3 días", "14/03/2026", etc.).
      : new Date(raw);
  // ↑ Si igual no es una fecha válida, devolvemos el texto tal cual llegó.
  if (Number.isNaN(date.getTime())) return raw;
  // ↑ Intl.DateTimeFormat con locale 'es-AR' escribe la fecha como se escribe
  //   en Argentina: día + mes abreviado + año.
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

// LinkedIn no tiene API pública de empleos (solo para partners aprobados) y
// scrapearlo viola sus términos de uso. En vez de traer resultados
// automáticos, armamos un link directo a la búsqueda ya filtrada para que
// el usuario la abra y revise con su propia cuenta.
// ↑ Esa es la decisión de diseño de esta parte del proyecto: no se automatiza
//   nada contra LinkedIn, se abre la búsqueda ya filtrada y la revisa la persona.

// Mapa región -> texto de ubicación que entiende la URL de LinkedIn.
// ↑ Traduce la clave interna de la región (argentina, europa...) al texto de
//   país/área que LinkedIn espera en el parámetro `location`. Sin este mapa, el
//   link tendría que mandar "argentina" tal cual y LinkedIn no lo reconocería.
export const REGION_LOCATION = {
  argentina: 'Argentina',
  europa: 'Europe',
  eeuu: 'United States',
  mexico: 'México',
  peru: 'Perú',
  colombia: 'Colombia',
  chile: 'Chile',
};

// ↑ Convierte el perfil del candidato en la consulta de búsqueda de LinkedIn y
//   devuelve algo como '(qa OR "quality assurance" OR automation)'.
export function linkedinProfileKeywords(profile) {
  // ↑ El `?.` es "optional chaining": si `profile` no existe, da undefined en
  //   vez de romper. Con `|| []` nos aseguramos una lista vacía.
  const roleTerms = Array.isArray(profile?.keywords) ? profile.keywords : [];
  // ↑ Parte 1: los nombres del puesto, tal como están en PROFILE.keywords.
  const skillTerms = Object.entries(profile?.skills || {})
    // ↑ Object.entries() convierte el objeto skills en pares [nombre, peso].
    .filter(([name, weight]) => Number(weight) >= 0.9 && /(qa|quality|test|automation)/i.test(name))
    // ↑ Filtro: solo los skills de peso alto (>= 0.9) Y cuyo nombre hable de
    //   QA/testing. Si no, el link repetiría palabras irrelevantes.
    .map(([name]) => name);
  // ↑ Quedarnos solo con el nombre del skill: el peso ya no se usa.
  const uniqueTerms = new Map();
  // ↑ Map usado como lista SIN repetidos que además recuerda la primera forma
  //   en que se escribió cada término (clave = minúsculas, valor = original).

  for (const term of [...roleTerms, ...skillTerms]) {
    // ↑ Recorremos los dos grupos juntos: primero los roles, después los skills.
    if (typeof term !== 'string' || !term.trim() || /^sdft$/i.test(term.trim())) continue;
    // ↑ `continue` salta a la próxima vuelta: acá descartamos lo que no sea
    //   texto, lo vacío y el typo "sdft" que viene del backend.
    const normalized = term.trim().toLowerCase();
    // ↑ La clave del Map va en minúsculas (para comparar), pero el valor guarda
    //   el término como estaba escrito (para que se lea bien en la URL).
    if (!uniqueTerms.has(normalized)) uniqueTerms.set(normalized, term.trim());
    // ↑ Si ya estaba esa clave, no lo agregamos otra vez: así no repetimos.
  }

  const terms = [...uniqueTerms.values()].map((term) => (
    // ↑ Las frases de varias palabras van entre comillas: en LinkedIn, "qa
    //   engineer" busca la frase exacta; qa engineer busca una de las dos.
    /\s/.test(term) ? `"${term}"` : term
  ));
  // ↑ Si al final no quedó ningún término usable, usamos una consulta fija.
  return terms.length ? `(${terms.join(' OR ')})` : '"QA Engineer" OR automation';
}

// Arma una búsqueda directa de LinkedIn, limitada a publicaciones de los últimos 30 días.
// ↑ Devuelve la URL ya armada; los tres datos van en un objeto que
//   URLSearchParams convierte en la parte "?clave=valor&...".
export function linkedinSearchUrl(keywords, region) {
  const params = new URLSearchParams({
    keywords,
    // ↑ Si la región no está en el mapa, mandamos vacío: LinkedIn busca en todas.
    location: REGION_LOCATION[region] || '',
    // ↑ f_TPR es el filtro de "publicado en los últimos N segundos" de LinkedIn
    //   (30 días expresados en segundos). Es un parámetro propio de su sitio.
    f_TPR: `r${30 * 24 * 60 * 60}`,
  });
  // ↑ URLSearchParams codifica los parámetros de forma segura (espacios, tildes, etc.).
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

// Igual que con LinkedIn: no scrapeamos el sitio de cada consultora ni sabemos
// si tiene una sección "empleos" con una URL predecible (cada una es distinta).
// En vez de eso armamos una búsqueda de Google acotada a su dominio (site:) con
// las keywords del perfil + "empleos", así el link de cada consultora cumple la
// MISMA función que el botón de LinkedIn: abrir una búsqueda ya filtrada, sin
// necesidad de que el usuario googlee todo de nuevo.
// ↑ Ojo con el nombre: esta función NO trae ofertas al frontend. Solo arma el
//   link para que se abra en el navegador del usuario.
export function consultoraSearchUrl(link, keywords) {
  // ↑ Devuelve una búsqueda de Google acotada al sitio de la consultora.
  let dominio = '';
  // ↑ `let` (y no const) porque el valor se reasigna en los dos caminos del try.
  try {
    dominio = new URL(link).hostname.replace(/^www\./, '');
    // ↑ Sacamos el "www." para que el site: search sea más amplio (incluye subdominios).
  } catch {
    // ↑ Si el link no es una URL válida, new URL() lanza un error y caemos acá:
    //   dejamos el dominio vacío y después buscamos sin el filtro de sitio.
    dominio = '';
  }
  const query = dominio
    // ↑ `site:ejemplo.com` es un operador de Google: solo páginas de ese sitio.
    ? `site:${dominio} (empleo OR empleos OR vacante OR "trabajá con nosotros") ${keywords}`
    // ↑ Sin dominio no se puede usar site:, así que buscamos las keywords sueltas.
    : `${keywords} empleos`;
  const params = new URLSearchParams({ q: query });
  // ↑ `q` es el parámetro de búsqueda de Google. URLSearchParams se encarga de
  //   escapar los paréntesis y las comillas para que no rompan la URL.
  return `https://www.google.com/search?${params.toString()}`;
}

// Mapas categoría de consultora -> clase CSS que da el color del pill.
// La categoría viene del backend, la clase se resuelve con un lookup.
// ↑ "Lookup" = buscador texto -> valor: la categoría exacta que manda el backend
//   se transforma en la clase CSS del color. Si algún día llega una categoría
//   nueva que no está en este mapa, no hay clase y el pill queda sin color.
export const CATEGORY_CLASS = {
  'Especializada en QA': 'cat-qa',
  // ↑ Cada clave es el texto EXACTO que devuelve el backend; por eso van entre
  //   comillas (tienen espacios) y el acierto tiene que ser literal.
  'Consultora IT con área QA': 'cat-it',
  'Multinacional con oficina AR': 'cat-multi',
  'Staffing / recruiting IT': 'cat-staffing',
  'Banco / Fintech / Billetera': 'cat-fintech',
  'Gobierno / Sector Público': 'cat-gov',
};
