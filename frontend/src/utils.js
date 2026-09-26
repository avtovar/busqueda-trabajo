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
