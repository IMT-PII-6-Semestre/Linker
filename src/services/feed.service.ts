import { EPSILON, ordenarComExploracao } from '../match/exploracao.js';
import * as f from '../match/features.js';
import { combinar, scoreLado } from '../match/score.js';
import * as feed from '../repositories/feed.repository.js';
import type { Lado, Par } from '../repositories/feed.repository.js';
import { vagaDaEmpresa } from './vaga.service.js';

/** Fonte de aleatoriedade do ε-greedy; os testes trocam por uma sequência fixa. */
export const aleatorio = { rng: Math.random };

export interface Filtros {
  query: string;
  uf: string | null;
  vagaId: number | null;
}

const mascaraCep = (cep: string) => cep.replace(/^(\d{5})(\d{3})$/, '$1-$2');
const localTexto = (cidade: string | null, uf: string | null) => (cidade && uf ? `${cidade} - ${uf}` : (uf ?? ''));

/** `FeedPost` do front. O chat (fase 4) reaproveita esta função para o post que gerou o match. */
export function paraPost(par: Par, vistoPor: Lado) {
  if (vistoPor === 'candidato') {
    return {
      kind: 'vaga' as const,
      id: String(par.vaga_id),
      empresaId: String(par.empresa_id),
      empresaNome: par.empresa_nome as string,
      empresaFotoUri: par.empresa_foto as string | null,
      vaga: {
        cargo: par.cargo, descricao: par.descricao, beneficios: par.beneficios, horario: par.horario,
        cep: mascaraCep(par.cep), skillsObrigatorias: par.skills_obrigatorias,
        skillsDesejaveis: par.skills_desejaveis, experienciaMinima: par.experiencia_minima,
        escolaridade: par.v_escolaridade, tipoContrato: par.tipo_contrato,
        faixaSalarial: par.v_faixa_salarial, modalidade: par.modalidade,
      },
      local: localTexto(par.v_cidade, par.v_uf),
      uf: (par.v_uf ?? '') as string,
    };
  }
  return {
    kind: 'candidato' as const,
    id: String(par.candidato_id),
    candidatoId: String(par.candidato_id),
    nome: par.candidato_nome as string,
    idade: par.idade as number,
    fotoUri: par.candidato_foto as string | null,
    cargoDesejado: par.cargo_desejado as string,
    escolaridade: par.c_escolaridade as string,
    formacao: par.formacao as string,
    experiencias: par.experiencias as string,
    anosExperiencia: par.anos_experiencia as number,
    hardSkills: par.hard_skills as string[],
    softSkills: par.soft_skills as string[],
    modalidades: par.modalidades as string[],
    tiposContrato: par.tipos_contrato as string[],
    faixaSalarial: par.c_faixa_salarial as string,
    local: localTexto(par.c_cidade, par.c_uf),
    uf: (par.c_uf ?? '') as string,
  };
}

/** Mesma regra do `matchesFilters` do front: todas as palavras da busca aparecem em algum campo. */
function passaNosFiltros(post: ReturnType<typeof paraPost>, { query, uf }: Filtros): boolean {
  if (uf && post.uf !== uf) return false;
  const palavras = f.norm(query).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return true;
  const campos =
    post.kind === 'vaga'
      ? [post.empresaNome, post.vaga.cargo, post.vaga.descricao, post.vaga.beneficios, post.vaga.modalidade, post.vaga.tipoContrato, post.local]
      : [post.nome, post.cargoDesejado, post.formacao, post.experiencias, ...post.hardSkills, ...post.softSkills, ...post.modalidades, post.local];
  const palheiro = f.norm(campos.join(' '));
  return palavras.every((p) => palheiro.includes(p));
}

function pontuar(par: Par) {
  const cand: f.Local = {
    cidade: par.c_cidade, uf: par.c_uf, coord: par.c_lat == null || par.c_lng == null ? null : { lat: par.c_lat, lng: par.c_lng },
  };
  const vaga: f.Local = {
    cidade: par.v_cidade, uf: par.v_uf, coord: par.v_lat == null || par.v_lng == null ? null : { lat: par.v_lat, lng: par.v_lng },
  };
  const local = f.localizacao(cand, vaga, par.modalidade === 'Remoto');
  const cargo = Math.min(1, Math.max(0, par.sim_cargo));
  const featuresA = { cargo, salario: f.salario(par.c_faixa_salarial, par.v_faixa_salarial), local };
  const featuresB = {
    cargo,
    skills: f.skills([...par.hard_skills, ...par.soft_skills], par.skills_obrigatorias, par.skills_desejaveis),
    experiencia: f.experiencia(par.anos_experiencia, par.experiencia_minima),
    escolaridade: f.escolaridade(par.c_escolaridade, par.v_escolaridade),
    texto: Math.min(1, Math.max(0, par.rank_texto)),
    local,
  };
  return { featuresA, featuresB };
}

/**
 * Feed ordenado por score. Candidato vê vagas; empresa vê candidatos de uma vaga dela.
 * ponytail: o score é calculado em TypeScript sobre todos os pares filtrados (O(n) por request) e a
 * lista volta inteira, sem paginação. Sobra no volume do PII; mover o score para SQL ou cache e
 * paginar se o feed passar de alguns milhares de pares.
 */
export async function listarFeed(usuario: { id: number; tipo: 'candidato' | 'empresa' }, filtros: Filtros) {
  const vistoPor: Lado = usuario.tipo;
  if (vistoPor === 'empresa') {
    if (filtros.vagaId === null) return []; // sem vaga escolhida, o feed da empresa é vazio (igual ao fake do front)
    await vagaDaEmpresa(filtros.vagaId, usuario.id);
  }
  const [pares, { versao, pesos }] = await Promise.all([
    feed.paresDoFeed({
      candidatoId: vistoPor === 'candidato' ? usuario.id : null,
      vagaId: vistoPor === 'empresa' ? filtros.vagaId : null,
      vistoPor,
    }),
    feed.pesosAtivos(),
  ]);

  const candidatos = pares
    .map((par) => ({ par, post: paraPost(par, vistoPor) }))
    .filter(({ post }) => passaNosFiltros(post, filtros))
    .map(({ par, post }) => {
      const { featuresA, featuresB } = pontuar(par);
      const scoreA = scoreLado(featuresA, pesos.A);
      const scoreB = scoreLado(featuresB, pesos.B);
      return { id: Number(post.id), score: combinar(scoreA, scoreB), post, par, featuresA, featuresB, scoreA, scoreB };
    });

  const ordenado = ordenarComExploracao(candidatos, aleatorio.rng, EPSILON);
  await feed.registrarExibicoes(
    vistoPor,
    versao,
    ordenado.map(({ item, posicao, exploracao }) => ({
      candidato_id: item.par.candidato_id,
      vaga_id: item.par.vaga_id,
      posicao,
      exploracao,
      features_a: item.featuresA,
      features_b: item.featuresB,
      score_a: item.scoreA,
      score_b: item.scoreB,
      score_final: item.score,
    })),
  );
  return ordenado.map(({ item }) => item.post);
}
