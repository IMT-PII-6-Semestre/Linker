import type { RequestHandler } from 'express';
import { perfilCandidatoSchema, perfilEmpresaSchema } from '../schemas/perfil.schema.js';
import * as servico from '../services/perfil.service.js';

export const obter: RequestHandler = async (req, res) => {
  const { id, tipo } = req.usuario!;
  res.json(await servico.obterPerfil(id, tipo));
};

export const atualizar: RequestHandler = async (req, res) => {
  const { id, tipo } = req.usuario!;
  res.json(
    tipo === 'candidato'
      ? await servico.atualizarPerfilCandidato(id, perfilCandidatoSchema.parse(req.body))
      : await servico.atualizarPerfilEmpresa(id, perfilEmpresaSchema.parse(req.body)),
  );
};

export const foto: RequestHandler = async (req, res) => {
  const { id, tipo } = req.usuario!;
  res.json(await servico.salvarFoto(id, tipo, req.headers['content-type'], req.body));
};
