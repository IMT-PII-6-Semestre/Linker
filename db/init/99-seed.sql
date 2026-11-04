-- Dados de desenvolvimento. Todas as contas usam a senha 123456.
-- Espelha as contas de teste do README do front (Linker-front-rn).
-- Roda só com o volume vazio: use `npm run db:reset` para recriar.

INSERT INTO usuario (tipo, nome_completo, email, senha_hash, cpf_cnpj, telefone) VALUES
  ('candidato', 'Ana Souza',      'ana@email.com',      '$2b$10$1z6ZzujdH6P0WOEOhojAquR/njb1q8PUMiLts1gEhcf8FPGwzrzNG', '52998224725',    '11987654321'),
  ('candidato', 'Bruno Lima',     'bruno@email.com',    '$2b$10$1z6ZzujdH6P0WOEOhojAquR/njb1q8PUMiLts1gEhcf8FPGwzrzNG', '11144477735',    '21987654321'),
  ('empresa',   'Empresa Alfa',   'rh@empresa.com',     '$2b$10$1z6ZzujdH6P0WOEOhojAquR/njb1q8PUMiLts1gEhcf8FPGwzrzNG', '11222333000181', '1133334444'),
  ('empresa',   'Empresa Beta',   'rh@empresabeta.com', '$2b$10$1z6ZzujdH6P0WOEOhojAquR/njb1q8PUMiLts1gEhcf8FPGwzrzNG', '11444777000161', '2133334444');
-- Admin: tipo 'admin' só passa a existir no CHECK na fase 1; o seed da conta entra lá.

INSERT INTO perfil_candidato (usuario_id, data_nascimento, cep, escolaridade, cargo_desejado, formacao, experiencias,
                              anos_experiencia, tipos_contrato, modalidades, faixa_salarial, soft_skills, hard_skills)
SELECT id, '2000-05-10', '01310100', 'Superior completo', 'Desenvolvedora Backend', 'Ciência da Computação', 'Dois anos em APIs REST.',
       2, '{CLT,PJ}', '{Remoto,Híbrido}', 'R$ 4 a 6 mil', '{Comunicação,Trabalho em equipe}', '{Node.js,SQL,TypeScript}'
FROM usuario WHERE email = 'ana@email.com';

INSERT INTO perfil_candidato (usuario_id, data_nascimento, cep, escolaridade, cargo_desejado, formacao, experiencias,
                              anos_experiencia, tipos_contrato, modalidades, faixa_salarial, soft_skills, hard_skills)
SELECT id, '2005-09-20', '20040020', 'Superior em andamento', 'Estagiário de TI', 'Sistemas de Informação', 'Projetos acadêmicos.',
       0, '{Estágio,Jovem Aprendiz}', '{Presencial}', 'Até R$ 2 mil', '{Proatividade}', '{Python,Excel}'
FROM usuario WHERE email = 'bruno@email.com';

INSERT INTO empresa (usuario_id, data_fundacao, endereco)
SELECT id, '2010-03-15', 'Av. Paulista, 1000 - São Paulo/SP' FROM usuario WHERE email = 'rh@empresa.com';
INSERT INTO empresa (usuario_id, data_fundacao, endereco)
SELECT id, '2018-07-01', 'Rua da Assembleia, 10 - Rio de Janeiro/RJ' FROM usuario WHERE email = 'rh@empresabeta.com';

INSERT INTO vaga (empresa_id, cargo, descricao, beneficios, horario, cep, skills_obrigatorias, skills_desejaveis,
                  experiencia_minima, escolaridade, tipo_contrato, modalidade, faixa_salarial)
SELECT id, 'Desenvolvedor Backend', 'APIs em Node.js.', 'VR, VA, plano de saúde', 'seg a sex, 9h às 18h', '01310100',
       '{Node.js,SQL}', '{TypeScript}', 2, 'Superior completo', 'CLT', 'Híbrido', 'R$ 4 a 6 mil'
FROM usuario WHERE email = 'rh@empresa.com';
INSERT INTO vaga (empresa_id, cargo, descricao, beneficios, horario, cep, skills_obrigatorias, skills_desejaveis,
                  experiencia_minima, escolaridade, tipo_contrato, modalidade, faixa_salarial)
SELECT id, 'Estagiário de TI', 'Suporte e automações.', 'Bolsa, VT', 'seg a sex, 13h às 18h', '20040020',
       '{Python}', '{Excel}', 0, 'Superior em andamento', 'Estágio', 'Presencial', 'Até R$ 2 mil'
FROM usuario WHERE email = 'rh@empresabeta.com';
