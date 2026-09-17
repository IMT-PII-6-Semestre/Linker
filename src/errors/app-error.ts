export class AppError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export const invalido = (m: string) => new AppError(400, m);
export const naoAutorizado = (m = 'Não autorizado') => new AppError(401, m);
export const proibido = (m = 'Acesso negado') => new AppError(403, m);
export const naoEncontrado = (m = 'Recurso não encontrado') => new AppError(404, m);
export const conflito = (m: string) => new AppError(409, m);
