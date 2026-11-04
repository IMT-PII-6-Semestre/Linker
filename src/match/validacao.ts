// Validação do algoritmo sem usuários reais (spec: "Log obrigatório" → "Para validar sem usuários reais").
// Sorteia pesos "ideais" ocultos, simula os swipes de um lado com eles e confere se uma regressão
// logística, vendo só features → like/pass, recupera esses pesos. Tudo puro e com semente.

/** PRNG com semente (mulberry32): o mesmo resultado a cada execução. `Math.random` não serve aqui. */
export function mulberry32(semente: number): () => number {
  let a = semente | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sigmoide = (z: number) => 1 / (1 + Math.exp(-z));

/** Pesos positivos que somam 1. O piso de 0,1 evita um peso tão pequeno que some no ruído. */
export function sortearPesos(rng: () => number, n: number): number[] {
  const crus = Array.from({ length: n }, () => 0.1 + rng());
  const soma = crus.reduce((a, b) => a + b, 0);
  return crus.map((p) => p / soma);
}

/**
 * Features independentes e uniformes em [0, 1] (correlacionadas, a regressão dividiria o peso entre
 * elas e a comparação deixaria de ser justa). Like com p = sigmoide(β·(w·x − 0,5)): como w soma 1, w·x
 * fica centrado em 0,5 e os likes ficam perto de 50%. β grande = decisão nítida; β pequeno = quase moeda.
 */
export function simularSwipes(rng: () => number, pesos: number[], n: number, beta: number) {
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = pesos.map(() => rng());
    const score = x.reduce((s, v, j) => s + v * pesos[j], 0);
    X.push(x);
    y.push(rng() < sigmoide(beta * (score - 0.5)) ? 1 : 0);
  }
  return { X, y };
}

export interface OpcoesTreino {
  lr?: number;
  epocas?: number;
  /** Para quando a log-loss média varia menos que isto entre duas épocas. */
  tol?: number;
}

/**
 * Regressão logística com intercepto, gradiente descendente em lote. Features em [0, 1] dispensam padronizar.
 * ponytail: lote inteiro a cada época, O(épocas · n · d); sobra para alguns milhares de swipes. Passar a
 * mini-lote ou a um solver (Newton/IRLS) se os swipes reais chegarem a centenas de milhares.
 */
export function treinarLogistica(X: number[][], y: number[], { lr = 2, epocas = 3000, tol = 1e-9 }: OpcoesTreino = {}) {
  const n = X.length;
  const d = X[0]?.length ?? 0;
  const coef = new Array<number>(d).fill(0);
  let intercepto = 0;
  let perdaAnterior = Infinity;
  for (let e = 0; e < epocas; e++) {
    const grad = new Array<number>(d).fill(0);
    let gradB = 0;
    let perda = 0;
    for (let i = 0; i < n; i++) {
      let z = intercepto;
      for (let j = 0; j < d; j++) z += coef[j] * X[i][j];
      const p = sigmoide(z);
      const erro = p - y[i];
      gradB += erro;
      for (let j = 0; j < d; j++) grad[j] += erro * X[i][j];
      const pc = Math.min(1 - 1e-12, Math.max(1e-12, p));
      perda -= y[i] * Math.log(pc) + (1 - y[i]) * Math.log(1 - pc);
    }
    intercepto -= (lr * gradB) / n;
    for (let j = 0; j < d; j++) coef[j] -= (lr * grad[j]) / n;
    if (Math.abs(perdaAnterior - perda / n) < tol) break;
    perdaAnterior = perda / n;
  }
  return { coef, intercepto };
}

/** Coeficiente negativo vira 0 (spec) e o resto é normalizado para somar 1. Tudo ≤ 0 devolve zeros. */
export function normalizar(coef: number[]): number[] {
  const positivos = coef.map((c) => Math.max(0, c));
  const soma = positivos.reduce((a, b) => a + b, 0);
  return soma === 0 ? positivos : positivos.map((c) => c / soma);
}

export interface ResultadoLado {
  ocultos: Record<string, number>;
  estimados: Record<string, number>;
  erros: Record<string, number>;
  erroMax: number;
}

/** Um lado inteiro: sorteia os pesos ocultos, simula `n` swipes, treina e compara feature a feature. */
export function validarLado(
  rng: () => number,
  features: string[],
  { n = 5000, beta = 10, ...treino }: { n?: number; beta?: number } & OpcoesTreino = {},
): ResultadoLado {
  const ocultos = sortearPesos(rng, features.length);
  const { X, y } = simularSwipes(rng, ocultos, n, beta);
  const estimados = normalizar(treinarLogistica(X, y, treino).coef);
  const porFeature = (v: number[]) => Object.fromEntries(features.map((f, i) => [f, v[i]]));
  const erros = features.map((_, i) => Math.abs(estimados[i] - ocultos[i]));
  return { ocultos: porFeature(ocultos), estimados: porFeature(estimados), erros: porFeature(erros), erroMax: Math.max(...erros) };
}
