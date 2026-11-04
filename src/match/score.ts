export type Features = Record<string, number>;
export interface Pesos {
  A: Record<string, number>;
  B: Record<string, number>;
}

/** Média ponderada das features do lado. Peso total 0 → 0 (nunca NaN). Feature sem peso não conta. */
export function scoreLado(features: Features, pesos: Record<string, number>): number {
  let soma = 0;
  let total = 0;
  for (const [nome, peso] of Object.entries(pesos)) {
    if (!(peso > 0)) continue;
    soma += peso * (features[nome] ?? 0);
    total += peso;
  }
  return total === 0 ? 0 : soma / total;
}

/** Média geométrica: penaliza o desequilíbrio; com A ou B em 0 o par vale 0. */
export const combinar = (a: number, b: number) => Math.sqrt(a * b);
