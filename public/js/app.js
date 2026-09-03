// BuscaEmpleo - Frontend
// Carga el perfil del CV, las ofertas por región y gestiona los modales.

const FALLBACK = {
  profile: {
    fullName: 'Ali Valentin Tovar Morales',
    title: 'QA Engineer',
    headline: 'QA Engineer | Manual & Automation Web y Mobile | API Testing | Azure DevOps',
    location: 'Buenos Aires, Argentina',
    summary: 'Profesional QA especializado en fintech/banca. Testing web/mobile, API, automatización y metodologías ágiles con foco en IA aplicada.',
    linkedin: 'https://www.linkedin.com/in/ali-v-tovar',
    github: 'https://github.com/avtovar',
    skills: { qa: 1, 'manual testing': 1, 'api testing': 1, 'mobile': 0.9, 'automation': 1, 'jira': 1, 'python': 0.8, 'javascript': 0.9, 'scrum': 0.9 },
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

let PROFILE = null;
let CURRENT_REGION = 'argentina';
let CURRENT_JOBS = {};
let VIEW_MODE = 'live'; // 'live' | 'history'

const $ = (id) => document.getElementById(id);

init();

async function init() {
  const [profile, jobs] = await Promise.all([loadProfile(), loadJobs('argentina')]);
  PROFILE = profile;
  CURRENT_JOBS = jobs;
  renderProfile(profile);
  renderJobs('argentina', jobs);
  bindTabs();
  bindModals();
  bindToolbar();
  setStatus(jobs);
}

function setStatus(data) {
  if (VIEW_MODE === 'history') {
    $('status').textContent = `Mostrando ofertas activas y vistas en los últimos 30 días (${(data.jobs || []).length}).`;
    return;
  }
  $('status').textContent = data._online
    ? 'Conexión exitosa con las fuentes de empleo.'
    : 'Modo demo: no se pudo contactar las fuentes en línea. Mostrando ofertas de ejemplo.';
}

async function loadProfile() {
  try {
    const res = await fetch('/api/profile');
    if (res.ok) return await res.json();
  } catch {}
  return FALLBACK.profile;
}

async function loadJobs(region) {
  try {
    const res = await fetch(`/api/jobs?region=${region}`);
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {}
  return { region, jobs: FALLBACK.jobs[region] || [], _online: false };
}

async function loadHistory(region) {
  try {
    const res = await fetch(`/api/history?region=${region}`);
    if (res.ok) return await res.json();
  } catch {}
  return { region, jobs: [] };
}

function renderProfile(p) {
  $('cv-name').textContent = p.fullName;
  $('cv-title').textContent = p.headline || p.title;
  $('cv-location').textContent = '📍 ' + (p.location || '');
  $('cv-summary').textContent = p.summary || '';
  $('cv-linkedin').href = p.linkedin;
  $('cv-github').href = p.github;
  const tags = Object.entries(p.skills || {}).map(([k, v]) => `<span class="tag">${k} (${(v * 100) | 0}%)</span>`).join('');
  $('cv-skills').innerHTML = tags;
}

function matchClass(score) {
  if (score >= 75) return 'match-high';
  if (score >= 50) return 'match-mid';
  return 'match-low';
}

function daysAgo(ts) {
  if (!ts) return null;
  const d = Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
  return d;
}

function historyBadge(job) {
  if (job.active === undefined) return '';
  if (job.active) return '<span class="badge badge-active">🟢 Activa ahora</span>';
  const d = daysAgo(job.lastSeen);
  const label = d === null ? 'Vista anteriormente' : d <= 0 ? 'Vista hoy' : `Vista hace ${d} día${d === 1 ? '' : 's'}`;
  return `<span class="badge badge-inactive">⚪ ${label} (ya no aparece)</span>`;
}

function renderJobs(region, data) {
  CURRENT_REGION = region;
  const listEl = $('job-list');
  const jobs = data.jobs || [];
  if (!jobs.length) {
    listEl.innerHTML = `<div class="empty">${VIEW_MODE === 'history' ? 'Todavía no hay historial guardado para esta región. Corré una búsqueda primero.' : 'No se encontraron ofertas para esta región.'}</div>`;
    return;
  }
  listEl.innerHTML = jobs.map((job) => {
    const preview = (job.matched || []).slice(0, 5).map((s) => `<span class="mini">${s}</span>`).join('');
    return `
      <div class="job-card" data-id="${job.id}" data-region="${region}">
        <div class="job-top">
          <div>
            <div class="job-title">${job.title}</div>
            <div class="job-company">${job.company} · ${job.source}</div>
          </div>
          <span class="match-pill ${matchClass(job.score)}">${job.score}%</span>
        </div>
        <div class="job-meta">
          <span>📍 ${job.location || 'Remote'}</span>
          ${job.salary ? `<span>💰 ${job.salary}</span>` : ''}
        </div>
        ${VIEW_MODE === 'history' ? `<div class="job-history">${historyBadge(job)}</div>` : ''}
        ${preview ? `<div class="job-skill-preview">${preview}</div>` : ''}
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.job-card').forEach((card) => {
    card.addEventListener('click', () => openDetail(card.dataset.id, card.dataset.region));
  });
}

function bindTabs() {
  document.querySelectorAll('.region-tab').forEach((tab) => {
    tab.addEventListener('click', async () => {
      document.querySelectorAll('.region-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const region = tab.dataset.region;
      $('status').textContent = 'Cargando ofertas…';
      const data = VIEW_MODE === 'history' ? await loadHistory(region) : await loadJobs(region);
      CURRENT_JOBS = data;
      renderJobs(region, data);
      setStatus(data);
    });
  });
}

function bindToolbar() {
  $('btn-refresh').addEventListener('click', async () => {
    const btn = $('btn-refresh');
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = '🔄 Actualizando…';
    $('status').textContent = 'Consultando las fuentes de empleo en este momento…';
    try {
      await fetch('/api/refresh', { method: 'POST' });
    } catch {}
    const data = VIEW_MODE === 'history' ? await loadHistory(CURRENT_REGION) : await loadJobs(CURRENT_REGION);
    CURRENT_JOBS = data;
    renderJobs(CURRENT_REGION, data);
    setStatus(data);
    btn.disabled = false;
    btn.textContent = original;
  });

  $('btn-history-toggle').addEventListener('click', async () => {
    VIEW_MODE = VIEW_MODE === 'history' ? 'live' : 'history';
    const btn = $('btn-history-toggle');
    btn.classList.toggle('active', VIEW_MODE === 'history');
    btn.textContent = VIEW_MODE === 'history' ? '🔴 Ver solo activas' : '🕒 Últimos 30 días';
    $('status').textContent = 'Cargando…';
    const data = VIEW_MODE === 'history' ? await loadHistory(CURRENT_REGION) : await loadJobs(CURRENT_REGION);
    CURRENT_JOBS = data;
    renderJobs(CURRENT_REGION, data);
    setStatus(data);
  });
}

async function openDetail(id, region) {
  try {
    const res = await fetch(`/api/job?q=${encodeURIComponent(id)}`);
    if (res.ok) {
      const data = await res.json();
      return showDetail(data.job, data.summary, region);
    }
  } catch {}
  showDetail(lookupFallbackJob(id), null, region);
}

function lookupFallbackJob(id) {
  for (const list of Object.values(FALLBACK.jobs)) {
    const j = list.find((x) => x.id === id);
    if (j) return j;
  }
  return null;
}

function showDetail(job, summary, region) {
  if (!job) return;
  const s = summary || {
    companySummary: `${job.company} busca "${job.title}".`,
    requiredSkills: job.matched || [],
  };
  const langIsEn = region !== 'argentina';
  const wanted = (s.requiredSkills || []).map((x) => `<span class="w">${x}</span>`).join('');
  const gaps = (job.missed || []).map((x) => `<span class="g">${x}</span>`).join('');

  $('modal-body').innerHTML = `
    <h2 class="detail-title">${job.title}</h2>
    <div class="detail-meta">
      <span class="chip">🏢 ${job.company}</span>
      <span class="chip">📍 ${job.location || 'Remote'}</span>
      <span class="chip">${job.source}</span>
      <span class="chip match-pill ${matchClass(job.score)}">Match ${job.score}%</span>
    </div>
    <div class="detail-section">
      <h4>Resumen de la empresa</h4>
      <div class="company-summary">${s.companySummary}</div>
    </div>
    <div class="detail-section">
      <h4>Skills que buscan (que tenés)</h4>
      <div class="skills-wanted">${wanted || '<span class="muted">—</span>'}</div>
    </div>
    ${gaps ? `<div class="detail-section gap-skills"><h4>Skills que aún no están en tu CV</h4><div class="skills-wanted">${gaps}</div></div>` : ''}
    ${job.description ? `<div class="detail-section"><h4>Descripción</h4><div class="description">${job.description}</div></div>` : ''}
    <div class="btn-row">
      ${job.applyUrl && job.applyUrl !== '#' ? `<a class="btn" href="${job.applyUrl}" target="_blank" rel="noopener">${langIsEn ? 'Apply on portal' : 'Aplicar en el portal'}</a>` : ''}
      <button class="btn" id="btn-letter">${langIsEn ? 'Generate cover letter' : 'Generar carta de presentación'}</button>
      <button class="btn secondary" id="btn-copy-resume">${langIsEn ? 'Copy CV text' : 'Copiar resumen del CV'}</button>
    </div>
  `;
  $('modal').classList.remove('hidden');

  $('btn-letter').addEventListener('click', () => openCoverLetter(job.id, region));
  $('btn-copy-resume').addEventListener('click', copyResume);
}

async function openCoverLetter(id, region) {
  try {
    const res = await fetch(`/api/cover-letter?region=${region}&id=${encodeURIComponent(id)}`);
    if (res.ok) {
      const data = await res.json();
      return showLetter(data);
    }
  } catch {}
  showLetter({
    subject: `Postulación - ${CURRENT_JOBS.jobs?.find((j) => j.id === id)?.title || ''}`,
    body: `Hola equipo de ${CURRENT_JOBS.jobs?.find((j) => j.id === id)?.company || ''},\n\nMe postulo a la vacante con mi CV adjunto.\n\nSaludos,\n${PROFILE?.fullName || 'Ali Tovar'}`,
  });
}

function showLetter(letter) {
  $('letter-body').innerHTML = `
    <h3>${letter.subject}</h3>
    <div class="letter-body">${letter.body}</div>
    <div class="letter-actions">
      <button class="btn" id="btn-copy">Copiar carta</button>
      <a class="btn secondary" download="carta_presentacion.txt" id="btn-download" href="data:text/plain;charset=utf-8,${encodeURIComponent(letter.subject + '\n\n' + letter.body)}">Descargar .txt</a>
    </div>
  `;
  $('letter-modal').classList.remove('hidden');
  $('btn-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(letter.subject + '\n\n' + letter.body).then(() => {
      $('btn-copy').textContent = '✓ Copiada';
      setTimeout(() => { $('btn-copy').textContent = 'Copiar carta'; }, 1500);
    });
  });
}

function copyResume() {
  if (!PROFILE) return;
  const txt = `${PROFILE.fullName}\n${PROFILE.headline || PROFILE.title}\n${PROFILE.location}\n\n${PROFILE.summary || ''}`;
  navigator.clipboard.writeText(txt);
}

function bindModals() {
  ['modal-close', 'letter-close'].forEach((id) => {
    $(id).addEventListener('click', () => $(id === 'modal-close' ? 'modal' : 'letter-modal').classList.add('hidden'));
  });
  document.querySelectorAll('.modal').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hidden'); });
  });
}
