import { PROFILE } from './cvProfile.js';
import { isRelevant, BASE_KEYWORDS } from './jobSources.js';

// Combinación de texto de una oferta (para extraer skills pedidos)
function jobText(job) {
  return `${job.title} ${job.description} ${job.tags.join(' ')} ${job.company}`.toLowerCase();
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ¿El skill aparece como palabra completa dentro del texto (jobs/pedidos)?
function textHasSkill(text, skill) {
  return new RegExp(`(^|[^a-z])${escapeReg(skill)}([^a-z]|$)`, 'i').test(text);
}

// Normaliza títulos de oferta a categorías QA/Testing para enriquecer el match
const ROLE_SYNONYMS = [
  { role: 'qa', words: ['qa', 'quality assurance', 'quality engineer'] },
  { role: 'tester', words: ['tester', 'test analyst'] },
  { role: 'automation', words: ['automation', 'sdet', 'test engineer'] },
  { role: 'devops', words: ['devops', 'ci/cd', 'azure'] },
  { role: 'fullstack', words: ['full', 'front', 'backend'] },
  { role: 'analista', words: ['analista funcional', 'functional analyst', 'analista de testing', 'analista qa'] },
];

function roleHits(job) {
  const title = job.title.toLowerCase();
  const hits = [];
  for (const r of ROLE_SYNONYMS) {
    if (r.words.some((w) => title.includes(w))) hits.push(r.role);
  }
  return hits;
}

// Calcula el porcentaje de match 0-100 DIRIGIDO POR LA OFERTA:
//  - matched:   habilidades pedidas por la vacante que el candidato posee
//  - requested: habilidades que la vacante pide (skills del perfil + mercado)
//  - missed:    habilidades pedidas por la vacante que el candidato NO posee
export function computeMatch(job) {
  const text = jobText(job);
  const title = job.title.toLowerCase();

  // Skills del perfil que la oferta pide y que tenemos (matched)
  const matched = [];
  for (const [skill, weight] of Object.entries(PROFILE.skills)) {
    if (textHasSkill(text, skill)) {
      matched.push({ skill, weight, inTitle: textHasSkill(title, skill) });
    }
  }
  const matchedSet = new Set(matched.map((m) => m.skill));

  // Skills del MERCADO que la oferta pide (para detectar gaps de verdad)
  const requestedMarket = [];
  const missing = [];
  for (const ms of PROFILE.marketSkills || []) {
    const present = ms.aliases.some((a) => textHasSkill(text, a));
    if (!present) continue;
    requestedMarket.push(ms.name);
    if (!ms.has) missing.push(ms.name); // la pide pero NO la tenemos -> gap
  }

  // Roles del título
  const roles = roleHits(job);

  // RELEVANCIA QA OBLIGATORIA: solo consideramos ofertas que claramente sean de
  // QA/testing o que lo mencionen en el título/tags. Esto evita que ofertas de
  // "AI", "Developer", "Product Owner" etc. aparezcan solo por mencionar un skill.
  const isQARelevant =
    roles.some((r) => ['qa', 'tester', 'automation', 'analista'].includes(r)) ||
    BASE_KEYWORDS.some((k) => title.includes(k)) ||
    (job.tags || []).some((t) => BASE_KEYWORDS.some((k) => t.includes(k)));
  if (!isQARelevant) {
    return { score: 0, matched: [], missed: [], requested: [], roles, inTitle: false };
  }

  // Falsa relevancia: si no menciona ningún skill QA de nuestro perfil, score bajo
  if (matched.length === 0 && roles.length === 0) {
    return { score: 0, matched: [], missed: [], requested: [], roles, inTitle: false };
  }

  // "requested": unión de skills del perfil pedidos + skills del mercado pedidos
  const requestedPerfil = Object.keys(PROFILE.skills).filter((s) => textHasSkill(text, s));
  const requested = [...new Set([...requestedPerfil, ...requestedMarket])];

  // Puntaje (dirigido por la oferta)
  let total = 0, gain = 0;
  for (const { skill, weight, inTitle } of matched) {
    total += weight;
    gain += weight * (inTitle ? 1.5 : 1);
  }
  const coverage = total > 0 ? gain / total : 0;
  const roleAffinity = roles.filter((r) => ['qa', 'tester', 'automation', 'analista'].includes(r)).length;

  let score = 0;
  score += coverage * 55;
  score += roleAffinity * 12;
  score += Math.min(matched.length, 8) * 2;
  score += Math.min(missing.length, 0) * 0; // no penaliza (junto a penalización abajo)
  score -= Math.min(missing.length, 5) * 3; // penaliza por cada tecnología pedida que NO tenemos
  score = Math.min(Math.max(score, 0), 100);

  const inTitle = BASE_KEYWORDS.some((k) => title.includes(k));

  return {
    score: Math.round(score),
    matched: matched.map((m) => m.skill),
    missed: missing.slice(0, 8),
    requested: requested.slice(0, 12),
    roles,
    inTitle,
  };
}

// Asigna LA región de una oferta.
// Prioridad: regionGuess (ya calculado con detección robusta) > detección por ubicación.
// Reglas de negocio para que las 3 regiones tengan sentido:
//  - Si la ubicación menciona Argentina -> argentina (preferencia por ser el lugar de residencia)
//  - Si menciona país europeo -> europa
//  - Si menciona EEUU o es remoto global -> eeuu
function assignRegion(job) {
  const loc = `${job.location || ''} ${job.regionGuess || ''}`.toLowerCase();
  const hasARG = /\b(argentina|buenos aires|bs as|capital federal)\b/.test(loc);
  const hasEU = /\b(spain|espana|germany|france|netherlands|uk|united kingdom|ireland|portugal|london|berlin|madrid|europe)\b/.test(loc);
  const hasUS = /\b(usa|united states|new york|san francisco|remote[- ]?us)\b/.test(loc);
  const hasMX = /\b(mexico|cdmx|ciudad de mexico|queretaro|guadalajara|monterrey|puebla)\b/.test(loc);
  const hasPE = /\b(peru|lima)\b/.test(loc);
  const hasCO = /\b(colombia|bogota|barranquilla|medellin|cali)\b/.test(loc);
  const hasCL = /\b(chile|santiago|las condes|providencia|valparaiso|concepcion)\b/.test(loc);

  if (job.regionGuess === 'argentina' || hasARG) return 'argentina';
  if (job.regionGuess === 'europa' || hasEU) return 'europa';
  if (job.regionGuess === 'eeuu' || hasUS) return 'eeuu';
  if (job.regionGuess === 'mexico' || hasMX) return 'mexico';
  if (job.regionGuess === 'peru' || hasPE) return 'peru';
  if (job.regionGuess === 'colombia' || hasCO) return 'colombia';
  if (job.regionGuess === 'chile' || hasCL) return 'chile';
  return 'eeuu'; // remoto global -> eeuu por defecto
}

// Ranking maestro: devuelve { regionKey: [jobs con match > 0, ordenados por score] }.
// Se devuelven TODAS las ofertas relevantes (sin recortar); la paginación la hace
// el frontend. topN se mantiene por compatibilidad pero ya no se usa.
export function rankByRegion(jobs, topN = 0) {
  const buckets = { argentina: [], europa: [], eeuu: [], mexico: [], peru: [], colombia: [], chile: [] };
  for (const job of jobs) {
    const region = assignRegion(job);
    const match = computeMatch(job);
    if (match.score <= 0) continue;
    if (!buckets[region]) continue;
    buckets[region].push({ ...job, ...match });
  }
  // Ordena cada región de forma independiente (sin colapsos entre regiones)
  const result = {};
  for (const [region, list] of Object.entries(buckets)) {
    list.sort((a, b) => b.score - a.score);
    result[region] = topN > 0 ? list.slice(0, topN) : list;
  }
  return result;
}
