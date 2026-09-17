#!/usr/bin/env bash
# Sobe tudo que o backend precisa: Docker (Postgres) + API em modo dev.
# Uso: ./start.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "== Linker backend =="

# 1. .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "-> .env criado a partir de .env.example (ajuste as credenciais se precisar)."
fi

# 2. Docker daemon
if ! docker info >/dev/null 2>&1; then
  echo "-> Docker não está rodando."
  if [[ "$(uname -s)" == "Darwin" ]]; then
    echo "-> Abrindo o Docker Desktop..."
    open -a Docker
    for _ in $(seq 1 60); do
      docker info >/dev/null 2>&1 && break
      sleep 2
    done
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "ERRO: não consegui conectar ao Docker. Abra o Docker Desktop (ou inicie o daemon) e rode ./start.sh de novo." >&2
    exit 1
  fi
fi

# 3. Postgres via docker compose
echo "-> Subindo o Postgres (docker compose up -d db)..."
if ! docker compose up -d db; then
  echo "ERRO: falha ao subir o Postgres. Se a porta 5432 já estiver em uso por outro" >&2
  echo "serviço (docker ps --filter publish=5432), pare-o ou remapeie a porta localmente." >&2
  exit 1
fi

echo "-> Aguardando o Postgres ficar saudável..."
db_status=""
for _ in $(seq 1 30); do
  cid="$(docker compose ps -q db)"
  db_status="$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo "")"
  [ "$db_status" = "healthy" ] && break
  sleep 2
done
if [ "$db_status" != "healthy" ]; then
  echo "ERRO: Postgres não ficou saudável a tempo. Veja: docker compose logs db" >&2
  exit 1
fi
echo "-> Postgres pronto."

# 4. Dependências Node
if [ ! -d node_modules ]; then
  echo "-> Instalando dependências (npm install)..."
  npm install
fi

# 5. API
echo "-> Subindo a API (npm run dev)..."
exec npm run dev
