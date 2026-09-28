import { BookOpen, Swords } from 'lucide-react';
import { getHero, STARTER_DECKS } from '../../engine';

const ICON = { strokeWidth: 2.75, size: 18 } as const;

export function HomeScreen({ onPlay, onAlbum }: { onPlay: (deck: number) => void; onAlbum: () => void }) {
  return (
    <main className="home">
      <header className="home-hero">
        <p className="card-kicker">Card game do recreio</p>
        <h1>Bafo!</h1>
        <p className="home-lede">
          Card game de turno com humor brasileiro: a Vó melhora o Filtro de Barro, a Mãe joga o chinelo quando o Filho
          aparece e o Mandrake empina a Moto por cima da Provocar.
        </p>
      </header>

      <section className="banca" aria-labelledby="banca-title">
        <div className="banca-awning" aria-hidden />
        <div className="banca-body">
          <h2 id="banca-title">Banca do Seu Zé</h2>
          <p className="text-muted">
            Pacotinhos de figurinha chegam em breve. Por enquanto, pega um deck pronto e vai pro recreio contra o bot. Você começa; o bot ganha o Troco da Merenda.
          </p>
          <div className="deck-choices">
            {STARTER_DECKS.map((d, i) => (
              <button key={d.id} className="deck-choice" onClick={() => onPlay(i)}>
                <span className="deck-choice-name">{d.name}</span>
                <span className="deck-choice-hero">
                  com {getHero(d.hero).name} · poder {getHero(d.hero).power.name}: {getHero(d.hero).power.text}
                </span>
                <span className="deck-choice-desc">{d.description}</span>
                <span className="btn btn-primary">
                  <Swords {...ICON} /> Jogar
                </span>
              </button>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={onAlbum}>
            <BookOpen {...ICON} /> Ver todas as figurinhas
          </button>
        </div>
      </section>

      <section className="howto">
        <h3>Como funciona o recreio</h3>
        <ol>
          <li><b>Seu turno:</b> você compra 1 carta e sua Merenda sobe 1 (até 10) e enche de novo.</li>
          <li><b>Jogue cartas:</b> cartas de mesa ficam lutando por você (até 7); feitiços têm efeito na hora. Chegada acontece quando a carta entra.</li>
          <li><b>Ataque:</b> cada carta da mesa ataca 1 vez por turno, a partir do turno seguinte ao que entrou (Pressa ataca na hora). Escolha o alvo: outra carta ou o herói. Quem apanha revida.</li>
          <li><b>Provocar</b> obriga o inimigo a atacar essa carta primeiro. <b>Capacete</b> segura o primeiro golpe.</li>
          <li><b>Poder do herói:</b> 2 de Merenda, uma vez por turno. Quem zerar a Moral (30) do outro vence. Rodada ímpar é Dia, par é Noite.</li>
        </ol>
      </section>
    </main>
  );
}
