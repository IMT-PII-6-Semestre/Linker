-- Esboço de schema do MVP do Linker.
-- Fonte da verdade: .claude/models/modelagem-dados.md (não editar aqui sem
-- atualizar lá também). Roda automaticamente na primeira inicialização do
-- volume de dados do Postgres (docker-entrypoint-initdb.d).

CREATE TABLE usuario (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo          TEXT NOT NULL CHECK (tipo IN ('candidato', 'empresa')),
  nome_completo TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  senha_hash    TEXT NOT NULL,
  cpf_cnpj      TEXT NOT NULL,
  idade         INTEGER,
  cep           TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE perfil_candidato (
  usuario_id   BIGINT PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  experiencia  TEXT,
  formacao     TEXT,
  projetos     TEXT,
  soft_skills  TEXT[] NOT NULL DEFAULT '{}',
  hard_skills  TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE empresa (
  usuario_id    BIGINT PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  cnpj          TEXT NOT NULL,
  razao_social  TEXT NOT NULL,
  anos_fundacao INTEGER
);

CREATE TABLE vaga (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id        BIGINT NOT NULL REFERENCES empresa(usuario_id) ON DELETE CASCADE,
  titulo            TEXT NOT NULL,
  descricao         TEXT,
  formacao_desejada TEXT,
  horas_trabalho    INTEGER,
  salario           NUMERIC(12,2),
  beneficios        TEXT
);

CREATE TABLE swipe (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  alvo_tipo   TEXT NOT NULL CHECK (alvo_tipo IN ('vaga', 'candidato')),
  alvo_id     BIGINT NOT NULL,               -- FK polimórfica: vaga.id ou usuario.id
  direcao     TEXT NOT NULL CHECK (direcao IN ('like', 'dislike')),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, alvo_tipo, alvo_id)    -- 1 decisão por par
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
