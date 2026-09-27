import { getCard, PARENT_TAGS } from './cards';
import { deriveSeed, mulberry32, shuffle } from './rng';
import type { Buffs, CardDef, CardRef, GameState, InPlay, PlayerState, Side } from './types';
import { ROW_SIZE, START_HAND, START_MORAL, START_TAPAS } from './types';

export const ZERO: Buffs = { power: 0, toughness: 0, speed: 0 };

export const other = (side: Side): Side => (side === 0 ? 1 : 0);
export const isNight = (round: number) => round % 2 === 0;

export function hasTag(def: CardDef, tag: string): boolean {
  return def.tags.includes(tag) || (!!def.wildcard && PARENT_TAGS.includes(tag));
}

export function newInPlay(ref: CardRef, round: number): InPlay {
  return {
    uid: ref.uid,
    defId: ref.defId,
    damage: 0,
    roundBuffs: { ...ZERO },
    permBuffs: { ...ZERO },
    enteredRound: round,
    flipped: false,
    noFight: false,
    directAttack: false,
  };
}

function newPlayer(deck: CardRef[]): PlayerState {
  return {
    moral: START_MORAL,
    merenda: 0,
    bonusMerenda: 0,
    stolenMerenda: 0,
    tapas: START_TAPAS,
    deck,
    hand: [],
    row: Array.from({ length: ROW_SIZE }, () => null),
    diretoria: [],
    discard: [],
    peek: null,
  };
}

/**
 * Cria a partida: embaralha os decks e dá a mão inicial. A rodada 1 ainda não
 * começou; use `startMatch` (em round.ts) para comprar e receber Merenda.
 */
export function createState(deckA: string[], deckB: string[], seed: number): GameState {
  const rng = mulberry32(deriveSeed(seed, 0));
  let nextUid = 1;
  const toRefs = (ids: string[], side: Side) =>
    shuffle(
      rng,
      ids.map((defId) => {
        getCard(defId); // valida
        return { uid: `${side ? 'b' : 'a'}${nextUid++}`, defId };
      }),
    );
  const a = newPlayer(toRefs(deckA, 0));
  const b = newPlayer(toRefs(deckB, 1));
  for (const p of [a, b]) p.hand = p.deck.splice(0, START_HAND);
  return { seed, round: 0, players: [a, b], diagonal: [false, false], winner: null, nextUid };
}

export interface Located {
  side: Side;
  slot: number;
  card: InPlay;
}

export function locate(state: GameState, uid: string): Located | null {
  for (const side of [0, 1] as Side[]) {
    const row = state.players[side].row;
    for (let slot = 0; slot < row.length; slot++) {
      const card = row[slot];
      if (card && card.uid === uid) return { side, slot, card };
    }
  }
  return null;
}

export function allInPlay(state: GameState): Located[] {
  const out: Located[] = [];
  for (const side of [0, 1] as Side[]) {
    state.players[side].row.forEach((card, slot) => {
      if (card) out.push({ side, slot, card });
    });
  }
  return out;
}

export function defOf(ref: CardRef): CardDef {
  return getCard(ref.defId);
}

export function cardName(ref: CardRef | string): string {
  return getCard(typeof ref === 'string' ? ref : ref.defId).name;
}
