import { useState } from 'react';
// ↑ Hook useState: la paginación necesita memoria interna (en qué página estamos).

import { matchClass, daysAgo, formatDisplayDate, portalInfo, jobDestination } from '../utils.js';
// ↑ Helpers: matchClass (color del % de match), daysAgo (días desde la última vista),
//   formatDisplayDate (fecha legible) y los dos de procedencia nueva —portalInfo
//   (nombre + icono + clase del portal) y jobDestination (el mejor link que haya:
//   el de la oferta o, si no hay, el de la búsqueda)— que son los que hacen que
//   la tarjeta muestre de dónde salió la oferta y adónde ir.
import LanguageBadge from './LanguageBadge.jsx';
// ↑ La etiqueta de idioma (ES/EN). Va en un componente aparte y no en línea acá
//   porque la misma etiqueta se dibuja también en el modal de detalle: si el
//   <span> estuviera duplicado en los dos archivos, cualquier cambio futuro
//   (un texto, un estilo) se olvidaría de actualizar uno de los dos.

// ============================================================================
// Componente de la lista de ofertas de UNA región.
// Qué muestra: la barra de orden, un botón para restaurar lo que se quitó, las
// tarjetas de oferta (paginadas de a 10) y los botones de página anterior/siguiente.
// Qué NO hace: no pide datos. Los recibe ya cargados por props desde App.jsx.
// ============================================================================

const PAGE_SIZE = 10;
// ↑ Cantidad de ofertas que se muestran por página (constante fija, se corta la lista).
const DISMISSED_STORAGE_KEY = 'buscaempleo-dismissed-jobs';
// ↑ Clave con la que se guardan en el navegador las ofertas que el usuario quitó
//   ("buscaempleo-" evita choque con otras apps del mismo dominio). OJO: guardar
//   en localStorage es del navegador, no del backend: es solo en ESTA computadora.

// Convierte una oferta en una "firma de texto" comparable: mismo título y misma
// empresa siempre dan la misma firma.
// ↑ Sirve para reconocer la MISMA oferta aunque venga con acentos, mayúsculas o
//   signos distintos: "Q.A. Tester" y "QA Tester" en "Bank Arg." terminan
//   generando la misma clave, y así "quitar" una la quita de verdad.
function jobDismissKey(job) {
  // ↑ .normalize('NFD') separa la "á" en "a" + tilde combinante; el replace de
  //   abajo borra esas tildes, dejando solo letras simples.
  return `${job.title}::${job.company}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    // ↑ ^\p{Diacritic} = "toda letra acentuada". El flag /u permite usar
    //   \p{...} y /g quita todas las apariciones, no solo la primera.
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    // ↑ Esta última línea pasa cualquier corrida de caracteres que NO sea letra
    //   o número a un espacio (por eso "C++" y "C" no son la misma clave).
    //   Todo en minúsculas, así comparar no falla entre "QA" y "qa".
    .trim();
}

// Lee del navegador las ofertas que el usuario quitó.
// ↑ Devuelve un Set (no un array) porque un Set no admite repetidos y tiene
//   `.has()` para preguntar "¿está en la lista?" de forma directa.
function loadDismissedJobs() {
  try {
    // ↑ localStorage guarda TEXTO, así que lo que vuelve es un string: hay que
    //   convertirlo con JSON.parse para volver a tener un array. El `|| '[]'`
    //   cubre el caso "nunca se guardó nada" (getItem devuelve null).
    const stored = JSON.parse(localStorage.getItem(DISMISSED_STORAGE_KEY) || '[]');
    return new Set(Array.isArray(stored) ? stored.filter((value) => typeof value === 'string') : []);
    // ↑ Solo nos quedamos con los strings (por si el dato guardado estaba
    //   corrupto) y envolvemos todo en un Set.
  } catch {
    // ↑ Si el JSON guardado está roto, seguimos con un Set vacío en vez de romper.
    return new Set();
  }
}

// Normaliza la fecha de publicación de una oferta a milisegundos (timestamp).
// ↑ Vuelve en un solo tipo de dato: con esto el .sort() de más abajo puede
//   comparar fechas sin importar si vinieron como texto, segundos o milisegundos.
function publicationTimestamp(job) {
  const raw = job.date;
  if (!raw) return null;
  // ↑ Sin fecha no hay timestamp: se devuelve null y el orden pone estas ofertas
  //   al final, sin romper.
  const value = String(raw).trim();
  if (/^\d{10,13}$/.test(value)) {
    const numeric = Number(value);
    return numeric < 1e12 ? numeric * 1000 : numeric;
    // ↑ Regex de 10 o 13 dígitos = un timestamp: 10 dígitos son SEGUNDOS y 13
    //   son MILISEGUNDOS. 1e12 es un billón, así que si el número es menor hay
    //   que multiplicar por 1000 para pasarlo a milisegundos.
  }
  // ↑ Si no es un número, se lo dejamos a new Date() ("hace 3 días", "14/03/26"...).
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
  // ↑ .getTime() da los milisegundos; si es NaN, la fecha no era válida.
}

// Sub-componente local: el "badge" que indica si una oferta del historial sigue
// activa o ya no aparece. No se exporta porque solo lo usa JobList.
function HistoryBadge({ job }) {
  // ↑ Recibe solo el job por props para decidir qué mensaje mostrar.

  if (job.active === undefined) return null;
  // ↑ Guardia: si la oferta no tiene el campo `active`, no pintamos ningún badge.
  //   Ojo con === undefined: si `active` fuera false, SÍ hay que pintar algo.

  if (job.active) {
    return (
      <span className="badge badge-active" title="Esta oferta apareció en la última búsqueda; no se verifica su estado en la empresa.">
        🟢 Aparece en la última búsqueda
      </span>
    );
  }
  // ↑ Render condicional: oferta activa = badge verde "Activa ahora".

  // Si ya no aparece, calculamos hace cuánto se la vio por última vez.
  const d = daysAgo(job.lastSeen);
  const label = d === null ? 'vista anteriormente' : d <= 0 ? 'vista hoy' : `vista hace ${d} día${d === 1 ? '' : 's'}`;
  const lastSeen = formatDisplayDate(job.lastSeen);
  // ↑ Ternarios anidados para armar el texto: maneja sin fecha, hoy, 1 día o varios.
  return (
    <span className="badge badge-inactive" title="La última búsqueda no la devolvió. Esto no confirma que la empresa haya cubierto la vacante.">
      ⚪ No aparece en la última búsqueda · {lastSeen ? `vista ${lastSeen} (${label})` : label}
    </span>
  );
}

// Sub-componente local: el badge de procedencia ("de dónde salió esta oferta").
// No se exporta porque solo lo usa JobList; el modal de detalle vuelve a armar el
// suyo porque necesita además el link a la búsqueda, no solo el nombre.
function PortalBadge({ job }) {
  const portal = portalInfo(job);
  // ↑ Toda la lógica de qué nombre mostrar está en utils.js (portalInfo): acá
  //   solo se pinta. Si mañana aparece un portal nuevo, no hay que tocar esto.

  return (
    <span
      className={`portal-badge portal-${portal.slug}`}
      // ↑ La clase sale del NOMBRE del portal normalizado, así el color vive
      //   únicamente en el CSS y no hay un switch de colores en el JSX.
      title={`Esta oferta salió de ${portal.name}.`}
      // ↑ El title aclara el valor de la etiqueta: sin esto, "LinkedIn" al lado
      //   del % de match parece otro dato del match y no la procedencia.
    >
      <span aria-hidden="true">{portal.icon}</span>
      {/* ↑ aria-hidden: el emoji no aporta nada a un lector de pantalla (lo lee
          como "maletín" o "montaña" según el reader), el texto de al lado ya
          dice todo. */}
      {portal.name}
    </span>
  );
  // ↑ El nombre va en texto plano, NUNCA solo el ícono: un badge de color sin
  //   texto no le dice nada a quien navega con lector de pantalla.
}

// El link de la tarjeta: a la oferta si hay `applyUrl`, y si no a la página de
// búsqueda del portal. Vive FUERA del <button> de la tarjeta por una razón de
// HTML, no de estilo: no se puede anidar un <a> dentro de un <button>.
// Si se hiciera, el navegador reparenta el <a> fuera del botón y el click deja de
// comportarse de forma predecible (y React avisa en desarrollo).
function JobActions({ job }) {
  const destination = jobDestination(job);
  // ↑ Una sola fuente de verdad para el destino (ver jobDestination en utils.js):
  //   si no hay applyUrl cae a sourceUrl, y si no hay ninguno devuelve null.

  return destination ? (
    <a
      className={`job-link${destination.kind === 'search' ? ' search' : ''}`}
      href={destination.url}
      target="_blank"
      rel="noopener noreferrer"
      // ↑ rel="noopener noreferrer" en TODO link externo: sin esto la pestaña
      //   nueva recibe una referencia a la app y puede navegar con window.opener.
      //   Es buena práctica de seguridad, no un detalle menor.
      onClick={(e) => e.stopPropagation()}
      // ↑ Esta fila está fuera del <button> de la tarjeta, así que el click ya
      //   no llega a abrir el detalle; el stopPropagation lo vuelve explícito para
      //   que el comportamiento no dependa del layout ni de futuros refactors.
      title={destination.title}
    >
      <span aria-hidden="true">{destination.icon}</span>
      {destination.label}
      {/* ↑ Texto legible además del ícono: "Aplicar en LinkedIn" se entiende
          leído en voz alta y de un vistazo; 🔗 solo, no. */}
    </a>
  ) : (
    <span className="job-link none" title="La base no tiene link de postulación ni link de búsqueda para esta oferta.">
      ⚠ Sin link
    </span>
    // ↑ Sin destino NO se esconde la fila: se dice explícitamente que esta
    //   oferta no tiene link. 18 de las 57 ofertas curadas están en este caso y
    //   esconder el botón hacía pensar que la app estaba rota.
  );
}

// Lista de ofertas de la región: recibe jobs, el modo de vista y el callback onOpen.
export default function JobList({ jobs, viewMode, minScore, onOpen }) {
  // ↑ Props desestructurados. onOpen viene del padre: se ejecuta al clickear una card.
  // Las props son los DATOS que viajan de arriba hacia abajo (de App.jsx hacia acá),
  // como un paquete: este componente no busca nada, solo dibuja lo que le pasaron.
  //   jobs     = array de ofertas YA filtrado por el padre (puede venir vacío).
  //   viewMode = 'live' (resultados de la última búsqueda) o 'history' (historial).
  //   minScore = % de match mínimo que aplicó el padre. Solo se usa para poder
  //              explicar el mensaje de lista vacía (no para filtrar de nuevo).
  //   onOpen   = función del padre que se llama con el id de la oferta clickeada.
  // El padre los pasa en App.jsx:
  // <JobList jobs={visibleJobs} viewMode={viewMode} minScore={minScore} onOpen={openDetail} />

  const [page, setPage] = useState(1);
  // ↑ Estado interno de paginación: empieza en la página 1. No le importa al padre.

  const [sortOrder, setSortOrder] = useState('newest');
  // ↑ 'newest' | 'oldest': el orden de la lista. Cada estado del componente es
  //   una variable + su función para cambiarla (setX). Al cambiar, React vuelve
  //   a dibujar el componente con el valor nuevo.
  const [dismissedJobs, setDismissedJobs] = useState(loadDismissedJobs);
  // ↑ OJO con esto: le pasamos la FUNCIÓN, no su resultado. useState la usa como
  //   valor inicial perezoso y la ejecuta UNA sola vez (al primer render), así
  //   que no vamos al localStorage en cada re-render. Si le pasáramos
  //   loadDismissedJobs(), se leería el almacenamiento en cada dibujada.

  function dismissJob(job) {
    // ↑ "Quitar de mi lista": agrega la firma de la oferta al Set de quitadas.
    const next = new Set(dismissedJobs);
    // ↑ Copiamos el Set actual: en React NUNCA se muta un estado, se crea uno nuevo.
    next.add(jobDismissKey(job));
    setDismissedJobs(next);
    try {
      localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...next]));
      // ↑ Un Set no se puede convertir a JSON, así que primero lo pasamos a
      //   array con [...] y recién ahí a texto.
    } catch {}
    // ↑ Si el navegador tiene el almacenamiento lleno o bloqueado, la oferta
    //   igual se oculta en esta sesión.
    setPage(1);
    // ↑ Volvemos a la página 1: al filtrar puede quedar muy poca oferta y la
    //   página actual podría quedar vacía.
  }

  function restoreDismissedJobs() {
    // ↑ Al revés de dismissJob: vacía el Set y borra la clave guardada.
    setDismissedJobs(new Set());
    try {
      localStorage.removeItem(DISMISSED_STORAGE_KEY);
    } catch {}
  }

  // Si no hay ofertas, mostramos un mensaje vacío según la vista (historial o live).
  if (!jobs.length) {
    // ↑ "Return temprano": si no hay nada que mostrar, salimos acá y ni siquiera
    //   llegamos a calcular la paginación ni a dibujar las tarjetas.
    // El mensaje depende de DOS cosas: si hay un filtro de % activo y de qué vista
    // se está mirando. Si el filtro fue el que vació la lista, decir "no se
    // encontraron ofertas" sería mentira: las hay, solo que ninguna pasa el % pedido.
    const emptyMessage = minScore > 0
      ? `Ninguna oferta llega al ${minScore}% de match. Bajá el filtro en la barra de arriba para ver el resto.`
      : viewMode === 'history'
        ? 'Todavía no hay historial guardado para esta región. Corré una búsqueda primero.'
        : 'No se encontraron ofertas para esta región.';

    return (
      <div className="empty">{emptyMessage}</div>
      // ↑ El texto se arma antes del return para no anidar tres ternarios en el JSX.
    );
  }

  // Preparamos la lista que se va a ver: primero sacamos lo que el usuario quitó
  // y después la ordenamos.
  const visibleJobs = jobs
    .filter((job) => !dismissedJobs.has(jobDismissKey(job)))
    // ↑ .filter NO modifica el array original: devuelve uno nuevo con los que
    //   cumplen la condición (las que NO están en el Set de quitadas).
    .sort((left, right) => {
      // ↑ .sort() SÍ modifica el array sobre el que se llama. Por eso va después
      //   del filter: así ordena la copia nueva y nunca el array del padre.
      const leftDate = publicationTimestamp(left);
      const rightDate = publicationTimestamp(right);
      if (leftDate === null && rightDate !== null) return 1;
      if (rightDate === null && leftDate !== null) return -1;
      if (leftDate === null || rightDate === null) return 0;
      // ↑ El comparador de .sort() devuelve un número: 1 = "la izquierda va
      //   después", -1 = "la izquierda va antes", 0 = "déjalo igual". Si alguna
      //   de las dos no tiene fecha, mandamos las que sí al final del todo.
      return sortOrder === 'newest' ? rightDate - leftDate : leftDate - rightDate;
      // ↑ Restar es la forma de invertir el orden: "más nueva primero" es
      //   fecha mayor primero, y "más antigua primero" al revés.
    });
  const visibleTotalPages = Math.max(1, Math.ceil(visibleJobs.length / PAGE_SIZE));
  // ↑ Math.ceil redondea hacia arriba para saber cuántas páginas hacen falta;
  //   el Math.max(1, ...) garantiza que haya al menos 1 página (nunca 0).

  // Si el usuario avanzó y hubo menos resultados, corregimos la página actual.
  const safePage = Math.min(page, visibleTotalPages);
  // ↑ "Techo" de la página: si el usuario filtró todo y ahora hay menos páginas,
  //   no dejamos que la página actual sea una que no existe (quedaría en blanco).

  // pageJobs = "rebanada" de la lista según la página: de (página-1)*10 a página*10.
  const pageJobs = visibleJobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  // ↑ .slice() no modifica el arreglo original, devuelve una copia recortada.
  //   Ej: página 2 con 10 por página -> slice(10, 20) = los elementos 11 al 20.

  return (
    <div>
      <div className="job-list-controls">
        {/* ↑ Barra de herramientas ARRIBA de la lista: el <select> del orden y el
            botón de restaurar. */}
        <label className="job-sort-control">
          Ordenar por
          {/* ↑ `value` + `onChange` hacen que este <select> sea un input
              CONTROLADO por React: lo que se ve siempre sale del estado. */}
          <select
            className="job-sort-select"
            aria-label="Ordenar ofertas por fecha de publicación"
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value);
              // ↑ Al cambiar el orden, se vuelve a la página 1 (el orden nuevo
              //   reinicia la lista desde arriba).
              setPage(1);
            }}
          >
            <option value="newest">Más nuevas primero</option>
            <option value="oldest">Más antiguas primero</option>
          </select>
        </label>
        {dismissedJobs.size > 0 && (
          // ↑ Render condicional con &&: el botón SOLO aparece si el usuario
          //   quitó alguna oferta (size > 0).
          <button className="btn small secondary" type="button" onClick={restoreDismissedJobs}>
            Restaurar ofertas quitadas ({dismissedJobs.size})
          </button>
        )}
      </div>
      {visibleJobs.length === 0 ? (
        // ↑ Hay dos "vacíos" distintos: no hay ofertas (arriba) o el usuario las
        //   quitó todas (acá). El mensaje tiene que explicar cuál de los dos es.
        <div className="empty">Quitaste todas las ofertas de esta vista. Puedes restaurarlas cuando quieras.</div>
      ) : (
        <div className="job-list">
          {pageJobs.map((job) => (
            // ↑ El .map() RECORRE las ofertas de esta página y devuelve una
            //   tarjeta por cada una. Todo lo que hay adentro se re-dibuja por
            //   cada iteración: por eso `job` es distinto en cada vuelta.
            <article className="job-card" key={job.id}>
              {/* ↑ key es OBLIGATORIA dentro de un map de React. Sin key, React no
                  puede saber qué tarjeta cambió y, al reordenar o borrar, puede
                  reciclar el elemento equivocado (el input equivocado, el foco
                  saltando de lugar). Va en el elemento raíz de cada iteración. */}
              <button className="job-open" type="button" onClick={() => onOpen(job.id)}>
                {/* ↑ La tarjeta ES un <button>: toda la zona es clickeable y al
                    hacer click avisamos al padre con el id. La flecha ()=> evita
                    pasar el evento del click en lugar del id. */}
                <div className="job-top">
                  <div>
                    <div className="job-title">{job.title}</div>
                    <div className="job-company">{job.company}</div>
                    {/* ↑ Título y empresa. El `· {job.source}` de antes se bajó a
                        su propia línea: `source` es texto libre legacy con 44
                        variantes distintas ("Reclutador (LinkedIn)", "Directo
                        (link)") y pegado al nombre de la empresa parecía parte de
                        ella. Ahora se lee como metadata. */}
                  <div className="job-origin">
                    <PortalBadge job={job} />
                    {/* ↑ "De dónde salió esta oferta". Va en su propia línea y no
                        al lado del % de match porque es otro tipo de dato: el
                        % mide el match con tu CV, el portal dice la procedencia. */}
                    {job.source && job.source !== portalInfo(job).name && (
                      <span className="job-source" title="Origen anotado a mano en la base de ofertas">
                        {job.source}
                        {/* ↑ `source` crudo, SOLO como dato secundario: el badge
                            manda porque sale del link real (server/portal.js) y
                            no de este texto libre. */}
                      </span>
                    )}
                  </div>
                  </div>
                  <LanguageBadge job={job} />
                  {/* ↑ La etiqueta de idioma va PEGADA al pill del % de match (y
                      separada de él, no adentro): el idioma y el match son dos datos
                      distintos. El margin-left:auto de la clase la empuja a la
                      derecha para que las dos queden siempre juntas. */}
                  <span className={`match-pill ${matchClass(job.score)}`}>{job.score}%</span>
                  {/* ↑ El pill del % de match: template string para meter la clase
                      que devuelve matchClass() (verde/amarillo/rojo) + el número. */}
                </div>
                <div className="job-meta">
                  <span>📍 {job.location || 'Remote'}</span>
                  <span>📅 Publicada: {formatDisplayDate(job.date) || 'fecha no informada'}</span>
                  {/* ↑ El operador || muestra un texto por defecto cuando el dato
                      no viene: "Remote" si no hay ubicación, "fecha no informada"
                      si no hay fecha. La fecha pasa por el helper de utils.js. */}
                  {job.modality && <span>🕒 {job.modality}</span>}
                  {job.salary && <span>💰 {job.salary}</span>}
                  {/* ↑ Con && se muestran SOLO si el dato existe (si no, no se
                      dibuja nada). Son datos opcionales que trae el backend. */}
                </div>
                {viewMode === 'history' && (
                  <div className="job-history"><HistoryBadge job={job} /></div>
                )}
                {/* ↑ El badge de historial SOLO tiene sentido en la vista de
                    historial: en la búsqueda en vivo todas están "activas". */}
                {job.matched && job.matched.length > 0 && (
                  <div className="job-skill-preview">
                    {job.matched.slice(0, 5).map((skill) => <span className="mini" key={skill}>{skill}</span>)}
                    {/* ↑ skills que coinciden con el perfil. El slice(0, 5) muestra
                        solo los 5 primeros: la tarjeta no crece con 40 skills.
                        Acá la key es el nombre del skill (es único dentro de la
                        lista), por eso cada <span> tiene la suya. */}
                  </div>
                )}
              </button>
              <div className="job-actions-row">
                {/* ↑ Fila de acciones al pie de la tarjeta: el link a la oferta
                    y el botón de quitar. Wrapper NECESARIO por el HTML inválido de
                    más abajo, no por decoración: el <button className="job-open">
                    ocupa toda la tarjeta y no admite un <a> adentro. */}
                <JobActions job={job} />
                {/* ↑ El link. Va acá y no dentro del .job-open porque HTML no
                    permite <a> dentro de <button>: el navegador lo reparenta y
                    el click deja de comportarse bien. Además stopPropagation
                    garantiza que abrir el link no abra el modal. */}
                <button
                  className="job-dismiss"
                  type="button"
                  // ↑ También fuera del <button> de la tarjeta, por la misma
                  //   razón: y el click en "quitar" no debe abrir el detalle.
                  onClick={() => dismissJob(job)}
                  aria-label={`Quitar ${job.title} de mi lista`}
                  // ↑ aria-label es el texto que leen los lectores de pantalla.
                  title="Solo la oculta en este navegador; no informa a la empresa."
                >
                  Quitar de mi lista
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* La paginación solo se muestra si hay más de una página. */}
      {visibleJobs.length > 0 && visibleTotalPages > 1 && (
        // ↑ Con 1 sola página los botones no harian nada, así que no se dibujan.
        <div className="pagination">
          <button className="btn small secondary" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
            ← Anterior
          </button>
          {/* ↑ disabled en la primer página: el botón no hace nada y se ve apagado. */}
          <span className="pagination-info">
            Página {safePage} de {visibleTotalPages} · {visibleJobs.length} ofertas
          </span>
          <button className="btn small secondary" disabled={safePage >= visibleTotalPages} onClick={() => setPage(safePage + 1)}>
            Siguiente →
          </button>
          {/* ↑ setPage cambia el estado y React re-renderiza con la página nueva. */}
        </div>
      )}
    </div>
  );
}
