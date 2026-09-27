// Tipos do motor de regras. Nada aqui depende de React.

export type Family = 'familia' | 'folclore' | 'lendas' | 'escola' | 'rua' | 'cozinha' | 'varzea' | 'bichos';
export type CardType = 'pessoa' | 'objeto' | 'veiculo' | 'bicho' | 'assombracao';
export type Rarity = 'comum' | 'brilhante' | 'holografica' | 'carimbada';
export type Side = 0 | 1;

export type Trigger =
  | 'onEnter' // entrou nesta rodada
  | 'onAllyEnter' // outra carta entrou do meu lado
  | 'onRoundStart'
  | 'onRoundEnd'
  | 'onReveal' // logo depois da revelação (na mesa)
  | 'inHandOnReveal' // logo depois da revelação, enquanto a carta está na mão
  | 'beforeFight'
  | 'static'; // aura contínua, recalculada sempre

export type Scope = 'row' | 'neighbors';

export type Condition =
  | { kind: 'allyHasTag'; tag: string; scope?: Scope }
  | { kind: 'enteringHasTag'; tag: string }
  | { kind: 'isNight' }
  | { kind: 'isDay' }
  | { kind: 'countFamily'; family: Family; min: number; scope: Scope }
  | { kind: 'countTag'; tag: string; min: number; side: 'ally' | 'enemy' | 'both' }
  | { kind: 'roundsInPlay'; eq: number }
  | { kind: 'opponentPlayedAndTapped'; plays: number }
  | { kind: 'opponentSpentAllMerenda' }
  | { kind: 'hasEmptySlot' };

export type Target =
  | 'self'
  | 'neighbors' // minhas vizinhas (i-1, i+1)
  | 'front' // carteira inimiga à frente
  | 'randomEnemy'
  | 'allEnemies'
  | 'enemyNeighborsOfSelf' // inimigas em i-1, i, i+1
  | 'blastZone' // minhas vizinhas + inimigas em i-1, i, i+1
  | { tag: string; side: 'ally' | 'enemy' | 'both'; scope?: Scope; maxCost?: number; random?: boolean };

export type Action =
  | { kind: 'damage'; amount: number; target: Target }
  | { kind: 'heal'; amount: number; target: Target }
  | {
      kind: 'buff';
      power?: number;
      toughness?: number;
      speed?: number;
      target: Target;
      duration: 'round' | 'permanent';
    }
  | { kind: 'directAttack'; target: Target } // ignora a carta da frente e bate na Moral
  | { kind: 'suspend'; target: Target; maxCost?: number } // Diretoria
  | { kind: 'swapEnemies'; count: 2 }
  | { kind: 'returnToHand'; target: Target }
  | { kind: 'peekHand' } // espia 1 carta da mão do oponente
  | { kind: 'repeatEnterEffect' }
  | { kind: 'stealMerenda'; amount: number }
  | { kind: 'noFight'; target: Target } // não briga nesta rodada
  | { kind: 'diagonalFight' } // minhas cartas brigam com a carteira i+1 nesta rodada
  | { kind: 'destroy'; target: Target }
  | { kind: 'enterFree' }; // (da mão) entra de graça numa carteira vazia

export interface Effect {
  trigger: Trigger;
  /** Nome do efeito exibido no log (ex.: "Chinelo Teleguiado"). */
  name?: string;
  conditions?: Condition[];
  actions: Action[];
  /** Repete o efeito uma vez para cada vizinha com a tag (Craque da Várzea). */
  repeatPer?: { tag: string; scope: Scope };
}

export interface ArtSpec {
  character: string;
  action: string;
}

export interface CardDef {
  id: string;
  name: string;
  family: Family;
  type: CardType;
  tags: string[];
  cost: number; // Merenda
  power: number; // Força
  toughness: number; // Resistência
  speed: number; // Pressa
  text: string;
  flavor: string;
  effects: Effect[];
  /** Coringa: conta como qualquer família e qualquer tag de parente. */
  wildcard?: boolean;
  /** Nunca vai para a Diretoria. */
  immuneToSuspend?: boolean;
  art: ArtSpec;
}

export interface Buffs {
  power: number;
  toughness: number;
  speed: number;
}

/** Uma cópia de carta dentro da partida. */
export interface CardRef {
  uid: string;
  defId: string;
}

export interface InPlay extends CardRef {
  damage: number;
  roundBuffs: Buffs;
  permBuffs: Buffs;
  enteredRound: number;
  /** Levou Tapa: perde efeitos e briga como 1/1 nesta rodada. */
  flipped: boolean;
  noFight: boolean;
  directAttack: boolean;
}

export interface Suspended {
  card: InPlay;
  slot: number;
  returnRound: number;
}

export interface PlayerState {
  moral: number;
  merenda: number;
  /** Merenda extra que entra no início da próxima rodada (Tapa errado do oponente, Pombo). */
  bonusMerenda: number;
  /** Merenda que será roubada no início da próxima rodada. */
  stolenMerenda: number;
  tapas: number;
  deck: CardRef[];
  hand: CardRef[];
  row: (InPlay | null)[];
  diretoria: Suspended[];
  discard: CardRef[];
  /** Carta da mão do oponente espiada nesta rodada (Vendedor de Pamonha). */
  peek: string | null;
}

export type Winner = Side | 'draw' | null;

export interface GameState {
  seed: number;
  round: number;
  players: [PlayerState, PlayerState];
  /** Lado que briga na diagonal nesta rodada (Curupira). */
  diagonal: [boolean, boolean];
  winner: Winner;
  nextUid: number;
}

export interface Play {
  uid: string;
  slot: number;
}

export interface Move {
  plays: Play[];
  tapSlot?: number;
}

export type LogEvent =
  | { type: 'round'; round: number; night: boolean; text: string }
  | { type: 'draw'; side: Side; text: string }
  | { type: 'reveal'; side: Side; slot: number; defId: string; text: string }
  | { type: 'tapaHit'; side: Side; slot: number; text: string }
  | { type: 'tapaMiss'; side: Side; slot: number; text: string }
  | { type: 'effect'; side: Side; slot: number; name: string; text: string }
  | { type: 'damage'; side: Side; slot: number; amount: number; text: string }
  | { type: 'heal'; side: Side; slot: number; amount: number; text: string }
  | { type: 'buff'; side: Side; slot: number; text: string }
  | { type: 'moral'; side: Side; amount: number; text: string }
  | { type: 'suspend'; side: Side; slot: number; text: string }
  | { type: 'return'; side: Side; slot: number; text: string }
  | { type: 'swap'; side: Side; a: number; b: number; text: string }
  | { type: 'fight'; side: Side; slot: number; targetSlot: number | null; amount: number; text: string }
  | { type: 'death'; side: Side; slot: number; defId: string; text: string }
  | { type: 'merenda'; side: Side; amount: number; text: string }
  | { type: 'peek'; side: Side; text: string }
  | { type: 'end'; winner: Winner; text: string };

export const ROW_SIZE = 5;
export const START_MORAL = 20;
export const START_HAND = 5;
export const START_TAPAS = 3;
export const MAX_PLAYS = 2;
export const MAX_ROUNDS = 40;
