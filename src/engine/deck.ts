import { getCard } from './cards';

export const DECK_SIZE = 30;
export const MAX_COPIES = 2;
export const MAX_FAMILIES = 3;

export interface DeckRules {
  size: number;
  maxCopies: number;
  /** null = sem limite de famílias. */
  maxFamilies: number | null;
}

export const DEFAULT_RULES: DeckRules = { size: DECK_SIZE, maxCopies: MAX_COPIES, maxFamilies: MAX_FAMILIES };

/**
 * Com poucas cartas ainda não dá para montar 30 cartas com 3 famílias e
 * 2 cópias. Os decks prontos usam estas regras até existirem mais cartas.
 */
export const STARTER_RULES: DeckRules = { size: DECK_SIZE, maxCopies: MAX_COPIES, maxFamilies: null };

/** Lista de problemas do deck (vazia = válido). O Vira-lata não conta como família. */
export function validateDeck(ids: string[], rules: DeckRules = DEFAULT_RULES): string[] {
  const errors: string[] = [];
  if (ids.length !== rules.size) errors.push(`O deck precisa de ${rules.size} cartas (tem ${ids.length}).`);
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, n] of counts) {
    const card = getCard(id);
    if (card.collectible === false) errors.push(`${card.name} não pode entrar em deck.`);
    if (n > rules.maxCopies) errors.push(`${card.name}: máximo ${rules.maxCopies} cópias.`);
  }
  if (rules.maxFamilies !== null) {
    const families = new Set(ids.map(getCard).filter((c) => !c.wildcard).map((c) => c.family));
    if (families.size > rules.maxFamilies) errors.push(`Máximo ${rules.maxFamilies} famílias (tem ${families.size}).`);
  }
  return errors;
}

const twice = (ids: string[]) => ids.flatMap((id) => [id, id]);

export interface StarterDeck {
  id: string;
  name: string;
  hero: string;
  description: string;
  cards: string[];
}

export const STARTER_DECKS: StarterDeck[] = [
  {
    id: 'almoco-de-domingo',
    name: 'Almoço de Domingo',
    hero: 'vo-cida',
    description: 'Família e cozinha com Vó Cida: Provocar, cura e o chinelo da Mãe.',
    cards: twice([
      'vo', 'mae', 'filho', 'tio-do-pave', 'chinelada', 'pudim', 'filtro-de-barro', 'panela-de-pressao',
      'hora-do-lanche', 'faxina-de-sabado', 'homem-do-saco', 'vira-lata-caramelo', 'merendeira', 'tia-da-cantina',
      'inspetor',
    ]),
  },
  {
    id: 'role-da-madrugada',
    name: 'Rolê da Madrugada',
    hero: 'zeca-do-grau',
    description: 'Rua, folclore e lendas com Zeca do Grau: Pressa, grau na moto e susto.',
    cards: twice([
      'mandrake', 'moto', 'vendedor-de-pamonha', 'saci', 'curupira', 'loira-do-banheiro', 'pombo', 'craque-da-varzea',
      'pelada-no-campinho', 'tapa', 'assombracao-na-janela', 'vira-lata-caramelo', 'homem-do-saco', 'hora-do-lanche',
      'tia-da-cantina',
    ]),
  },
];
