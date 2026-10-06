# Linker

Linker é uma rede social que une o modelo de vagas/candidatos do LinkedIn com o
match bilateral por swipe do Tinder: candidatos e empresas só entram em contato
quando há interesse dos dois lados. Projeto Integrador Interdisciplinar (PII) do
3º ano de Ciência da Computação — IMT.

Stack: **Node.js 20 + Express + TypeScript** na aplicação e **PostgreSQL** como banco.

## Rodando tudo com um comando

```bash
./start.sh
```

Sobe o Docker (se preciso), o Postgres via `docker compose` e a API em modo dev
(`npm run dev`), nessa ordem — cria `.env` a partir de `.env.example` e instala
as dependências Node na primeira vez. Ctrl+C encerra a API; o Postgres continua
rodando (`docker compose down` para parar).

## Development Container

O repositório inclui uma configuração de Dev Container em `.devcontainer/`, que
dá a todo mundo o mesmo ambiente Linux, seja o host Windows, macOS ou Linux:

- imagem `javascript-node` com **Node.js 22 LTS** (o `package.json` exige `>=20`);
- Docker disponível dentro do container (para subir o Postgres com
  `docker compose`);
- portas `3000` (app) e `5432` (Postgres) encaminhadas automaticamente;
- dependências instaladas ao criar o container: `npm ci` quando há
  `package-lock.json` (commite o lock para todos terem as mesmas versões),
  senão `npm install`.

Mudou a configuração do container? Rode **Dev Containers: Rebuild Container**.

### Abrindo no VS Code

1. Instale o Docker e a extensão **Dev Containers**.
2. Abra o repositório no VS Code.
3. Rode **Dev Containers: Reopen in Container**.

### Abrindo pela CLI (sem VS Code)

```bash
npm install -g @devcontainers/cli
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . bash
```

Também funciona em **GitHub Codespaces** sem configuração adicional.

### Depois de entrar no container

```bash
npm install            # dependências da aplicação
docker compose up -d db # sobe o PostgreSQL
npm run dev             # inicia a API (tsx watch)
```

Ou simplesmente `./start.sh`, que faz os três passos acima.

## Banco de dados (PostgreSQL)

`docker-compose.yml` sobe só o Postgres para desenvolvimento:

```bash
cp .env.example .env    # ajuste as credenciais se quiser
docker compose up -d db
docker compose exec db pg_isready -U linker
```

- Dados persistem no volume nomeado `pgdata` (`docker compose down -v` para
  descartar e recomeçar do zero).
- O schema inicial (`db/init/01-schema.sql`, espelho do esboço de DDL em
  `.claude/models/modelagem-dados.md`) roda automaticamente na **primeira**
  subida — o `docker-entrypoint-initdb.d` só executa quando o volume de dados
  está vazio. Mudou o SQL depois de já ter subido o banco? `docker compose down -v`
  e suba de novo.
- `docker compose down` (sem `-v`) para parar preservando os dados.
