import 'dotenv/config';

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return valor;
}

export const env = {
  porta: Number(process.env.PORT ?? 3000),
  databaseUrl: obrigatoria('DATABASE_URL'),
  jwtSecret: obrigatoria('JWT_SECRET'),
  jwtExpiraEm: process.env.JWT_EXPIRES_IN ?? '7d',
};
