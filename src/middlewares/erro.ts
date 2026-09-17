import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';

/** Express 4 não captura rejeição de async handler — envolva todo controller. */
export const assincrono =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

export const tratarErro: ErrorRequestHandler = (erro, _req, res, _next) => {
  if (erro instanceof ZodError) {
    return res.status(400).json({ erro: 'Dados inválidos', detalhes: erro.issues });
  }
  if (erro instanceof AppError) {
    return res.status(erro.status).json({ erro: erro.message });
  }
  console.error(erro);
  return res.status(500).json({ erro: 'Erro interno' });
};
