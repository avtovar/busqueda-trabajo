import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Datos del perfil extraídos del CV (F:\Curriculum-Vitae)
// Esta es la fuente de verdad que usa el motor de matching.
const PROFILE = {
  fullName: 'Ali Valentin Tovar Morales',
  title: 'QA Engineer',
  headline:
    'QA Engineer | Manual & Automation Web y Mobile | API Testing | Azure DevOps | Atlassian',
  location: 'Buenos Aires, Argentina',
  yearsExperience: 8,
  summary:
    'Profesional de Informática con sólida trayectoria en Quality Assurance (QA), especializado en robustez y calidad de software en sectores críticos como banca digital y fintech. Experiencia en pruebas funcionales, testing web, mobile (Android/iOS), back-end y front-end bajo metodologías ágiles (Scrum) con Jira, Xray y Azure DevOps. Desde 2026 enfocado en IA generativa y agentes inteligentes (Claude Code, Claude Design).',
  email: '',
  linkedin: 'https://www.linkedin.com/in/ali-v-tovar',
  github: 'https://github.com/avtovar',

  // Skills con pesos (0-1) para calcular el match
  skills: {
    qa: 1,
    'manual testing': 1,
    'automation': 1,
    'web testing': 1,
    'mobile testing': 1,
    'api testing': 1,
    'functional testing': 1,
    'regression': 0.9,
    'smoke testing': 0.9,
    'gherkin': 0.8,
    'test cases': 1,
    'test automation': 1,
    'quality assurance': 1,
    'rest': 0.9,
    'graphql': 0.8,
    'postman': 1,
    'javascript': 0.9,
    'python': 0.8,
    'docker': 0.6,
    'sql': 0.7,
    'mysql': 0.7,
    'agile': 0.9,
    'scrum': 0.9,
    'jira': 1,
    'xray': 0.9,
    'azure devops': 0.9,
    'git': 0.8,
    'github': 0.8,
    'ci/cd': 0.7,
    'uat': 0.8,
    'fintech': 0.8,
    'banking': 0.8,
    'mobile': 0.9,
    'ios': 0.8,
    'android': 0.9,
    'maestro': 0.8,
    'ai': 0.7,
    'ia': 0.7,
    'llm': 0.5,
    'generative ai': 0.5,
  },

  // Prioridades de búsqueda (términos para filtrar/clasificar ofertas)
  keywords: [
    'qa',
    'quality assurance',
    'software tester',
    'test engineer',
    'qa engineer',
    'test automation',
    'automation engineer',
    'api testing',
    'manual testing',
    'mobile testing',
    'sdft',
    'sdet',
    'test analyst',
  ],

  // Habilidades del MERCADO (lo que las ofertas suelen pedir) para detectar
  // "gaps": tecnologías requeridas por la vacante que el CV no posee.
  // Cada entrada: { name, aliases[], has: bool (si está en el CV) }
  marketSkills: [
    { name: 'cypress', aliases: ['cypress'], has: false },
    { name: 'playwright', aliases: ['playwright'], has: false },
    { name: 'selenium', aliases: ['selenium'], has: false },
    { name: 'appium', aliases: ['appium'], has: false },
    { name: 'katalon', aliases: ['katalon'], has: false },
    { name: 'docker', aliases: ['docker'], has: true, weight: 0.6 },
    { name: 'kubernetes', aliases: ['kubernetes', 'k8s'], has: false },
    { name: 'ci/cd', aliases: ['ci/cd', 'cicd', 'jenkins', 'github actions', 'gitlab ci'], has: false },
    { name: 'python', aliases: ['python'], has: true, weight: 0.8 },
    { name: 'java', aliases: ['java'], has: false },
    { name: 'typescript', aliases: ['typescript', 'ts'], has: false },
    { name: 'javascript', aliases: ['javascript', 'js'], has: true, weight: 0.9 },
    { name: 'node.js', aliases: ['node'], has: false },
    { name: 'sql', aliases: ['sql', 'mysql', 'postgres', 'sql server'], has: true, weight: 0.7 },
    { name: 'postman', aliases: ['postman'], has: true, weight: 1 },
    { name: 'jira', aliases: ['jira'], has: true, weight: 1 },
    { name: 'azure devops', aliases: ['azure devops', 'azure'], has: true, weight: 0.9 },
    { name: 'aws', aliases: ['aws'], has: false },
    { name: 'graphql', aliases: ['graphql'], has: true, weight: 0.8 },
    { name: 'rest', aliases: ['rest'], has: true, weight: 0.9 },
    { name: 'load testing', aliases: ['load testing', 'jmeter', 'k6', 'gatling'], has: false },
    { name: 'performance testing', aliases: ['performance testing'], has: false },
    { name: 'mobile testing', aliases: ['mobile testing', 'android testing', 'ios testing'], has: true, weight: 0.9 },
    { name: 'api testing', aliases: ['api testing'], has: true, weight: 1 },
    { name: 'agile', aliases: ['agile'], has: true, weight: 0.9 },
    { name: 'scrum', aliases: ['scrum'], has: true, weight: 0.9 },
    { name: 'git', aliases: ['git'], has: true, weight: 0.8 },
    { name: 'fintech', aliases: ['fintech', 'banking', 'banca'], has: true, weight: 0.8 },
    { name: 'gherkin', aliases: ['gherkin', 'bdd', 'cucumber'], has: false },
    { name: 'ai', aliases: ['ai', 'artificial intelligence', 'generative ai', 'llm'], has: true, weight: 0.5 },
    { name: 'html', aliases: ['html'], has: false },
    { name: 'css', aliases: ['css'], has: false },
    { name: 'react', aliases: ['react'], has: false },
    { name: 'maestro', aliases: ['maestro'], has: true, weight: 0.8 },
    { name: 'testrail', aliases: ['testrail'], has: false },
    { name: 'zephyr', aliases: ['zephyr'], has: false },
    { name: 'soapui', aliases: ['soapui', 'ready api', 'readyapi'], has: false },
    { name: 'browserstack', aliases: ['browserstack'], has: false },
    { name: 'sauce labs', aliases: ['sauce labs', 'saucelabs'], has: false },
    { name: 'testng', aliases: ['testng'], has: false },
    { name: 'junit', aliases: ['junit'], has: false },
    { name: 'webdriverio', aliases: ['webdriverio', 'webdriver.io'], has: false },
    { name: 'robot framework', aliases: ['robot framework'], has: false },
    { name: 'testcafe', aliases: ['testcafe'], has: false },
  ],

  // Regiones soportadas
  regions: {
    argentina: {
      label: 'Argentina',
      lang: 'es',
      countries: ['Argentina', 'AR', 'Buenos Aires'],
      keywords: ['argentina', 'buenos aires', 'capaz federal'],
    },
    europa: {
      label: 'Europa',
      lang: 'en',
      countries: ['Spain', 'España', 'Germany', 'Alemania', 'France', 'Netherlands', 'Netherlands', 'United Kingdom', 'Ireland', 'Portugal'],
    },
    eeuu: {
      label: 'Estados Unidos',
      lang: 'en',
      countries: ['United States', 'USA', 'EEUU', 'EE.UU', 'Remote - US'],
    },
  },
};

// Lee el PDF del CV opcionalmente desde el repo (no se parsea el PDF a fondo,
// solo se usa como referencia; el perfil estructurado es la fuente principal).
export async function loadCvPath() {
  const candidates = [
    'F:\\Curriculum-Vitae\\Ali_Tovar_CV.pdf',
    'F:/Curriculum-Vitae/Ali_Tovar_CV.pdf',
  ];
  for (const c of candidates) {
    try {
      await readFile(c);
      return c;
    } catch {
      // intenta el siguiente
    }
  }
  return null;
}

export { PROFILE };
