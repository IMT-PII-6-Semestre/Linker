import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';
import type { Pesos } from '../match/score.js';

export type Lado = 'candidato' | 'empresa';

export async function pesosAtivos(): Promise<{ versao: number; pesos: Pesos }> {
  const { rows } = await pool.query('SELECT versao, pesos FROM config_pesos WHERE ativa');
  if (!rows[0]) throw new Error('Nenhuma config_pesos ativa');
  return rows[0];
}

/**
 * Grava uma nova versão de pesos (a seguinte à maior existente) **inativa**: o feed só passa a usá-la
 * quando alguém ativar de propósito (ver `scripts/validar-pesos.ts`). Devolve o número da versão.
 */
export async function salvarPesos(pesos: Pesos, db: Pick<PoolClient, 'query'> = pool): Promise<number> {
  const { rows } = await db.query(
    `INSERT INTO config_pesos (versao, pesos, ativa)
     SELECT COALESCE(MAX(versao), 0) + 1, $1::jsonb, false FROM config_pesos RETURNING versao`,
    [JSON.stringify(pesos)],
  );
  return rows[0].versao;
}

/**
 * Colunas que `paraPost` (feed.service.ts) lê de um par candidato × vaga. Exige os aliases
 * p (perfil_candidato), uc (usuário candidato), v (vaga) e ue (usuário empresa). A fase 4 reaproveita.
 */
export const COLUNAS_PAR = `p.usuario_id AS candidato_id, uc.nome_completo AS candidato_nome, uc.foto_url AS candidato_foto,
            date_part('year', age(p.data_nascimento))::int AS idade,
            p.escolaridade AS c_escolaridade, p.cargo_desejado, p.formacao, p.experiencias, p.anos_experiencia,
            p.hard_skills, p.soft_skills, p.modalidades, p.tipos_contrato, p.faixa_salarial AS c_faixa_salarial,
            p.cidade AS c_cidade, p.uf AS c_uf, p.lat AS c_lat, p.lng AS c_lng,
            v.id AS vaga_id, v.empresa_id, ue.nome_completo AS empresa_nome, ue.foto_url AS empresa_foto,
            v.cargo, v.descricao, v.beneficios, v.horario, v.cep, v.skills_obrigatorias, v.skills_desejaveis,
            v.experiencia_minima, v.escolaridade AS v_escolaridade, v.tipo_contrato, v.modalidade,
            v.faixa_salarial AS v_faixa_salarial,
            v.cidade AS v_cidade, v.uf AS v_uf, v.lat AS v_lat, v.lng AS v_lng`;

/**
 * Pares candidato × vaga que passam nos filtros eliminatórios da spec, para quem está vendo:
 * `candidatoId` fixo (feed do candidato) ou `vagaId` fixo (feed da empresa). Exatamente um dos dois.
 * Cargo e texto livre são calculados aqui porque dependem de pg_trgm / full-text.
 * ponytail: unaccent não é IMMUTABLE, então não há índice nessas expressões; no volume do PII
 * não faz falta. Índice funcional (wrapper IMMUTABLE) se o feed passar de milhares de pares.
 */
export async function paresDoFeed(f: { candidatoId: number | null; vagaId: number | null; vistoPor: Lado }) {
  const { rows } = await pool.query(
    `SELECT ${COLUNAS_PAR},
            similarity(unaccent(lower(p.cargo_desejado)), unaccent(lower(v.cargo)))::float8 AS sim_cargo,
            -- OR entre os termos da descrição (plainto_tsquery usa AND e quase nunca casaria); 32 = r/(r+1) → [0,1)
            ts_rank(to_tsvector('portuguese', p.formacao || ' ' || p.experiencias),
                    replace(plainto_tsquery('portuguese', v.descricao)::text, '&', '|')::tsquery, 32)::float8 AS rank_texto
     FROM perfil_candidato p
     JOIN usuario uc ON uc.id = p.usuario_id
     CROSS JOIN vaga v
     JOIN usuario ue ON ue.id = v.empresa_id
     WHERE ($1::bigint IS NULL OR p.usuario_id = $1)
       AND ($2::bigint IS NULL OR v.id = $2)
       AND v.modalidade = ANY (p.modalidades)
       AND v.tipo_contrato = ANY (p.tipos_contrato)
       AND (v.tipo_contrato <> 'Jovem Aprendiz' OR date_part('year', age(p.data_nascimento)) BETWEEN 14 AND 24)
       AND NOT EXISTS (SELECT 1 FROM swipe s
                       WHERE s.candidato_id = p.usuario_id AND s.vaga_id = v.id AND s.autor = $3)
       AND NOT EXISTS (SELECT 1 FROM bloqueio b
                       WHERE (b.autor_id = uc.id AND b.alvo_id = ue.id) OR (b.autor_id = ue.id AND b.alvo_id = uc.id))`,
    [f.candidatoId, f.vagaId, f.vistoPor],
  );
  return rows as Par[];
}

/** Linha crua de `paresDoFeed` (snake_case); quem consome converte, ver feed.service.ts. */
export type Par = Record<string, any>;

export interface Exibicao {
  candidato_id: number;
  vaga_id: number;
  posicao: number;
  exploracao: boolean;
  features_a: object;
  features_b: object;
  score_a: number;
  score_b: number;
  score_final: number;
}

/** Um INSERT só para o feed inteiro (N inserts por request deixariam o feed lento). */
export async function registrarExibicoes(vistoPor: Lado, versao: number, linhas: Exibicao[]): Promise<void> {
  if (linhas.length === 0) return;
  await pool.query(
    `INSERT INTO exibicao (candidato_id, vaga_id, visto_por, versao_pesos, posicao, exploracao,
                           features_a, features_b, score_a, score_b, score_final)
     SELECT x.candidato_id, x.vaga_id, $2, $3, x.posicao, x.exploracao,
            x.features_a, x.features_b, x.score_a, x.score_b, x.score_final
     FROM jsonb_to_recordset($1::jsonb) AS x(candidato_id bigint, vaga_id bigint, posicao int, exploracao boolean,
          features_a jsonb, features_b jsonb, score_a float8, score_b float8, score_final float8)`,
    [JSON.stringify(linhas), vistoPor, versao],
  );
}

export async function candidatoExiste(id: number): Promise<boolean> {
  const { rowCount } = await pool.query('SELECT 1 FROM perfil_candidato WHERE usuario_id = $1', [id]);
  return rowCount === 1;
}

/**
 * Serializa o par: sem isso, dois likes simultâneos em transações separadas não enxergam um ao
 * outro (READ COMMITTED) e o match nunca nasce. Liberado no COMMIT.
 * ponytail: chave = candidato * 1_000_000 + vaga; colide se houver mais de 1M vagas (uma colisão só
 * serializa pares a mais, não quebra nada). Trocar por hashtext() se o volume crescer.
 */
export async function travarPar(cliente: PoolClient, candidatoId: number, vagaId: number): Promise<void> {
  await cliente.query('SELECT pg_advisory_xact_lock($1::bigint)', [candidatoId * 1_000_000 + vagaId]);
}

/**
 * Grava o swipe e diz se ele é novo. Primeira decisão vale: um swipe repetido não sobrescreve.
 * O service só cria match com swipe novo; um repetido nunca recria o match desfeito ou bloqueado.
 */
export async function registrarSwipe(
  cliente: PoolClient,
  s: { candidatoId: number; vagaId: number; autor: Lado; direcao: 'like' | 'pass' },
): Promise<boolean> {
  const { rowCount } = await cliente.query(
    `INSERT INTO swipe (candidato_id, vaga_id, autor, direcao) VALUES ($1, $2, $3, $4)
     ON CONFLICT (candidato_id, vaga_id, autor) DO NOTHING`,
    [s.candidatoId, s.vagaId, s.autor, s.direcao],
  );
  return rowCount === 1;
}

/** id do match do par, ou null (nunca houve, ou foi desfeito / bloqueado). */
export async function matchDoPar(cliente: PoolClient, candidatoId: number, vagaId: number): Promise<number | null> {
  const { rows } = await cliente.query('SELECT id FROM match WHERE candidato_id = $1 AND vaga_id = $2', [
    candidatoId,
    vagaId,
  ]);
  return rows[0]?.id ?? null;
}

/** Um dos dois bloqueou o outro? Vale para qualquer vaga da empresa: o bloqueio é entre pessoas. */
export async function haBloqueio(cliente: PoolClient, a: number, b: number): Promise<boolean> {
  const { rowCount } = await cliente.query(
    'SELECT 1 FROM bloqueio WHERE (autor_id = $1 AND alvo_id = $2) OR (autor_id = $2 AND alvo_id = $1)',
    [a, b],
  );
  return rowCount === 1;
}

export async function outroLadoCurtiu(cliente: PoolClient, candidatoId: number, vagaId: number, outro: Lado) {
  const { rowCount } = await cliente.query(
    `SELECT 1 FROM swipe WHERE candidato_id = $1 AND vaga_id = $2 AND autor = $3 AND direcao = 'like'`,
    [candidatoId, vagaId, outro],
  );
  return rowCount === 1;
}

/** Cria match + chat (idempotente) e devolve o id do match. */
export async function criarMatch(cliente: PoolClient, candidatoId: number, vagaId: number, empresaId: number) {
  await cliente.query(
    `INSERT INTO match (candidato_id, vaga_id, empresa_id) VALUES ($1, $2, $3)
     ON CONFLICT (candidato_id, vaga_id) DO NOTHING`,
    [candidatoId, vagaId, empresaId],
  );
  const { rows } = await cliente.query('SELECT id FROM match WHERE candidato_id = $1 AND vaga_id = $2', [
    candidatoId,
    vagaId,
  ]);
  await cliente.query('INSERT INTO chat (match_id) VALUES ($1) ON CONFLICT (match_id) DO NOTHING', [rows[0].id]);
  return rows[0].id as number;
}
