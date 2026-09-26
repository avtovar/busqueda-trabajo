import { useState } from 'react';
// ↑ Hook useState: la paginación necesita memoria interna (en qué página estamos).

import { matchClass, daysAgo, formatDisplayDate } from '../utils.js';
// ↑ Helpers: matchClass (color del % de match) y daysAgo (días desde la última vista).

const PAGE_SIZE = 10;
// ↑ Cantidad de ofertas que se muestran por página (constante fija, se corta la lista).
const DISMISSED_STORAGE_KEY = 'buscaempleo-dismissed-jobs';

function jobDismissKey(job) {
  return `${job.title}::${job.company}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function loadDismissedJobs() {
  try {
    const stored = JSON.parse(localStorage.getItem(DISMISSED_STORAGE_KEY) || '[]');
    return new Set(Array.isArray(stored) ? stored.filter((value) => typeof value === 'string') : []);
  } catch {
    return new Set();
  }
}

function publicationTimestamp(job) {
  const raw = job.date;
  if (!raw) return null;
  const value = String(raw).trim();
  if (/^\d{10,13}$/.test(value)) {
    const numeric = Number(value);
    return numeric < 1e12 ? numeric * 1000 : numeric;
  }
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

// Sub-componente local: el "badge" que indica si una oferta del historial sigue
// activa o ya no aparece. No se exporta porque solo lo usa JobList.
function HistoryBadge({ job }) {
  // ↑ Recibe solo el job por props para decidir qué mensaje mostrar.

  if (job.active === undefined) return null;
  // ↑ Guardia: si la oferta no tiene el campo `active`, no pintamos ningún badge.

  if (job.active) {
    return (
      <span className="badge badge-active" title="Esta oferta apareció en la última búsqueda; no se verifica su estado en la empresa.">
        🟢 Aparece en la última búsqueda
      </span>
    );
  }
  // ↑ Render condicional: oferta activa = badge verde "Activa ahora".

  // Si ya no aparece, calculamos hace cuánto se la vio por última vez.
  const d = daysAgo(job.lastSeen);
  const label = d === null ? 'vista anteriormente' : d <= 0 ? 'vista hoy' : `vista hace ${d} día${d === 1 ? '' : 's'}`;
  const lastSeen = formatDisplayDate(job.lastSeen);
  // ↑ Ternarios anidados para armar el texto: maneja sin fecha, hoy, 1 día o varios.
  return (
    <span className="badge badge-inactive" title="La última búsqueda no la devolvió. Esto no confirma que la empresa haya cubierto la vacante.">
      ⚪ No aparece en la última búsqueda · {lastSeen ? `vista ${lastSeen} (${label})` : label}
    </span>
  );
}

// Lista de ofertas de la región: recibe jobs, el modo de vista y el callback onOpen.
export default function JobList({ jobs, viewMode, onOpen }) {
  // ↑ Props desestructurados. onOpen viene del padre: se ejecuta al clickear una card.

  const [page, setPage] = useState(1);
  // ↑ Estado interno de paginación: empieza en la página 1. No le importa al padre.

  const [sortOrder, setSortOrder] = useState('newest');
  const [dismissedJobs, setDismissedJobs] = useState(loadDismissedJobs);

  function dismissJob(job) {
    const next = new Set(dismissedJobs);
    next.add(jobDismissKey(job));
    setDismissedJobs(next);
    try {
      localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...next]));
    } catch {}
    setPage(1);
  }

  function restoreDismissedJobs() {
    setDismissedJobs(new Set());
    try {
      localStorage.removeItem(DISMISSED_STORAGE_KEY);
    } catch {}
  }

  // Si no hay ofertas, mostramos un mensaje vacío según la vista (historial o live).
  if (!jobs.length) {
    return (
      <div className="empty">
        {viewMode === 'history'
          ? 'Todavía no hay historial guardado para esta región. Corré una búsqueda primero.'
          : 'No se encontraron ofertas para esta región.'}
        {/* ↑ Ternario dentro del JSX: el mensaje depende del modo de visualización. */}
      </div>
    );
  }

  const visibleJobs = jobs
    .filter((job) => !dismissedJobs.has(jobDismissKey(job)))
    .sort((left, right) => {
      const leftDate = publicationTimestamp(left);
      const rightDate = publicationTimestamp(right);
      if (leftDate === null && rightDate !== null) return 1;
      if (rightDate === null && leftDate !== null) return -1;
      if (leftDate === null || rightDate === null) return 0;
      return sortOrder === 'newest' ? rightDate - leftDate : leftDate - rightDate;
    });
  const visibleTotalPages = Math.max(1, Math.ceil(visibleJobs.length / PAGE_SIZE));

  // Si el usuario avanzó y hubo menos resultados, corregimos la página actual.
  const safePage = Math.min(page, visibleTotalPages);

  // pageJobs = "rebanada" de la lista según la página: de (página-1)*10 a página*10.
  const pageJobs = visibleJobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  // ↑ .slice() no modifica el arreglo original, devuelve una copia recortada.

  return (
    <div>
      <div className="job-list-controls">
        <label className="job-sort-control">
          Ordenar por
          <select
            className="job-sort-select"
            aria-label="Ordenar ofertas por fecha de publicación"
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value);
              setPage(1);
            }}
          >
            <option value="newest">Más nuevas primero</option>
            <option value="oldest">Más antiguas primero</option>
          </select>
        </label>
        {dismissedJobs.size > 0 && (
          <button className="btn small secondary" type="button" onClick={restoreDismissedJobs}>
            Restaurar ofertas quitadas ({dismissedJobs.size})
          </button>
        )}
      </div>
      {visibleJobs.length === 0 ? (
        <div className="empty">Quitaste todas las ofertas de esta vista. Puedes restaurarlas cuando quieras.</div>
      ) : (
        <div className="job-list">
          {pageJobs.map((job) => (
            <article className="job-card" key={job.id}>
              <button className="job-open" type="button" onClick={() => onOpen(job.id)}>
                <div className="job-top">
                  <div>
                    <div className="job-title">{job.title}</div>
                    <div className="job-company">{job.company} · {job.source}</div>
                  </div>
                  <span className={`match-pill ${matchClass(job.score)}`}>{job.score}%</span>
                </div>
                <div className="job-meta">
                  <span>📍 {job.location || 'Remote'}</span>
                  <span>📅 Publicada: {formatDisplayDate(job.date) || 'fecha no informada'}</span>
                  {job.modality && <span>🕒 {job.modality}</span>}
                  {job.salary && <span>💰 {job.salary}</span>}
                </div>
                {viewMode === 'history' && (
                  <div className="job-history"><HistoryBadge job={job} /></div>
                )}
                {job.matched && job.matched.length > 0 && (
                  <div className="job-skill-preview">
                    {job.matched.slice(0, 5).map((skill) => <span className="mini" key={skill}>{skill}</span>)}
                  </div>
                )}
              </button>
              <button
                className="job-dismiss"
                type="button"
                onClick={() => dismissJob(job)}
                aria-label={`Quitar ${job.title} de mi lista`}
                title="Solo la oculta en este navegador; no informa a la empresa."
              >
                Quitar de mi lista
              </button>
            </article>
          ))}
        </div>
      )}

      {/* La paginación solo se muestra si hay más de una página. */}
      {visibleJobs.length > 0 && visibleTotalPages > 1 && (
        <div className="pagination">
          <button className="btn small secondary" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
            ← Anterior
          </button>
          {/* ↑ disabled en la primer página: el botón no hace nada y se ve apagado. */}
          <span className="pagination-info">
            Página {safePage} de {visibleTotalPages} · {visibleJobs.length} ofertas
          </span>
          <button className="btn small secondary" disabled={safePage >= visibleTotalPages} onClick={() => setPage(safePage + 1)}>
            Siguiente →
          </button>
          {/* ↑ setPage cambia el estado y React re-renderiza con la página nueva. */}
        </div>
      )}
    </div>
  );
}