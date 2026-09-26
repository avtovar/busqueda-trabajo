// Analítica del mercado y propuesta de interés: agrupa TODAS las ofertas
// detectadas (todas las regiones), calcula qué habilidades pide el mercado,
// las compara contra el CV de Ali Tovar y genera recomendaciones automáticas.
// ↑ De acá sale toda la data de la página "Propuesta de Interés" del frontend.
// ↑ Trae el perfil de Ali (skills y marketSkills) para medir la demanda y las brechas
import { PROFILE } from './cvProfile.js';
import { computeMatch } from './matcher.js';

// ↑ Nombres legibles de cada región para mostrar en los resultados
const REGION_LABELS = {
  argentina: 'Argentina',
  mexico: 'México',
  peru: 'Perú',
  colombia: 'Colombia',
  chile: 'Chile',
  europa: 'Europa',
  eeuu: 'Estados Unidos',
};

// Clusters de tecnología afín para agrupar recomendaciones de formación.
// ↑ Agrupa skills parecidos por área (E2E, Mobile, API...) para las recomendaciones
const SKILL_CLUSTERS = [
  { key: 'E2E / Web UI', skills: ['cypress', 'playwright', 'webdriverio', 'selenium', 'testcafe'] },
  { key: 'Mobile', skills: ['appium', 'mobile testing', 'android', 'ios', 'browserstack', 'sauce labs'] },
  { key: 'API', skills: ['api testing', 'rest', 'soap', 'soapui', 'postman', 'karate', 'graphql'] },
  { key: 'Performance / Load', skills: ['performance testing', 'load testing', 'jmeter', 'k6', 'gatling', 'blazemeter'] },
  { key: 'Lenguajes', skills: ['java', 'typescript', 'python', 'javascript', 'node.js', 'ruby'] },
  { key: 'CI/CD & Infra', skills: ['ci/cd', 'jenkins', 'github actions', 'gitlab ci', 'circleci', 'docker', 'kubernetes', 'azure devops'] },
  { key: 'Datos', skills: ['sql', 'mysql', 'postgres', 'spark', 'pl/sql', 'etl', 'big data', 'ab initio'] },
  { key: 'BDD', skills: ['gherkin', 'bdd', 'cucumber'] },
];

// ↑ Arma el texto completo de la oferta (igual técnica que en matcher.js)
function jobText(job) {
  return `${job.title} ${job.description} ${job.tags.join(' ')} ${job.company}`.toLowerCase();
}

// ↑ Escapa caracteres especiales para buscar cada skill como literal en un regex
function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ↑ ¿El texto menciona el skill como palabra completa? (comparte lógica con el matcher)
function textHasSkill(text, skill) {
  return new RegExp(`(^|[^a-z])${escapeReg(skill)}([^a-z]|$)`, 'i').test(text);
}

// Junta skills del CV (las tiene) + skills del mercado (para detectar brechas).
// ↑ Crea la lista maestra de skills que se va a medir contra el mercado
function candidateSkills() {
  // ↑ Un Map evita duplicados (mismo skill en CV y en mercado) y acelera consultas
  const map = new Map();
  // ↑ Primero entran los skills del mercado con su flag has (si Ali los tiene o no)
  for (const ms of PROFILE.marketSkills || []) {
    map.set(ms.name, { name: ms.name, has: !!ms.has, aliases: ms.aliases });
  }
  // ↑ Después entran los skills del CV que no estaban en el mercado (siempre has=true)
  for (const key of Object.keys(PROFILE.skills || {})) {
    if (!map.has(key)) map.set(key, { name: key, has: true, aliases: [key] });
  }
  return [...map.values()];
}

function githubSkillEvidence() {
  const projects = PROFILE.projects || [];
  return (PROFILE.marketSkills || [])
    .filter((skill) => !skill.has)
    .map((skill) => ({
      name: skill.name,
      projects: projects
        .filter((project) => {
          const text = `${project.nombre} ${project.descripcion} ${project.lenguaje || ''}`;
          return skill.aliases.some((alias) => textHasSkill(text, alias));
        })
        .map((project) => project.nombre),
    }))
    .filter((skill) => skill.projects.length);
}

// ↑ Genera la lista de recomendaciones automáticas (reglas de negocio con los cálculos)
function buildRecommendations({ skillStats, missingSkills, total, byRegion, englishCount, paymentCount }) {
  const recs = [];

  // 1) Brechas técnicas ordenadas por demanda
  // ↑ Ordena los skills faltantes de mayor a menor % de demanda
  const gaps = [...missingSkills].sort((a, b) => b.pct - a.pct);
  if (gaps.length && total > 0) {
    // ↑ Se quedan con las 3 brechas más grandes para nombrarlas en el texto
    const top = gaps.slice(0, 3);
    const names = top.map((g) => g.name).join(', ');
    // ↑ REC 1: recomienda fortalecer las tecnologías que el mercado pide y el CV no tiene
    recs.push({
      priority: 'ALTA',
      icon: '🔥',
      text: `Fortalecé estas tecnologías que el mercado más pide y tu CV no muestra: ${names}. Son las brechas más grandes respecto a las ${total} vacantes detectadas.`,
    });
  }

  // 2) Agrupar brechas por cluster para priorizar formación
  // ↑ Agrupa la demanda de brechas por cluster y elige el área más fuerte
  const gapSet = new Set(gaps.map((g) => g.name));
  const clusters = SKILL_CLUSTERS
    .map((c) => {
      const hit = c.skills.filter((s) => gapSet.has(s));
      const demand = hit
        .map((s) => gaps.find((g) => g.name === s))
        .reduce((a, g) => a + (g ? g.pct : 0), 0);
      return { key: c.key, hit, demand, pct: demand };
    })
    .filter((c) => c.hit.length)
    .sort((a, b) => b.demand - a.demand);

  // ↑ Se queda con el cluster de mayor demanda acumulada
  if (clusters.length) {
    const best = clusters[0];
    // ↑ REC 2: priorizar formación en el área tecnológica más pedida
    recs.push({
      priority: 'MEDIA',
      icon: '🎯',
      text: `Priorizá el área de "${best.key}" (${best.hit.join(', ')}): concentra la mayor demanda que tu CV todavía no cubre. Sumarla a tu perfil abriría más vacantes.`,
    });
  }

  // 3) Inglés (requisito frecuente en ofertas remotas MX/CO/US)
  // ↑ Calcula qué % de ofertas exige inglés
  const englishPct = total ? Math.round((englishCount / total) * 100) : 0;
  // ↑ Si pasa el 20%, vale la pena recomendar prepararse
  if (englishPct >= 20) {
    // ↑ REC 3: preparación para entrevistas en inglés
    recs.push({
      priority: 'MEDIA',
      icon: '🗣️',
      text: `El inglés aparece como requisito en el ${englishPct}% de las ofertas (conversacional/bilingüe). Reflejá tu nivel real en el CV y preparate para una entrevista en inglés.`,
    });
  }

  // 4) Experiencia en medios de pago / banca (vertical con match alto)
  // ↑ Calcula el % de ofertas que piden banca/fintech
  const paymentPct = total ? Math.round((paymentCount / total) * 100) : 0;
  // ↑ Si la demanda supera el 20%, se recomienda potenciar esa experiencia
  if (paymentPct >= 20) {
    // ↑ REC 4: destacar el background en banca digital (ventaja competitiva)
    recs.push({
      priority: 'MEDIA',
      icon: '🏦',
      text: `El ${paymentPct}% de las ofertas pide experiencia en banca/fintech/medios de pago (POS, adquirencia, Bantotal). Tu background en banca digital es una ventaja: escribe esto primero en el CV y en la carta de presentación.`,
    });
  }

  // 5) Autoanálisis por región: adónde conviene apuntar
  // ↑ Busca la región con mejor match promedio
  if (byRegion.length) {
    const best = [...byRegion].sort((a, b) => b.avgScore - a.avgScore)[0];
    // ↑ Asegura que esa región tenga al menos una vacante
    if (best && best.count) {
      // ↑ REC 5: enfocar las postulaciones en la región con mejor promedio
      recs.push({
        priority: 'BAJA',
        icon: '📌',
        text: `Tu región con mejor match promedio es ${best.label} (${best.avgScore}% promedio en ${best.count} vacantes). Apuntá tus próximas postulaciones ahí.`,
      });
    }
  }

  // 6) Consejo de formato CV
  // ↑ Toma hasta 5 skills muy demandados (>=50%) que Ali YA domina
  const strong = skillStats.filter((s) => s.has && s.pct >= 50).slice(0, 5);
  if (strong.length) {
    const names = strong.map((s) => s.name).join(', ');
    // ↑ REC 6: mostrar esas fortalezas en el título y el inicio del CV
    recs.push({
      priority: 'BAJA',
      icon: '💪',
      text: `Tus skills con mayor demanda y que ya dominás: ${names}. Asegurate de que aparezcan en el título y en los primeros renglones de tu CV.`,
    });
  }

  return recs;
}

// ↑ Función principal: junta todas las regiones y arma la analítica completa
export function buildAnalytics(regions) {
  // ↑ Solo se consideran las regiones que tienen ofertas (no vacías)
  const entries = Object.entries(regions).filter(([, list]) => Array.isArray(list) && list.length);
  const allJobs = [];
  const byRegion = [];
  let sum = 0;

  for (const [region, list] of entries) {
    // ↑ Calcula el promedio y el máximo de score por región
    const scores = list.map((j) => j.score || 0);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    byRegion.push({
      region,
      label: REGION_LABELS[region] || region,
      count: list.length,
      avgScore,
      maxScore: scores.length ? Math.max(...scores) : 0,
    });
    // ↑ Junta TODAS las ofertas en un solo array y acumula la suma de scores
    for (const job of list) {
      allJobs.push({ ...job, _region: region });
      sum += job.score || 0;
    }
  }

  // ↑ Total de ofertas y promedio general de match (suma / cantidad)
  const total = allJobs.length;
  const avgScore = total ? Math.round(sum / total) : 0;

  const githubEvidence = githubSkillEvidence();
  const evidenceNames = new Set(githubEvidence.map((skill) => skill.name));
  const projectedProfile = {
    ...PROFILE,
    skills: {
      ...PROFILE.skills,
      ...Object.fromEntries([...evidenceNames].map((name) => [name, 0.5])),
    },
    marketSkills: (PROFILE.marketSkills || []).map((skill) => (
      evidenceNames.has(skill.name) ? { ...skill, has: true } : skill
    )),
  };
  const projectedScores = allJobs.map((job) => computeMatch(job, projectedProfile).score);
  const projectedAvgScore = total
    ? Math.round(projectedScores.reduce((score, next) => score + next, 0) / total)
    : 0;

  // Demanda por skill en todo el mercado detectado
  // ↑ Para cada skill, cuenta en cuántas ofertas aparece (su demanda)
  const skills = candidateSkills();
  const skillStats = skills
    .map((s) => {
      let requested = 0;
      for (const job of allJobs) {
        if (s.aliases.some((a) => textHasSkill(jobText(job), a))) requested++;
      }
      const pct = total ? Math.round((requested / total) * 100) : 0;
      return { name: s.name, has: s.has, requested, pct };
    })
    .filter((s) => s.requested > 0)
    .sort((a, b) => b.requested - a.requested);

  // ↑ Fortalezas: skills con demanda que Ali YA posee (hasta 12)
  const strongSkills = skillStats.filter((s) => s.has).slice(0, 12);
  // ↑ Brechas: skills con demanda que Ali NO posee, ordenadas por % de demanda
  const missingSkills = skillStats
    .filter((s) => !s.has)
    .map((s) => ({ name: s.name, jobsRequesting: s.requested, pct: s.pct }))
    .sort((a, b) => b.pct - a.pct);

  // Conteos especiales para recomendaciones
  // ↑ Cuenta ofertas que piden inglés y ofertas que piden banca/fintech
  let englishCount = 0;
  let paymentCount = 0;
  const paymentRe = /\b(banc|fintech|payment|pagos|pos|pinpad|adquirente|core banking|bantotal|billetera|medio de pago)\b/i;
  for (const job of allJobs) {
    const text = jobText(job);
    if (/\b(ingl|english|bilingual|ingles)\b/i.test(text)) englishCount++;
    if (paymentRe.test(text)) paymentCount++;
  }

  // ↑ Dispara el generador con todos los datos ya calculados
  const recommendations = buildRecommendations({
    skillStats,
    missingSkills,
    total,
    byRegion,
    englishCount,
    paymentCount,
  });

  // ↑ Devuelve el paquete completo de analítica que consume el frontend
  return {
    generatedAt: new Date().toISOString(),
    candidato: {
      nombre: PROFILE.fullName,
      titulo: PROFILE.title,
      headline: PROFILE.headline,
      experienciaAños: PROFILE.yearsExperience || 0,
      location: PROFILE.location,
      summary: PROFILE.summary,
      linkedin: PROFILE.linkedin,
      github: PROFILE.github,
      skills: Object.entries(PROFILE.skills).map(([name, weight]) => ({ name, weight })),
      skillCount: Object.keys(PROFILE.skills).length,
      projectCount: (PROFILE.projects || []).length,
      proyectos: PROFILE.projects || [],
    },
    githubEvidence,
    matchProjection: {
      currentAvgScore: avgScore,
      estimatedAvgScore: projectedAvgScore,
      delta: projectedAvgScore - avgScore,
      improvedJobs: projectedScores.filter((score, index) => score > (allJobs[index].score || 0)).length,
      modeledSkills: [...evidenceNames],
    },
    total,
    avgScore,
    byRegion,
    skillStats,
    strongSkills: strongSkills.slice(0, 10),
    missingSkills,
    englishPct: total ? Math.round((englishCount / total) * 100) : 0,
    paymentPct: total ? Math.round((paymentCount / total) * 100) : 0,
    recommendations,
  };
}