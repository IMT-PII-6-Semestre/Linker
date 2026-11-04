# Linker — backend

Linker é uma rede social que une o modelo de vagas/candidatos do LinkedIn com o
match bilateral por swipe do Tinder: candidatos e empresas só entram em contato
quando há interesse dos dois lados. Projeto Integrador Interdisciplinar (PII) do
3º ano de Ciência da Computação — IMT.

Este repositório é a **API REST**. O app (Expo/React Native) fica no
`Linker-front-rn`.

Stack: **Node.js 22 + Express 4 + TypeScript**, **PostgreSQL 16** (Docker),
validação com **Zod**, senha com **bcrypt**, autenticação com **JWT**.

- [Rodando](#rodando)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Endpoints](#endpoints)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Como uma requisição percorre o código](#como-uma-requisição-percorre-o-código)
- [Como adicionar um endpoint](#como-adicionar-um-endpoint)
- [Banco de dados](#banco-de-dados)
- [Convenções](#convenções)
- [Development Container](#development-container)
- [Estado atual](#estado-atual)

## Rodando

Pré-requisitos: **Docker** (Docker Desktop no macOS/Windows) e **Node.js ≥ 22** (o `npm test` usa glob no `node --test`, que não existe no 20).

> **Windows:** use `.\start.cmd` no lugar do `./start.sh`. O guia completo, com
> pré-requisitos, comandos em PowerShell e problemas comuns, está em
> **[README.windows.md](README.windows.md)**.

```bash
./start.sh
```

O script faz tudo na ordem:

1. cria `.env` a partir de `.env.example`, se ainda não existir;
2. abre o Docker Desktop, se o daemon estiver parado (no macOS);
3. sobe o Postgres (`docker compose up -d db`) e espera ele ficar saudável;
4. roda `npm install` se ainda não houver `node_modules`;
5. inicia a API em modo dev (`npm run dev`), que reinicia sozinha a cada
   arquivo salvo.

A API fica em `http://localhost:3000`. **Ctrl+C** encerra a API, mas o Postgres
continua rodando (`docker compose down` para parar).

Passo a passo manual (equivale ao `start.sh`):

```bash
cp .env.example .env
npm install
docker compose up -d db
npm run dev
```

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | API em modo watch (`tsx`, sem build) |
| `npm run typecheck` | checa os tipos (`tsc --noEmit`). Rode antes de commitar |
| `npm run build` | compila para `dist/` |
| `npm start` | roda o que está em `dist/` (precisa de `build` antes) |
| `npm test` | roda os testes (`node:test` + `tsx`): unitários e de integração |
| `npm run db:reset` | recria o banco do zero com schema e seed (**apaga os dados locais**) |

Os testes de integração sobem a API numa porta livre e usam o Postgres do
`DATABASE_URL`, com as contas do seed. Suba o banco antes (`docker compose up -d db`).
Eles nunca chamam a API de CEP de verdade (ver `src/test-helpers.ts`).

## Variáveis de ambiente

Ficam em `.env`, que é ignorado pelo git. O modelo é o `.env.example`.

| Variável | Uso | Padrão |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | credenciais do container do Postgres | `linker` |
| `DATABASE_URL` | conexão que a API usa — **obrigatória** | `postgres://linker:linker@localhost:5432/linker` |
| `PORT` | porta da API | `3000` |
| `JWT_SECRET` | segredo que assina os tokens — **obrigatório** | troque fora do ambiente local |
| `JWT_EXPIRES_IN` | validade do token (`7d`, `12h`...) | `7d` |

Se faltar uma variável obrigatória, a API não sobe e mostra
`Variável de ambiente ausente: ...` (validação em `src/config/env.ts`).

## Endpoints

Todas as rotas ficam sob `/api`. O corpo das requisições e das respostas é JSON.

| Método | Rota | Quem | Corpo / query | Resposta |
|---|---|---|---|---|
| `POST` | `/api/auth/cadastro/candidato` | — | `CandidatoSignUp` do front | `201` `{ usuario, token }` |
| `POST` | `/api/auth/cadastro/empresa` | — | `EmpresaSignUp` do front (com a primeira `vaga`) | `201` `{ usuario, token }` |
| `POST` | `/api/auth/login` | — | `email`, `senha`, `origin` (`web` \| `mobile`) | `200` `{ usuario, token }` |
| `GET` | `/api/auth/me` | logado | — | `200` `{ usuario }` |
| `GET` | `/api/perfil` | candidato, empresa | — | `200` `Profile` do front; empresa inclui `vagas[]` |
| `PUT` | `/api/perfil` | candidato, empresa | campos do cadastro, sem senha | `200` `Profile` |
| `PUT` | `/api/perfil/foto` | candidato, empresa | imagem crua (`Content-Type: image/*`, até 5 MB) | `200` `Profile`; a foto fica em `/uploads/...` |
| `POST` | `/api/vagas` | empresa | `VagaInfo` do front | `201` vaga criada |
| `PUT` | `/api/vagas/:id` | empresa dona | `VagaInfo` do front | `200` vaga editada |
| `DELETE` | `/api/vagas/:id` | empresa dona | — | `204` |
| `GET` | `/api/feed` | candidato, empresa | `?query=&uf=&vagaId=` | `200` `FeedPost[]` do front, ordenado por score |
| `POST` | `/api/swipe` | candidato, empresa | `{ postId, direction: 'like' \| 'pass', vagaId }` | `200` `{ matched, matchId }` |
| `GET` | `/api/conversas` | candidato, empresa | — | `200` `Conversation[]` do front, mais recentes primeiro, com `lastMessage` e `unreadCount` |
| `GET` | `/api/conversas/:id` | participante | — | `200` `Conversation` (com o `post` que gerou o match) |
| `GET` | `/api/conversas/:id/mensagens` | participante | — | `200` `Message[]` em ordem cronológica; marca como lidas |
| `POST` | `/api/conversas/:id/mensagens` | participante | `{ text }` (1 a 1000 caracteres) | `201` `Message` |
| `DELETE` | `/api/conversas/:id` | participante | — | `204` desfaz o match (some chat e mensagens) |
| `POST` | `/api/conversas/:id/bloqueio` | participante | — | `204` bloqueia o outro lado e desfaz o match |
| `POST` | `/api/conversas/:id/denuncia` | participante | `{ reason, details }` (`reason` = `REPORT_REASONS` do front) | `204` |
| `GET` | `/api/admin/snapshot` | admin | — | `200` `PlatformSnapshot` do front (dados brutos; o front calcula as métricas com `computeMetrics`) |

- **Login por origem:** `admin` só entra pelo `web`; `candidato` e `empresa` só pelo
  `mobile`. Origem errada → `403`.
- **Perfil e vagas:** o CEP é geocodificado ao salvar (AwesomeAPI CEP), gravando
  cidade, UF e coordenadas. Se a API estiver fora, salva só o CEP; o cadastro nunca
  falha por isso. Editar a vaga de outra empresa → `403`.
- **Feed:** o candidato vê vagas; a empresa vê candidatos para uma `vagaId` dela
  (sem `vagaId`, o feed vem vazio; vaga de outra empresa → `403`). Pares
  incompatíveis (modalidade, tipo de contrato, Jovem Aprendiz fora de 14–24 anos),
  já decididos por quem está vendo ou bloqueados não aparecem. Cada item exibido é
  registrado em `exibicao`. O score segue o algoritmo de match (`src/match/`).
- **Swipe:** `postId` é a vaga (candidato) ou o candidato (empresa, que manda também
  a `vagaId`). A primeira decisão de cada lado vale. Like dos dois lados cria o
  `match` e o `chat`; `matchId` é o id da conversa.
- **Chat:** o `:id` é o id do match (o mesmo `matchId` do swipe). Quem não participa da
  conversa recebe `404`, igual a uma conversa que não existe. Denunciar não encerra a
  conversa; bloquear e desfazer apagam o match. Sem websocket: o front usa polling.
- **Snapshot do admin:** `curtidas` são os swipes `like` dos dois lados e `matches` os matches
  existentes (match desfeito ou bloqueado sai do total e dos gráficos). Cadastros novos contam
  candidatos e empresas. `matchesPorSemana` traz as últimas 8 semanas (começam na segunda),
  da mais antiga para a atual, com 0 nas semanas sem match.

O corpo dos cadastros é o mesmo payload que o front monta em
`Linker-front-rn/src/features/auth/domain/registration.ts` (`toCandidatoSignUp` /
`toEmpresaSignUp`) — pode mandar como está, com máscaras.

Regras de validação (`src/schemas/auth.schema.ts`):

- a senha tem de **6 a 72** caracteres (o mínimo acompanha o front);
- CPF, CNPJ, CEP, celular e telefone podem vir **com ou sem máscara**; o back
  guarda só os dígitos e confere os dígitos verificadores de CPF/CNPJ;
- datas vêm como `dd/mm/aaaa` e viram `DATE`. Nascimento exige 14 a 100 anos;
  fundação não pode estar no futuro;
- escolaridade, tipo de contrato, modalidade e faixa salarial só aceitam os
  rótulos dos chips do front (listas no topo do schema);
- o e-mail é normalizado (sem espaços nas pontas, tudo minúsculo).

Exemplos:

```bash
curl -X POST localhost:3000/api/auth/cadastro/candidato \
  -H 'Content-Type: application/json' \
  -d '{"nomeCompleto":"Ana Souza","cpf":"529.982.247-25","dataNascimento":"15/03/2000",
       "email":"ana@email.com","celular":"(11) 98765-4321","escolaridade":"Superior completo",
       "cargoDesejado":"Dev Front","formacao":"CC - IMT","cep":"09580-900",
       "tiposContrato":["CLT"],"experiencias":"Primeiro emprego","anosExperiencia":0,"faixaSalarial":"A combinar",
       "hardSkills":["React"],"softSkills":["Comunicação"],"modalidades":["Remoto"],"senha":"123456"}'

curl -X POST localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@email.com","senha":"123456","origin":"mobile"}'
```

O token é um JWT: `sub` é o id do usuário, `tipo` é `candidato`, `empresa` ou
`admin`, e `aud` diz a origem (`app` para o mobile, `contratador` para o web).
Token sem `aud` é recusado com `401`.
Rotas protegidas recebem o token no cabeçalho
`Authorization: Bearer <token>`.

### Formato de erro

Todo erro volta como `{ "erro": "mensagem" }`, com o status HTTP correspondente:

| Status | Quando |
|---|---|
| `400` | corpo inválido. Nesse caso a resposta também traz `detalhes`, com os problemas que o Zod encontrou |
| `401` | login errado, token ausente, inválido ou expirado |
| `403` | logado, mas sem permissão |
| `404` | recurso não existe |
| `409` | conflito, como e-mail já cadastrado |
| `500` | erro inesperado. O detalhe só aparece no log do servidor |

## Estrutura de pastas

```
.
├── start.sh                # sobe tudo (Docker + Postgres + API) — macOS/Linux
├── start.cmd / start.ps1   # o mesmo no Windows (ver README.windows.md)
├── docker-compose.yml      # Postgres 16 para desenvolvimento
├── db/init/                # schema (01-, 02-, ...) e seed (99-); rodam na 1ª subida do banco
├── docs/modelagem-dados.md # modelagem: fonte da verdade do schema
├── uploads/                # fotos de perfil (disco local, fora do git)
├── .env.example            # modelo do .env
├── .devcontainer/          # ambiente padronizado (VS Code / Codespaces)
└── src/
    ├── server.ts           # ponto de entrada: sobe o servidor na porta
    ├── app.ts              # monta o Express: JSON, rotas, middleware de erro
    ├── config/env.ts       # lê e valida as variáveis de ambiente
    ├── db/pool.ts          # pool de conexões + helper emTransacao()
    ├── routes/             # URL + método → controller
    ├── controllers/        # HTTP: valida a entrada e devolve o status
    ├── schemas/            # schemas Zod do que chega no corpo da requisição
    ├── services/           # regra de negócio (hash, token, transações)
    ├── repositories/       # SQL — único lugar que fala com o banco
    ├── middlewares/        # autenticar (JWT), assincrono, tratarErro
    ├── errors/app-error.ts # AppError + atalhos (invalido, naoAutorizado, ...)
    ├── match/              # algoritmo de match puro: features, score, ε-greedy
    ├── types/              # tipos de domínio + extensão do Request do Express
    └── *.test.ts           # testes (node:test); helpers em test-helpers.ts
```

O que fica em cada camada (e o que **não** fica):

- **routes**: só declaram `router.<método>(caminho, assincrono(controller))`,
  sem nenhuma lógica.
- **controllers**: fazem `schema.parse(req.body)`, chamam o service e escrevem
  `res.status(...).json(...)`. Não têm SQL nem regra de negócio.
- **services**: concentram as regras: criptografar a senha, gerar token,
  decidir se algo é permitido, abrir transação. Não conhecem `req`/`res` e lançam
  `AppError` quando algo dá errado.
- **repositories**: um arquivo por tabela, uma função por consulta. É **o único
  lugar** com SQL e o único que converte `snake_case` → `camelCase`.
- **middlewares**:
  - `autenticar` lê o `Bearer`, confere o `aud` e preenche `req.usuario = { id, tipo }`;
  - `exigirTipo(...tipos)` barra com `403` quem não é de um dos tipos;
  - `assincrono` envolve cada controller para que um erro async chegue ao
    `tratarErro` (o Express 4 não faz isso sozinho);
  - `tratarErro` transforma qualquer erro na resposta JSON padrão.

## Como uma requisição percorre o código

`POST /api/auth/cadastro/empresa`:

1. `app.ts` faz o parse do JSON e entrega para `routes/auth.routes.ts`;
2. `controllers/auth.controller.ts` valida o corpo com `cadastroEmpresaSchema`.
   Se estiver inválido, o `ZodError` cai no `tratarErro`, que responde `400`;
3. `services/auth.service.ts` gera o hash da senha e abre uma transação com
   `emTransacao`;
4. dentro da transação, `usuario.repository` insere em `usuario` e
   `empresa.repository` insere em `empresa` e `vaga.repository` grava a primeira
   vaga. Se um dos três falhar, nenhum é gravado;
5. se o e-mail já existir (violação do índice único `23505`), a resposta é
   `409`. Se der tudo certo, o service devolve `{ usuario, token }` e o
   controller responde `201`.

## Como adicionar um endpoint

Exemplo: `GET /api/vagas/:id`.

1. **Repository**: `src/repositories/vaga.repository.ts`
   ```ts
   export async function buscarPorId(id: number) {
     const { rows } = await pool.query('SELECT id, empresa_id, cargo FROM vaga WHERE id = $1', [id]);
     return rows[0] ? paraVaga(rows[0]) : null;   // converte snake_case → camelCase
   }
   ```
   Use sempre parâmetros `$1, $2...` e **nunca** concatene valores no SQL. Se a
   função precisa rodar dentro de uma transação, ela recebe o `cliente`, como em
   `inserirUsuario`.
2. **Service**: `src/services/vaga.service.ts`
   ```ts
   export async function obter(id: number) {
     const vaga = await vagas.buscarPorId(id);
     if (!vaga) throw naoEncontrado('Vaga não encontrada');
     return vaga;
   }
   ```
3. **Schema** (se recebe corpo, params ou query): `src/schemas/vaga.schema.ts`
   com Zod. Para `:id`, use `z.coerce.number().int().positive()`.
4. **Controller**: `src/controllers/vaga.controller.ts`
   ```ts
   export const obter: RequestHandler = async (req, res) => {
     const id = idSchema.parse(req.params.id);
     res.json(await servico.obter(id));
   };
   ```
5. **Rota**: `src/routes/vaga.routes.ts`
   ```ts
   router.get('/vagas/:id', autenticar, exigirTipo('candidato', 'empresa'), assincrono(controller.obter));
   ```
   Coloque o `autenticar` antes do controller quando a rota precisar de login, e
   o `exigirTipo` quando só alguns tipos de usuário podem usá-la.
   Dentro do controller, quem está logado fica em `req.usuario!.id`.
6. **Registrar** em `src/app.ts`: `app.use('/api', vagaRoutes);`. O registro tem
   de vir **antes** do `app.use(tratarErro)`.
7. Escreva o teste de integração (veja `src/perfil.test.ts`) e rode
   `npm run typecheck && npm test`.

## Banco de dados

`docker-compose.yml` sobe só o Postgres 16, na porta `5432`.

- O schema está em `db/init/`, em arquivos numerados que rodam em ordem
  (`01-schema.sql`, `02-admin.sql`, `03-localizacao.sql`, `04-match.sql`, `05-chat.sql`), e o
  `99-seed.sql` grava os dados de teste. Eles rodam **apenas na primeira
  subida**, porque o `docker-entrypoint-initdb.d` só executa quando o volume está
  vazio. Mudou o schema? Recrie o banco (isto **apaga os dados**):
  ```bash
  npm run db:reset
  ```
- Os dados ficam no volume `pgdata`. `docker compose down` (sem `-v`) para o
  container e mantém os dados.
- Para abrir um terminal SQL: `docker compose exec db psql -U linker`.
- Se a porta 5432 estiver ocupada (outro Postgres rodando), pare o outro serviço
  ou troque o mapeamento no compose.

Tabelas:

| Tabela | O que guarda |
|---|---|
| `usuario` | base de todo usuário: `tipo` (`candidato`/`empresa`/`admin`), nome, e-mail único, hash da senha, CPF/CNPJ, telefone, foto |
| `perfil_candidato` | extensão 1:1 do candidato: nascimento, CEP (com cidade, UF e coordenadas), escolaridade, cargo desejado, formação, experiências e anos de experiência, contratos, modalidades, faixa salarial, skills |
| `empresa` | extensão 1:1 da empresa: data de fundação, endereço |
| `vaga` | vagas de uma empresa (1:N): cargo, descrição, benefícios, horário, CEP (com cidade, UF e coordenadas), skills obrigatórias e desejáveis, experiência mínima, escolaridade, contrato, modalidade, faixa salarial |
| `swipe` | cada like/pass sobre um par candidato–vaga; `autor` diz se quem decidiu foi o candidato ou a empresa (que avalia em nome de uma vaga). Uma decisão por lado, por par |
| `match` | like recíproco: candidato + vaga + empresa |
| `chat` / `mensagem` | um chat por match, com N mensagens (`lida_em` marca a leitura) |
| `bloqueio` | quem bloqueou quem; o feed esconde o par nos dois sentidos |
| `denuncia` | denúncias de um lado contra o outro, com motivo e detalhes; sobrevivem ao fim do match |
| `config_pesos` | pesos do score, versionados; só uma versão ativa (a v1 vem no `04-match.sql`) |
| `exibicao` | log de cada item exibido no feed: features, scores, posição, se veio da exploração e versão dos pesos |

Contas do seed (senha `123456`): `admin@linker.com` (admin, entra pelo `web`),
`ana@email.com` e `bruno@email.com` (candidatos), `rh@empresa.com` e
`rh@empresabeta.com` (empresas).

Por enquanto não existem migrations. Toda mudança de schema entra num arquivo
novo numerado em `db/init/` (sem editar os antigos) e também em
`docs/modelagem-dados.md`. Depois de puxar a mudança, cada pessoa roda
`npm run db:reset`.

## Convenções

- **Português** nos nomes de domínio (`usuario`, `cadastrarEmpresa`,
  `naoEncontrado`). As palavras técnicas do Express/Node ficam como são
  (`router`, `pool`, `req`).
- **Imports com `.js`**, mesmo em arquivos `.ts` (`'../db/pool.js'`). O projeto
  usa ESM, que exige a extensão.
- **`camelCase` no código e na API, `snake_case` no banco.** A conversão
  acontece só nos repositories.
- **Erros esperados** viram um `throw` dos atalhos de `errors/app-error.ts`.
  Nunca responda erro direto do service.
- **Escrita em mais de uma tabela** vai dentro de `emTransacao`.
- **O hash de senha** só sai do banco pela `buscarCredencialPorEmail`. Nenhuma
  resposta pode incluir `senha_hash`.
- **Nada de segredo no git.** O `.env` já está no `.gitignore`.

## Development Container

`.devcontainer/` dá a todo mundo o mesmo ambiente Linux, seja o host Windows,
macOS ou Linux:

- Node.js 22 LTS (o projeto exige `>=22`);
- Docker dentro do container, para o `docker compose`;
- portas `3000` e `5432` encaminhadas automaticamente;
- dependências instaladas na criação do container (`npm ci` com lock, senão
  `npm install`).

**VS Code:** instale o Docker e a extensão **Dev Containers** e rode
**Dev Containers: Reopen in Container**. Depois que mudar a configuração, rode
**Rebuild Container**.

**CLI:**

```bash
npm install -g @devcontainers/cli
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . bash
```

Também funciona no **GitHub Codespaces**. Dentro do container, rode `./start.sh`.

## Estado atual

Pronto:

- cadastro de candidato e de empresa, login com JWT, origem (`web`/`mobile`) e
  papel `admin` (conta só pelo seed);
- perfil (ler, editar, foto) e CRUD de vagas, com geocodificação do CEP;
- feed com o algoritmo de match (filtros, score, exploração ε-greedy e log em
  `exibicao`) e swipe com match transacional;
- chat: conversas, mensagens com não lidas, desfazer match, bloquear e denunciar;
- admin: `GET /api/admin/snapshot` com as agregações do painel;
- testes automatizados (`npm test`).

Falta (o front já tem as telas, usando dados fake):

- **Validação do algoritmo:** script que recalibra os pesos a partir dos swipes.
