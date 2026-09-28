// Prompt "Cordel Riso" da seção 10 do design. Usado pelo gerador de arte e pelo seed do banco.
import { FAMILIES } from '../src/engine/cards';
import type { CardDef } from '../src/engine/types';

const BASE =
  'Brazilian cordel woodcut illustration printed as a two-color risograph, sticker style. Bold hand-carved black outlines with rough gouge marks, flat ink fills, visible halftone dots, slight misregistration between color layers, grainy cream paper texture. Single full-body cartoon character centered, big head, oversized hands and feet, exaggerated funny expression. Thick off-white die-cut sticker border around the character. One simple background shape behind the character, plain paper elsewhere. Vertical 4:5 composition with margin around the sticker.';

const RESTRICTIONS =
  'Only black plus the two inks listed, no other colors. No text, no letters, no numbers, no logos, no brand names, no real people, no weapons, no blood, no gradients, no glossy highlights, no 3D render, no photorealism.';

export function buildPrompt(card: CardDef, withReference: boolean): string {
  const fam = FAMILIES[card.family];
  const prompt = `${BASE} Inks: ${fam.ink1} for the character, ${fam.ink2} for the ${fam.bgShape}. Character: ${card.art.character}. Action: ${card.art.action}. ${RESTRICTIONS}`;
  return withReference ? `Match the exact style of the reference image. ${prompt}` : prompt;
}
