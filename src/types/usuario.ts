export type TipoUsuario = 'candidato' | 'empresa';

export interface Usuario {
  id: number;
  tipo: TipoUsuario;
  nomeCompleto: string;
  email: string;
  criadoEm: Date;
}
