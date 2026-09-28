import { create } from 'zustand';
import {
  applyAction,
  attackTargets,
  botAction,
  canAttack,
  canPlay,
  canUsePower,
  getCard,
  getHero,
  needsTarget,
  startGame,
  STARTER_DECKS,
  validTargets,
} from '../../engine';
import type { CharRef, GameAction, GameState, LogEvent } from '../../engine';

export const TURN_SECONDS = 75;
/** Pausa entre as ações do bot, para dar para acompanhar. */
export const BOT_STEP_MS = 850;

/** O que o jogador está fazendo agora. */
export type Mode =
  | { kind: 'idle' }
  | { kind: 'place'; uid: string } // escolhendo onde colocar a carta
  | { kind: 'target'; action: 'play'; uid: string; position?: number; targets: CharRef[] }
  | { kind: 'target'; action: 'attack'; uid: string; targets: CharRef[] }
  | { kind: 'target'; action: 'power'; targets: CharRef[] };

interface BattleStore {
  state: GameState | null;
  history: LogEvent[];
  /** Eventos da última ação, para animar (dano flutuando etc.). */
  lastEvents: LogEvent[];
  eventKey: number;
  mode: Mode;
  botThinking: boolean;
  deckIndex: number;
  error: string | null;

  start: (deckIndex: number) => void;
  quit: () => void;
  cancel: () => void;
  clickHand: (uid: string) => void;
  placeAt: (position: number) => void;
  clickMinion: (uid: string) => void;
  clickHero: (side: 0 | 1) => void;
  clickPower: () => void;
  endTurn: () => void;
}

let botTimer: ReturnType<typeof setTimeout> | null = null;

const sameRef = (a: CharRef, b: CharRef) =>
  a.kind === b.kind && (a.kind === 'hero' ? a.side === (b as typeof a).side : a.uid === (b as typeof a).uid);

export const useBattle = create<BattleStore>((set, get) => {
  const run = (action: GameAction) => {
    const { state, history, eventKey } = get();
    if (!state) return;
    try {
      const r = applyAction(state, action);
      set({ state: r.state, history: [...history, ...r.log], lastEvents: r.log, eventKey: eventKey + 1, mode: { kind: 'idle' }, error: null });
      if (r.state.winner === null && r.state.active === 1) scheduleBot();
    } catch (e) {
      set({ error: (e as Error).message, mode: { kind: 'idle' } });
    }
  };

  const scheduleBot = () => {
    if (botTimer) clearTimeout(botTimer);
    set({ botThinking: true });
    botTimer = setTimeout(() => {
      const { state } = get();
      if (!state || state.winner !== null || state.active !== 1) return set({ botThinking: false });
      run(botAction(state));
      if (get().state?.active === 0) set({ botThinking: false });
    }, BOT_STEP_MS);
  };

  const myTurn = () => {
    const s = get().state;
    return !!s && s.active === 0 && s.winner === null;
  };

  const choose = (ref: CharRef) => {
    const { mode } = get();
    if (mode.kind !== 'target') return false;
    if (!mode.targets.some((t) => sameRef(t, ref))) {
      set({ error: 'Esse alvo não vale. Escolha um dos destacados.' });
      return true;
    }
    if (mode.action === 'play') run({ type: 'play', uid: mode.uid, position: mode.position, target: ref });
    else if (mode.action === 'attack') run({ type: 'attack', attacker: mode.uid, target: ref });
    else run({ type: 'power', target: ref });
    return true;
  };

  /** Depois de escolher a posição (ou para feitiços): pede alvo se precisar, senão joga. */
  const playCard = (uid: string, position?: number) => {
    const state = get().state!;
    const def = getCard(state.players[0].hand.find((c) => c.uid === uid)!.defId);
    if (needsTarget(state, 0, def)) {
      set({ mode: { kind: 'target', action: 'play', uid, position, targets: validTargets(state, 0, def.target!) }, error: null });
    } else {
      run({ type: 'play', uid, position });
    }
  };

  return {
    state: null,
    history: [],
    lastEvents: [],
    eventKey: 0,
    mode: { kind: 'idle' },
    botThinking: false,
    deckIndex: 0,
    error: null,

    start: (deckIndex) => {
      if (botTimer) clearTimeout(botTimer);
      const mine = STARTER_DECKS[deckIndex];
      const bot = STARTER_DECKS[deckIndex === 0 ? 1 : 0];
      const seed = Math.floor(Math.random() * 2 ** 31);
      // Por enquanto você sempre começa; o bot joga em segundo e ganha o Troco.
      const { state, log } = startGame(mine.cards, bot.cards, mine.hero, bot.hero, seed);
      set({ state, history: log, lastEvents: log, eventKey: 0, mode: { kind: 'idle' }, botThinking: false, deckIndex, error: null });
    },

    quit: () => {
      if (botTimer) clearTimeout(botTimer);
      set({ state: null, history: [], lastEvents: [], mode: { kind: 'idle' }, botThinking: false });
    },

    cancel: () => set({ mode: { kind: 'idle' }, error: null }),

    clickHand: (uid) => {
      if (!myTurn()) return;
      const { state, mode } = get();
      if ((mode.kind === 'place' || (mode.kind === 'target' && mode.action === 'play')) && mode.uid === uid)
        return set({ mode: { kind: 'idle' } });
      const err = canPlay(state!, uid);
      if (err) return set({ error: err, mode: { kind: 'idle' } });
      const def = getCard(state!.players[0].hand.find((c) => c.uid === uid)!.defId);
      if (def.kind === 'minion') {
        // Mesa vazia: não tem o que escolher.
        if (state!.players[0].board.length === 0) return playCard(uid, 0);
        return set({ mode: { kind: 'place', uid }, error: null });
      }
      playCard(uid);
    },

    placeAt: (position) => {
      const { mode } = get();
      if (mode.kind !== 'place') return;
      playCard(mode.uid, position);
    },

    clickMinion: (uid) => {
      if (!myTurn()) return;
      if (choose({ kind: 'minion', uid })) return;
      const state = get().state!;
      const mine = state.players[0].board.some((m) => m.uid === uid);
      if (!mine) return set({ error: 'Escolha uma carta sua para atacar.' });
      if (!canAttack(state, uid)) return set({ error: 'Essa carta não pode atacar agora (acabou de entrar ou já atacou).' });
      set({ mode: { kind: 'target', action: 'attack', uid, targets: attackTargets(state, uid) }, error: null });
    },

    clickHero: (side) => {
      if (!myTurn()) return;
      choose({ kind: 'hero', side });
    },

    clickPower: () => {
      if (!myTurn()) return;
      const state = get().state!;
      const err = canUsePower(state);
      if (err) return set({ error: err });
      const power = getHero(state.players[0].hero.heroId).power;
      if (power.target) set({ mode: { kind: 'target', action: 'power', targets: validTargets(state, 0, power.target) }, error: null });
      else run({ type: 'power' });
    },

    endTurn: () => {
      if (!myTurn()) return;
      run({ type: 'end' });
    },
  };
});
