import { z } from 'zod';

// Mesmos valores de REPORT_REASONS / MAX_MESSAGE_LENGTH do front (features/chat/domain/chat.ts)
// e do CHECK de `denuncia.motivo` em db/init/05-chat.sql. Mudou lá, muda aqui.
export const REPORT_REASONS = [
  'Spam ou propaganda',
  'Comportamento ofensivo',
  'Vaga ou perfil falso',
  'Pediu dinheiro ou dados bancários',
  'Outro motivo',
] as const;
export const MAX_MESSAGE_LENGTH = 1000;

export const mensagemSchema = z.object({
  text: z.string().trim().min(1, 'Mensagem vazia').max(MAX_MESSAGE_LENGTH, `Máximo de ${MAX_MESSAGE_LENGTH} caracteres`),
});

export const denunciaSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).default(''),
});
