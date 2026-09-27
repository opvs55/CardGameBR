import { getCard } from './cards';

export const DECK_SIZE = 30;
export const MAX_COPIES = 2;
export const MAX_COPIES_CARIMBADA = 1;
export const MAX_FAMILIES = 3;

export interface DeckRules {
  size: number;
  maxCopies: number;
  /** null = sem limite de famílias. */
  maxFamilies: number | null;
}

export const DEFAULT_RULES: DeckRules = { size: DECK_SIZE, maxCopies: MAX_COPIES, maxFamilies: MAX_FAMILIES };

/**
 * Com só as 20 cartas iniciais não dá para montar 30 cartas com 3 famílias e
 * 2 cópias (o máximo é 20 + os Bichos coringa). Os decks prontos usam estas
 * regras até existirem mais cartas.
 */
export const STARTER_RULES: DeckRules = { size: DECK_SIZE, maxCopies: MAX_COPIES, maxFamilies: null };

/** Lista de problemas do deck (vazia = válido). O Vira-lata não conta como família. */
export function validateDeck(ids: string[], rules: DeckRules = DEFAULT_RULES): string[] {
  const errors: string[] = [];
  if (ids.length !== rules.size) errors.push(`O deck precisa de ${rules.size} cartas (tem ${ids.length}).`);
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, n] of counts) {
    if (n > rules.maxCopies) errors.push(`${getCard(id).name}: máximo ${rules.maxCopies} cópias.`);
  }
  if (rules.maxFamilies !== null) {
    const families = new Set(ids.map(getCard).filter((c) => !c.wildcard).map((c) => c.family));
    if (families.size > rules.maxFamilies) errors.push(`Máximo ${rules.maxFamilies} famílias (tem ${families.size}).`);
  }
  return errors;
}

const twice = (ids: string[]) => ids.flatMap((id) => [id, id]);

export const STARTER_DECKS: { id: string; name: string; description: string; cards: string[] }[] = [
  {
    id: 'almoco-de-domingo',
    name: 'Almoço de Domingo',
    description: 'Família, cozinha e escola: Vó, Mãe, chinelo e muita cura.',
    cards: twice([
      'vo', 'mae', 'filho', 'tio-do-pave', 'pudim', 'filtro-de-barro', 'panela-de-pressao', 'homem-do-saco',
      'vira-lata-caramelo', 'merendeira', 'tia-da-cantina', 'inspetor', 'pombo', 'moto', 'craque-da-varzea',
    ]),
  },
  {
    id: 'role-da-madrugada',
    name: 'Rolê da Madrugada',
    description: 'Rua, folclore e lendas: grau na moto, redemoinho e susto.',
    cards: twice([
      'mandrake', 'moto', 'vendedor-de-pamonha', 'saci', 'curupira', 'loira-do-banheiro', 'homem-do-saco',
      'pombo', 'vira-lata-caramelo', 'craque-da-varzea', 'inspetor', 'filho', 'pudim', 'tia-da-cantina', 'mae',
    ]),
  },
];
