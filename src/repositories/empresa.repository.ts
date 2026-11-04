import type { PoolClient } from 'pg';

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
