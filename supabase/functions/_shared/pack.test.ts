import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../../src/engine/rng';
import { PACK_SIZE, rollPack, rollRarity } from './pack';

const ids = ['vo', 'mae', 'filho'];

describe('pacotinho', () => {
  it('tem 5 figurinhas e sempre pelo menos 1 Brilhante ou melhor', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 2000; i++) {
      const pack = rollPack(ids, rng);
      expect(pack).toHaveLength(PACK_SIZE);
      expect(pack.some((p) => p.rarity !== 'comum')).toBe(true);
      expect(pack.every((p) => ids.includes(p.card_id))).toBe(true);
    }
  });

  it('chances por figurinha ficam perto de 70/22/7/1', () => {
    const rng = mulberry32(2);
    const n = 100_000;
    const count: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const r = rollRarity(rng);
      count[r] = (count[r] ?? 0) + 1;
    }
    expect(count.comum / n).toBeCloseTo(0.7, 1);
    expect(count.brilhante / n).toBeCloseTo(0.22, 1);
    expect(count.holografica / n).toBeCloseTo(0.07, 1);
    expect(count.carimbada / n).toBeGreaterThan(0.005);
    expect(count.carimbada / n).toBeLessThan(0.015);
  });
});
