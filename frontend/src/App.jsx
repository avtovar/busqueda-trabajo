import { useEffect, useState, useCallback, useMemo } from 'react';
// ↑ Hooks de React: useState (memoria del componente), useEffect (efectos como
//   cargar datos al inicio), useCallback (funciones "memorizadas" que no se
//   recrean en cada render, cosa que los hijos no se re-rendericen de más) y
//   useMemo (guardar el RESULTADO de un cálculo para no repetirlo en cada render).

import CvPanel from './components/CvPanel.jsx';
// ↑ Panel lateral con el CV de Ali (avatar, sobre mí, skills, enlaces).

import RegionTabs from './components/RegionTabs.jsx';
// ↑ Pestañas para cambiar de región (países) o de sección (Propuesta/Consultoras).

import Toolbar from './components/Toolbar.jsx';
// ↑ Barra de acciones: actualizar búsqueda, historial y buscar en LinkedIn.

import JobList from './components/JobList.jsx';
// ↑ Lista de ofertas de la región actual, con paginación y badge de historial.

import ConsultorasList from './components/ConsultorasList.jsx';
// ↑ Directorio de consultoras QA con tracker de contacto (filtros, estado, notas).

import AnalysisPage from './components/AnalysisPage.jsx';
// ↑ Página "Propuesta de Interés": gráficos que comparan el mercado vs. el CV.

import JobDetailModal from './components/JobDetailModal.jsx';
// ↑ Modal con el detalle de una oferta (skills, descripción, copiar resumen).

import LetterModal from './components/LetterModal.jsx';
// ↑ Modal que muestra la carta de presentación generada y la deja copiar/descargar.

import { linkedinProfileKeywords, timeAgo } from './utils.js';
// ↑ linkedinProfileKeywords arma la query de la búsqueda de LinkedIn;
//   timeAgo convierte el `checkedAt` del backend en "actualizado hace X".

import {
  loadProfile, loadJobs, loadHistory, refreshJobs,
  loadJobDetail, loadCoverLetter, loadConsultoras, loadAnalytics, searchLinkedInJobs,
} from './api.js';
// ↑ Importamos las funciones de la capa de API. Cada una hace un fetch al backend
//   y, si falla, devuelve datos de respaldo para que la UI nunca quede vacía.

// Estados posibles de contacto de una consultora. Se usan como opciones del tracker.
const DEFAULT_ESTADOS = ['Sin contactar', 'Contactado', 'Respondió', 'Entrevista agendada', 'Descartada'];

// Nombres de las regiones para poder hablar de "otras regiones" sin mostrar claves
// internas como 'argentina' o 'eeuu' en un texto que lee el usuario.
// ↑ Las 7 claves son fijas (ver AGENTS.md): si alguna vez se agrega una región,
//   esta tabla es el lugar que hay que tocar en el frontend.
const REGION_NAMES = {
  argentina: 'Argentina',
  europa: 'Europa',
  eeuu: 'EE.UU.',
  mexico: 'México',
  peru: 'Perú',
  colombia: 'Colombia',
  chile: 'Chile',
};

// Traduce el objeto `stats` del backend a las filas que muestra el <details>.
// ↑ ¿POR QUÉ EXISTE ESTA TABLA? Porque `stats` viene en inglés y en claves cortas
//   (recibidos, sinLink, viejas, sinMatch, otrasRegiones): mostrarlo crudo sería
//   "recibidos 100 / sinLink 3", que no responde la pregunta del usuario ("¿por
//   qué veo 60 y no 200?"). Cada fila tiene su etiqueta en castellano y una
//   frase corta que explica POR QUÉ se perdió cada cosa.
//   Se devuelve el total perdido además del detalle, porque la pregunta del
//   <summary> se arma con esa resta y no con `stats.total` (que no existe).
function buildStatsReport(meta) {
  const stats = meta?.stats;
  if (!stats) return null;

  const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
  // ↑ Number() con Number.isFinite: el backend manda números, pero un stats
  //   viejo o truncado no debe romper el render con "NaN ofertas perdidas".

  const otras = Object.entries(meta.regions || {})
    // ↓ Se recorren los buckets para poder NOMBRAR las otras regiones con
    //   ofertas, no solo contarlas. `stats.otrasRegiones` ya viene calculado;
    //   esto solo agrega el detalle de dónde quedaron.
    .filter(([key, list]) => key !== meta.origin && Array.isArray(list) && list.length > 0)
    .sort((a, b) => b[1].length - a[1].length);

  const items = [
    { label: 'Le pedimos a LinkedIn', value: num(stats.recibidos), hint: 'ofertas crudas' },
    { label: 'Sin link directo', value: num(stats.sinLink), hint: 'no se pueden mostrar' },
    { label: 'Muy viejas', value: num(stats.viejas), hint: 'fuera de la ventana de 30 días' },
    { label: 'Repetidas', value: num(stats.duplicados), hint: 'la misma oferta en dos páginas' },
    { label: 'Sin match con tu CV', value: num(stats.sinMatch), hint: 'no son de QA o no coinciden' },
    {
      label: 'En otra región',
      value: num(stats.otrasRegiones),
      hint: otras.length ? otras.map(([key, list]) => `${REGION_NAMES[key] || key} (${list.length})`).join(', ') : 'ninguna',
    },
  ].map((item) => ({ ...item, zero: item.value === 0 }));
  // ↑ `zero` marca las filas en cero para que el CSS las atenúe: lo que vale la
  //   pena mirar es dónde se perdieron ofertas, no una lista de ceros.

  const perdidas = num(stats.sinLink) + num(stats.viejas) + num(stats.duplicados) + num(stats.sinMatch) + num(stats.otrasRegiones);
  // ↑ Los cinco motivos de descarte, sumados. La resta del <summary> es
  //   guardados - perdidas, NO recibidos - pedidas: los recibidos incluyen los
  //   duplicados, que también se descartaron, y con la otra cuenta el número del
  //   summary no cerraba con ninguna de las filas de la tabla.
  // ↑ La resta del <summary> se hace con ESTOS cinco, no con recibidos - pedido:
  //   `stats.recibidos` incluye duplicados que sí se descartaron, y pedir - recibidas
  //   daba un número que no cerraba con ninguna de las filas de arriba.

  return {
    pedidas: num(meta.resultLimit) || 0,
    guardados: num(stats.guardados),
    perdidas,
    items,
  };
  // ↑ No se manda la cantidad que quedó en pantalla a propósito: esa lista pasa
  //   por el filtro de % de match, así que su número mezcla dos cosas (lo que
  //   descartó Apify y lo que filtró el usuario). Por eso el <summary> habla de
  //   la corrida, y el total filtrado ya está en el texto de estado de arriba.
}

function getSavedTheme() {
  try {
    return localStorage.getItem('buscaempleo-theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

// Clave del almacenamiento del navegador donde vive el % de match mínimo elegido.
// ↑ Sigue el mismo patrón que el tema ('buscaempleo-theme'): es una preferencia
//   de ESTA computadora, no del backend. Con el prefijo 'bt_' no chocamos con
//   otras apps que compartan el mismo dominio.
const MIN_SCORE_STORAGE_KEY = 'bt_min_score';

// Lee del navegador el % de match mínimo con el que quedó la sesión anterior.
// ↑ Mismo patrón perezoso que el tema: se le pasa la FUNCIÓN a useState, que la
//   ejecuta una sola vez al montar. Si no hay nada guardado, arranca en 0 (ver
//   todo). Si lo que hay guardado está corrupto ("abc", "NaN", un objeto), se
//   devuelve 0 en vez de romper: la app nunca crashea al cargar.
function getSavedMinScore() {
  try {
    const raw = localStorage.getItem(MIN_SCORE_STORAGE_KEY);
    if (raw === null) return 0;
    // ↑ null = nunca se guardó nada: es el primer arranque, devolvemos el default.
    const parsed = Number(raw);
    // ↑ localStorage guarda TEXTO. Number() lo vuelve número: "82" -> 82, y "abc"
    //   -> NaN, que es justamente el caso que hay que descartar.
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) return 0;
    // ↑ Solo aceptamos un entero de 0 a 100. Cualquier otra cosa (NaN, 82.5, 500,
    //   -3) se trata como "no había nada guardado" y vuelve al 0 por defecto.
    return parsed;
  } catch {
    return 0;
  }
}

export default function App() {
  // ↑ Este es el componente padre: acá vive casi todo el estado global de la app y
  //   desde acá se le pasan datos y funciones (callbacks) a los hijos por props.

  const [profile, setProfile] = useState(null);
  // ↑ Perfil completo de Ali (skills, contacto, etc.). Empieza en null porque aún
  //   no llegó la respuesta de la API.

  const [region, setRegion] = useState('argentina');
  // ↑ Región seleccionada. Arranca en Argentina y cambia al hacer click en las tabs.

  const [viewMode, setViewMode] = useState('live'); // 'live' | 'history'
  // ↑ Vista actual: 'live' muestra las ofertas recién buscadas y 'history' las ofertas
  //   vistas desde enero 2026 (con badge de activas/inactivas).

  const [jobsData, setJobsData] = useState({ jobs: [], _online: false });
  // ↑ Objeto que guarda las ofertas de la región y si vienen online o demo.
  //   _online nos permite mostrar un mensaje distinto según el origen de los datos.

  const [minScore, setMinScore] = useState(getSavedMinScore);
  // ↑ Filtro de "% de match mínimo" (0 = mostrar todas). Es un estado GLOBAL de
  //   la app, no por región: el usuario lo elige una vez y se mantiene al cambiar
  //   de pestaña o de vista (live/historial). Se inicializa con la función
  //   getSavedMinScore, que lee el valor de la sesión anterior del navegador.

  const [consultoras, setConsultoras] = useState([]);
  // ↑ Listado de consultoras QA que muestra la pestaña "Consultoras QA".

  const [analytics, setAnalytics] = useState(null);
  // ↑ Datos agregados del mercado para la página "Propuesta de Interés" (KPIs, barras, brechas).

  const [estados, setEstados] = useState(DEFAULT_ESTADOS);
  // ↑ Opciones del selector de estado de contacto. El backend puede traer las propias;
  //   si no, usamos estas por defecto.

  const [loading, setLoading] = useState(true);
  // ↑ Bandera que indica si se está cargando. Sirve para mostrar "Cargando…" en la toolbar.

  const [refreshing, setRefreshing] = useState(false);
  // ↑ Bandera del botón "Actualizar búsqueda": se pone en true mientras el refetch corre.

  const [searchingLinkedIn, setSearchingLinkedIn] = useState(false);
  const [linkedinSearchError, setLinkedInSearchError] = useState('');
  // ↑ Mensaje de error de la búsqueda de Apify, si la hubo. Va aparte de
  //   `linkedinMeta` a propósito: un error pertenece a UNA corrida, y si se
  //   mezclara con los metadatos el error viejo aparecería junto a los datos
  //   nuevos de la corrida que sí funcionó.

  const [apifyLimit, setApifyLimit] = useState(200);
  // ↑ Cuántas ofertas pedirle a Apify. 200 es el default del backend
  //   (APIFY_MAX_RESULTS), no un número inventado acá: el control de la
  //   toolbar manda este valor en el POST, así que lo que se ve es lo que corre.

  const [refreshNote, setRefreshNote] = useState('');
  // ↑ Aviso del botón "Actualizar búsqueda". Existe porque ese botón NO llama a
  //   Apify: solo re-consulta las fuentes gratuitas. Sin esta nota, tocarlo
  //   reemplazaba en silencio la lista de Apify por la de las gratuitas.

  const [linkedinMeta, setLinkedinMeta] = useState(null);
  // ↑ Metadatos de la ÚLTIMA corrida de Apify: { saved, stats, checkedAt,
  //   resultLimit, regions }. Antes no se guardaba nada de esto, y por eso el
  //   usuario no tenía forma de saber si lo que veía se había guardado.
  //   `regions` además sirve para no perder las ofertas que el backend metió en
  //   OTRO bucket que el pedido: la respuesta trae los 7 y `jobs` es solo el
  //   pedido, así que guardar solo `jobs` perdía parte de lo que se pagó.

  const [selectedJob, setSelectedJob] = useState(null); // { job, summary, region }
  // ↑ Oferta seleccionada para abrir el modal de detalle. null = modal cerrado.
  //   Cuando hay valor, guarda la oferta, su resumen y la región de la que vino.

  const [letter, setLetter] = useState(null);
  // ↑ Carta de presentación generada. null = modal de carta cerrado.

  const [theme, setTheme] = useState(getSavedTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('buscaempleo-theme', theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(MIN_SCORE_STORAGE_KEY, String(minScore));
      // ↑ Se guarda como texto (localStorage solo guarda strings) y se vuelve a
      //   leer con Number() en getSavedMinScore. El try/catch cubre el caso de
      //   navegación privada o almacenamiento lleno: el filtro sigue funcionando
      //   en memoria, solo no sobrevive al F5.
    } catch {}
  }, [minScore]);
  // ↑ Cada vez que cambia el filtro se persiste. Con el filtro en 0 también se
  //   guarda: así "volver a 0" se recuerda entre sesiones, que es lo esperado.

  // Al montar el componente (corre UNA sola vez porque el array de dependencias está vacío),
  // traemos el perfil y las ofertas de Argentina en paralelo con Promise.all.
  useEffect(() => {
    (async () => {
      const [p, j] = await Promise.all([loadProfile(), loadJobs('argentina')]);
      // ↑ Desestructuración de promesas: p = perfil, j = ofertas. Todas corren a la vez,
      //   así no esperamos una para empezar la otra.

      setProfile(p);
      setJobsData(j);
      setLoading(false);
      // ↑ Una vez que llegan los datos, los guardamos en estado y apagamos el loading.
    })();
  }, []);
  // ↑ Dependencias vacías: este efecto NO vuelve a ejecutarse en los re-renders.

  // Función que se ejecuta cuando el usuario elige una región/tab. useCallback la
  // "memoriza": solo se recrea si cambia viewMode, evitando renders innecesarios.
  const goToRegion = useCallback(async (nextRegion) => {
    setRegion(nextRegion);
    // ↑ Actualizamos la región elegida en el estado para que la tab quede "activa".

    if (nextRegion === 'consultoras') {
      // ↑ La pestaña Consultoras no trae ofertas: carga su propio directorio.
      setLoading(true);
      const data = await loadConsultoras();
      setConsultoras(data.consultoras || []);
      setEstados(data.estados && data.estados.length ? data.estados : DEFAULT_ESTADOS);
      setLoading(false);
      return;
      // ↑ return corta la función acá: no buscamos ofertas para esta sección.
    }
    if (nextRegion === 'analisis') {
      // ↑ La pestaña "Propuesta de Interés" carga el agregado de analítica.
      setLoading(true);
      setAnalytics(await loadAnalytics());
      setLoading(false);
      return;
    }
    // Cualquier otra tab es un país: buscamos las ofertas según la vista activa
    // (live = resultados frescos, history = historial guardado).
    setLoading(true);
    const apifyBucket = viewMode === 'live' ? linkedinMeta?.regions?.[nextRegion] : null;
    // ↓ Si la última corrida de Apify dejó ofertas PARA ESTA REGIÓN, se muestran
    //   esas y no se vuelve a pegarle al backend. Motivo: son más frescas que
    //   /api/jobs (que no incluye Apify) y el usuario ya las pagó. Sin esto, el
    //   aviso "Además hay N en Europa" del status sería mentira apenas se cambia
    //   de pestaña: la lista se reemplazaba por las fuentes gratuitas.
    if (apifyBucket && apifyBucket.length) {
      setJobsData({
        region: nextRegion,
        jobs: apifyBucket,
        _online: true,
        source: 'LinkedIn / Apify',
        checkedAt: linkedinMeta.checkedAt,
        fromApify: true,
      });
      setRefreshNote('');
    } else {
      setJobsData(viewMode === 'history' ? await loadHistory(nextRegion) : await loadJobs(nextRegion));
    }
    setLoading(false);
  }, [viewMode, linkedinMeta]);

  // Callback que recibe el % de match mínimo elegido en la toolbar. Es la
  // SEGUNDA capa de validación: el Toolbar ya no deja pasar valores fuera de
  // 80-100 desde el campo, pero acá se vuelve a acotar el rango para que el
  // estado nunca pueda quedar en un número imposible (aunque el valor venga de
  // un botón, de una extensión o de un futuro control).
  const handleMinScoreChange = useCallback((value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    // ↑ Si no es un número (NaN, texto vacío) se ignora: el filtro sigue como
    //   estaba y no se toca el listado.
    const rounded = Math.round(parsed);
    setMinScore(Math.min(100, Math.max(0, rounded)));
    // ↑ Math.min/max "aprieta" el valor al rango 0-100. Es la garantía de que
    //   minScore siempre es un entero válido, venga de donde venga.
  }, []);
  // ↑ useCallback con dependencias vacías: la función no cambia nunca, así que
  //   Toolbar no se re-renderiza de más por culpa de este callback.

  // Acción del botón "Actualizar búsqueda": fuerza al backend a re-consultar las fuentes
  // (ignorando la caché de 30 min) y recarga la región actual.
  async function handleRefresh() {
    setRefreshing(true);
    const result = await refreshJobs();
    // ↑ refreshJobs() ahora devuelve { ok }. Antes era fire-and-forget: si el
    //   POST fallaba, la lista se recargaba igual y la pantalla juraba que
    //   estaba actualizada cuando en realidad seguía con lo viejo.
    if (result && result.ok === false) {
      setRefreshNote('No se pudo actualizar: el backend no respondió. La lista que ves es la anterior.');
    }
    // ↑ Aviso explícito en vez de dejar la pantalla mintiendo con "recién
    //   actualizado". No bloquea nada: los datos que ya están siguen sirven.
    // En la pestaña Propuesta de Interés, el refresh debe recalcular la analítica
    // (no hay ofertas de una región que recargar como en las pestañas de países).
    if (region === 'analisis') {
      setAnalytics(await loadAnalytics());
    } else if (viewMode === 'history') {
      setJobsData(await loadHistory(region));
    } else if (jobsData.fromApify) {
      // ↓ CASO QUE ANTES PERDÍA DATOS: "Actualizar búsqueda" llama a
      //   POST /api/refresh, que re-consulta SOLO las fuentes gratuitas. La lista
      //   en pantalla venía de Apify, así que recargarla la reemplazaba entera
      //   por las gratuitas y las ofertas que el usuario pagó desaparecían de la
      //   vista (seguían en el historial, pero en pantalla no había rastro).
      //   Ahora se respeta lo que se está viendo y se explica qué pasó.
      setRefreshNote('Se actualizaron las fuentes gratuitas, pero la lista que ves viene de Apify y se mantiene: las ofertas de Apify no se vuelven a traer sin pagar otra ejecución. Ya están guardadas en tu base, así que las podés ver con "Desde enero 2026".');
      // ↑ NO se reemplaza jobsData. Reemplazarla era justo lo que hacía
      //   desaparecer de la pantalla lo que el usuario había pagado. Los datos
      //   frescos de las gratuitas quedan disponibles en cuanto el usuario
      //   vuelva a una lista normal (cambiar de región o tocar Apify).
    } else {
      setJobsData(await loadJobs(region));
    }
    setRefreshing(false);
  }

  async function handleLinkedInSearch() {
    setSearchingLinkedIn(true);
    setLinkedinSearchError('');
    setRefreshNote('');
    // ↑ Se borra la nota del refresh anterior: con la corrida nueva queda
    //   obsoleto un mensaje que decía "esto no lo toqué".
    try {
      const data = await searchLinkedInJobs(region, apifyLimit);
      // ↑ Se manda el limit de la toolbar. Ojo con el contrato: la respuesta
      //   trae MÁS de lo pedido (el backend pagina hasta 8 páginas), así que
      //   `total` NO tiene que coincidir con lo que dice el botón.

      // ↓ Se guarda la respuesta COMPLETA en `linkedinMeta` y NO en jobsData.
      //   Antes era al revés y por eso la lista se perdía: `jobs` es solo el
      //   bucket pedido, mientras que `regions` trae los siete. Guardar solo
      //   `jobs` descartaba las ofertas que assignRegion() metió en otro
      //   bucket (una de location "Berlin" en una búsqueda de Argentina), que
      //   es exactamente el dato que el usuario pagó y no veía.
      setLinkedinMeta({
        saved: data.saved || null,
        stats: data.stats || null,
        checkedAt: data.checkedAt || null,
        resultLimit: data.resultLimit || null,
        regions: data.regions || {},
        origin: region,
        // ↑ `origin`: la región para la que se buscó. Sirve para distinguir
        //   "el usuario pidió Argentina" de "el bucket se llama Argentina".
      });

      // ↓ Y la lista visible sale del bucket pedido, para no mezclar de golpe
      //   78 ofertas con las de las fuentes gratuitas.
      setJobsData({
        region: data.region,
        jobs: data.jobs || [],
        _online: data._online,
        source: data.source,
        checkedAt: data.checkedAt,
        fromApify: true,
        // ↑ Marca de que esta lista viene de Apify. La usa handleRefresh() para
        //   NO pisar esta lista con las fuentes gratuitas sin avisar.
      });
      setViewMode('live');
    } catch (error) {
      setLinkedinSearchError(error.message || 'No se pudo buscar en LinkedIn.');
    } finally {
      setSearchingLinkedIn(false);
    }
  }

  // Alterna entre vista live e historial, y recarga los datos que correspondan.
  // OJO: al volver de historial a "live" NO se sobreescribe lo que hay: si la
  // última búsqueda fue la de Apify, esa lista sigue en pantalla y las ofertas
  // ya están en el historial, así que no hay nada que recargar.
  async function handleToggleHistory() {
    const next = viewMode === 'history' ? 'live' : 'history';
    setViewMode(next);
    if (region === 'analisis') return;
    // ↑ En Propuesta de Interés solo cambia la vista global; su contenido no depende del historial.
    setLoading(true);
    if (next === 'history') {
      setJobsData(await loadHistory(region));
    } else if (jobsData.fromApify && region === linkedinMeta?.origin) {
      // ↓ Al volver a "live" después de mirar el historial: si lo que se estaba
      //   viendo era la corrida de Apify, NO se toca jobsData. Antes se llamaba a
      //   loadJobs() siempre, y eso reemplazaba las ofertas de Apify por las de
      //   las fuentes gratuitas cada vez que se alternaba la vista: de ahí la
      //   sensación de "se me pierden". Acá ya están en el historial igual, pero
      //   en pantalla tiene que seguir viéndose lo que el usuario_BUSCÓ.
    } else {
      setJobsData(await loadJobs(region));
    }
    setLoading(false);
  }

  // Abre el modal de detalle de una oferta. Primero pide el detalle enriquecido
  // (resumen de empresa y skills); si no lo consigue, usa la oferta del listado.
  async function openDetail(id) {
    const data = await loadJobDetail(id);
    if (data) {
      setSelectedJob({ job: data.job, summary: data.summary, region });
    } else {
      const fallback = (jobsData.jobs || []).find((j) => j.id === id);
      // ↑ find() recorre el arreglo y devuelve la primer oferta cuyo id coincida.
      setSelectedJob({ job: fallback, summary: null, region });
    }
  }

  // Genera la carta de presentación para una oferta. Si la API falla, arma una
  // carta básica en el cliente usando el título, la empresa y el perfil.
  async function handleGenerateLetter(id, letterRegion) {
    const data = await loadCoverLetter(letterRegion, id);
    if (data) {
      setLetter(data);
    } else {
      const job = (jobsData.jobs || []).find((j) => j.id === id) || selectedJob?.job;
      // ↑ Optional chaining: si selectedJob está null, no explota, devuelve undefined.
      setLetter({
        subject: `Postulación - ${job?.title || ''}`,
        body: `Hola equipo de ${job?.company || ''},\n\nMe postulo a la vacante con mi CV adjunto.\n\nSaludos,\n${profile?.fullName || 'Ali Tovar'}`,
      });
    }
  }

  // Actualización optimista del estado de una consultora: actualiza la UI al instante
  // (map devuelve un arreglo nuevo con la consultora editada) y el guardado real
  // lo hace ConsultorasList contra el backend.
  function handleConsultoraChange(id, patch) {
    setConsultoras((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    // ↑ map crea un nuevo arreglo y el spread {...c, ...patch} mezcla la consultora
    //   original con los campos nuevos (estado/notas) sin mutar el original.
  }

  // Lista de ofertas YA filtrada por % de match: solo las que llegan al mínimo.
  // ↑ Se calcula con useMemo porque es un filtro sobre un arreglo que puede
  //   tener cientos de ofertas: sin memo se repetiría en CADA re-render (al
  //   cambiar de tema, al abrir un modal, etc.) aunque el filtro no cambie.
  const visibleJobs = useMemo(
    () => (jobsData.jobs || []).filter((job) => Number(job.score ?? 0) >= minScore),
    [jobsData.jobs, minScore],
  );
  // ↑ El ?? 0 trata una oferta sin score como 0% de match, que es lo mismo que
  //   "sin filtro": así nunca desaparecen ofertas por un dato que no vino.
  //   El .filter NO modifica el arreglo original: devuelve uno nuevo.

  // Resumen de la última corrida de Apify para la toolbar: confirmación de
  // guardado, "actualizado hace X" y las estadísticas plegables.
  // ↑ Se arma acá y no en Toolbar porque necesita saber si la corrida fue la que
  //   se está mirando: mostrar "se guardaron N ofertas" mientras se ve otra
  //   región sería mentir.
  const linkedinReport = useMemo(() => {
    if (!linkedinMeta) return { saved: null, checkedAgo: '', stats: null, effectiveLimit: null };
    // ↑ Sin corrida todavía no hay nada que mostrar: cero banner, cero stats.

    const saved = linkedinMeta.saved
      ? {
        ok: Boolean(linkedinMeta.saved.ok),
        // ↑ El backend ya manda un `message` en español; se usa ese texto y
        //   solo se agrega el prefijo con el ícono, para no tener dos frases
        //   distintas diciendo lo mismo.
        text: linkedinMeta.saved.message || (linkedinMeta.saved.ok
          ? `Se guardaron ${linkedinMeta.saved.total} ofertas en tu base.`
          : 'La búsqueda funcionó pero las ofertas NO se guardaron.'),
      }
      : null;
    // ↑ null cuando el backend no mandó `saved`: es un caso distinto de "se
    //   guardaron 0" y tiene que verse distinto (nada vs. "no se pudo guardar").

    return {
      saved,
      checkedAgo: timeAgo(linkedinMeta.checkedAt) || '',
      effectiveLimit: linkedinMeta.resultLimit || null,
      stats: buildStatsReport(linkedinMeta),
    };
  }, [linkedinMeta, visibleJobs.length]);
  // ↑ useMemo porque se recalcula en cada render y solo depende de dos cosas:
  //   la corrida y cuántas ofertas quedan tras el filtro de % de match.

  // Frase que se le agrega al texto de estado para que se vea qué hizo el filtro.
  function filterSummary() {
    if (minScore <= 0) return '';
    // ↑ Con el filtro en 0 no se dice nada: la app se ve exactamente igual que
    //   antes de que este filtro existiera.
    const total = (jobsData.jobs || []).length;
    if (!visibleJobs.length) {
      // ↑ Caso "el filtro dejó la lista vacía": el mensaje tiene que explicar que
      //   las ofertas SÍ existen pero ninguna llega al % pedido, porque decir
      //   solamente "0 ofertas" haría pensar que la región no tiene resultados.
      return ` Ninguna de las ${total} ofertas llega al ${minScore}% de match: bajá el filtro o volvé al preset 0%.`;
    }
    return ` Filtro activo: ${visibleJobs.length} de ${total} ofertas con ${minScore}% de match o más.`;
  }

  // Texto de estado que se muestra en la toolbar, según qué se esté viendo.
  function statusText() {
    if (region === 'consultoras') {
      return `${consultoras.length} consultoras de referencia para outreach. El estado de contacto se guarda automáticamente.`;
    }
    if (region === 'analisis') {
      return loading ? 'Calculando la propuesta de interés…' : 'Mercado QA relevado en todas las regiones, comparado contra tu CV.';
    }
    if (loading) return 'Cargando…';
    if (searchingLinkedIn) return `Consultando LinkedIn con Apify (desde ${apifyLimit} ofertas; puede devolver más)…`;
      // ↑ El "máximo 50" de antes era mentira: el backend pagina hasta 8 páginas.
        //   Y no dice "cuántas vas a ver" sino "desde cuántas", porque el número
        //   pedido es un piso (en la prueba real: pedí 50, quedaron 78).
    if (linkedinSearchError) return `Búsqueda de LinkedIn: ${linkedinSearchError}`;
    if (refreshNote) return refreshNote;
      // ↑ El aviso del refresh va antes que el conteo porque explica una
        //   anomalía de la lista actual: si no, se lee como que la pantalla está
        //   rota. Es un return temprano solo cuando hay nota.
    if (jobsData.fromApify) {
      const otras = Object.entries(linkedinMeta?.regions || {}).filter(
        // ↓ Se excluye la región QUE SE ESTÁ VIENDO, no la que se pidió en la
        //   corrida: si el usuario ya está en la pestaña Europa, el aviso tiene
        //   que ofrecerle las demás, no las de Europa que ya está mirando.
        ([key, list]) => key !== region && Array.isArray(list) && list.length > 0,
      );
      // ↑ Aviso de las ofertas que el backend metió en OTROS buckets. No se
      //   pierden: están en `regions` y se ven al cambiar de pestaña (goToRegion
      //   las restaura), pero antes no había forma de saber que existían.
      const extra = otras.length
        ? ` Además hay ${otras.reduce((acc, [, list]) => acc + list.length, 0)} en ${otras.map(([key]) => REGION_NAMES[key] || key).join(', ')}.`
        : '';
      return `${visibleJobs.length} ofertas de LinkedIn (Apify) de ${REGION_NAMES[region] || region}, de los últimos 30 días.${extra}${filterSummary()}`;
      // ↑ El conteo usa la lista YA filtrada: el usuario ve cuántas quedan, no
      //   cuántas hay, y filterSummary() aclara el total por si quedó duda.
    }
    if (viewMode === 'history') {
      return `Historial de los últimos 6 meses · ${visibleJobs.length} ofertas · las más viejas se purgan solas. “No aparece” no confirma cobertura.${filterSummary()}`;
    }
    return (jobsData._online
      ? 'Conexión exitosa con las fuentes de empleo.'
      : 'Modo demo: no se pudo contactar las fuentes en línea. Mostrando ofertas de ejemplo.') + filterSummary();
    // ↑ Los paréntesis encierran el ternario para poder sumarle el filterSummary()
    //   con el operador +. Con el filtro en 0, filterSummary() devuelve '' y el
    //   texto queda idéntico al de antes.
  }

  const linkedinKeywords = linkedinProfileKeywords(profile);
  const outreachKeywords = (profile && (profile.title || profile.headline)) || 'QA Engineer';

  return (
    <div className="app">
      {/* ↑ Contenedor general de la app (máximo ancho y centrado). */}

      <header className="app-header">
        <div className="header-inner">
          <div className="brand-copy">
            <h1>🎯 BuscaEmpleo</h1>
            <p className="subtitle">Las mejores ofertas para <strong>Ali Tovar</strong> · QA Engineer</p>
          </div>
          <button
            className="theme-toggle"
            type="button"
            aria-pressed={theme === 'dark'}
            onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? '☀️ Modo claro' : '🌙 Modo oscuro'}
          </button>
        </div>
      </header>

      <main className="layout">
        {/* ↑ Layout de dos columnas: a la izquierda el CV y a la derecha las ofertas. */}

        <CvPanel profile={profile} />
        {/* ↑ Le pasamos el perfil por prop; CvPanel lo muestra en el panel lateral. */}

        <section className="jobs-panel">
          <RegionTabs current={region} onSelect={goToRegion} />
          {/* ↑ current = región activa, onSelect = función que se dispara con cada click. */}

          <Toolbar
            region={region}
            statusText={statusText()}
            viewMode={viewMode}
            refreshing={refreshing}
            searchingLinkedIn={searchingLinkedIn}
            onRefresh={handleRefresh}
            onLinkedInSearch={handleLinkedInSearch}
            onToggleHistory={handleToggleHistory}
            linkedinKeywords={linkedinKeywords}
            minScore={minScore}
            onMinScoreChange={handleMinScoreChange}
            apifyLimit={apifyLimit}
            onApifyLimitChange={setApifyLimit}
            // ↑ El select de cuántas ofertas pedir: el estado vive en App porque
            //   es App la que hace el POST. La toolbar solo avisa el valor nuevo.
            effectiveLimit={linkedinReport.effectiveLimit}
            // ↑ El límite REAL de la última corrida (`resultLimit` del backend),
            //   que puede diferir del elegido si el backend lo acota.
            savedMessage={linkedinReport.saved}
            checkedAgo={linkedinReport.checkedAgo}
            stats={linkedinReport.stats}
            // ↑ Los tres reportes de la corrida (guardado, hora y estadísticas).
            //   Ya venían en la respuesta del backend y nadie los leía.
          />
          {/* ↑ La toolbar recibe por props el estado y los callbacks; los hijos no
              modifican el estado del padre directamente, solo "avisan" con eventos.
              minScore + onMinScoreChange son el filtro de % de match: el valor va
              de bajada y el callback avisa cuando el usuario elige uno nuevo. */}

          {/* Render condicional: la sección derecha muestra un componente u otro
              según la región elegida (ofertas, consultoras o análisis). */}
          {region === 'consultoras' ? (
            <ConsultorasList consultoras={consultoras} estados={estados} onChange={handleConsultoraChange} keywords={outreachKeywords} />
            // ↑ Sección Consultoras QA: pasa el listado, los estados y el callback de cambio.
          ) : region === 'analisis' ? (
            <AnalysisPage
              data={analytics}
              profile={profile}
              viewMode={viewMode}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              onToggleHistory={handleToggleHistory}
              linkedinKeywords={linkedinKeywords}
            />
            // ↑ Propuesta de Interés: recibe los datos de analítica, el perfil y los
            //   controles de búsqueda (actualizar / desde enero / LinkedIn).
          ) : (
            <JobList key={`${region}-${viewMode}`} jobs={visibleJobs} viewMode={viewMode} minScore={minScore} onOpen={openDetail} />
            // ↑ Ofertas de la región YA filtradas por % de match (visibleJobs): el
            //   componente no sabe nada del filtro, solo recibe lo que tiene que
            //   mostrar. minScore lo recibe aparte SÓLO para poder explicar en el
            //   mensaje de "no hay nada" que el filtro dejó la lista vacía.
            //   Ojo: el key NO incluye minScore a propósito. Si lo incluyera, cada
            //   cambio de filtro remontaría la lista y perderías el orden elegido;
            //   el `safePage` de JobList ya se encarga de corregir la paginación
            //   cuando el filtro deja menos páginas.
          )}
        </section>
      </main>

      {selectedJob && (
        /* ↑ Render condicional: si hay una oferta seleccionada, aparece el modal de detalle. */
        <JobDetailModal
          job={selectedJob.job}
          summary={selectedJob.summary}
          region={selectedJob.region}
          profile={profile}
          onClose={() => setSelectedJob(null)}
          // ↑ El padre le da la función para cerrar el modal con una arrow function.
          onGenerateLetter={handleGenerateLetter}
        />
      )}

      {letter && <LetterModal letter={letter} onClose={() => setLetter(null)} />}
      {/* ↑ Igual que el anterior: solo renderiza la carta si ya fue generada. */}
    </div>
  );
}