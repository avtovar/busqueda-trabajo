import { matchClass, linkedinSearchUrl } from '../utils.js';

export default function JobDetailModal({ job, summary, region, profile, onClose, onGenerateLetter }) {
  if (!job) return null;
  const s = summary || {
    companySummary: `${job.company} busca "${job.title}".`,
    requiredSkills: job.matched || [],
  };
  const langIsEn = region !== 'argentina';
  const wanted = s.requiredSkills || [];
  const gaps = job.missed || [];

  function copyResume() {
    if (!profile) return;
    const txt = `${profile.fullName}\n${profile.headline || profile.title}\n${profile.location}\n\n${profile.summary || ''}`;
    navigator.clipboard.writeText(txt);
  }

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">&times;</button>
        <h2 className="detail-title">{job.title}</h2>
        <div className="detail-meta">
          <span className="chip">🏢 {job.company}</span>
          <span className="chip">📍 {job.location || 'Remote'}</span>
          <span className="chip">{job.source}</span>
          <span className={`chip match-pill ${matchClass(job.score)}`}>Match {job.score}%</span>
        </div>
        <div className="detail-section">
          <h4>Resumen de la empresa</h4>
          <div className="company-summary">{s.companySummary}</div>
        </div>
        <div className="detail-section">
          <h4>Skills que buscan (que tenés)</h4>
          <div className="skills-wanted">
            {wanted.length
              ? wanted.map((x) => <span className="w" key={x}>{x}</span>)
              : <span className="muted">—</span>}
          </div>
        </div>
        {gaps.length > 0 && (
          <div className="detail-section gap-skills">
            <h4>Skills que aún no están en tu CV</h4>
            <div className="skills-wanted">
              {gaps.map((x) => <span className="g" key={x}>{x}</span>)}
            </div>
          </div>
        )}
        {job.description && (
          <div className="detail-section">
            <h4>Descripción</h4>
            <div className="description" dangerouslySetInnerHTML={{ __html: job.description }} />
          </div>
        )}
        <div className="btn-row">
          {job.applyUrl && job.applyUrl !== '#' && (
            <a className="btn" href={job.applyUrl} target="_blank" rel="noopener noreferrer">
              {langIsEn ? 'Apply on portal' : 'Aplicar en el portal'}
            </a>
          )}
          <button className="btn" onClick={() => onGenerateLetter(job.id, region)}>
            {langIsEn ? 'Generate cover letter' : 'Generar carta de presentación'}
          </button>
          <button className="btn secondary" onClick={copyResume}>
            {langIsEn ? 'Copy CV text' : 'Copiar resumen del CV'}
          </button>
          <a
            className="btn secondary"
            href={linkedinSearchUrl(`${job.title} ${job.company}`, region)}
            target="_blank"
            rel="noopener noreferrer"
            title={langIsEn ? 'Search on LinkedIn (not scraped, opens LinkedIn directly)' : 'Buscar en LinkedIn (no se scrapea, abre LinkedIn directamente)'}
          >
            🔗 {langIsEn ? 'Search on LinkedIn' : 'Buscar en LinkedIn'}
          </a>
        </div>
      </div>
    </div>
  );
}
