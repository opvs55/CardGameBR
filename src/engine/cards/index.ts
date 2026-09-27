import type { CardDef, Family } from '../types';

// As 20 cartas iniciais (seção 7 do design). Todo número aqui é o primeiro
// balanceamento: ajuste nos dados, nunca no motor.

export const CARDS: CardDef[] = [
  {
    id: 'filtro-de-barro',
    name: 'Filtro de Barro',
    family: 'cozinha',
    type: 'objeto',
    tags: [],
    cost: 2,
    power: 0,
    toughness: 4,
    speed: 1,
    text: 'Fim da rodada: cura 1 nas vizinhas. Com Vó na fileira: Tapetinho de Crochê, cura 2 e +2 Resistência.',
    flavor: 'Água de filtro de barro é outro nível. Todo mundo sabe.',
    effects: [
      { trigger: 'onRoundEnd', name: 'Água fresquinha', actions: [{ kind: 'heal', amount: 1, target: 'neighbors' }] },
      {
        trigger: 'onRoundEnd',
        name: 'Tapetinho de Crochê',
        conditions: [{ kind: 'allyHasTag', tag: 'vo' }],
        actions: [{ kind: 'heal', amount: 1, target: 'neighbors' }],
      },
      {
        trigger: 'static',
        conditions: [{ kind: 'allyHasTag', tag: 'vo' }],
        actions: [{ kind: 'buff', toughness: 2, target: 'self', duration: 'round' }],
      },
    ],
    art: {
      character: 'a chubby clay water filter with little arms and legs, a tiny tin cup hanging from its tap',
      action: 'proudly pouring water into a cup, chest puffed out, water drops sparkling, very satisfied smile',
    },
  },
  {
    id: 'vo',
    name: 'Vó',
    family: 'familia',
    type: 'pessoa',
    tags: ['vo', 'parente'],
    cost: 3,
    power: 1,
    toughness: 5,
    speed: 2,
    text: 'Parentesco: ao entrar, parentes vizinhos ganham +1/+1 nesta rodada.',
    flavor: 'Tá magrinho. Come mais um pouquinho.',
    effects: [
      {
        trigger: 'onEnter',
        name: 'Parentesco',
        actions: [
          {
            kind: 'buff',
            power: 1,
            toughness: 1,
            target: { tag: 'parente', side: 'ally', scope: 'neighbors' },
            duration: 'round',
          },
        ],
      },
    ],
    art: {
      character:
        'a tiny grandmother with round glasses, hair bun, floral dress and slippers, holding a crochet doily and knitting needles',
      action: 'offering a plate of food with a stern loving look that says you will eat all of it',
    },
  },
  {
    id: 'mae',
    name: 'Mãe',
    family: 'familia',
    type: 'pessoa',
    tags: ['mae', 'parente'],
    cost: 4,
    power: 3,
    toughness: 5,
    speed: 4,
    text: 'Quando um Filho entra na sua fileira: Chinelo Teleguiado, 3 de dano em inimigo aleatório. Ao entrar com 2+ jogadores de várzea na mesa: "Pra dentro, agora!", todos eles voltam para a mão.',
    flavor: 'Vou contar até três...',
    effects: [
      {
        trigger: 'onAllyEnter',
        name: 'Chinelo Teleguiado',
        conditions: [{ kind: 'enteringHasTag', tag: 'filho' }],
        actions: [{ kind: 'damage', amount: 3, target: 'randomEnemy' }],
      },
      {
        trigger: 'onEnter',
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
  },
  {
    id: 'filho',
    name: 'Filho',
    family: 'familia',
    type: 'pessoa',
    tags: ['filho', 'parente'],
    cost: 1,
    power: 1,
    toughness: 2,
    speed: 3,
    text: 'Faz a Mãe jogar o chinelo.',
    flavor: 'Mãe, cadê meu tênis? Mãe? MÃE?',
    effects: [],
    art: {
      character: 'a skinny kid with messy hair, untied sneakers and a school backpack twice his size',
      action: 'running in with a guilty grin after breaking something off-screen, one sneaker flying off',
    },
  },
  {
    id: 'tio-do-pave',
    name: 'Tio do Pavê',
    family: 'familia',
    type: 'pessoa',
    tags: ['parente'],
    cost: 3,
    power: 2,
    toughness: 3,
    speed: 2,
    text: 'Com Sobremesa na fileira: "É pavê ou pra comer?" Inimigos à frente e vizinhos da frente perdem 1 Força.',
    flavor: 'Conta essa piada desde 1987. Ri sozinho desde 1987.',
    effects: [
      {
        trigger: 'static',
        name: 'É pavê ou pra comer?',
        conditions: [{ kind: 'allyHasTag', tag: 'sobremesa' }],
        actions: [{ kind: 'buff', power: -1, target: 'enemyNeighborsOfSelf', duration: 'round' }],
      },
    ],
    art: {
      character: 'a mustached uncle in a loud printed shirt holding a big glass dish of layered dessert',
      action: 'pointing at the dessert and laughing at his own joke while the dessert itself rolls its eyes',
    },
  },
  {
    id: 'pudim',
    name: 'Pudim',
    family: 'cozinha',
    type: 'objeto',
    tags: ['sobremesa'],
    cost: 1,
    power: 0,
    toughness: 3,
    speed: 1,
    text: 'Fim da rodada: cura 1 em si mesmo.',
    flavor: 'Com furinho no meio, do jeito certo.',
    effects: [{ trigger: 'onRoundEnd', name: 'Calda', actions: [{ kind: 'heal', amount: 1, target: 'self' }] }],
    art: {
      character: 'a wobbly caramel flan with a hole in the middle, shiny syrup dripping down its sides, tiny legs',
      action: 'jiggling happily and waving, a drop of syrup landing on its own foot',
    },
  },
  {
    id: 'mandrake',
    name: 'Mandrake',
    family: 'rua',
    type: 'pessoa',
    tags: [],
    cost: 3,
    power: 2,
    toughness: 3,
    speed: 5,
    text: 'Ao entrar, se houver Moto na fileira: Grau! A Moto ganha +3 Pressa e ataca a Moral direto nesta rodada.',
    flavor: 'Grau é arte. Capacete é lei.',
    effects: [
      {
        trigger: 'onEnter',
        name: 'Grau',
        conditions: [{ kind: 'allyHasTag', tag: 'moto' }],
        actions: [
          { kind: 'buff', speed: 3, target: { tag: 'moto', side: 'ally' }, duration: 'round' },
          { kind: 'directAttack', target: { tag: 'moto', side: 'ally' } },
        ],
      },
    ],
    art: {
      character:
        'a stylish young guy with a flat-brim cap, sunglasses, chain necklace and a full-face helmet under his arm',
      action: 'posing confidently with two fingers up, one eyebrow raised, a small scooter behind him',
    },
  },
  {
    id: 'moto',
    name: 'Moto',
    family: 'rua',
    type: 'veiculo',
    tags: ['moto'],
    cost: 2,
    power: 2,
    toughness: 2,
    speed: 3,
    text: 'Empina com o Mandrake.',
    flavor: 'Tanque cheio, farol aceso, sorriso no para-choque.',
    effects: [],
    art: {
      character: 'a small street scooter with a face on its headlight',
      action: 'doing a wheelie, front wheel high in the air, headlight eyes wide with joy, motion lines behind',
    },
  },
  {
    id: 'vendedor-de-pamonha',
    name: 'Vendedor de Pamonha',
    family: 'rua',
    type: 'pessoa',
    tags: [],
    cost: 2,
    power: 1,
    toughness: 3,
    speed: 6,
    text: 'Carro de som: no início de cada rodada, espia 1 carta da mão do oponente.',
    flavor: 'Olha a pamonha! Pamonha fresquinha! É o puro creme do milho!',
    effects: [{ trigger: 'onRoundStart', name: 'Carro de som', actions: [{ kind: 'peekHand' }] }],
    art: {
      character:
        'a cheerful street vendor next to an old car with a giant loudspeaker on the roof, holding corn husk bundles',
      action: 'shouting into the loudspeaker so loud that sound waves shake the whole scene, birds flying away',
    },
  },
  {
    id: 'saci',
    name: 'Saci',
    family: 'folclore',
    type: 'assombracao',
    tags: [],
    cost: 3,
    power: 2,
    toughness: 3,
    speed: 5,
    text: 'À Noite: Redemoinho, troca de lugar duas cartas inimigas antes da briga.',
    flavor: 'Não levou nada. Só bagunçou tudo.',
    effects: [
      {
        trigger: 'beforeFight',
        name: 'Redemoinho',
        conditions: [{ kind: 'isNight' }],
        actions: [{ kind: 'swapEnemies', count: 2 }],
      },
    ],
    art: {
      character: 'a one-legged mischievous boy with a red pointed cap and a small pipe, from Brazilian folklore',
      action: 'spinning inside a little whirlwind with a playful grin, leaves swirling around him',
    },
  },
  {
    id: 'curupira',
    name: 'Curupira',
    family: 'folclore',
    type: 'assombracao',
    tags: [],
    cost: 4,
    power: 3,
    toughness: 4,
    speed: 3,
    text: 'À Noite: suas cartas brigam com a carteira diagonal (i+1). A da ponta bate direto na Moral.',
    flavor: 'Pode seguir as pegadas. Boa sorte.',
    effects: [
      {
        trigger: 'beforeFight',
        name: 'Pés virados',
        conditions: [{ kind: 'isNight' }],
        actions: [{ kind: 'diagonalFight' }],
      },
    ],
    art: {
      character: 'a forest guardian boy with flaming orange hair and feet turned backwards',
      action: 'walking away while his footprints point the other way, winking at the viewer',
    },
  },
  {
    id: 'loira-do-banheiro',
    name: 'Loira do Banheiro',
    family: 'lendas',
    type: 'assombracao',
    tags: [],
    cost: 4,
    power: 4,
    toughness: 3,
    speed: 2,
    text: 'Boato: se o oponente revelar 2 cartas e usar Tapa na mesma rodada, ela sai da sua mão e entra de graça numa carteira vazia.',
    flavor: 'Buuu! ...Ninguém? Tá bom, então.',
    effects: [
      {
        trigger: 'inHandOnReveal',
        name: 'Boato',
        conditions: [{ kind: 'opponentPlayedAndTapped', plays: 2 }, { kind: 'hasEmptySlot' }],
        actions: [{ kind: 'enterFree' }],
      },
    ],
    art: {
      character:
        'a spooky but silly ghost girl with long pale hair and cotton in her nose, peeking out of a school bathroom stall',
      action: 'saying boo, then looking embarrassed because nobody got scared',
    },
  },
  {
    id: 'homem-do-saco',
    name: 'Homem do Saco',
    family: 'lendas',
    type: 'assombracao',
    tags: ['homem-saco'],
    cost: 3,
    power: 3,
    toughness: 4,
    speed: 2,
    text: 'Com Mãe na fileira: "Olha que ele vem te pegar." Seus Filhos ganham +2 Resistência e o Homem do Saco não briga.',
    flavor: 'No saco só tem uma meia e uma borracha.',
    effects: [
      {
        trigger: 'static',
        name: 'Olha que ele vem te pegar',
        conditions: [{ kind: 'allyHasTag', tag: 'mae' }],
        actions: [{ kind: 'buff', toughness: 2, target: { tag: 'filho', side: 'ally' }, duration: 'round' }],
      },
      {
        trigger: 'beforeFight',
        name: 'Olha que ele vem te pegar',
        conditions: [{ kind: 'allyHasTag', tag: 'mae' }],
        actions: [{ kind: 'noFight', target: 'self' }],
      },
    ],
    art: {
      character: 'a tall lanky figure in a long coat carrying a big empty burlap sack',
      action: 'tiptoeing dramatically but the sack only contains a single sock and a lost school eraser',
    },
  },
  {
    id: 'merendeira',
    name: 'Merendeira',
    family: 'escola',
    type: 'pessoa',
    tags: ['cantina'],
    cost: 2,
    power: 1,
    toughness: 4,
    speed: 2,
    text: 'Ao entrar, com Tia da Cantina na fileira: Repeteco, repete 1 efeito de entrada da sua fileira.',
    flavor: 'Hoje tem repeteco!',
    effects: [
      {
        trigger: 'onEnter',
        name: 'Repeteco',
        conditions: [{ kind: 'allyHasTag', tag: 'cantina' }],
        actions: [{ kind: 'repeatEnterEffect' }],
      },
    ],
    art: {
      character: 'a school lunch lady with hairnet and apron holding a giant ladle and a steaming pot',
      action: 'serving an impossibly tall pile of rice and beans with pride',
    },
  },
  {
    id: 'tia-da-cantina',
    name: 'Tia da Cantina',
    family: 'escola',
    type: 'pessoa',
    tags: ['cantina'],
    cost: 2,
    power: 1,
    toughness: 3,
    speed: 2,
    text: 'Ativa o Repeteco da Merendeira.',
    flavor: 'Fiado só amanhã.',
    effects: [],
    art: {
      character: 'a friendly school snack bar lady behind a small counter full of snacks, pencil behind her ear',
      action: 'handing a warm cheese bread to a tiny hand reaching up, while writing on a notebook with the other hand',
    },
  },
  {
    id: 'inspetor',
    name: 'Inspetor',
    family: 'escola',
    type: 'pessoa',
    tags: [],
    cost: 3,
    power: 2,
    toughness: 3,
    speed: 3,
    text: 'De Dia, ao entrar: manda uma carta inimiga de custo 3 ou menos para a Diretoria.',
    flavor: 'Pra diretoria. Agora.',
    effects: [
      {
        trigger: 'onEnter',
        name: 'Pra diretoria!',
        conditions: [{ kind: 'isDay' }],
        actions: [{ kind: 'suspend', target: 'randomEnemy', maxCost: 3 }],
      },
    ],
    art: {
      character: 'a school hall monitor with a whistle, clipboard and suspicious squinting eyes',
      action: 'blowing the whistle so hard his cheeks balloon, pointing toward an office door',
    },
  },
  {
    id: 'panela-de-pressao',
    name: 'Panela de Pressão',
    family: 'cozinha',
    type: 'objeto',
    tags: [],
    cost: 2,
    power: 0,
    toughness: 5,
    speed: 0,
    text: 'Apita 3 rodadas. No fim da terceira explode: 4 de dano nas suas vizinhas e nas 3 inimigas da frente, e sai do jogo.',
    flavor: 'Pssss... PSSSSS... PSSSSSSSSSSS...',
    effects: [
      {
        trigger: 'onRoundEnd',
        name: 'Explodiu!',
        conditions: [{ kind: 'roundsInPlay', eq: 3 }],
        actions: [
          { kind: 'damage', amount: 4, target: 'blastZone' },
          { kind: 'destroy', target: 'self' },
        ],
      },
    ],
    art: {
      character: 'a pressure cooker with a face and a spinning valve on top',
      action: 'whistling steam furiously, trembling, eyes bulging, about to pop',
    },
  },
  {
    id: 'craque-da-varzea',
    name: 'Craque da Várzea',
    family: 'varzea',
    type: 'pessoa',
    tags: ['jogador'],
    cost: 2,
    power: 2,
    toughness: 2,
    speed: 3,
    text: 'Time: +1/+1 para cada outro jogador vizinho.',
    flavor: 'Joga de chinelo e ainda dá caneta.',
    effects: [
      {
        trigger: 'static',
        name: 'Time',
        repeatPer: { tag: 'jogador', scope: 'neighbors' },
        actions: [{ kind: 'buff', power: 1, toughness: 1, target: 'self', duration: 'round' }],
      },
    ],
    art: {
      character: 'an amateur soccer player in a mismatched jersey and shin guards, one sock down',
      action: 'juggling a ball on his knee on a dirt field, tongue out in concentration',
    },
  },
  {
    id: 'vira-lata-caramelo',
    name: 'Vira-lata Caramelo',
    family: 'bichos',
    type: 'bicho',
    tags: [],
    cost: 1,
    power: 1,
    toughness: 2,
    speed: 4,
    text: 'Conta como qualquer família e qualquer tag de parente para combos. Nunca vai para a Diretoria.',
    flavor: 'Patrimônio nacional. Sem raça definida, com amor de sobra.',
    wildcard: true,
    immuneToSuspend: true,
    effects: [],
    art: {
      character: 'a caramel-colored mixed-breed street dog with one floppy ear',
      action: 'sitting with a huge innocent smile and tongue out, wagging tail blurred with motion lines',
    },
  },
  {
    id: 'pombo',
    name: 'Pombo',
    family: 'bichos',
    type: 'bicho',
    tags: [],
    cost: 1,
    power: 1,
    toughness: 1,
    speed: 5,
    text: 'Se o oponente gastar toda a Merenda numa rodada: rouba 1 dele na próxima.',
    flavor: 'Anda como se fosse dono da praça. E é.',
    effects: [
      {
        trigger: 'onReveal',
        name: 'Pega o farelo',
        conditions: [{ kind: 'opponentSpentAllMerenda' }],
        actions: [{ kind: 'stealMerenda', amount: 1 }],
      },
    ],
    art: {
      character: 'a chunky city pigeon with puffed chest',
      action: 'strutting with overconfident attitude, a single bread crumb balanced on its head',
    },
  },
];

export const CARD_MAP: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export function getCard(id: string): CardDef {
  const card = CARD_MAP[id];
  if (!card) throw new Error(`Carta desconhecida: ${id}`);
  return card;
}

/** Tags que o Vira-lata Caramelo imita. */
export const PARENT_TAGS = ['parente', 'vo', 'mae', 'filho'];

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
