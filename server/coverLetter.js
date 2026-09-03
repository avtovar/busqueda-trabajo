import { PROFILE } from './cvProfile.js';
import { computeMatch } from './matcher.js';

// Genera un resumen en una línea de la empresa y sus skills requeridos
export function summarize(job) {
  const match = computeMatch(job);
  const skills = (match.matched || []).slice(0, 6);
  return {
    companySummary: `${job.company} (${job.source}) busca "${job.title}" en ${job.location}.`,
    requiredSkills: skills,
    topSkill: skills[0] || 'QA Testing',
  };
}

// Detecta el idioma de la carta según la región
function langForRegion(regionKey) {
  return (PROFILE.regions[regionKey] || {}).lang || 'es';
}

// Datos de la empresa para el encabezado de la carta
const COMPANIES = {
  'remoteok': 'RemoteOK',
  'weworkremotely': 'We Work Remotely',
};

// Cuerpo de la carta en español
function bodyEs(job, sum) {
  return `Me dirijo a ustedes para postularme a la posición de "${job.title}" en ${job.company}.

Soy QA Engineer con ${PROFILE.yearsExperience}+ años de experiencia en garantía de calidad de software, especializado en banca digital y fintech. Mi trayectoria incluye pruebas funcionales, testing web y mobile (Android/iOS), API testing (REST/GraphQL), y automatización de pruebas con Maestro Studio y JavaScript.

Entre mis fortalezas se encuentran: ${sum.requiredSkills.join(', ')}. Trabajo bajo metodologías ágiles (Scrum) con Jira, Xray y Azure DevOps, y desde 2026 integro IA generativa y agentes inteligentes (Claude Code) para potenciar la productividad del QA.

Adjunto mi CV y quedo a disposición para una entrevista donde pueda aportar mis conocimientos y pasión por la calidad. Pueden contactarme por LinkedIn: ${PROFILE.linkedin}.

Saludos cordiales,
${PROFILE.fullName}
${PROFILE.title}
${PROFILE.location}`;
}

// Cuerpo de la carta en inglés
function bodyEn(job, sum) {
  return `I am writing to apply for the position of "${job.title}" at ${job.company}.

I am a QA Engineer with ${PROFILE.yearsExperience}+ years of experience in software quality assurance, specialized in digital banking and fintech. My background covers functional testing, web and mobile testing (Android/iOS), API testing (REST/GraphQL), and test automation with Maestro Studio and JavaScript.

Among my strengths are: ${sum.requiredSkills.join(', ')}. I work under agile methodologies (Scrum) using Jira, Xray and Azure DevOps, and since 2026 I have been integrating generative AI and intelligent agents (Claude Code) to boost QA productivity.

I am attaching my CV and I am available for an interview where I can contribute my knowledge and passion for quality. You can reach me via LinkedIn: ${PROFILE.linkedin}.

Best regards,
${PROFILE.fullName}
${PROFILE.title}
${PROFILE.location}`;
}

// Genera la carta completa según la región
export function generateCoverLetter(job, regionKey) {
  const lang = langForRegion(regionKey);
  const sum = summarize(job);
  const body = lang === 'en' ? bodyEn(job, sum) : bodyEs(job, sum);
  return {
    lang,
    region: regionKey,
    subject:
      lang === 'en'
        ? `Application for ${job.title} - ${PROFILE.fullName}`
        : `Postulación a ${job.title} - ${PROFILE.fullName}`,
    body,
  };
}
