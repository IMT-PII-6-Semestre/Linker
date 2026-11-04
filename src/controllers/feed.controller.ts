import type { RequestHandler } from 'express';
import { z } from 'zod';
import * as feed from '../services/feed.service.js';
import * as swipe from '../services/swipe.service.js';

// Query string vazia (`?uf=`) vale como ausente.
const opcional = <T extends z.ZodTypeAny>(s: T) => z.preprocess((v) => (v === '' || v == null ? undefined : v), s.optional());
const id = z.coerce.number().int().min(1);

const feedQuerySchema = z.object({
  query: z.string().default(''),
  uf: opcional(z.string().regex(/^[A-Za-z]{2}$/, 'UF inválida').transform((s) => s.toUpperCase())),
  vagaId: opcional(id),
});

const swipeSchema = z.object({
  postId: id,
  direction: z.enum(['like', 'pass']),
  vagaId: opcional(id),
});

// A rota só deixa passar candidato e empresa (exigirTipo).
const quem = (req: Parameters<RequestHandler>[0]) => req.usuario as { id: number; tipo: 'candidato' | 'empresa' };

export const listar: RequestHandler = async (req, res) => {
  const q = feedQuerySchema.parse(req.query);
  res.json(await feed.listarFeed(quem(req), { query: q.query, uf: q.uf ?? null, vagaId: q.vagaId ?? null }));
};

export const curtir: RequestHandler = async (req, res) => {
  const { postId, direction, vagaId } = swipeSchema.parse(req.body);
  const usuario = quem(req);
  if (usuario.tipo === 'empresa' && vagaId === undefined) {
    return void res.status(400).json({ erro: 'A empresa precisa informar a vaga (vagaId)' });
  }
  res.json(await swipe.registrarSwipe(usuario, { postId, direction, vagaId: vagaId ?? null }));
};
