import { linkedinSearchUrl } from '../utils.js';

export default function Toolbar({
  region,
  statusText,
  viewMode,
  onRefresh,
  onToggleHistory,
  refreshing,
  linkedinKeywords,
}) {
  const isConsultoras = region === 'consultoras';

  return (
    <div className="toolbar">
      <div className="status">{statusText}</div>
      {!isConsultoras && (
        <div className="toolbar-actions">
          <button className="btn small" onClick={onRefresh} disabled={refreshing} title="Volver a consultar las fuentes ahora">
            {refreshing ? '🔄 Actualizando…' : '🔄 Actualizar búsqueda'}
          </button>
          <button
            className={`btn small secondary${viewMode === 'history' ? ' active' : ''}`}
            onClick={onToggleHistory}
            title="Ver ofertas vistas desde enero 2026"
          >
            {viewMode === 'history' ? '🔴 Ver solo activas' : '🕒 Desde enero 2026'}
          </button>
          <a
            className="btn small secondary"
            href={linkedinSearchUrl(linkedinKeywords, region)}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir esta búsqueda en LinkedIn (fuera del match automático)"
          >
            🔗 Buscar en LinkedIn
          </a>
        </div>
      )}
    </div>
  );
}
