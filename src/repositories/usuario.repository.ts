import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';
import type { TipoUsuario, Usuario } from '../types/usuario.js';

export async function inserirUsuario(
  cliente: PoolClient,
  dados: {
    tipo: TipoUsuario;
    nomeCompleto: string;
    email: string;
    senhaHash: string;
    cpfCnpj: string;
    telefone: string;
  },
): Promise<Usuario> {
  const { rows } = await cliente.query(
    `INSERT INTO usuario (tipo, nome_completo, email, senha_hash, cpf_cnpj, telefone)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, tipo, nome_completo, email, criado_em`,
    [
      dados.tipo,
      dados.nomeCompleto,
      dados.email,
      dados.senhaHash,
      dados.cpfCnpj,
      dados.telefone,
    ],
  );
  return paraUsuario(rows[0]);
}

/** Só esta função devolve o hash — usada exclusivamente no login. */
export async function buscarCredencialPorEmail(email: string) {
  const { rows } = await pool.query(
    'SELECT id, tipo, nome_completo, email, criado_em, senha_hash FROM usuario WHERE email = $1',
    [email],
  );
  return rows[0]
    ? { usuario: paraUsuario(rows[0]), senhaHash: rows[0].senha_hash as string }
    : null;
}

/** Fronteira snake_case → camelCase: acontece aqui e em nenhum outro lugar. */
function paraUsuario(linha: any): Usuario {
  return {
    id: linha.id,
    tipo: linha.tipo,
    nomeCompleto: linha.nome_completo,
    email: linha.email,
    criadoEm: linha.criado_em,
  };
}
