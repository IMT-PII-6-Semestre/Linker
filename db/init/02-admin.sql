-- Fase 1: `admin` passa a ser um tipo de usuário. Sem cadastro público: a conta vem do seed.
ALTER TABLE usuario DROP CONSTRAINT usuario_tipo_check;
ALTER TABLE usuario ADD CONSTRAINT usuario_tipo_check CHECK (tipo IN ('candidato', 'empresa', 'admin'));
