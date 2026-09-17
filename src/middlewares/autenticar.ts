import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { naoAutorizado } from '../errors/app-error.js';

export const autenticar: RequestHandler = (req, _res, next) => {
  const [esquema, token] = (req.headers.authorization ?? '').split(' ');
  if (esquema !== 'Bearer' || !token) return next(naoAutorizado('Token ausente'));
  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    req.usuario = { id: Number(payload.sub), tipo: payload.tipo };
    next();
  } catch {
    next(naoAutorizado('Token inválido ou expirado'));
  }
};
