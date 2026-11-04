# Linker — Modelagem de dados (MVP)

> Documento de referência derivado do rascunho `linker-modelagem-dados.html`.
> Alvo primário: **PostgreSQL**. A mesma modelagem se adapta a **Firestore**
> (ver seção no fim). Escopo: as 4 telas do MVP — cadastro com rota dupla
> (candidato / empresa), perfis, feed de swipe com geração de match, e chat
> vinculado ao match.

Legenda: **PK** = chave primária · **FK** = chave estrangeira · demais = atributo comum.

---

## Entidades

### `usuario`
Tabela base do cadastro. O campo `tipo` é o discriminador: define se a linha
ganha um `perfil_candidato` **ou** uma `empresa` associada. Centralizar aqui
evita duplicar nome, e-mail, senha, documento e telefone nas duas rotas.

Os campos de todas as tabelas de cadastro espelham os formulários do front
(`Linker-front-rn/src/features/auth/domain/registration.ts`).

| Campo            | Chave | Observações |
|------------------|-------|-------------|
| `id`             | PK    | identidade da linha |
| `tipo`           | —     | `candidato` \| `empresa` \| `admin` (discriminador; admin só vem do seed, sem cadastro público) |
| `nome_completo`  | —     | nome da pessoa (candidato) ou nome da empresa |
| `email`          | —     | único; usado no login |
| `senha_hash`     | —     | nunca armazenar senha em texto puro |
| `cpf_cnpj`       | —     | CPF para candidato, CNPJ para empresa; só dígitos |
| `telefone`       | —     | celular do candidato / telefone da empresa; só dígitos |
| `foto_url`       | —     | opcional; sem foto o app mostra as iniciais |
| `criado_em`      | —     | timestamp de criação |

### `perfil_candidato`
Extensão 1:1 de `usuario` quando `tipo = 'candidato'`. É o que as empresas veem
no feed e o que o algoritmo usa para filtrar/ordenar vagas.

| Campo             | Chave | Observações |
|-------------------|-------|-------------|
| `usuario_id`      | FK → `usuario.id` | também é a PK da tabela (1:1) |
| `data_nascimento` | —     | `DATE`; idade é derivada (mín. 14 anos) |
| `cep`             | —     | localização / proximidade no feed |
| `cidade`, `uf`, `lat`, `lng` | — | geocodificados do CEP ao salvar; nulos se a API de CEP falhar |
| `escolaridade`    | —     | opção fixa (ver decisão 6) |
| `cargo_desejado`  | —     | texto livre |
| `formacao`        | —     | texto livre (curso e instituição) |
| `experiencias`    | —     | texto livre |
| `anos_experiencia`| —     | inteiro 0–60; comparado com `vaga.experiencia_minima` |
| `tipos_contrato[]`| —     | **array** de opções fixas; ao menos uma |
| `modalidades[]`   | —     | **array** de opções fixas; ao menos uma |
| `faixa_salarial`  | —     | opção fixa |
| `soft_skills[]`   | —     | **array** no MVP (ver decisão 4) |
| `hard_skills[]`   | —     | **array** no MVP (ver decisão 4) |

### `empresa`
Extensão 1:1 de `usuario` quando `tipo = 'empresa'`. Nome e CNPJ ficam em
`usuario` (`nome_completo`, `cpf_cnpj`).

| Campo            | Chave | Observações |
|------------------|-------|-------------|
| `usuario_id`     | FK → `usuario.id` | também é a PK da tabela (1:1) |
| `data_fundacao`  | —     | `DATE`; não pode estar no futuro |
| `endereco`       | —     | texto livre |

### `vaga`
Publicada por uma `empresa`. Uma empresa tem N vagas; a primeira é criada no
próprio cadastro da empresa.

| Campo            | Chave | Observações |
|------------------|-------|-------------|
| `id`             | PK    | |
| `empresa_id`     | FK → `empresa.usuario_id` | dono da vaga |
| `cargo`          | —     | |
| `descricao`      | —     | |
| `beneficios`     | —     | texto livre no MVP |
| `horario`        | —     | texto livre ("seg a sex, 9h às 18h") |
| `cep`            | —     | local de trabalho; base da distância no feed |
| `cidade`, `uf`, `lat`, `lng` | — | geocodificados do CEP ao salvar; nulos se a API de CEP falhar |
| `skills_obrigatorias[]` | — | ao menos uma; pesam mais no score |
| `skills_desejaveis[]`   | — | opcional |
| `experiencia_minima`    | — | anos, 0–60 (0 = aceita iniciante) |
| `escolaridade`   | —     | escolaridade mínima desejada; opção fixa |
| `tipo_contrato`  | —     | opção fixa |
| `modalidade`     | —     | opção fixa |
| `faixa_salarial` | —     | opção fixa |
| `criado_em`      | —     | timestamp |

### `swipe`
Registra **cada decisão** (like / pass) sobre um **par candidato–vaga**. O
candidato avalia vagas; a empresa escolhe uma das suas vagas e avalia candidatos
para ela. `autor` diz qual lado decidiu. Como o par é sempre o mesmo, as duas
pontas são FKs reais.

| Campo          | Chave | Observações |
|----------------|-------|-------------|
| `id`           | PK    | |
| `candidato_id` | FK → `perfil_candidato.usuario_id` | candidato do par |
| `vaga_id`      | FK → `vaga.id` | vaga do par |
| `autor`        | —     | `candidato` \| `empresa` (quem decidiu) |
| `direcao`      | —     | `like` \| `pass` (mesmos valores do front) |
| `criado_em`    | —     | timestamp |

Único por `(candidato_id, vaga_id, autor)`: uma decisão de cada lado por par.
Quando os dois autores deram like no mesmo par, a aplicação cria um `match`.

### `match`
Guarda a tríade candidato–vaga–empresa. Cada match gera exatamente **um** `chat`.

| Campo          | Chave | Observações |
|----------------|-------|-------------|
| `id`           | PK    | |
| `candidato_id` | FK → `usuario.id` | lado candidato |
| `vaga_id`      | FK → `vaga.id`    | vaga que casou |
| `empresa_id`   | FK → `empresa.usuario_id` | dona da vaga (desnormalizado p/ consulta rápida) |
| `criado_em`    | —     | timestamp |

### `chat`
Relação 1:1 com `match`. Existe só para agrupar as mensagens.

| Campo       | Chave | Observações |
|-------------|-------|-------------|
| `id`        | PK    | |
| `match_id`  | FK → `match.id` | único (1:1) |
| `criado_em` | —     | timestamp |

### `mensagem`
Pertence a um `chat`. Um chat acumula N mensagens.

| Campo          | Chave | Observações |
|----------------|-------|-------------|
| `id`           | PK    | |
| `chat_id`      | FK → `chat.id`    | |
| `remetente_id` | FK → `usuario.id` | quem enviou |
| `conteudo`     | —     | corpo da mensagem |
| `enviado_em`   | —     | timestamp |

### `bloqueio`
Quem bloqueou quem. Uma linha por sentido; o feed esconde o par nos dois (fase 3 lê, fase 4 escreve).

| Campo       | Chave | Observações |
|-------------|-------|-------------|
| `autor_id`  | PK, FK → `usuario.id` | quem bloqueou |
| `alvo_id`   | PK, FK → `usuario.id` | quem foi bloqueado (≠ autor) |
| `criado_em` | —     | timestamp |

### `config_pesos`
Pesos do score, versionados (spec do algoritmo). Só uma versão com `ativa = true`.

| Campo       | Chave | Observações |
|-------------|-------|-------------|
| `versao`    | PK    | |
| `pesos`     | —     | JSONB `{"A": {feature: peso}, "B": {feature: peso}}`; A = lado do candidato, B = lado da empresa |
| `ativa`     | —     | índice único parcial: no máximo uma ativa |
| `criado_em` | —     | timestamp |

A v1 (pesos escolhidos à mão) vem no próprio `04-match.sql`, porque o feed não funciona sem ela.

### `exibicao`
Log obrigatório da spec: uma linha por par exibido, para o lado que o viu. O
resultado (like/pass) não fica aqui; o treino junta com `swipe` pelo par.

| Campo          | Chave | Observações |
|----------------|-------|-------------|
| `id`           | PK    | |
| `candidato_id` | FK → `perfil_candidato.usuario_id` | |
| `vaga_id`      | FK → `vaga.id` | |
| `visto_por`    | —     | `candidato` \| `empresa` |
| `versao_pesos` | FK → `config_pesos.versao` | |
| `posicao`      | —     | 1 = topo do feed (corrige viés de posição) |
| `exploracao`   | —     | `true` se o item veio do sorteio ε-greedy |
| `features_a`, `features_b` | — | JSONB com as features de cada lado |
| `score_a`, `score_b`, `score_final` | — | `score_final = √(A·B)` |
| `criado_em`    | —     | timestamp |

---

## Relacionamentos

| De → Para                | Cardinalidade      | Notas |
|--------------------------|--------------------|-------|
| `usuario` → `perfil_candidato` | 1 : 1        | quando `tipo = 'candidato'` |
| `usuario` → `empresa`          | 1 : 1        | quando `tipo = 'empresa'` |
| `empresa` → `vaga`             | 1 : N        | |
| `perfil_candidato` → `swipe`   | 1 : N        | swipes do par, dados por qualquer lado |
| `vaga` → `swipe`               | 1 : N        | idem |
| `swipe` → `match`              | 2 : 1 (fraca)| match nasce dos dois likes do mesmo par; não é FK direta |
| `match` → `chat`               | 1 : 1        | |
| `chat` → `mensagem`            | 1 : N        | |

---

## Decisões de modelagem

1. **`usuario` como tabela base + discriminador `tipo`.** Evita duplicar dados de
   cadastro (nome, e-mail, senha, CEP) entre candidato e empresa. `perfil_candidato`
   e `empresa` são extensões 1:1 opcionais.
2. **`swipe` guarda toda decisão, não só os likes.** Manter os "pass" permite
   não re-exibir o mesmo alvo no feed e medir engajamento. O match é derivado pela
   aplicação quando detecta like nos dois sentidos.
3. **`match` carrega a tríade candidato–vaga–empresa** e gera exatamente um `chat`
   (1:1), que acumula `mensagem`s. `empresa_id` no match é redundante em relação a
   `vaga.empresa_id`, mantido para consulta direta.
4. **`soft_skills` / `hard_skills` como arrays** dentro de `perfil_candidato` para
   simplificar o MVP. Numa v2 viram tabelas próprias (`skill`, `candidato_skill`)
   com relação N:N e vocabulário controlado — necessário para filtro/ranqueamento
   de vagas por skill.
5. **Swipe sempre sobre um par candidato–vaga.** A empresa avalia candidatos em
   nome de uma vaga (o feed dela é por vaga), então todo swipe tem as duas
   pontas e elas viram FKs reais — sem FK polimórfica. O match fica simétrico:
   like dos dois `autor` no mesmo par. Um candidato passado para uma vaga
   continua no feed das outras vagas da mesma empresa.
6. **Opções fixas como `TEXT`, validadas na aplicação.** Escolaridade, tipo de
   contrato, modalidade e faixa salarial usam exatamente os rótulos dos chips do
   front (`'Híbrido'`, `'R$ 2 a 4 mil'`...). A lista vive em
   `src/schemas/auth.schema.ts` e precisa mudar junto com a do front. Sem `CHECK`
   no banco para não manter a mesma lista em três lugares.
7. **Faixa salarial, não valor.** O front trabalha com faixas (inclusive
   "A combinar"); comparar candidato × vaga no feed é por faixa.

---

## Esboço de DDL (PostgreSQL)

> Schema final: `db/init/01-schema.sql` mais os arquivos seguintes (`02-admin.sql`, …). Mudou o SQL, mude aqui.

```sql
CREATE TABLE usuario (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo          TEXT NOT NULL CHECK (tipo IN ('candidato', 'empresa', 'admin')),  -- admin: 02-admin.sql
  nome_completo TEXT NOT NULL,               -- nome da pessoa ou nome da empresa
  email         TEXT NOT NULL UNIQUE,
  senha_hash    TEXT NOT NULL,
  cpf_cnpj      TEXT NOT NULL,               -- só dígitos
  telefone      TEXT NOT NULL,               -- celular do candidato / telefone da empresa, só dígitos
  foto_url      TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE perfil_candidato (
  usuario_id      BIGINT PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  data_nascimento DATE NOT NULL,
  cep             TEXT NOT NULL,
  cidade TEXT, uf CHAR(2), lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  escolaridade    TEXT NOT NULL,
  cargo_desejado  TEXT NOT NULL,
  formacao        TEXT NOT NULL,
  experiencias    TEXT NOT NULL,
  anos_experiencia INTEGER NOT NULL CHECK (anos_experiencia BETWEEN 0 AND 60),
  tipos_contrato  TEXT[] NOT NULL,
  modalidades     TEXT[] NOT NULL,
  faixa_salarial  TEXT NOT NULL,
  soft_skills     TEXT[] NOT NULL DEFAULT '{}',
  hard_skills     TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE empresa (
  usuario_id    BIGINT PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  data_fundacao DATE NOT NULL,
  endereco      TEXT NOT NULL
);

CREATE TABLE vaga (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id     BIGINT NOT NULL REFERENCES empresa(usuario_id) ON DELETE CASCADE,
  cargo          TEXT NOT NULL,
  descricao      TEXT NOT NULL,
  beneficios     TEXT NOT NULL,
  horario        TEXT NOT NULL,              -- texto livre ("seg a sex, 9h às 18h")
  cep            TEXT NOT NULL,              -- local de trabalho; base da distância no feed
  cidade TEXT, uf CHAR(2), lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  skills_obrigatorias TEXT[] NOT NULL,       -- ao menos uma; pesam mais no score
  skills_desejaveis   TEXT[] NOT NULL DEFAULT '{}',
  experiencia_minima  INTEGER NOT NULL CHECK (experiencia_minima BETWEEN 0 AND 60),
  escolaridade   TEXT NOT NULL,              -- escolaridade mínima desejada
  tipo_contrato  TEXT NOT NULL,
  modalidade     TEXT NOT NULL,
  faixa_salarial TEXT NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Todo swipe é sobre um par candidato–vaga: o candidato avalia a vaga, ou a
-- empresa avalia o candidato em nome de uma das suas vagas (o feed da empresa
-- é sempre de uma vaga). `autor` diz qual lado decidiu.
CREATE TABLE swipe (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  candidato_id BIGINT NOT NULL REFERENCES perfil_candidato(usuario_id) ON DELETE CASCADE,
  vaga_id      BIGINT NOT NULL REFERENCES vaga(id) ON DELETE CASCADE,
  autor        TEXT NOT NULL CHECK (autor IN ('candidato', 'empresa')),
  direcao      TEXT NOT NULL CHECK (direcao IN ('like', 'pass')),
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidato_id, vaga_id, autor)      -- 1 decisão por lado, por par
);

CREATE TABLE match (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  candidato_id BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  vaga_id      BIGINT NOT NULL REFERENCES vaga(id)    ON DELETE CASCADE,
  empresa_id   BIGINT NOT NULL REFERENCES empresa(usuario_id) ON DELETE CASCADE,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidato_id, vaga_id)
);

CREATE TABLE chat (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id  BIGINT NOT NULL UNIQUE REFERENCES match(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mensagem (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chat_id      BIGINT NOT NULL REFERENCES chat(id) ON DELETE CASCADE,
  remetente_id BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  conteudo     TEXT NOT NULL,
  enviado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fase 3 (db/init/04-match.sql)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Quem bloqueou quem (um sentido por linha; o feed esconde o par nos dois sentidos).
CREATE TABLE bloqueio (
  autor_id  BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  alvo_id   BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (autor_id, alvo_id),
  CHECK (autor_id <> alvo_id)
);

-- Pesos versionados do score (spec do algoritmo). Só uma versão ativa por vez.
CREATE TABLE config_pesos (
  versao    INTEGER PRIMARY KEY,
  pesos     JSONB NOT NULL,                  -- {"A": {feature: peso}, "B": {feature: peso}}
  ativa     BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX config_pesos_uma_ativa ON config_pesos (ativa) WHERE ativa;

-- v1: pesos iniciais escolhidos à mão (AHP). A v2 sai do script da fase 6.
INSERT INTO config_pesos (versao, pesos, ativa) VALUES (1, '{
  "A": {"cargo": 0.5, "salario": 0.25, "local": 0.25},
  "B": {"cargo": 0.3, "skills": 0.25, "experiencia": 0.1, "escolaridade": 0.1, "texto": 0.1, "local": 0.15}
}', true);

-- Log obrigatório da spec: uma linha por par exibido, para o lado que o viu.
-- O resultado não fica aqui: está em `swipe` e o treino junta pelo par.
CREATE TABLE exibicao (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  candidato_id BIGINT NOT NULL REFERENCES perfil_candidato(usuario_id) ON DELETE CASCADE,
  vaga_id      BIGINT NOT NULL REFERENCES vaga(id) ON DELETE CASCADE,
  visto_por    TEXT NOT NULL CHECK (visto_por IN ('candidato', 'empresa')),
  versao_pesos INTEGER NOT NULL REFERENCES config_pesos(versao),
  posicao      INTEGER NOT NULL,             -- 1 = topo do feed
  exploracao   BOOLEAN NOT NULL,
  features_a   JSONB NOT NULL,
  features_b   JSONB NOT NULL,
  score_a      DOUBLE PRECISION NOT NULL,
  score_b      DOUBLE PRECISION NOT NULL,
  score_final  DOUBLE PRECISION NOT NULL,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX exibicao_par ON exibicao (candidato_id, vaga_id);
```

---

## Se optarem por Firestore (NoSQL)

- `usuario`, `vaga` e `swipe` viram **coleções** próprias (o doc de `swipe`
  guarda `candidato_id`, `vaga_id` e `autor`). `perfil_candidato` e
  `empresa` viram **subcampos** do documento de `usuario` em vez de coleções
  separadas.
- `match` continua como coleção, guardando os três IDs relacionados
  (`candidato_id`, `vaga_id`, `empresa_id`).
- `chat` vira o **ID do documento** e `mensagem` uma **subcoleção** dele. Assim o
  Firestore sincroniza novas mensagens em tempo real sem servidor próprio.
- Sem JOIN: desnormalizar o que a tela precisa ler junto (ex.: nome/título do
  outro lado do match dentro do próprio doc de `match`).
