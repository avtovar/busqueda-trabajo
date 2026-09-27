import { useEffect, useState, useCallback } from 'react';
// ↑ Hooks de React: useState (memoria del componente), useEffect (efectos como
//   cargar datos al inicio) y useCallback (funciones "memorizadas" que no se
//   recrean en cada render, cosa que los hijos no se re-rendericen de más).

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

import { linkedinProfileKeywords } from './utils.js';

import {
  loadProfile, loadJobs, loadHistory, refreshJobs,
  loadJobDetail, loadCoverLetter, loadConsultoras, loadAnalytics, searchLinkedInJobs,
} from './api.js';
// ↑ Importamos las funciones de la capa de API. Cada una hace un fetch al backend
//   y, si falla, devuelve datos de respaldo para que la UI nunca quede vacía.

// Estados posibles de contacto de una consultora. Se usan como opciones del tracker.
const DEFAULT_ESTADOS = ['Sin contactar', 'Contactado', 'Respondió', 'Entrevista agendada', 'Descartada'];

function getSavedTheme() {
  try {
    return localStorage.getItem('buscaempleo-theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
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
    const data = viewMode === 'history' ? await loadHistory(nextRegion) : await loadJobs(nextRegion);
    setJobsData(data);
    setLoading(false);
  }, [viewMode]);

  // Acción del botón "Actualizar búsqueda": fuerza al backend a re-consultar las fuentes
  // (ignorando la caché de 30 min) y recarga la región actual.
  async function handleRefresh() {
    setRefreshing(true);
    await refreshJobs();
    // ↑ En la pestaña Propuesta de Interés, el refresh debe recalcular la analítica
    //   (no hay ofertas de una región que recargar como en las pestañas de países).
    if (region === 'analisis') {
      setAnalytics(await loadAnalytics());
    } else {
      const data = viewMode === 'history' ? await loadHistory(region) : await loadJobs(region);
      setJobsData(data);
    }
    setRefreshing(false);
  }

  async function handleLinkedInSearch() {
    setSearchingLinkedIn(true);
    setLinkedInSearchError('');
    try {
      const data = await searchLinkedInJobs(region);
      setJobsData(data);
      setViewMode('live');
    } catch (error) {
      setLinkedInSearchError(error.message || 'No se pudo buscar en LinkedIn.');
    } finally {
      setSearchingLinkedIn(false);
    }
  }

  // Alterna entre vista live y historial, y recarga los datos que correspondan.
  async function handleToggleHistory() {
    const next = viewMode === 'history' ? 'live' : 'history';
    setViewMode(next);
    if (region === 'analisis') return;
    // ↑ En Propuesta de Interés solo cambia la vista global; su contenido no depende del historial.
    setLoading(true);
    const data = next === 'history' ? await loadHistory(region) : await loadJobs(region);
    setJobsData(data);
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

  // Texto de estado que se muestra en la toolbar, según qué se esté viendo.
  function statusText() {
    if (region === 'consultoras') {
      return `${consultoras.length} consultoras de referencia para outreach. El estado de contacto se guarda automáticamente.`;
    }
    if (region === 'analisis') {
      return loading ? 'Calculando la propuesta de interés…' : 'Mercado QA relevado en todas las regiones, comparado contra tu CV.';
    }
    if (loading) return 'Cargando…';
    if (searchingLinkedIn) return 'Consultando LinkedIn con Apify (máximo 50 resultados)…';
    if (linkedinSearchError) return `Búsqueda de LinkedIn: ${linkedinSearchError}`;
    if (jobsData.source === 'LinkedIn / Apify') {
      return `${jobsData.jobs.length} ofertas de LinkedIn, filtradas a los últimos 30 días.`;
    }
    if (viewMode === 'history') {
      return `Historial de los últimos 6 meses · ${(jobsData.jobs || []).length} ofertas · las más viejas se purgan solas. “No aparece” no confirma cobertura.`;
    }
    return jobsData._online
      ? 'Conexión exitosa con las fuentes de empleo.'
      : 'Modo demo: no se pudo contactar las fuentes en línea. Mostrando ofertas de ejemplo.';
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
          />
          {/* ↑ La toolbar recibe por props el estado y los callbacks; los hijos no
              modifican el estado del padre directamente, solo "avisan" con eventos. */}

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
            <JobList key={`${region}-${viewMode}`} jobs={jobsData.jobs || []} viewMode={viewMode} onOpen={openDetail} />
            // ↑ Ofertas de la región: el key fuerza a React a volver a montar la lista
            //   cuando cambiamos de región o de vista, reseteando la paginación.
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