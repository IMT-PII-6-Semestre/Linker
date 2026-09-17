import type { TipoUsuario } from './usuario.js';

declare global {
  namespace Express {
    interface Request {
      usuario?: { id: number; tipo: TipoUsuario };
    }
  }
}
export {};
