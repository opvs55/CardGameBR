# Bafo! — Card game brasileiro do recreio

Documento único para o Claude Code. Explica o jogo, as regras exatas, o sistema de cartas, a arte, os dados e a ordem de construção. Repositório: `opvs55/CardGameBR` (hoje só com README).

> Os arquivos HTML do projeto de design (`Regras e Combos`, `Guia de Arte`) são referências. Este README é a fonte da verdade: tudo que está neles está aqui.

---

## 1. O que é o jogo

Card game colecionável com humor brasileiro (família, folclore, lendas urbanas, escola, rua, cozinha, várzea, bichos). O jogador compra pacotinhos de figurinhas na **banca**, cola no **álbum**, monta um **deck de 30 cartas** e joga partidas de ~8–10 minutos.

A mecânica central é a **revelação simultânea**, como no bafo: os dois jogadores escolhem jogadas escondido e revelam ao mesmo tempo. As cartas mudam de comportamento conforme o que já está na mesa (a Vó melhora o Filtro de Barro, a Mãe joga o chinelo quando um Filho entra, o Mandrake faz a Moto empinar).

Tom: zoeira total (humor 10/10), mas **sem ofender** (ver seção 9).

Plataforma: celular (vertical) e PC, como **PWA** instalável.

---

## 2. Stack

| Parte | Escolha |
| --- | --- |
| App | React 18 + Vite + TypeScript |
| Estilo | CSS com os tokens de `styles.css` (seção 10). Sem Tailwind obrigatório |
| Estado | Zustand (UI) + motor de regras puro em TS (sem React) |
| Animação | Framer Motion |
| Instalável | `vite-plugin-pwa`. Capacitor depois, se for para as lojas |
| Backend | Supabase: Auth, Postgres, Storage, Realtime, Edge Functions |
| Testes | Vitest (o motor de regras precisa de cobertura alta) |

Estrutura sugerida:

```
src/
  engine/          # regras puras, determinísticas, testáveis
    types.ts
    state.ts       # GameState, criação de partida
    round.ts       # fases da rodada
    effects.ts     # interpretador de efeitos
    rng.ts         # RNG com seed (chinelo aleatório etc.)
    cards/         # definições de cartas (JSON/TS)
  features/
    banca/         # comprar e abrir pacotes
    album/         # coleção
    deck/          # montagem de deck
    battle/        # tela de partida
  lib/supabase.ts
supabase/
  migrations/
  functions/
    open-pack/     # sorteio no servidor
    submit-move/   # recebe jogada escondida
    resolve-round/ # revela e resolve quando os dois enviaram
    generate-art/  # (futuro) chama Gemini com chave no servidor
```

**Regra de ouro:** o motor (`src/engine`) é uma função pura `resolveRound(state, movesA, movesB, seed) => { state, log }`. Roda igual no cliente (partida contra bot/offline) e na Edge Function (partida online). O `log` alimenta as animações.

---

## 3. A mesa

- Cada lado tem **5 carteiras** (slots 0–4) em fila. Carteira `i` de A encara carteira `i` de B.
- Cartas em carteiras `i-1` e `i+1` do mesmo lado são **vizinhas**.
- **Moral**: vida. Começa em 20. Chegou a 0, perdeu.
- **Merenda**: energia. Na rodada `n` o jogador recebe `min(n, 10)`. Não acumula entre rodadas.
- **Tapas**: 3 por partida, para o golpe de Bafo.
- **Diretoria**: zona de suspensão. A carta fica fora 1 rodada e volta para a mesma carteira (se estiver ocupada, volta para a mão).
- **Relógio**: rodada ímpar = Dia, par = Noite.
- Mão inicial: 5 cartas. Deck: 30 cartas, máx. 2 cópias por carta (1 para Carimbada), máx. 3 famílias.

---

## 4. A rodada (Recreio)

1. **Toca o sinal** — cada jogador compra 1 carta e recebe Merenda. Efeitos "início da rodada".
2. **Mão fechada** (30 s) — cada jogador, em segredo:
   - coloca até **2 cartas** viradas em carteiras **vazias**, pagando o custo em Merenda;
   - pode marcar **1 Tapa** numa carteira do oponente.
   - Envia `Move = { plays: {cardId, slot}[], tapSlot?: number }`.
3. **Bafo!** — revela tudo ao mesmo tempo. Resolve Tapas primeiro:
   - **Acertou** (oponente jogou carta nova naquele slot): a carta fica **virada** — perde o efeito de entrada e briga como 1/1 nesta rodada.
   - **Errou**: Tapa perdido e o oponente ganha +1 Merenda na próxima rodada.
4. **Efeitos de entrada** — cartas novas (não viradas) resolvem em ordem de **Pressa** decrescente. Empate de Pressa entre lados diferentes: resolvem "juntos" (calcula os dois contra o estado anterior e aplica os dois). Empate no mesmo lado: slot menor primeiro.
5. **Briga** — para cada slot `i`: carta A causa Força na carta B e vice-versa, ao mesmo tempo. Se o slot da frente estiver vazio, o dano vai na Moral do oponente.
6. **Bate o sinal** — efeitos "fim da rodada" (curas, Escola, Panela de Pressão). Cartas com Resistência ≤ 0 vão para o lixo. Checa vitória (Moral ≤ 0; se os dois zerarem juntos, empate).

Toda aleatoriedade usa o `rng` com seed da partida, para replay e anti-trapaça.

---

## 5. Anatomia da carta

```ts
type Family = 'familia'|'folclore'|'lendas'|'escola'|'rua'|'cozinha'|'varzea'|'bichos';
type CardType = 'pessoa'|'objeto'|'veiculo'|'bicho'|'assombracao';
type Rarity = 'comum'|'brilhante'|'holografica'|'carimbada';

interface CardDef {
  id: string;            // 'filtro-de-barro'
  name: string;
  family: Family;
  type: CardType;
  tags: string[];        // 'filho', 'moto', 'sobremesa', 'parente', 'jogador'...
  cost: number;          // Merenda
  power: number;         // Força
  toughness: number;     // Resistência
  speed: number;         // Pressa
  text: string;          // texto de regra exibido
  flavor: string;        // frase engraçada
  effects: Effect[];     // lógica (seção 6)
}
```

Raridade é da **cópia** do jogador, não da definição: mesma arte e mesmas regras, só muda o acabamento visual.

Layout da carta (referência visual): tag da família no topo à esquerda, custo num círculo terracota no topo à direita, arte 4:5, nome em Caprasimo, texto de regra, flavor em itálico, linha com Força / Pressa / Resistência.

---

## 6. Sistema de efeitos (o mais importante)

Os combos **não** devem ser `if` espalhados. Cada carta declara efeitos como dados:

```ts
type Trigger =
  | 'onEnter'            // entrou nesta rodada
  | 'onAllyEnter'        // outra carta entrou do meu lado
  | 'onRoundStart' | 'onRoundEnd'
  | 'beforeFight' | 'onDamaged' | 'onDeath'
  | 'static';            // aura contínua, recalculada sempre

type Condition =
  | { kind: 'allyHasTag'; tag: string; scope?: 'row'|'neighbors' }
  | { kind: 'enteringHasTag'; tag: string }
  | { kind: 'isNight' } | { kind: 'isDay' }
  | { kind: 'countFamily'; family: Family; min: number; scope: 'row'|'neighbors' }
  | { kind: 'roundsInPlay'; eq: number };

type Target =
  | 'self' | 'neighbors' | 'front' | 'randomEnemy' | 'allEnemies'
  | 'enemyNeighborsOfSelf' | { tag: string; side: 'ally'|'enemy'|'both' };

type Action =
  | { kind: 'damage'; amount: number; target: Target }
  | { kind: 'heal'; amount: number; target: Target }
  | { kind: 'buff'; power?: number; toughness?: number; speed?: number; target: Target; duration: 'round'|'permanent' }
  | { kind: 'directAttack'; target: Target }          // ignora a carta da frente
  | { kind: 'suspend'; target: Target; maxCost?: number } // Diretoria
  | { kind: 'swapEnemies'; count: 2 }
  | { kind: 'returnToHand'; target: Target }
  | { kind: 'peekFaceDown' }
  | { kind: 'repeatEnterEffect'; target: Target }
  | { kind: 'stealMerenda'; amount: number };

interface Effect { trigger: Trigger; conditions?: Condition[]; actions: Action[]; repeatPer?: { tag: string } }
```

Exemplos:

```ts
// Filtro de Barro: fim da rodada cura 1 nas vizinhas. Com Vó na fileira: cura 2 e +2 Resistência.
effects: [
  { trigger: 'onRoundEnd', actions: [{ kind: 'heal', amount: 1, target: 'neighbors' }] },
  { trigger: 'static', conditions: [{ kind: 'allyHasTag', tag: 'vo' }],
    actions: [{ kind: 'buff', toughness: 2, target: 'self', duration: 'round' },
              { kind: 'heal', amount: 1, target: 'neighbors' }] } // soma com o de cima = 2
]

// Mãe: quando um Filho entra do meu lado, chinelo em inimigo aleatório (1 por Filho).
effects: [{ trigger: 'onAllyEnter', conditions: [{ kind: 'enteringHasTag', tag: 'filho' }],
            actions: [{ kind: 'damage', amount: 3, target: 'randomEnemy' }] }]

// Mandrake: se houver Moto na fileira, ela ganha +3 Pressa e ataca a Moral direto.
effects: [{ trigger: 'onEnter', conditions: [{ kind: 'allyHasTag', tag: 'moto' }],
            actions: [{ kind: 'buff', speed: 3, target: { tag: 'moto', side: 'ally' }, duration: 'round' },
                      { kind: 'directAttack', target: { tag: 'moto', side: 'ally' } }] }]
```

Cada ação gera uma entrada no `log` (`{ type: 'chinelo', from, to, amount }`) que a UI transforma em animação. Escrever teste unitário para **cada** combo da seção 7.

---

## 7. Cartas e combos iniciais

| Carta | Família · Tipo · Tags | Custo | F/R/P | Efeito |
| --- | --- | --- | --- | --- |
| Filtro de Barro | cozinha · objeto | 2 | 0/4/1 | Fim da rodada: cura 1 nas vizinhas. **+ Vó:** Tapetinho de Crochê, cura 2 e +2 Resistência. |
| Vó | familia · pessoa · `vo`,`parente` | 3 | 1/5/2 | Parentesco: ao entrar, parentes vizinhos +1/+1 nesta rodada. |
| Mãe | familia · pessoa · `mae`,`parente` | 4 | 3/5/4 | Quando um Filho entra na sua fileira: Chinelo Teleguiado, 3 de dano em inimigo aleatório (1 chinelo por Filho). |
| Filho | familia · pessoa · `filho`,`parente` | 1 | 1/2/3 | — (ativa a Mãe) |
| Tio do Pavê | familia · pessoa · `parente` | 3 | 2/3/2 | Com Sobremesa na fileira: "É pavê ou pra comer?" Inimigos vizinhos à frente perdem 1 Força. |
| Pudim | cozinha · objeto · `sobremesa` | 1 | 0/3/1 | Fim da rodada: cura 1 em si mesmo. |
| Mandrake | rua · pessoa | 3 | 2/3/5 | Se houver Moto na fileira: a Moto ganha +3 Pressa e ataque direto na Moral. |
| Moto | rua · veiculo · `moto` | 2 | 2/2/3 | — |
| Vendedor de Pamonha | rua · pessoa | 2 | 1/3/6 | Carro de som: antes da revelação, espia 1 carta virada do oponente. |
| Saci | folclore · assombracao | 3 | 2/3/5 | À Noite: Redemoinho, troca de lugar duas cartas inimigas antes da briga. |
| Curupira | folclore · assombracao | 4 | 3/4/3 | À Noite: nesta rodada, as brigas são com a carteira diagonal (i+1). |
| Loira do Banheiro | lendas · assombracao | 4 | 4/3/2 | Boato: se o oponente revelar 2 cartas **e** usar Tapa na mesma rodada, ela entra de graça numa carteira sua vazia. |
| Homem do Saco | lendas · assombracao · `homem-saco` | 3 | 3/4/2 | **+ Mãe:** "Olha que ele vem te pegar." Seus Filhos +2 Resistência; o Homem do Saco não briga nesta rodada. |
| Merendeira | escola · pessoa · `cantina` | 2 | 1/4/2 | **+ Tia da Cantina:** Repeteco, repete 1 efeito de entrada da sua fileira. |
| Tia da Cantina | escola · pessoa · `cantina` | 2 | 1/3/2 | — |
| Inspetor | escola · pessoa | 3 | 2/3/3 | De Dia, ao entrar: manda uma carta inimiga de custo ≤ 3 para a Diretoria. |
| Panela de Pressão | cozinha · objeto | 2 | 0/5/0 | Apita 3 rodadas. Na terceira explode: 4 de dano nas vizinhas dos dois lados, e sai do jogo. |
| Craque da Várzea | varzea · pessoa · `jogador` | 2 | 2/2/3 | Time: +1/+1 para cada outro jogador vizinho. |
| Vira-lata Caramelo | bichos · bicho | 1 | 1/2/4 | Conta como qualquer família e qualquer tag de parente para combos. Nunca vai para a Diretoria. |
| Pombo | bichos · bicho | 1 | 1/1/5 | Se o oponente gastar toda a Merenda: rouba 1 dele na próxima rodada. |

Regra geral **Mãe + Várzea**: se a Mãe estiver na mesa e houver 2+ jogadores de várzea, "Pra dentro, agora!" — todos os jogadores de várzea (dos dois lados) voltam para a mão. Implementar como efeito `onEnter` da Mãe.

Palavras-chave por família (para cartas futuras): Família = Parentesco · Folclore = Assombro (+1/+1 à Noite) · Lendas = Boato (entra virada, revela com condição) · Escola = Sinal (fim de rodada, de Dia, Diretoria) · Rua = Grau (turbina Veículos, ataque direto) · Cozinha = Utensílio (sem Força, protege e cura) · Várzea = Time (bônus por vizinhos, Passe) · Bichos = Vira-lata (baratos, imprevisíveis).

Valores numéricos são o **primeiro balanceamento**. Deixar tudo em dados para ajustar sem mexer no motor.

---

## 8. Banca, pacotes e álbum

- **Banca do Seu Zé** é a tela inicial. Clicar na banca abre a compra.
- **Pacotinho**: 5 figurinhas, pelo menos 1 Brilhante. Chances por figurinha (ajustável): Comum 70%, Brilhante 22%, Holográfica 7%, Carimbada 1%.
- O sorteio acontece **só no servidor** (`open-pack`), gravando em `user_cards`.
- **Abertura**: rasgar o papel (arrastar), figurinhas saem uma a uma; a última fica virada até tocar.
- **Álbum**: páginas por família, espaço marcado para cada carta. Página completa dá recompensa.
- **Repetidas** viram **bolinhas de gude** (moeda de fabricação) ou vão para o **Troca-troca** entre amigos.
- **Moeda da banca: ainda indefinida.** Por enquanto, moeda do jogo ganha jogando (`profiles.coins`). Não implementar pagamento real.

---

## 9. Limites do humor (obrigatório)

Humor de situações que todo brasileiro reconhece, nunca ridicularizando grupos. Proibido em cartas, textos e arte: crime, drogas, violência real, armas, sangue, religião, raça, classe social, pessoas ou marcas reais. O Mandrake é sobre estilo e o grau na moto, sempre de capacete. O chinelo da Mãe é exagero de desenho animado. O Saci não rouba: ele apronta com redemoinho. Toda carta nova passa por essa checagem.

---

## 10. Visual

### Interface (design system Organic)
Quente, arredondado, brincalhão. Layouts alinhados à esquerda, cantos muito arredondados, botões em pílula.

| Token | Valor |
| --- | --- |
| Fundo | `#f5ead8` (creme) |
| Texto | `#201e1d` |
| Acento | `#c67139` (terracota) — para texto pequeno usar o tom 700 da rampa |
| Acento 2 | `#7a8a5e` (sálvia) |
| Títulos | Caprasimo |
| Texto | Figtree |
| Raio | 16px contêineres, 999px botões/inputs |
| Ícones | Lucide, stroke-width 2.75 |
| Foco | `outline: 2px solid var(--color-accent); outline-offset: 2px` |

O arquivo `styles.css` nesta pasta tem todos os tokens (rampas 100–900, espaçamento, sombras). Importar como está.

### Arte das cartas: estilo "Cordel Riso"
Xilogravura de cordel (traço preto grosso entalhado) + risografia em 2 cores (retícula, desalinhamento, papel granulado) + borda de figurinha recortada. Personagem de corpo inteiro, cabeça grande, expressão engraçada, uma forma simples no fundo. Vertical 4:5. Sem texto na imagem.

| Família | Tinta 1 (personagem) | Tinta 2 (fundo) | Forma do fundo |
| --- | --- | --- | --- |
| Família | brick red | egg-yolk yellow | sol raiado |
| Folclore | deep forest green | fire orange | lua cheia |
| Lendas Urbanas | violet | acid lime | nuvem de fumaça |
| Escola | ballpoint blue | pencil yellow | quadro-negro redondo |
| Rua | traffic orange | sky blue | sol raiado |
| Cozinha e Casa | fluorescent pink | teal | círculo |
| Várzea | grass green | warm red | bola gigante |
| Bichos | caramel brown | pool blue | círculo |

Raridade é efeito do app por cima da arte: Brilhante (fundo dourado metalizado), Holográfica (reflexo arco-íris que segue mouse/giroscópio), Carimbada (carimbo torto, borda serrilhada, número de série).

**Montagem do prompt** (Gemini, em inglês):

```
[BASE] Inks: [TINTA 1] for the character, [TINTA 2] for the [FORMA]. Character: [PERSONAGEM]. Action: [AÇÃO]. [RESTRIÇÕES]
```

BASE:
```
Brazilian cordel woodcut illustration printed as a two-color risograph, sticker style. Bold hand-carved black outlines with rough gouge marks, flat ink fills, visible halftone dots, slight misregistration between color layers, grainy cream paper texture. Single full-body cartoon character centered, big head, oversized hands and feet, exaggerated funny expression. Thick off-white die-cut sticker border around the character. One simple background shape behind the character, plain paper elsewhere. Vertical 4:5 composition with margin around the sticker.
```

RESTRIÇÕES:
```
Only black plus the two inks listed, no other colors. No text, no letters, no numbers, no logos, no brand names, no real people, no weapons, no blood, no gradients, no glossy highlights, no 3D render, no photorealism.
```

Personagem/ação por carta (guardar em `cards.art_character` / `cards.art_action`):

| Carta | Character | Action |
| --- | --- | --- |
| Filtro de Barro | a chubby clay water filter with little arms and legs, a tiny tin cup hanging from its tap | proudly pouring water into a cup, chest puffed out, water drops sparkling, very satisfied smile |
| Vó | a tiny grandmother with round glasses, hair bun, floral dress and slippers, holding a crochet doily and knitting needles | offering a plate of food with a stern loving look that says you will eat all of it |
| Mãe | a mother in an apron with hair curlers, one hand on her hip | winding up to throw a flip-flop that has motion lines curving like a boomerang, eyes squinting with laser focus |
| Tio do Pavê | a mustached uncle in a loud printed shirt holding a big glass dish of layered dessert | pointing at the dessert and laughing at his own joke while the dessert itself rolls its eyes |
| Mandrake | a stylish young guy with a flat-brim cap, sunglasses, chain necklace and a full-face helmet under his arm | posing confidently with two fingers up, one eyebrow raised, a small scooter behind him |
| Moto | a small street scooter with a face on its headlight | doing a wheelie, front wheel high in the air, headlight eyes wide with joy, motion lines behind |
| Vendedor de Pamonha | a cheerful street vendor next to an old car with a giant loudspeaker on the roof, holding corn husk bundles | shouting into the loudspeaker so loud that sound waves shake the whole scene, birds flying away |
| Saci | a one-legged mischievous boy with a red pointed cap and a small pipe, from Brazilian folklore | spinning inside a little whirlwind with a playful grin, leaves swirling around him |
| Curupira | a forest guardian boy with flaming orange hair and feet turned backwards | walking away while his footprints point the other way, winking at the viewer |
| Loira do Banheiro | a spooky but silly ghost girl with long pale hair and cotton in her nose, peeking out of a school bathroom stall | saying boo, then looking embarrassed because nobody got scared |
| Homem do Saco | a tall lanky figure in a long coat carrying a big empty burlap sack | tiptoeing dramatically but the sack only contains a single sock and a lost school eraser |
| Merendeira | a school lunch lady with hairnet and apron holding a giant ladle and a steaming pot | serving an impossibly tall pile of rice and beans with pride |
| Inspetor | a school hall monitor with a whistle, clipboard and suspicious squinting eyes | blowing the whistle so hard his cheeks balloon, pointing toward an office door |
| Panela de Pressão | a pressure cooker with a face and a spinning valve on top | whistling steam furiously, trembling, eyes bulging, about to pop |
| Vira-lata Caramelo | a caramel-colored mixed-breed street dog with one floppy ear | sitting with a huge innocent smile and tongue out, wagging tail blurred with motion lines |
| Pombo | a chunky city pigeon with puffed chest | strutting with overconfident attitude, a single bread crumb balanced on its head |
| Craque da Várzea | an amateur soccer player in a mismatched jersey and shin guards, one sock down | juggling a ball on his knee on a dirt field, tongue out in concentration |

Consistência: gerar primeiro o Filtro de Barro como **carta-âncora** e anexá-lo como referência nas próximas ("Match the exact style of the reference image."). Depois, uma âncora por família. A chave do Gemini fica **só** na Edge Function `generate-art`, nunca no cliente. Até lá, as imagens são geradas manualmente e enviadas para o Storage (`card-art/{card_id}.png`).

---

## 11. Banco de dados (Supabase)

```sql
create table families (
  id text primary key, name text not null,
  ink_1 text, ink_2 text, bg_shape text
);

create table cards (
  id text primary key, name text not null,
  family text references families(id), type text not null, tags text[] default '{}',
  cost int, power int, toughness int, speed int,
  text text, flavor text, effects jsonb not null default '[]',
  art_character text, art_action text, art_prompt text,
  art_url text, art_status text default 'rascunho'  -- rascunho | aprovada
);

create table profiles (
  id uuid primary key references auth.users, username text unique,
  coins int default 0, marbles int default 0, created_at timestamptz default now()
);

create table user_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id), card_id text references cards(id),
  rarity text not null, serial int, obtained_at timestamptz default now()
);

create table decks (id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id), name text);
create table deck_cards (deck_id uuid references decks(id) on delete cascade, user_card_id uuid references user_cards(id), primary key (deck_id, user_card_id));

create table matches (
  id uuid primary key default gen_random_uuid(),
  player_a uuid, player_b uuid, seed bigint not null,
  state jsonb not null, round int default 1, status text default 'ativa'
);

create table match_moves (   -- jogadas escondidas; RLS: ninguém lê a do outro
  match_id uuid references matches(id), round int, player uuid,
  move jsonb not null, primary key (match_id, round, player)
);
```

RLS: `user_cards`, `decks` e `match_moves` só visíveis pelo dono. `resolve-round` (service role) roda quando os dois `match_moves` da rodada existem, chama o motor e publica o novo `state` + `log` via Realtime.

---

## 12. Telas

1. **Banca** — banca de jornal ilustrada, Seu Zé, botão comprar pacotinho, saldo.
2. **Abrir pacote** — rasgar, revelar 5 figurinhas.
3. **Álbum** — páginas por família, espaços vazios, contador de repetidas.
4. **Deck** — grade da coleção com filtros por família/tipo, deck à direita (PC) ou embaixo (celular), validação 30 cartas / 3 famílias.
5. **Partida** — duas fileiras de 5 carteiras, mão embaixo, Moral/Merenda/Tapas, relógio Dia/Noite, timer de 30 s, botão "Bafo!" para confirmar. Revelação com animação de virar ao mesmo tempo; o `log` toca em sequência (chinelo voando, moto empinando, redemoinho).
6. **Resultado** — vitória/derrota, recompensa de moedas.

Celular: tudo em uma coluna, mesa ocupando a largura, mão arrastável. PC: mesa central, log lateral.

---

## 13. Ordem de construção

1. **Setup** — Vite + React + TS + PWA + tokens do `styles.css`. Deploy estático.
2. **Motor** — `engine/` puro com as 20 cartas da seção 7 e testes de cada combo. Rodar partida no terminal.
3. **Partida local** — tela de batalha contra um bot simples (joga a carta mais cara que cabe, Tapa aleatório). Decks pré-montados. Arte ainda como espaço vazio com nome.
4. **Supabase** — auth, tabelas, seed das cartas, `open-pack`, banca, abertura, álbum.
5. **Deck builder** com a coleção real.
6. **Online** — `submit-move` / `resolve-round` + Realtime.
7. **Arte** — subir imagens aprovadas; depois `generate-art`.
8. **Polimento** — efeitos de raridade, sons (sinal da escola, chinelo, apito da panela), Troca-troca.

---

## 14. Perguntas em aberto

- Contra bot, contra amigos ou as duas coisas no lançamento? (Plano acima: bot primeiro.)
- Duração ideal da partida (meta: 8–10 min).
- Modelo da moeda da banca.
- Modo "Bafo valendo carta" entre amigos?
