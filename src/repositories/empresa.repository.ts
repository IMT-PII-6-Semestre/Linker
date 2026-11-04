import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';

export async function inserirEmpresa(
  cliente: PoolClient,
  dados: {
    usuarioId: number;
    dataFundacao: string;
    endereco: string;
  },
): Promise<void> {
  await cliente.query(
    `INSERT INTO empresa (usuario_id, data_fundacao, endereco)
     VALUES ($1, $2, $3)`,
    [dados.usuarioId, dados.dataFundacao, dados.endereco],
  );
}

export async function atualizarEmpresa(
  cliente: PoolClient,
  usuarioId: number,
  dados: { dataFundacao: string; endereco: string },
): Promise<void> {
  await cliente.query('UPDATE empresa SET data_fundacao = $2, endereco = $3 WHERE usuario_id = $1', [
    usuarioId,
    dados.dataFundacao,
    dados.endereco,
  ]);
}

export async function buscarPerfilEmpresa(usuarioId: number) {
  const { rows } = await pool.query(
    `SELECT u.id, u.nome_completo, u.cpf_cnpj, u.email, u.telefone, u.foto_url,
            to_char(e.data_fundacao, 'DD/MM/YYYY') AS data_fundacao, e.endereco
     FROM usuario u JOIN empresa e ON e.usuario_id = u.id
     WHERE u.id = $1`,
    [usuarioId],
  );
  const l = rows[0];
  if (!l) return null;
  return {
    id: l.id as number,
    nomeEmpresa: l.nome_completo as string,
    cnpj: l.cpf_cnpj as string,
    email: l.email as string,
    telefone: l.telefone as string,
    fotoUrl: l.foto_url as string | null,
    dataFundacao: l.data_fundacao as string,
    endereco: l.endereco as string,
  };
}
