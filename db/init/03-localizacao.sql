-- Fase 2: localização geocodificada do CEP (src/services/geocodificacao.service.ts).
-- Nulos quando a API de CEP falha: o cadastro nunca depende dela.
ALTER TABLE perfil_candidato ADD COLUMN cidade TEXT, ADD COLUMN uf CHAR(2),
  ADD COLUMN lat DOUBLE PRECISION, ADD COLUMN lng DOUBLE PRECISION;
ALTER TABLE vaga ADD COLUMN cidade TEXT, ADD COLUMN uf CHAR(2),
  ADD COLUMN lat DOUBLE PRECISION, ADD COLUMN lng DOUBLE PRECISION;
