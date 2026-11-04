import fs from 'node:fs/promises';
import path from 'node:path';
import { pastaUploads } from '../config/env.js';
import { emTransacao } from '../db/pool.js';
import { conflito, invalido, naoEncontrado } from '../errors/app-error.js';
import * as empresas from '../repositories/empresa.repository.js';
import * as candidatos from '../repositories/perfil-candidato.repository.js';
import * as usuarios from '../repositories/usuario.repository.js';
import * as vagas from '../repositories/vaga.repository.js';
import type { EntradaCadastroCandidato, EntradaCadastroEmpresa } from '../schemas/auth.schema.js';
import type { TipoUsuario } from '../types/usuario.js';
import { geocodificar } from './geocodificacao.service.js';

type EntradaPerfilCandidato = Omit<EntradaCadastroCandidato, 'senha'>;
type EntradaPerfilEmpresa = Omit<EntradaCadastroEmpresa, 'senha' | 'vaga'>;

// O banco guarda só dígitos; o front trabalha com máscara (core/format/masks.ts).
const aplicar = (padrao: string) => (v: string) => {
  let i = 0;
  return padrao.replace(/#/g, () => v[i++] ?? '');
};
const mascaraCpf = aplicar('###.###.###-##');
const mascaraCnpj = aplicar('##.###.###/####-##');
const mascaraCep = aplicar('#####-###');
const mascaraTelefone = (v: string) => aplicar(v.length > 10 ? '(##) #####-####' : '(##) ####-####')(v);

/** Perfil no formato `Profile` do front. Empresa inclui `vagas[]`. */
export async function obterPerfil(id: number, tipo: TipoUsuario) {
  if (tipo === 'candidato') {
    const p = await candidatos.buscarPerfilCandidato(id);
    if (!p) throw naoEncontrado('Perfil não encontrado');
    const { id: _id, fotoUrl, ...campos } = p;
    return {
      role: 'candidato' as const,
      userId: String(id),
      ...campos,
      cpf: mascaraCpf(p.cpf),
      celular: mascaraTelefone(p.celular),
      cep: mascaraCep(p.cep),
      fotoUri: fotoUrl,
    };
  }
  const e = await empresas.buscarPerfilEmpresa(id);
  if (!e) throw naoEncontrado('Perfil não encontrado');
  const { id: _id, fotoUrl, ...campos } = e;
  const lista = await vagas.listarVagasDaEmpresa(id);
  return {
    role: 'empresa' as const,
    userId: String(id),
    ...campos,
    cnpj: mascaraCnpj(e.cnpj),
    telefone: mascaraTelefone(e.telefone),
    fotoUri: fotoUrl,
    vagas: lista.map(({ empresaId: _, cep, ...v }) => ({ ...v, cep: mascaraCep(cep) })),
  };
}

export async function atualizarPerfilCandidato(id: number, entrada: EntradaPerfilCandidato) {
  const { nomeCompleto, cpf, email, celular, ...perfil } = entrada;
  // Só regeocodifica se o CEP mudou: com o mesmo CEP, uma falha da API apagaria a localização.
  // ponytail: perfil que ficou sem localização no cadastro só é refeito quando o CEP mudar.
  const atual = await candidatos.buscarPerfilCandidato(id);
  const local = atual?.cep === perfil.cep ? null : await geocodificar(perfil.cep);
  await emTransacao(async (cliente) => {
    await usuarios.atualizarUsuario(cliente, id, { nomeCompleto, email, cpfCnpj: cpf, telefone: celular });
    await candidatos.atualizarPerfilCandidato(cliente, id, perfil, local);
  }).catch(traduzirEmailDuplicado);
  return obterPerfil(id, 'candidato');
}

export async function atualizarPerfilEmpresa(id: number, entrada: EntradaPerfilEmpresa) {
  await emTransacao(async (cliente) => {
    await usuarios.atualizarUsuario(cliente, id, {
      nomeCompleto: entrada.nomeEmpresa,
      email: entrada.email,
      cpfCnpj: entrada.cnpj,
      telefone: entrada.telefone,
    });
    await empresas.atualizarEmpresa(cliente, id, entrada);
  }).catch(traduzirEmailDuplicado);
  return obterPerfil(id, 'empresa');
}

const EXTENSOES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function salvarFoto(id: number, tipo: TipoUsuario, mime: string | undefined, bytes: unknown) {
  const ext = EXTENSOES[(mime ?? '').split(';')[0]];
  if (!ext) throw invalido('Envie uma imagem JPEG, PNG ou WebP');
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw invalido('Imagem vazia');

  const arquivo = `${id}-${Date.now()}.${ext}`;
  await fs.mkdir(pastaUploads, { recursive: true });
  await fs.writeFile(path.join(pastaUploads, arquivo), bytes);
  await usuarios.atualizarFoto(id, `/uploads/${arquivo}`);
  return obterPerfil(id, tipo);
}

// 23505 = unique_violation; o único índice único tocado aqui é o de `usuario.email`.
function traduzirEmailDuplicado(erro: any): never {
  if (erro?.code === '23505') throw conflito('E-mail já cadastrado');
  throw erro;
}
