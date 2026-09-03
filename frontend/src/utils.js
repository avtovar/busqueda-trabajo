export function matchClass(score) {
  if (score >= 75) return 'match-high';
  if (score >= 50) return 'match-mid';
  return 'match-low';
}

export function daysAgo(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
}

// LinkedIn no tiene API pública de empleos (solo para partners aprobados) y
// scrapearlo viola sus términos de uso. En vez de traer resultados
// automáticos, armamos un link directo a la búsqueda ya filtrada para que
// el usuario la abra y revise con su propia cuenta.
export const REGION_LOCATION = {
  argentina: 'Argentina',
  europa: 'Europe',
  eeuu: 'United States',
  mexico: 'México',
  peru: 'Perú',
  colombia: 'Colombia',
  chile: 'Chile',
};

export function linkedinSearchUrl(keywords, region) {
  const params = new URLSearchParams({ keywords, location: REGION_LOCATION[region] || '' });
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

export const CATEGORY_CLASS = {
  'Especializada en QA': 'cat-qa',
  'Consultora IT con área QA': 'cat-it',
  'Multinacional con oficina AR': 'cat-multi',
  'Staffing / recruiting IT': 'cat-staffing',
  'Banco / Fintech / Billetera': 'cat-fintech',
  'Gobierno / Sector Público': 'cat-gov',
};
