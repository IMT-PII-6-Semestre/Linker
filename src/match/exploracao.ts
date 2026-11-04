export const EPSILON = 0.15;

export interface Posicionado<T> {
  item: T;
  posicao: number; // 1 = topo
  exploracao: boolean;
}

/**
 * ε-greedy: ordena por score (empate → id menor) e, a cada posição, com chance ε
 * sorteia um item qualquer dos que sobraram. `rng` é injetado para dar para testar.
 * ponytail: splice é O(n²); sobra no volume do PII, trocar por heap/amostragem se o feed passar de milhares.
 */
export function ordenarComExploracao<T extends { score: number; id: number }>(
  itens: T[],
  rng: () => number,
  epsilon = EPSILON,
): Posicionado<T>[] {
  const resto = [...itens].sort((a, b) => b.score - a.score || a.id - b.id);
  const saida: Posicionado<T>[] = [];
  while (resto.length > 0) {
    const explora = rng() < epsilon;
    const i = explora ? Math.min(resto.length - 1, Math.floor(rng() * resto.length)) : 0;
    saida.push({ item: resto.splice(i, 1)[0], posicao: saida.length + 1, exploracao: explora });
  }
  return saida;
}
