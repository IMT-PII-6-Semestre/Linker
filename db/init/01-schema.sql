-- Esboço de schema do MVP do Linker.
-- Fonte da verdade: .claude/models/modelagem-dados.md (não editar aqui sem
-- atualizar lá também). Roda automaticamente na primeira inicialização do
-- volume de dados do Postgres (docker-entrypoint-initdb.d).

-- Os campos espelham os formulários de cadastro do front (Linker-front-rn,
-- src/features/auth/domain/registration.ts). Valores de escolaridade, contrato,
-- modalidade e faixa salarial são validados pelo zod (src/schemas/auth.schema.ts).
CREATE TABLE usuario (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo          TEXT NOT NULL CHECK (tipo IN ('candidato', 'empresa')),
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
