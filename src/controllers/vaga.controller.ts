import type { RequestHandler } from 'express';
import { invalido } from '../errors/app-error.js';
import { vagaSchema } from '../schemas/auth.schema.js';
import * as servico from '../services/vaga.service.js';

const idDaRota = (valor: string | undefined) => {
  const id = Number(valor);
  if (!Number.isInteger(id) || id < 1) throw invalido('Id de vaga inválido');
  return id;
};

export const criar: RequestHandler = async (req, res) => {
  res.status(201).json(await servico.criarVaga(req.usuario!.id, vagaSchema.parse(req.body)));
};

export const editar: RequestHandler = async (req, res) => {
  res.json(await servico.editarVaga(idDaRota(req.params.id), req.usuario!.id, vagaSchema.parse(req.body)));
};

export const remover: RequestHandler = async (req, res) => {
  await servico.removerVaga(idDaRota(req.params.id), req.usuario!.id);
  res.status(204).end();
};
