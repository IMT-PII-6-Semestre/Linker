import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { emTransacao } from '../db/pool.js';
import { conflito, naoAutorizado } from '../errors/app-error.js';
import * as empresas from '../repositories/empresa.repository.js';
import * as perfis from '../repositories/perfil-candidato.repository.js';
import * as usuarios from '../repositories/usuario.repository.js';
import * as vagas from '../repositories/vaga.repository.js';
import type {
  EntradaCadastroCandidato,
  EntradaCadastroEmpresa,
  EntradaLogin,
} from '../schemas/auth.schema.js';
import type { TipoUsuario } from '../types/usuario.js';

const CUSTO_BCRYPT = 12;

export async function cadastrarCandidato(entrada: EntradaCadastroCandidato) {
  const senhaHash = await bcrypt.hash(entrada.senha, CUSTO_BCRYPT);

  const { nomeCompleto, cpf, email, celular, senha: _senha, ...perfil } = entrada;

  const usuario = await emTransacao(async (cliente) => {
    const criado = await usuarios.inserirUsuario(cliente, {
      tipo: 'candidato',
      nomeCompleto,
      email,
      senhaHash,
      cpfCnpj: cpf,
      telefone: celular,
    });
    await perfis.inserirPerfilCandidato(cliente, criado.id, perfil);
    return criado;
  }).catch(traduzirErroDeCadastro);

  return { usuario, token: gerarToken(usuario.id, usuario.tipo) };
}

export async function cadastrarEmpresa(entrada: EntradaCadastroEmpresa) {
  const senhaHash = await bcrypt.hash(entrada.senha, CUSTO_BCRYPT);

  const usuario = await emTransacao(async (cliente) => {
    const criado = await usuarios.inserirUsuario(cliente, {
      tipo: 'empresa',
      nomeCompleto: entrada.nomeEmpresa,
      email: entrada.email,
      senhaHash,
      cpfCnpj: entrada.cnpj,
      telefone: entrada.telefone,
    });
    await empresas.inserirEmpresa(cliente, {
      usuarioId: criado.id,
      dataFundacao: entrada.dataFundacao,
      endereco: entrada.endereco,
    });
    // O cadastro da empresa já publica a primeira vaga (etapas "A vaga" e "Requisitos" do front).
    await vagas.inserirVaga(cliente, criado.id, entrada.vaga);
    return criado;
  }).catch(traduzirErroDeCadastro);

  return { usuario, token: gerarToken(usuario.id, usuario.tipo) };
}

export async function login(entrada: EntradaLogin) {
  const credencial = await usuarios.buscarCredencialPorEmail(entrada.email);
  // Mensagem genérica nos dois casos: não revele se o e-mail existe.
  if (!credencial) throw naoAutorizado('E-mail ou senha inválidos');

  const confere = await bcrypt.compare(entrada.senha, credencial.senhaHash);
  if (!confere) throw naoAutorizado('E-mail ou senha inválidos');

  // Mesmo formato do cadastro: o front monta a Session a partir de `usuario`.
  const { usuario } = credencial;
  return { usuario, token: gerarToken(usuario.id, usuario.tipo) };
}

// 23505 = unique_violation; o índice único de `usuario.email` é a única fonte
// confiável de "e-mail já existe" (checar antes tem corrida).
function traduzirErroDeCadastro(erro: any): never {
  if (erro?.code === '23505') throw conflito('E-mail já cadastrado');
  throw erro;
}

function gerarToken(usuarioId: number, tipo: TipoUsuario) {
  return jwt.sign({ tipo }, env.jwtSecret, {
    subject: String(usuarioId),
    // jsonwebtoken tipa expiresIn como união de literais (ex. "7d"); nossa env
    // só garante string em runtime, então o formato é responsabilidade do .env.
    expiresIn: env.jwtExpiraEm as jwt.SignOptions['expiresIn'],
  });
}
