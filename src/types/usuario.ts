export type TipoUsuario = 'candidato' | 'empresa' | 'admin';

export interface Usuario {
  id: number;
  tipo: TipoUsuario;
  nomeCompleto: string;
  email: string;
  criadoEm: Date;
}
