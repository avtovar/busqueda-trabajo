// Datos de respaldo (demo) usados cuando las fuentes en vivo están bloqueadas.
// Garantizan que la app y sus endpoints funcionen SIEMPRE, aunque no haya
// conexión a las APIs de empleo. Contienen el formato completo (match incl.).
export const DEMO_JOBS = {
  argentina: [
    {
      id: 'demo-ar-1', source: 'Demo', title: 'QA Automation Engineer', company: 'Ejemplo Fintech',
      location: 'Buenos Aires', regionGuess: 'argentina', applyUrl: 'https://example.com/apply',
      description: 'Automatización de pruebas API (REST/GraphQL) y mobile con JavaScript. Metodología Scrum y Jira.',
      tags: ['qa', 'automation', 'api', 'mobile'],
      matched: ['qa', 'automation', 'api testing', 'mobile testing', 'rest', 'postman', 'javascript', 'scrum', 'jira'],
      missed: [], requested: ['qa', 'automation', 'api testing', 'mobile', 'rest'], roles: ['qa', 'automation'], inTitle: true, score: 96,
    },
    {
      id: 'demo-ar-2', source: 'Demo', title: 'Backend/API Tester', company: 'Banco Digital',
      location: 'CABA', regionGuess: 'argentina', applyUrl: 'https://example.com/apply2',
      description: 'Testing de APIs con Postman, SQL y bases de datos. Pruebas de regresión y caja negra.',
      tags: ['api', 'postman', 'sql', 'regression'],
      matched: ['api testing', 'regression', 'rest', 'postman', 'sql'], missed: [],
      requested: ['api testing', 'postman', 'sql', 'regression'], roles: ['tester'], inTitle: true, score: 86,
    },
  ],
  europa: [
    {
      id: 'demo-eu-1', source: 'Demo', title: 'QA Software Engineer (Mobile)', company: 'EU Bank',
      location: 'Madrid, Spain', regionGuess: 'europa', applyUrl: 'https://example.com/eu1',
      description: 'Mobile test automation for Android/iOS digital banking in Europe.',
      tags: ['qa', 'automation', 'mobile', 'android', 'ios'],
      matched: ['qa', 'automation', 'mobile testing', 'mobile', 'android', 'ios'], missed: [],
      requested: ['qa', 'automation', 'mobile', 'android', 'ios'], roles: ['qa', 'automation'], inTitle: true, score: 92,
    },
  ],
  eeuu: [
    {
      id: 'demo-us-1', source: 'Demo', title: 'SDET (QA Automation Engineer)', company: 'US TechStartup',
      location: 'Remote - US', regionGuess: 'eeuu', applyUrl: 'https://example.com/us1',
      description: 'Build test automation frameworks for a fintech platform using JavaScript and Docker, API testing focus.',
      tags: ['sdet', 'qa', 'automation', 'api', 'docker'],
      matched: ['qa', 'automation', 'api testing', 'javascript'], missed: ['docker'],
      requested: ['sdet', 'qa', 'automation', 'api', 'docker', 'javascript'], roles: ['automation', 'qa'], inTitle: true, score: 88,
    },
  ],
};

// Devuelve el plano (flat) de las ofertas demo
export function demoFlat() {
  return Object.values(DEMO_JOBS).flat();
}
