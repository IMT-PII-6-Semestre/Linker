-- Fase 4: chat e moderação. Fonte da verdade: docs/modelagem-dados.md.
ALTER TABLE mensagem ADD COLUMN lida_em TIMESTAMPTZ;       -- null = ainda não lida pelo destinatário
ALTER TABLE mensagem ADD CONSTRAINT mensagem_tamanho CHECK (char_length(conteudo) BETWEEN 1 AND 1000);
CREATE INDEX mensagem_chat ON mensagem (chat_id, id);      -- última mensagem e não lidas por conversa

-- Denúncia para a moderação. Sobrevive ao fim do match (desfazer/bloquear apaga o match):
-- por isso match_id é SET NULL, e não CASCADE.
CREATE TABLE denuncia (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  autor_id  BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  alvo_id   BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  match_id  BIGINT REFERENCES match(id) ON DELETE SET NULL,
  motivo    TEXT NOT NULL CHECK (motivo IN (
              'Spam ou propaganda', 'Comportamento ofensivo', 'Vaga ou perfil falso',
              'Pediu dinheiro ou dados bancários', 'Outro motivo')),   -- REPORT_REASONS do front
  detalhes  TEXT NOT NULL DEFAULT '' CHECK (char_length(detalhes) <= 1000),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (autor_id <> alvo_id)
);
