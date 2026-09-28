import { ArrowLeft } from 'lucide-react';
import { COLLECTIBLE, FAMILIES, HEROES } from '../../engine';
import type { Family } from '../../engine';
import { Card } from '../../ui/Card';

const ORDER = Object.keys(FAMILIES) as Family[];

export function AlbumScreen({ onBack }: { onBack: () => void }) {
  return (
    <main className="album">
      <button className="btn btn-ghost" onClick={onBack}>
        <ArrowLeft strokeWidth={2.75} size={16} /> Banca
      </button>
      <h1>Álbum</h1>
      <section className="album-page">
        <h2>Heróis</h2>
        <div className="hero-grid">
          {HEROES.map((h) => (
            <article key={h.id} className="hero-card">
              <h3>{h.name}</h3>
              <p className="text-muted">{h.title}</p>
              <p>
                <b>
                  {h.power.name} ({h.power.cost}):
                </b>{' '}
                {h.power.text}
              </p>
            </article>
          ))}
        </div>
      </section>
      {ORDER.map((fam) => {
        const cards = COLLECTIBLE.filter((c) => c.family === fam).sort((a, b) => a.cost - b.cost);
        if (cards.length === 0) return null;
        return (
          <section key={fam} className="album-page">
            <h2>
              {FAMILIES[fam].name} <span className="tag tag-neutral">{FAMILIES[fam].keyword}</span>
            </h2>
            <div className="album-grid">
              {cards.map((c) => (
                <Card key={c.id} card={c} size="full" />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
