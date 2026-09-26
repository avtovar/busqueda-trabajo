// ============================================================================
// OFERTAS DE EJEMPLO (demo): respaldo para cuando las fuentes en vivo fallan
// o están bloqueadas. Así la app y todos sus endpoints funcionan SIEMPRE,
// incluso sin conexión a las APIs de empleo. Dato estructurado, sin lógica.
// ============================================================================
// Datos de respaldo (demo) usados cuando las fuentes en vivo están bloqueadas.
// Garantizan que la app y sus endpoints funcionen SIEMPRE, aunque no haya
// conexión a las APIs de empleo. Contienen el formato completo (match incl.).
// ↑ Contiene ofertas de EJEMPLO (datos inventados) que se usan solo como último
// ↑ recurso: cuando las fuentes en vivo fallan, devuelven 0 resultados o están
// ↑ bloqueadas. Sirven para dos cosas: que la UI nunca se vea vacía (el usuario
// ↑ puede probar botones, filtros y detalle sin conexión) y que los endpoints
// ↑ /api/* respondan 200 siempre, para que no fallen los tests ni se caiga la app.
// ↑ Ojo: NO son datos reales. Las empresas son de mentira y los links apuntan a
// ↑ example.com, justamente para que nadie los confunda con una oferta verdadera.
//
// ↓ La forma es un OBJETO con una clave por región, y no un array plano como en
// ↓ curatedJobs.js. ¿Por qué? Porque acá el servidor NO vuelve a clasificar nada:
// ↓ cuando entra el modo demo, index.js copia estas listas tal cual a la respuesta
// ↓ (solo las ordena por `score`) y las keys DEBEN coincidir con las regiones que
// ↓ usa la app: 'argentina', 'europa' y 'eeuu'.
export const DEMO_JOBS = {
  // ↓ Cada valor es un array de ofertas de ejemplo de esa región.
  argentina: [
    // ↓ Para que el modo demo se vea igual que el real, estas ofertas mockean el
    // ↓ formato COMPLETO de la respuesta, incluido el resultado del matching:
    // ↓   id, source, title, company, location, regionGuess, applyUrl, description,
    // ↓   tags  → los mismos campos que trae una oferta curada o de una fuente en
    // ↓            vivo (el "contrato" que devuelve /api/jobs).
    // ↓   matched     → skills del CV que SÍ encontró en la vacante.
    // ↓   missed      → skills que pidió la vacante y no están en el CV.
    // ↓   requested   → lo que el usuario pidió buscar (va en la barra de búsqueda).
    // ↓   roles       → los roles detectados en el título (QA, automation...).
    // ↓   inTitle     → true si alguna de esas palabras aparece en el título.
    // ↓   score       → el % de coincidencia, un número de 0 a 100.
    // ↓ Los campos del matching (matched, missed, score...) los calcula
    // ↓ matcher.js cuando las ofertas son reales; al estar mockeados, el frontend
    // ↓ los puede pintar tal cual y los tests no dependen de la red.
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
    // ↑ Ofertas de ejemplo para la región Europa. Mismo formato que las de arriba:
    // ↑ `regionGuess: 'europa'` es lo que hace que la oferta caiga en esa pestaña.
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
    // ↑ Ofertas de ejemplo para la región EEUU (y remoto USA). Fijate que esta
    // ↑ tiene `missed: ['docker']` a propósito: sirve para ver en la interfaz cómo
    // ↑ se muestran las skills que te faltan, sin tener que inventar una búsqueda.
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
// ↑ La app por dentro guarda las ofertas agrupadas por región (un objeto con una
// ↑ lista por región) y recién al responder /api/jobs le pasa la lista de UNA sola
// ↑ región. Esta función hace el camino contrario: junta las 3 listas de demo en
// ↑ una sola. `Object.values` saca los 3 arrays del objeto y `.flat()` los une.
// ↑ Sirve para recorrer todas las ofertas demo juntas, sin ir región por región.
// ↑ Dato: hoy ningún archivo del proyecto la llama (es una utilidad que queda
// ↑ disponible por si hace falta); el modo demo de index.js usa DEMO_JOBS directo.
export function demoFlat() {
  // ↑ Notá que solo devuelve datos: no guarda nada, no llama a la red ni muta el
  // ↑ objeto DEMO_JOBS. Cada vez que se llama arma un array nuevo.
  return Object.values(DEMO_JOBS).flat();
}
