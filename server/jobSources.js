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
async function fetchRemotive() {
  const data = await getJSON('https://remotive.com/api/remote-jobs?search=qa');
  const jobs = (data && data.jobs) || [];
  return jobs.map((j) => ({
    id: `remotive-${j.id}`,
    source: 'Remotive',
    title: clean(j.title),
    company: clean(j.company_name),
    location: clean(j.candidate_required_location || j.candidate_required_location) || 'Remote',
    regionGuess: guessRegionFromText(`${j.candidate_required_location} ${j.tags}`),
    applyUrl: j.url || j.application_url || '',
    description: clean(j.description),
    tags: tagsOf(j.tags),
    salary: j.salary && clean(j.salary) ? clean(j.salary) : '',
    date: j.publication_date || '',
  }));
}

/* --------------------- Arbeitnow (Europa / global dev) -------------------- */
async function fetchArbeitnow() {
  const data = await getJSON('https://www.arbeitnow.com/api/job-board-api');
  const jobs = (data && data.data) || [];
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

/* -------------------- Clasificación de región (mejorada) ------------------- */
// Detecta si el texto de ubicación pertenece a Argentina, Europa o EEUU.
export function guessRegionFromText(text) {
  const t = ` ${text || ''} `.toLowerCase();
  const arg = /\b(argentina|buenos aires|bs as|capital federal|mar del plata|rosario|cordoba)\b/;
  const us = /\b(usa|united states|new york|san francisco|los angeles|remote[- ]?us|us only|texas|california)\b/;
  const eu = /\b(spain|espana|madrid|barcelona|germany|berlin|france|paris|netherlands|amsterdam|uk|united kingdom|london|ireland|dublin|portugal|lisbon|remoto|remote eu)\b/;
  if (arg.test(t)) return 'argentina';
  if (us.test(t)) return 'eeuu';
  if (eu.test(t)) return 'europa';
  // Default: remoto deslocalizado suele ser oportunidad para Argentina/global; lo dejamos eeuu (remote global)
  return 'eeuu';
}

/* --------------------------- Agregador maestro --------------------------- */
export async function fetchJobs() {
  const results = await Promise.allSettled([fetchRemotive(), fetchArbeitnow(), fetchHimalayas()]);
  const jobs = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      jobs.push(...r.value);
    }
  }
  return jobs;
}

// ¿Una oferta es relevante para el perfil QA? (al menos un keyword en título/tags)
export function isRelevant(job) {
  const text = `${job.title} ${job.tags.join(' ')}`.toLowerCase();
  return BASE_KEYWORDS.some((k) => text.includes(k));
}
