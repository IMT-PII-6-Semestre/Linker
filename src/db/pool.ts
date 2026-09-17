import pg from 'pg';
import { env } from '../config/env.js';

// BIGINT (OID 20) chega como string no driver. Os ids do Linker cabem em number,
// então converte na origem — assim `id` é number em todas as camadas.
pg.types.setTypeParser(20, (valor) => Number(valor));

export const pool = new pg.Pool({ connectionString: env.databaseUrl });

/** Roda `fn` numa transação, com COMMIT/ROLLBACK garantidos. */
export async function emTransacao<T>(
  fn: (cliente: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}
