import type { PoolClient } from 'pg';
import type { EntradaVaga } from '../schemas/auth.schema.js';

export async function inserirVaga(
  cliente: PoolClient,
  empresaId: number,
  vaga: EntradaVaga,
): Promise<number> {
  const { rows } = await cliente.query(
    `INSERT INTO vaga (
       empresa_id, cargo, descricao, beneficios, horario, cep,
       skills_obrigatorias, skills_desejaveis, experiencia_minima,
       escolaridade, tipo_contrato, modalidade, faixa_salarial
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id`,
    [
      empresaId,
      vaga.cargo,
      vaga.descricao,
      vaga.beneficios,
      vaga.horario,
      vaga.cep,
      vaga.skillsObrigatorias,
      vaga.skillsDesejaveis,
      vaga.experienciaMinima,
      vaga.escolaridade,
      vaga.tipoContrato,
      vaga.modalidade,
      vaga.faixaSalarial,
    ],
  );
  return rows[0].id;
}
