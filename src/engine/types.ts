// Tipos do motor de regras (sistema de turnos no estilo Hearthstone). Nada aqui depende de React.

export type Family = 'familia' | 'folclore' | 'lendas' | 'escola' | 'rua' | 'cozinha' | 'varzea' | 'bichos';
export type CardType = 'pessoa' | 'objeto' | 'veiculo' | 'bicho' | 'assombracao' | 'feitico';
export type CardKind = 'minion' | 'spell';
export type Rarity = 'comum' | 'brilhante' | 'holografica' | 'carimbada';
export type Side = 0 | 1;

/**
 * Palavras-chave:
 * - provocar: inimigos precisam atacar esta carta antes do herói e das outras.
 * - pressa: pode atacar no turno em que entra.
 * - capacete: o primeiro dano que levaria é ignorado (e o capacete cai).
 * - grau: neste turno ignora Provocar ao atacar.
 * - escondido: não pode ser alvo de ataques.
 */
export type Keyword = 'provocar' | 'pressa' | 'capacete' | 'grau' | 'escondido';

export type Trigger =
  | 'chegada' // ao ser jogada da mão (Grito de Guerra)
  | 'onAllyEnter' // outra carta entrou do meu lado
  | 'onTurnStart' // início do turno do dono
  | 'onTurnEnd' // fim do turno do dono
  | 'despedida' // ao morrer (Último Suspiro)
  | 'static' // aura contínua, recalculada sempre
  | 'onEnemyTurnEnd' // fim do turno do oponente
  | 'inHand' // reage enquanto está na mão (Boato da Loira)
  | 'spell'; // efeito do feitiço / poder do herói

export type Condition =
  | { kind: 'allyHasTag'; tag: string }
  | { kind: 'enteringHasTag'; tag: string }
  | { kind: 'isNight' }
  | { kind: 'isDay' }
  | { kind: 'countTag'; tag: string; min: number; side: 'ally' | 'enemy' | 'both' }
  | { kind: 'turnsInPlay'; eq: number }
  | { kind: 'opponentPlayedThisTurn'; min: number }
  | { kind: 'opponentSpentAllMerenda' }
  | { kind: 'hasBoardSpace' };

/** Quem pode ser escolhido como alvo quando a carta/poder pede alvo. */
export type TargetSpec = {
  kind: 'anyCharacter' | 'anyMinion' | 'enemyMinion' | 'allyMinion' | 'enemyCharacter' | 'allyCharacter';
  maxCost?: number;
};

export type Target =
  | 'self'
  | 'neighbors' // minhas vizinhas na mesa
  | 'chosen' // o alvo escolhido pelo jogador
  | 'randomEnemy' // carta inimiga ou o herói inimigo
  | 'randomEnemyMinion'
  | 'allEnemyMinions'
  | 'allOtherMinions' // todas as cartas da mesa menos esta
  | 'allyHero'
  | 'enemyHero'
  | { tag: string; side: 'ally' | 'enemy' | 'both'; neighbors?: boolean };

export type Duration = 'turn' | 'permanent';

export type Action =
  | { kind: 'damage'; amount: number; target: Target }
  | { kind: 'heal'; amount: number; target: Target }
  | { kind: 'buff'; power?: number; toughness?: number; target: Target; duration: Duration }
  | { kind: 'giveKeyword'; keyword: Keyword; target: Target; duration: Duration }
  | { kind: 'suspend'; target: Target; maxCost?: number } // Diretoria: sai da mesa e volta depois
  | { kind: 'returnToHand'; target: Target; maxCost?: number }
  | { kind: 'silence'; target: Target }
  | { kind: 'destroy'; target: Target }
  | { kind: 'summon'; cardId: string; count: number }
  | { kind: 'draw'; count: number }
  | { kind: 'gainMerenda'; amount: number; when: 'now' | 'nextTurn' }
  | { kind: 'peekHand' }
  | { kind: 'repeatChegada' }
  | { kind: 'enterFree' };

export interface Effect {
  trigger: Trigger;
  /** Nome do efeito exibido no log (ex.: "Chinelo Teleguiado"). */
  name?: string;
  conditions?: Condition[];
  actions: Action[];
  /** Repete o efeito uma vez para cada outra carta aliada com a tag (Craque da Várzea). */
  repeatPer?: { tag: string };
}

export interface ArtSpec {
  character: string;
  action: string;
}

export interface CardDef {
  id: string;
  name: string;
  kind: CardKind;
  family: Family;
  type: CardType;
  tags: string[];
  cost: number; // Merenda
  power: number; // Força (0 em feitiços)
  toughness: number; // Resistência (0 em feitiços)
  keywords: Keyword[];
  text: string;
  flavor: string;
  effects: Effect[];
  /** Alvo que o jogador escolhe ao jogar (Chegada ou feitiço com 'chosen'). */
  target?: TargetSpec;
  /** Coringa: conta como qualquer tag de parente. */
  wildcard?: boolean;
  /** Nunca vai para a Diretoria. */
  immuneToSuspend?: boolean;
  /** Fichas (criadas por efeitos) não entram em pacotinho nem em deck. */
  collectible?: boolean;
  art: ArtSpec;
}

export interface HeroPower {
  name: string;
  text: string;
  cost: number;
  target?: TargetSpec;
  effects: Effect[];
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  family: Family;
  power: HeroPower;
  art: ArtSpec;
}

export interface Stats2 {
  power: number;
  toughness: number;
}

/** Uma cópia de carta dentro da partida (mão, deck, lixo). */
export interface CardRef {
  uid: string;
  defId: string;
}

export interface Minion extends CardRef {
  damage: number;
  buffs: Stats2;
  turnBuffs: Stats2;
  keywords: Keyword[];
  turnKeywords: Keyword[];
  silenced: boolean;
  /** Capacete ainda está de pé. */
  shield: boolean;
  attacksLeft: number;
  /** Turno (global) em que entrou na mesa. */
  enteredTurn: number;
}

export interface Hero {
  heroId: string;
  hp: number;
  maxHp: number;
  powerUsed: boolean;
}

export interface Suspended {
  minion: Minion;
  /** Volta no fim deste turno (global). */
  returnTurn: number;
}

export interface PlayerState {
  hero: Hero;
  merenda: number;
  maxMerenda: number;
  /** Merenda extra no próximo turno (Pombo). */
  bonusMerenda: number;
  deck: CardRef[];
  hand: CardRef[];
  board: Minion[];
  diretoria: Suspended[];
  discard: CardRef[];
  /** Dano da próxima compra com o deck vazio. */
  fatigue: number;
  /** Cartas jogadas neste turno. */
  playedThisTurn: number;
  /** Carta da mão do oponente espiada neste turno (Vendedor de Pamonha). */
  peek: string | null;
}

export type Winner = Side | 'draw' | null;

export interface GameState {
  seed: number;
  /** Turno global: 1, 2, 3... O jogador 0 joga nos ímpares. */
  turn: number;
  active: Side;
  players: [PlayerState, PlayerState];
  winner: Winner;
  nextUid: number;
  /** Contador de ações, para derivar o RNG de cada uma. */
  actionCount: number;
}

/** Um personagem: carta na mesa ou herói. */
export type CharRef = { kind: 'minion'; uid: string } | { kind: 'hero'; side: Side };

export type GameAction =
  | { type: 'play'; uid: string; position?: number; target?: CharRef }
  | { type: 'attack'; attacker: string; target: CharRef }
  | { type: 'power'; target?: CharRef }
  | { type: 'end' };

export type LogEvent =
  | { type: 'turn'; side: Side; turn: number; night: boolean; text: string }
  | { type: 'draw'; side: Side; text: string }
  | { type: 'play'; side: Side; defId: string; text: string }
  | { type: 'summon'; side: Side; uid: string; defId: string; text: string }
  | { type: 'effect'; side: Side; name: string; text: string }
  | { type: 'attack'; side: Side; from: CharRef; to: CharRef; text: string }
  | { type: 'damage'; to: CharRef; amount: number; text: string }
  | { type: 'heal'; to: CharRef; amount: number; text: string }
  | { type: 'shield'; to: CharRef; text: string }
  | { type: 'buff'; to: CharRef; text: string }
  | { type: 'death'; side: Side; uid: string; defId: string; text: string }
  | { type: 'move'; side: Side; text: string }
  | { type: 'merenda'; side: Side; text: string }
  | { type: 'peek'; side: Side; text: string }
  | { type: 'fatigue'; side: Side; amount: number; text: string }
  | { type: 'end'; winner: Winner; text: string };

export const BOARD_SIZE = 7;
export const HAND_LIMIT = 10;
export const HERO_HP = 30;
export const MAX_MERENDA = 10;
export const HERO_POWER_COST = 2;
export const MAX_TURNS = 90;
