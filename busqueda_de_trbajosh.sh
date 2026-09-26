#!/usr/bin/env bash
# ↑ Arranque en una sola línea para Linux, macOS y WSL/Git Bash: compila el frontend,
#   levanta el servidor (que también sirve la API), espera a que responda y abre el
#   navegador. Hace lo mismo que `npm start` (que solo compila y ejecuta), pero además
#   espera a que el servidor esté listo y te deja la pestaña del navegador abierta.
set -Eeuo pipefail
# ↑ Modo "estricto" de Bash, una seguro de vida contra errores silenciosos:
#   -E : los "traps" (como el cleanup de más abajo) también se heredan dentro de funciones.
#   -e : si un comando falla, el script aborta en el momento (salvo dentro de un if/&&/||).
#   -u : usar una variable que no fue definida es un error (detecta errores de tipeo).
#   -o pipefail : si algo falla en una tubería (|), falla el script entero, no solo el
#         último comando de la tubería, que es el único que suele "fallar" en silencio.

# ↑ ROOT_DIR: la carpeta donde vive ESTE script. Se resuelve con BASH_SOURCE[0] (el nombre
#   del archivo tal como se ejecutó) combinado con cd + pwd, que es la forma estándar de
#   no depender desde dónde lo llamen. Gracias a esto, el `npm run build` de más abajo
#   siempre corre sobre la raíz del proyecto y no sobre la carpeta actual del usuario.
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# ↑ Puerto del servidor. La forma ${PORT:-3000} significa: usar la variable PORT si el
#   usuario la define al ejecutarlo (PORT=4000 ./script.sh) y, si no existe, caer en 3000.
PORT="${PORT:-3000}"
# ↑ La URL completa del servidor local. Se usa 127.0.0.1 (loopback) y no "localhost"
#   porque es el loopback literal: el servidor queda accesible solo desde esta máquina.
APP_URL="http://127.0.0.1:${PORT}"
# ↑ PID = número de proceso del servidor. Arranca vacío para que cleanup sepa que todavía
#   no hay ningún proceso al que matar.
SERVER_PID=""

# ↑ Nos movemos a la raíz del proyecto: a partir de acá npm y node trabajan en el lugar correcto.
cd "$ROOT_DIR"

# ↑ Chequeo de requisitos: sin node o npm no hay build, y sin curl no hay forma de saber si
#   el servidor respondió. Mejor fallar acá con un mensaje claro que más abajo con un error
#   de Node incomprensible.
for command_name in node npm curl; do
  # ↑ command -v busca el ejecutable en el PATH. >/dev/null 2>&1 descarta tanto la salida
  #   como el error, para que un comando ausente no ensucie la terminal.
  if ! command -v "$command_name" >/dev/null 2>&1; then
    # ↑ >&2 manda el mensaje a la salida de error, que es la que se ve en rojo.
    printf 'Falta el comando requerido: %s\n' "$command_name" >&2
    exit 1
  fi
done

# ↑ open_browser: cada sistema operativo abre una URL con un comando distinto, así que
#   acá se pregunta por el sistema con un `case` en vez de asumir que todos son Linux.
open_browser() {
  # ↑ uname -s devuelve el nombre del sistema: Linux, Darwin (macOS), MINGW64 (Git Bash)...
  case "$(uname -s)" in
    # ↑ Git Bash / MSYS / Cygwin sobre Windows: no existe xdg-open, así que se le pide
    #   a Windows que abra la URL. El >/dev/null 2>&1 || true silencia el error porque
    #   en un entorno sin escritorio tampoco es grave: al final solo se trata de abrir la URL.
    MINGW*|MSYS*|CYGWIN*)
      cmd.exe /c start "" "$APP_URL" >/dev/null 2>&1 || true
      ;;
    Linux*)
      # ↑ OJO TRAMPA: en WSL uname -s también dice "Linux", pero el navegador vive en
      #   Windows. La forma de distinguirlos es leer /proc/version y buscar la palabra
      #   "microsoft" (es la huella que deja WSL). -i = ignora mayúsculas, -q = sin salir
      #   con código de error si no encuentra nada.
      if grep -qi microsoft /proc/version 2>/dev/null; then
        cmd.exe /c start "" "$APP_URL" >/dev/null 2>&1 || true
      elif command -v xdg-open >/dev/null 2>&1; then
        # ↑ Linux de verdad: xdg-open es el estándar para abrir direcciones web.
        xdg-open "$APP_URL" >/dev/null 2>&1 || true
      else
        # ↑ Sin nada con qué abrirlo (un server sin escritorio, por ejemplo):
        #   al menos le mostramos la dirección al usuario.
        printf 'Abre esta dirección en tu navegador: %s\n' "$APP_URL"
      fi
      ;;
    # ↑ macOS: el comando nativo se llama simplemente `open` (el de Linux es xdg-open).
    Darwin*)
      open "$APP_URL" >/dev/null 2>&1 || true
      ;;
    # ↑ Sistema operativo desconocido: no adivinamos, solo mostramos la dirección.
    *)
      printf 'Abre esta dirección en tu navegador: %s\n' "$APP_URL"
      ;;
  esac
}

# ↑ cleanup se ejecuta al salir del script y apaga el servidor que levantamos.
#   Sin esto, cada corrida dejaría un node server/index.js huérfano ocupando el puerto
#   3000, y el siguiente arranque fallaría con un error de "puerto en uso".
cleanup() {
  # ↑ kill -0 NO mata nada: solo pregunta "¿ese proceso sigue vivo?". El 2>/dev/null
  #   esconde el error que aparece si el proceso ya no existe.
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    printf '\nCerrando el servidor local...\n'
    # ↑ kill manda SIGTERM (le pedimos que termine) y no -9 (que lo mata de golpe).
    #   El || true evita que el modo estricto aborte el script si el proceso ya había
    #   muerto, y el wait se queda esperando a que termine de verdad.
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

# ↑ "Traps": le decimos a Bash qué hacer ante cada señal (un pedido de parada).
#   EXIT: el script terminó, se haya terminado por donde se haya terminado.
trap cleanup EXIT
# ↑ INT = Ctrl+C. En vez de matar a la fuerza hacemos 'exit 130' (el código estándar para
#   "interrumpido"), y como exit dispara el trap de EXIT, cleanup también se ejecuta.
trap 'exit 130' INT
# ↑ TERM = kill. 143 es el código estándar de "terminado por SIGTERM".
trap 'exit 143' TERM

# ↑ Chequeo previo: si YA hay algo escuchando en el puerto, no levantamos un segundo
#   servidor (fallaría con EADDRINUSE). curl con -f falla ante errores HTTP, -sS
#   silencia el cuerpo de la respuesta pero muestra el error. Probamos las dos URLs
#   (la API y la página) porque queremos que estén vivas las dos cosas.
if curl -fsS "$APP_URL/api/profile" >/dev/null 2>&1 && curl -fsS "$APP_URL/" >/dev/null 2>&1; then
  printf 'La API y la página ya están activas en %s\n' "$APP_URL"
  open_browser
  exit 0
fi

# ↑ Compilamos el frontend (Vite genera la carpeta dist/). Con `set -e`, si el build
#   falla el script aborta solo y no intenta levantar un servidor sin los archivos.
printf 'Compilando la página...\n'
npm run build

# ↑ Levantamos el servidor en segundo plano con &, y capturamos su PID con $!, que es el
#   número de proceso que el sistema acaba de asignarle. Necesitamos ese número para
#   poder apagarlo después desde cleanup.
printf 'Iniciando servidor y API en %s...\n' "$APP_URL"
PORT="$PORT" node server/index.js &
SERVER_PID="$!"

# ↑ Espera activa: probamos la API y la página una vez por segundo, hasta 90 veces
#   (o sea, hasta 90 segundos). El curl -fsS de la condición NO aborta el script aunque
#   falle, porque va dentro de un if: acá un fallo significa "todavía no", no "abortar".
ready=false
for ((attempt = 0; attempt < 90; attempt++)); do
  if curl -fsS "$APP_URL/api/profile" >/dev/null 2>&1 && curl -fsS "$APP_URL/" >/dev/null 2>&1; then
    ready=true
    # ↑ break corta el ciclo: ya respondió, no hay seguir esperando.
    break
  fi
  # ↑ Si el proceso del servidor ya no existe, se murió al arrancar: no tiene sentido
  #   esperar 90 segundos a algo que ya no está. El error real quedó impreso arriba.
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    printf 'El servidor terminó antes de quedar disponible. Revisa el error anterior.\n' >&2
    exit 1
  fi
  sleep 1
done

# ↑ Agotamos los 90 intentos sin que la API respondiera: algo anda mal (firewall, el
#   puerto lo ocupa otra cosa, un arranque lentísimo). Avisamos por stderr y salimos
#   con error para que un script que lo llame sepa que no se prepare para usar el server.
if [[ "$ready" != true ]]; then
  printf 'El servidor no respondió a tiempo en %s.\n' "$APP_URL" >&2
  exit 1
fi

printf 'Servidor listo. El historial y los estados se guardan en archivos JSON dentro de data/.\n'
open_browser
printf 'La página está abierta. Pulsa Ctrl+C para detener el servidor.\n'
# ↑ El último wait deja el script "colgado" en primer plano mientras el servidor trabaja:
#   el navegador queda usable y el log del server se ve en esta misma terminal.
#   Cuando el usuario apaga el servidor, wait vuelve y el script termina solo.
wait "$SERVER_PID"