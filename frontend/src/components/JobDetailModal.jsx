import { useState } from 'react';
// ↑ useState: recordamos si el resumen ya se copió para cambiar el texto del botón.

import { matchClass, linkedinSearchUrl, portalInfo, jobDestination, noDestinationText, usableUrl } from '../utils.js';
// ↑ matchClass (color del % de match), linkedinSearchUrl (búsqueda genérica de
//   LinkedIn por título+empresa) y los helpers de procedencia: portalInfo,
//   jobDestination y noDestinationText. Los tres últimos son los que garantizan
//   que este modal NUNCA quede sin salida: si la oferta no tiene link directo,
//   cae al link de su búsqueda, y si no tiene ninguno se lo dice al usuario.
import LanguageBadge from './LanguageBadge.jsx';
// ↑ La MISMA etiqueta de idioma (ES/EN) que se ve en la tarjeta de la lista. Se
//   importa del componente compartido y no se re-dibuja acá para que las dos
//   vistas no se desincronicen. Va también en este modal porque es ACÁ donde el
//   usuario lee la descripción larga de la oferta, y desde ahí ve si tiene que
//   empezar a leer en inglés o en castellano.

// Copia texto al portapapeles usando la API moderna del navegador, o un fallback.
function copyText(txt) {
  if (navigator.clipboard && window.isSecureContext) {
    // ↑ isSecureContext = estamos en HTTPS (o localhost), donde clipboard funciona.
    return navigator.clipboard.writeText(txt);
    // ↑ Devuelve una Promise: el que la llama puede encadenar .then().
  }
  // Fallback clásico: creamos un <textarea> momentáneo fuera de pantalla,
  // lo seleccionamos y "copiamos" con execCommand, el viejo truco que funciona
  // hasta en contextos no seguros.
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    // ↑ Invisible pero presente en el documento (requisito para poder seleccionarlo).
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy') ? resolve() : reject(new Error('copy falló'));
    } catch (e) {
      reject(e);
    } finally {
      document.body.removeChild(ta);
      // ↑ Limpieza: sacamos el textarea trucho del DOM pase lo que pase.
    }
  });
}

// Modal de detalle de una oferta. Recibe la oferta, su resumen, región, el perfil
// y dos callbacks del padre: onClose (cerrar modal) y onGenerateLetter (crear carta).
export default function JobDetailModal({ job, summary, region, profile, onClose, onGenerateLetter }) {
  // ↑ Toda la desestructuración de props en la firma. El padre decide qué mandar.

  const [copied, setCopied] = useState(false);
  // ↑ Estado que controla el mensaje "✓ Resumen copiado" temporal del botón.

  if (!job) return null;
  // ↑ Guardia temprana: sin oferta no hay nada que mostrar, devolvemos null.

  // Resumen de la API; si no vino, armamos uno mínimo con los datos de la oferta.
  const s = summary || {
    companySummary: `${job.company} busca "${job.title}".`,
    requiredSkills: job.matched || [],
  };

  // Idiomas: en Europa y EE.UU. la UI se muestra en inglés.
  const langIsEn = region === 'europa' || region === 'eeuu';
  // ↑ OJO con el nombre: 'langIsEn' es el idioma de la INTERFAZ (el texto de los
  //   botones de abajo), elegido por región. NO tiene nada que ver con el idioma
  //   de la OFERTA, que es otro dato distinto y va aparte en <LanguageBadge/>.
  //   Son dos "idiomas" que casualmente se llaman parecido, así que no se mezclan.
  //   La clave de la región es exactamente 'eeuu' (con dos 'e'), como está
  //   definido en RegionTabs.jsx y en REGION_LOCATION de utils.js.

  const wanted = s.requiredSkills || [];
  // ↑ Skills que pide la oferta y que Ali ya tiene.

  const portal = portalInfo(job);
  // ↑ De dónde salió la oferta. Se calcula UNA vez y se usa en el chip de
  //   procedencia y en el texto del link, para que los dos digan lo mismo.

  const destination = jobDestination(job, { langIsEn });
  // ↑ El MEJOR destino disponible, ya resuelto: applyUrl si es real, si no
  //   sourceUrl (la búsqueda en el portal), si no null. Antes el botón se
  //   renderizaba solo con applyUrl y las 18 ofertas curadas sin link se
  //   quedaban sin ningún botón, sin explicación.

  const searchUrl = usableUrl(job.sourceUrl);
  // ↑ El link de búsqueda por separado, porque en la línea de procedencia se
  //   muestra aunque haya link directo (el usuario quiere saber dónde se encontró).
  const gaps = job.missed || [];
  // ↑ Skills que pide la oferta y NO están en el CV (brechas).

  // Arma el "resumen de CV" adaptado a esta oferta: nombre + skills pedidas +
  // headline + dato de postulación + resumen del perfil. Texto plano para pegar.
  function buildResumeText() {
    const skills = wanted.join(', ');
    const headline = profile.headline || profile.title || '';
    // ↑ Arma un arreglo con nombre, headline y ubicación, y filtra vacíos.
    const header = [profile.fullName, headline, profile.location].filter(Boolean);
    // ↑ filter(Boolean) elimina cualquier valor "falso" ('' o null) del arreglo.
    const lines = [];
    if (skills) {
      lines.push(`${profile.fullName} — ${skills}.`);
      lines.push(`${headline}.`);
    } else {
      lines.push(profile.fullName);
      lines.push(`${headline}.`);
    }
    lines.push('');
    lines.push(`Aplico a: ${job.title} en ${job.company}.`);
    lines.push(profile.summary || '');
    return lines.join('\n');
    // ↑ Unimos todas las líneas con un salto real de línea para que quede legible.
  }

  // Copia el resumen y muestra el feedback "copiado" durante 2 segundos.
  function copyResume() {
    if (!profile) return;
    // ↑ Sin perfil no hay nada que armar ni copiar.
    const txt = buildResumeText();
    copyText(txt)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        // ↑ setTimeout revierte el "copiado" a los 2s para volver a mostrar el botón normal.
      })
      .catch(() => {
        window.prompt('Copiá el texto manualmente (Ctrl+C):', txt);
      });
    // ↑ Si la copia automática falló, un prompt deja copiar el texto a mano.
  }

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      {/* ↑ Si el click cae sobre el FONDO oscuro (no el contenido), cerramos el modal.
          e.target vs e.currentTarget distingue "dónde se hizo click". */}
      <div className="modal-content">
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">&times;</button>
        {/* ↑ Botón X: onClose lo mandó el padre para avisarle que se cierre. */}
        <h2 className="detail-title">{job.title}</h2>
        <div className="detail-meta">
          <span className="chip">🏢 {job.company}</span>
          <span className="chip">📍 {job.location || 'Remote'}</span>
          {job.modality && <span className="chip">🕒 {job.modality}</span>}
          {/* ↑ Modalidad del puesto (full time, home office, híbrido X días) si viene en el empleo. */}
          <span className={`chip portal-badge portal-${portal.slug}`}>
            {/* ↑ Procedencia: el chip dice ENCONTRADA EN {portal} y no repite el
                `source` crudo. `source` es texto libre legacy con 44 variantes
                ("Reclutador (LinkedIn)", "Directo (link)"), no dice de qué portal
                es la oferta; el portal sí, y lo calcula el backend del link real. */}
            <span aria-hidden="true">{portal.icon}</span>
            {langIsEn ? 'Found on' : 'Encontrada en'} <strong>{portal.name}</strong>
          </span>
          {searchUrl && (
            <a
              className="chip chip-link"
              href={searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={langIsEn ? 'Open the search where this job was found' : 'Abrir la búsqueda en el portal donde se encontró esta oferta'}
            >
              🔎 {langIsEn ? 'see the search' : 'ver la búsqueda'}
              {/* ↑ Destino alternativo SIEMPRE visible, incluso con link directo:
                  el reporte del usuario era justamente no saber de dónde salió
                  cada oferta, y "ver la búsqueda" responde eso siempre. */}
            </a>
          )}
          {job.source && job.source !== portal.name && (
            <span className="chip muted" title="Origen anotado a mano en la base de ofertas">{job.source}</span>
            // ↑ `source` queda como dato secundario, con su estilo tenue para no
            //   competir con el portal: sirve para saber quién la cargó, no el link.
          )}
          <LanguageBadge job={job} />
          {/* ↑ La etiqueta de idioma va JUNTO al pill de "Match X%", no adentro:
              el idioma de la oferta y el % de match son dos datos distintos y
              meter uno dentro del otro haría que pareciera que el % mide el
              idioma. Es puramente informativa (un <span>, no un botón). */}
          <span className={`chip match-pill ${matchClass(job.score)}`}>Match {job.score}%</span>
          {/* ↑ El pill del match usa matchClass para su color (verde/amarillo/rojo). */}
        </div>
        <div className="detail-section">
          <h4>Resumen de la empresa</h4>
          <div className="company-summary">{s.companySummary}</div>
        </div>
        <div className="detail-section">
          <h4>Skills que buscan (que tenés)</h4>
          <div className="skills-wanted">
            {wanted.length
              // ↑ Ternario: si hay skills pedidas las listamos, si no un guión.
              ? wanted.map((x) => <span className="w" key={x}>{x}</span>)
              : <span className="muted">—</span>}
          </div>
        </div>
        {gaps.length > 0 && (
          // ↑ Esta sección SOLO aparece si hay brechas (skills que faltan).
          <div className="detail-section gap-skills">
            <h4>Skills que aún no están en tu CV</h4>
            <div className="skills-wanted">
              {gaps.map((x) => <span className="g" key={x}>{x}</span>)}
            </div>
          </div>
        )}
        {job.description && (
          // ↑ Render condicional: la descripción puede no venir en alguna oferta.
          <div className="detail-section">
            <h4>Descripción</h4>
            <div className="description" dangerouslySetInnerHTML={{ __html: job.description }} />
            {/* ↑ El backend manda HTML armado: dangerouslySetInnerHTML lo inyecta
                tal cual (es "peligroso" porque no escapa, pero acá confiamos en el server). */}
          </div>
        )}
        <div className="btn-row">
          {destination ? (
            <a
              className="btn"
              href={destination.url}
              target="_blank"
              rel="noopener noreferrer"
              title={destination.title}
            >
              <span aria-hidden="true">{destination.icon}</span>
              {destination.label}
              {/* ↑ El texto lo arma jobDestination() con el idioma y el nombre del
                  portal ya puestos: "Aplicar en LinkedIn", "🔎 Buscar en Curada".
                  El botón YA NUNCA se esconde: siempre hay salida si hay algún
                  link en la base. */}
            </a>
          ) : (
            <span className="btn secondary disabled-note" title="No hay ningún link en la base para esta oferta: contactá a la empresa por el nombre de arriba.">
              {noDestinationText(job, { langIsEn })}
              {/* ↑ Último caso, y se DICE en vez de desaparecer en silencio: no hay
                  link directo ni link de búsqueda. Es un <span> con la misma
                  forma de botón para que la fila de acciones no cambie de alto. */}
            </span>
          )}
          <button className="btn" onClick={() => onGenerateLetter(job.id, region)}>
            {/* ↑ onClick llama al callback del padre pasándole el id y la región. */}
            {langIsEn ? 'Generate cover letter' : 'Generar carta de presentación'}
          </button>
          <button className="btn secondary" onClick={copyResume}>
            {copied
              ? (langIsEn ? '✓ Copied' : '✓ Resumen copiado')
              : (langIsEn ? 'Copy CV text' : 'Copiar resumen del CV')}
            {/* ↑ El texto del botón depende del estado `copied` (feedback visual). */}
          </button>
          <a
            className="btn secondary"
            href={linkedinSearchUrl(`${job.title} ${job.company}`, region)}
            target="_blank"
            rel="noopener noreferrer"
            title={langIsEn ? 'Search LinkedIn jobs posted in the last 30 days' : 'Buscar en LinkedIn empleos publicados durante los últimos 30 días'}
          >
            🔗 {langIsEn ? 'LinkedIn · 30 days' : 'LinkedIn · 30 días'}
          </a>
        </div>
      </div>
    </div>
  );
}