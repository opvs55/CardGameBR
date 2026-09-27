import { describe, expect, it } from 'vitest';
import { botMove } from './bot';
import { STARTER_DECKS, STARTER_RULES, validateDeck, DEFAULT_RULES } from './deck';
import { deriveSeed, mulberry32 } from './rng';
import { resolveRound, startMatch, validateMove } from './round';
import type { GameState } from './types';

function playMatch(seed: number) {
  let { state } = startMatch(STARTER_DECKS[0].cards, STARTER_DECKS[1].cards, seed);
  const rng = mulberry32(deriveSeed(seed, 999));
  const logs: string[] = [];
  while (state.winner === null) {
    const a = botMove(state, 0, rng);
    const b = botMove(state, 1, rng);
    expect(validateMove(state, 0, a)).toBeNull();
    expect(validateMove(state, 1, b)).toBeNull();
    const r = resolveRound(state, a, b);
    logs.push(...r.log.map((e) => e.text));
    state = r.state;
  }
  return { state, logs };
}

describe('partida completa', () => {
  it('os decks prontos são válidos pelas regras de início', () => {
    for (const d of STARTER_DECKS) expect(validateDeck(d.cards, STARTER_RULES)).toEqual([]);
  });

  it('o limite de 3 famílias é checado', () => {
    expect(validateDeck(STARTER_DECKS[0].cards, DEFAULT_RULES).join()).toMatch(/famílias/);
  });

  it('bot contra bot sempre termina, em qualquer seed', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { state } = playMatch(seed);
      expect(state.winner).not.toBeNull();
      expect(state.round).toBeLessThanOrEqual(40);
    }
  });

  it('é determinístico: mesma seed, mesma partida', () => {
    expect(playMatch(1234).logs).toEqual(playMatch(1234).logs);
  });

  it('resolveRound não muta o estado recebido', () => {
    const { state } = startMatch(STARTER_DECKS[0].cards, STARTER_DECKS[1].cards, 7);
    const before = JSON.stringify(state);
    const rng = mulberry32(1);
    resolveRound(state, botMove(state, 0, rng), botMove(state, 1, rng));
    expect(JSON.stringify(state)).toBe(before);
  });

  it('começa com 6 cartas na mão (5 + compra) e 1 de Merenda', () => {
    const { state } = startMatch(STARTER_DECKS[0].cards, STARTER_DECKS[1].cards, 7);
    const s: GameState = state;
    expect(s.round).toBe(1);
    expect(s.players[0].hand).toHaveLength(6);
    expect(s.players[0].merenda).toBe(1);
  });
});
