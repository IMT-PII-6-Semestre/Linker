import { cadastroCandidatoSchema, cadastroEmpresaSchema } from './auth.schema.js';

// Edição = os mesmos campos e validações do cadastro, sem senha (e sem a vaga da empresa,
// que tem CRUD próprio em /api/vagas).
export const perfilCandidatoSchema = cadastroCandidatoSchema.omit({ senha: true });
export const perfilEmpresaSchema = cadastroEmpresaSchema.omit({ senha: true, vaga: true });
