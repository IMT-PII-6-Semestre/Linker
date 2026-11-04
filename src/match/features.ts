import { ESCOLARIDADES, FAIXAS_SALARIAIS } from '../schemas/auth.schema.js';

// Funções puras: cada feature recebe só o que precisa e devolve um número em [0, 1].

export interface Coordenada {
  lat: number;
  lng: number;
}
export interface Local {
  cidade: string | null;
  uf: string | null;
  coord: Coordenada | null;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** Minúsculas e sem acento, para comparar skills. */
export const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** Cobertura ponderada: obrigatória pesa 2×, desejável 1×. Vaga que não pede skill vale 1. */
export function skills(candidato: string[], obrigatorias: string[], desejaveis: string[]): number {
  const tem = new Set(candidato.map(norm));
  const cobertas = (lista: string[]) => lista.filter((s) => tem.has(norm(s))).length;
  const total = 2 * obrigatorias.length + desejaveis.length;
  if (total === 0) return 1;
  return clamp01((2 * cobertas(obrigatorias) + cobertas(desejaveis)) / total);
}

export function experiencia(anos: number, minimo: number): number {
  return minimo <= 0 ? 1 : clamp01(anos / minimo);
}

const PASSO = 0.25;

/** Perde 0,25 por nível abaixo do pedido; acima do pedido não ganha nem perde. */
export function escolaridade(tem: string, pedida: string): number {
  const a = ESCOLARIDADES.indexOf(tem as never);
  const b = ESCOLARIDADES.indexOf(pedida as never);
  if (a < 0 || b < 0) return 0;
  return clamp01(1 - PASSO * Math.max(0, b - a));
}

export const SALARIO_A_COMBINAR = 0.6;

/** Perde 0,25 por faixa de distância; "A combinar" em qualquer lado vale 0,6. */
export function salario(candidato: string, vaga: string): number {
  const combinar = (f: string) => f === 'A combinar';
  if (combinar(candidato) || combinar(vaga)) return SALARIO_A_COMBINAR;
  const a = FAIXAS_SALARIAIS.indexOf(candidato as never);
  const b = FAIXAS_SALARIAIS.indexOf(vaga as never);
  if (a < 0 || b < 0) return 0;
  return clamp01(1 - PASSO * Math.abs(a - b));
}

export function haversineKm(a: Coordenada, b: Coordenada): number {
  const rad = Math.PI / 180;
  const R = 6371;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const LOCAL_NEUTRO = 0.5;

/** Remota = 1; com coordenadas, decaimento exp(-d/50km); senão cidade/UF; sem dado nenhum, neutro. */
export function localizacao(candidato: Local, vaga: Local, remota: boolean): number {
  if (remota) return 1;
  if (candidato.coord && vaga.coord) return clamp01(Math.exp(-haversineKm(candidato.coord, vaga.coord) / 50));
  if (!candidato.uf || !vaga.uf) return LOCAL_NEUTRO;
  if (candidato.uf !== vaga.uf) return 0.3;
  return candidato.cidade && vaga.cidade && norm(candidato.cidade) === norm(vaga.cidade) ? 1 : 0.6;
}
