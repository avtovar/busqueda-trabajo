// Fuentes de ofertas ACCESIBLES y ESTABLES (APIs públicas / JSON, sin autenticación).
// Verificadas como funcionales: Remotive, Arbeitnow (Europa) y Himalayas (remote global).
// Evita bolsas que bloquean scraping (LinkedIn, Indeed, WeWorkRemotely HTML).
import { PROFILE } from './cvProfile.js';

export const BASE_KEYWORDS = ['qa', 'quality', 'tester', 'test', 'automation', 'sdet'];

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (job-search-app; +https://github.com/avtovar)' };
const REQ_TIMEOUT = 20000;

async function getJSON(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function clean(str = '') {
  return String(str).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tagsOf(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((t) => clean(String(t)).toLowerCase()).filter(Boolean);
}

function firstSalary(j) {
  const lo = j.salary_min ?? j.minSalary;
  const hi = j.salary_max ?? j.maxSalary;
  if (!lo && !hi) return '';
  const cur = j.currency || 'USD';
  return `${cur} ${lo || ''}${hi ? ' - ' + hi : ''}`.trim();
}

/* ----------------------- Remotive (remote global, tech) ------------------- */
// Antes solo buscaba "qa" y se perdían ofertas tituladas "Tester", "SDET",
// "Automation Engineer", etc. Ahora busca varios términos en paralelo y
// deduplica por id de Remotive.
const REMOTIVE_TERMS = ['qa', 'tester', 'sdet', 'automation', 'quality assurance'];

function mapRemotiveJob(j) {
  return {
    id: `remotive-${j.id}`,
    source: 'Remotive',
    title: clean(j.title),
    company: clean(j.company_name),
    location: clean(j.candidate_required_location) || 'Remote',
    regionGuess: guessRegionFromText(`${j.candidate_required_location} ${j.tags}`),
    applyUrl: j.url || j.application_url || '',
    description: clean(j.description),
    tags: tagsOf(j.tags),
    salary: j.salary && clean(j.salary) ? clean(j.salary) : '',
    date: j.publication_date || '',
  };
}

async function fetchRemotive() {
  const results = await Promise.allSettled(
    REMOTIVE_TERMS.map((term) => getJSON(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(term)}`))
  );
  const seen = new Set();
  const jobs = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const j of (r.value && r.value.jobs) || []) {
      if (seen.has(j.id)) continue;
      seen.add(j.id);
      jobs.push(mapRemotiveJob(j));
    }
  }
  return jobs;
}

/* --------------------- Arbeitnow (Europa / global dev) -------------------- */
// La API pagina de a ~100 ofertas; traemos 2 páginas para no perder ofertas QA
// que suelen quedar diluidas entre ofertas de desarrollo.
async function fetchArbeitnow() {
  const pages = await Promise.allSettled([
    getJSON('https://www.arbeitnow.com/api/job-board-api'),
    getJSON('https://www.arbeitnow.com/api/job-board-api?page=2'),
  ]);
  const jobs = [];
  for (const p of pages) {
    if (p.status === 'fulfilled' && Array.isArray(p.value?.data)) jobs.push(...p.value.data);
  }
  return jobs.map((j) => ({
    id: `arbeitnow-${j.slug || j.id}`,
    source: 'Arbeitnow',
    title: clean(j.title),
    company: clean(j.company_name),
    location: clean(j.location),
    regionGuess: guessRegionFromText(j.location),
    applyUrl: j.url || `https://www.arbeitnow.com/jobs/${j.slug}`,
    description: clean(j.description),
    tags: tagsOf(j.tags),
    salary: firstSalary(j),
    date: j.created_at || '',
  }));
}

/* ------------------- Himalayas (remote global, por país) ------------------- */
async function fetchHimalayas() {
  const data = await getJSON('https://himalayas.app/jobs/api/search?q=qa&limit=20');
  const jobs = (data && data.jobs) || [];
  return jobs.map((j) => ({
    id: `himalaya-${j.guid || j.slug || Math.random()}`,
    source: 'Himalayas',
    title: clean(j.title),
    company: clean(j.companyName || j.company),
    location: (j.locationRestrictions || []).join(', ') || (j.city || 'Remote'),
    regionGuess: guessRegionFromText((j.locationRestrictions || []).join(', ')),
    applyUrl: j.applicationLink || j.url || '',
    description: clean(j.description),
    tags: tagsOf(j.categories || j.tags),
    salary: firstSalary(j),
    date: j.pubDate ? new Date(j.pubDate * 1000).toISOString() : '',
  }));
}

/* --------------------------- RemoteOK (remote global) ---------------------- */
// La API no tiene parámetro de búsqueda: devuelve el feed completo y el primer
// elemento es un aviso legal (sin campo "id"), hay que filtrarlo.
async function fetchRemoteOK() {
  const data = await getJSON('https://remoteok.com/api');
  const jobs = Array.isArray(data) ? data.filter((j) => j && j.id) : [];
  return jobs
    .filter((j) => {
      const text = `${j.position || ''} ${(j.tags || []).join(' ')}`.toLowerCase();
      return BASE_KEYWORDS.some((k) => text.includes(k));
    })
    .map((j) => ({
      id: `remoteok-${j.id}`,
      source: 'RemoteOK',
      title: clean(j.position),
      company: clean(j.company),
      location: clean(j.location) || 'Remote',
      regionGuess: guessRegionFromText(j.location),
      applyUrl: j.url ? `https://remoteok.com${j.url}` : (j.apply_url || ''),
      description: clean(j.description),
      tags: tagsOf(j.tags),
      salary: firstSalary(j),
      date: j.date || '',
    }));
}

/* ---------------------------- Jobicy (remote global) ------------------------ */
async function fetchJobicy() {
  const data = await getJSON('https://jobicy.com/api/v2/remote-jobs?count=50&tag=qa');
  const jobs = (data && data.jobs) || [];
  return jobs.map((j) => ({
    id: `jobicy-${j.id}`,
    source: 'Jobicy',
    title: clean(j.jobTitle),
    company: clean(j.companyName),
    location: clean(j.jobGeo) || 'Remote',
    regionGuess: guessRegionFromText(j.jobGeo),
    applyUrl: j.url || '',
    description: clean(j.jobExcerpt || j.jobDescription),
    tags: tagsOf(j.jobIndustry || j.jobType),
    salary: (j.annualSalaryMin || j.annualSalaryMax)
      ? `${j.salaryCurrency || 'USD'} ${j.annualSalaryMin || ''}${j.annualSalaryMax ? ' - ' + j.annualSalaryMax : ''}`.trim()
      : '',
    date: j.pubDate || '',
  }));
}

/* -------------------- Clasificación de región (mejorada) ------------------- */
// Detecta si el texto de ubicación pertenece a Argentina, Europa o EEUU.
export function guessRegionFromText(text) {
  const t = ` ${text || ''} `.toLowerCase();
  const arg = /\b(argentina|buenos aires|bs as|capital federal|mar del plata|rosario|cordoba)\b/;
  const us = /\b(usa|united states|new york|san francisco|los angeles|remote[- ]?us|us only|texas|california)\b/;
  const eu = /\b(spain|espana|madrid|barcelona|germany|berlin|france|paris|netherlands|amsterdam|uk|united kingdom|london|ireland|dublin|portugal|lisbon|remoto|remote eu)\b/;
  const mx = /\b(mexico|mexico|cdmx|ciudad de mexico|queretaro|guadalajara|monterrey|puebla)\b/;
  const pe = /\b(peru|peru|lima)\b/;
  const co = /\b(colombia|bogota|barranquilla|medellin|cali)\b/;
  const cl = /\b(chile|santiago|las condes|providencia|valparaiso|concepcion)\b/;
  if (arg.test(t)) return 'argentina';
  if (us.test(t)) return 'eeuu';
  if (eu.test(t)) return 'europa';
  if (mx.test(t)) return 'mexico';
  if (pe.test(t)) return 'peru';
  if (co.test(t)) return 'colombia';
  if (cl.test(t)) return 'chile';
  // Default: remoto deslocalizado suele ser oportunidad para Argentina/global; lo dejamos eeuu (remote global)
  return 'eeuu';
}

// Clave de deduplicación: mismo título + misma empresa suele ser la misma
// oferta publicada en varias bolsas (muy común entre Remotive/RemoteOK/Jobicy).
function dedupeKey(job) {
  return `${job.title}::${job.company}`.toLowerCase().replace(/[^a-z0-9:]+/g, ' ').trim();
}

/* --------------------------- Agregador maestro --------------------------- */
export async function fetchJobs() {
  const results = await Promise.allSettled([
    fetchRemotive(),
    fetchArbeitnow(),
    fetchHimalayas(),
    fetchRemoteOK(),
    fetchJobicy(),
  ]);
  const seen = new Set();
  const jobs = [];
  for (const r of results) {
    if (r.status !== 'fulfilled' || !Array.isArray(r.value)) continue;
    for (const job of r.value) {
      const key = dedupeKey(job);
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push(job);
    }
  }
  return jobs;
}

// ¿Una oferta es relevante para el perfil QA? (al menos un keyword en título/tags)
export function isRelevant(job) {
  const text = `${job.title} ${job.tags.join(' ')}`.toLowerCase();
  return BASE_KEYWORDS.some((k) => text.includes(k));
}
