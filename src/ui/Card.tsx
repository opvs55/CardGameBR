import type { CSSProperties } from 'react';
import { FAMILIES } from '../engine';
import type { CardDef, Stats } from '../engine';
import { CardArt } from './CardArt';

interface Props {
  card: CardDef;
  stats?: Stats | null;
  size?: 'full' | 'hand' | 'mini';
  className?: string;
}

/** Stats atuais comparados com a base: sobe = verde, desce = vermelho. */
function Stat({ label, value, base }: { label: string; value: number; base: number }) {
  const cls = value > base ? 'up' : value < base ? 'down' : '';
  return (
    <span className={`stat ${cls}`} title={label}>
      <b>{value}</b>
      <small>{label}</small>
    </span>
  );
}

export function Card({ card, stats, size = 'full', className = '' }: Props) {
  const fam = FAMILIES[card.family];
  const power = stats?.power ?? card.power;
  const speed = stats?.speed ?? card.speed;
  const health = stats?.health ?? card.toughness;
  return (
    <article className={`gcard gcard-${size} ${className}`} style={{ '--ink1': fam.hex1, '--ink2': fam.hex2 } as CSSProperties}>
      <header className="gcard-top">
        {size !== 'mini' && <span className="gcard-family">{fam.name}</span>}
        <span className="gcard-cost" title="Custo em Merenda">
          {card.cost}
        </span>
      </header>
      <div className="gcard-art">
        <CardArt card={card} />
      </div>
      <h3 className="gcard-name">{card.name}</h3>
      {size === 'full' && (
        <>
          <p className="gcard-text">{card.text}</p>
          <p className="gcard-flavor">{card.flavor}</p>
        </>
      )}
      {size === 'hand' && <p className="gcard-text">{card.text}</p>}
      <footer className="gcard-stats">
        <Stat label="Força" value={power} base={card.power} />
        {size !== 'mini' && <Stat label="Pressa" value={speed} base={card.speed} />}
        <Stat label="Resist." value={health} base={card.toughness} />
      </footer>
    </article>
  );
}
