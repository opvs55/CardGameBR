# Bafo! — card game brasileiro do recreio

Card game colecionável com humor brasileiro e **revelação simultânea**: os dois jogadores montam a jogada escondido e revelam ao mesmo tempo, como no bafo. O design completo (regras, cartas, arte, banco) está em [`docs/DESIGN_HANDOFF.md`](docs/DESIGN_HANDOFF.md).

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

## O que já existe (etapas 1–3 da ordem de construção)

- **Setup**: React 18 + Vite + TypeScript, PWA instalável (`vite-plugin-pwa`), tokens do design system Organic (`src/styles/tokens.css`, importado como está).
- **Motor** (`src/engine/`): puro, determinístico, sem React. `resolveRound(state, moveA, moveB, seed?) => { state, log }`. As 20 cartas da seção 7 estão em dados (`src/engine/cards/index.ts`), com efeitos declarativos interpretados por `effects.ts`. Todo combo tem teste em `combos.test.ts`.
- **Partida local** contra um bot simples (joga as cartas mais caras que cabem, Tapa aleatório em ~30% das rodadas), com os dois decks prontos, timer de 30 s, animação do Bafo!, log da rodada tocando em sequência e números de dano flutuando.
- **Álbum** mostrando as 20 figurinhas por família.
- **Arte**: enquanto não há imagens, cada carta mostra um placeholder "risografia" com as tintas da família. Imagens em `src/assets/art/{card_id}.png` substituem o placeholder automaticamente.

```
src/
  engine/            # regras puras
    types.ts         # CardDef, Effect, GameState, Move, LogEvent...
    cards/index.ts   # as 20 cartas + famílias (tintas, forma do fundo)
    state.ts         # criação da partida, helpers
    effects.ts       # interpretador de efeitos, auras, alvos
    round.ts         # fases da rodada, validação de jogadas
    rng.ts           # RNG com seed (mulberry32)
    deck.ts          # validação de deck, decks prontos
    bot.ts           # bot simples
  features/
    home/            # Banca do Seu Zé (tela inicial)
    battle/          # tela de partida + store (Zustand)
    album/           # álbum
  ui/                # componente de carta e arte
scripts/
  sim.ts             # partidas no terminal
  generate-art.ts    # arte com Gemini
```

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

- `supabase/migrations/20260928000000_init.sql`: tabelas (`families`, `cards`, `profiles`, `user_cards`, `decks`, `deck_cards`, `matches`, `match_moves`), RLS e a função `grant_pack`.
- `supabase/seed.sql`: as 20 cartas e as 8 famílias, **gerado** a partir de `src/engine/cards` com `npm run db:seed` (o código continua sendo a fonte da verdade).
- `supabase/functions/open-pack`: abre um pacotinho. Sorteia no servidor (70/22/7/1, pelo menos 1 Brilhante), desconta 100 moedas e grava em `user_cards` numa transação. Carimbadas ganham número de série.
- `src/lib/supabase.ts`: cliente do app (`fetchProfile`, `fetchCollection`, `openPack`). Sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` o app segue offline contra o bot.

Regras de acesso: catálogo público; coleção, decks e jogadas só do dono; o jogador muda o próprio nome mas **não** as moedas; ninguém lê a jogada escondida do outro; só o servidor chama `grant_pack`. Novo cadastro ganha 500 moedas (a moeda da banca ainda está em aberto). Tudo isso é testado em `supabase/db.test.ts`, que roda a migração num Postgres em memória (PGlite).

Para subir num projeto:

```bash
npx supabase login
npx supabase link --project-ref <seu-projeto>
npx supabase db push --include-seed
npx supabase functions deploy open-pack
```

## Decisões de regra tomadas na implementação

O design deixava alguns pontos em aberto. Escolhi o seguinte, tudo fácil de mudar:

| Ponto | Decisão |
| --- | --- |
| Quando a carta morre | Além do fim da rodada, há uma limpeza **logo depois dos efeitos de entrada**: carta morta pelo Chinelo não briga. As curas de fim de rodada vêm **antes** da limpeza final (o Pudim pode se salvar). |
| Carta que levou Tapa | Fica sem **nenhum** efeito na rodada (não só o de entrada) e não ativa combos de quem já está na mesa (Filho virado não faz a Mãe jogar o chinelo). |
| Mãe + Filho na mesma rodada | Funciona: a Mãe (Pressa 4) entra antes do Filho (Pressa 3). |
| Empate de Pressa | Entre lados diferentes, planeja os dois contra o mesmo estado e aplica juntos; no mesmo lado, slot menor primeiro. |
| Diretoria | A carta perde a rodada atual e a seguinte inteira; volta no início da rodada depois dessa. |
| Vendedor de Pamonha | "Espia 1 carta virada" = no início de cada rodada, você vê 1 carta aleatória da mão do oponente. |
| Tio do Pavê | "Inimigos vizinhos à frente" = as 3 carteiras inimigas em i-1, i, i+1. |
| Curupira | À Noite, só as cartas do dono do Curupira brigam na diagonal (i+1). A da carteira 5 bate direto na Moral. |
| Homem do Saco + Mãe | "Não briga" = não dá nem toma dano de briga; quem está na frente dele erra o golpe. |
| Merendeira | O Repeteco repete o efeito de entrada da carta que entrou mais recentemente na sua fileira (empate: carteira menor). |
| Panela de Pressão | Explode no fim da 3ª rodada em jogo: 4 de dano nas suas 2 vizinhas e nas 3 inimigas da frente. |
| Vira-lata Caramelo | Conta como `parente`, `vo`, `mae` e `filho` (ativa o chinelo da Mãe e o Tapetinho de Crochê). Não conta como família no limite do deck. |
| Pombo | "Gastar toda a Merenda" = gastou algo e ficou com 0. |
| Loira do Banheiro | Sai da mão e entra na primeira carteira vazia, contando como carta nova da rodada. |
| Fim por tempo | Rodada 40, ou os dois lados sem cartas: vence quem tem mais Moral. |

## Achados do primeiro balanceamento

- **Deck de 30 com 3 famílias é impossível com só 20 cartas**: 3 famílias × 2 cópias dá no máximo 20 cartas (24 com os Bichos). Os decks prontos usam `STARTER_RULES` (sem limite de famílias) até existirem mais cartas; o limite de 3 famílias continua implementado em `validateDeck`.
- Em 1000 partidas bot x bot, **Rolê da Madrugada vence ~71%** contra Almoço de Domingo, com média de ~16 rodadas por partida. Os números estão em dados para ajustar.

## Próximos passos (ordem do design)

4. Supabase: ~~tabelas, seed, `open-pack`~~ (feito); falta login, tela de abertura de pacote e álbum com a coleção real.
5. Deck builder com a coleção.
6. Online: `submit-move` / `resolve-round` + Realtime (o motor já roda igual no servidor).
7. Arte aprovada no Storage; `generate-art` como Edge Function.
8. Polimento: raridades, sons, Troca-troca.
