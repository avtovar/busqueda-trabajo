// Capa de acceso a la API del backend. Misma lógica que el app.js original:
// si el fetch falla (server caído durante desarrollo, por ejemplo), cae a
// datos de ejemplo para que la UI nunca quede vacía.

export const FALLBACK = {
  profile: {
    fullName: 'Ali Valentin Tovar Morales',
    title: 'QA Engineer',
    headline: 'QA Engineer | Manual & Automation Web y Mobile | API Testing | Azure DevOps',
    location: 'Buenos Aires, Argentina',
    summary: 'Profesional QA especializado en fintech/banca. Testing web/mobile, API, automatización y metodologías ágiles con foco en IA aplicada.',
    linkedin: 'https://www.linkedin.com/in/ali-v-tovar',
    github: 'https://github.com/avtovar',
    skills: { qa: 1, 'manual testing': 1, 'api testing': 1, mobile: 0.9, automation: 1, jira: 1, python: 0.8, javascript: 0.9, scrum: 0.9 },
  },
  jobs: {
    argentina: [
      { id: 'demo-ar-1', source: 'Demo', title: 'QA Automation Engineer', company: 'Ejemplo Fintech', location: 'Buenos Aires', regionGuess: 'argentina', applyUrl: '#', description: 'Automatización de pruebas API (REST/GraphQL) y mobile con JavaScript. Metodología Scrum y Jira.', tags: ['qa', 'automation', 'api', 'mobile'], matched: ['qa', 'automation', 'api testing', 'mobile testing', 'rest', 'postman', 'javascript', 'scrum', 'jira'], missed: [], requested: ['qa', 'automation', 'api testing', 'mobile', 'rest'], inTitle: true, score: 96 },
      { id: 'demo-ar-2', source: 'Demo', title: 'Backend/API Tester', company: 'Banco Digital', location: 'CABA', regionGuess: 'argentina', applyUrl: '#', description: 'Testing de APIs con Postman, SQL y bases de datos. Pruebas de regresión y caja negra.', tags: ['api', 'postman', 'sql', 'regression'], matched: ['api testing', 'regression', 'rest', 'postman', 'sql'], missed: [], requested: ['api testing', 'postman', 'sql', 'regression'], inTitle: true, score: 86 },
    ],
    europa: [
      { id: 'demo-eu-1', source: 'Demo', title: 'QA Software Engineer (Mobile)', company: 'EU Bank', location: 'Madrid, Spain', regionGuess: 'europa', applyUrl: '#', description: 'Mobile test automation for Android/iOS digital banking in Europe.', tags: ['qa', 'automation', 'mobile', 'android', 'ios'], matched: ['qa', 'automation', 'mobile testing', 'mobile', 'android', 'ios'], missed: [], requested: ['qa', 'automation', 'mobile', 'android', 'ios'], inTitle: true, score: 92 },
    ],
    eeuu: [
      { id: 'demo-us-1', source: 'Demo', title: 'SDET (QA Automation Engineer)', company: 'US TechStartup', location: 'Remote - US', regionGuess: 'eeuu', applyUrl: '#', description: 'Build test automation frameworks for a fintech platform using JavaScript and Docker, API testing focus.', tags: ['sdet', 'qa', 'automation', 'api', 'docker'], matched: ['qa', 'automation', 'api testing', 'javascript'], missed: ['docker'], requested: ['sdet', 'qa', 'automation', 'api', 'docker', 'javascript'], inTitle: true, score: 88 },
    ],
  },
};

export async function loadProfile() {
  try {
    const res = await fetch('/api/profile');
    if (res.ok) return await res.json();
  } catch {}
  return FALLBACK.profile;
}

export async function loadJobs(region) {
  try {
    const res = await fetch(`/api/jobs?region=${region}`);
    if (res.ok) return await res.json();
  } catch {}
  return { region, jobs: FALLBACK.jobs[region] || [], _online: false };
}

export async function loadHistory(region) {
  try {
    const res = await fetch(`/api/history?region=${region}`);
    if (res.ok) return await res.json();
  } catch {}
  return { region, jobs: [] };
}

export async function refreshJobs() {
  try {
    await fetch('/api/refresh', { method: 'POST' });
  } catch {}
}

export async function loadJobDetail(id) {
  try {
    const res = await fetch(`/api/job?q=${encodeURIComponent(id)}`);
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

export async function loadCoverLetter(region, id) {
  try {
    const res = await fetch(`/api/cover-letter?region=${region}&id=${encodeURIComponent(id)}`);
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

export async function loadConsultoras() {
  try {
    const res = await fetch('/api/consultoras');
    if (res.ok) return await res.json();
  } catch {}
  return { consultoras: [], estados: ['Sin contactar', 'Contactado', 'Respondió', 'Entrevista agendada', 'Descartada'] };
}

export async function saveConsultoraStatus(id, patch) {
  try {
    await fetch('/api/consultoras/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
  } catch {
    // si falla el guardado, el cambio queda solo visual hasta el próximo refresh
  }
}
