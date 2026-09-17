import type { PoolClient } from 'pg';

/** Cria a extensão 1:1 vazia — candidato preenche experiência/skills depois, na tela de perfil. */
export async function inserirPerfilCandidato(
  cliente: PoolClient,
  dados: { usuarioId: number },
): Promise<void> {
  await cliente.query(
    `INSERT INTO perfil_candidato (usuario_id)
     VALUES ($1)`,
    [dados.usuarioId],
  );
}
