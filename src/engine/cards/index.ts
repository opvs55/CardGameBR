import type { CardDef, Family, HeroDef } from '../types';

// Cartas do Bafo! no sistema de turnos. Todo número aqui é o primeiro
// balanceamento: ajuste nos dados, nunca no motor.

type MinionInput = Omit<CardDef, 'kind' | 'keywords' | 'collectible'> &
  Partial<Pick<CardDef, 'keywords' | 'collectible'>>;
type SpellInput = Omit<CardDef, 'kind' | 'keywords' | 'power' | 'toughness' | 'type' | 'tags' | 'collectible'> &
  Partial<Pick<CardDef, 'tags' | 'collectible'>>;

const minion = (c: MinionInput): CardDef => ({ kind: 'minion', keywords: [], collectible: true, ...c });
const spell = (c: SpellInput): CardDef => ({
  kind: 'spell',
  type: 'feitico',
  tags: [],
  power: 0,
  toughness: 0,
  keywords: [],
  collectible: true,
  ...c,
});

export const CARDS: CardDef[] = [
  // ─────────────── Família ───────────────
  minion({
    id: 'vo',
    name: 'Vó',
    family: 'familia',
    type: 'pessoa',
    tags: ['vo', 'parente'],
    cost: 3,
    power: 2,
    toughness: 4,
    text: 'Chegada: parentes vizinhos ganham +1/+1.',
    flavor: 'Tá magrinho. Come mais um pouquinho.',
    effects: [
      {
        trigger: 'chegada',
        name: 'Parentesco',
        actions: [
          {
            kind: 'buff',
            power: 1,
            toughness: 1,
            target: { tag: 'parente', side: 'ally', neighbors: true },
            duration: 'permanent',
          },
        ],
      },
    ],
    art: {
      character:
        'a tiny grandmother with round glasses, hair bun, floral dress and slippers, holding a crochet doily and knitting needles',
      action: 'offering a plate of food with a stern loving look that says you will eat all of it',
    },
  }),
  minion({
    id: 'mae',
    name: 'Mãe',
    family: 'familia',
    type: 'pessoa',
    tags: ['mae', 'parente'],
    cost: 4,
    power: 3,
    toughness: 5,
    text: 'Quando um Filho entra do seu lado: Chinelo Teleguiado, 3 de dano num inimigo aleatório. Chegada: com 2+ jogadores de várzea na mesa, "Pra dentro, agora!" e todos voltam para a mão.',
    flavor: 'Vou contar até três...',
    effects: [
      {
        trigger: 'onAllyEnter',
        name: 'Chinelo Teleguiado',
        conditions: [{ kind: 'enteringHasTag', tag: 'filho' }],
        actions: [{ kind: 'damage', amount: 3, target: 'randomEnemy' }],
      },
      {
        trigger: 'chegada',
        name: 'Pra dentro, agora!',
        conditions: [{ kind: 'countTag', tag: 'jogador', min: 2, side: 'both' }],
        actions: [{ kind: 'returnToHand', target: { tag: 'jogador', side: 'both' } }],
      },
    ],
    art: {
      character: 'a mother in an apron with hair curlers, one hand on her hip',
      action:
        'winding up to throw a flip-flop that has motion lines curving like a boomerang, eyes squinting with laser focus',
    },
  }),
  minion({
    id: 'filho',
    name: 'Filho',
    family: 'familia',
    type: 'pessoa',
    tags: ['filho', 'parente'],
    cost: 1,
    power: 1,
    toughness: 2,
    text: 'Faz a Mãe jogar o chinelo.',
    flavor: 'Mãe, cadê meu tênis? Mãe? MÃE?',
    effects: [],
    art: {
      character: 'a skinny kid with messy hair, untied sneakers and a school backpack twice his size',
      action: 'running in with a guilty grin after breaking something off-screen, one sneaker flying off',
    },
  }),
  minion({
    id: 'tio-do-pave',
    name: 'Tio do Pavê',
    family: 'familia',
    type: 'pessoa',
    tags: ['parente'],
    cost: 3,
    power: 3,
    toughness: 3,
    target: { kind: 'enemyMinion' },
    text: 'Chegada: se você tiver uma Sobremesa, "É pavê ou pra comer?" Uma carta inimiga perde 2 de Força.',
    flavor: 'Conta essa piada desde 1987. Ri sozinho desde 1987.',
    effects: [
      {
        trigger: 'chegada',
        name: 'É pavê ou pra comer?',
        conditions: [{ kind: 'allyHasTag', tag: 'sobremesa' }],
        actions: [{ kind: 'buff', power: -2, target: 'chosen', duration: 'permanent' }],
      },
    ],
    art: {
      character: 'a mustached uncle in a loud printed shirt holding a big glass dish of layered dessert',
      action: 'pointing at the dessert and laughing at his own joke while the dessert itself rolls its eyes',
    },
  }),
  spell({
    id: 'chinelada',
    name: 'Chinelada',
    family: 'familia',
    cost: 1,
    target: { kind: 'anyCharacter' },
    text: 'Causa 2 de dano.',
    flavor: 'Efeito teleguiado. Alcance ilimitado.',
    effects: [{ trigger: 'spell', name: 'Chinelada', actions: [{ kind: 'damage', amount: 2, target: 'chosen' }] }],
    art: {
      character: 'a single rubber flip-flop with a determined face',
      action: 'flying through the air with curved boomerang motion lines, stars trailing behind it',
    },
  }),

  // ─────────────── Cozinha e Casa ───────────────
  minion({
    id: 'filtro-de-barro',
    name: 'Filtro de Barro',
    family: 'cozinha',
    type: 'objeto',
    tags: [],
    cost: 2,
    power: 0,
    toughness: 4,
    keywords: ['provocar'],
    text: 'Provocar. Fim do seu turno: cura 1 nas vizinhas. Com Vó do seu lado: Tapetinho de Crochê, cura 2 e +2 Resistência.',
    flavor: 'Água de filtro de barro é outro nível. Todo mundo sabe.',
    effects: [
      { trigger: 'onTurnEnd', name: 'Água fresquinha', actions: [{ kind: 'heal', amount: 1, target: 'neighbors' }] },
      {
        trigger: 'onTurnEnd',
        name: 'Tapetinho de Crochê',
        conditions: [{ kind: 'allyHasTag', tag: 'vo' }],
        actions: [{ kind: 'heal', amount: 1, target: 'neighbors' }],
      },
      {
        trigger: 'static',
        conditions: [{ kind: 'allyHasTag', tag: 'vo' }],
        actions: [{ kind: 'buff', toughness: 2, target: 'self', duration: 'turn' }],
      },
    ],
    art: {
      character: 'a chubby clay water filter with little arms and legs, a tiny tin cup hanging from its tap',
      action: 'proudly pouring water into a cup, chest puffed out, water drops sparkling, very satisfied smile',
    },
  }),
  minion({
    id: 'pudim',
    name: 'Pudim',
    family: 'cozinha',
    type: 'objeto',
    tags: ['sobremesa'],
    cost: 1,
    power: 1,
    toughness: 3,
    text: 'Sobremesa. Fim do seu turno: cura 1 em si mesmo.',
    flavor: 'Com furinho no meio, do jeito certo.',
    effects: [{ trigger: 'onTurnEnd', name: 'Calda', actions: [{ kind: 'heal', amount: 1, target: 'self' }] }],
    art: {
      character: 'a wobbly caramel flan with a hole in the middle, shiny syrup dripping down its sides, tiny legs',
      action: 'jiggling happily and waving, a drop of syrup landing on its own foot',
    },
  }),
  minion({
    id: 'panela-de-pressao',
    name: 'Panela de Pressão',
    family: 'cozinha',
    type: 'objeto',
    tags: [],
    cost: 2,
    power: 0,
    toughness: 4,
    keywords: ['provocar'],
    text: 'Provocar. No fim do seu 3º turno em jogo, explode: 3 de dano em todas as outras cartas da mesa, e sai do jogo.',
    flavor: 'Pssss... PSSSSS... PSSSSSSSSSSS...',
    effects: [
      {
        trigger: 'onTurnEnd',
        name: 'Explodiu!',
        conditions: [{ kind: 'turnsInPlay', eq: 3 }],
        actions: [
          { kind: 'damage', amount: 3, target: 'allOtherMinions' },
          { kind: 'destroy', target: 'self' },
        ],
      },
    ],
    art: {
      character: 'a pressure cooker with a face and a spinning valve on top',
      action: 'whistling steam furiously, trembling, eyes bulging, about to pop',
    },
  }),
  spell({
    id: 'hora-do-lanche',
    name: 'Hora do Lanche',
    family: 'cozinha',
    cost: 3,
    text: 'Compre 2 cartas.',
    flavor: 'Pão com manteiga na chapa e café com leite.',
    effects: [{ trigger: 'spell', name: 'Hora do Lanche', actions: [{ kind: 'draw', count: 2 }] }],
    art: {
      character: 'a steaming cup of coffee with milk and a buttered bread roll, both with happy faces',
      action: 'the bread roll dunking itself into the cup with a big splash',
    },
  }),
  spell({
    id: 'faxina-de-sabado',
    name: 'Faxina de Sábado',
    family: 'cozinha',
    cost: 4,
    text: 'Causa 2 de dano em todas as cartas inimigas.',
    flavor: 'Liga o rádio, abre a janela e ninguém pisa no chão molhado.',
    effects: [
      { trigger: 'spell', name: 'Faxina de Sábado', actions: [{ kind: 'damage', amount: 2, target: 'allEnemyMinions' }] },
    ],
    art: {
      character: 'a bucket with a face holding a squeegee and a soapy floor cloth',
      action: 'sweeping a wave of soap bubbles across the floor, determined eyebrows, bubbles everywhere',
    },
  }),

  // ─────────────── Rua ───────────────
  minion({
    id: 'mandrake',
    name: 'Mandrake',
    family: 'rua',
    type: 'pessoa',
    tags: [],
    cost: 3,
    power: 3,
    toughness: 2,
    keywords: ['capacete'],
    text: 'Capacete. Chegada: se você tiver uma Moto, Grau! Ela ganha +2 Força, pode atacar neste turno e ignora Provocar.',
    flavor: 'Grau é arte. Capacete é lei.',
    effects: [
      {
        trigger: 'chegada',
        name: 'Grau',
        conditions: [{ kind: 'allyHasTag', tag: 'moto' }],
        actions: [
          { kind: 'buff', power: 2, target: { tag: 'moto', side: 'ally' }, duration: 'turn' },
          { kind: 'giveKeyword', keyword: 'pressa', target: { tag: 'moto', side: 'ally' }, duration: 'turn' },
          { kind: 'giveKeyword', keyword: 'grau', target: { tag: 'moto', side: 'ally' }, duration: 'turn' },
        ],
      },
    ],
    art: {
      character:
        'a stylish young guy with a flat-brim cap, sunglasses, chain necklace and a full-face helmet under his arm',
      action: 'posing confidently with two fingers up, one eyebrow raised, a small scooter behind him',
    },
  }),
  minion({
    id: 'moto',
    name: 'Moto',
    family: 'rua',
    type: 'veiculo',
    tags: ['moto'],
    cost: 2,
    power: 2,
    toughness: 1,
    keywords: ['pressa'],
    text: 'Pressa.',
    flavor: 'Tanque cheio, farol aceso, sorriso no para-choque.',
    effects: [],
    art: {
      character: 'a small street scooter with a face on its headlight',
      action: 'doing a wheelie, front wheel high in the air, headlight eyes wide with joy, motion lines behind',
    },
  }),
  minion({
    id: 'vendedor-de-pamonha',
    name: 'Vendedor de Pamonha',
    family: 'rua',
    type: 'pessoa',
    tags: [],
    cost: 2,
    power: 1,
    toughness: 3,
    text: 'Carro de som: no início do seu turno, espia 1 carta da mão do oponente.',
    flavor: 'Olha a pamonha! Pamonha fresquinha! É o puro creme do milho!',
    effects: [{ trigger: 'onTurnStart', name: 'Carro de som', actions: [{ kind: 'peekHand' }] }],
    art: {
      character:
        'a cheerful street vendor next to an old car with a giant loudspeaker on the roof, holding corn husk bundles',
      action: 'shouting into the loudspeaker so loud that sound waves shake the whole scene, birds flying away',
    },
  }),

  // ─────────────── Folclore ───────────────
  minion({
    id: 'saci',
    name: 'Saci',
    family: 'folclore',
    type: 'assombracao',
    tags: [],
    cost: 3,
    power: 3,
    toughness: 2,
    text: 'Chegada: à Noite, Redemoinho! Devolve uma carta inimiga aleatória de custo 3 ou menos para a mão do dono.',
    flavor: 'Não levou nada. Só bagunçou tudo.',
    effects: [
      {
        trigger: 'chegada',
        name: 'Redemoinho',
        conditions: [{ kind: 'isNight' }],
        actions: [{ kind: 'returnToHand', target: 'randomEnemyMinion', maxCost: 3 }],
      },
    ],
    art: {
      character: 'a one-legged mischievous boy with a red pointed cap and a small pipe, from Brazilian folklore',
      action: 'spinning inside a little whirlwind with a playful grin, leaves swirling around him',
    },
  }),
  minion({
    id: 'curupira',
    name: 'Curupira',
    family: 'folclore',
    type: 'assombracao',
    tags: [],
    cost: 4,
    power: 3,
    toughness: 5,
    text: 'Pés virados: à Noite, não pode ser atacado.',
    flavor: 'Pode seguir as pegadas. Boa sorte.',
    effects: [
      {
        trigger: 'static',
        name: 'Pés virados',
        conditions: [{ kind: 'isNight' }],
        actions: [{ kind: 'giveKeyword', keyword: 'escondido', target: 'self', duration: 'turn' }],
      },
    ],
    art: {
      character: 'a forest guardian boy with flaming orange hair and feet turned backwards',
      action: 'walking away while his footprints point the other way, winking at the viewer',
    },
  }),

  // ─────────────── Lendas Urbanas ───────────────
  minion({
    id: 'loira-do-banheiro',
    name: 'Loira do Banheiro',
    family: 'lendas',
    type: 'assombracao',
    tags: [],
    cost: 4,
    power: 4,
    toughness: 3,
    text: 'Boato: quando o oponente jogar a 3ª carta no mesmo turno, ela sai da sua mão e entra de graça.',
    flavor: 'Buuu! ...Ninguém? Tá bom, então.',
    effects: [
      {
        trigger: 'inHand',
        name: 'Boato',
        conditions: [{ kind: 'opponentPlayedThisTurn', min: 3 }, { kind: 'hasBoardSpace' }],
        actions: [{ kind: 'enterFree' }],
      },
    ],
    art: {
      character:
        'a spooky but silly ghost girl with long pale hair and cotton in her nose, peeking out of a school bathroom stall',
      action: 'saying boo, then looking embarrassed because nobody got scared',
    },
  }),
  minion({
    id: 'homem-do-saco',
    name: 'Homem do Saco',
    family: 'lendas',
    type: 'assombracao',
    tags: ['homem-saco'],
    cost: 3,
    power: 3,
    toughness: 4,
    text: 'Com Mãe do seu lado: "Olha que ele vem te pegar." Seus Filhos ganham +2 Resistência e Provocar.',
    flavor: 'No saco só tem uma meia e uma borracha.',
    effects: [
      {
        trigger: 'static',
        name: 'Olha que ele vem te pegar',
        conditions: [{ kind: 'allyHasTag', tag: 'mae' }],
        actions: [
          { kind: 'buff', toughness: 2, target: { tag: 'filho', side: 'ally' }, duration: 'turn' },
          { kind: 'giveKeyword', keyword: 'provocar', target: { tag: 'filho', side: 'ally' }, duration: 'turn' },
        ],
      },
    ],
    art: {
      character: 'a tall lanky figure in a long coat carrying a big empty burlap sack',
      action: 'tiptoeing dramatically but the sack only contains a single sock and a lost school eraser',
    },
  }),
  spell({
    id: 'assombracao-na-janela',
    name: 'Assombração na Janela',
    family: 'lendas',
    cost: 2,
    target: { kind: 'enemyMinion' },
    text: 'Devolve uma carta inimiga para a mão do dono.',
    flavor: 'Era só a cortina. Mas ninguém voltou pra conferir.',
    effects: [
      { trigger: 'spell', name: 'Assombração na Janela', actions: [{ kind: 'returnToHand', target: 'chosen' }] },
    ],
    art: {
      character: 'a white bedsheet ghost with two eye holes floating outside a window with a flowery curtain',
      action: 'making spooky hand gestures while the curtain flutters, looking very proud of itself',
    },
  }),

  // ─────────────── Escola ───────────────
  minion({
    id: 'merendeira',
    name: 'Merendeira',
    family: 'escola',
    type: 'pessoa',
    tags: ['cantina'],
    cost: 2,
    power: 1,
    toughness: 4,
    text: 'Chegada: com Tia da Cantina do seu lado, Repeteco! Repete a Chegada de outra carta sua.',
    flavor: 'Hoje tem repeteco!',
    effects: [
      {
        trigger: 'chegada',
        name: 'Repeteco',
        conditions: [{ kind: 'allyHasTag', tag: 'cantina' }],
        actions: [{ kind: 'repeatChegada' }],
      },
    ],
    art: {
      character: 'a school lunch lady with hairnet and apron holding a giant ladle and a steaming pot',
      action: 'serving an impossibly tall pile of rice and beans with pride',
    },
  }),
  minion({
    id: 'tia-da-cantina',
    name: 'Tia da Cantina',
    family: 'escola',
    type: 'pessoa',
    tags: ['cantina'],
    cost: 2,
    power: 2,
    toughness: 3,
    text: 'Chegada: restaura 2 de Moral do seu herói.',
    flavor: 'Fiado só amanhã.',
    effects: [{ trigger: 'chegada', name: 'Salgadinho', actions: [{ kind: 'heal', amount: 2, target: 'allyHero' }] }],
    art: {
      character: 'a friendly school snack bar lady behind a small counter full of snacks, pencil behind her ear',
      action: 'handing a warm cheese bread to a tiny hand reaching up, while writing on a notebook with the other hand',
    },
  }),
  minion({
    id: 'inspetor',
    name: 'Inspetor',
    family: 'escola',
    type: 'pessoa',
    tags: [],
    cost: 3,
    power: 2,
    toughness: 3,
    target: { kind: 'enemyMinion', maxCost: 3 },
    text: 'Chegada: de Dia, manda uma carta inimiga de custo 3 ou menos para a Diretoria. Ela perde o próximo turno do dono e volta depois.',
    flavor: 'Pra diretoria. Agora.',
    effects: [
      {
        trigger: 'chegada',
        name: 'Pra diretoria!',
        conditions: [{ kind: 'isDay' }],
        actions: [{ kind: 'suspend', target: 'chosen', maxCost: 3 }],
      },
    ],
    art: {
      character: 'a school hall monitor with a whistle, clipboard and suspicious squinting eyes',
      action: 'blowing the whistle so hard his cheeks balloon, pointing toward an office door',
    },
  }),
  spell({
    id: 'tapa',
    name: 'Tapa',
    family: 'escola',
    cost: 1,
    target: { kind: 'enemyMinion' },
    text: 'Vira uma carta inimiga: ela perde todos os efeitos e toma 1 de dano.',
    flavor: 'O golpe clássico do bafo. Vira ou não vira?',
    effects: [
      {
        trigger: 'spell',
        name: 'Tapa',
        actions: [
          { kind: 'silence', target: 'chosen' },
          { kind: 'damage', amount: 1, target: 'chosen' },
        ],
      },
    ],
    art: {
      character: 'a big open cartoon hand slapping down on a pile of stickers on a school floor',
      action: 'the stickers flipping up into the air with impact lines, one sticker spinning mid-flip',
    },
  }),
  spell({
    id: 'troco',
    name: 'Troco da Merenda',
    family: 'escola',
    cost: 0,
    collectible: false,
    text: 'Ganha 1 de Merenda neste turno.',
    flavor: 'Achou no bolso da calça. Dia de sorte.',
    effects: [{ trigger: 'spell', name: 'Troco', actions: [{ kind: 'gainMerenda', amount: 1, when: 'now' }] }],
    art: {
      character: 'a shiny coin with a cheeky face',
      action: 'popping out of a pants pocket and doing a little jump of joy',
    },
  }),

  // ─────────────── Várzea ───────────────
  minion({
    id: 'craque-da-varzea',
    name: 'Craque da Várzea',
    family: 'varzea',
    type: 'pessoa',
    tags: ['jogador'],
    cost: 2,
    power: 2,
    toughness: 2,
    text: 'Time: +1/+1 para cada outro jogador de várzea do seu lado.',
    flavor: 'Joga de chinelo e ainda dá caneta.',
    effects: [
      {
        trigger: 'static',
        name: 'Time',
        repeatPer: { tag: 'jogador' },
        actions: [{ kind: 'buff', power: 1, toughness: 1, target: 'self', duration: 'turn' }],
      },
    ],
    art: {
      character: 'an amateur soccer player in a mismatched jersey and shin guards, one sock down',
      action: 'juggling a ball on his knee on a dirt field, tongue out in concentration',
    },
  }),
  minion({
    id: 'moleque-da-varzea',
    name: 'Moleque da Várzea',
    family: 'varzea',
    type: 'pessoa',
    tags: ['jogador'],
    cost: 1,
    power: 1,
    toughness: 1,
    collectible: false,
    text: 'Jogador de várzea.',
    flavor: 'Só entra se trouxer a bola.',
    effects: [],
    art: {
      character: 'a small barefoot kid in an oversized soccer jersey holding a worn ball',
      action: 'running onto the dirt field waving, ready to play',
    },
  }),
  spell({
    id: 'pelada-no-campinho',
    name: 'Pelada no Campinho',
    family: 'varzea',
    cost: 2,
    text: 'Chama dois Moleques da Várzea 1/1.',
    flavor: 'Par ou ímpar pra ver quem escolhe.',
    effects: [
      { trigger: 'spell', name: 'Pelada no Campinho', actions: [{ kind: 'summon', cardId: 'moleque-da-varzea', count: 2 }] },
    ],
    art: {
      character: 'a dirt soccer field with two goals made of flip-flops',
      action: 'a soccer ball bouncing high in the middle, dust clouds puffing up',
    },
  }),

  // ─────────────── Bichos ───────────────
  minion({
    id: 'vira-lata-caramelo',
    name: 'Vira-lata Caramelo',
    family: 'bichos',
    type: 'bicho',
    tags: [],
    cost: 1,
    power: 1,
    toughness: 2,
    text: 'Conta como qualquer parente para combos (Vó, Mãe, Filho). Nunca vai para a Diretoria.',
    flavor: 'Patrimônio nacional. Sem raça definida, com amor de sobra.',
    wildcard: true,
    immuneToSuspend: true,
    effects: [],
    art: {
      character: 'a caramel-colored mixed-breed street dog with one floppy ear',
      action: 'sitting with a huge innocent smile and tongue out, wagging tail blurred with motion lines',
    },
  }),
  minion({
    id: 'pombo',
    name: 'Pombo',
    family: 'bichos',
    type: 'bicho',
    tags: [],
    cost: 1,
    power: 1,
    toughness: 1,
    keywords: ['pressa'],
    text: 'Pressa. Se o oponente gastar toda a Merenda no turno dele, você ganha +1 de Merenda no seu próximo turno.',
    flavor: 'Anda como se fosse dono da praça. E é.',
    effects: [
      {
        trigger: 'onEnemyTurnEnd',
        name: 'Pega o farelo',
        conditions: [{ kind: 'opponentSpentAllMerenda' }],
        actions: [{ kind: 'gainMerenda', amount: 1, when: 'nextTurn' }],
      },
    ],
    art: {
      character: 'a chunky city pigeon with puffed chest',
      action: 'strutting with overconfident attitude, a single bread crumb balanced on its head',
    },
  }),
];

export const CARD_MAP: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const COLLECTIBLE = CARDS.filter((c) => c.collectible !== false);

export function getCard(id: string): CardDef {
  const card = CARD_MAP[id];
  if (!card) throw new Error(`Carta desconhecida: ${id}`);
  return card;
}

/** Tags que o Vira-lata Caramelo imita. */
export const PARENT_TAGS = ['parente', 'vo', 'mae', 'filho'];

// ─────────────── Heróis ───────────────

export const HEROES: HeroDef[] = [
  {
    id: 'vo-cida',
    name: 'Vó Cida',
    title: 'Dona do almoço de domingo',
    family: 'familia',
    power: {
      name: 'Cafuné',
      text: 'Restaura 2 de Resistência ou Moral de um aliado.',
      cost: 2,
      target: { kind: 'allyCharacter' },
      effects: [{ trigger: 'spell', name: 'Cafuné', actions: [{ kind: 'heal', amount: 2, target: 'chosen' }] }],
    },
    art: {
      character: 'a cheerful grandmother in an apron with a wooden spoon, sitting in a rocking chair',
      action: 'patting a sleepy kid on the head with a warm smile',
    },
  },
  {
    id: 'zeca-do-grau',
    name: 'Zeca do Grau',
    title: 'Rei do rolê',
    family: 'rua',
    power: {
      name: 'Buzinada',
      text: 'Causa 1 de dano.',
      cost: 2,
      target: { kind: 'anyCharacter' },
      effects: [{ trigger: 'spell', name: 'Buzinada', actions: [{ kind: 'damage', amount: 1, target: 'chosen' }] }],
    },
    art: {
      character: 'a young guy on a small scooter wearing a full-face helmet with a big grin visible',
      action: 'squeezing a comically large horn that blasts sound waves',
    },
  },
];

export const HERO_MAP: Record<string, HeroDef> = Object.fromEntries(HEROES.map((h) => [h.id, h]));

export function getHero(id: string): HeroDef {
  const hero = HERO_MAP[id];
  if (!hero) throw new Error(`Herói desconhecido: ${id}`);
  return hero;
}

// ─────────────── Famílias ───────────────

export interface FamilyInfo {
  id: Family;
  name: string;
  keyword: string;
  ink1: string;
  ink2: string;
  bgShape: string;
  /** Cores aproximadas das tintas, para o placeholder de arte. */
  hex1: string;
  hex2: string;
}

export const FAMILIES: Record<Family, FamilyInfo> = {
  familia: { id: 'familia', name: 'Família', keyword: 'Parentesco', ink1: 'brick red', ink2: 'egg-yolk yellow', bgShape: 'radiating sunburst', hex1: '#a8402f', hex2: '#f2b631' },
  folclore: { id: 'folclore', name: 'Folclore', keyword: 'Assombro', ink1: 'deep forest green', ink2: 'fire orange', bgShape: 'full moon', hex1: '#1f5a3a', hex2: '#ef6a22' },
  lendas: { id: 'lendas', name: 'Lendas Urbanas', keyword: 'Boato', ink1: 'violet', ink2: 'acid lime', bgShape: 'puff of smoke cloud', hex1: '#6b3fa0', hex2: '#c4e03a' },
  escola: { id: 'escola', name: 'Escola', keyword: 'Sinal', ink1: 'ballpoint blue', ink2: 'pencil yellow', bgShape: 'round chalkboard', hex1: '#2a4ba8', hex2: '#f4c430' },
  rua: { id: 'rua', name: 'Rua', keyword: 'Grau', ink1: 'traffic orange', ink2: 'sky blue', bgShape: 'radiating sunburst', hex1: '#e8611a', hex2: '#6cc3ee' },
  cozinha: { id: 'cozinha', name: 'Cozinha e Casa', keyword: 'Utensílio', ink1: 'fluorescent pink', ink2: 'teal', bgShape: 'circle', hex1: '#e9458f', hex2: '#1f9a96' },
  varzea: { id: 'varzea', name: 'Várzea', keyword: 'Time', ink1: 'grass green', ink2: 'warm red', bgShape: 'giant soccer ball', hex1: '#3f9a3a', hex2: '#d9432f' },
  bichos: { id: 'bichos', name: 'Bichos', keyword: 'Vira-lata', ink1: 'caramel brown', ink2: 'pool blue', bgShape: 'circle', hex1: '#a5672b', hex2: '#3aa7d6' },
};

export const KEYWORD_INFO: Record<string, { name: string; text: string }> = {
  provocar: { name: 'Provocar', text: 'Os inimigos precisam atacar esta carta primeiro.' },
  pressa: { name: 'Pressa', text: 'Pode atacar no turno em que entra.' },
  capacete: { name: 'Capacete', text: 'Ignora o primeiro dano que levaria.' },
  grau: { name: 'Grau', text: 'Neste turno, ignora Provocar ao atacar.' },
  escondido: { name: 'Escondido', text: 'Não pode ser atacado.' },
};
