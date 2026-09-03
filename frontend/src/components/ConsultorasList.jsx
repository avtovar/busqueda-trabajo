import { useState } from 'react';
import { CATEGORY_CLASS } from '../utils.js';
import { saveConsultoraStatus } from '../api.js';

// Devuelve el dominio (host) de una URL, o '' si no tiene link.
function dominioDe(link) {
  if (!link) return '';
  try {
    return new URL(link).hostname;
  } catch {
    return '';
  }
}

// Muestra el favicon de la consultora vía el servicio de Google (que resuelve
// el logo/favicon del dominio). Si no tiene link/dominio, cae a un placeholder
// circular con la inicial del nombre.
function ConsultoraLogo({ link, name }) {
  const dominio = dominioDe(link);
  return (
    <span className="consultora-logo">
      {dominio ? (
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(dominio)}&sz=64`}
          alt={`Logo de ${name}`}
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <span className="consultora-logo-init">{name.charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}

export default function ConsultorasList({ consultoras, estados, onChange }) {
  const [filtroCat, setFiltroCat] = useState('Todas');

  if (!consultoras.length) {
    return <div className="empty">No se pudo cargar el listado de consultoras. Probá recargar la página.</div>;
  }

  const categorias = ['Todas', ...new Set(consultoras.map((c) => c.category))];
  const filtradas = filtroCat === 'Todas' ? consultoras : consultoras.filter((c) => c.category === filtroCat);

  function handleEstadoChange(id, estado) {
    onChange(id, { estado });
    saveConsultoraStatus(id, { estado, fecha: new Date().toISOString().slice(0, 10) });
  }

  function handleNotasBlur(id, notas) {
    saveConsultoraStatus(id, { notas });
  }

  return (
    <div>
      <div className="consultoras-filter">
        <label className="filter-label" htmlFor="filtro-categoria">Filtrar por categoría:</label>
        <select
          id="filtro-categoria"
          className="estado-select"
          value={filtroCat}
          onChange={(e) => setFiltroCat(e.target.value)}
        >
          {categorias.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <span className="pagination-info">{filtradas.length} consultoras</span>
      </div>
      <div className="job-list">
        {filtradas.map((c) => (
        <div className="job-card consultora-card" key={c.id}>
          <div className="job-top">
            <ConsultoraLogo link={c.link} name={c.name} />
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
    </div>
  );
}
