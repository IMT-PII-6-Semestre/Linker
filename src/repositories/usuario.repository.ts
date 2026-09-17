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
    idade?: number;
    cep?: string;
  },
): Promise<Usuario> {
  const { rows } = await cliente.query(
    `INSERT INTO usuario (tipo, nome_completo, email, senha_hash, cpf_cnpj, idade, cep)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, tipo, nome_completo, email, criado_em`,
    [
      dados.tipo,
      dados.nomeCompleto,
      dados.email,
      dados.senhaHash,
      dados.cpfCnpj,
      dados.idade ?? null,
      dados.cep ?? null,
    ],
  );
  return paraUsuario(rows[0]);
}

/** Só esta função devolve o hash — usada exclusivamente no login. */
export async function buscarCredencialPorEmail(email: string) {
  const { rows } = await pool.query(
    'SELECT id, tipo, senha_hash FROM usuario WHERE email = $1',
    [email],
  );
  return rows[0]
    ? {
        id: rows[0].id as number,
        tipo: rows[0].tipo as TipoUsuario,
        senhaHash: rows[0].senha_hash as string,
      }
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
