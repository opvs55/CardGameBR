import { createState, newInPlay } from './state';
import type { GameState, Move, Side } from './types';

export interface SideSetup {
  row?: (string | null)[];
  hand?: string[];
  deck?: string[];
  merenda?: number;
  tapas?: number;
  moral?: number;
}

/** Monta uma mesa sob medida para testar combos. `round` é a rodada em andamento. */
export function mkState(opts: { round?: number; seed?: number; a?: SideSetup; b?: SideSetup } = {}): GameState {
  const round = opts.round ?? 1;
  const state = createState([], [], opts.seed ?? 42);
  state.round = round;
  ([0, 1] as Side[]).forEach((side) => {
    const setup = (side === 0 ? opts.a : opts.b) ?? {};
    const p = state.players[side];
    const tag = side === 0 ? 'a' : 'b';
    p.row = [0, 1, 2, 3, 4].map((slot) => {
      const id = setup.row?.[slot];
      return id ? newInPlay({ uid: `${tag}-r${slot}`, defId: id }, round - 1) : null;
    });
    p.hand = (setup.hand ?? []).map((defId, i) => ({ uid: `${tag}-h${i}`, defId }));
    p.deck = (setup.deck ?? []).map((defId, i) => ({ uid: `${tag}-d${i}`, defId }));
    p.merenda = setup.merenda ?? 10;
    p.tapas = setup.tapas ?? 3;
    p.moral = setup.moral ?? 20;
  });
  return state;
}

/** Jogada: [índice da carta na mão, carteira][]. */
export function mv(side: Side, plays: [number, number][] = [], tapSlot?: number): Move {
  const tag = side === 0 ? 'a' : 'b';
  return { plays: plays.map(([h, slot]) => ({ uid: `${tag}-h${h}`, slot })), tapSlot };
}
