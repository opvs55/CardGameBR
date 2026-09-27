// Fases da rodada (Recreio). Tudo aqui é puro: recebe um estado, devolve outro.
//
//   startMatch(deckA, deckB, seed)             -> estado pronto para a rodada 1
//   resolveRound(state, moveA, moveB, seed?)   -> { state, log }  (Bafo! até o início da próxima rodada)

import { getCard } from './cards';
import type { Ctx, RevealMeta, Thunk } from './effects';
import { checkConditions, computeAuras, fireAll, planTrigger, sendToDiscard, statsAt } from './effects';
import { deriveSeed, mulberry32 } from './rng';
import type { Rng } from './rng';
import { allInPlay, cardName, createState, defOf, isNight, locate, newInPlay, other, ZERO } from './state';
import type { Located } from './state';
import type { GameState, InPlay, LogEvent, Move, Side, Winner } from './types';
import { MAX_PLAYS, MAX_ROUNDS, ROW_SIZE } from './types';

export interface RoundResult {
  state: GameState;
  log: LogEvent[];
}

const SIDES: Side[] = [0, 1];

export function startMatch(deckA: string[], deckB: string[], seed: number): RoundResult {
  const state = createState(deckA, deckB, seed);
  const log: LogEvent[] = [];
  const rng = mulberry32(deriveSeed(seed, 1));
  startRound(state, rng, log);
  return { state, log };
}

// ───────────────────────────── Validação da jogada ─────────────────────────────

/** Retorna o motivo se a jogada for inválida, ou null se estiver ok. */
export function validateMove(state: GameState, side: Side, move: Move): string | null {
  const p = state.players[side];
  if (move.plays.length > MAX_PLAYS) return `No máximo ${MAX_PLAYS} cartas por rodada.`;
  const slots = new Set<number>();
  const uids = new Set<string>();
  let cost = 0;
  for (const play of move.plays) {
    const card = p.hand.find((c) => c.uid === play.uid);
    if (!card) return 'Essa carta não está na sua mão.';
    if (uids.has(play.uid)) return 'Carta repetida na jogada.';
    if (play.slot < 0 || play.slot >= ROW_SIZE) return 'Carteira inválida.';
    if (p.row[play.slot] || slots.has(play.slot)) return 'Essa carteira está ocupada.';
    uids.add(play.uid);
    slots.add(play.slot);
    cost += getCard(card.defId).cost;
  }
  if (cost > p.merenda) return 'Merenda insuficiente.';
  if (move.tapSlot !== undefined) {
    if (p.tapas <= 0) return 'Acabaram os Tapas.';
    if (move.tapSlot < 0 || move.tapSlot >= ROW_SIZE) return 'Tapa em carteira inválida.';
  }
  return null;
}

/** Remove o que for inválido, na ordem, em vez de rejeitar a jogada toda. */
export function sanitizeMove(state: GameState, side: Side, move: Move): Move {
  const out: Move = { plays: [] };
  for (const play of move.plays) {
    const next = { plays: [...out.plays, play] };
    if (!validateMove(state, side, next)) out.plays = next.plays;
  }
  if (move.tapSlot !== undefined && !validateMove(state, side, { plays: [], tapSlot: move.tapSlot })) {
    out.tapSlot = move.tapSlot;
  }
  return out;
}

// ───────────────────────────── Rodada ─────────────────────────────

/** 1. Toca o sinal: volta da Diretoria, compra, Merenda, efeitos de início. */
function startRound(state: GameState, rng: Rng, log: LogEvent[]) {
  state.round += 1;
  const night = isNight(state.round);
  log.push({ type: 'round', round: state.round, night, text: `Rodada ${state.round} — ${night ? 'Noite' : 'Dia'}.` });

  for (const side of SIDES) {
    const p = state.players[side];
    p.peek = null;
    const back = p.diretoria.filter((s) => s.returnRound <= state.round);
    p.diretoria = p.diretoria.filter((s) => s.returnRound > state.round);
    for (const s of back) {
      if (!p.row[s.slot]) {
        p.row[s.slot] = s.card;
        log.push({ type: 'return', side, slot: s.slot, text: `${cardName(s.card)} voltou da Diretoria.` });
      } else {
        p.hand.push({ uid: s.card.uid, defId: s.card.defId });
        log.push({ type: 'return', side, slot: s.slot, text: `${cardName(s.card)} voltou da Diretoria para a mão (carteira ocupada).` });
      }
    }
    const drawn = p.deck.shift();
    if (drawn) {
      p.hand.push(drawn);
      log.push({ type: 'draw', side, text: 'Comprou 1 carta.' });
    }
  }

  const base = Math.min(state.round, 10);
  const merenda = SIDES.map((side) => base + state.players[side].bonusMerenda);
  for (const side of SIDES) {
    const stolen = Math.min(state.players[side].stolenMerenda, merenda[side]);
    merenda[side] -= stolen;
    merenda[other(side)] += stolen;
  }
  for (const side of SIDES) {
    const p = state.players[side];
    p.merenda = merenda[side];
    p.bonusMerenda = 0;
    p.stolenMerenda = 0;
  }

  const ctx: Ctx = { state, rng, log, meta: emptyMeta() };
  fireAll(ctx, 'onRoundStart');
}

function emptyMeta(): RevealMeta {
  return { played: [0, 0], tapped: [false, false], spentAll: [false, false] };
}

/**
 * Bafo! Revela as duas jogadas e resolve a rodada inteira; se ninguém venceu,
 * já começa a próxima (compra + Merenda), deixando o estado pronto para jogar.
 */
export function resolveRound(input: GameState, moveA: Move, moveB: Move, seed = input.seed): RoundResult {
  const state: GameState = structuredClone(input);
  const log: LogEvent[] = [];
  if (state.winner !== null) return { state, log };
  const rng = mulberry32(deriveSeed(seed, state.round * 7919 + 13));
  const moves = [sanitizeMove(state, 0, moveA), sanitizeMove(state, 1, moveB)];
  const meta = emptyMeta();
  const ctx: Ctx = { state, rng, log, meta };
  const entering: InPlay[] = [];

  // 3. Bafo! Revela tudo ao mesmo tempo.
  for (const side of SIDES) {
    const p = state.players[side];
    const move = moves[side];
    let spent = 0;
    for (const play of move.plays) {
      const idx = p.hand.findIndex((c) => c.uid === play.uid);
      const [ref] = p.hand.splice(idx, 1);
      const card = newInPlay(ref, state.round);
      p.row[play.slot] = card;
      entering.push(card);
      spent += getCard(ref.defId).cost;
      log.push({ type: 'reveal', side, slot: play.slot, defId: ref.defId, text: `${cardName(ref)} entra na carteira ${play.slot + 1}.` });
    }
    p.merenda -= spent;
    meta.played[side] = move.plays.length;
    meta.tapped[side] = move.tapSlot !== undefined;
    meta.spentAll[side] = spent > 0 && p.merenda === 0;
  }

  // Tapas primeiro.
  for (const side of SIDES) {
    const tap = moves[side].tapSlot;
    if (tap === undefined) continue;
    const opp = other(side);
    state.players[side].tapas -= 1;
    const target = state.players[opp].row[tap];
    if (target && target.enteredRound === state.round && entering.includes(target)) {
      target.flipped = true;
      log.push({ type: 'tapaHit', side: opp, slot: tap, text: `TAPA em ${cardName(target)}! Carta virada: sem efeitos e 1/1 nesta rodada.` });
    } else {
      state.players[opp].bonusMerenda += 1;
      log.push({ type: 'tapaMiss', side: opp, slot: tap, text: `Tapa no vazio! O outro lado ganha +1 Merenda na próxima rodada.` });
    }
  }

  // Cartas na mão que reagem à revelação (Boato da Loira do Banheiro).
  for (const side of SIDES) {
    const p = state.players[side];
    for (const ref of [...p.hand]) {
      for (const effect of getCard(ref.defId).effects) {
        if (effect.trigger !== 'inHandOnReveal' || !effect.actions.some((a) => a.kind === 'enterFree')) continue;
        const slot = p.row.findIndex((c) => c === null);
        if (slot < 0) continue;
        const fake: Located = { side, slot, card: newInPlay(ref, state.round) };
        if (!checkConditions(state, fake, effect.conditions, { meta })) continue;
        p.hand.splice(p.hand.findIndex((c) => c.uid === ref.uid), 1);
        p.row[slot] = fake.card;
        entering.push(fake.card);
        log.push({ type: 'effect', side, slot, name: effect.name ?? cardName(ref), text: `${cardName(ref)}: ${effect.name}! Entra de graça na carteira ${slot + 1}.` });
        break;
      }
    }
  }

  fireAll(ctx, 'onReveal');

  // 4. Efeitos de entrada, por Pressa decrescente.
  resolveEntries(ctx, entering.filter((c) => !c.flipped));
  cleanup(state, log);

  // 5. Briga.
  fireAll(ctx, 'beforeFight');
  fight(state, log);

  // 6. Bate o sinal.
  fireAll(ctx, 'onRoundEnd');
  cleanup(state, log);
  state.winner = checkWinner(state);

  for (const { card } of allInPlay(state)) {
    card.roundBuffs = { ...ZERO };
    card.flipped = false;
    card.noFight = false;
    card.directAttack = false;
  }
  state.diagonal = [false, false];

  if (state.winner !== null) {
    log.push({ type: 'end', winner: state.winner, text: endText(state.winner) });
  } else {
    startRound(state, rng, log);
  }
  return { state, log };
}

function resolveEntries(ctx: Ctx, cards: InPlay[]) {
  const { state } = ctx;
  const auras = computeAuras(state);
  const speedOf = (c: InPlay) => {
    const l = locate(state, c.uid);
    return l ? (statsAt(state, l.side, l.slot, auras)?.speed ?? 0) : 0;
  };
  const withSpeed = cards
    .map((card) => ({ card, speed: speedOf(card), loc: locate(state, card.uid) as Located }))
    .filter((x) => x.loc);
  const speeds = [...new Set(withSpeed.map((x) => x.speed))].sort((a, b) => b - a);

  for (const speed of speeds) {
    const group = withSpeed.filter((x) => x.speed === speed);
    const bySide = SIDES.map((side) =>
      group.filter((x) => x.loc.side === side).sort((a, b) => a.loc.slot - b.loc.slot),
    );
    const n = Math.max(bySide[0].length, bySide[1].length);
    for (let k = 0; k < n; k++) {
      // Empate de Pressa entre lados: planeja os dois contra o mesmo estado e aplica juntos.
      const thunks: Thunk[] = [];
      for (const side of SIDES) {
        const entry = bySide[side][k];
        if (entry) thunks.push(...planEntry(ctx, entry.card));
      }
      thunks.forEach((t) => t());
    }
  }
}

function planEntry(ctx: Ctx, card: InPlay): Thunk[] {
  const src = locate(ctx.state, card.uid);
  if (!src || card.flipped) return [];
  const thunks = planTrigger(ctx, src, 'onEnter');
  for (const ally of ctx.state.players[src.side].row) {
    if (!ally || ally.uid === card.uid) continue;
    const allyLoc = locate(ctx.state, ally.uid);
    if (allyLoc) thunks.push(...planTrigger(ctx, allyLoc, 'onAllyEnter', card));
  }
  return thunks;
}

function fight(state: GameState, log: LogEvent[]) {
  const auras = computeAuras(state);
  const hits: { side: Side; slot: number; amount: number }[] = [];
  const moralHits: [number, number] = [0, 0];

  for (const side of SIDES) {
    const opp = other(side);
    state.players[side].row.forEach((card, slot) => {
      if (!card || card.noFight) return;
      const st = statsAt(state, side, slot, auras);
      if (!st || st.power <= 0) return;
      const name = cardName(card);
      const targetSlot = state.diagonal[side] ? slot + 1 : slot;
      const target = targetSlot < ROW_SIZE ? state.players[opp].row[targetSlot] : null;
      if (card.directAttack || !target) {
        moralHits[opp] += st.power;
        log.push({ type: 'fight', side, slot, targetSlot: null, amount: st.power, text: `${name} bate direto na Moral (-${st.power}).` });
      } else if (target.noFight) {
        log.push({ type: 'fight', side, slot, targetSlot, amount: 0, text: `${name} procura ${cardName(target)}, mas ele se escondeu.` });
      } else {
        hits.push({ side: opp, slot: targetSlot, amount: st.power });
        log.push({ type: 'fight', side, slot, targetSlot, amount: st.power, text: `${name} briga com ${cardName(target)} (-${st.power}).` });
      }
    });
  }

  // Tudo ao mesmo tempo.
  for (const h of hits) {
    const c = state.players[h.side].row[h.slot];
    if (c) c.damage += h.amount;
  }
  for (const side of SIDES) {
    if (moralHits[side] > 0) {
      state.players[side].moral -= moralHits[side];
      log.push({ type: 'moral', side, amount: moralHits[side], text: `Moral -${moralHits[side]} (fica ${state.players[side].moral}).` });
    }
  }
}

/** Cartas com Resistência ≤ 0 vão para o lixo. */
function cleanup(state: GameState, log: LogEvent[]) {
  const auras = computeAuras(state);
  const dead = allInPlay(state).filter((l) => (statsAt(state, l.side, l.slot, auras)?.health ?? 1) <= 0);
  for (const l of dead) {
    sendToDiscard(state, l.card.uid);
    log.push({ type: 'death', side: l.side, slot: l.slot, defId: l.card.defId, text: `${cardName(l.card)} foi pro lixo.` });
  }
}

function checkWinner(state: GameState): Winner {
  const [a, b] = state.players;
  const aOut = a.moral <= 0;
  const bOut = b.moral <= 0;
  if (aOut && bOut) return 'draw';
  if (aOut) return 1;
  if (bOut) return 0;
  const noCards = (p: typeof a) => p.deck.length === 0 && p.hand.length === 0 && p.row.every((c) => !c);
  if (state.round >= MAX_ROUNDS || (noCards(a) && noCards(b))) {
    if (a.moral === b.moral) return 'draw';
    return a.moral > b.moral ? 0 : 1;
  }
  return null;
}

function endText(w: Winner): string {
  if (w === 'draw') return 'Empate! Os dois zeraram a Moral.';
  return w === 0 ? 'Fim de jogo: lado A venceu!' : 'Fim de jogo: lado B venceu!';
}

export { defOf };
