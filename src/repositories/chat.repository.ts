import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';
import { COLUNAS_PAR } from './feed.repository.js';

const MS = (coluna: string) => `floor(extract(epoch from ${coluna}) * 1000)::bigint`;
/** O usuário `$N` participa do match `m`? Vai no WHERE: a checagem e a ação são a mesma query. */
const participa = (n: number) => `(m.candidato_id = $${n} OR m.empresa_id = $${n})`;

/**
 * Conversas do usuário, mais recentes primeiro, numa query só: o par (para o `post`), a última
 * mensagem e as não lidas vêm por LATERAL, sem N+1. `matchId` restringe a uma conversa; sem linha =
 * não existe ou o usuário não participa (o service responde 404 nos dois casos).
 */
export async function conversas(eu: number, matchId: number | null) {
  const { rows } = await pool.query(
    `SELECT ${COLUNAS_PAR}, m.id AS match_id,
            ult.id AS ult_id, ult.remetente_id AS ult_remetente, ult.conteudo AS ult_conteudo, ult.enviado_ms AS ult_enviado_ms,
            nl.total AS nao_lidas
     FROM match m
     JOIN chat c ON c.match_id = m.id
     JOIN perfil_candidato p ON p.usuario_id = m.candidato_id
     JOIN usuario uc ON uc.id = p.usuario_id
     JOIN vaga v ON v.id = m.vaga_id
     JOIN usuario ue ON ue.id = m.empresa_id
     LEFT JOIN LATERAL (SELECT id, remetente_id, conteudo, ${MS('enviado_em')} AS enviado_ms
                        FROM mensagem WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) ult ON true
     CROSS JOIN LATERAL (SELECT count(*) AS total FROM mensagem
                         WHERE chat_id = c.id AND remetente_id <> $1 AND lida_em IS NULL) nl
     WHERE ${participa(1)} AND ($2::bigint IS NULL OR m.id = $2)
     ORDER BY COALESCE(ult.enviado_ms, ${MS('m.criado_em')}) DESC, m.id DESC`,
    [eu, matchId],
  );
  return rows as Record<string, any>[];
}

/** id do chat do match, ou null se não existe ou o usuário não participa. */
export async function chatDoParticipante(eu: number, matchId: number): Promise<number | null> {
  const { rows } = await pool.query(
    `SELECT c.id FROM match m JOIN chat c ON c.match_id = m.id WHERE m.id = $1 AND ${participa(2)}`,
    [matchId, eu],
  );
  return rows[0]?.id ?? null;
}

/** Marca como lidas as mensagens do outro lado. Roda antes do SELECT: o que chega no meio já vem lido. */
export async function marcarLidas(chatId: number, eu: number): Promise<void> {
  await pool.query(
    'UPDATE mensagem SET lida_em = now() WHERE chat_id = $1 AND remetente_id <> $2 AND lida_em IS NULL',
    [chatId, eu],
  );
}

/**
 * ponytail: devolve a conversa inteira, sem paginação. Keyset (`id < $antes ORDER BY id DESC LIMIT n`)
 * se as conversas passarem de algumas centenas de mensagens.
 */
export async function mensagens(chatId: number) {
  const { rows } = await pool.query(
    `SELECT id, remetente_id, conteudo, ${MS('enviado_em')} AS enviado_ms
     FROM mensagem WHERE chat_id = $1 ORDER BY id`,
    [chatId],
  );
  return rows as Record<string, any>[];
}

/** Insere só se o usuário participa do match; sem linha = 404. */
export async function inserirMensagem(matchId: number, eu: number, texto: string) {
  const { rows } = await pool.query(
    `INSERT INTO mensagem (chat_id, remetente_id, conteudo)
     SELECT c.id, $2, $3 FROM match m JOIN chat c ON c.match_id = m.id WHERE m.id = $1 AND ${participa(2)}
     RETURNING id, remetente_id, conteudo, ${MS('enviado_em')} AS enviado_ms`,
    [matchId, eu, texto],
  );
  return (rows[0] as Record<string, any> | undefined) ?? null;
}

/** Apaga o match (o cascade leva chat e mensagens). Devolve os dois lados, ou null se 404. */
export async function excluirMatch(cliente: Pick<PoolClient, 'query'>, matchId: number, eu: number) {
  const { rows } = await cliente.query(
    `DELETE FROM match m WHERE m.id = $1 AND ${participa(2)} RETURNING m.candidato_id, m.empresa_id`,
    [matchId, eu],
  );
  return (rows[0] as { candidato_id: number; empresa_id: number } | undefined) ?? null;
}

export async function inserirBloqueio(cliente: PoolClient, autorId: number, alvoId: number): Promise<void> {
  await cliente.query(
    'INSERT INTO bloqueio (autor_id, alvo_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [autorId, alvoId],
  );
}

/** Insere só se o usuário participa do match; o alvo é o outro lado. Devolve false se 404. */
export async function inserirDenuncia(matchId: number, eu: number, motivo: string, detalhes: string) {
  const { rowCount } = await pool.query(
    `INSERT INTO denuncia (autor_id, alvo_id, match_id, motivo, detalhes)
     SELECT $2, CASE WHEN m.candidato_id = $2 THEN m.empresa_id ELSE m.candidato_id END, m.id, $3, $4
     FROM match m WHERE m.id = $1 AND ${participa(2)}`,
    [matchId, eu, motivo, detalhes],
  );
  return rowCount === 1;
}
