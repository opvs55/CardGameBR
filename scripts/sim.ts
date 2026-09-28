// Roda partidas bot x bot no terminal.
//   npm run sim            -> uma partida narrada (seed aleatória)
//   npm run sim -- 42      -> partida narrada com seed 42
//   npm run sim -- --n 500 -> estatística de 500 partidas (alternando quem começa)
import { applyAction, botAction, getHero, startGame, STARTER_DECKS } from '../src/engine';
import type { GameState, Winner } from '../src/engine';

const [deckA, deckB] = STARTER_DECKS;

function play(seed: number, narrate: boolean, swap = false): { winner: Winner; turns: number; actions: number } {
  const [first, second] = swap ? [deckB, deckA] : [deckA, deckB];
  let { state, log } = startGame(first.cards, second.cards, first.hero, second.hero, seed);
  let actions = 0;
  const print = (s: GameState, lines: typeof log) => {
    if (!narrate) return;
    for (const e of lines) {
      if (e.type === 'draw') continue;
      if (e.type === 'turn') {
        const hp = s.players.map((p) => `${getHero(p.hero.heroId).name} ${p.hero.hp}`).join(' x ');
        console.log(`\n== ${e.text}  (${hp})`);
      } else console.log(`   ${e.text}`);
    }
  };
  print(state, log);
  while (state.winner === null) {
    const r = applyAction(state, botAction(state));
    state = r.state;
    actions++;
    if (actions > 5000) throw new Error(`partida travada (seed ${seed})`);
    print(state, r.log);
  }
  // Traduz o vencedor de volta para deckA = 0 / deckB = 1.
  const winner: Winner = state.winner === 'draw' ? 'draw' : swap ? (state.winner === 0 ? 1 : 0) : state.winner;
  return { winner, turns: state.turn, actions };
}

const args = process.argv.slice(2);
const nIdx = args.indexOf('--n');
if (nIdx >= 0) {
  const n = Number(args[nIdx + 1] ?? 200);
  const wins = { a: 0, b: 0, draw: 0 };
  let turns = 0;
  let firstWins = 0;
  for (let seed = 1; seed <= n; seed++) {
    const swap = seed % 2 === 0;
    const r = play(seed, false, swap);
    turns += r.turns;
    if (r.winner === 0) wins.a++;
    else if (r.winner === 1) wins.b++;
    else wins.draw++;
    if (r.winner !== 'draw' && r.winner === (swap ? 1 : 0)) firstWins++;
  }
  console.log(`${n} partidas: ${deckA.name} ${wins.a} · ${deckB.name} ${wins.b} · empates ${wins.draw}`);
  console.log(`quem começa vence ${((firstWins / n) * 100).toFixed(0)}% · média de ${(turns / n / 2).toFixed(1)} rodadas`);
} else {
  const seed = args[0] ? Number(args[0]) : Math.floor(Math.random() * 1e9);
  console.log(`${deckA.name} x ${deckB.name} — seed ${seed}`);
  const r = play(seed, true);
  console.log(`\nResultado: ${r.winner === 'draw' ? 'empate' : r.winner === 0 ? deckA.name : deckB.name} em ${r.turns} turnos.`);
}
