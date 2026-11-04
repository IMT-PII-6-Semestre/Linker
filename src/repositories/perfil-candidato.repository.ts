import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';
import type { EntradaCadastroCandidato } from '../schemas/auth.schema.js';
import type { Local } from '../services/geocodificacao.service.js';

type DadosPerfil = Omit<EntradaCadastroCandidato, 'nomeCompleto' | 'cpf' | 'email' | 'celular' | 'senha'>;

export async function inserirPerfilCandidato(
  cliente: PoolClient,
  usuarioId: number,
  dados: DadosPerfil,
  local: Local,
): Promise<void> {
  await cliente.query(
    `INSERT INTO perfil_candidato (
       usuario_id, data_nascimento, cep, escolaridade, cargo_desejado, formacao,
       experiencias, anos_experiencia, tipos_contrato, modalidades, faixa_salarial,
       soft_skills, hard_skills, cidade, uf, lat, lng
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
    [
      usuarioId,
      dados.dataNascimento,
      dados.cep,
      dados.escolaridade,
      dados.cargoDesejado,
      dados.formacao,
      dados.experiencias,
      dados.anosExperiencia,
      dados.tiposContrato,
      dados.modalidades,
      dados.faixaSalarial,
      dados.softSkills,
      dados.hardSkills,
      local.cidade,
      local.uf,
      local.lat,
      local.lng,
    ],
  );
}

export async function atualizarPerfilCandidato(
  cliente: PoolClient,
  usuarioId: number,
  dados: DadosPerfil,
  local: Local,
): Promise<void> {
  await cliente.query(
    `UPDATE perfil_candidato SET
       data_nascimento = $2, cep = $3, escolaridade = $4, cargo_desejado = $5, formacao = $6,
       experiencias = $7, anos_experiencia = $8, tipos_contrato = $9, modalidades = $10,
       faixa_salarial = $11, soft_skills = $12, hard_skills = $13,
       cidade = $14, uf = $15, lat = $16, lng = $17
     WHERE usuario_id = $1`,
    [
      usuarioId, dados.dataNascimento, dados.cep, dados.escolaridade, dados.cargoDesejado,
      dados.formacao, dados.experiencias, dados.anosExperiencia, dados.tiposContrato,
      dados.modalidades, dados.faixaSalarial, dados.softSkills, dados.hardSkills,
      local.cidade, local.uf, local.lat, local.lng,
    ],
  );
}

/** Perfil do candidato no formato do front; máscaras e datas dd/mm/aaaa ficam no service. */
export async function buscarPerfilCandidato(usuarioId: number) {
  const { rows } = await pool.query(
    `SELECT u.id, u.nome_completo, u.cpf_cnpj, u.email, u.telefone, u.foto_url,
            to_char(p.data_nascimento, 'DD/MM/YYYY') AS data_nascimento,
            p.cep, p.escolaridade, p.cargo_desejado, p.formacao, p.experiencias,
            p.anos_experiencia, p.tipos_contrato, p.modalidades, p.faixa_salarial,
            p.soft_skills, p.hard_skills
     FROM usuario u JOIN perfil_candidato p ON p.usuario_id = u.id
     WHERE u.id = $1`,
    [usuarioId],
  );
  const l = rows[0];
  if (!l) return null;
  return {
    id: l.id as number,
    nomeCompleto: l.nome_completo as string,
    cpf: l.cpf_cnpj as string,
    email: l.email as string,
    celular: l.telefone as string,
    fotoUrl: l.foto_url as string | null,
    dataNascimento: l.data_nascimento as string,
    cep: l.cep as string,
    escolaridade: l.escolaridade as string,
    cargoDesejado: l.cargo_desejado as string,
    formacao: l.formacao as string,
    experiencias: l.experiencias as string,
    anosExperiencia: l.anos_experiencia as number,
    tiposContrato: l.tipos_contrato as string[],
    modalidades: l.modalidades as string[],
    faixaSalarial: l.faixa_salarial as string,
    softSkills: l.soft_skills as string[],
    hardSkills: l.hard_skills as string[],
  };
}
