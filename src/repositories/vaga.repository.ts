import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';
import type { EntradaVaga } from '../schemas/auth.schema.js';
import type { Local } from '../services/geocodificacao.service.js';

const COLUNAS = `id, empresa_id, cargo, descricao, beneficios, horario, cep, skills_obrigatorias,
  skills_desejaveis, experiencia_minima, escolaridade, tipo_contrato, modalidade, faixa_salarial`;

export async function inserirVaga(
  cliente: PoolClient,
  empresaId: number,
  vaga: EntradaVaga,
  local: Local,
): Promise<number> {
  const { rows } = await cliente.query(
    `INSERT INTO vaga (
       empresa_id, cargo, descricao, beneficios, horario, cep,
       skills_obrigatorias, skills_desejaveis, experiencia_minima,
       escolaridade, tipo_contrato, modalidade, faixa_salarial,
       cidade, uf, lat, lng
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING id`,
    [empresaId, ...valores(vaga), local.cidade, local.uf, local.lat, local.lng],
  );
  return rows[0].id;
}

export async function atualizarVaga(id: number, vaga: EntradaVaga, local: Local): Promise<void> {
  await pool.query(
    `UPDATE vaga SET cargo = $2, descricao = $3, beneficios = $4, horario = $5, cep = $6,
       skills_obrigatorias = $7, skills_desejaveis = $8, experiencia_minima = $9,
       escolaridade = $10, tipo_contrato = $11, modalidade = $12, faixa_salarial = $13,
       cidade = $14, uf = $15, lat = $16, lng = $17
     WHERE id = $1`,
    [id, ...valores(vaga), local.cidade, local.uf, local.lat, local.lng],
  );
}

export async function excluirVaga(id: number): Promise<void> {
  await pool.query('DELETE FROM vaga WHERE id = $1', [id]);
}

export async function buscarVaga(id: number) {
  const { rows } = await pool.query(`SELECT ${COLUNAS} FROM vaga WHERE id = $1`, [id]);
  return rows[0] ? paraVaga(rows[0]) : null;
}

export async function listarVagasDaEmpresa(empresaId: number) {
  const { rows } = await pool.query(`SELECT ${COLUNAS} FROM vaga WHERE empresa_id = $1 ORDER BY id`, [
    empresaId,
  ]);
  return rows.map(paraVaga);
}

function valores(v: EntradaVaga) {
  return [
    v.cargo, v.descricao, v.beneficios, v.horario, v.cep, v.skillsObrigatorias,
    v.skillsDesejaveis, v.experienciaMinima, v.escolaridade, v.tipoContrato, v.modalidade,
    v.faixaSalarial,
  ];
}

/** Fronteira snake_case → camelCase. `id` como string, igual ao `Vaga` do front. */
function paraVaga(l: any) {
  return {
    id: String(l.id),
    empresaId: l.empresa_id as number,
    cargo: l.cargo as string,
    descricao: l.descricao as string,
    beneficios: l.beneficios as string,
    horario: l.horario as string,
    cep: l.cep as string,
    skillsObrigatorias: l.skills_obrigatorias as string[],
    skillsDesejaveis: l.skills_desejaveis as string[],
    experienciaMinima: l.experiencia_minima as number,
    escolaridade: l.escolaridade as string,
    tipoContrato: l.tipo_contrato as string,
    modalidade: l.modalidade as string,
    faixaSalarial: l.faixa_salarial as string,
  };
}
