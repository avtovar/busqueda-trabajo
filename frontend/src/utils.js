// Devuelve la clase CSS que pinta el color del % de match según el score.
// Verde = match alto (>=75), amarillo = medio (>=50), rojo = bajo.
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
export function daysAgo(ts) {
  if (!ts) return null;
  // Resta el timestamp guardado al tiempo actual y divide por los ms de un día.
  return Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
}

export function formatDisplayDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const numeric = Number(raw);
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : /^\d{10,13}$/.test(raw)
      ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
      : new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

// LinkedIn no tiene API pública de empleos (solo para partners aprobados) y
// scrapearlo viola sus términos de uso. En vez de traer resultados
// automáticos, armamos un link directo a la búsqueda ya filtrada para que
// el usuario la abra y revise con su propia cuenta.

// Mapa región -> texto de ubicación que entiende la URL de LinkedIn.
export const REGION_LOCATION = {
  argentina: 'Argentina',
  europa: 'Europe',
  eeuu: 'United States',
  mexico: 'México',
  peru: 'Perú',
  colombia: 'Colombia',
  chile: 'Chile',
};

export function linkedinProfileKeywords(profile) {
  const roleTerms = Array.isArray(profile?.keywords) ? profile.keywords : [];
  const skillTerms = Object.entries(profile?.skills || {})
    .filter(([name, weight]) => Number(weight) >= 0.9 && /(qa|quality|test|automation)/i.test(name))
    .map(([name]) => name);
  const uniqueTerms = new Map();

  for (const term of [...roleTerms, ...skillTerms]) {
    if (typeof term !== 'string' || !term.trim() || /^sdft$/i.test(term.trim())) continue;
    const normalized = term.trim().toLowerCase();
    if (!uniqueTerms.has(normalized)) uniqueTerms.set(normalized, term.trim());
  }

  const terms = [...uniqueTerms.values()].map((term) => (
    /\s/.test(term) ? `"${term}"` : term
  ));
  return terms.length ? `(${terms.join(' OR ')})` : '"QA Engineer" OR automation';
}

// Arma una búsqueda directa de LinkedIn, limitada a publicaciones de los últimos 30 días.
export function linkedinSearchUrl(keywords, region) {
  const params = new URLSearchParams({
    keywords,
    location: REGION_LOCATION[region] || '',
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
export function consultoraSearchUrl(link, keywords) {
  let dominio = '';
  try {
    dominio = new URL(link).hostname.replace(/^www\./, '');
    // ↑ Sacamos el "www." para que el site: search sea más amplio (incluye subdominios).
  } catch {
    dominio = '';
  }
  const query = dominio
    ? `site:${dominio} (empleo OR empleos OR vacante OR "trabajá con nosotros") ${keywords}`
    : `${keywords} empleos`;
  const params = new URLSearchParams({ q: query });
  return `https://www.google.com/search?${params.toString()}`;
}

// Mapas categoría de consultora -> clase CSS que da el color del pill.
// La categoría viene del backend, la clase se resuelve con un lookup.
export const CATEGORY_CLASS = {
  'Especializada en QA': 'cat-qa',
  'Consultora IT con área QA': 'cat-it',
  'Multinacional con oficina AR': 'cat-multi',
  'Staffing / recruiting IT': 'cat-staffing',
  'Banco / Fintech / Billetera': 'cat-fintech',
  'Gobierno / Sector Público': 'cat-gov',
};