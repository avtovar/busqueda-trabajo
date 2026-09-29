import { useEffect, useState } from 'react';
// ↑ useState para guardar lo que el usuario está ESCRIBIENDO en el campo de % (el
//   "borrador") y useEffect para volver a sincronizar ese borrador con el valor
//   que el padre dice que está aplicado.

import { linkedinSearchUrl } from '../utils.js';
// ↑ Importamos la función que arma el link de búsqueda de LinkedIn (del archivo utils).

// ============================================================================
// Filtro de "% de match mínimo" — SOLO en el cliente.
// ----------------------------------------------------------------------------
// Qué muestra: cuatro botones rápidos (0 / 25 / 50 / 100 %) y, al lado, un campo
//   numérico para escribir un valor a medida, que SOLO acepta del 80 al 100.
// Por qué en el cliente y no en el backend: el server ya devuelve la lista
//   completa ordenada por % de match, así que filtrar acá es instantáneo y NO
//   dispara ninguna consulta a la red (no se toca server/ ni api.js).
// ============================================================================

const APIFY_LIMIT_OPTIONS = [50, 100, 200, 500];
// ↑ Opciones de cuántas ofertas pedirle a Apify. El default es 200 porque es el
//   default del backend (APIFY_MAX_RESULTS) y el que dio buenos resultados en la
//   prueba real: pidió 50 y guardó 78, o sea que el número es un PISO y no un
//   tope. Por eso no se ofrece "cuántas más越好": cada ejecución se factura y
//   500 contra el mismo perfil devuelve casi lo mismo que 200.

const SCORE_PRESETS = [0, 25, 50, 100];
// ↑ Los cuatro valores rápidos. El 0 está primero a propósito: es el estado
//   inicial (mostrar todo) y el que "limpia" cualquier valor personalizado.

const CUSTOM_MIN = 80;
const CUSTOM_MAX = 100;
// ↑ Rango del campo personalizado. Abajo de 80 no tiene sentido afinar (para ver
//   "un poco menos que 100" el preset 100 ya alcanza) y el techo de 100 es obvio.

// ¿El valor aplicado es uno de los cuatro presets? (define en qué MODO estamos)
function isPresetScore(value) {
  // ↑ .includes() responde sí/no: el filtro está "en un preset" o es "a medida".
  return SCORE_PRESETS.includes(value);
}

// ¿El valor aplicado es un "a medida"? Solo si cae en 80-100 y no es un preset.
function isCustomScore(value) {
  return Number.isFinite(value) && value >= CUSTOM_MIN && value <= CUSTOM_MAX && !isPresetScore(value);
}

// Convierte lo que el usuario escribió en un número válido del rango 80-100.
// ↑ Devuelve el número, o `null` si NO se puede usar (texto vacío, NaN, 79, 150…).
//   Devolver null en vez de "arreglar" el valor a mano es lo que garantiza que la
//   app nunca se quede con un filtro imposible (tipo 150% de match).
function parseCustomScore(raw) {
  if (raw === '' || raw === null || raw === undefined) return null;
  // ↑ Number('') es 0 (¡no es NaN!) y Number('abc') es NaN, así que el texto vacío
  //   se descarta explícitamente ANTES de mirar el rango.
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  // ↑ Con step={1} el input es de enteros, pero si el navegador igual deja
  //   escribir "82.5" lo redondeamos en vez de rechazar la escritura.
  if (rounded < CUSTOM_MIN || rounded > CUSTOM_MAX) return null;
  // ↑ Cualquier valor fuera de 80-100 se devuelve como inválido (null) y el
  //   llamador lo descarta: el filtro aplicado no cambia nunca por esto.
  return rounded;
}

// Barra de acciones de la sección de ofertas: actualizar búsqueda, alternar el
// historial, buscar en LinkedIn y filtrar por % de match. Recibe casi todo por
// props y solo "avisa" al padre.
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
  minScore,
  onMinScoreChange,
  apifyLimit,
  onApifyLimitChange,
  effectiveLimit,
  savedMessage,
  checkedAgo,
  stats,
}) {
  // ↑ Desestructuración completa de props en la firma: así no escribimos props.algo
  //   en el cuerpo. Cada prop viaja del padre (App) hacia acá.

  // En las pestañas consultoras/análisis esta barra no tiene sentido, porque ahí
  // no se muestran ofertas ni historial: por eso ocultamos los botones.
  const isConsulta = region === 'consultoras' || region === 'analisis';
  // ↑ Operador || (OR): true si la región es alguna de las dos secciones especiales.

  // Estado local del campo de % personalizado. NO es el filtro: es lo que el
  // usuario tiene escrito ahora mismo (puede ser inválido, como un "7" a medio
  // teclear). El filtro de verdad vive en App, en el estado minScore.
  const [draftScore, setDraftScore] = useState(() => (isCustomScore(minScore) ? String(minScore) : ''));
  // ↑ El valor inicial se calcula con una FUNCION (perezoso) para que, si la
  //   sesión anterior había guardado un valor a medida, el campo ya nazca con ese
  //   número en vez de parpadear vacío durante el primer render.

  const [scoreError, setScoreError] = useState('');
  // ↑ Mensaje de rechazo del último valor inválido. Vacío = no hay error.

  const customActivo = isCustomScore(minScore);
  // ↑ ¿Estamos en modo "a medida"? Solo entonces el input muestra un número y se
  //   pinta distinto. Los dos modos son excluyentes a propósito (ver el comentario
  //   de applyCustomScore sobre el 100).

  // Cuando el filtro cambia desde AFUERA de este input (un preset clickeado, otro
  // componente, o el valor recuperado del localStorage), el campo se re-sincroniza.
  useEffect(() => {
    setDraftScore(customActivo ? String(minScore) : '');
    setScoreError('');
  }, [minScore, customActivo]);
  // ↑ Si el filtro está en un preset, el campo se vacía; si es un valor a medida,
  //   muestra ese número. Por eso un F5 o un cambio de tab no deja el campo
  //   mostrando un valor que ya no es el filtro real.

  // Aplica lo que hay escrito en el campo, o lo descarta si no sirve.
  function applyCustomScore() {
    const parsed = parseCustomScore(draftScore);
    if (parsed === null) {
      // ↑ No se aplica NADA: el filtro sigue como estaba. El campo vuelve al
      //   último valor válido (o queda vacío si estamos en modo preset) y se
      //   explica por qué, en vez de dejar el listado en un filtro imposible.
      setDraftScore(customActivo ? String(minScore) : '');
      setScoreError(`El valor personalizado va de ${CUSTOM_MIN} a ${CUSTOM_MAX}. Usá un preset o escribí un número en ese rango.`);
      return;
    }
    setScoreError('');
    onMinScoreChange(parsed);
    // ↑ Recién acá se avisa al padre: el filtro real de la app pasa a ser 82, 83…
    //   100. Nunca antes, porque recién ahora el número está validado.
    //
    //   DECISIÓN DE DISEÑO (el único conflicto real entre preset y personalizado):
    //   dentro de 80-100 el 100 es a la vez un preset y un valor válido del campo.
    //   Cuando se escribe un número que es EXACTAMENTE un preset, gana el preset:
    //   se aplica el filtro (queda en 100) y el campo se vacía, para que se vea el
    //   botón "100%" encendido y no dos controles marcados a la vez.
    setDraftScore(isPresetScore(parsed) ? '' : String(parsed));
  }

  function handleDraftChange(event) {
    setDraftScore(event.target.value);
    if (scoreError) setScoreError('');
    // ↑ Escribir algo nuevo borra el error anterior: el aviso era sobre el
    //   intento que el usuario ya está corrigiendo y volvería a cada tecla.
  }

  function handleDraftKeyDown(event) {
    if (event.key === 'Enter') {
      // ↑ Enter aplica el valor: pierde el foco y eso dispara el onBlur, que es
      //   quien valida. Así el teclado y el mouse hacen EXACTAMENTE lo mismo.
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }
    if (event.key === 'Escape') {
      // ↑ Escape es "cancelar": el campo vuelve al último valor válido y listo.
      setDraftScore(customActivo ? String(minScore) : '');
      setScoreError('');
    }
  }

  return (
    <div className="toolbar">
      <div className="toolbar-status-column">
        <div className="status">{statusText}</div>
        {/* ↑ El texto de estado llega ya armado desde App (según qué se está viendo). */}
        {checkedAgo && (
          <div className="status-checked">🕒 Última búsqueda de LinkedIn: {checkedAgo}</div>
          // ↑ "Actualizado hace X" con el helper timeAgo() de utils.js. Antes no
          //   había ninguna forma de saber si lo de la pantalla era de ahora o de
          //   ayer, que es justo lo que hace dudar de una lista de ofertas.
        )}
      </div>

      {savedMessage && (
        <div className={`save-banner${savedMessage.ok ? ' ok' : ' warn'}`} role="status">
          {/* ↑ Confirmación de persistencia. El backend ya devuelve `saved`
              ({ ok, total, message }) y antes nadie lo leía: el usuario no tenía
              forma de saber si las ofertas se estaban guardando o no, que fue
              media razón del reporte original. */}
          <span aria-hidden="true">{savedMessage.ok ? '✓' : '⚠'}</span>
          {savedMessage.text}
        </div>
      )}

      {stats && (
        <details className="stats-box">
          {/* ↑ <details>/<summary> en vez de un panel siempre abierto: las stats
              están para entender por qué se ven menos ofertas de las pedidas, y
              ese dato importa una vez por búsqueda, no en cada scroll. */}
          <summary>
            ¿Por qué quedan {stats.guardados - stats.perdidas} ofertas y no {stats.pedidas}?
          </summary>
          {/* ↑ La pregunta está escrita como la duda real del usuario, con los
              dos números de la corrida ya calculados: lo que quedó vs. lo que se
              pidió. Con el filtro de % de match encima, el listado puede mostrar
              menos todavía, y eso lo aclara el texto de estado de arriba. */}
          <dl className="stats-grid">
            {stats.items.map((item) => (
              // ↑ Cada fila lleva su rótulo en castellano y, debajo, el por qué
              //   del número: "sinLink: 3" no dice nada, "Sin link directo: 3
              //   (no se pueden mostrar)" sí.
              <div className="stat" key={item.label}>
                <dt>{item.label}</dt>
                <dd className={item.zero ? 'zero' : ''}>{item.value}</dd>
                {item.hint && <span className="stat-hint">{item.hint}</span>}
              </div>
            ))}
          </dl>
        </details>
      )}

      {/* Render condicional: los botones y el filtro de % solo aparecen en
          regiones de ofertas reales (no en Consultoras ni en Propuesta de Interés).
          El <>...</> agrupa los dos bloques en una sola línea del condicional. */}
      {!isConsulta && (
        <>
        <div className="toolbar-actions">
          <button className="btn small" onClick={onRefresh} disabled={refreshing} title="Volver a consultar las fuentes ahora">
            {/* ↑ onClick usa el callback que pasó el padre; disabled evita clicks repetidos. */}
            {refreshing ? '🔄 Actualizando…' : '🔄 Actualizar búsqueda'}
            {/* ↑ Ternario: cambia el texto del botón mientras el refresh está corriendo. */}
          </button>
            <label className="apify-limit-control">
              {/* ↑ Cuántas ofertas pedirle a Apify. El número NO es un tope real
                  de la plataforma: el backend pagina hasta 8 páginas y suele
                  devolver MÁS de lo pedido (pedir 50 guardó 78 en la prueba real),
                  así que el texto de al lado habla de "piso", no de "máximo". */}
              <span className="apify-limit-label">Pedir</span>
              <select
                className="job-sort-select apify-limit-select"
                value={apifyLimit}
                onChange={(event) => onApifyLimitChange(Number(event.target.value))}
                disabled={searchingLinkedIn}
                aria-label="Cantidad de ofertas a pedirle a Apify"
                title="Cantidad objetivo de ofertas. Es un piso, no un tope: el backend pagina y suele traer más."
              >
                {APIFY_LIMIT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              {/* ↑ 50/100/200/500. El default (200) es el mismo del backend
                  (APIFY_MAX_RESULTS), así lo que se ve es lo que se ejecuta. */}
            </label>
            <button
              className="btn small secondary"
              type="button"
              onClick={onLinkedInSearch}
              disabled={searchingLinkedIn}
              // ↑ El costo se sigue avisando: cada búsqueda ejecuta un actor de
              //   Apify que se factura por ejecución. Lo que se cambió fue el
              //   número, que antes prometía un tope de 50 que ya no existe.
              title="Ejecuta una búsqueda real en Apify y guarda lo que encuentre en tu base. Cada búsqueda se cobra, por eso conviene no repetirlas."
            >
              {searchingLinkedIn
                ? `Buscando en LinkedIn (${apifyLimit}+)…`
                : `Buscar con Apify · desde ${apifyLimit} ofertas`}
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

        {effectiveLimit != null && !isConsulta && (
          <div className="effective-limit">
            {/* ↑ El límite REAL con el que corrió la última búsqueda. Se muestra
                porque el texto del botón promete una cantidad y el backend puede
                devolver MÁS (piso, no tope): sin este dato, ver 78 ofertas con un
                botón que dice "desde 200" parece un error. */}
            Última corrida: se pidieron {effectiveLimit} ofertas (es un piso: el backend pagina y suele traer más).
          </div>
        )}

        <div className="score-filter">
          {/* ↑ Fila propia del filtro de % de match. El CSS la manda a una línea
              nueva (flex: 1 0 100%), así no se mezcla un control de precisión con
              los botones de acción de arriba. */}
          <label className="score-filter-label" htmlFor="score-filter-input">Match mínimo:</label>
          {/* ↑ htmlFor + id del input: es lo que hace que al clickear el texto
              "Match mínimo:" se enfoque el campo (accesibilidad de formularios). */}

          <div className="score-presets" role="group" aria-label="Valores rápidos de % de match mínimo">
            {/* ↑ role="group" agrupa los botones para el lector de pantalla: le
                anuncia los cuatro como un solo control con opciones. */}
            {SCORE_PRESETS.map((preset) => (
              // ↑ .map() dibuja un botón por cada valor rápido del array.
              <button
                key={preset}
                type="button"
                className={`btn small secondary${minScore === preset ? ' active' : ''}`}
                // ↑ Se REUSA la clase .active que ya usa el botón de historial:
                //   el preset encendido se ve igual que cualquier otro "encendido".
                aria-pressed={minScore === preset}
                // ↑ aria-pressed le dice al lector de pantalla si el botón está
                //   apretado o no: un toggle sin esto no se anuncia.
                onClick={() => {
                  onMinScoreChange(preset);
                  setScoreError('');
                  // ↑ Apretar un preset LIMPIA el valor a medida: como minScore
                  //   vuelve a ser un preset, el efecto de arriba vacía el campo
                  //   solo. Volver a 0 muestra todas las ofertas de nuevo.
                }}
                title={`Mostrar solo ofertas con ${preset}% de match o más`}
              >
                {preset}%
              </button>
            ))}
          </div>

          <input
            id="score-filter-input"
            className={`score-filter-input${customActivo ? ' custom' : ''}`}
            // ↑ La clase .custom solo se agrega en modo "a medida": es la señal
            //   visual de que el filtro no viene de ninguno de los presets.
            type="number"
            min={CUSTOM_MIN}
            max={CUSTOM_MAX}
            step={1}
            value={draftScore}
            // ↑ Input CONTROLADO por el borrador: nunca se escribe directo en el
            //   filtro, así se puede teclear un "8" a medio número sin que el
            //   listado parpadee ni se rompa.
            placeholder={`${CUSTOM_MIN}-${CUSTOM_MAX}`}
            onChange={handleDraftChange}
            onBlur={applyCustomScore}
            // ↑ AlBlur valida y aplica (o descarta). Es el momento en el que el
            //   número ya está escrito entero, no a medio teclear.
            onKeyDown={handleDraftKeyDown}
            aria-invalid={scoreError ? 'true' : undefined}
            // ↑ aria-invalid marca el campo como inválido para lectores de
            //   pantalla cuando hubo un rechazo.
            title={`Escribí un % de match entre ${CUSTOM_MIN} y ${CUSTOM_MAX}`}
          />
          <span className={`score-filter-hint${scoreError ? ' error' : ''}`} role="status">
            {/* ↑ role="status" anuncia el cambio de texto sin robarle el foco. */}
            {scoreError || (customActivo
              ? `Personalizado: ${minScore}%`
              : `Personalizado: ${CUSTOM_MIN} a ${CUSTOM_MAX}%`)}
            {/* ↑ Ternario doble: primero el error si hubo; si no, el texto que
                describe en qué modo está el filtro ahora mismo. */}
          </span>
        </div>
        </>
      )}
    </div>
  );
}