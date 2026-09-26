import { useState } from 'react';
// ↑ useState: recordamos si el resumen ya se copió para cambiar el texto del botón.

import { matchClass, linkedinSearchUrl } from '../utils.js';
// ↑ matchClass (color del % de match) y linkedinSearchUrl (buscar la oferta en LinkedIn).

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

  const wanted = s.requiredSkills || [];
  // ↑ Skills que pide la oferta y que Ali ya tiene.
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
          <span className="chip">{job.source}</span>
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
          {job.applyUrl && job.applyUrl !== '#' && (
            /* ↑ Solo mostramos "Aplicar" si hay URL real (no '#' de las ofertas demo). */
            <a className="btn" href={job.applyUrl} target="_blank" rel="noopener noreferrer">
              {langIsEn ? 'Apply on portal' : 'Aplicar en el portal'}
              {/* ↑ Texto en inglés o español según la región. */}
            </a>
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