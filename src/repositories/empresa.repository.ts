import type { PoolClient } from 'pg';

export async function inserirEmpresa(
  cliente: PoolClient,
  dados: {
    usuarioId: number;
    cnpj: string;
    razaoSocial: string;
    anosFundacao?: number;
  },
): Promise<void> {
  await cliente.query(
    `INSERT INTO empresa (usuario_id, cnpj, razao_social, anos_fundacao)
     VALUES ($1, $2, $3, $4)`,
    [dados.usuarioId, dados.cnpj, dados.razaoSocial, dados.anosFundacao ?? null],
  );
}
