import type { RequestHandler } from 'express';
import * as admin from '../repositories/admin.repository.js';

// Sem service: não há regra de negócio, só agregação. A rota já restringe a `admin`.
export const snapshot: RequestHandler = async (_req, res) => {
  res.json(await admin.snapshot());
};
