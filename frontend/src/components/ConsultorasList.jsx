import { CATEGORY_CLASS } from '../utils.js';
import { saveConsultoraStatus } from '../api.js';

export default function ConsultorasList({ consultoras, estados, onChange }) {
  if (!consultoras.length) {
    return <div className="empty">No se pudo cargar el listado de consultoras. Probá recargar la página.</div>;
  }

  function handleEstadoChange(id, estado) {
    onChange(id, { estado });
    saveConsultoraStatus(id, { estado, fecha: new Date().toISOString().slice(0, 10) });
  }

  function handleNotasBlur(id, notas) {
    saveConsultoraStatus(id, { notas });
  }

  return (
    <div className="job-list">
      {consultoras.map((c) => (
        <div className="job-card consultora-card" key={c.id}>
          <div className="job-top">
            <div>
              <div className="job-title">{c.name}</div>
              <div className="job-company">{c.city || ''}</div>
            </div>
            <span className={`cat-pill ${CATEGORY_CLASS[c.category] || ''}`}>{c.category}</span>
          </div>
          {c.note && <div className="job-meta"><span>{c.note}</span></div>}
          <div className="consultora-controls" onClick={(e) => e.stopPropagation()}>
            <select
              className="estado-select"
              value={c.estado}
              onChange={(e) => handleEstadoChange(c.id, e.target.value)}
            >
              {estados.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            {c.link && (
              <a className="btn small secondary" href={c.link} target="_blank" rel="noopener noreferrer">
                🔗 Ver perfil
              </a>
            )}
            <input
              className="notas-input"
              type="text"
              placeholder="Notas (contacto, entrevistador, etc.)"
              defaultValue={c.notas || ''}
              onBlur={(e) => handleNotasBlur(c.id, e.target.value)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
