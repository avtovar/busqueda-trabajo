// ============================================================================
// PERFIL DE ALI TOVAR (QA Engineer): la "fuente de verdad" del buscador.
// Define los skills que domina (con su peso), los keywords de búsqueda, los
// skills del mercado para detectar brechas y las regiones con su idioma.
// El motor de matching y la analítica se apoyan en estos datos.
// ============================================================================
// ↑ Este archivo es solo DATOS, no lógica. Es el único lugar del backend donde
//   se dice qué sabe y qué busca Ali. Si hay que cambiar un peso, una keyword o
//   una región, se cambia acá y el resto de la app se entera solo, porque todos
//   los módulos (matcher.js, analytics.js, apifyLinkedin.js, coverLetter.js,
//   index.js) importan este mismo objeto PROFILE.
import { readFile } from 'node:fs/promises';
// ↑ Importa readFile de "fs/promises": la versión con promesas, que se espera
//   con await en vez de bloquear todo el proceso del servidor.
import { join } from 'node:path';
// ↑ join() arma rutas de archivos del sistema. OJO: en este archivo no se usa
//   (quedó de una versión anterior); las rutas del CV están escritas a mano más
//   abajo, en loadCvPath().

// Datos del perfil extraídos del CV (F:\Curriculum-Vitae)
// Esta es la fuente de verdad que usa el motor de matching.
// ↑ PROFILE es un objeto común y corriente de JavaScript. Se declara con const
//   para que nadie lo reasigne por error, y al final del archivo se exporta con
//   nombre (export { PROFILE }) para que los demás archivos lo importen.
const PROFILE = {
  // ── 1) DATOS PERSONALES ───────────────────────────────────────────────
  // ↑ "La foto" del candidato: nombre, título, dónde está y su resumen. Los
  //   muestra el panel del CV del frontend (CvPanel.jsx) y se usan para armar
  //   las cartas de presentación (coverLetter.js).
  fullName: 'Ali Valentin Tovar Morales',
  // ↑ El nombre completo, tal cual figura en el CV.
  title: 'QA Engineer',
  //   La palabra "headline" es la frase de una línea bajo el nombre: si el texto
  //   es largo, el valor se deja en la línea siguiente para no ensanchar la
  //   línea (es el mismo string, solo partido en dos renglones de código).
  headline:
    'QA Engineer | Manual & Automation Web y Mobile | API Testing | Azure DevOps | Atlassian',
  location: 'Buenos Aires, Argentina',
  yearsExperience: 8,
  // ↑ coverLetter.js lo interpola en la carta: "QA Engineer con 8+ años de
  //   experiencia...". Si cambiás el número, la carta se actualiza sola.
  summary:
    'Profesional de Informática con sólida trayectoria en Quality Assurance (QA), especializado en robustez y calidad de software en sectores críticos como banca digital y fintech. Experiencia en pruebas funcionales, testing web, mobile (Android/iOS), back-end y front-end bajo metodologías ágiles (Scrum) con Jira, Xray y Azure DevOps. Desde 2026 enfocado en IA generativa y agentes inteligentes (Claude Code, Claude Design).',
  // ↑ El resumen en un solo párrafo largo: se muestra completo en el panel del CV.
  email: '',
  // ↑ Está vacío: el contacto se hace por LinkedIn/GitHub y el panel del CV
  //   (CvPanel.jsx) no tiene un campo para el mail.
  linkedin: 'https://www.linkedin.com/in/ali-v-tovar',
  // ↑ Contacto: lo muestra el panel del CV y lo intercala coverLetter.js al
  //   final de la carta ("Podés contactarme por LinkedIn: ...").
  github: 'https://github.com/avtovar',
  // ↑ Portfolio de código: los proyectos del bloque siguiente salen de acá.

  // Proyectos públicos del portafolio en GitHub (fuente: repos de avtovar, sin forks).
  // ↑ projects: ejemplos reales de testing y desarrollo para mostrar en la analítica
  // Cada proyecto tiene: nombre, descripción, link al repo, link a la web (si
  // tiene) y lenguaje. analytics.js los usa para buscar evidencia: si un repo
  // menciona "playwright", muestra que esa brecha tiene un proyecto que lo roza.
  projects: [
    {
      nombre: 'busqueda-trabajo',
      descripcion:
        'Buscador y analizador de vacantes QA en 7 regiones con motor de match, analítica de mercado y propuesta de interés (Node.js + Express + React/Vite).',
      url: 'https://github.com/avtovar/busqueda-trabajo',
      home: null,
      lenguaje: 'JavaScript',
    },
    {
      nombre: 'tiendaciudad-tests',
      descripcion:
        'Suite de pruebas automatizadas (TypeScript) sobre una tienda en línea: casos de compra, validaciones de formularios y flujo crítico de checkout.',
      url: 'https://github.com/avtovar/tiendaciudad-tests',
      home: null,
      lenguaje: 'TypeScript',
    },
    {
      nombre: 'automatizacion_pagina_brubank',
      descripcion:
        'Automatización web de un home banking (Brubank): pruebas de login, consultas y flujos de pago sobre un entorno fintech real.',
      url: 'https://github.com/avtovar/automatizacion_pagina_brubank',
      home: null,
      lenguaje: 'HTML',
    },
    {
      nombre: 'proyecto_web_para_adelgazar',
      descripcion: 'Aplicación web completa desplegada en Vercel: frontend maquetado, persistencia y lógica de negocio.',
      url: 'https://github.com/avtovar/proyecto_web_para_adelgazar',
      home: 'https://proyecto-web-para-adelgazar.vercel.app',
      lenguaje: 'JavaScript',
    },
    {
      nombre: 'react',
      descripcion: 'Ejercicios prácticos de componentes en React (estado y props) con deploy en Vercel.',
      url: 'https://github.com/avtovar/react',
      home: 'https://ejercicio3-liart.vercel.app',
      lenguaje: 'HTML',
    },
    {
      nombre: 'proyecto_API',
      descripcion: 'Práctica de consumo y construcción de APIs con Python: peticiones, respuestas y manejo de endpoints.',
      url: 'https://github.com/avtovar/proyecto_API',
      home: null,
      lenguaje: 'Python',
    },
  ],

  // ── 2) SKILLS CON PESO: EL CORAZÓN DEL SCORING ────────────────────────
  // Skills con pesos (0-1) para calcular el match
  // ↑ skills: tecnologías que Ali domina, con peso 0-1 según su importancia
  //
  // QUÉ SIGNIFICA EL PESO (es el corazón de todo el buscador):
  //  - 1      = skill central del perfil (QA, automation, jira...). Si la
  //             vacante lo pide, aporta el máximo de puntos.
  //  - 0.9/0.8 = importante, pero no definitorio (mobile, javascript, scrum).
  //  - 0.7/0.6 = secundario o complementario (sql, docker, ci/cd).
  //  - 0.5    = apenas un apoyo: interés nuevo, todavía sin años de oficio.
  // En matcher.js los pesos se SUMAN y se comparan contra el total que pide la
  // oferta, así que un skill pesado mueve más el % que uno liviano.
  // Analogía: es una escala de "seguridad": 1 = lo hago todos los días,
  // 0.5 = lo toqué alguna vez.
  //
  // ↑ CUIDADO con las claves: cada una es un TEXTO que se busca dentro de la
  //   oferta (el matcher pasa todo a minúsculas y busca la palabra completa),
  //   por eso van en minúsculas y por eso las que tienen espacio o barra van
  //   entre comillas ('manual testing', 'ci/cd'): sin comillas no serían un
  //   nombre de variable válido.
  skills: {
    qa: 1,
    // ↑ Peso máximo: "QA" es la esencia del perfil, aparece en casi toda vacante.
    'manual testing': 1,
    'automation': 1,
    'web testing': 1,
    'mobile testing': 1,
    'api testing': 1,
    'functional testing': 1,
    'regression': 0.9,
    'smoke testing': 0.9,
    'gherkin': 0.8,
    'test cases': 1,
    'test automation': 1,
    'quality assurance': 1,
    'rest': 0.9,
    'graphql': 0.8,
    'postman': 1,
    'javascript': 0.9,
    'python': 0.8,
    'docker': 0.6,
    // ↑ Peso bajo a propósito: lo usa, pero no es su especialidad.
    'sql': 0.7,
    'mysql': 0.7,
    'agile': 0.9,
    'scrum': 0.9,
    'jira': 1,
    'xray': 0.9,
    'azure devops': 0.9,
    'git': 0.8,
    'github': 0.8,
    'ci/cd': 0.7,
    'uat': 0.8,
    'fintech': 0.8,
    'banking': 0.8,
    'mobile': 0.9,
    'ios': 0.8,
    'android': 0.9,
    'maestro': 0.8,
    'ai': 0.7,
    'ia': 0.7,
    // ↑ 'ai' y 'ia' son la MISMA skill en dos idiomas: como la comparación es
    //   textual, hacen falta las dos claves para que matcheen tanto una oferta
    //   en inglés como una en español. No es un error de duplicado.
    'llm': 0.5,
    'generative ai': 0.5,
    // ↑ Peso bajo: es el interés nuevo (IA generativa, 2026), no años de oficio.
  },

  // ── 3) KEYWORDS: EL VOCABULARIO PARA RECONOCER OFERTAS DE QA ──────────
  // Prioridades de búsqueda (términos para filtrar/clasificar ofertas)
  // ↑ keywords: términos con los que se filtra/clasifica cada oferta de QA
  // A diferencia de `skills`, acá NO hay pesos: es solo vocabulario. Sirve para
  // (a) saber qué es una oferta de QA y (b) armar la búsqueda en LinkedIn
  // (apifyLinkedin.js y el frontend con linkedinProfileKeywords).
  // Son sinónimos del mismo puesto: por eso conviven "qa engineer", "tester",
  // "sdet", etc. Cada uno cubre una forma distinta de escribirlo.
  keywords: [
    'qa',
    'quality assurance',
    'software tester',
    'test engineer',
    'qa engineer',
    'test automation',
    'automation engineer',
    'api testing',
    'manual testing',
    'mobile testing',
    'sdft',
    // ↑ OJO: "sdft" es un error de tipeo de "sdet" que quedó en la lista. Por eso
    //   el frontend lo descarta antes de armar la búsqueda de LinkedIn.
    'sdet',
    'test analyst',
  ],

  // ── 4) MARKET SKILLS: LO QUE PIDE EL MERCADO Y SUS BRECHAS ────────────
  // Habilidades del MERCADO (lo que las ofertas suelen pedir) para detectar
  // "gaps": tecnologías requeridas por la vacante que el CV no posee.
  // Cada entrada: { name, aliases[], has: bool (si está en el CV) }
  // ↑ marketSkills: lo que pide el mercado; has=false marca las brechas del CV
  //
  // Cómo se lee cada entrada:
  //  - name    = nombre "oficial" de la skill (el que se muestra en pantalla).
  //  - aliases = otras formas de escribirla. La búsqueda del matcher prueba
  //              TODOS los alias: así "k8s" también encuentra "kubernetes".
  //  - has     = ¿Ali tiene esta skill? false = BRECHA (no la tiene).
  // El flujo de una brecha: si una oferta pide "cypress" (aparece en sus
  // aliases) y has=false, matcher.js la agrega a `missed`, y analytics.js la
  // muestra como "lo que el mercado pide y te falta" para proponer formación.
  // OJO: el campo `weight` de las entradas con has:true no lo lee ningún módulo
  // hoy (el % de match sale de los pesos de `skills`, de arriba).
  marketSkills: [
    { name: 'cypress', aliases: ['cypress'], has: false },
    // ↑ Una brecha típica: automatización web muy pedida y ausente en el CV.
    { name: 'playwright', aliases: ['playwright'], has: false },
    { name: 'selenium', aliases: ['selenium'], has: false },
    { name: 'appium', aliases: ['appium'], has: false },
    { name: 'katalon', aliases: ['katalon'], has: false },
    { name: 'docker', aliases: ['docker'], has: true, weight: 0.6 },
    { name: 'kubernetes', aliases: ['kubernetes', 'k8s'], has: false },
    { name: 'ci/cd', aliases: ['ci/cd', 'cicd', 'jenkins', 'github actions', 'gitlab ci'], has: false },
    { name: 'python', aliases: ['python'], has: true, weight: 0.8 },
    { name: 'java', aliases: ['java'], has: false },
    { name: 'typescript', aliases: ['typescript', 'ts'], has: false },
    { name: 'javascript', aliases: ['javascript', 'js'], has: true, weight: 0.9 },
    { name: 'node.js', aliases: ['node'], has: false },
    { name: 'sql', aliases: ['sql', 'mysql', 'postgres', 'sql server'], has: true, weight: 0.7 },
    { name: 'postman', aliases: ['postman'], has: true, weight: 1 },
    { name: 'jira', aliases: ['jira'], has: true, weight: 1 },
    { name: 'azure devops', aliases: ['azure devops', 'azure'], has: true, weight: 0.9 },
    { name: 'aws', aliases: ['aws'], has: false },
    { name: 'graphql', aliases: ['graphql'], has: true, weight: 0.8 },
    { name: 'rest', aliases: ['rest'], has: true, weight: 0.9 },
    { name: 'load testing', aliases: ['load testing', 'jmeter', 'k6', 'gatling'], has: false },
    { name: 'performance testing', aliases: ['performance testing'], has: false },
    { name: 'mobile testing', aliases: ['mobile testing', 'android testing', 'ios testing'], has: true, weight: 0.9 },
    { name: 'api testing', aliases: ['api testing'], has: true, weight: 1 },
    { name: 'agile', aliases: ['agile'], has: true, weight: 0.9 },
    { name: 'scrum', aliases: ['scrum'], has: true, weight: 0.9 },
    { name: 'git', aliases: ['git'], has: true, weight: 0.8 },
    { name: 'fintech', aliases: ['fintech', 'banking', 'banca'], has: true, weight: 0.8 },
    { name: 'gherkin', aliases: ['gherkin', 'bdd', 'cucumber'], has: false },
    { name: 'ai', aliases: ['ai', 'artificial intelligence', 'generative ai', 'llm'], has: true, weight: 0.5 },
    { name: 'html', aliases: ['html'], has: false },
    { name: 'css', aliases: ['css'], has: false },
    { name: 'react', aliases: ['react'], has: false },
    { name: 'maestro', aliases: ['maestro'], has: true, weight: 0.8 },
    { name: 'testrail', aliases: ['testrail'], has: false },
    { name: 'zephyr', aliases: ['zephyr'], has: false },
    { name: 'soapui', aliases: ['soapui', 'ready api', 'readyapi'], has: false },
    { name: 'browserstack', aliases: ['browserstack'], has: false },
    { name: 'sauce labs', aliases: ['sauce labs', 'saucelabs'], has: false },
    { name: 'testng', aliases: ['testng'], has: false },
    { name: 'junit', aliases: ['junit'], has: false },
    { name: 'webdriverio', aliases: ['webdriverio', 'webdriver.io'], has: false },
    { name: 'robot framework', aliases: ['robot framework'], has: false },
    { name: 'testcafe', aliases: ['testcafe'], has: false },
  ],

  // ── 5) REGIONES: A QUÉ PAÍS PERTENECE CADA OFERTA ─────────────────────
  // Regiones soportadas
  // ↑ regions: cada región con label, idioma (es/en) y países relacionados
  // La clave del objeto (argentina, europa, eeuu...) es la que viaja en la URL
  // (?region=argentina) y la que usa el frontend para las pestañas.
  //  - label     = nombre que se muestra al usuario.
  //  - lang      = idioma de la región; coverLetter.js lo usa para escribir la
  //                carta en español o en inglés.
  //  - countries = textos que se buscan en la ubicación de la oferta para
  //                decidir a qué región pertenece. Van varios por región porque
  //                cada scrapeador escribe el país de una forma distinta.
  //  - keywords  = sinónimos de búsqueda propios de esa región (solo Argentina
  //                los define hoy).
  regions: {
    argentina: {
      label: 'Argentina',
      lang: 'es',
      countries: ['Argentina', 'AR', 'Buenos Aires'],
      keywords: ['argentina', 'buenos aires', 'capaz federal'],
      // ↑ "CABA" y "Capital Federal" son apodos que usan las ofertas reales.
    },
    europa: {
      label: 'Europa',
      lang: 'en',
      // ↑ Región "virtual": agrupa varios países europeos en una sola pestaña.
      countries: ['Spain', 'España', 'Germany', 'Alemania', 'France', 'Netherlands', 'Netherlands', 'United Kingdom', 'Ireland', 'Portugal'],
    },
    eeuu: {
      label: 'Estados Unidos',
      lang: 'en',
      countries: ['United States', 'USA', 'EEUU', 'EE.UU', 'Remote - US'],
      // ↑ Fijate en "EEUU"/"EE.UU": cada aviso escribe el país como puede.
    },
    mexico: {
      label: 'México',
      lang: 'es',
      countries: ['Mexico', 'México', 'CDMX', 'Ciudad de México', 'Querétaro', 'Guadalajara'],
    },
    peru: {
      label: 'Perú',
      lang: 'es',
      countries: ['Peru', 'Perú', 'Lima'],
    },
    colombia: {
      label: 'Colombia',
      lang: 'es',
      countries: ['Colombia', 'Bogotá', 'Barranquilla', 'Medellín'],
    },
    chile: {
      label: 'Chile',
      lang: 'es',
      countries: ['Chile', 'Santiago', 'Las Condes'],
    },
  },
};

// Lee el PDF del CV opcionalmente desde el repo (no se parsea el PDF a fondo,
// solo se usa como referencia; el perfil estructurado es la fuente principal).
// ↑ loadCvPath(): busca el archivo del CV y devuelve SU RUTA (o null si no está).
//   La palabra "async" significa que la función devuelve una promesa: hay que
//   esperarla con await para obtener la ruta.
export async function loadCvPath() {
  // ↑ Dos formas de escribir la MISMA ruta: Windows acepta tanto la barra
  //   invertida \ como la /
  const candidates = [
    'F:\\Curriculum-Vitae\\Ali_Tovar_CV.pdf',
    'F:/Curriculum-Vitae/Ali_Tovar_CV.pdf',
  ];
  // ↑ for...of: recorre las candidatas una por una y corta en la primera que exista.
  for (const c of candidates) {
    try {
      // ↑ Leemos el archivo para confirmar que está: si readFile no lanza error,
      //   la ruta es válida y la devolvemos.
      await readFile(c);
      return c;
    } catch {
      // intenta el siguiente
      // ↑ Si falla (no existe o no hay permisos), seguimos con la siguiente.
      //   El `catch` sin variable es atajo de sintaxis: no nos interesa saber
      //   QUÉ error fue, solo que hay que probar otro camino.
    }
  }
  // ↑ Si ninguna ruta existe, devolvemos null. Quien llama decide qué hacer con
  //   ese null (por ejemplo, seguir con los datos de PROFILE, que ya están acá).
  return null;
}

// ↑ Export con nombre: deja PROFILE disponible para `import { PROFILE } from
//   './cvProfile.js'` en cualquier otro archivo del backend. Lo exporta en
//   "named" y no "default" justamente para que quede claro de dónde sale.
export { PROFILE };
