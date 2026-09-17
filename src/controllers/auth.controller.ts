import type { RequestHandler } from 'express';
import {
  cadastroCandidatoSchema,
  cadastroEmpresaSchema,
  loginSchema,
} from '../schemas/auth.schema.js';
import * as servico from '../services/auth.service.js';

export const cadastrarCandidato: RequestHandler = async (req, res) => {
  const entrada = cadastroCandidatoSchema.parse(req.body);
  const resultado = await servico.cadastrarCandidato(entrada);
  res.status(201).json(resultado);
};

export const cadastrarEmpresa: RequestHandler = async (req, res) => {
  const entrada = cadastroEmpresaSchema.parse(req.body);
  const resultado = await servico.cadastrarEmpresa(entrada);
  res.status(201).json(resultado);
};

export const login: RequestHandler = async (req, res) => {
  const entrada = loginSchema.parse(req.body);
  const resultado = await servico.login(entrada);
  res.status(200).json(resultado);
};
