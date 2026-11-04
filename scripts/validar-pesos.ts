// Validação do algoritmo de match com swipes sintéticos (fase 6):
//   npm run match:validar [-- --n=5000 --seed=2026 --beta=10 --salvar]
// Sorteia pesos "ideais" ocultos, simula os swipes de cada lado, treina uma regressão logística por
// lado e imprime o erro por feature. `--salvar` grava os pesos estimados como uma nova versão de
// `config_pesos`, INATIVA: ativar é uma decisão separada (UPDATE impresso no final).
import { pool } from '../src/db/pool.js';
import type { Pesos } from '../src/match/score.js';
import { mulberry32, validarLado } from '../src/match/validacao.js';
import { pesosAtivos, salvarPesos } from '../src/repositories/feed.repository.js';

const LIMITE = 0.1;
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const numero = (nome: string, padrao: number) => {
  const v = args[nome] === undefined ? padrao : Number(args[nome]);
  if (!Number.isFinite(v) || v <= 0) throw new Error(`--${nome} inválido: ${args[nome]}`);
  return v;
};
const n = numero('n', 5000);
const semente = numero('seed', 2026);
const beta = numero('beta', 10);
const salvar = 'salvar' in args;

try {
  const { versao, pesos } = await pesosAtivos();
  const rng = mulberry32(semente);
  const estimados: Pesos = { A: {}, B: {} };
  let falhou = false;

  console.log(`Pesos ativos: v${versao} · ${n} swipes sintéticos por lado · β=${beta} · semente=${semente}\n`);
  for (const lado of ['A', 'B'] as const) {
    const r = validarLado(rng, Object.keys(pesos[lado]), { n, beta });
    console.log(`Lado ${lado} (${lado === 'A' ? 'candidato' : 'empresa'})`);
    console.log('  feature        oculto  estimado  erro');
    for (const f of Object.keys(r.ocultos)) {
      console.log(`  ${f.padEnd(14)} ${r.ocultos[f].toFixed(3)}   ${r.estimados[f].toFixed(3)}    ${r.erros[f].toFixed(3)}`);
    }
    const ok = r.erroMax < LIMITE;
    falhou ||= !ok;
    console.log(`  erro máximo ${r.erroMax.toFixed(3)} ${ok ? 'OK' : `ACIMA DE ${LIMITE}`}\n`);
    estimados[lado] = r.estimados;
  }

  if (salvar) {
    if ([estimados.A, estimados.B].some((e) => Object.values(e).every((v) => v === 0))) {
      throw new Error('Pesos estimados todos zero: nada para salvar');
    }
    const nova = await salvarPesos(estimados);
    console.log(`Gravado config_pesos v${nova} (inativa). Para ativar:\n` +
      `  UPDATE config_pesos SET ativa = (versao = ${nova});`);
  } else {
    console.log('Nada gravado (use --salvar para gravar uma nova versão inativa).');
  }
  process.exitCode = falhou ? 1 : 0;
} finally {
  await pool.end();
}
