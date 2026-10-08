# Linker — backend

Linker é uma rede social que une o modelo de vagas/candidatos do LinkedIn com o
match bilateral por swipe do Tinder: candidatos e empresas só entram em contato
quando há interesse dos dois lados. Projeto Integrador Interdisciplinar (PII) do
3º ano de Ciência da Computação — IMT.

Este repositório é a **API REST**. O app (Expo/React Native) fica no
`Linker-front-rn`.

Stack: **Node.js 20 + Express 4 + TypeScript**, **PostgreSQL 16** (Docker),
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

Pré-requisitos: **Docker** (Docker Desktop no macOS/Windows) e **Node.js ≥ 20**.

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

Ainda não existe suíte de testes.

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

| Método | Rota | Auth | Corpo | Resposta |
|---|---|---|---|---|
| `POST` | `/api/auth/cadastro/candidato` | — | `nomeCompleto`, `email`, `senha`, `cpf`, `idade?`, `cep?` | `201` `{ usuario, token }` |
| `POST` | `/api/auth/cadastro/empresa` | — | `nomeCompleto`, `email`, `senha`, `cnpj`, `razaoSocial`, `anosFundacao?`, `cep?` | `201` `{ usuario, token }` |
| `POST` | `/api/auth/login` | — | `email`, `senha` | `200` `{ token }` |

Regras de validação (`src/schemas/auth.schema.ts`):

- a senha tem de **8 a 72** caracteres;
- CPF, CNPJ e CEP vão **só com dígitos** (11, 14 e 8 dígitos);
- o e-mail é normalizado (sem espaços nas pontas, tudo minúsculo).

Exemplos:

```bash
curl -X POST localhost:3000/api/auth/cadastro/candidato \
  -H 'Content-Type: application/json' \
  -d '{"nomeCompleto":"Ana Souza","email":"ana@email.com","senha":"12345678","cpf":"12345678901"}'

curl -X POST localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@email.com","senha":"12345678"}'
```

O token é um JWT: `sub` é o id do usuário e `tipo` é `candidato` ou `empresa`.
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
├── start.sh                # sobe tudo (Docker + Postgres + API)
├── docker-compose.yml      # Postgres 16 para desenvolvimento
├── db/init/01-schema.sql   # schema; roda na 1ª subida do banco
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
    └── types/              # tipos de domínio + extensão do Request do Express
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
  - `autenticar` lê o `Bearer` e preenche `req.usuario = { id, tipo }`;
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
   `empresa.repository` insere em `empresa`. Se um dos dois falhar, nenhum é
   gravado;
5. se o e-mail já existir (violação do índice único `23505`), a resposta é
   `409`. Se der tudo certo, o service devolve `{ usuario, token }` e o
   controller responde `201`.

## Como adicionar um endpoint

Exemplo: `GET /api/vagas/:id`.

1. **Repository**: `src/repositories/vaga.repository.ts`
   ```ts
   export async function buscarPorId(id: number) {
     const { rows } = await pool.query('SELECT * FROM vaga WHERE id = $1', [id]);
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
   router.get('/vagas/:id', autenticar, assincrono(controller.obter));
   ```
   Coloque o `autenticar` antes do controller quando a rota precisar de login.
   Dentro do controller, quem está logado fica em `req.usuario!.id`.
6. **Registrar** em `src/app.ts`: `app.use('/api', vagaRoutes);`. O registro tem
   de vir **antes** do `app.use(tratarErro)`.
7. Rode `npm run typecheck` e teste com `curl`.

## Banco de dados

`docker-compose.yml` sobe só o Postgres 16, na porta `5432`.

- O schema está em `db/init/01-schema.sql`. Ele roda **apenas na primeira
  subida**, porque o `docker-entrypoint-initdb.d` só executa quando o volume está
  vazio. Alterou o SQL? Recrie o banco (isto **apaga os dados**):
  ```bash
  docker compose down -v && docker compose up -d db
  ```
- Os dados ficam no volume `pgdata`. `docker compose down` (sem `-v`) para o
  container e mantém os dados.
- Para abrir um terminal SQL: `docker compose exec db psql -U linker`.
- Se a porta 5432 estiver ocupada (outro Postgres rodando), pare o outro serviço
  ou troque o mapeamento no compose.

Tabelas:

| Tabela | O que guarda |
|---|---|
| `usuario` | base de todo usuário: `tipo` (`candidato`/`empresa`), nome, e-mail único, hash da senha, CPF/CNPJ |
| `perfil_candidato` | extensão 1:1 do candidato: experiência, formação, projetos, skills |
| `empresa` | extensão 1:1 da empresa: CNPJ, razão social, ano de fundação |
| `vaga` | vagas de uma empresa (1:N) |
| `swipe` | cada like/dislike. `alvo_tipo` + `alvo_id` apontam para uma vaga ou um candidato. Só pode haver uma decisão por par |
| `match` | like recíproco: candidato + vaga + empresa |
| `chat` / `mensagem` | um chat por match, com N mensagens |

Por enquanto não existem migrations. Toda mudança de schema vai no
`01-schema.sql`, e cada pessoa recria o banco local depois de puxar a mudança.

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

- Node.js 22 LTS (o projeto exige `>=20`);
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

- cadastro de candidato e de empresa;
- login com JWT;
- middleware de autenticação (ainda não usado por nenhuma rota).

Falta (o front já tem as telas, usando dados fake):

- **Perfil:** ler e editar o perfil, foto, CRUD de vagas;
- **Feed:** listar vagas ou candidatos não avaliados, com filtro, e o swipe que
  gera match quando o like é recíproco;
- **Chat:** conversas, mensagens, desfazer match, bloquear, denunciar;
- **Admin:** papel `admin` e endpoint de métricas;
- **Alinhar o cadastro com o front:** o front coleta mais campos (data de
  nascimento, celular, escolaridade, modalidades, faixa salarial...) do que o
  schema atual aceita;
- testes automatizados.
