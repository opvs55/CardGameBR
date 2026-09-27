import { ArrowLeft } from 'lucide-react';
import { CARDS, FAMILIES } from '../../engine';
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
      {ORDER.map((fam) => {
        const cards = CARDS.filter((c) => c.family === fam);
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
