import { z } from 'zod';

// Contrato = payload do front (Linker-front-rn, src/features/auth/domain/registration.ts).
// O front manda os campos com máscara (CPF "123.456.789-09", data "dd/mm/aaaa");
// aqui eles são normalizados para o formato do banco.

// Opções fixas (chips do front). Mudou lá, muda aqui.
export const ESCOLARIDADES = [
  'Fundamental',
  'Médio',
  'Técnico',
  'Superior em andamento',
  'Superior completo',
  'Pós-graduação',
] as const;
export const TIPOS_CONTRATO = ['CLT', 'PJ', 'Estágio', 'Temporário', 'Freelancer', 'Jovem Aprendiz'] as const;
export const MODALIDADES = ['Presencial', 'Híbrido', 'Remoto'] as const;
export const FAIXAS_SALARIAIS = [
  'Até R$ 2 mil',
  'R$ 2 a 4 mil',
  'R$ 4 a 6 mil',
  'R$ 6 a 10 mil',
  'Acima de R$ 10 mil',
  'A combinar',
] as const;

/** Idade mínima para trabalhar no Brasil (aprendiz) — mesma regra do front. */
const IDADE_MINIMA = 14;

// bcrypt trunca em 72 bytes — não faz sentido aceitar senha maior que isso.
// O mínimo acompanha o front (MIN_PASSWORD_LENGTH).
const senhaSchema = z.string().min(6, 'Senha deve ter ao menos 6 caracteres').max(72);
const emailSchema = z.string().trim().toLowerCase().email('E-mail inválido');
const texto = (mensagem: string, max = 200) => z.string().trim().min(1, mensagem).max(max);
const skillsSchema = z.array(z.string().trim().min(1).max(50)).max(30);

const somenteDigitos = z.string().transform((valor) => valor.replace(/\D+/g, ''));

export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (tamanho: number) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

export function cnpjValido(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const digito = (tamanho: number) => {
    const pesos = tamanho === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const resto = pesos.reduce((soma, peso, i) => soma + Number(cnpj[i]) * peso, 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return digito(12) === Number(cnpj[12]) && digito(13) === Number(cnpj[13]);
}

/** "dd/mm/aaaa" → "aaaa-mm-dd" (DATE do Postgres). Recusa datas que não existem (31/02). */
const dataBrSchema = z.string().transform((valor, ctx) => {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor.trim());
  const [dia, mes, ano] = partes ? partes.slice(1).map(Number) : [];
  const data = partes && new Date(Date.UTC(ano, mes - 1, dia));
  if (!data || data.getUTCDate() !== dia || data.getUTCMonth() !== mes - 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Data inválida. Use dd/mm/aaaa' });
    return z.NEVER;
  }
  return data.toISOString().slice(0, 10);
});

/** Anos completos entre a data ISO e hoje; negativo se a data estiver no futuro. */
export function anosDesde(iso: string, hoje = new Date()): number {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const mesHoje = hoje.getMonth() + 1;
  const antesDoAniversario = mesHoje < mes || (mesHoje === mes && hoje.getDate() < dia);
  return hoje.getFullYear() - ano - (antesDoAniversario ? 1 : 0);
}

export const cadastroCandidatoSchema = z.object({
  nomeCompleto: texto('Nome obrigatório'),
  cpf: somenteDigitos.refine(cpfValido, 'CPF inválido'),
  // pipe: o refine só roda se a data for válida (com transform + refine, roda mesmo com erro).
  dataNascimento: dataBrSchema.pipe(
    z.string().refine((iso) => {
      const idade = anosDesde(iso);
      return idade >= IDADE_MINIMA && idade <= 100;
    }, `Idade deve estar entre ${IDADE_MINIMA} e 100 anos`),
  ),
  email: emailSchema,
  celular: somenteDigitos.refine((v) => /^\d{2}9\d{8}$/.test(v), 'Celular inválido. Use DDD + 9 dígitos'),
  escolaridade: z.enum(ESCOLARIDADES),
  cargoDesejado: texto('Cargo desejado obrigatório'),
  formacao: texto('Formação obrigatória', 500),
  cep: somenteDigitos.refine((v) => /^\d{8}$/.test(v), 'CEP deve ter 8 dígitos'),
  tiposContrato: z.array(z.enum(TIPOS_CONTRATO)).min(1, 'Escolha ao menos um tipo de contrato'),
  experiencias: texto('Experiências obrigatórias', 2000),
  anosExperiencia: z.number().int().min(0).max(60),
  faixaSalarial: z.enum(FAIXAS_SALARIAIS),
  hardSkills: skillsSchema.min(1, 'Adicione ao menos uma hard skill'),
  softSkills: skillsSchema.min(1, 'Adicione ao menos uma soft skill'),
  modalidades: z.array(z.enum(MODALIDADES)).min(1, 'Escolha ao menos uma modalidade'),
  senha: senhaSchema,
});
export type EntradaCadastroCandidato = z.infer<typeof cadastroCandidatoSchema>;

/** Vaga (VagaInfo no front). Reaproveitar no CRUD de vagas. */
export const vagaSchema = z.object({
  cargo: texto('Cargo obrigatório'),
  descricao: texto('Descrição obrigatória', 2000),
  beneficios: texto('Benefícios obrigatórios', 1000),
  horario: texto('Horário obrigatório'),
  cep: somenteDigitos.refine((v) => /^\d{8}$/.test(v), 'CEP deve ter 8 dígitos'),
  skillsObrigatorias: skillsSchema.min(1, 'Adicione ao menos uma skill obrigatória'),
  skillsDesejaveis: skillsSchema,
  experienciaMinima: z.number().int().min(0).max(60),
  escolaridade: z.enum(ESCOLARIDADES),
  tipoContrato: z.enum(TIPOS_CONTRATO),
  faixaSalarial: z.enum(FAIXAS_SALARIAIS),
  modalidade: z.enum(MODALIDADES),
});
export type EntradaVaga = z.infer<typeof vagaSchema>;

export const cadastroEmpresaSchema = z.object({
  cnpj: somenteDigitos.refine(cnpjValido, 'CNPJ inválido'),
  nomeEmpresa: texto('Nome da empresa obrigatório'),
  dataFundacao: dataBrSchema.pipe(
    z.string().refine((iso) => anosDesde(iso) >= 0, 'A data de fundação não pode estar no futuro'),
  ),
  endereco: texto('Endereço obrigatório', 300),
  telefone: somenteDigitos.refine((v) => /^\d{10,11}$/.test(v), 'Telefone inválido. Inclua o DDD'),
  email: emailSchema,
  vaga: vagaSchema,
  senha: senhaSchema,
});
export type EntradaCadastroEmpresa = z.infer<typeof cadastroEmpresaSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1, 'Senha obrigatória'),
});
export type EntradaLogin = z.infer<typeof loginSchema>;
