// ============================================================================
// Motor de matching: convierte cada oferta en una oferta "rankeada".
// Calcula el % de compatibilidad con el perfil de Ali (0-100) y le asigna
// la región a la que pertenece (Argentina, Europa, EEUU o Latam).
// ============================================================================

// ↑ Trae los skills con peso del perfil de Ali (la base del puntaje)
import { PROFILE } from './cvProfile.js';
// ↑ Trae keywords base de QA y el filtro de relevancia compartido con jobSources
import { isRelevant, BASE_KEYWORDS } from './jobSources.js';

// Combinación de texto de una oferta (para extraer skills pedidos)
// ↑ Arma un solo texto (título + descripción + tags + empresa) en minúsculas
function jobText(job) {
  return `${job.title} ${job.description} ${job.tags.join(' ')} ${job.company}`.toLowerCase();
}

// ↑ Escapa los caracteres especiales de una skill para usarla en un regex literal
function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ¿El skill aparece como palabra completa dentro del texto (jobs/pedidos)?
// ↑ True si el skill matchea como PALABRA COMPLETA (evita que "qa" entre en "quality")
function textHasSkill(text, skill) {
  return new RegExp(`(^|[^a-z])${escapeReg(skill)}([^a-z]|$)`, 'i').test(text);
}

// Normaliza títulos de oferta a categorías QA/Testing para enriquecer el match
// ↑ Tabla de sinónimos: palabras del título -> categoría de rol QA
const ROLE_SYNONYMS = [
  { role: 'qa', words: ['qa', 'quality assurance', 'quality engineer'] },
  { role: 'tester', words: ['tester', 'test analyst'] },
  { role: 'automation', words: ['automation', 'sdet', 'test engineer'] },
  { role: 'devops', words: ['devops', 'ci/cd', 'azure'] },
  { role: 'fullstack', words: ['full', 'front', 'backend'] },
  { role: 'analista', words: ['analista funcional', 'functional analyst', 'analista de testing', 'analista qa'] },
];

// ↑ Detecta las categorías de rol que aparecen en el título (qa, tester, automation...)
function roleHits(job) {
  const title = job.title.toLowerCase();
  const hits = [];
  for (const r of ROLE_SYNONYMS) {
    // ↑ Si alguna palabra del sinónimo aparece en el título, se anota el rol
    if (r.words.some((w) => title.includes(w))) hits.push(r.role);
  }
  return hits;
}

// Calcula el porcentaje de match 0-100 DIRIGIDO POR LA OFERTA:
//  - matched:   habilidades pedidas por la vacante que el candidato posee
//  - requested: habilidades que la vacante pide (skills del perfil + mercado)
//  - missed:    habilidades pedidas por la vacante que el candidato NO posee
// ↑ Calcula el porcentaje de compatibilidad de una oferta con el perfil (0-100)
export function computeMatch(job, candidateProfile = PROFILE) {
  const text = jobText(job);
  const title = job.title.toLowerCase();

  // Skills del perfil que la oferta pide y que tenemos (matched)
  // ↑ Busca cuáles skills del CV aparecen en el texto de la oferta
  const matched = [];
  for (const [skill, weight] of Object.entries(candidateProfile.skills)) {
    if (textHasSkill(text, skill)) {
      // ↑ inTitle marca si el skill también aparece en el título (vale más)
      matched.push({ skill, weight, inTitle: textHasSkill(title, skill) });
    }
  }
  // ↑ Set de skills que sí tenemos, para consultas rápidas más adelante
  const matchedSet = new Set(matched.map((m) => m.skill));

  // Skills del MERCADO que la oferta pide (para detectar gaps de verdad)
  // ↑ Detecta skills del mercado pedidos por la oferta; si Ali no los tiene => brecha
  const requestedMarket = [];
  const missing = [];
  for (const ms of candidateProfile.marketSkills || []) {
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
  // ↑ Filtro de relevancia: solo importan ofertas claramente de QA/testing
  const isQARelevant =
    roles.some((r) => ['qa', 'tester', 'automation', 'analista'].includes(r)) ||
    BASE_KEYWORDS.some((k) => title.includes(k)) ||
    (job.tags || []).some((t) => BASE_KEYWORDS.some((k) => t.includes(k)));
  // ↑ Si no es oferta de QA, se descarta con score 0
  if (!isQARelevant) {
    return { score: 0, matched: [], missed: [], requested: [], roles, inTitle: false };
  }

  // Falsa relevancia: si no menciona ningún skill QA de nuestro perfil, score bajo
  // ↑ Aunque diga "QA", si no coincide con ningún skill del CV, tampoco sirve
  if (matched.length === 0 && roles.length === 0) {
    return { score: 0, matched: [], missed: [], requested: [], roles, inTitle: false };
  }

  // "requested": unión de skills del perfil pedidos + skills del mercado pedidos
  // ↑ Habilidades que la oferta está pidiendo (del perfil y del mercado)
  const requestedPerfil = Object.keys(candidateProfile.skills).filter((s) => textHasSkill(text, s));
  const requested = [...new Set([...requestedPerfil, ...requestedMarket])];

  // Puntaje (dirigido por la oferta)
  // ↑ total = peso de los skills pedidos; gain = lo mismo con bonus si van en el título
  let total = 0, gain = 0;
  for (const { skill, weight, inTitle } of matched) {
    total += weight;
    gain += weight * (inTitle ? 1.5 : 1);
  }
  // ↑ Cobertura: qué proporción del total pedido cubrimos al final (0-1)
  const coverage = total > 0 ? gain / total : 0;
  // ↑ Cantidad de roles QA detectados en el título (suman puntos)
  const roleAffinity = roles.filter((r) => ['qa', 'tester', 'automation', 'analista'].includes(r)).length;

  let score = 0;
  score += coverage * 55; // ↑ 55% del puntaje viene de la cobertura de skills
  score += roleAffinity * 12; // ↑ Cada rol QA en el título aporta 12 puntos
  score += Math.min(matched.length, 8) * 2; // ↑ Bonus por skills coincidentes (hasta 8)
  score += Math.min(missing.length, 0) * 0; // no penaliza (junto a penalización abajo)
  score -= Math.min(missing.length, 5) * 3; // ↑ Resta 3 por cada skill pedido que NO tenemos (máx 5)
  score = Math.min(Math.max(score, 0), 100); // ↑ Se recorta ("clampa") a un rango válido 0-100

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
// ↑ Decide en qué región entra cada oferta (el "bucket" del ranking)
function assignRegion(job) {
  // ↑ Combina la ubicación declarada con la detección automática previa (regionGuess)
  const loc = `${job.location || ''} ${job.regionGuess || ''}`.toLowerCase();
  // ↑ Busca palabras clave de cada país en la ubicación de la oferta
  const hasARG = /\b(argentina|buenos aires|bs as|capital federal)\b/.test(loc);
  const hasEU = /\b(spain|espana|germany|france|netherlands|uk|united kingdom|ireland|portugal|london|berlin|madrid|europe)\b/.test(loc);
  const hasUS = /\b(usa|united states|new york|san francisco|remote[- ]?us)\b/.test(loc);
  const hasMX = /\b(mexico|cdmx|ciudad de mexico|queretaro|guadalajara|monterrey|puebla)\b/.test(loc);
  const hasPE = /\b(peru|lima)\b/.test(loc);
  const hasCO = /\b(colombia|bogota|barranquilla|medellin|cali)\b/.test(loc);
  const hasCL = /\b(chile|santiago|las condes|providencia|valparaiso|concepcion)\b/.test(loc);

  // ↑ Argentina va PRIMERO por ser el país de residencia de Ali (preferencia de negocio)
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
  // ↑ Crea un contenedor vacío para cada región soportada
  const buckets = { argentina: [], europa: [], eeuu: [], mexico: [], peru: [], colombia: [], chile: [] };
  for (const job of jobs) {
    // ↑ 1) Asignamos la región de la oferta
    const region = assignRegion(job);
    // ↑ 2) Calculamos su porcentaje de match
    const match = computeMatch(job);
    // ↑ 3) Las ofertas con score 0 no entran al ranking
    if (match.score <= 0) continue;
    // ↑ Protección: si la región no está en la lista, se descarta
    if (!buckets[region]) continue;
    // ↑ 4) Guardamos la oferta enriquecida (datos originales + resultado del match)
    buckets[region].push({ ...job, ...match });
  }
  // Ordena cada región de forma independiente (sin colapsos entre regiones)
  const result = {};
  for (const [region, list] of Object.entries(buckets)) {
    // ↑ Ordena de mayor a menor score dentro de cada región
    list.sort((a, b) => b.score - a.score);
    // ↑ topN sigue existiendo por compatibilidad, pero ya no recorta la lista
    result[region] = topN > 0 ? list.slice(0, topN) : list;
  }
  return result;
}
