#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3000}"
APP_URL="http://127.0.0.1:${PORT}"
SERVER_PID=""

cd "$ROOT_DIR"

for command_name in node npm curl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Falta el comando requerido: %s\n' "$command_name" >&2
    exit 1
  fi
done

open_browser() {
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
      cmd.exe /c start "" "$APP_URL" >/dev/null 2>&1 || true
      ;;
    Linux*)
      if grep -qi microsoft /proc/version 2>/dev/null; then
        cmd.exe /c start "" "$APP_URL" >/dev/null 2>&1 || true
      elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$APP_URL" >/dev/null 2>&1 || true
      else
        printf 'Abre esta dirección en tu navegador: %s\n' "$APP_URL"
      fi
      ;;
    Darwin*)
      open "$APP_URL" >/dev/null 2>&1 || true
      ;;
    *)
      printf 'Abre esta dirección en tu navegador: %s\n' "$APP_URL"
      ;;
  esac
}

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    printf '\nCerrando el servidor local...\n'
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if curl -fsS "$APP_URL/api/profile" >/dev/null 2>&1 && curl -fsS "$APP_URL/" >/dev/null 2>&1; then
  printf 'La API y la página ya están activas en %s\n' "$APP_URL"
  open_browser
  exit 0
fi

printf 'Compilando la página...\n'
npm run build

printf 'Iniciando servidor y API en %s...\n' "$APP_URL"
PORT="$PORT" node server/index.js &
SERVER_PID="$!"

ready=false
for ((attempt = 0; attempt < 90; attempt++)); do
  if curl -fsS "$APP_URL/api/profile" >/dev/null 2>&1 && curl -fsS "$APP_URL/" >/dev/null 2>&1; then
    ready=true
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    printf 'El servidor terminó antes de quedar disponible. Revisa el error anterior.\n' >&2
    exit 1
  fi
  sleep 1
done

if [[ "$ready" != true ]]; then
  printf 'El servidor no respondió a tiempo en %s.\n' "$APP_URL" >&2
  exit 1
fi

printf 'Servidor listo. El historial y los estados se guardan en archivos JSON dentro de data/.\n'
open_browser
printf 'La página está abierta. Pulsa Ctrl+C para detener el servidor.\n'
wait "$SERVER_PID"