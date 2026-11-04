import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { naoAutorizado, proibido } from '../errors/app-error.js';
import type { TipoUsuario } from '../types/usuario.js';

export const autenticar: RequestHandler = (req, _res, next) => {
  const [esquema, token] = (req.headers.authorization ?? '').split(' ');
  if (esquema !== 'Bearer' || !token) return next(naoAutorizado('Token ausente'));
  try {
    // `audience` torna a claim `aud` obrigatória: token sem ela (ou de outro sistema) é recusado.
    const payload = jwt.verify(token, env.jwtSecret, {
      audience: ['app', 'contratador'],
    }) as jwt.JwtPayload;
    req.usuario = { id: Number(payload.sub), tipo: payload.tipo };
    next();
  } catch {
    next(naoAutorizado('Token inválido ou expirado'));
  }
};

/** Usar depois de `autenticar`. */
export const exigirTipo =
  (...tipos: TipoUsuario[]): RequestHandler =>
  (req, _res, next) =>
    tipos.includes(req.usuario!.tipo) ? next() : next(proibido());
