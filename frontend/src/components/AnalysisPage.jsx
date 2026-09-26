// Página "Propuesta de Interés": qué pide el mercado, qué cubre el CV de Ali,
// brechas detectadas y recomendaciones de mejora. Se renderiza con barras CSS
// (sin librerías externas) a partir del agregado /api/analytics.

// Convierte una clave de región ('argentina', 'eeuu'...) en su bandera emoji.
function flagRegion(region) {
  const flags = { argentina: '🇦🇷', mexico: '🇲🇽', peru: '🇵🇪', colombia: '🇨🇴', chile: '🇨🇱', europa: '🇪🇺', eeuu: '🇺🇸' };
  // ↑ Mapa región -> bandera, igual que en las tabs pero en formato emoji.
  return flags[region] || '🌎';
  // ↑ Si la región no está en el mapa, devolvemos un globo como respaldo.
}

// Sub-componente simple: una tarjeta KPI (valor grande + etiqueta + subtítulo).
function Kpi({ label, value, sub }) {
  return (
    <div className="kpi">
      <div className="kpi-value">{value}</div>
      {/* ↑ El número grande, con el texto degradado que define el CSS. */}
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      {/* ↑ Render condicional: el subtítulo solo aparece si viene por props. */}
    </div>
  );
}

import { linkedinSearchUrl } from '../utils.js';
// ↑ Importamos la función que arma el link de búsqueda de LinkedIn (del archivo utils).

// Página completa del análisis. Recibe `data` (analítica del backend), `profile` y
// los controles de búsqueda para mostrarlos en la misma línea que el título.
export default function AnalysisPage({ data, profile, viewMode, refreshing, onRefresh, onToggleHistory, linkedinKeywords }) {
  // ↑ Desestructuración de props: data trae KPIs/barras/recs; profile identifica al candidato.

  if (!data) return <div className="empty">No hay datos para analizar todavía. Probá actualizar la búsqueda.</div>;
  // ↑ Guardia: sin datos no hay análisis que pintar, mostramos un mensaje vacío.

  // Extraemos del payload todo lo que la página va a usar, con || [] como respaldo
  // para que .map() nunca reciba undefined.
  const total = data.total || 0;
  const avg = data.avgScore || 0;
  const missing = data.missingSkills || [];
  // ↑ Skills pedidas por el mercado y ausentes en el CV (brechas).
  const strong = data.strongSkills || [];
  const skillStats = data.skillStats || [];
  const byRegion = data.byRegion || [];
  const recs = data.recommendations || [];
  const candidato = data.candidato || {};
  const profileSkills = Object.entries(profile?.skills || {});
  const projects = candidato.proyectos || [];
  const githubEvidence = data.githubEvidence || [];
  const projection = data.matchProjection;
  const projectByName = new Map(projects.map((project) => [project.nombre, project]));
  const githubLanguages = [...new Set(projects.map((project) => project.lenguaje).filter(Boolean))];

  // El % más alto de demanda: sirve para escalar el ancho de todas las barras.
  const maxPct = Math.max(1, ...skillStats.map((s) => s.pct));
  // ↑ Math.max con ... (spread) recibe todos los pct; el 1 evita dividir por 0.

  const topDemand = skillStats[0];
  // ↑ El primer item del arreglo = el skill más pedido (ya viene ordenado).

  // % aproximado de cobertura del CV: ofertas totales menos las que piden skills
  // que faltan, sobre el total. Es una métrica simple, no un match por oferta.
  const coverPct = total ? Math.round(((total - missing.reduce((a, m) => a + m.jobsRequesting, 0)) / total) * 100) : 0;
  // ↑ .reduce() suma los jobsRequesting de cada brecha; sin ofertas queda 0.

  return (
    <div className="analysis">
      <div className="analysis-head">
        <div className="analysis-title">
          <h2>Propuesta de Interés</h2>
          <p>
            Análisis de las <strong>{total}</strong> vacantes QA detectadas en todas las regiones, comparadas con el CV de{' '}
            {/* ↑ {' '}: espacio "duro" en JSX para que la palabra siguiente no se pegue. */}
            <strong>{profile?.fullName || 'Ali Tovar'}</strong>.
            {/* ↑ Optional chaining: si profile es null, no explota; usa el nombre por defecto. */}
          </p>
        </div>
        {/* ↑ Bloque izquierdo de la línea: título + descripción de la propuesta. */}

        {/* Acciones en la misma línea que la Propuesta, por orden de prioridad:
            actualizar búsqueda → historial desde enero → buscar en LinkedIn. */}
        <div className="analysis-actions">
          <button className="btn small" onClick={onRefresh} disabled={refreshing} title="Volver a consultar las fuentes y recalcular el análisis">
            {refreshing ? '🔄 Actualizando…' : '🔄 Actualizar búsqueda'}
          </button>
          <button
            className={`btn small secondary${viewMode === 'history' ? ' active' : ''}`}
            // ↑ La clase 'active' solo se agrega cuando estás viendo el historial.
            onClick={onToggleHistory}
            title="Ver ofertas vistas desde enero 2026"
          >
            {viewMode === 'history' ? '🔴 Ver solo activas' : '🕒 Desde enero 2026'}
            {/* ↑ El texto del botón cambia según la vista: es un "toggle" visual. */}
          </button>
          <a
            className="btn small secondary"
            href={linkedinSearchUrl(linkedinKeywords, profile?.region || 'argentina')}
            target="_blank"
            rel="noopener noreferrer"
            title="Buscar roles QA y skills de automatización del perfil, publicados durante los últimos 30 días"
          >
            🔗 LinkedIn · QA y automatización · 30 días
          </a>
          {/* ↑ Es un <a>, no un <button>: porque navega a una URL generada con
              las keywords del perfil (sin scrapear nada). */}
        </div>
      </div>

      {/* Fila de tarjetas KPI con los números principales del mercado. */}
      <div className="kpis">
        <Kpi value={total} label="Vacantes detectadas" sub="Todas las regiones" />
        <Kpi value={`${avg}%`} label="Match promedio" sub="con tu CV actual" />
        <Kpi value={missing.length} label="Brechas de skills" sub="pedidas y no cubiertas" />
        {topDemand && (
          // ↑ Este KPI extra solo aparece si hay al menos un skill en el ranking.
          <Kpi value={topDemand.pct + '%'} label="Skill más pedido" sub={topDemand.name} />
        )}
        {projection && (
          <Kpi
            value={`${projection.estimatedAvgScore}%`}
            label="Match potencial"
            sub={`${projection.delta > 0 ? '+' : ''}${projection.delta} pp vs. el actual · skills de GitHub a verificar`}
          />
        )}
      </div>

      <section className="analisis-section source-section">
        <h3>Tu perfil por fuente</h3>
        <div className="source-grid">
          <article className="source-card">
            <div className="source-heading">
              <h4>CV</h4>
              <span className="source-status">{candidato.skillCount || profileSkills.length} skills</span>
            </div>
            <p className="source-title">{candidato.headline || profile?.headline || candidato.titulo}</p>
            <p className="source-detail">{candidato.experienciaAños || profile?.yearsExperience || 0} años · {candidato.location || profile?.location}</p>
            <p className="source-summary">{candidato.summary || profile?.summary}</p>
            <details className="source-more">
              <summary>Ver las {profileSkills.length} skills registradas</summary>
              <div className="skill-tags">
                {profileSkills.map(([name, weight]) => (
                  <span className="tag" key={name}>{name} ({Math.round(weight * 100)}%)</span>
                ))}
              </div>
            </details>
          </article>

          <article className="source-card">
            <div className="source-heading">
              <h4>LinkedIn</h4>
              <span className="source-status">Enlace configurado</span>
            </div>
            <p className="source-detail">Titular guardado en el perfil del CV</p>
            <p className="source-title">{candidato.headline || profile?.headline || candidato.titulo}</p>
            {candidato.linkedin && (
              <a className="source-link" href={candidato.linkedin} target="_blank" rel="noopener noreferrer">Abrir perfil de LinkedIn ↗</a>
            )}
            <p className="source-note">No se importan datos directamente desde LinkedIn.</p>
          </article>

          <article className="source-card">
            <div className="source-heading">
              <h4>GitHub</h4>
              <span className="source-status">{projects.length} proyectos registrados</span>
            </div>
            <p className="source-title">{githubLanguages.join(' · ') || 'Sin lenguajes registrados'}</p>
            <p className="source-detail">Portfolio configurado para contrastar evidencia con skills del CV.</p>
            {candidato.github && (
              <a className="source-link" href={candidato.github} target="_blank" rel="noopener noreferrer">Abrir perfil de GitHub ↗</a>
            )}
          </article>
        </div>
      </section>

      <section className="analisis-section">
        <h3>Skills detectadas en GitHub que no figuran en el CV</h3>
        <p className="analisis-note">Estimación orientativa: se simula un peso inicial del 50% para estas skills; la evidencia del repositorio no confirma por sí sola experiencia profesional.</p>
        {githubEvidence.length ? (
          <div className="github-evidence">
            {githubEvidence.map((skill) => (
              <div className="evidence-row" key={skill.name}>
                <strong>{skill.name}</strong>
                <div className="evidence-projects">
                  {skill.projects.map((projectName) => {
                    const project = projectByName.get(projectName);
                    return project ? (
                      <a key={projectName} href={project.url} target="_blank" rel="noopener noreferrer">{projectName}</a>
                    ) : <span key={projectName}>{projectName}</span>;
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="analisis-note">Los proyectos registrados no muestran skills adicionales del listado de mercado.</p>
        )}
      </section>

      {/* Gráfico de demanda vs CV */}
      <section className="analisis-section">
        <h3>¿Qué pide el mercado vs. qué tenés en tu CV?</h3>
        <p className="analisis-note">% de vacantes que piden cada skill. Verde = ya está en tu CV · Rojo = brecha real.</p>
        <div className="bars">
          {skillStats.slice(0, 16).map((s) => (
            // ↑ Recorremos los primeros 16 skills (slice recorta el arreglo).
            <div className={`bar-row${s.has ? ' have' : ' gap'}`} key={s.name}>
              {/* ↑ La clase 'have' (verde) o 'gap' (rojo) depende de si el CV lo tiene.
                  key={s.name} da identidad única a cada fila de barras. */}
              <div className="bar-label">
                {s.name} <span className="bar-pct">({s.pct}%)</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${Math.round((s.pct / maxPct) * 100)}%` }} />
                {/* ↑ El ancho de la barra se inyecta inline. Escalamos contra maxPct
                    para que la más grande llegue al 100% y las demás sean proporcionales. */}
                {s.has && <span className="badge-cv">en tu CV</span>}
                {/* ↑ La etiqueta "en tu CV" se posiciona con CSS sobre la barra. */}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Brechas */}
      <section className="analisis-section">
        <h3>Lo que tenés que mejorar primero (brechas)</h3>
        {missing.length === 0 ? (
          <p className="analisis-note">¡No se detectaron brechas! Tu perfil cubre todo lo que pide el mercado relevado.</p>
          // ↑ Mensaje feliz: sin brechas, no hay chips rojos que mostrar.
        ) : (
<div className="gap-list">
            {missing.slice(0, 12).map((m) => (
              <span className="gap-chip" key={m.name} title={`Pedido en ${m.jobsRequesting} vacantes`}>
                {/* ↑ title = tooltip del navegador al pasar el mouse por encima. */}
                {m.name} · {m.pct}%
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Fortalezas */}
      <section className="analisis-section">
        <h3>Tus fortalezas según el mercado</h3>
        <div className="strengths">
          {strong.map((s) => (
            <span className="strong-chip" key={s.name}>{s.name} ({s.pct}%)</span>
            // ↑ Chips verdes con las skills que el CV ya cubre y cuánto se piden.
          ))}
        </div>
      </section>

      {/* Video por región */}
      <section className="analisis-section">
        <h3>Demanda por región</h3>
        <div className="region-bars">
          {byRegion.map((r) => (
            <div className="bar-row" key={r.region}>
              {/* ↑ key con la clave de región, que es única en el arreglo. */}
              <div className="bar-label">{flagRegion(r.region)} {r.label} · {r.count} vacantes · match {r.avgScore}%</div>
              <div className="bar-track">
                <div className="bar-fill region" style={{ width: `${Math.min(100, (r.count / Math.max(1, Math.max(...byRegion.map((x) => x.count)))) * 100)}%` }} />
                {/* ↑ Ancho = % de vacantes de esta región sobre la región con más vacantes.
                    Math.min(100, ...) garantiza que nunca supere el 100%. */}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* GitHub y proyectos de portafolio */}
      <section className="analisis-section">
        <h3>GitHub y proyectos</h3>
        <p className="analisis-note">
          {candidato.github ? (
            // ↑ Si el perfil trae GitHub, mostramos el link directo (se abre en otra pestaña).
            <a href={candidato.github} target="_blank" rel="noreferrer">{candidato.github.replace('https://', '')}</a>
          ) : (
            'github.com/avtovar'
          )}{' '}
          · repos públicos con ejemplos de testing, automatización y desarrollo.
        </p>
        <div className="projects">
          {(candidato.proyectos || []).map((p) => (
            // ↑ Recorremos los proyectos del perfil; cada uno es una tarjeta con link.
            <article className="project-card" key={p.url}>
              <div className="project-head">
                <a href={p.url} target="_blank" rel="noreferrer"><strong>{p.nombre}</strong></a>
                {p.lenguaje && <span className="project-lang">{p.lenguaje}</span>}
              </div>
              <p className="project-desc">{p.descripcion}</p>
              {p.home && (
                // ↑ Solo si la repo tiene demo publicada, aparece el botón "Ver demo".
                <a className="project-demo" href={p.home} target="_blank" rel="noreferrer">Ver demo ↗</a>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* Recomendaciones */}
      <section className="analisis-section">
        <h3>Recomendaciones</h3>
        <ul className="recs">
          {recs.map((r, i) => (
            // ↑ Usamos el índice i como key: las recs no tienen id propio y no
            //   cambian de orden, así que alcanza.
            <li key={i} className={`rec rec-${(r.priority || 'baja').toLowerCase()}`}>
              {/* ↑ La clase del borde lateral depende de la prioridad (alta/media/baja). */}
              <span className="rec-prio">{r.icon} {r.priority}</span> {r.text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}