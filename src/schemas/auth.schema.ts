import { z } from 'zod';

// bcrypt trunca em 72 bytes — não faz sentido aceitar senha maior que isso.
const senhaSchema = z.string().min(8, 'Senha deve ter ao menos 8 caracteres').max(72);
const cepSchema = z.string().regex(/^\d{8}$/, 'CEP deve ter 8 dígitos').optional();

export const cadastroCandidatoSchema = z.object({
  nomeCompleto: z.string().trim().min(1, 'Nome obrigatório').max(200),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  senha: senhaSchema,
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos'),
  idade: z.coerce.number().int().positive().max(120).optional(),
  cep: cepSchema,
});
export type EntradaCadastroCandidato = z.infer<typeof cadastroCandidatoSchema>;

export const cadastroEmpresaSchema = z.object({
  nomeCompleto: z.string().trim().min(1, 'Nome do contato obrigatório').max(200),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  senha: senhaSchema,
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos'),
  razaoSocial: z.string().trim().min(1, 'Razão social obrigatória').max(200),
  anosFundacao: z.coerce
    .number()
    .int()
    .min(1800)
    .max(new Date().getFullYear())
    .optional(),
  cep: cepSchema,
});
export type EntradaCadastroEmpresa = z.infer<typeof cadastroEmpresaSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  senha: z.string().min(1, 'Senha obrigatória'),
});
export type EntradaLogin = z.infer<typeof loginSchema>;
