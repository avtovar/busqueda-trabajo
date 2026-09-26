import { linkedinSearchUrl } from '../utils.js';
// ↑ Importamos la función que arma el link de búsqueda de LinkedIn (del archivo utils).

// Barra de acciones de la sección de ofertas: actualizar búsqueda, alternar el
// historial y buscar en LinkedIn. Recibe casi todo por props y solo "avisa" al padre.
export default function Toolbar({
  region,
  statusText,
  viewMode,
  onRefresh,
  onLinkedInSearch,
  onToggleHistory,
  refreshing,
  searchingLinkedIn,
  linkedinKeywords,
}) {
  // ↑ Desestructuración completa de props en la firma: así no escribimos props.algo
  //   en el cuerpo. Cada prop viaja del padre (App) hacia acá.

  // En las pestañas consultoras/análisis esta barra no tiene sentido, porque ahí
  // no se muestran ofertas ni historial: por eso ocultamos los botones.
  const isConsulta = region === 'consultoras' || region === 'analisis';
  // ↑ Operador || (OR): true si la región es alguna de las dos secciones especiales.

  return (
    <div className="toolbar">
      <div className="status">{statusText}</div>
      {/* ↑ El texto de estado llega ya armado desde App (según qué se está viendo). */}

      {/* Render condicional: los botones solo aparecen en regiones de ofertas reales. */}
      {!isConsulta && (
        <div className="toolbar-actions">
          <button className="btn small" onClick={onRefresh} disabled={refreshing} title="Volver a consultar las fuentes ahora">
            {/* ↑ onClick usa el callback que pasó el padre; disabled evita clicks repetidos. */}
            {refreshing ? '🔄 Actualizando…' : '🔄 Actualizar búsqueda'}
            {/* ↑ Ternario: cambia el texto del botón mientras el refresh está corriendo. */}
          </button>
            <button
              className="btn small secondary"
              type="button"
              onClick={onLinkedInSearch}
              disabled={searchingLinkedIn}
              title="Ejecuta una búsqueda manual en Apify, limitada a 50 resultados y con cobro por resultado."
            >
              {searchingLinkedIn ? 'Buscando en LinkedIn…' : 'Buscar con Apify · 50 máx.'}
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
            href={linkedinSearchUrl(linkedinKeywords, region)}
            target="_blank"
            rel="noopener noreferrer"
            title="Buscar roles QA y skills de automatización del perfil, publicados durante los últimos 30 días"
          >
            🔗 LinkedIn · QA y automatización · 30 días
          </a>
          {/* ↑ Es un <a>, no un <button>: porque navega a una URL generada con
              las keywords + la región actual (sin scrapear nada). */}
        </div>
      )}
    </div>
  );
}