import { matchClass, daysAgo } from '../utils.js';

function HistoryBadge({ job }) {
  if (job.active === undefined) return null;
  if (job.active) return <span className="badge badge-active">🟢 Activa ahora</span>;
  const d = daysAgo(job.lastSeen);
  const label = d === null ? 'Vista anteriormente' : d <= 0 ? 'Vista hoy' : `Vista hace ${d} día${d === 1 ? '' : 's'}`;
  return <span className="badge badge-inactive">⚪ {label} (ya no aparece)</span>;
}

export default function JobList({ jobs, viewMode, onOpen }) {
  if (!jobs.length) {
    return (
      <div className="empty">
        {viewMode === 'history'
          ? 'Todavía no hay historial guardado para esta región. Corré una búsqueda primero.'
          : 'No se encontraron ofertas para esta región.'}
      </div>
    );
  }

  return (
    <div className="job-list">
      {jobs.map((job) => (
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
  );
}
