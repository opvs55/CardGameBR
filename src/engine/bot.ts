import { getCard } from './cards';
import type { Rng } from './rng';
import { shuffle } from './rng';
import { other } from './state';
import type { GameState, Move, Side } from './types';
import { MAX_PLAYS } from './types';

/** Bot simples: joga as cartas mais caras que cabem e às vezes dá um Tapa aleatório. */
export function botMove(state: GameState, side: Side, rng: Rng): Move {
  const me = state.players[side];
  const opp = state.players[other(side)];
  const empty = shuffle(rng, me.row.flatMap((c, i) => (c ? [] : [i])));
  // Prefere carteiras com alguém na frente para brigar; senão, qualquer uma.
  empty.sort((a, b) => Number(!!opp.row[b]) - Number(!!opp.row[a]));

  const hand = [...me.hand].sort((a, b) => getCard(b.defId).cost - getCard(a.defId).cost);
  const plays: Move['plays'] = [];
  let merenda = me.merenda;
  for (const card of hand) {
    if (plays.length >= MAX_PLAYS || plays.length >= empty.length) break;
    const cost = getCard(card.defId).cost;
    if (cost > merenda) continue;
    plays.push({ uid: card.uid, slot: empty[plays.length] });
    merenda -= cost;
  }

  const move: Move = { plays };
  const oppEmpty = opp.row.flatMap((c, i) => (c ? [] : [i]));
  if (me.tapas > 0 && oppEmpty.length > 0 && rng() < 0.3) {
    move.tapSlot = oppEmpty[Math.floor(rng() * oppEmpty.length)];
  }
  return move;
}
