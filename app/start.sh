#!/bin/bash
# Local dev launcher for ResQKit. No network calls, no external platform -
# just starts the backend (FastAPI/uvicorn) and frontend (Vite) against the
# .env files in app/backend and app/frontend.
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

cleanup() {
  echo "Stopping ResQKit..."
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting ResQKit backend..."
cd "$BACKEND_DIR"
set -a
[ -f .env ] && source .env
set +a
.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo "Starting ResQKit frontend..."
cd "$FRONTEND_DIR"
npm run dev -- --host 127.0.0.1 --port 5173 &
FRONTEND_PID=$!

echo "Backend:  http://127.0.0.1:8000"
echo "Frontend: http://127.0.0.1:5173"
wait
