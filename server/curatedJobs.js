// ============================================================================
// OFERTAS CURADAS A MANO por Ali: relevadas directamente de las bolsas propias
// de cada consultora (mail, portal propio, LinkedIn). Complementan a las
// fuentes en vivo y el motor de matching les calcula el % como al resto.
// Dato estructurado y ordenado por región.
// ============================================================================
// Ofertas relevadas a mano (bolsas propias de cada consultora: mail, portal
// propio, LinkedIn). No salen de las fuentes remotas escaneadas; se agregan
// manualmente a su país (región). Cada entrada incluye el texto de la vacante
// con sus skills para que el motor de matching calcule el % correctamente.
// ↑ Catálogo curado a mano: ofertas que el usuario relevó personalmente de las
// ↑ bolsas propias de cada consultora (mail, portal propio, LinkedIn). Se suman a
// ↑ las que llegan de las fuentes en vivo y el motor de matching les calcula el %
// ↑ de coincidencias igual que a las demás.
// ↑ Es dato estático: un array plano de objetos, uno por oferta, sin lógica.
// ↑ Para qué existe: hay muchas vacantes que solo se ven por mail o LinkedIn,
// ↑ que ningún portal público publica. Sin este archivo, esas ofertas no existirían.
export const CURATED_JOBS = [
  // ============ ARGENTINA ============
  // ↑ El catálogo está ordenado en BLOQUES por región (Argentina, México, Perú,
  // ↑ Colombia, Chile, Europa y Remoto Global). El bloque es solo una separación
  // ↑ visual para el que lee el archivo: el orden del array no define nada, cada
  // ↑ oferta lleva su propia región en el campo `regionGuess`.
  {
    // ↓ CONTRATO DE CADA OFERTA: abajo se lee la PRIMERA ficha completa
    // ↓ para ver qué llaves tiene. Ese es el MISMO formato que devuelve /api/jobs.
    id: 'curated-crowdar-qa',
    // ↑ `id`: clave única de la oferta. El prefijo "curated-" la distingue de las
    // ↑ ids de las fuentes en vivo (que usan "remotive-", "arbeitnow-", etc.) para
    // ↑ que nunca choquen entre sí. También sirve para abrir el detalle por URL.
    source: 'Directo (Crowdar)',
    // ↑ `source`: de dónde salió la oferta a mano. Acá siempre dice "Directo (...)"
    // ↑ o algo tipo "QA Watcher (via LinkedIn)", porque ninguna viene de un portal
    // ↑ automático. El frontend lo muestra como etiqueta para distinguirlas.
    title: 'QA / QA Automation Engineer',
    // ↑ `title`: el puesto tal cual lo publicaron. Se ve en la tarjeta de la oferta
    // ↑ y es parte del texto que el matcher analiza para calcular el porcentaje.
    company: 'Crowdar',
    // ↑ `company`: la empresa contratante. Junto con el título arma la clave que
    // ↑ usa history.js para saber si una oferta ya la viste antes.
    location: 'Buenos Aires, Argentina',
    // ↑ `location`: la ubicación tal como está escrita en la publicación. Puede
    // ↑ traer el detalle de híbrido, remoto, zona, etc. Es texto libre.
    regionGuess: 'argentina',
    // ↑ `regionGuess`: la región ya adivinada a mano, con el nombre que usa el
    // ↑ sistema (argentina, mexico, peru, colombia, chile, europa, eeuu). Es la
    // ↑ pista que matcher.js toma como prioridad para elegir la pestaña.
    applyUrl: 'https://crowdar.peopleforce.io/careers',
    // ↑ `applyUrl`: el link o el mail de postulación. Puede ir vacío ('') cuando la
    // ↑ empresa no lo publica o hay que escribirle a un recruiting: en ese caso el
    // ↑ dato útil queda escrito dentro de la `description`.
    description:
      'Crowdar (organizadora de Testear.la) suma perfiles de QA y Testing: QA Automation, Tester Manual, Chapter Lead, y roles en automatización, desarrollo, data, cloud y SAP. Valoramos experiencia en testing funcional y automatizado (web y mobile), APIs, y conocimiento de metodologías ágiles. Suma el uso de IA aplicada a testing y automatización inteligente.',
    // ↑ `description`: el texto de la vacante, lo más largo de la ficha. Se copia
    // ↑ casi textual de la publicación original, con sus requisitos y skills, y es
    // ↑ justamente el texto que el matcher recorre para calcular el porcentaje.
    // ↑ Por eso está en mayúsculas parciales y no resumido: si lo acortás, las
    // ↑ palabras clave se pierden y el match de esa oferta baja.
    tags: ['qa', 'qa automation', 'testing', 'automation', 'manual testing', 'api testing'],
    // ↑ `tags`: los skills pedidos por la vacante, como lista de textos. Es la
    // ↑ parte más importante para el % de match: se comparan contra las skills
    // ↑ del CV, y de ahí salen los campos `matched` y `missed` que ve el usuario.
    salary: '',
    // ↑ `salary`: el sueldo, si la publicación lo dice. Casi siempre va vacío ('')
    // ↑ porque las bolsas de empleo no lo publican: es un campo opcional.
    date: '2026-09-01',
    // ↑ `date`: el día en que se cargó esta oferta al catálogo, en formato
    // ↑ AAAA-MM-DD. history.js la usa para ir expirando las más viejas.
    // ↑ OJO con `modality`: no está en esta ficha, pero es un campo OPCIONAL que
    // ↑ aparece en muchas otras y el frontend lo pinta como etiqueta (chip 🕒).
  },
  {
    id: 'curated-qactions-sap',
    source: 'Directo (QActions)',
    title: 'QA Manager / Test Manager SAP',
    company: 'QActions',
    location: 'Buenos Aires, Argentina',
    regionGuess: 'argentina',
    applyUrl: 'https://qactions.com',
    description:
      'En QActions buscamos un perfil con experiencia comprobable en testing de implementaciones o upgrades SAP, para liderar estrategias, equipos y planes de prueba hasta el go-live. Valoramos experiencia como QA Lead, Test Lead SAP, Testing Manager o Líder de Testing y contacto con clientes. Excluyente Buenos Aires, modalidad híbrida. Postulación por mail a busquedas@qactions.com.',
    tags: ['qa', 'testing', 'sap', 'test lead', 'test manager', 'agile'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-cocos-qa',
    source: 'Directo (Cocos Capital)',
    title: 'QA Engineer (Senior)',
    company: 'Cocos Capital',
    location: 'Florida, Vicente López, Buenos Aires (Híbrido)',
    regionGuess: 'argentina',
    applyUrl: 'https://cocoscapital.recruitee.com/o/senior-qa-engineer',
    modality: 'Full time · Híbrido (oficinas en Florida, Vicente López)',
    description:
      'Cocos Capital (fintech argentina de inversión y cripto, ~2M de usuarios) busca QA Engineer para su equipo de IT. El objetivo es garantizar la calidad del código con pruebas manuales y automatizadas: diseñar la arquitectura de los frameworks de automatización, mantener suites de tests (frontend, mobile y REST API), integrar los tests en pipelines CI/CD (GitHub Actions), ejecutar testing exploratorio/funcional/regresión en flujos financieros críticos y usar IA para generar test cases, analizar resultados y detectar flaky tests. Requisitos: +5 años en testing manual y automation, dominio de Playwright o similares, SQL, experiencia web/mobile/REST API, Git y productos digitales (ideal fintech, banca, pagos o cripto). Suma: background de desarrollo, IA aplicada (GitHub Copilot, agentic QA, LLMs) y testing de seguridad.',
    tags: ['qa', 'qa automation', 'automation', 'playwright', 'manual testing', 'mobile testing', 'api testing', 'rest', 'sql', 'ci/cd', 'github actions', 'fintech', 'banking', 'regression', 'ai', 'llm'],
    salary: '',
    date: '2026-09-10',
  },
  {
    id: 'curated-ar-stefanini-qa-auto',
    source: 'Directo (Stefanini Latam)',
    title: 'QA Automation Ssr',
    company: 'Stefanini Latam',
    location: 'Buenos Aires, Argentina (Híbrido)',
    regionGuess: 'argentina',
    applyUrl: '',
    modality: 'Full time · Híbrido (lunes a viernes)',
    description:
      'Stefanini Latam busca QA Automation Ssr para un cliente del rubro bancario. Diseñar, desarrollar y ejecutar scripts de prueba automatizados con herramientas estándar; colaborar con equipos multifuncionales; identificar, documentar y dar seguimiento a defectos; pruebas de regresión exhaustivas; analizar resultados y generar informes. Requisitos: experiencia comprobada como QA Automation Tester, dominio de Java, Python o C#, herramientas de automatización como Selenium, Appium o similares, metodologías ágiles, buenas habilidades analíticas y de comunicación. Enviar CV a flmarrero@stefanini.com.',
    tags: ['qa automation', 'automation', 'selenium', 'appium', 'java', 'python', 'c#', 'test automation', 'regression', 'agile', 'banking', 'banca'],
    salary: '',
    date: '2026-09-10',
  },
  {
    id: 'curated-ar-universia-qa-agents',
    source: 'Directo (Universia Argentina)',
    title: 'Tester/QA Automation – foco en agentes inteligentes',
    company: 'Universia Argentina',
    location: 'Buenos Aires, Argentina (Presencial)',
    regionGuess: 'argentina',
    applyUrl: '',
    modality: 'Presencial · Jornada completa',
    description:
      'Universia Argentina busca un perfil con foco fuerte en automatización que vaya un paso más allá: diseñar y operar agentes autónomos que validen, detecten y reporten problemas antes de producción. Responsabilidades: diseñar, construir y mantener frameworks de automatización (no solo ejecutar suites armadas); crear y mantener agentes de testing autónomos integrados al flujo de desarrollo; automatizar pruebas funcionales, de regresión y de performance (Selenium, Playwright, Postman); definir estrategias de prueba con producto/desarrollo; validar integridad de datos con SQL end-to-end. Requisitos: experiencia comprobable construyendo automatización, manejo sólido de Selenium, Playwright, JUnit o similares, APIs REST y SQL, Python o JavaScript para scripting.',
    tags: ['qa automation', 'automation', 'agents', 'agentes', 'ai', 'ia', 'selenium', 'playwright', 'postman', 'sql', 'python', 'javascript', 'api testing', 'rest', 'regression', 'performance testing'],
    salary: '',
    date: '2026-09-10',
  },
  {
    id: 'curated-ar-rocketstars-qa-auto',
    source: 'Directo (Rocket Stars)',
    title: 'QA Automation Engineer SSR – Playwright / Pytest / CI/CD',
    company: 'Rocket Stars',
    location: 'Buenos Aires / Córdoba / Remoto',
    regionGuess: 'argentina',
    applyUrl: '',
    modality: 'Híbrido (BA: 2 días a la semana · Córdoba: 1 vez cada 15 días) o 100% remoto (resto del país)',
    description:
      'Rocket Stars busca QA Automation Engineer SSR para una plataforma central de Inteligencia Artificial y Datos (perfil con experiencia exclusiva en automatización, no QA Manual). Responsabilidades: diseñar la estrategia de Testing Automation, automatizar pruebas E2E, Integration y API, mantener suites para Frontend/Backend/Data, integrar tests al pipeline CI/CD (Azure DevOps Pipelines o GitHub Actions), ejecutar y analizar resultados, reportar defectos en Jira, automatizar criterios de aceptación y participar en ceremonias ágiles. Requisitos: 3-5 años en QA Automation, experiencia sólida en Playwright (preferentemente) o Cypress, Pytest o unittest, API Testing con Postman/Newman/requests, APIs REST y testing de productos de datos. Plus: testing de sistemas de IA (evaluación de outputs de agentes, sistemas no determinísticos).',
    tags: ['qa automation', 'automation', 'playwright', 'cypress', 'pytest', 'api testing', 'rest', 'postman', 'newman', 'ci/cd', 'azure devops', 'github actions', 'jira', 'data testing', 'ai', 'agile'],
    salary: '',
    date: '2026-09-10',
  },
  {
    id: 'curated-ar-redbee-qa-auto-sr',
    source: 'Directo (redbee Studios)',
    title: 'QA Automation SR',
    company: 'redbee Studios',
    location: 'Buenos Aires (Remoto / remote-first)',
    regionGuess: 'argentina',
    applyUrl: '',
    modality: 'Remote-first (1 jornada al mes en AMBA si vivís cerca) · Full time',
    description:
      'redbee (empresa argentina de tecnología, +14 años, industria financiera) busca QA Automation SR. Desafíos: diseñar, documentar y ejecutar casos y escenarios de prueba; definir y llevar adelante estrategias de testing; participar del ciclo completo del producto desde etapas tempranas; automatizar pruebas con Selenium IDE, Cypress, Playwright y K6; validar APIs REST y SOAP y aplicaciones mobile. Requisitos: +6 años en QA Automation con foco en análisis funcional y redacción de casos, visión integral de calidad, experiencia en testing mobile. Beneficios: 15 días hábiles de vacaciones, remote-first, coworks, prepaga, clases de inglés y plan de desarrollo.',
    tags: ['qa', 'qa automation', 'automation', 'selenium', 'cypress', 'playwright', 'k6', 'api testing', 'rest', 'soap', 'mobile testing', 'regression', 'test strategy', 'fintech', 'banca'],
    salary: '',
    date: '2026-09-10',
  },
  {
    id: 'curated-ar-tcs-analista-qa',
    source: 'Directo (TCS Argentina)',
    title: 'Analista QA / Tester',
    company: 'Tata Consultancy Services',
    location: 'Buenos Aires (Híbrido)',
    regionGuess: 'argentina',
    applyUrl: '',
    modality: 'Híbrido · Jornada completa',
    description:
      'TCS Argentina busca Analista QA / Tester: evaluar programas de software y procedimientos de desarrollo para verificar que cumplan los requerimientos de usuario; ejecutar pruebas para monitorear la performance del entorno operativo; crear y ejecutar estrategias, planes y scripts de prueba; reportar avance, seguimiento de defectos y evaluación de riesgos; identificar oportunidades para optimizar estrategias y suites de prueba incluyendo automatización; trabajo con equipos cross-functional para consolidar pruebas de sistema, interfaces y end-to-end.',
    tags: ['qa', 'tester', 'analista qa', 'manual testing', 'functional testing', 'automation', 'test strategy', 'regression', 'performance testing', 'agile'],
    salary: '',
    date: '2026-09-10',
  },
  {
    id: 'curated-ar-tsoft-qa-sr',
    source: 'Directo (TSoft Argentina)',
    title: 'QA Analyst Senior',
    company: 'TSoft Argentina',
    location: 'Buenos Aires, Argentina',
    regionGuess: 'argentina',
    applyUrl: 'https://lnkd.in/dMWvFXPu',
    description:
      'TSoft Argentina (junto a Mariana Noel) busca QA Analyst Sr. con perfil funcional y técnico para participar del análisis de requerimientos, diseño de estrategias de prueba y validación de soluciones sobre arquitecturas distribuidas. Desafíos: analizar requerimientos de negocio e identificar riesgos; definir estrategias de testing; diseñar, ejecutar y mantener pruebas funcionales, de integración, APIs, E2E, datos y regresión; gestionar defectos con trazabilidad entre requerimientos, casos y resultados; comunicar avances y hallazgos a stakeholders; troubleshooting con análisis de APIs, logs, trazas, eventos y bases de datos. Requisitos excluyentes: formación en Sistemas/Ingeniería, +3 años en QA/Testing, Jira y Xray, AWS (S3, Lambda y relacionados), testing de APIs REST/Web Services e integraciones E2E, bases SQL y NoSQL (ideal MongoDB), y análisis de logs/trazas/errores en arquitecturas distribuidas. Se valora: certificación ISTQB, performance testing, mobile testing, cloud AWS y plataformas transaccionales de alto volumen.',
    tags: ['qa', 'qa analyst', 'manual testing', 'functional testing', 'integration testing', 'api testing', 'e2e', 'data testing', 'regression', 'defects', 'trazabilidad', 'jira', 'xray', 'aws', 's3', 'lambda', 'rest', 'web services', 'sql', 'nosql', 'mongodb', 'logs', 'arquitecturas distribuidas', 'istqb', 'performance testing', 'mobile testing'],
    salary: '',
    date: '2026-09-10',
  },
  {
    id: 'curated-ar-axonier-analista-funcional',
    source: 'Directo (Axonier)',
    title: 'Analista Funcional (inglés avanzado)',
    company: 'Axonier',
    location: '',
    regionGuess: 'argentina',
    applyUrl: '',
    description:
      'Axonier busca Analista Funcional con +3 años de experiencia y nivel de inglés avanzado. Postulación por mail a busquedas@axonier.com con asunto "Analista Funcional", adjuntando CV y remuneración pretendida.',
    tags: ['analista funcional', 'analista', 'functional analysis', 'relevamiento', 'inglés', 'english', 'agile'],
    salary: '',
    date: '2026-09-10',
  },
  {
    id: 'curated-ar-tsoft-qa-especialista-sr',
    source: 'Directo (TSoft Argentina)',
    title: 'Especialista QA Senior',
    company: 'TSoft Argentina',
    location: 'Buenos Aires y alrededores (CABA)',
    regionGuess: 'argentina',
    applyUrl: '',
    modality: 'Presencial 4 veces por semana en CABA · Jornada completa',
    description:
      'TSoft Argentina busca Especialista QA Senior para proyectos de alto impacto, incorporando profesionales de QA con experiencia en testing funcional, automatización y mejora continua en todas las etapas del ciclo de desarrollo. Requisitos: formación universitaria/terciaria completa o avanzada en Ingeniería de Software, Sistemas o TI; +3 años comprobables en testing y aseguramiento de calidad; definición, implementación y evolución de procesos de QA; metodologías BDD/TDD; automatización con Cypress, Katalon, UFT, Tosca o similares; pruebas de APIs con Postman y/o SoapUI; GitLab, GitLab CI y Jenkins; trabajo colaborativo con desarrollo y DevOps; certificación ISTQB (excluyente). Plus: +5 años en QA, experiencia liderando procesos de calidad y estrategias de testing manual y automatizado.',
    tags: ['qa', 'qa senior', 'specialist qa', 'functional testing', 'automation', 'bdd', 'tdd', 'cypress', 'katalon', 'uft', 'tosca', 'api testing', 'postman', 'soapui', 'gitlab', 'gitlab ci', 'jenkins', 'ci/cd', 'istqb', 'quality assurance', 'test strategy', 'continuous improvement'],
    salary: '',
    date: '2026-09-10',
  },
  {
    id: 'curated-ar-glenmark-qa-documentacion',
    source: 'Directo (Glenmark Pharmaceuticals)',
    title: 'Analista Sr. QA Documentación',
    company: 'Glenmark Pharmaceuticals',
    location: 'Parque Industrial Pilar, Buenos Aires, Argentina (Presencial)',
    regionGuess: 'argentina',
    applyUrl: '',
    modality: 'Presencial en Pilar · Jornada completa (lun-vie 12:30-21:00)',
    description:
      'Glenmark Pharmaceuticals (farmacéutica global) busca Analista Sr. QA Documentación para el equipo de Garantía de Calidad. Responsabilidades: revisión y aprobación de documentación GMP (Master BPR, BPR, SOPs, Planes de Inspección y Copias Controladas); preparación de documentación para elaboración y acondicionamiento de productos; gestión y seguimiento de validaciones de procesos, limpieza y equipos; elaboración de protocolos y reportes de validación; seguimiento y análisis de tendencias; soporte en IPQA y controles en línea; investigación de desvíos y eventos del QMS. Requisitos: estudiante avanzado o graduado de Farmacia, Química, Bioquímica, Biotecnología o Ingeniería; experiencia en industria farmacéutica en Garantía de Calidad y/o Validaciones; análisis de causa raíz (5W2H, 5M, 5 Why); SAP y/o TrackWise deseable; inglés intermedio deseable. NOTA: QA farmacéutico (no testing de software): el match con el perfil de Ali será muy bajo.',
    tags: ['qa', 'garantía de calidad', 'gmp', 'validaciones', 'farmacéutica', 'documentación', 'qms', 'sop', 'desvíos'],
    salary: '',
    date: '2026-09-10',
  },
  {
    id: 'curated-ar-randstad-analista-calidad',
    source: 'Directo (Randstad Argentina)',
    title: 'Analista de Calidad',
    company: 'Randstad Argentina',
    location: 'GBA Norte, Buenos Aires, Argentina (Presencial)',
    regionGuess: 'argentina',
    applyUrl: '',
    modality: '100% presencial en planta (GBA Norte) · Jornada completa',
    description:
      'Randstad Argentina busca Analista de Calidad para una multinacional de la industria alimenticia en su planta productiva de GBA Norte (100% presencial). Objetivo: coordinar y dar seguimiento a desvíos de calidad, impulsar la mejora continua de procesos productivos y asegurar estándares de calidad e inocuidad. Responsabilidades: gestión de no conformidades de planta y proveedores, gestión de reclamos con verificación de eficacia y respuesta al cliente, cálculo de KPIs del sector, cumplimiento de normas de inocuidad/seguridad/medio ambiente. Requisitos: estudiante avanzado o graduado en Ingeniería en Alimentos, Química, Industrial, Lic. en Alimentos o Biotecnología (excluyente); 1-2 años en Calidad/Aseguramiento de Calidad/Procesos; Excel intermedio (excluyente); inglés intermedio/avanzado (excluyente). NOTA: calidad industrial alimenticia (no testing de software): match con perfil de Ali muy bajo.',
    tags: ['qa', 'quality assurance', 'calidad', 'aseguramiento de calidad', 'inocuidad', 'alimentos', 'mejora continua', 'kpi', 'no conformidades'],
    salary: '',
    date: '2026-09-10',
  },
  {
    id: 'curated-ar-banco-macro-plan-sueldo',
    source: 'Directo (Banco Macro)',
    title: 'Analista Técnico Funcional – Plan Sueldo',
    company: 'Banco Macro',
    location: 'Torre Macro, Retiro, Buenos Aires (Híbrido)',
    regionGuess: 'argentina',
    applyUrl: '',
    modality: 'Híbrido (Torre Macro, Retiro) · Jornada completa',
    description:
      'Banco Macro busca Analista Técnico Funcional - Plan Sueldo. Desafío: analizar requerimientos de clientes internos, documentar análisis funcional y técnico, realizar consultas y SP sobre SQL Server, Oracle y Sybase, interactuar con áreas técnicas y proveedores, dar seguimiento de entregas del proveedor y pruebas en entornos de test, guiar pruebas de integración, analizar/resolver errores y participar de reuniones de avance. Se valora experiencia en aplicativos de sueldos/nóminas. Requisitos: experiencia en sistema financiero, análisis funcional/técnico y documentación, sentencias SQL (SQL Server/Oracle/Sybase), manejo de servicios y arquitectura, análisis y resolución de incidentes, definir y ejecutar pruebas de software, comunicación, trabajo en equipo, marco ágil (Kanban/Scrum), herramientas de ejecución de servicios (Postman/SoapUI), Jira y conocimientos de COBIS (deseable).',
    tags: ['qa', 'analista funcional', 'functional testing', 'software testing', 'pruebas de software', 'sql', 'sql server', 'oracle', 'sybase', 'postman', 'soapui', 'jira', 'scrum', 'kanban', 'agile', 'banking', 'banca', 'incidentes', 'servicios'],
    salary: '',
    date: '2026-09-10',
  },
  {
    id: 'curated-ar-fx-analista-funcional',
    source: 'Directo (FX Informática)',
    title: 'Analista Funcional',
    company: 'FX Informática',
    location: 'Argentina (Remoto)',
    regionGuess: 'argentina',
    applyUrl: 'https://www.fxinformatica.com',
    description:
      'FX Informática busca Analistas Funcionales para proyectos internos y externos: relevamiento de requerimientos, testing, soporte y capacitación a usuarios, documentación y demostraciones de productos. Orientado a estudiantes o graduados de Administración, Comercio Internacional, Sistemas o afines. Valoramos capacidad de análisis, trabajo en equipo, comunicación, gestión de proyectos, manejo de Jira y SQL, inglés y/o portugués. Remoto lunes a viernes 9-18hs. Enviar CV a rrhh@fxinformatica.com.',
    tags: ['qa', 'analista funcional', 'analista', 'testing', 'jira', 'sql', 'functional testing'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-ar-fx-desarrollador',
    source: 'Directo (FX Informática)',
    title: 'Desarrollador (células de desarrollo)',
    company: 'FX Informática',
    location: 'Argentina (Remoto)',
    regionGuess: 'argentina',
    applyUrl: 'https://www.fxinformatica.com',
    description:
      'FX Informática busca desarrolladores para células de desarrollo: diseño, desarrollo, configuración y entrega de soluciones de software. Conocimientos en .NET Core / C#, SQL Server, HTML5, CSS y JavaScript. Se valoran Git/TFS, DevOps, Azure, Oracle y metodologías ágiles. Remoto lunes a viernes 9-18hs. Enviar CV a rrhh@fxinformatica.com.',
    tags: ['quality', 'test', 'javascript', 'sql', 'agile', 'azure devops', 'ci/cd'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-ar-aliantum-tester-focal',
    source: 'Directo (Aliantum)',
    title: 'Tester Focal Point (QA / Testing Lead Operativo)',
    company: 'Aliantum',
    location: 'CABA, Argentina',
    regionGuess: 'argentina',
    applyUrl: 'https://www.aliantum.com.ar/jobs/tester-focal-point-8',
    description:
      'Aliantum (consultora IA First especializada en el sector financiero LATAM) busca Focal Point de Testing: referente central de testing como nexo entre el cliente, el equipo de desarrollo y stakeholders. Ordena, prioriza, da visibilidad y toma decisiones operativas de QA. Responsabilidades: definir la estrategia de testing (funcional, regresión, smoke, UAT), analizar requerimientos, diseñar y supervisar casos de prueba, coordinar backlog de bugs, validar go / no go a producción, trazabilidad requerimiento → caso de prueba → defecto y acompañar UAT. Requisitos: experiencia como Tester/QA, manejo de Jira, Azure DevOps, TestRail o similares, conocimiento de Core Banking BANTOTAL, y disponibilidad para viajar y estar presencial en el cliente (excluyente). Deseable: entornos bancarios/fintech, SQL, APIs, metodologías ágiles (Scrum/Kanban) y experiencia como referente o lead informal de testing.',
    tags: ['qa', 'tester', 'test lead', 'testing', 'functional testing', 'regression', 'uat', 'bantotal', 'core banking', 'jira', 'azure devops', 'testrail', 'agile', 'scrum', 'kanban'],
    salary: '',
    date: '2026-09-08',
  },
  {
    id: 'curated-ar-decampoacampo-qa-auto',
    source: 'Directo (deCampoaCampo)',
    title: 'QA Automation Ssr/Senior (Cypress)',
    company: 'deCampoaCampo',
    location: 'CABA/GBA (1 día presencial) o 100% remoto (interior)',
    regionGuess: 'argentina',
    applyUrl: 'https://lnkd.in/djFuZr5d',
    description:
      'deCampoaCampo (mercado ganadero digital más grande de Argentina, agtech) busca QA Automation Ssr/Senior con experiencia en Cypress y JavaScript. Esquema: CABA/GBA con 1 día presencial en la oficina de CABA, o 100% remoto para candidatos del interior del país. Postulación a través del link del anuncio o por mail a rrhh@decampoacampo.com. Otras búsquedas en su portal de empleos.',
    tags: ['qa automation', 'automation', 'cypress', 'javascript', 'testing', 'regression', 'agile'],
    salary: '',
    date: '2026-09-08',
  },
  {
    id: 'curated-ar-gestal-tester-sr',
    source: 'Directo (Consultora Gestal)',
    title: 'Tester Senior / QA Automation',
    company: 'Consultora Gestal (bolsa de empleo)',
    location: 'Argentina (100% Remoto)',
    regionGuess: 'argentina',
    applyUrl: 'https://www.consultoragestal.com/bolsa-de-trabajo/',
    description:
      'Búsqueda activa de Consultora Gestal: Tester Senior / QA Automation 100% remoto, full time lunes a viernes, modalidad monotributo en Argentina. Requisitos: automatización de pruebas de Frontend y APIs, conocimientos de SQL y de programación, y uso de herramientas de IA aplicadas al testing. No piden experiencia en una herramienta de testing específica: priorizan base técnica y capacidad de adaptación. Ofrecen 100% remoto, prepaga, vacaciones pagas y crecimiento. Postulación por mail a jtrecco@consultoragestal.com.',
    tags: ['qa', 'qa automation', 'automation', 'api testing', 'frontend testing', 'sql', 'testing', 'ai', 'ia'],
    salary: '',
    date: '2026-09-08',
  },
  {
    id: 'curated-ar-contraluz-qa-ai-agents',
    source: 'Directo (Consultora Contraluz)',
    title: 'QA Automation Engineer – AI & Agentic Systems',
    company: 'Consultora Contraluz',
    location: 'Argentina (100% Remoto)',
    regionGuess: 'argentina',
    applyUrl: 'https://www.consultoracontraluz.com.ar',
    description:
      'Búsqueda de Consultora Contraluz para un cliente: QA Automation Engineer especializado en AI & Agentic Systems, 100% remoto desde Argentina, modalidad contractor con remuneración en dólares (3k USD). Inglés conversacional fluido excluyente. Requisitos: 2+ años como QA Automation/Test Automation, experiencia comprobable en testing de Agentes de IA y/o sistemas basados en LLM, programación en Python y/o TypeScript, automatización de navegador (Playwright, Selenium, Puppeteer), API testing, suites automatizadas, debugging, CI/CD (GitHub Actions, Jenkins, GitLab CI), análisis de logs/trazas/llamadas de red y métricas de calidad (Grafana, Kibana, Power BI). Trabajo con resultados variables o no determinísticos. Enviar CV a rrhh@consultoracontraluz.com.ar con asunto "QA Automation Engineer AI & Agentic Systems".',
    tags: ['qa automation', 'automation', 'ai', 'ia', 'llm', 'agents', 'agentic', 'python', 'typescript', 'playwright', 'selenium', 'puppeteer', 'api testing', 'ci/cd', 'github actions', 'jenkins', 'gitlab ci', 'grafana', 'kibana'],
    salary: '3k USD',
    date: '2026-09-08',
  },
  {
    id: 'curated-ar-nttdata-qa-automatizador',
    source: 'Reclutador (LinkedIn)',
    title: 'QA Automatizador (NTT DATA)',
    company: 'NTT DATA',
    location: 'Argentina',
    regionGuess: 'argentina',
    applyUrl: '',
    description:
      'NTT DATA busca perfiles de QA Automatizador para un nuevo proyecto. Requisitos: egresado/a de carrera técnica o universitaria en Sistemas/Informática o afines; experiencia en automatización de pruebas; experiencia con Karate para automatización de APIs; Java y/o Python; Selenium, Cucumber, Appium y/o Gherkin; Git, Postman, REST Assured, Jira y Confluence; metodologías ágiles. ISTQB Foundation es un plus. Importante: buscan personas que no hayan trabajado anteriormente en NTT DATA. Postulación por DM con el reclutador (publicación #Hiring #QAAutomation #Testing).',
    tags: ['qa automation', 'automation', 'karate', 'api testing', 'java', 'python', 'selenium', 'cucumber', 'appium', 'gherkin', 'test automation', 'istqb', 'jira', 'agile'],
    salary: '',
    date: '2026-09-08',
  },
  {
    id: 'curated-ar-qa-sr-js-webdriverio',
    source: 'Reclutador (LinkedIn)',
    title: 'Sr. QA Automation Engineer (JavaScript)',
    company: 'Confidencial (AR/CO/MX/BR)',
    location: 'Argentina (100% Remoto)',
    regionGuess: 'argentina',
    applyUrl: '',
    description:
      'Sr. QA Automation Engineer (JavaScript) para un proyecto global en crecimiento, 100% remoto (AR/CO/MX/BR). Requisitos: +5 años en Quality Testing, +3 años en QA Automation, pipelines CI/CD (CircleCI preferido), automatización frontend con JavaScript + WebdriverIO, automatización backend, diseño orientado a objetos y bases de datos relacionales y no relacionales. Qué vas a hacer: liderar la calidad end-to-end, diseñar y mantener suites de automatización frontend/backend, coordinar releases completos (go/no-go, sanity checks post-deploy), visibilidad de cobertura/riesgos, proponer mejoras y roadmap de calidad. Postulación por MD (publicación #QA #Automation #SDET #JavaScript #WebdriverIO).',
    tags: ['qa automation', 'automation', 'sdet', 'javascript', 'webdriverio', 'ci/cd', 'circleci', 'frontend testing', 'api testing', 'backend testing', 'release management'],
    salary: '',
    date: '2026-09-08',
  },
  {
    id: 'curated-ar-link-automation-tester',
    source: 'Directo (link)',
    title: 'Automation Tester Sr (POS - Backend)',
    company: 'link',
    location: 'Buenos Aires (Híbrido, zona Luna Park)',
    regionGuess: 'argentina',
    applyUrl: 'https://lnkd.in/dpVqvFhm',
    description:
      'link (Red Link S.A., ecosistema financiero/pagos) busca Automation Tester POS - Backend para el equipo de Procesamiento Adquirente. Objetivo: generar, ejecutar y automatizar planes de prueba (código evolutivo y regresión) garantizando calidad, estabilidad y seguridad en la integración de medios de pago. Requisitos: graduado/a, promediando o finalizando Ingeniería en Sistemas o afines; 3 a 5+ años en posiciones similares en medios de pago y/o servicios financieros; programación y automatización de pruebas; API REST y modelado de bases de datos; documentación técnico-funcional. Deseable: sistemas de cobro sobre dispositivos POS y PinPad, flujos de pagos adquirentes, normativas (PCI, Banco Central, EMVCo) y certificaciones (Integración, L3, PCI). Ofrecen híbrido, bono anual, revisiones salariales y medicina prepaga. Postular en el link.',
    tags: ['qa automation', 'automation', 'api testing', 'rest', 'pos', 'pinpad', 'payments', 'medios de pago', 'adquirencia', 'backend testing', 'emvco', 'pci', 'banca'],
    salary: '',
    date: '2026-09-08',
  },

  // ============ MÉXICO ============
  // ↑ Offers de México. Todas las de este bloque llevan regionGuess: 'mexico'.
  {
    id: 'curated-mx-coderdoad-qa-auto',
    source: 'Tech Jobs in Mexico',
    title: 'QA Automation Engineer',
    company: 'CodeRoad Inc',
    location: 'México (100% Remoto)',
    regionGuess: 'mexico',
    applyUrl: 'https://lnkd.in/ez9E4ydp',
    description:
      'Búsqueda en Tech Jobs in Mexico: QA Automation Engineer en CodeRoad Inc, modalidad 100% remota para todo el país. Automatización de pruebas, testing funcional y de regresión, APIs y metodologías ágiles.',
    tags: ['qa automation', 'automation', 'testing', 'api testing', 'agile'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-mx-coderdoad-qa-manual',
    source: 'Tech Jobs in Mexico',
    title: 'Sr. QA Manual Engineer',
    company: 'CodeRoad Inc',
    location: 'México (100% Remoto)',
    regionGuess: 'mexico',
    applyUrl: 'https://lnkd.in/e6TzVEJ7',
    description:
      'Búsqueda en Tech Jobs in Mexico: Sr. QA Manual Engineer en CodeRoad Inc, modalidad 100% remota. Pruebas funcionales, manuales y de regresión con foco en calidad de software.',
    tags: ['qa', 'manual testing', 'testing', 'functional testing', 'regression'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-mx-rapptr-qa-analyst',
    source: 'Tech Jobs in Mexico',
    title: 'QA Analyst',
    company: 'Rapptr Labs',
    location: 'México (100% Remoto)',
    regionGuess: 'mexico',
    applyUrl: 'https://lnkd.in/da-MPwxD',
    description:
      'Búsqueda en Tech Jobs in Mexico: QA Analyst en Rapptr Labs, modalidad 100% remota. Análisis y ejecución de pruebas funcionales, test cases y reporte de defectos en entornos ágiles.',
    tags: ['qa', 'testing', 'functional testing', 'test cases', 'agile'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-mx-devlane-sr-qa',
    source: 'Tech Jobs in Mexico',
    title: 'Sr. QA Engineer',
    company: 'Devlane',
    location: 'México (100% Remoto)',
    regionGuess: 'mexico',
    applyUrl: 'https://lnkd.in/eK27UxgU',
    description:
      'Búsqueda en Tech Jobs in Mexico: Sr. QA Engineer en Devlane, modalidad 100% remota. Liderar estrategias de testing manual y automatizado, APIs, web y mobile en equipos ágiles.',
    tags: ['qa', 'senior qa', 'testing', 'automation', 'api testing', 'mobile testing'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-mx-gila-sdet',
    source: 'Tech Jobs in Mexico',
    title: 'QA/SDET Engineer',
    company: 'Gila Software',
    location: 'México (100% Remoto)',
    regionGuess: 'mexico',
    applyUrl: 'https://lnkd.in/ebSZhGAt',
    description:
      'Búsqueda en Tech Jobs in Mexico: QA/SDET Engineer en Gila Software, modalidad 100% remota. Automatización de pruebas, diseño de frameworks de testing, APIs y CI/CD.',
    tags: ['qa', 'sdet', 'automation', 'test automation', 'api testing', 'ci/cd'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-mx-nexaminds-qa-auto',
    source: 'Tech Jobs in Mexico',
    title: 'QA Automation Engineer',
    company: 'Nexaminds',
    location: 'México (100% Remoto)',
    regionGuess: 'mexico',
    applyUrl: 'https://lnkd.in/e_qX8HQY',
    description:
      'Búsqueda en Tech Jobs in Mexico: QA Automation Engineer en Nexaminds, modalidad 100% remota. Automatización de pruebas web, mobile y APIs con foco en calidad.',
    tags: ['qa automation', 'automation', 'testing', 'mobile testing', 'api testing'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-mx-globallogic-sr-auto',
    source: 'Tech Jobs in Mexico',
    title: 'Sr. Automation QA Engineer',
    company: 'GlobalLogic',
    location: 'CDMX, México (Híbrido)',
    regionGuess: 'mexico',
    applyUrl: 'https://lnkd.in/e22H2wyh',
    description:
      'Búsqueda en Tech Jobs in Mexico: Sr. Automation QA Engineer en GlobalLogic, modalidad híbrida en CDMX. Automatización de pruebas a gran escala, frameworks de testing, APIs y entornos ágiles.',
    tags: ['qa automation', 'automation', 'testing', 'api testing', 'agile'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-mx-felix-sr-qa-auto',
    source: 'Tech Jobs in Mexico',
    title: 'Senior QA Automation Engineer',
    company: 'Félix',
    location: 'CDMX, México (Híbrido)',
    regionGuess: 'mexico',
    applyUrl: 'https://lnkd.in/gAeHh_Q6',
    description:
      'Búsqueda en Tech Jobs in Mexico: Senior QA Automation Engineer en Félix, modalidad híbrida en CDMX. Fintech de pagos; automatización de pruebas, APIs y servicios financieros.',
    tags: ['qa automation', 'automation', 'testing', 'api testing', 'fintech'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-mx-verifone-qa-analyst',
    source: 'Tech Jobs in Mexico',
    title: 'Software QA Analyst',
    company: 'Verifone',
    location: 'CDMX, México (Híbrido)',
    regionGuess: 'mexico',
    applyUrl: 'https://lnkd.in/euZN3p8H',
    description:
      'Búsqueda en Tech Jobs in Mexico: Software QA Analyst en Verifone, modalidad híbrida en CDMX. Análisis y ejecución de pruebas funcionales y de regresión en productos de tecnología de pagos.',
    tags: ['qa', 'testing', 'functional testing', 'regression'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-mx-mtech-qa-tester',
    source: 'Tech Jobs in Mexico',
    title: 'QA Tester',
    company: 'MTech Systems',
    location: 'Querétaro, México (Híbrido)',
    regionGuess: 'mexico',
    applyUrl: 'https://lnkd.in/eBwRQ_U7',
    description:
      'Búsqueda en Tech Jobs in Mexico: QA Tester en MTech Systems, modalidad híbrida en Querétaro. Ejecución de pruebas manuales y funcionales, test cases y reporte de defectos.',
    tags: ['qa', 'tester', 'manual testing', 'functional testing', 'test cases'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-mx-qa-sr-js-webdriverio',
    source: 'Reclutador (LinkedIn)',
    title: 'Sr. QA Automation Engineer (JavaScript)',
    company: 'Confidencial (AR/CO/MX/BR)',
    location: 'México (100% Remoto)',
    regionGuess: 'mexico',
    applyUrl: '',
    description:
      'Sr. QA Automation Engineer (JavaScript) para un proyecto global en crecimiento, 100% remoto (AR/CO/MX/BR). Requisitos: +5 años en Quality Testing, +3 años en QA Automation, pipelines CI/CD (CircleCI preferido), automatización frontend con JavaScript + WebdriverIO, automatización backend, diseño orientado a objetos y bases de datos relacionales y no relacionales. Qué vas a hacer: liderar la calidad end-to-end, diseñar y mantener suites de automatización frontend/backend, coordinar releases completos (go/no-go, sanity checks post-deploy), visibilidad de cobertura/riesgos, proponer mejoras y roadmap de calidad. Postulación por MD (publicación #QA #Automation #SDET #JavaScript #WebdriverIO).',
    tags: ['qa automation', 'automation', 'sdet', 'javascript', 'webdriverio', 'ci/cd', 'circleci', 'frontend testing', 'api testing', 'backend testing', 'release management'],
    salary: '',
    date: '2026-09-08',
  },
  {
    id: 'curated-mx-qa-mid-manual-technical',
    source: 'Reclutador (LinkedIn)',
    title: 'Quality Assurance Engineer Mid (Manual + Técnico)',
    company: 'Confidencial (México)',
    location: 'México (100% Remoto)',
    regionGuess: 'mexico',
    applyUrl: '',
    description:
      'Quality Assurance Engineer Mid para equipo de ingeniería con foco en QA manual y profundidad técnica (no es QA manual tradicional ni Automation Engineer puro). Mayor parte del trabajo: functional y regression testing, validación de funcionalidades, seguimiento de bugs y exploración de escenarios. También: APIs REST con Postman, Git, Linux/Unix y línea de comandos, revisión de logs, levantar servicios, entender backend y desenvolverse en CI/CD; automatización con Cypress (entender, ejecutar, mantener y ampliar una suite existente). Requisitos: 2+ años de experiencia en QA, functional/regression testing sólido, API testing con Postman, comodidad con Terminal, Linux/Unix, Git, test automation (idealmente Cypress), leer/depurar código y automatizaciones sencillas; Ruby, JavaScript/TypeScript o Python suman; inglés avanzado/bilingüe para trabajar con equipos en USA. Condiciones: 100% remoto desde México (preferencia Apodaca/Monterrey pero no excluyente), contratación directa, tiempo indeterminado, horario ~8:30-16:30 Mountain Time, 21 días de aguinaldo, vales de despensa, fondo de ahorro y seguros médicos. Postulación por DM con CV en inglés.',
    tags: ['qa', 'manual testing', 'functional testing', 'regression', 'api testing', 'postman', 'cypress', 'git', 'linux', 'unix', 'ci/cd', 'automation', 'test automation', 'javascript', 'python', 'ruby'],
    salary: '',
    date: '2026-09-08',
  },

  // ============ PERÚ ============
  // ↑ Ofertas de Perú (regionGuess: 'peru'), relevéadas de bolsas locales.
  {
    id: 'curated-pe-valtx-qa-ia',
    source: 'Directo (Valtx)',
    title: 'QA Automatizador – IA',
    company: 'Valtx',
    location: 'Lima, Perú',
    regionGuess: 'peru',
    applyUrl: 'https://www.valtx.pe',
    description:
      'Valtx busca QA Automatizador – IA. Misión: diseñar e implementar una solución de QA potenciada por IA con agentes capaces de generar escenarios BDD, casos de prueba y scripts de automatización, integrándose con Jira/Rovo y usando Python, GitHub Copilot y modelos Claude. Tecnologías clave: Python, GitHub Copilot, modelos Claude, Jira/Rovo, BDD y automatización de pruebas, IA aplicada a QA. Postulación: enviar CV a lnunural@valtx.pe con nombre de posición y expectativas salariales.',
    tags: ['qa automation', 'automation', 'python', 'bdd', 'gherkin', 'jira', 'ai', 'ia'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-pe-qds-qa-auto',
    source: 'Directo (QDS)',
    title: 'QA Automatizador',
    company: 'QDS - Quality & Development Software SAC',
    location: 'Lima, Perú (Híbrido)',
    regionGuess: 'peru',
    applyUrl: 'https://www.qds.com.pe',
    description:
      'QDS busca QA Automatizador (solo Perú, híbrido). Requisitos: Postman, Playwright y TypeScript, 3 años de experiencia en la posición, gestión de defectos (Jira/Azure DevOps), diseño de casos de prueba (Gherkin/BDD), pruebas funcionales, no funcionales y de regresión. Deseable: Performance Testing (JMeter) y conocimientos de OWASP. Enviar CV a eliana.santini@qds.com.pe.',
    tags: ['qa automation', 'automation', 'playwright', 'typescript', 'postman', 'api testing', 'bdd', 'gherkin', 'jira', 'azure devops', 'regression'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-pe-interseguro-tpo',
    source: 'Directo (Interseguro)',
    title: 'Technical Product Owner',
    company: 'Interseguro Compañía de Seguros',
    location: 'Lima, Perú (Híbrido)',
    regionGuess: 'peru',
    applyUrl: 'https://l1nq.com/kb5gxw6',
    description:
      'Interseguro busca Technical Product Owner (solo Perú, híbrido). Bachiller o titulado en Ingeniería de Sistemas/Informática/Software. 3 a 5 años liderando equipos de desarrollo. Tecnologías: Angular, React, Vue, Nuxt, Java, .NET, Python, Golang, Node.js y SQL Server. Inglés intermedio deseable. Conocimientos de modelamiento de datos, virtualización y despliegue en Cloud, herramientas de IA Generativa (Cursor), Google Cloud Platform (Cloud Run, Cloud Storage, Cloud SQL, Cloud Functions, Pub/Sub), Kubernetes y CI/CD. Postular en el link.',
    tags: ['cloud', 'sql', 'python', 'agile', 'kubernetes', 'ci/cd', 'ai'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-pe-coderslab-qa-ssr',
    source: 'Directo (CodersLab)',
    title: 'Especialista QA SSR',
    company: 'CodersLab',
    location: 'Lima, Perú (Híbrido)',
    regionGuess: 'peru',
    applyUrl: 'https://www.coderslab.io',
    description:
      'CodersLab busca Especialista QA SSR (Lima, Perú, híbrido). Mínimo 3 años ejecutando pruebas manuales de QA (excluyente). Certificación ISTQB Foundation Level o afines (excluyente). Consultas en bases de datos. Conocimientos o nociones de automatización. Ejecución y pruebas de servicios/APIs (Postman o similares). Ejecución de procesos ETL. Experiencia en sector bancario. Enviar CV a veronica.rueda@coderslab.io.',
    tags: ['qa', 'manual testing', 'testing', 'sql', 'api testing', 'postman', 'banking', 'istqb', 'etl'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-pe-novacomp-sr-sdet',
    source: 'Directo (Novacomp)',
    title: 'Senior QA Automation / SDET',
    company: 'Novacomp',
    location: 'Lima, Perú (Híbrido)',
    regionGuess: 'peru',
    applyUrl: 'https://www.novacomp.com',
    description:
      'Novacomp busca Senior QA Automation / SDET (Lima, Perú, híbrido). Automatización enfocada en APIs (60-70%), Web (30%) y Mobile. Dominio de Playwright con TypeScript y herramientas como Karate o Selenium. Pruebas de rendimiento con K6. Enviar CV a fflores@crnova.com.',
    tags: ['qa automation', 'sdet', 'automation', 'api testing', 'playwright', 'typescript', 'selenium', 'mobile testing', 'performance testing'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-pe-indra-qa-manager-uat',
    source: 'Directo (Indra)',
    title: 'QA Manager (UAT Banca)',
    company: 'Indra',
    location: 'San Isidro, Lima, Perú',
    regionGuess: 'peru',
    applyUrl: 'https://wa.link/ea14nb',
    description:
      'Indra busca QA Manager para liderar la estrategia y gestión de pruebas UAT en proyectos de alta criticidad del sector bancario. Requisitos: 8+ años en QA y 3+ años liderando equipos/servicios de pruebas; experiencia en QA/UAT, gestión de riesgos, integraciones, migraciones y Go/No-Go; experiencia indispensable en sector bancario; Jira/Xray o equivalentes; Ingeniería de Sistemas/Informática/Industrial. Deseable: ISTQB, PMP/PMI, Scrum/Agile y Bantotal. Presencial en San Isidro, Lima, lunes a viernes 9-18hs. Postulación: gmcaballerop@indracompany.com.',
    tags: ['qa', 'qa manager', 'uat', 'testing', 'banking', 'banca', 'jira', 'xray', 'agile', 'scrum', 'test cases'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-pe-nttd-bootcamp-qa',
    source: 'Directo (NTT DATA)',
    title: 'Bootcamp QA Automatizador',
    company: 'NTT DATA Europe & Latam',
    location: 'Perú (100% Remoto, provincias)',
    regionGuess: 'peru',
    applyUrl: 'https://lnkd.in/eZcd2R5T',
    description:
      'NTT DATA Europe & Latam busca profesionales para su Bootcamp QA Automation, convocatoria para profesionales que residan en provincias del Perú, modalidad 100% remota. Requisitos: 1 a 2 años de experiencia en QA Manual, experiencia en pruebas funcionales y reporte de incidencias, manejo de Jira y/o Postman (deseable), interés en desarrollarse en Automatización de Pruebas. Enviar CV a gbonillr@nttdata.com o postular en el anuncio.',
    tags: ['qa automation', 'qa', 'automation', 'manual testing', 'functional testing', 'jira', 'postman', 'api testing', 'test automation'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-pe-nttd-qa-automatizador',
    source: 'Directo (NTT DATA Perú)',
    title: 'QA Automatizador Semi Senior / Senior',
    company: 'NTT DATA Europe & Latam',
    location: 'Perú (100% Remoto, todas las provincias)',
    regionGuess: 'peru',
    applyUrl: '',
    modality: '100% Remoto · Convocatoria abierta en todas las provincias del Perú',
    description:
      'NTT DATA sigue creciendo en todo el Perú y busca talento QA Automatizador para dos posiciones: QA Automatizador Semi Senior y QA Automatizador Senior. Modalidad 100% remota y convocatoria abierta para todas las provincias del Perú. Requisitos: experiencia en automatización de pruebas, incorporación a proyectos innovadores en una compañía global. Enviar CV a gbonillr@nttdata.com o postular en el anuncio.',
    tags: ['qa automation', 'qa', 'automation', 'test automation', 'semi senior', 'senior'],
    salary: '',
    date: '2026-09-10',
  },

  // ============ COLOMBIA ============
  // ↑ Ofertas de Colombia (regionGuess: 'colombia').
  {
    id: 'curated-co-ezertech-analista-qa',
    source: 'Directo (EZERTECH)',
    title: 'Analista QA',
    company: 'EZERTECH',
    location: 'Barranquilla, Colombia',
    regionGuess: 'colombia',
    applyUrl: 'https://www.ezertech.com.co',
    description:
      'EZERTECH busca Analista QA para software empresarial del sector salud (EPS). Mínimo 3 años en pruebas de software empresarial. Responsabilidades: diseñar planes, escenarios y casos de prueba; ejecutar pruebas funcionales, de integración y regresión; validaciones de datos; pruebas y validación de APIs; documentar y dar seguimiento a defectos; emitir concepto de calidad del release. Deseable: experiencia en sector salud/EPS/IPS/aseguramiento/facturación en salud, Postman para APIs, SQL básico para validación de datos, metodologías ágiles/Scrum, Jira, Azure DevOps o GitLab. Presencial en Barranquilla. Postulación por mail a soporte@ezertech.com.co.',
    tags: ['qa', 'analista qa', 'functional testing', 'manual testing', 'api testing', 'postman', 'sql', 'agile', 'scrum', 'jira', 'azure devops'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-co-htqa-fabrica-pruebas',
    source: 'Directo (HTQA)',
    title: 'QA Engineer – Fábrica de Pruebas (Java/Python, Spark, Ab Initio, PL/SQL)',
    company: 'HTQA – Human Team Technology QA',
    location: 'Bogotá, Colombia',
    regionGuess: 'colombia',
    applyUrl: 'https://www.htqasas.com',
    description:
      'HTQA (Human Team Technology QA, Bogotá) busca profesionales QA con experiencia real y comprobable en tecnologías específicas: Java + Python, Apache Spark, Ab Initio y PL/SQL, según cada vacante. No buscan un QA generalista: piden coincidencia del 100% con la tecnología solicitada de su Fábrica de Pruebas. Enviar CV a rrhh@htqasas.com o kdelgado@htqasas.com.',
    tags: ['qa', 'java', 'python', 'apache spark', 'ab initio', 'pl/sql', 'big data', 'testing', 'data', 'etl'],
    salary: '',
    date: '2026-09-08',
  },
  {
    id: 'curated-co-capgemini-qa-spark-plsql',
    source: 'Capgemini (LinkedIn)',
    title: 'QA Funcional Spark PL/SQL Sr',
    company: 'Capgemini',
    location: 'Colombia (100% Remoto)',
    regionGuess: 'colombia',
    applyUrl: 'https://www.capgemini.com/co-es/',
    description:
      'Capgemini busca QA Funcional Spark PL/SQL Sr, modalidad 100% remoto, contrato a término fijo por 3 meses. Requisitos: 4+ años de experiencia en pruebas de software, pruebas funcionales, Spark, PL/SQL, servicios REST y SOAP, JMeter, SoapUI, Postman y Appium. Postulación a través de la publicación o compartiendo la oportunidad.',
    tags: ['qa', 'functional testing', 'spark', 'pl/sql', 'rest', 'soap', 'jmeter', 'soapui', 'postman', 'appium', 'manual testing'],
    salary: '',
    date: '2026-09-08',
  },
  {
    id: 'curated-co-qa-sr-js-webdriverio',
    source: 'Reclutador (LinkedIn)',
    title: 'Sr. QA Automation Engineer (JavaScript)',
    company: 'Confidencial (AR/CO/MX/BR)',
    location: 'Colombia (100% Remoto)',
    regionGuess: 'colombia',
    applyUrl: '',
    description:
      'Sr. QA Automation Engineer (JavaScript) para un proyecto global en crecimiento, 100% remoto (AR/CO/MX/BR). Requisitos: +5 años en Quality Testing, +3 años en QA Automation, pipelines CI/CD (CircleCI preferido), automatización frontend con JavaScript + WebdriverIO, automatización backend, diseño orientado a objetos y bases de datos relacionales y no relacionales. Qué vas a hacer: liderar la calidad end-to-end, diseñar y mantener suites de automatización frontend/backend, coordinar releases completos (go/no-go, sanity checks post-deploy), visibilidad de cobertura/riesgos, proponer mejoras y roadmap de calidad. Postulación por MD (publicación #QA #Automation #SDET #JavaScript #WebdriverIO).',
    tags: ['qa automation', 'automation', 'sdet', 'javascript', 'webdriverio', 'ci/cd', 'circleci', 'frontend testing', 'api testing', 'backend testing', 'release management'],
    salary: '',
    date: '2026-09-08',
  },
  {
    id: 'curated-co-qa-auto-ai-llm',
    source: 'Reclutador (LinkedIn)',
    title: 'QA Automation Engineer (AI / LLM)',
    company: 'Confidencial (Colombia)',
    location: 'Colombia',
    regionGuess: 'colombia',
    applyUrl: '',
    description:
      'QA Automation Engineer para nuevo proyecto, contratación por nómina en Colombia, proyecto de 6 meses, inglés básico. Buscan +3 años en QA/automatización, experiencia en pruebas de soluciones de AI, GenAI, LLMs o agentes de AI, Azure DevOps y CI/CD, evaluación de LLMs (hallucination, groundedness y calidad de respuestas), manejo de YAML/JSON. Postulación: contactar al reclutador vía LinkedIn (publicación #QAAutomation #GenAI #LLM #Colombia).',
    tags: ['qa automation', 'automation', 'ai', 'ia', 'llm', 'generative ai', 'azure devops', 'ci/cd', 'api testing'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-co-hyg-analista-qa',
    source: 'Directo (HyG Consultores)',
    title: 'Analista de Requisitos y Calidad de Software (QA)',
    company: 'HyG Consultores',
    location: 'Medellín, Colombia',
    regionGuess: 'colombia',
    applyUrl: 'https://www.hyg.com.co',
    description:
      'HyG Consultores busca Analista de Requisitos y Calidad de Software (QA) con mínimo 1 año de experiencia, presencial en Medellín / Valle de Aburrá. Requisitos clave: metodologías ágiles, levantamiento de requisitos, diseño/ejecución de pruebas, Jira/Azure DevOps, SQL y Excel. Enviar hoja de vida a gestionhumana@hyg.com.co.',
    tags: ['qa', 'analista funcional', 'analista', 'testing', 'functional testing', 'test cases', 'jira', 'azure devops', 'sql', 'agile'],
    salary: '',
    date: '2026-09-01',
  },

  // ============ CHILE ============
  // ↑ Ofertas de Chile (regionGuess: 'chile').
  {
    id: 'curated-cl-randstad-qa-junior',
    source: 'Directo (Randstad Chile)',
    title: 'Analista QA Junior',
    company: 'Randstad',
    location: 'Santiago, Chile (Híbrido)',
    regionGuess: 'chile',
    applyUrl: 'https://www.randstad.cl',
    description:
      'Randstad Chile busca Analista QA Junior para empresa de soluciones tecnológicas de gestión humana. Modalidad híbrida en Las Condes (Santiago de Chile), contrato plazo fijo luego indefinido. Requisitos: titulado/a de Ingeniería en Informática o afines (0 a 1 año de experiencia), manejo de JavaScript, Python, SCRUM y RESTful, conocimientos en buenas prácticas de QA, diseño y automatización de pruebas. Enviar CV a mariana.herrera@randstad.cl con asunto "QA Analyst Junior".',
    tags: ['qa', 'analista qa', 'qa automation', 'testing', 'javascript', 'python', 'scrum', 'rest', 'test automation'],
    salary: '',
    date: '2026-09-01',
  },
  {
    id: 'curated-cl-socius-qa-auto',
    source: 'Directo (SOCIUS)',
    title: 'QA Automatizador Semi Senior',
    company: 'SOCIUS',
    location: 'Santiago, Chile (Híbrido)',
    regionGuess: 'chile',
    applyUrl: 'https://lnkd.in/d2yVy8qU',
    description:
      'SOCIUS busca QA Automatizador Semi Senior (híbrido, Santiago de Chile), proyecto largo plazo, 3 vacantes. Qué harás: diseñar, desarrollar y mantener pruebas automatizadas; ejecutar pruebas funcionales, de APIs y performance; integrar pruebas en pipelines CI/CD; analizar resultados, documentar incidencias y hacer seguimiento de defectos. Qué buscan: automatización con Selenium, Cucumber y/o Karate, pruebas de APIs con Postman, SQL para validación de datos, GitHub y/o Jenkins, performance con JMeter y/o BlazeMeter, metodologías ágiles. Plus: BrowserStack, Azure, CyberArk o IntelliJ, certificación ISTQB y uso de IA (Copilot, PraIA). Aplicar en el link.',
    tags: ['qa automation', 'automation', 'selenium', 'cucumber', 'karate', 'api testing', 'postman', 'sql', 'github', 'jenkins', 'jmeter', 'blazemeter', 'performance testing', 'agile', 'browserstack', 'istqb', 'ai'],
    salary: '',
    date: '2026-09-08',
  },

  // ============ EUROPA ============
  // ↑ Ofertas de España y el resto de Europa (regionGuess: 'europa').
  {
    id: 'curated-eu-soaint-qa-auto',
    source: 'Directo (SOAINT)',
    title: 'QA Automation',
    company: 'SOAINT',
    location: 'Madrid, España (Híbrido)',
    regionGuess: 'europa',
    applyUrl: '',
    modality: 'Híbrido (Madrid) · Jornada completa',
    description:
      'SOAINT busca un/a profesional de QA Automation para sumarse a su equipo. Responsabilidades: diseñar y desarrollar pruebas automatizadas; definir y mejorar la estrategia de automatización; evaluar nuevas tecnologías y optimizar procesos de QA; asegurar el correcto funcionamiento de los servicios; acompañar y apoyar técnicamente al equipo de QA; seguimiento riguroso de pruebas, defectos e incidencias. Ubicación: Madrid, modalidad híbrida, jornada completa.',
    tags: ['qa automation', 'automation', 'test automation', 'functional testing', 'api testing', 'defects', 'defect tracking', 'test strategy', 'optimización', 'agile', 'quality assurance'],
    salary: '',
    date: '2026-09-10',
  },

  // ============ REMOTO GLOBAL (empresa no publicada) ============
  // ↑ Bloque "cajón de sastre": ofertas 100% remotas para el mundo entero. Como
  // ↑ no son de un país concreto, casi todas caen en la región 'eeuu' y en el
  // ↑ `company` puede figurar "No publicada (...)" o "Confidencial (Remoto)":
  // ↑ la vacante se capturó de un post de LinkedIn sin el nombre de la empresa.
  // ↑ También pasa acá que el `applyUrl` sea un mail en vez de una URL: para eso
  // ↑ el frontend lo muestra igual como link (abre el cliente de correo).
  {
    id: 'curated-global-watcher-test-auto',
    source: 'QA Watcher (via LinkedIn)',
    title: 'Test Automation Engineer',
    company: 'No publicada (QA Watcher)',
    location: 'Remoto (global)',
    regionGuess: 'eeuu',
    applyUrl: 'https://qawatcher.com/roles/test-automation-engineer-playwright-with',
    modality: '100% remoto (aviso anónimo capturado por QA Watcher)',
    description:
      'Test Automation Engineer nivel mid capturado por QA Watcher desde un post de LinkedIn. Buscan un/a profesional con 5-6 años de experiencia en testing web y API, con experiencia práctica en Playwright con TypeScript, database testing y pipelines CI/CD. Responsabilidades: desarrollar y ejecutar scripts de test automatizados con Playwright y TypeScript, pruebas de API y de base de datos, y monitoreo/mantenimiento de la suite de QA. Información de contacto y empresa completa disponibles tras registro en QA Watcher (post original: https://lnkd.in/gzW4-NVF).',
    tags: ['test automation', 'qa automation', 'automation', 'playwright', 'typescript', 'api testing', 'database testing', 'ci/cd', 'testing web'],
    salary: '',
    date: '2026-09-10',
  },
  {
    id: 'curated-global-watcher-ai-qa-us',
    source: 'QA Watcher (via LinkedIn)',
    title: 'QA Automation Engineer – AI / LLM (US o Canada)',
    company: 'No publicada (QA Watcher)',
    location: 'US o Canada (Remoto)',
    regionGuess: 'eeuu',
    applyUrl: 'https://qawatcher.com/roles/qa-automation-engineer-us-or-canada-1',
    modality: 'Remoto (US o Canadá) · nivel senior',
    description:
      'QA Automation Engineer senior capturado por QA Watcher desde un post de LinkedIn. Requiere experiencia especializada en testing de sistemas de IA y basados en LLM: desarrollar y ejecutar casos de prueba para sistemas no determinísticos que se comportan distinto en cada ejecución, e identificar y reportar bugs de no determinismo y problemas de hallucination. Información de contacto y empresa completas tras registro en QA Watcher (post original: https://lnkd.in/g8AuFpNJ).',
    tags: ['qa automation', 'automation', 'ai', 'llm', 'arge', 'sistemas no determinísticos', 'test cases', 'hallucinations', 'ia', 'api testing', 'test automation'],
    salary: '',
    date: '2026-09-10',
  },
  {
    id: 'curated-global-salesforce-qa-ssr-sr',
    source: 'Reclutador (LinkedIn)',
    title: 'QA Engineer SSR/SR – Salesforce & APIs',
    company: 'Confidencial (Remoto)',
    location: '100% Remoto',
    regionGuess: 'eeuu',
    applyUrl: 'https://lnkd.in/dSsrtxMR',
    modality: '100% remoto · Full time',
    description:
      'QA Engineer Semi Senior / Senior con experiencia en Salesforce, APIs, integraciones, automatización y arquitecturas distribuidas. Requisitos: 3+ años en QA/Testing, Salesforce + APIs REST, SQL/NoSQL + Data Testing, Kafka y AWS, automatización y programación, Cucumber, Gherkin, BDD, Jira y Xray. Modalidad 100% remota con muy buenos beneficios y fuerte foco técnico, autonomía y calidad end-to-end. Postulación por el link de la publicación (formulario anónimo de la empresa).',
    tags: ['qa', 'qa engineer', 'salesforce', 'api testing', 'rest', 'sql', 'nosql', 'data testing', 'kafka', 'aws', 'automation', 'cucumber', 'gherkin', 'bdd', 'jira', 'xray', 'arquitecturas distribuidas', 'e2e'],
    salary: '',
    date: '2026-09-10',
  },
  {
    id: 'curated-pa-infotree-qa-jr',
    source: 'Directo (Infotree Service)',
    title: 'QA Junior II',
    company: 'Infotree Service',
    location: 'Panamá Pacífico, Panamá (Híbrido)',
    regionGuess: 'eeuu',
    applyUrl: 'dvasquez@infotreeservice.com',
    modality: 'Híbrido (Panamá Pacífico) · Contrato indefinido · Lun-vie 8:00-17:00',
    description:
      'Infotree Service busca QA Junior II para un importante proyecto en Panamá Pacífico. Requisitos: 1-2 años en Software Testing/QA, API Testing (idealmente Postman), 1 año en sector bancario (indispensable), conocimientos ISTQB, familiaridad con AWS o Azure, Scrum/metodologías ágiles y estándares de calidad. Plus: IA aplicada al testing, automatización y mejora continua. Responsabilidades: pruebas funcionales, integrales y de regresión, ejecución de pruebas de API, escenarios y casos de prueba, seguimiento de defectos, validación pre-producción y mejora continua de procesos QA. Enviar CV a dvasquez@infotreeservice.com con asunto "QA Junior II - Panamá".',
    tags: ['qa', 'qa junior', 'manual testing', 'functional testing', 'integration testing', 'regression', 'api testing', 'postman', 'istqb', 'aws', 'azure', 'scrum', 'agile', 'banking', 'banca', 'quality assurance', 'test cases'],
    salary: '',
    date: '2026-09-10',
  },
  {
    id: 'curated-global-peraton-test-auto',
    source: 'QA Watcher (via LinkedIn)',
    title: 'Ingeniero de Automatización de Pruebas / Test Automation Engineer',
    company: 'Peraton',
    location: 'USA',
    regionGuess: 'eeuu',
    applyUrl: 'https://qawatcher.com/roles/test-automation-engineer-usa-1',
    modality: 'Contrato de 6 meses (con potencial de pase a tiempo completo) · nivel senior',
    description:
      'Peraton busca un Ingeniero de Automatización de Pruebas (Test Automation Engineer) senior para un contrato de 6 meses con fuerte potencial de conversión a tiempo completo. Requiere experiencia práctica con Facets y procesamiento de reclamos de salud (healthcare claims). Responsabilidades: probar procesamiento de reclamos y flujos de payer, validar transacciones EDI HIPAA 5010 (837, 834, 270/271, 278, 820 y 999) y automatizar esas pruebas. Información de contacto completa tras registro en QA Watcher (post original: https://lnkd.in/gZ6pJh5q).',
    tags: ['test automation', 'qa automation', 'automation', 'facets', 'healthcare', 'claims', 'edi', 'hipaa', 'payer', 'functional testing', 'api testing'],
    salary: '',
    date: '2026-09-10',
  },
];

// ↑ FIN DEL CATÁLOGO. Ojo: acá no hay ninguna función auxiliar ni más exports;
// ↑ lo único que este archivo entrega al resto del proyecto es el array de arriba.

// ↑ CÓMO SE EVITAN DUPLICADOS: este archivo es solo el dato, la deduplicación
// ↑ la hacen los demás módulos. La primera barrera es el `id` con prefijo
// ↑ "curated-", que nunca se repite dentro del array y jamás coincide con el de
// ↑ una oferta de las fuentes en vivo. La segunda es la clave `titulo::empresa`
// ↑ que arman jobSources.js (dedupeKey) e history.js (keyOf) más adelante: si la
// ↑ misma vacante aparece en vivo y también curada, el título y la empresa la
// ↑ delatan y la oferta repetida se descarta.

// ↑ PARA AGREGAR UNA OFERTA A MANO: se pega un objeto más con las mismas 11
// ↑ llaves, dentro del bloque de su región, y ya está. El resto del proyecto no
// ↑ hay que tocarlo: index.js concatena este array al resultado de las fuentes
// ↑ en vivo, matcher.js le calcula el % de match y lo agrupa por región, y el
// ↑ frontend lo lista igual que cualquier otra oferta.
