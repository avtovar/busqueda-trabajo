// Render de humo con los DATOS REALES del backend vivo (3100), no con fixtures.
import { renderToStaticMarkup } from 'react-dom/server';
import JobList from 'F:/busqueda_trabajo/frontend/src/components/JobList.jsx';
import JobDetailModal from 'F:/busqueda_trabajo/frontend/src/components/JobDetailModal.jsx';

const cuenta = (h) => ({
  links: (h.match(/class="job-link[ "]/g) || []).length,
  search: (h.match(/class="job-link search"/g) || []).length,
  sinLink: (h.match(/class="job-link none"/g) || []).length,
  linkedin: (h.match(/portal-linkedin/g) || []).length,
  curada: (h.match(/portal-curada/g) || []).length,
  himalayas: (h.match(/portal-himalayas/g) || []).length,
  // Links dentro del <button> de la tarjeta: tiene que ser false (HTML inválido).
  linkDentroDelBoton: (h.match(/<button class="job-open"[\s\S]*?<\/button>/g) || []).some((b) => b.includes('<a ')),
});

Promise.all([
  fetch('http://127.0.0.1:3100/api/jobs?region=argentina').then((r) => r.json()),
  fetch('http://127.0.0.1:3100/api/history?region=argentina').then((r) => r.json()),
]).then(([jobs, history]) => {
  const html = renderToStaticMarkup(<JobList jobs={jobs.jobs} viewMode="live" minScore={0} onOpen={() => {}} />);
  const histHtml = renderToStaticMarkup(<JobList jobs={history.jobs} viewMode="history" minScore={0} onOpen={() => {}} />);

  console.log('/api/jobs:', jobs.jobs.length, 'ofertas ->', JSON.stringify(cuenta(html)));
  console.log('/api/history:', history.jobs.length, 'ofertas ->', JSON.stringify(cuenta(histHtml)));

  const sinDestino = history.jobs.find((j) => !j.applyUrl && !j.sourceUrl);
  const modal = renderToStaticMarkup(
    <JobDetailModal job={sinDestino} summary={null} region="argentina" profile={{ fullName: 'Ali Tovar', headline: 'QA', location: 'BA' }} onClose={() => {}} onGenerateLetter={() => {}} />,
  );
  console.log('\nModal de:', sinDestino.title, '| applyUrl:', JSON.stringify(sinDestino.applyUrl), '| sourceUrl:', JSON.stringify(sinDestino.sourceUrl), '| portal:', sinDestino.portal);
  console.log(modal.replace(/></g, '>\n<').split('\n').filter((l) => /disabled-note|portal-badge|chip-link|btn"/.test(l)).join('\n'));

  const conSearch = history.jobs.find((j) => !j.applyUrl && j.sourceUrl);
  if (conSearch) {
    const m2 = renderToStaticMarkup(
      <JobDetailModal job={conSearch} summary={null} region="argentina" profile={{ fullName: 'Ali', headline: 'QA', location: 'BA' }} onClose={() => {}} onGenerateLetter={() => {}} />,
    );
    console.log('\nModal de:', conSearch.title, '| applyUrl:', JSON.stringify(conSearch.applyUrl), '| portal:', conSearch.portal);
    console.log(m2.replace(/></g, '>\n<').split('\n').filter((l) => /disabled-note|portal-badge|chip-link|class="btn"/.test(l)).join('\n'));
  } else {
    console.log('\n(no hay en el historial una oferta sin applyUrl pero con sourceUrl)');
  }
});
