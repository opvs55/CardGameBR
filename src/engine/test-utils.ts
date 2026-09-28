import { newMinion } from './state';
import { createState } from './state';
import type { GameState, Side } from './types';

export interface SideSetup {
  board?: string[];
  hand?: string[];
  deck?: string[];
  merenda?: number;
  hp?: number;
  hero?: string;
}

/**
 * Monta uma mesa sob medida. Quem joga é o lado `active` (padrão 0), no turno
 * `turn` (padrão 3 = rodada 2, Noite; use 1 ou 5 para Dia). As cartas da mesa
 * entraram em turnos anteriores e podem atacar.
 */
export function mkState(opts: { turn?: number; active?: Side; seed?: number; a?: SideSetup; b?: SideSetup } = {}): GameState {
  const state = createState([], [], opts.a?.hero ?? 'vo-cida', opts.b?.hero ?? 'zeca-do-grau', opts.seed ?? 42);
  state.turn = opts.turn ?? 3;
  state.active = opts.active ?? 0;
  ([0, 1] as Side[]).forEach((side) => {
    const setup = (side === 0 ? opts.a : opts.b) ?? {};
    const p = state.players[side];
    const tag = side === 0 ? 'a' : 'b';
    p.board = (setup.board ?? []).map((defId, i) => newMinion({ uid: `${tag}-m${i}`, defId }, state.turn - 2));
    p.hand = (setup.hand ?? []).map((defId, i) => ({ uid: `${tag}-h${i}`, defId }));
    p.deck = (setup.deck ?? []).map((defId, i) => ({ uid: `${tag}-d${i}`, defId }));
    p.merenda = setup.merenda ?? 10;
    p.maxMerenda = Math.max(p.merenda, 1);
    if (setup.hp !== undefined) p.hero.hp = setup.hp;
  });
  return state;
}

export const hero = (side: Side) => ({ kind: 'hero' as const, side });
export const m = (uid: string) => ({ kind: 'minion' as const, uid });
export const h = (side: Side, i: number) => `${side === 0 ? 'a' : 'b'}-h${i}`;
export const b = (side: Side, i: number) => `${side === 0 ? 'a' : 'b'}-m${i}`;
