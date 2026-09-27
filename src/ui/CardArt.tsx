import type { CSSProperties } from 'react';
import { FAMILIES } from '../engine';
import type { CardDef } from '../engine';

// Arte aprovada fica em src/assets/art/{card_id}.{png,jpg,webp} (gerada por scripts/generate-art.ts).
const FILES = import.meta.glob('../assets/art/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>;
const ART: Record<string, string> = Object.fromEntries(
  Object.entries(FILES).map(([path, url]) => [path.split('/').pop()!.replace(/\.[^.]+$/, ''), url]),
);

export function artUrl(id: string): string | undefined {
  return ART[id];
}

/** Arte da carta, ou um placeholder "risografia" com as tintas da família. */
export function CardArt({ card }: { card: CardDef }) {
  const url = artUrl(card.id);
  if (url) return <img className="art-img" src={url} alt="" loading="lazy" draggable={false} />;
  const fam = FAMILIES[card.family];
  const initials = card.name
    .split(/\s+/)
    .filter((w) => w.length > 2 || w === card.name)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return (
    <div
      className={`art-placeholder shape-${fam.bgShape.split(' ').pop()}`}
      style={{ '--ink1': fam.hex1, '--ink2': fam.hex2 } as CSSProperties}
      aria-hidden
    >
      <span className="art-shape" />
      <span className="art-initials">{initials}</span>
    </div>
  );
}
