import { getCard, getHero, PARENT_TAGS } from './cards';
import { deriveSeed, mulberry32, shuffle } from './rng';
import type { CardDef, CardRef, CharRef, GameState, Minion, PlayerState, Side } from './types';
import { HERO_HP } from './types';

export const other = (side: Side): Side => (side === 0 ? 1 : 0);
/** Rodada = um turno de cada jogador. Rodada ímpar é Dia, par é Noite. */
export const roundOf = (turn: number) => Math.max(1, Math.ceil(turn / 2));
export const isNight = (turn: number) => roundOf(turn) % 2 === 0;

export const FIRST_HAND = 3;
export const SECOND_HAND = 4;
export const COIN_ID = 'troco';

export function hasTag(def: CardDef, tag: string): boolean {
  return def.tags.includes(tag) || (!!def.wildcard && PARENT_TAGS.includes(tag));
}

export function newMinion(ref: CardRef, turn: number): Minion {
  const def = getCard(ref.defId);
  return {
    uid: ref.uid,
    defId: ref.defId,
    damage: 0,
    buffs: { power: 0, toughness: 0 },
    turnBuffs: { power: 0, toughness: 0 },
    keywords: [],
    turnKeywords: [],
    silenced: false,
    shield: def.keywords.includes('capacete'),
    attacksLeft: 1,
    enteredTurn: turn,
  };
}

function newPlayer(heroId: string, deck: CardRef[]): PlayerState {
  getHero(heroId); // valida
  return {
    hero: { heroId, hp: HERO_HP, maxHp: HERO_HP, powerUsed: false },
    merenda: 0,
    maxMerenda: 0,
    bonusMerenda: 0,
    deck,
    hand: [],
    board: [],
    diretoria: [],
    discard: [],
    fatigue: 0,
    playedThisTurn: 0,
    peek: null,
  };
}

/**
 * Embaralha os decks e dá as mãos iniciais: quem começa pega 3 cartas; o
 * segundo pega 4 e o Troco da Merenda. O turno 1 ainda não começou.
 */
export function createState(
  deckA: string[],
  deckB: string[],
  heroA: string,
  heroB: string,
  seed: number,
): GameState {
  const rng = mulberry32(deriveSeed(seed, 0));
  let nextUid = 1;
  const toRefs = (ids: string[], side: Side) =>
    shuffle(
      rng,
      ids.map((defId) => {
        getCard(defId);
        return { uid: `${side ? 'b' : 'a'}${nextUid++}`, defId };
      }),
    );
  const a = newPlayer(heroA, toRefs(deckA, 0));
  const b = newPlayer(heroB, toRefs(deckB, 1));
  a.hand = a.deck.splice(0, FIRST_HAND);
  b.hand = b.deck.splice(0, SECOND_HAND);
  b.hand.push({ uid: `b${nextUid++}`, defId: COIN_ID });
  return { seed, turn: 0, active: 0, players: [a, b], winner: null, nextUid, actionCount: 0 };
}

export interface Located {
  side: Side;
  index: number;
  minion: Minion;
}

export function findMinion(state: GameState, uid: string): Located | null {
  for (const side of [0, 1] as Side[]) {
    const index = state.players[side].board.findIndex((m) => m.uid === uid);
    if (index >= 0) return { side, index, minion: state.players[side].board[index] };
  }
  return null;
}

export function allMinions(state: GameState): Located[] {
  return ([0, 1] as Side[]).flatMap((side) =>
    state.players[side].board.map((minion, index) => ({ side, index, minion })),
  );
}

export function sideOf(state: GameState, ref: CharRef): Side | null {
  if (ref.kind === 'hero') return ref.side;
  return findMinion(state, ref.uid)?.side ?? null;
}

export const sameRef = (a: CharRef, b: CharRef) =>
  a.kind === b.kind && (a.kind === 'hero' ? a.side === (b as typeof a).side : a.uid === (b as typeof a).uid);

export function cardName(ref: CardRef | string): string {
  return getCard(typeof ref === 'string' ? ref : ref.defId).name;
}

export function refName(state: GameState, ref: CharRef): string {
  if (ref.kind === 'hero') return getHero(state.players[ref.side].hero.heroId).name;
  const l = findMinion(state, ref.uid);
  return l ? cardName(l.minion) : 'carta';
}
