// Capa de acceso a la API del backend. Misma lógica que el app.js original:
// si el fetch falla (server caído durante desarrollo, por ejemplo), cae a
// datos de ejemplo para que la UI nunca quede vacía.
//
// PATRÓN DEL ARCHIVO: una función por endpoint del backend.
// Centralizar el acceso a la red en un solo lugar sirve para tres cosas:
//   1) Cambiar la URL base o el proxy (config de Vite) en un solo archivo.
//   2) Decidir UNA sola vez qué pasa si el servidor no responde (el FALLBACK).
//   3) Que los componentes no tengan que saber ni una URL: solo llaman
//      loadJobs('argentina') y reciben datos.
// Las URLs son relativas ("/api/..."): en desarrollo Vite las reenvía al
// backend (proxy de vite.config.js) y en producción las sirve el mismo server.
// No hay timeout ni AbortController: si el backend se cuelga, la promesa queda
// esperando indefinidamente (eso sí, el resto de la UI sigue funcionando).

// FALLBACK: datos de respaldo que se usan cuando el backend no responde.
// Así la pantalla nunca se queda en blanco, aunque no haya internet o server.
// ↑ Ojo con la FORMA: cada clave tiene que coincidir con lo que devuelve el
//   backend, porque estos objetos se mezclan con las respuestas reales sin que
//   el frontend distinga uno de otro.
export const FALLBACK = {
  profile: {
    // ↑ Perfil "falso" de Ali por si no llega /api/profile.
    fullName: 'Ali Valentin Tovar Morales',
    title: 'QA Engineer',
    headline: 'QA Engineer | Manual & Automation Web y Mobile | API Testing | Azure DevOps',
    location: 'Buenos Aires, Argentina',
    summary: 'Profesional QA especializado en fintech/banca. Testing web/mobile, API, automatización y metodologías ágiles con foco en IA aplicada.',
    linkedin: 'https://www.linkedin.com/in/ali-v-tovar',
    github: 'https://github.com/avtovar',
    // ↑ skills es un objeto { skill: peso }. Cada oferta se matchea contra estos pesos.
    skills: { qa: 1, 'manual testing': 1, 'api testing': 1, mobile: 0.9, automation: 1, jira: 1, python: 0.8, javascript: 0.9, scrum: 0.9 },
    // ↑ Es una versión recortada: solo los skills más pesados del perfil real.
  },
  jobs: {
    // ↑ Ofertas de ejemplo organizadas por región (mismas claves que usa la UI).
    argentina: [
      // ↑ Cada oferta demo tiene la misma forma que las reales: id, título, empresa,
      //   skills matcheados y score. Así la UI no distingue entre demo y online.
      { id: 'demo-ar-1', source: 'Demo', title: 'QA Automation Engineer', company: 'Ejemplo Fintech', location: 'Buenos Aires', regionGuess: 'argentina', applyUrl: '#', description: 'Automatización de pruebas API (REST/GraphQL) y mobile con JavaScript. Metodología Scrum y Jira.', tags: ['qa', 'automation', 'api', 'mobile'], matched: ['qa', 'automation', 'api testing', 'mobile testing', 'rest', 'postman', 'javascript', 'scrum', 'jira'], missed: [], requested: ['qa', 'automation', 'api testing', 'mobile', 'rest'], inTitle: true, score: 96 },
      // ↑ matched = skills que el perfil tiene y pide la oferta (se muestran
      //   como tags verdes); missed = los que pide y no tenés (brechas).
      { id: 'demo-ar-2', source: 'Demo', title: 'Backend/API Tester', company: 'Banco Digital', location: 'CABA', regionGuess: 'argentina', applyUrl: '#', description: 'Testing de APIs con Postman, SQL y bases de datos. Pruebas de regresión y caja negra.', tags: ['api', 'postman', 'sql', 'regression'], matched: ['api testing', 'regression', 'rest', 'postman', 'sql'], missed: [], requested: ['api testing', 'postman', 'sql', 'regression'], inTitle: true, score: 86 },
    ],
    europa: [
      { id: 'demo-eu-1', source: 'Demo', title: 'QA Software Engineer (Mobile)', company: 'EU Bank', location: 'Madrid, Spain', regionGuess: 'europa', applyUrl: '#', description: 'Mobile test automation for Android/iOS digital banking in Europe.', tags: ['qa', 'automation', 'mobile', 'android', 'ios'], matched: ['qa', 'automation', 'mobile testing', 'mobile', 'android', 'ios'], missed: [], requested: ['qa', 'automation', 'mobile', 'android', 'ios'], inTitle: true, score: 92 },
    ],
    eeuu: [
      // ↑ Esta de abajo es la única con `missed` con contenido: muestra cómo se
      //   ve una brecha (pedí Docker y el perfil no lo tiene).
      { id: 'demo-us-1', source: 'Demo', title: 'SDET (QA Automation Engineer)', company: 'US TechStartup', location: 'Remote - US', regionGuess: 'eeuu', applyUrl: '#', description: 'Build test automation frameworks for a fintech platform using JavaScript and Docker, API testing focus.', tags: ['sdet', 'qa', 'automation', 'api', 'docker'], matched: ['qa', 'automation', 'api testing', 'javascript'], missed: ['docker'], requested: ['sdet', 'qa', 'automation', 'api', 'docker', 'javascript'], inTitle: true, score: 88 },
    ],
    // ↑ Las regiones que no están acá (méxico, perú, Colombia, Chile) devuelven
    //   una lista vacía si el server no está: es preferible a mostrar un error.
  },
};

// Trae el perfil del candidato desde el backend (/api/profile).
// ↑ `async` + `await`: la función devuelve una promesa y espera la respuesta del
//   servidor sin bloquear la pantalla. El `catch` va VACÍO a propósito: no hay
//   log ni aviso porque el objetivo es que la app siga andando igual.
export async function loadProfile() {
  try {
    const res = await fetch('/api/profile');
    // ↑ res.ok vale true en respuestas 2xx (o sea, "el server respondió bien").
    if (res.ok) return await res.json();
    // ↑ Si el server responde bien, devolvemos el JSON ya parseado.
  } catch {}
  return FALLBACK.profile;
  // ↑ Si el fetch tiró error, caemos al perfil de respaldo del FALLBACK.
}

// Trae las ofertas rankeadas de una región (/api/jobs?region=X).
// ↑ Devuelve { region, jobs: [...] }: la lista ya viene ordenada por % de match
//   desde el backend; el frontend solo la muestra y la pagina.
export async function loadJobs(region) {
  try {
    const res = await fetch(`/api/jobs?region=${region}`);
    // ↑ Backticks (``) permiten meter variables dentro del string de la URL.
    if (res.ok) return await res.json();
  } catch {}
  // Si el server no responde, devolvemos las ofertas demo de esa región.
  return { region, jobs: FALLBACK.jobs[region] || [], _online: false };
  // ↑ _online: false le avisa a la UI que estamos en "modo demo".
  //   El "_" adelante es una convención para marcar un campo interno.
}

// Trae el historial de ofertas vistas de una región (/api/history?region=X).
// A diferencia de loadJobs, acá no hay fallback con datos: si no hay server,
// simplemente devolvemos un historial vacío.
// ↑ ¿Por qué no hay datos demo acá? Porque el historial es algo personal del
//   usuario: inventar ofertas "vistas" sería mostrar información falsa.
export async function loadHistory(region) {
  try {
    const res = await fetch(`/api/history?region=${region}`);
    if (res.ok) return await res.json();
  } catch {}
  return { region, jobs: [] };
  // ↑ Lista vacía = el componente muestra su mensaje de "todavía no hay historial".
}

// Pide al backend que refresque la búsqueda YA, ignorando la caché de 30 min.
// No usa la respuesta: solo es un "disparador" (POST sin body).
export async function refreshJobs() {
  try {
    // ↑ "Fire and forget": dispara la petición y no espera ni mira el resultado.
    //   El POST sin body le dice al backend "borra la caché y buscá de nuevo".
    await fetch('/api/refresh', { method: 'POST' });
  } catch {}
}

// ↑ ÚNICA función de este archivo que NO cae al FALLBACK: si falla, lanza el
//   error. Motivo: esta búsqueda delega en un servicio externo (Apify), tarda y
//   cuesta plata; si falló, el usuario tiene que enterarse, y el componente que
//   llama es el que muestra el mensaje de error.
export async function searchLinkedInJobs(region) {
  let response;
  // ↑ `let` porque se asigna adentro del try y se usa después del catch.
  try {
    response = await fetch('/api/linkedin-search', {
      method: 'POST',
      // ↑ method: 'POST' = enviamos datos (una región), no solo pedimos.
      headers: { 'Content-Type': 'application/json' },
      // ↑ Le decimos al server que lo que va en el body es JSON, no texto plano.
      body: JSON.stringify({ region }),
      // ↑ El body viaja como TEXTO: por eso hay que convertir el objeto con
      //   JSON.stringify. El server lo vuelve a convertir en objeto al recibirlo.
    });
  } catch {
    // ↑ Ni siquiera hubo respuesta (server apagado o no hay internet).
    throw new Error('No se pudo conectar con el backend local.');
  }

  // ↑ Si el body de error no es JSON (por ejemplo, es un HTML de error), el
  //   .catch(() => ({})) evita que el parseo reviente y nos da un objeto vacío.
  const data = await response.json().catch(() => ({}));
  // ↑ response.ok false + cuerpo con { error } = el server nos explicó qué pasó.
  if (!response.ok) throw new Error(data.error || `La búsqueda falló (HTTP ${response.status}).`);
  // ↑ Si el server no mandó mensaje, mostramos al menos el código HTTP (500, 404...).
  return data;
}

// Trae el detalle enriquecido de una oferta (/api/job?q=ID) con resumen de empresa y skills.
export async function loadJobDetail(id) {
  try {
    const res = await fetch(`/api/job?q=${encodeURIComponent(id)}`);
    // ↑ encodeURIComponent limpia el id por si trae caracteres especiales.
    if (res.ok) return await res.json();
  } catch {}
  return null;
  // ↑ null = no se pudo; quien llama decide qué hacer (ej. usar la oferta del listado).
}

// Pide la carta de presentación generada por el backend (/api/cover-letter).
// ↑ Recibe los DOS datos que necesita el endpoint: la región (para saber el
//   idioma) y el id de la oferta (para escribir sobre ese puesto).
export async function loadCoverLetter(region, id) {
  try {
    const res = await fetch(`/api/cover-letter?region=${region}&id=${encodeURIComponent(id)}`);
    if (res.ok) return await res.json();
  } catch {}
  return null;
  // ↑ Sin carta no se abre el modal: el frontend simplemente no muestra nada.
}

// Trae el listado de consultoras con su estado de contacto persistido.
export async function loadConsultoras() {
  try {
    const res = await fetch('/api/consultoras');
    if (res.ok) return await res.json();
  } catch {}
  // Si falla, devolvemos listado vacío pero con los estados por defecto,
  // así el tracker de contacto sigue funcionando visualmente.
  return { consultoras: [], estados: ['Sin contactar', 'Contactado', 'Respondió', 'Entrevista agendada', 'Descartada'] };
  // ↑ Devolvemos la lista de estados igual: si no, el componente no tendría con
  //   qué pintar las etiquetas de estado y se rompería la tabla.
}

// Trae el agregado de analítica del mercado (/api/analytics): KPIs, brechas, etc.
export async function loadAnalytics() {
  // ↑ Devuelve null si falla (no hay demo de analítica): es un agregado que
  //   tendría que inventarse con datos falsos, así que la página lo oculta.
  try {
    const res = await fetch('/api/analytics');
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

// Guarda el estado/notas de contacto de una consultora en el backend (POST).
// ↑ `patch` es un pedacito de objeto con SOLO lo que cambió (ej. { estado }).
//   El `...` (spread) lo mezcla con el id para mandar un solo objeto.
export async function saveConsultoraStatus(id, patch) {
  try {
    await fetch('/api/consultoras/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
      // ↑ JSON.stringify convierte el objeto a texto JSON para mandarlo en el body.
    });
  } catch {
    // si falla el guardado, el cambio queda solo visual hasta el próximo refresh
  }
  // ↑ No mira la respuesta: es un "disparador" como refreshJobs(). Si el POST
  //   falla, el error se traga (catch vacío) y la UI sigue con lo que ve.
}
