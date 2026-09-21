#!/usr/bin/env bash
# R2Flow одной командой: локальный Cloud (если есть код) + Designer :8756.
# Использование: ./start-r2flow.sh [flow.json]
#   NO_CLOUD=1 ./start-r2flow.sh   — только дизайнер
#   R2FLOW_CLOUD_DIR=/path/to/r2flow-cloud ./start-r2flow.sh — Cloud из соседнего checkout.
# Кнопка Publish работает против любого внешнего Cloud: URL вводится в диалоге публикации.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLOUD_DIR="$ROOT_DIR/packages/cloud"
if [ ! -f "$CLOUD_DIR/docker-compose.yml" ] && [ -n "${R2FLOW_CLOUD_DIR:-}" ]; then
  CLOUD_DIR="$R2FLOW_CLOUD_DIR"
fi
DESIGNER_DIR="$ROOT_DIR/packages/designer"
FLOW="${1:-flow.json}"
CLOUD_PORT="${CLOUD_PORT:-8000}"
DESIGNER_PORT="${DESIGNER_PORT:-8756}"

wait_port() { # host port tries
  for _ in $(seq 1 "$3"); do
    (echo > /dev/tcp/"$1"/"$2") >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

[ -f "$DESIGNER_DIR/designer-web/dist/index.html" ] \
  || echo "WARN: нет designer-web/dist — собери: cd packages/designer/designer-web && npm install && npm run build"

CLOUD_PID=""
cleanup() {
  [ -n "$CLOUD_PID" ] && kill "$CLOUD_PID" 2>/dev/null || true
  echo "Готово. Postgres-контейнер оставлен (данные целы)."
}
trap cleanup EXIT INT TERM

if [ ! -f "$CLOUD_DIR/docker-compose.yml" ]; then
  echo "Локального кода R2Flow Cloud нет (он приватный) — запускаю только дизайнер."
  NO_CLOUD=1
fi

if [ "${NO_CLOUD:-0}" != "1" ]; then
  echo "→ postgres (docker)..."
  docker compose -f "$CLOUD_DIR/docker-compose.yml" up -d postgres
  wait_port 127.0.0.1 5432 30 || { echo "Postgres не поднялся"; exit 1; }
  if (echo > /dev/tcp/127.0.0.1/$CLOUD_PORT) >/dev/null 2>&1; then
    if curl -sf --max-time 5 "http://127.0.0.1:$CLOUD_PORT/health" >/dev/null; then
      echo "→ :$CLOUD_PORT уже запущен и отвечает."
    else
      echo "ОШИБКА: порт :$CLOUD_PORT занят, но это НЕ R2Flow Cloud (/health не отвечает)."
      echo "Найди процесс (lsof -i :$CLOUD_PORT) и убей его, затем запусти снова."
      exit 1
    fi
  else
    echo "→ R2Flow Cloud :$CLOUD_PORT ..."
      (cd "$CLOUD_DIR" && \
        DEV_CREATE_TABLES=true AUTH_ENABLED=false \
        CORS_ORIGINS='["http://127.0.0.1:8756", "http://localhost:8756"]' \
        EMBEDDING_ALLOWED_ORIGINS='["http://127.0.0.1:8756", "http://localhost:8756"]' \
        python3 -m uvicorn r2flow_cloud.main:app --host 127.0.0.1 --port "$CLOUD_PORT" &)
    CLOUD_PID=$!
    wait_port 127.0.0.1 "$CLOUD_PORT" 40 || { echo "R2Flow Cloud не ответил"; exit 1; }
    echo "→ R2Flow Cloud OK http://127.0.0.1:$CLOUD_PORT"
  fi
fi

echo "→ R2Flow Designer :$DESIGNER_PORT ..."
echo ""
echo "  Открой http://127.0.0.1:$DESIGNER_PORT"
echo ""
python3 -m r2flow_designer "$FLOW" --port "$DESIGNER_PORT"
