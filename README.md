# Bafo! — card game brasileiro do recreio

Card game colecionável de turnos, no estilo Hearthstone, com humor brasileiro: família, folclore, lendas urbanas, escola, rua, cozinha, várzea e bichos. O design original (cartas, arte, banco, tom) está em [`docs/DESIGN_HANDOFF.md`](docs/DESIGN_HANDOFF.md); as regras de partida mudaram da revelação simultânea para turnos alternados (veja [Regras](#regras)).

## Rodando

```bash
npm install
npm run dev        # app em http://localhost:5173
npm test           # testes do motor (Vitest)
npm run sim        # uma partida bot x bot narrada no terminal (npm run sim -- 42 para fixar a seed)
npm run sim -- --n 1000   # estatística de 1000 partidas
npm run build      # build de produção + PWA em dist/
npm run db:seed    # regenera supabase/seed.sql a partir das cartas
```

## O que já existe

- **Setup**: React 18 + Vite + TypeScript, PWA instalável (`vite-plugin-pwa`), tokens do design system Organic (`src/styles/tokens.css`, importado como está).
- **Motor** (`src/engine/`): puro, determinístico, sem React. `applyAction(state, action) => { state, log }`, com ações `play`, `attack`, `power` e `end`. As cartas estão em dados (`src/engine/cards/index.ts`), com efeitos declarativos interpretados por `effects.ts`. Cada carta e regra tem teste em `game.test.ts`.
- **28 cartas**: as 20 do design adaptadas para turnos, 6 feitiços novos e 2 fichas (Moleque da Várzea, Troco da Merenda). **2 heróis** com poder: Vó Cida (Cafuné, cura 2) e Zeca do Grau (Buzinada, 1 de dano).
- **Partida contra o bot**: escolher onde colocar a carta, escolher alvo de Chegada, feitiço, ataque e poder, Provocar destacado, números de dano flutuando, log, timer de 75 s por turno. O bot joga o que couber, troca bem quando dá e bate na cara quando não.
- **Álbum** com heróis e cartas por família.
- **Arte**: enquanto não há imagens, cada carta mostra um placeholder "risografia" com as tintas da família. Imagens em `src/assets/art/{card_id}.png` substituem o placeholder automaticamente.

```
src/
  engine/            # regras puras
    types.ts         # CardDef, HeroDef, Effect, GameState, GameAction, LogEvent...
    cards/index.ts   # cartas, heróis, famílias, palavras-chave
    state.ts         # criação da partida, helpers
    effects.ts       # interpretador de efeitos, auras, alvos
    game.ts          # turnos e ações, validação
    rng.ts           # RNG com seed (mulberry32)
    deck.ts          # validação de deck, decks prontos
    bot.ts           # bot simples
  features/
    home/            # Banca do Seu Zé (tela inicial)
    battle/          # tela de partida + store (Zustand)
    album/           # álbum
  lib/supabase.ts    # cliente do backend
  ui/                # componente de carta e arte
scripts/
  sim.ts             # partidas no terminal
  generate-art.ts    # arte com Gemini
  gen-seed.ts        # supabase/seed.sql a partir das cartas
supabase/            # migração, seed, Edge Functions, testes do banco
```

## Regras

- **Herói**: 30 de Moral. Zerou, perdeu.
- **Turno**: compra 1 carta; a Merenda máxima sobe 1 (até 10) e enche. Quem começa tem 3 cartas; o segundo tem 4 e o **Troco da Merenda** (+1 de Merenda uma vez).
- **Jogar carta**: paga a Merenda. Cartas de mesa entram na posição que você escolher (até 7); a **Chegada** acontece na hora. Feitiços têm efeito e vão pro lixo.
- **Atacar**: cada carta ataca 1 vez por turno, a partir do turno seguinte ao que entrou. Escolha o alvo: carta inimiga ou herói. Quem apanha revida (herói não revida).
- **Poder do herói**: 2 de Merenda, uma vez por turno.
- **Palavras-chave**: **Provocar** (tem que ser atacada primeiro), **Pressa** (ataca no turno em que entra), **Capacete** (segura o primeiro golpe), **Grau** (ignora Provocar neste turno), **Escondido** (não pode ser atacada), **Chegada** (ao ser jogada da mão), **Despedida** (ao morrer; o motor já suporta).
- **Dia e Noite**: rodada = um turno de cada. Rodada ímpar é Dia, par é Noite (Saci, Curupira, Inspetor dependem disso).
- **Diretoria**: a carta sai da mesa, perde o próximo turno do dono e volta no fim dele.
- **Mão**: até 10 cartas (a 11ª vai pro lixo). Deck vazio: Cansaço (1, 2, 3... de dano).

## Gerando a arte com o Gemini

O script monta o prompt "Cordel Riso" da seção 10 para cada carta, gera o **Filtro de Barro** primeiro como carta-âncora e manda ele (e a primeira carta de cada família) como referência de estilo nas próximas.

```bash
cp .env.example .env.local        # e coloque sua GEMINI_API_KEY lá (o arquivo não vai pro git)
npm run art -- --dry              # só mostra os prompts
npm run art -- --only filtro-de-barro   # gera a âncora e confere o estilo
npm run art                       # gera o que falta
npm run art -- --only mae --force # refaz uma carta
```

O modelo padrão é `gemini-2.5-flash-image`; troque com `GEMINI_IMAGE_MODEL`. A chave fica só na sua máquina. Quando houver backend, a geração vai para a Edge Function `generate-art` e a chave fica no servidor. **Revise cada imagem** contra os limites do humor (seção 9) antes de commitar.

## Backend (Supabase)

Estrutura da seção 11 do design, pronta para ligar num projeto Supabase:

- `supabase/migrations/20260928000000_init.sql`: tabelas (`families`, `cards`, `heroes`, `profiles`, `user_cards`, `decks`, `deck_cards`, `matches`, `match_actions`), RLS e a função `grant_pack`.
- `supabase/seed.sql`: cartas, heróis e famílias, **gerado** a partir de `src/engine/cards` com `npm run db:seed` (o código continua sendo a fonte da verdade).
- `supabase/functions/open-pack`: abre um pacotinho. Sorteia no servidor (70/22/7/1, pelo menos 1 Brilhante), desconta 100 moedas e grava em `user_cards` numa transação. Carimbadas ganham número de série.
- `src/lib/supabase.ts`: cliente do app (`fetchProfile`, `fetchCollection`, `openPack`). Sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` o app segue offline contra o bot.

Regras de acesso: catálogo público; coleção e decks só do dono; o jogador muda o próprio nome mas **não** as moedas; na partida, o jogador vê o andamento mas não o estado completo (que tem a mão do outro); só o servidor chama `grant_pack`. Novo cadastro ganha 500 moedas (a moeda da banca ainda está em aberto). Tudo isso é testado em `supabase/db.test.ts`, que roda a migração num Postgres em memória (PGlite).

Para subir num projeto:

```bash
npx supabase login
npx supabase link --project-ref <seu-projeto>
npx supabase db push --include-seed
npx supabase functions deploy open-pack
```

## Como as cartas do design viraram turnos

| Carta | No sistema de turnos |
| --- | --- |
| Filtro de Barro | 0/4 com Provocar. Fim do seu turno cura 1 nas vizinhas; com Vó, cura 2 e +2 Resistência. |
| Vó | Chegada: parentes vizinhos +1/+1 (permanente). |
| Mãe | Chinelo Teleguiado a cada Filho que entra; "Pra dentro, agora!" continua na Chegada. |
| Tio do Pavê | Chegada com Sobremesa: uma carta inimiga escolhida perde 2 de Força. |
| Mandrake | Tem Capacete. Chegada com Moto: +2 Força, Pressa e Grau para a Moto neste turno. |
| Moto | 2/1 com Pressa. |
| Saci | Chegada à Noite: devolve uma inimiga aleatória de custo ≤ 3 para a mão. |
| Curupira | À Noite fica Escondido (não pode ser atacado). |
| Loira do Banheiro | Boato: sai da mão e entra de graça quando o oponente joga a 3ª carta no mesmo turno. |
| Homem do Saco | Com Mãe: seus Filhos ganham +2 Resistência e Provocar. |
| Merendeira / Tia da Cantina | Tia restaura 2 de Moral; com Tia, a Merendeira repete a Chegada de outra carta sua. |
| Inspetor | Chegada de Dia: uma inimiga escolhida de custo ≤ 3 vai para a Diretoria. |
| Panela de Pressão | Provocar; explode no fim do seu 3º turno em jogo (3 de dano em todas as outras cartas). |
| Craque da Várzea | +1/+1 por outro jogador de várzea do seu lado. |
| Vira-lata Caramelo | Conta como qualquer parente; nunca vai para a Diretoria. |
| Pombo | Pressa; se o oponente gastar toda a Merenda, você ganha +1 no próximo turno. |
| **Feitiços novos** | Chinelada (1: 2 de dano), Tapa (1: vira uma carta, que perde os efeitos, e causa 1), Hora do Lanche (3: compra 2), Faxina de Sábado (4: 2 em todas as inimigas), Pelada no Campinho (2: dois Moleques 1/1), Assombração na Janela (2: devolve uma inimiga para a mão). |

## Achados do balanceamento

- **Deck de 30 com 3 famílias ainda não fecha** com 26 cartas colecionáveis. Os decks prontos usam `STARTER_RULES` (sem limite de famílias); o limite continua em `validateDeck`.
- Em 1000 partidas bot x bot (alternando quem começa): **Almoço de Domingo 52% x 48% Rolê da Madrugada**, quem começa vence 54%, média de 16 rodadas. Os números estão em dados para ajustar.

## Próximos passos (ordem do design)

4. Supabase: ~~tabelas, seed, `open-pack`~~ (feito); falta login, tela de abertura de pacote e álbum com a coleção real.
5. Deck builder com a coleção.
6. Online: Edge Function `play-action` (valida e aplica a ação com o mesmo motor) + Realtime com a visão de cada jogador.
7. Arte aprovada no Storage; `generate-art` como Edge Function.
8. Polimento: raridades, sons, Troca-troca.
