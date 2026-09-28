import { EyeOff, HardHat, Shield, Zap } from 'lucide-react';
import type { CSSProperties } from 'react';
import { FAMILIES, KEYWORD_INFO } from '../engine';
import type { CardDef, Keyword, MinionStats } from '../engine';
import { CardArt } from './CardArt';

interface Props {
  card: CardDef;
  stats?: MinionStats | null;
  size?: 'full' | 'hand' | 'mini';
  className?: string;
  /** Capacete ainda de pé (na mesa). */
  shield?: boolean;
  /** Na mesa o custo não importa mais. */
  hideCost?: boolean;
}

const KW_ICON: Partial<Record<Keyword, typeof Shield>> = { provocar: Shield, pressa: Zap, capacete: HardHat, escondido: EyeOff };

function Stat({ kind, value, base }: { kind: 'power' | 'health'; value: number; base: number }) {
  const cls = value > base ? 'up' : value < base ? 'down' : '';
  return (
    <span className={`stat stat-${kind} ${cls}`} title={kind === 'power' ? 'Força' : 'Resistência'}>
      {value}
    </span>
  );
}

export function Card({ card, stats, size = 'full', className = '', shield, hideCost }: Props) {
  const fam = FAMILIES[card.family];
  const keywords = stats?.keywords ?? card.keywords;
  const showKw = keywords.filter((k) => k !== 'capacete' || shield !== false);
  return (
    <article
      className={`gcard gcard-${size} gcard-${card.kind} ${keywords.includes('provocar') ? 'has-taunt' : ''} ${className}`}
      style={{ '--ink1': fam.hex1, '--ink2': fam.hex2 } as CSSProperties}
    >
      <header className="gcard-top">
        {size !== 'mini' && <span className="gcard-family">{card.kind === 'spell' ? `Feitiço · ${fam.name}` : fam.name}</span>}
        {!hideCost && (
          <span className="gcard-cost" title="Custo em Merenda">
            {card.cost}
          </span>
        )}
      </header>
      <div className="gcard-art">
        <CardArt card={card} />
        {size === 'mini' && showKw.length > 0 && (
          <span className="gcard-kws">
            {showKw.map((k) => {
              const Icon = KW_ICON[k];
              return Icon ? <Icon key={k} size={12} strokeWidth={2.75} aria-label={KEYWORD_INFO[k].name} /> : null;
            })}
          </span>
        )}
      </div>
      <h3 className="gcard-name">{card.name}</h3>
      {size !== 'mini' && <p className="gcard-text">{card.text}</p>}
      {size === 'full' && <p className="gcard-flavor">{card.flavor}</p>}
      {card.kind === 'minion' && (
        <footer className="gcard-stats">
          <Stat kind="power" value={stats?.power ?? card.power} base={card.power} />
          <Stat kind="health" value={stats?.health ?? card.toughness} base={card.toughness} />
        </footer>
      )}
    </article>
  );
}
