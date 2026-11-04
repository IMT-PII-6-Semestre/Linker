-- Fase 3: feed, swipe e match. Fonte da verdade: docs/modelagem-dados.md.
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
