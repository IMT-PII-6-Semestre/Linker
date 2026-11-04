import { pool } from '../db/pool.js';

/** `PlatformSnapshot` do front (features/admin/domain/metrics.ts): dados brutos; o front calcula as métricas. */
export interface PlatformSnapshot {
  candidatoAges: number[];
  vagasPorEmpresa: number[];
  curtidas: number;
  matches: number;
  novosUltimos30d: number;
  novos30dAnteriores: number;
  matchesPorSemana: { inicio: number; matches: number }[];
  geradoEm: number;
}

/** Só o que o repository usa de um Pool/PoolClient; o teste passa um client com tabelas temporárias. */
type Banco = { query: (texto: string) => Promise<{ rows: any[] }> };

export const SEMANAS = 8; // a tela mostra "Últimas 8 semanas"
/** Fuso do produto: as semanas do gráfico começam na segunda 00:00 de Brasília, não em UTC. */
export const FUSO = 'America/Sao_Paulo';

/**
 * Tudo numa query só, relativo ao `now()` do banco.
 * - `curtidas` = swipes `like` dos dois lados; `matches` = matches existentes. Match desfeito ou bloqueado
 *   some do total e dos gráficos, enquanto os likes ficam.
 * - Cadastros novos = candidatos e empresas (admin não se cadastra).
 * - Semanas: as últimas 8, da mais antiga para a atual, começando na segunda 00:00 de Brasília (`FUSO`) e
 *   com as semanas sem match como 0 (generate_series), para o gráfico não ter buracos.
 * ponytail: `candidatoAges` devolve uma idade por candidato (milhares no PII). Agregar por faixa no SQL
 * se passar de dezenas de milhares de candidatos.
 */
export async function snapshot(db: Banco = pool): Promise<PlatformSnapshot> {
  const { rows } = await db.query(`
    SELECT
      ARRAY(SELECT date_part('year', age(data_nascimento))::int FROM perfil_candidato) AS idades,
      ARRAY(SELECT count(v.empresa_id)::int FROM empresa e
            LEFT JOIN vaga v ON v.empresa_id = e.usuario_id GROUP BY e.usuario_id) AS vagas_por_empresa,
      (SELECT count(*) FROM swipe WHERE direcao = 'like') AS curtidas,
      (SELECT count(*) FROM match) AS matches,
      (SELECT count(*) FROM usuario WHERE tipo IN ('candidato', 'empresa')
         AND criado_em >= now() - interval '30 days') AS novos,
      (SELECT count(*) FROM usuario WHERE tipo IN ('candidato', 'empresa')
         AND criado_em >= now() - interval '60 days' AND criado_em < now() - interval '30 days') AS anteriores,
      (SELECT json_agg(json_build_object('inicio', ms, 'matches', total) ORDER BY ms)
       FROM (SELECT floor(extract(epoch from s.inicio) * 1000)::bigint AS ms, count(m.criado_em)::int AS total
             FROM generate_series(date_trunc('week', now(), '${FUSO}') - interval '${SEMANAS - 1} weeks',
                                  date_trunc('week', now(), '${FUSO}'), interval '1 week') AS s(inicio)
             LEFT JOIN match m ON m.criado_em >= s.inicio AND m.criado_em < s.inicio + interval '1 week'
             GROUP BY s.inicio) semanas) AS semanas`);
  const l = rows[0];
  return {
    candidatoAges: l.idades,
    vagasPorEmpresa: l.vagas_por_empresa,
    curtidas: l.curtidas,
    matches: l.matches,
    novosUltimos30d: l.novos,
    novos30dAnteriores: l.anteriores,
    matchesPorSemana: l.semanas,
    geradoEm: Date.now(),
  };
}
