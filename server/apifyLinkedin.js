import { PROFILE } from './cvProfile.js';
import { rankByRegion } from './matcher.js';

const REGION_LOCATIONS = {
  argentina: 'Argentina',
  mexico: 'México',
  peru: 'Perú',
  colombia: 'Colombia',
  chile: 'Chile',
  europa: 'Europe',
  eeuu: 'United States',
};

const MAX_RESULTS = 50;
const DAYS_BACK = 30;

function buildProfileKeywords() {
  const terms = new Map();
  const roleKeywords = (PROFILE.keywords || []).filter((term) => (
    /(qa|quality|test|automation|sdet)/i.test(term) && !/^sdft$/i.test(term)
  ));
  const coreSkills = Object.entries(PROFILE.skills || {})
    .filter(([name, weight]) => Number(weight) >= 0.9 && /(qa|quality|test|automation)/i.test(name))
    .map(([name]) => name);

  for (const term of [...roleKeywords, ...coreSkills]) {
    const normalized = term.trim().toLowerCase();
    if (normalized && !terms.has(normalized)) terms.set(normalized, term.trim());
  }

  return [...terms.values()]
    .map((term) => (/\s/.test(term) ? `"${term}"` : term))
    .join(' OR ');
}

function searchUrl(region) {
  const url = new URL('https://www.linkedin.com/jobs/search/');
  url.searchParams.set('position', '1');
  url.searchParams.set('pageNum', '0');
  url.searchParams.set('keywords', `(${buildProfileKeywords()})`);
  url.searchParams.set('location', REGION_LOCATIONS[region]);
  url.searchParams.set('f_TPR', `r${DAYS_BACK * 24 * 60 * 60}`);
  return url.toString();
}

function asText(value) {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(' · ');
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function normalizeDate(job) {
  const raw = job.postedAtTimestamp ?? job.postedAt ?? job.date ?? '';
  if (!raw) return '';
  const numeric = Number(raw);
  const date = Number.isFinite(numeric) && /^\d+$/.test(String(raw))
    ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
    : new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function mapJob(job, region) {
  const title = asText(job.title);
  const company = asText(job.companyName || job.company);
  const link = asText(job.link || job.jobUrl || job.applyUrl);
  if (!title || !company || !link) return null;

  const description = asText(job.descriptionText)
    || asText(job.descriptionHtml).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const tags = [
    ...(Array.isArray(job.tags) ? job.tags.map(asText) : []),
    asText(job.seniorityLevel),
    asText(job.employmentType),
    asText(job.jobFunction),
    asText(job.industries),
  ].filter(Boolean);
  const salary = asText(job.salaryInfo || job.salary);
  const date = normalizeDate(job);

  if (date && Date.now() - new Date(date).getTime() > DAYS_BACK * 24 * 60 * 60 * 1000) return null;

  return {
    id: `linkedin-${asText(job.id || job.jobId) || link}`,
    source: 'LinkedIn / Apify',
    title,
    company,
    location: asText(job.location) || REGION_LOCATIONS[region],
    regionGuess: region,
    applyUrl: asText(job.applyUrl) || link,
    description,
    tags,
    salary,
    date,
  };
}

function httpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

export async function searchLinkedInWithApify(region) {
  if (!REGION_LOCATIONS[region]) throw httpError('Región no válida.', 400);
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw httpError('Falta APIFY_API_TOKEN. Configúralo en el archivo local .env y reinicia el servidor.', 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 190_000);
  let response;
  try {
    response = await fetch(
      'https://api.apify.com/v2/acts/curious_coder~linkedin-jobs-scraper/run-sync-get-dataset-items?format=json&clean=true&timeout=180',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          urls: [searchUrl(region)],
          limitPerSource: MAX_RESULTS,
          autoConvertToAiSearch: true,
          scrapeCompany: false,
          splitByLocation: false,
        }),
        signal: controller.signal,
      }
    );
  } catch (error) {
    if (error.name === 'AbortError') throw httpError('Apify tardó demasiado en responder. Prueba de nuevo más tarde.', 504);
    throw httpError('No se pudo conectar con Apify.', 502);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 || response.status === 403) {
    throw httpError('Apify rechazó el token. Revísalo en el archivo local .env.', 502);
  }
  if (response.status === 402) {
    throw httpError('Apify no tiene saldo disponible para ejecutar esta búsqueda.', 402);
  }
  if (!response.ok) throw httpError(`El actor de Apify respondió con error HTTP ${response.status}.`, 502);

  let items;
  try {
    items = await response.json();
  } catch {
    throw httpError('Apify devolvió una respuesta que no es JSON válido.', 502);
  }
  if (!Array.isArray(items)) throw httpError('Apify devolvió un formato de resultados inesperado.', 502);

  const unique = new Map();
  for (const item of items) {
    const job = mapJob(item, region);
    if (job && !unique.has(job.id)) unique.set(job.id, job);
  }

  const ranked = rankByRegion([...unique.values()]);
  const jobs = ranked[region] || [];
  return {
    region,
    jobs,
    total: jobs.length,
    _online: true,
    source: 'LinkedIn / Apify',
    checkedAt: new Date().toISOString(),
    resultLimit: MAX_RESULTS,
  };
}