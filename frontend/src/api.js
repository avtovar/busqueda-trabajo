// Capa de acceso a la API del backend. Misma lógica que el app.js original:
// si el fetch falla (server caído durante desarrollo, por ejemplo), cae a
// datos de ejemplo para que la UI nunca quede vacía.

// FALLBACK: datos de respaldo que se usan cuando el backend no responde.
// Así la pantalla nunca se queda en blanco, aunque no haya internet o server.
export const FALLBACK = {
  profile: {
    // ↑ Perfil "falso" de Ali por si no llega /api/profile.
    fullName: 'Ali Valentin Tovar Morales',
    title: 'QA Engineer',
    headline: 'QA Engineer | Manual & Automation Web y Mobile | API Testing | Azure DevOps',
    location: 'Buenos Aires, Argentina',
    summary: 'Profesional QA especializado en fintech/banca. Testing web/mobile, API, automatización y metodologías ágiles con foco en IA aplicada.',
    linkedin: 'https://www.linkedin.com/in/ali-v-tovar',
    github: 'https://github.com/avtovar',
    // ↑ skills es un objeto { skill: peso }. Cada oferta se matchea contra estos pesos.
    skills: { qa: 1, 'manual testing': 1, 'api testing': 1, mobile: 0.9, automation: 1, jira: 1, python: 0.8, javascript: 0.9, scrum: 0.9 },
  },
  jobs: {
    // ↑ Ofertas de ejemplo organizadas por región (mismas claves que usa la UI).
    argentina: [
      // ↑ Cada oferta demo tiene la misma forma que las reales: id, título, empresa,
      //   skills matcheados y score. Así la UI no distingue entre demo y online.
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

// Trae el perfil del candidato desde el backend (/api/profile).
export async function loadProfile() {
  try {
    const res = await fetch('/api/profile');
    if (res.ok) return await res.json();
    // ↑ Si el server responde bien, devolvemos el JSON ya parseado.
  } catch {}
  return FALLBACK.profile;
  // ↑ Si el fetch tiró error, caemos al perfil de respaldo del FALLBACK.
}

// Trae las ofertas rankeadas de una región (/api/jobs?region=X).
export async function loadJobs(region) {
  try {
    const res = await fetch(`/api/jobs?region=${region}`);
    if (res.ok) return await res.json();
  } catch {}
  // Si el server no responde, devolvemos las ofertas demo de esa región.
  return { region, jobs: FALLBACK.jobs[region] || [], _online: false };
  // ↑ _online: false le avisa a la UI que estamos en "modo demo".
}

// Trae el historial de ofertas vistas de una región (/api/history?region=X).
// A diferencia de loadJobs, acá no hay fallback con datos: si no hay server,
// simplemente devolvemos un historial vacío.
export async function loadHistory(region) {
  try {
    const res = await fetch(`/api/history?region=${region}`);
    if (res.ok) return await res.json();
  } catch {}
  return { region, jobs: [] };
}

// Pide al backend que refresque la búsqueda YA, ignorando la caché de 30 min.
// No usa la respuesta: solo es un "disparador" (POST sin body).
export async function refreshJobs() {
  try {
    await fetch('/api/refresh', { method: 'POST' });
  } catch {}
}

export async function searchLinkedInJobs(region) {
  let response;
  try {
    response = await fetch('/api/linkedin-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region }),
    });
  } catch {
    throw new Error('No se pudo conectar con el backend local.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `La búsqueda falló (HTTP ${response.status}).`);
  return data;
}

// Trae el detalle enriquecido de una oferta (/api/job?q=ID) con resumen de empresa y skills.
export async function loadJobDetail(id) {
  try {
    const res = await fetch(`/api/job?q=${encodeURIComponent(id)}`);
    // ↑ encodeURIComponent limpia el id por si trae caracteres especiales.
    if (res.ok) return await res.json();
  } catch {}
  return null;
  // ↑ null = no se pudo; quien llama decide qué hacer (ej. usar la oferta del listado).
}

// Pide la carta de presentación generada por el backend (/api/cover-letter).
export async function loadCoverLetter(region, id) {
  try {
    const res = await fetch(`/api/cover-letter?region=${region}&id=${encodeURIComponent(id)}`);
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

// Trae el listado de consultoras con su estado de contacto persistido.
export async function loadConsultoras() {
  try {
    const res = await fetch('/api/consultoras');
    if (res.ok) return await res.json();
  } catch {}
  // Si falla, devolvemos listado vacío pero con los estados por defecto,
  // así el tracker de contacto sigue funcionando visualmente.
  return { consultoras: [], estados: ['Sin contactar', 'Contactado', 'Respondió', 'Entrevista agendada', 'Descartada'] };
}

// Trae el agregado de analítica del mercado (/api/analytics): KPIs, brechas, etc.
export async function loadAnalytics() {
  try {
    const res = await fetch('/api/analytics');
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

// Guarda el estado/notas de contacto de una consultora en el backend (POST).
export async function saveConsultoraStatus(id, patch) {
  try {
    await fetch('/api/consultoras/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
      // ↑ JSON.stringify convierte el objeto a texto JSON para mandarlo en el body.
    });
  } catch {
    // si falla el guardado, el cambio queda solo visual hasta el próximo refresh
  }
}