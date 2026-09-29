import { jobLanguageInfo, langBadgeTitle, LANG_SHORT, LANG_NAME } from '../utils.js';
// ↑ Todo lo que sabe de idioma viene de utils.js: acá no hay ninguna lógica, solo
//   se dibuja. Se importa desde los dos lugares donde va la etiqueta (la tarjeta
//   de JobList y el header del modal) para que las dos se vean y se lean IGUALES:
//   duplicar el <span> en cada archivo haría que un cambio en uno se olvide del otro.

// ============================================================================
// Etiqueta informativa con el idioma detectado de la oferta ("ES" / "EN").
// ----------------------------------------------------------------------------
// Qué muestra: la sigla del idioma, deduced del TEXTO de la oferta por
//   detectJobLanguage() (ver utils.js). Si la confianza es baja, se atenúa.
// Qué NO hace: no filtra, no ordena, no navega y no guarda nada. Es un dato, no
//   un control. Por eso el usuario pidió solo el indicador y NO un filtro.
// ============================================================================

export default function LanguageBadge({ job }) {
  // ↑ Recibe la oferta COMPLETA (y no un string) porque la detección necesita
  //   leer el texto: el título y, sobre todo, la descripción.

  const info = jobLanguageInfo(job);
  // ↑ jobLanguageInfo() es detectJobLanguage() + caché por id de oferta. El caché
  //   importa acá: JobList se re-dibuja en cada cambio de tema, de página, de
  //   orden y al abrir/cerrar el modal, y sin memoización habría que volver a
  //   limpiar y tokenizar las ~220 descripciones largas del historial cada vez.

  return (
    <span
      className={`lang-badge${info.weak ? ' lang-badge-weak' : ''}`}
      title={langBadgeTitle(info)}
      // ↑ El title (tooltip del mouse) lo arma utils.js para que sea el MISMO
      //   texto en la tarjeta y en el modal, y para poder explicar los tres
      //   casos: detectado con certeza / estimado por poco texto / sin texto.
      //   Acá va la palabra entera ("castellano") porque la sigla sola no le dice
      //   nada a quien no sabe qué significa "ES".
    >
      {LANG_SHORT[info.lang]}
      {/* ↑ A la vista solo se ve la sigla: "Español"/"Inglés" completo no entra
          en la tarjeta sin romper el layout junto al pill de % de match. */}
      <span className="sr-only"> ({LANG_NAME[info.lang]})</span>
      {/* ↑ Este <span> con .sr-only NO se ve pero SÍ se lee en un lector de
          pantalla (VoiceOver, NVDA, JAWS): anuncia "ES (castellano)" en vez de
          una sigla suelta. Accesibilidad WCAG 2.1 AA, criterio 1.3.1. */}
    </span>
    // ↑ Se usa <span> y NO <button> a propósito: no es interactivo, así que no
    //   debe tomar foco ni mostrar cursor de mano. Si fuera un botón, el teclado
    //   lo recorrería con el Tab y le mentiría al usuario: parecería un control
    //   que hace algo cuando en realidad es solo información.
  );
}
