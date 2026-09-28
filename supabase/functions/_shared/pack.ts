// Sorteio do pacotinho (seção 8). Código puro: roda na Edge Function (Deno) e
// nos testes (Vitest). Sem imports para funcionar nos dois lugares.

export type Rarity = 'comum' | 'brilhante' | 'holografica' | 'carimbada';

export const PACK_SIZE = 5;
export const PACK_PRICE = 100;

/** Chances por figurinha, em %. Ajustável. */
export const RARITY_ODDS: [Rarity, number][] = [
  ['comum', 70],
  ['brilhante', 22],
  ['holografica', 7],
  ['carimbada', 1],
];

export interface PackItem {
  card_id: string;
  rarity: Rarity;
}

export function rollRarity(rand: () => number): Rarity {
  const total = RARITY_ODDS.reduce((s, [, w]) => s + w, 0);
  let roll = rand() * total;
  for (const [rarity, weight] of RARITY_ODDS) {
    roll -= weight;
    if (roll < 0) return rarity;
  }
  return 'comum';
}

/** 5 figurinhas, pelo menos 1 Brilhante (ou melhor). */
export function rollPack(cardIds: string[], rand: () => number): PackItem[] {
  if (cardIds.length === 0) throw new Error('Nenhuma carta cadastrada.');
  const pack = Array.from({ length: PACK_SIZE }, () => ({
    card_id: cardIds[Math.floor(rand() * cardIds.length)],
    rarity: rollRarity(rand),
  }));
  if (pack.every((p) => p.rarity === 'comum')) pack[PACK_SIZE - 1].rarity = 'brilhante';
  return pack;
}

/** Aleatório criptográfico (Web Crypto existe no Deno e no Node). */
export function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}
