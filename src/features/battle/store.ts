import { create } from 'zustand';
import {
  botMove,
  getCard,
  mulberry32,
  newInPlay,
  resolveRound,
  startMatch,
  STARTER_DECKS,
  validateMove,
} from '../../engine';
import type { GameState, LogEvent, Move, Play } from '../../engine';

export const TURN_SECONDS = 30;
/** Tempo da animação de revelação antes de mostrar o resultado. */
export const REVEAL_MS = 1100;
/** Intervalo entre as entradas do log tocando em sequência. */
export const LOG_STEP_MS = 260;

type Phase = 'choosing' | 'revealing' | 'resolving';

interface BattleStore {
  state: GameState | null;
  /** Estado mostrado durante a revelação (cartas das duas jogadas na mesa, antes dos efeitos). */
  revealState: GameState | null;
  phase: Phase;
  history: LogEvent[];
  lastLog: LogEvent[];
  /** Quantas entradas de `lastLog` já tocaram. */
  played: number;
  pending: Play[];
  tapSlot?: number;
  tapMode: boolean;
  selected: string | null;
  playerDeck: number;
  botDeck: number;
  seed: number;
  error: string | null;

  start: (playerDeck: number) => void;
  quit: () => void;
  select: (uid: string | null) => void;
  placeAt: (slot: number) => void;
  unplace: (slot: number) => void;
  setTapMode: (on: boolean) => void;
  tapAt: (slot: number) => void;
  confirm: () => void;
}

const botRng = mulberry32(Date.now() >>> 0);

export const merendaLeft = (s: GameState, pending: Play[]) =>
  s.players[0].merenda -
  pending.reduce((sum, p) => sum + getCard(s.players[0].hand.find((c) => c.uid === p.uid)!.defId).cost, 0);

function withPlays(state: GameState, moves: Move[]): GameState {
  const s = structuredClone(state);
  moves.forEach((move, side) => {
    const p = s.players[side];
    for (const play of move.plays) {
      const ref = p.hand.find((c) => c.uid === play.uid);
      if (ref && !p.row[play.slot]) {
        p.row[play.slot] = newInPlay(ref, s.round);
        p.hand = p.hand.filter((c) => c.uid !== play.uid);
      }
    }
  });
  return s;
}

export const useBattle = create<BattleStore>((set, get) => ({
  state: null,
  revealState: null,
  phase: 'choosing',
  history: [],
  lastLog: [],
  played: 0,
  pending: [],
  tapSlot: undefined,
  tapMode: false,
  selected: null,
  playerDeck: 0,
  botDeck: 1,
  seed: 0,
  error: null,

  start: (playerDeck) => {
    const botDeck = playerDeck === 0 ? 1 : 0;
    const seed = Math.floor(Math.random() * 2 ** 31);
    const { state, log } = startMatch(STARTER_DECKS[playerDeck].cards, STARTER_DECKS[botDeck].cards, seed);
    set({
      state,
      revealState: null,
      phase: 'choosing',
      history: log,
      lastLog: log,
      played: log.length,
      pending: [],
      tapSlot: undefined,
      tapMode: false,
      selected: null,
      playerDeck,
      botDeck,
      seed,
      error: null,
    });
  },

  quit: () => set({ state: null, revealState: null, history: [], lastLog: [], pending: [] }),

  select: (uid) => set({ selected: get().selected === uid ? null : uid, tapMode: false, error: null }),

  placeAt: (slot) => {
    const { state, selected, pending, phase } = get();
    if (!state || !selected || phase !== 'choosing') return;
    const next = [...pending.filter((p) => p.uid !== selected), { uid: selected, slot }];
    const error = validateMove(state, 0, { plays: next });
    if (error) return set({ error });
    set({ pending: next, selected: null, error: null });
  },

  unplace: (slot) => set({ pending: get().pending.filter((p) => p.slot !== slot), error: null }),

  setTapMode: (on) => set({ tapMode: on, selected: null, error: null }),

  tapAt: (slot) => {
    const { state, tapSlot } = get();
    if (!state) return;
    if (tapSlot === slot) return set({ tapSlot: undefined, tapMode: false });
    if (state.players[0].tapas <= 0) return set({ error: 'Acabaram os Tapas.' });
    set({ tapSlot: slot, tapMode: false, error: null });
  },

  confirm: () => {
    const { state, pending, tapSlot, phase, history } = get();
    if (!state || phase !== 'choosing' || state.winner !== null) return;
    const mine: Move = { plays: pending, tapSlot };
    const bot = botMove(state, 1, botRng);
    const result = resolveRound(state, mine, bot);
    set({
      phase: 'revealing',
      revealState: withPlays(state, [mine, bot]),
      pending: [],
      tapSlot: undefined,
      tapMode: false,
      selected: null,
      error: null,
    });
    setTimeout(() => {
      set({
        state: result.state,
        revealState: null,
        phase: 'resolving',
        lastLog: result.log,
        played: 0,
        history: [...history, ...result.log],
      });
      const step = () => {
        const { played, lastLog } = get();
        if (played >= lastLog.length) return set({ phase: 'choosing' });
        set({ played: played + 1 });
        setTimeout(step, LOG_STEP_MS);
      };
      step();
    }, REVEAL_MS);
  },
}));
