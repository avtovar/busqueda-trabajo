import { useState } from 'react';
import { matchClass, daysAgo } from '../utils.js';

const PAGE_SIZE = 10;

function HistoryBadge({ job }) {
  if (job.active === undefined) return null;
  if (job.active) return <span className="badge badge-active">🟢 Activa ahora</span>;
  const d = daysAgo(job.lastSeen);
  const label = d === null ? 'Vista anteriormente' : d <= 0 ? 'Vista hoy' : `Vista hace ${d} día${d === 1 ? '' : 's'}`;
  return <span className="badge badge-inactive">⚪ {label} (ya no aparece)</span>;
}

export default function JobList({ jobs, viewMode, onOpen }) {
  const [page, setPage] = useState(1);

  if (!jobs.length) {
    return (
      <div className="empty">
        {viewMode === 'history'
          ? 'Todavía no hay historial guardado para esta región. Corré una búsqueda primero.'
          : 'No se encontraron ofertas para esta región.'}
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageJobs = jobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div>
      <div className="job-list">
        {pageJobs.map((job) => (
          <div className="job-card" key={job.id} onClick={() => onOpen(job.id)}>
            <div className="job-top">
              <div>
                <div className="job-title">{job.title}</div>
                <div className="job-company">{job.company} · {job.source}</div>
              </div>
              <span className={`match-pill ${matchClass(job.score)}`}>{job.score}%</span>
            </div>
            <div className="job-meta">
              <span>📍 {job.location || 'Remote'}</span>
              {job.salary && <span>💰 {job.salary}</span>}
            </div>
            {viewMode === 'history' && (
              <div className="job-history"><HistoryBadge job={job} /></div>
            )}
            {job.matched && job.matched.length > 0 && (
              <div className="job-skill-preview">
                {job.matched.slice(0, 5).map((s) => <span className="mini" key={s}>{s}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn small secondary" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
            ← Anterior
          </button>
          <span className="pagination-info">
            Página {safePage} de {totalPages} · {jobs.length} ofertas
          </span>
          <button className="btn small secondary" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
