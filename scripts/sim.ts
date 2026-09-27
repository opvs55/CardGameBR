// Roda partidas bot x bot no terminal.
//   npm run sim            -> uma partida narrada (seed aleatória)
//   npm run sim -- 42      -> partida narrada com seed 42
//   npm run sim -- --n 500 -> estatística de 500 partidas
import { botMove, deriveSeed, mulberry32, resolveRound, startMatch, STARTER_DECKS } from '../src/engine';
import type { GameState, Winner } from '../src/engine';

const [deckA, deckB] = STARTER_DECKS;

function play(seed: number, narrate: boolean): { winner: Winner; rounds: number } {
  let { state, log } = startMatch(deckA.cards, deckB.cards, seed);
  const rng = mulberry32(deriveSeed(seed, 999));
  const print = (s: GameState, lines: typeof log) => {
    if (!narrate) return;
    for (const e of lines) {
      if (e.type === 'draw') continue;
      const who = 'side' in e ? (e.side === 0 ? 'A' : 'B') : ' ';
      console.log(e.type === 'round' ? `\n== ${e.text}  (Moral A ${s.players[0].moral} x ${s.players[1].moral} B)` : `  [${who}] ${e.text}`);
    }
  };
  print(state, log);
  while (state.winner === null) {
    const r = resolveRound(state, botMove(state, 0, rng), botMove(state, 1, rng));
    state = r.state;
    print(state, r.log);
  }
  return { winner: state.winner, rounds: state.round };
}

const args = process.argv.slice(2);
const nIdx = args.indexOf('--n');
if (nIdx >= 0) {
  const n = Number(args[nIdx + 1] ?? 200);
  const wins = { a: 0, b: 0, draw: 0 };
  let rounds = 0;
  for (let seed = 1; seed <= n; seed++) {
    const r = play(seed, false);
    rounds += r.rounds;
    if (r.winner === 0) wins.a++;
    else if (r.winner === 1) wins.b++;
    else wins.draw++;
  }
  console.log(`${n} partidas: ${deckA.name} ${wins.a} · ${deckB.name} ${wins.b} · empates ${wins.draw}`);
  console.log(`média de ${(rounds / n).toFixed(1)} rodadas por partida`);
} else {
  const seed = args[0] ? Number(args[0]) : Math.floor(Math.random() * 1e9);
  console.log(`${deckA.name} (A) x ${deckB.name} (B) — seed ${seed}`);
  const r = play(seed, true);
  console.log(`\nResultado: ${r.winner === 'draw' ? 'empate' : r.winner === 0 ? deckA.name : deckB.name} em ${r.rounds} rodadas.`);
}
