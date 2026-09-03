import { useEffect, useState, useCallback } from 'react';
import CvPanel from './components/CvPanel.jsx';
import RegionTabs from './components/RegionTabs.jsx';
import Toolbar from './components/Toolbar.jsx';
import JobList from './components/JobList.jsx';
import ConsultorasList from './components/ConsultorasList.jsx';
import JobDetailModal from './components/JobDetailModal.jsx';
import LetterModal from './components/LetterModal.jsx';
import {
  loadProfile, loadJobs, loadHistory, refreshJobs,
  loadJobDetail, loadCoverLetter, loadConsultoras,
} from './api.js';

const DEFAULT_ESTADOS = ['Sin contactar', 'Contactado', 'Respondió', 'Entrevista agendada', 'Descartada'];

export default function App() {
  const [profile, setProfile] = useState(null);
  const [region, setRegion] = useState('argentina');
  const [viewMode, setViewMode] = useState('live'); // 'live' | 'history'
  const [jobsData, setJobsData] = useState({ jobs: [], _online: false });
  const [consultoras, setConsultoras] = useState([]);
  const [estados, setEstados] = useState(DEFAULT_ESTADOS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedJob, setSelectedJob] = useState(null); // { job, summary, region }
  const [letter, setLetter] = useState(null);

  useEffect(() => {
    (async () => {
      const [p, j] = await Promise.all([loadProfile(), loadJobs('argentina')]);
      setProfile(p);
      setJobsData(j);
      setLoading(false);
    })();
  }, []);

  const goToRegion = useCallback(async (nextRegion) => {
    setRegion(nextRegion);
    if (nextRegion === 'consultoras') {
      setLoading(true);
      const data = await loadConsultoras();
      setConsultoras(data.consultoras || []);
      setEstados(data.estados && data.estados.length ? data.estados : DEFAULT_ESTADOS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = viewMode === 'history' ? await loadHistory(nextRegion) : await loadJobs(nextRegion);
    setJobsData(data);
    setLoading(false);
  }, [viewMode]);

  async function handleRefresh() {
    setRefreshing(true);
    await refreshJobs();
    const data = viewMode === 'history' ? await loadHistory(region) : await loadJobs(region);
    setJobsData(data);
    setRefreshing(false);
  }

  async function handleToggleHistory() {
    const next = viewMode === 'history' ? 'live' : 'history';
    setViewMode(next);
    setLoading(true);
    const data = next === 'history' ? await loadHistory(region) : await loadJobs(region);
    setJobsData(data);
    setLoading(false);
  }

  async function openDetail(id) {
    const data = await loadJobDetail(id);
    if (data) {
      setSelectedJob({ job: data.job, summary: data.summary, region });
    } else {
      const fallback = (jobsData.jobs || []).find((j) => j.id === id);
      setSelectedJob({ job: fallback, summary: null, region });
    }
  }

  async function handleGenerateLetter(id, letterRegion) {
    const data = await loadCoverLetter(letterRegion, id);
    if (data) {
      setLetter(data);
    } else {
      const job = (jobsData.jobs || []).find((j) => j.id === id) || selectedJob?.job;
      setLetter({
        subject: `Postulación - ${job?.title || ''}`,
        body: `Hola equipo de ${job?.company || ''},\n\nMe postulo a la vacante con mi CV adjunto.\n\nSaludos,\n${profile?.fullName || 'Ali Tovar'}`,
      });
    }
  }

  function handleConsultoraChange(id, patch) {
    setConsultoras((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function statusText() {
    if (region === 'consultoras') {
      return `${consultoras.length} consultoras de referencia para outreach. El estado de contacto se guarda automáticamente.`;
    }
    if (loading) return 'Cargando…';
    if (viewMode === 'history') {
      return `Mostrando ofertas activas y vistas en los últimos 30 días (${(jobsData.jobs || []).length}).`;
    }
    return jobsData._online
      ? 'Conexión exitosa con las fuentes de empleo.'
      : 'Modo demo: no se pudo contactar las fuentes en línea. Mostrando ofertas de ejemplo.';
  }

  const linkedinKeywords = (profile && (profile.title || profile.headline)) || 'QA Engineer';

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <h1>🎯 BuscaEmpleo</h1>
          <p className="subtitle">Las mejores ofertas para <strong>Ali Tovar</strong> · QA Engineer</p>
        </div>
      </header>

      <main className="layout">
        <CvPanel profile={profile} />

        <section className="jobs-panel">
          <RegionTabs current={region} onSelect={goToRegion} />

          <Toolbar
            region={region}
            statusText={statusText()}
            viewMode={viewMode}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onToggleHistory={handleToggleHistory}
            linkedinKeywords={linkedinKeywords}
          />

          {region === 'consultoras' ? (
            <ConsultorasList consultoras={consultoras} estados={estados} onChange={handleConsultoraChange} />
          ) : (
            <JobList jobs={jobsData.jobs || []} viewMode={viewMode} onOpen={openDetail} />
          )}
        </section>
      </main>

      {selectedJob && (
        <JobDetailModal
          job={selectedJob.job}
          summary={selectedJob.summary}
          region={selectedJob.region}
          profile={profile}
          onClose={() => setSelectedJob(null)}
          onGenerateLetter={handleGenerateLetter}
        />
      )}

      {letter && <LetterModal letter={letter} onClose={() => setLetter(null)} />}
    </div>
  );
}
