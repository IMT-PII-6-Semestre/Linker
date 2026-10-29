import type { PoolClient } from 'pg';
import type { EntradaCadastroCandidato } from '../schemas/auth.schema.js';

type DadosPerfil = Omit<EntradaCadastroCandidato, 'nomeCompleto' | 'cpf' | 'email' | 'celular' | 'senha'>;

export async function inserirPerfilCandidato(
  cliente: PoolClient,
  usuarioId: number,
  dados: DadosPerfil,
): Promise<void> {
  await cliente.query(
    `INSERT INTO perfil_candidato (
       usuario_id, data_nascimento, cep, escolaridade, cargo_desejado, formacao,
       experiencias, anos_experiencia, tipos_contrato, modalidades, faixa_salarial,
       soft_skills, hard_skills
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
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
    ],
  );
}
