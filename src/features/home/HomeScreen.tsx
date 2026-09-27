import { BookOpen, Swords } from 'lucide-react';
import { STARTER_DECKS } from '../../engine';

const ICON = { strokeWidth: 2.75, size: 18 } as const;

export function HomeScreen({ onPlay, onAlbum }: { onPlay: (deck: number) => void; onAlbum: () => void }) {
  return (
    <main className="home">
      <header className="home-hero">
        <p className="card-kicker">Card game do recreio</p>
        <h1>Bafo!</h1>
        <p className="home-lede">
          Escolha suas jogadas escondido, revele ao mesmo tempo e veja a Vó melhorar o Filtro de Barro, a Mãe jogar o
          chinelo e o Mandrake empinar a Moto.
        </p>
      </header>

      <section className="banca" aria-labelledby="banca-title">
        <div className="banca-awning" aria-hidden />
        <div className="banca-body">
          <h2 id="banca-title">Banca do Seu Zé</h2>
          <p className="text-muted">
            Pacotinhos de figurinha chegam em breve. Por enquanto, pega um deck pronto e vai pro recreio contra o bot.
          </p>
          <div className="deck-choices">
            {STARTER_DECKS.map((d, i) => (
              <button key={d.id} className="deck-choice" onClick={() => onPlay(i)}>
                <span className="deck-choice-name">{d.name}</span>
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
          <li><b>Toca o sinal:</b> você compra 1 carta e ganha Merenda (1 na rodada 1, 2 na 2… até 10).</li>
          <li><b>Mão fechada:</b> coloque até 2 cartas em carteiras vazias e, se quiser, marque 1 Tapa numa carteira do outro lado.</li>
          <li><b>Bafo!:</b> tudo é revelado ao mesmo tempo. Tapa certeiro vira a carta nova do oponente (sem efeito, 1/1). Tapa no vazio dá +1 Merenda pra ele.</li>
          <li><b>Efeitos de entrada</b> por ordem de Pressa, depois <b>Briga:</b> cada carta bate na da frente; carteira vazia na frente, dano na Moral.</li>
          <li><b>Bate o sinal:</b> curas e efeitos de fim de rodada. Quem zerar a Moral (20) perde. Rodada ímpar é Dia, par é Noite.</li>
        </ol>
      </section>
    </main>
  );
}
