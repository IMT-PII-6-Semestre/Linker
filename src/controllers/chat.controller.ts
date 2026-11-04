import type { RequestHandler } from 'express';
import { invalido } from '../errors/app-error.js';
import { denunciaSchema, mensagemSchema } from '../schemas/chat.schema.js';
import * as chat from '../services/chat.service.js';

const idDaRota = (valor: string | undefined) => {
  const id = Number(valor);
  if (!Number.isInteger(id) || id < 1) throw invalido('Id de conversa inválido');
  return id;
};

export const listar: RequestHandler = async (req, res) => {
  res.json(await chat.listarConversas(req.usuario!.id));
};

export const obter: RequestHandler = async (req, res) => {
  res.json(await chat.obterConversa(req.usuario!.id, idDaRota(req.params.id)));
};

export const mensagens: RequestHandler = async (req, res) => {
  res.json(await chat.listarMensagens(req.usuario!.id, idDaRota(req.params.id)));
};

export const enviar: RequestHandler = async (req, res) => {
  const { text } = mensagemSchema.parse(req.body);
  res.status(201).json(await chat.enviarMensagem(req.usuario!.id, idDaRota(req.params.id), text));
};

export const desfazer: RequestHandler = async (req, res) => {
  await chat.desfazerMatch(req.usuario!.id, idDaRota(req.params.id));
  res.status(204).end();
};

export const bloquear: RequestHandler = async (req, res) => {
  await chat.bloquear(req.usuario!.id, idDaRota(req.params.id));
  res.status(204).end();
};

export const denunciar: RequestHandler = async (req, res) => {
  const { reason, details } = denunciaSchema.parse(req.body);
  await chat.denunciar(req.usuario!.id, idDaRota(req.params.id), reason, details);
  res.status(204).end();
};
