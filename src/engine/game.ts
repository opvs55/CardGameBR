// Fluxo da partida no sistema de turnos. Tudo aqui é puro: recebe um estado,
// devolve outro.
//
//   startGame(deckA, deckB, heroA, heroB, seed) -> estado no início do turno 1
//   applyAction(state, action)                 -> { state, log }
//
// Ações: jogar carta, atacar, usar o poder do herói, passar a vez. A mesma função
// roda no cliente (contra o bot) e no servidor (partida online).

import { getCard, getHero } from './cards';
import type { Ctx } from './effects';
import {
  addToHand,
  checkConditions,
  computeAuras,
  dealDamage,
  drawCard,
  fireAllyEnter,
  fireSide,
  minionStats,
  needsTarget,
  removeMinion,
  runEffect,
  summon,
  validTargets,
} from './effects';
import { deriveSeed, mulberry32 } from './rng';
import { allMinions, cardName, createState, findMinion, isNight, other, refName, roundOf, sameRef } from './state';
import type { CharRef, GameAction, GameState, LogEvent, Side, Winner } from './types';
import { BOARD_SIZE, MAX_MERENDA, MAX_TURNS } from './types';

export interface ActionResult {
  state: GameState;
  log: LogEvent[];
}

export function startGame(deckA: string[], deckB: string[], heroA: string, heroB: string, seed: number): ActionResult {
  const state = createState(deckA, deckB, heroA, heroB, seed);
  const log: LogEvent[] = [];
  const ctx: Ctx = { state, rng: mulberry32(deriveSeed(seed, 1)), log };
  startTurn(ctx);
  return { state, log };
}

// ───────────────────────────── Consultas para a UI e o bot ─────────────────────────────

export function canPlay(state: GameState, uid: string): string | null {
  const p = state.players[state.active];
  const ref = p.hand.find((c) => c.uid === uid);
  if (!ref) return 'Essa carta não está na sua mão.';
  const def = getCard(ref.defId);
  if (def.cost > p.merenda) return 'Merenda insuficiente.';
  if (def.kind === 'minion' && p.board.length >= BOARD_SIZE) return 'A mesa está cheia (7 cartas).';
  if (def.kind === 'spell' && def.target && validTargets(state, state.active, def.target).length === 0)
    return 'Não tem alvo para esse feitiço.';
  return null;
}

export function canAttack(state: GameState, uid: string): boolean {
  const l = findMinion(state, uid);
  if (!l || l.side !== state.active || l.minion.attacksLeft <= 0) return false;
  const st = minionStats(l.minion, computeAuras(state));
  if (st.power <= 0) return false;
  return l.minion.enteredTurn < state.turn || st.keywords.includes('pressa');
}

export function attackTargets(state: GameState, uid: string): CharRef[] {
  const l = findMinion(state, uid);
  if (!l) return [];
  const auras = computeAuras(state);
  const opp = other(l.side);
  const grau = minionStats(l.minion, auras).keywords.includes('grau');
  const enemies = state.players[opp].board
    .map((m) => ({ m, st: minionStats(m, auras) }))
    .filter(({ st }) => !st.keywords.includes('escondido'));
  const taunts = enemies.filter(({ st }) => st.keywords.includes('provocar'));
  if (taunts.length > 0 && !grau) return taunts.map(({ m }) => ({ kind: 'minion', uid: m.uid }));
  return [...enemies.map(({ m }) => ({ kind: 'minion' as const, uid: m.uid })), { kind: 'hero', side: opp }];
}

export function canUsePower(state: GameState): string | null {
  const p = state.players[state.active];
  const power = getHero(p.hero.heroId).power;
  if (p.hero.powerUsed) return 'O poder já foi usado neste turno.';
  if (p.merenda < power.cost) return 'Merenda insuficiente.';
  if (power.target && validTargets(state, state.active, power.target).length === 0) return 'Não tem alvo.';
  return null;
}

export function validateAction(state: GameState, action: GameAction): string | null {
  if (state.winner !== null) return 'A partida acabou.';
  const side = state.active;
  const includes = (list: CharRef[], t?: CharRef) => !!t && list.some((r) => sameRef(r, t));
  switch (action.type) {
    case 'end':
      return null;
    case 'play': {
      const err = canPlay(state, action.uid);
      if (err) return err;
      const def = getCard(state.players[side].hand.find((c) => c.uid === action.uid)!.defId);
      if (needsTarget(state, side, def) && !includes(validTargets(state, side, def.target!), action.target))
        return 'Escolha um alvo válido.';
      return null;
    }
    case 'attack':
      if (!canAttack(state, action.attacker)) return 'Essa carta não pode atacar agora.';
      if (!includes(attackTargets(state, action.attacker), action.target)) return 'Alvo inválido (tem Provocar?).';
      return null;
    case 'power': {
      const err = canUsePower(state);
      if (err) return err;
      const power = getHero(state.players[side].hero.heroId).power;
      if (power.target && !includes(validTargets(state, side, power.target), action.target)) return 'Escolha um alvo válido.';
      return null;
    }
  }
}

// ───────────────────────────── Ações ─────────────────────────────

export function applyAction(input: GameState, action: GameAction): ActionResult {
  const error = validateAction(input, action);
  if (error) throw new Error(error);
  const state: GameState = structuredClone(input);
  const log: LogEvent[] = [];
  state.actionCount += 1;
  const ctx: Ctx = { state, rng: mulberry32(deriveSeed(state.seed, state.actionCount + 1)), log };

  switch (action.type) {
    case 'play':
      play(ctx, action.uid, action.position, action.target);
      break;
    case 'attack':
      attack(ctx, action.attacker, action.target);
      break;
    case 'power':
      usePower(ctx, action.target);
      break;
    case 'end':
      endTurn(ctx);
      break;
  }
  finish(ctx);
  return { state, log };
}

function play(ctx: Ctx, uid: string, position: number | undefined, target: CharRef | undefined) {
  const { state, log } = ctx;
  const side = state.active;
  const p = state.players[side];
  const idx = p.hand.findIndex((c) => c.uid === uid);
  const [ref] = p.hand.splice(idx, 1);
  const def = getCard(ref.defId);
  const chosen = needsTarget(state, side, def) ? target : undefined;
  p.merenda -= def.cost;
  p.playedThisTurn += 1;
  log.push({ type: 'play', side, defId: def.id, text: `Jogou ${def.name}.` });

  if (def.kind === 'spell') {
    for (const effect of def.effects) {
      if (effect.trigger === 'spell') runEffect(ctx, { side, uid: null, name: def.name }, effect, { chosen });
    }
    p.discard.push(ref);
  } else {
    const m = summon(ctx, side, ref, position)!;
    const src = { side, uid: m.uid, name: def.name };
    for (const effect of def.effects) {
      if (effect.trigger === 'chegada' && findMinion(state, m.uid)) runEffect(ctx, src, effect, { chosen });
    }
    fireAllyEnter(ctx, m);
  }
  resolveDeaths(ctx);
  rumors(ctx);
}

/** Boato: cartas na mão do oponente que reagem ao que o jogador da vez faz (Loira do Banheiro). */
function rumors(ctx: Ctx) {
  const { state, log } = ctx;
  const side = other(state.active);
  const p = state.players[side];
  for (const ref of [...p.hand]) {
    const def = getCard(ref.defId);
    for (const effect of def.effects) {
      if (effect.trigger !== 'inHand' || !effect.actions.some((a) => a.kind === 'enterFree')) continue;
      if (!checkConditions(state, { side, uid: null, name: def.name }, effect.conditions)) continue;
      p.hand.splice(p.hand.findIndex((c) => c.uid === ref.uid), 1);
      log.push({ type: 'effect', side, name: effect.name ?? def.name, text: `${def.name}: ${effect.name}! Entra de graça.` });
      const m = summon(ctx, side, ref);
      if (m) fireAllyEnter(ctx, m);
      break;
    }
  }
  resolveDeaths(ctx);
}

function attack(ctx: Ctx, attackerUid: string, target: CharRef) {
  const { state, log } = ctx;
  const auras = computeAuras(state);
  const a = findMinion(state, attackerUid)!;
  const aStats = minionStats(a.minion, auras);
  const from: CharRef = { kind: 'minion', uid: attackerUid };
  log.push({ type: 'attack', side: a.side, from, to: target, text: `${cardName(a.minion)} ataca ${refName(state, target)}.` });
  a.minion.attacksLeft -= 1;
  // Dano ao mesmo tempo: quem apanha também bate (herói não revida).
  const back = target.kind === 'minion' ? minionStats(findMinion(state, target.uid)!.minion, auras).power : 0;
  dealDamage(ctx, target, aStats.power, cardName(a.minion));
  if (back > 0) dealDamage(ctx, from, back, refName(state, target));
  resolveDeaths(ctx);
}

function usePower(ctx: Ctx, target: CharRef | undefined) {
  const { state, log } = ctx;
  const side = state.active;
  const p = state.players[side];
  const hero = getHero(p.hero.heroId);
  p.merenda -= hero.power.cost;
  p.hero.powerUsed = true;
  log.push({ type: 'effect', side, name: hero.power.name, text: `${hero.name} usa ${hero.power.name}!` });
  for (const effect of hero.power.effects) {
    runEffect(ctx, { side, uid: null, name: hero.power.name }, effect, { chosen: hero.power.target ? target : undefined });
  }
  resolveDeaths(ctx);
}

// ───────────────────────────── Turnos ─────────────────────────────

function startTurn(ctx: Ctx) {
  const { state, log } = ctx;
  state.turn += 1;
  const side = state.active;
  const p = state.players[side];
  const night = isNight(state.turn);
  log.push({
    type: 'turn',
    side,
    turn: state.turn,
    night,
    text: `Rodada ${roundOf(state.turn)} (${night ? 'Noite' : 'Dia'}): vez de ${getHero(p.hero.heroId).name}.`,
  });
  p.maxMerenda = Math.min(MAX_MERENDA, p.maxMerenda + 1);
  p.merenda = p.maxMerenda + p.bonusMerenda;
  p.bonusMerenda = 0;
  p.hero.powerUsed = false;
  p.playedThisTurn = 0;
  p.peek = null;
  for (const m of p.board) m.attacksLeft = 1;
  drawCard(ctx, side);
  fireSide(ctx, side, 'onTurnStart');
  resolveDeaths(ctx);
}

function endTurn(ctx: Ctx) {
  const { state, log } = ctx;
  const side = state.active;
  fireSide(ctx, side, 'onTurnEnd');
  fireSide(ctx, other(side), 'onEnemyTurnEnd');
  resolveDeaths(ctx);

  for (const { minion } of allMinions(state)) {
    minion.turnBuffs = { power: 0, toughness: 0 };
    minion.turnKeywords = [];
  }
  // Quem estava na Diretoria volta no fim do turno que perdeu.
  for (const s of [0, 1] as Side[]) {
    const p = state.players[s];
    const back = p.diretoria.filter((d) => d.returnTurn <= state.turn);
    p.diretoria = p.diretoria.filter((d) => d.returnTurn > state.turn);
    for (const d of back) {
      if (p.board.length < BOARD_SIZE) {
        d.minion.enteredTurn = state.turn;
        p.board.push(d.minion);
        log.push({ type: 'move', side: s, text: `${cardName(d.minion)} voltou da Diretoria.` });
      } else {
        addToHand(ctx, s, { uid: d.minion.uid, defId: d.minion.defId });
        log.push({ type: 'move', side: s, text: `${cardName(d.minion)} voltou da Diretoria para a mão (mesa cheia).` });
      }
    }
  }
  resolveDeaths(ctx);
  if (checkWinner(state) !== null) return;
  if (state.turn >= MAX_TURNS) return;
  state.active = other(side);
  startTurn(ctx);
}

/** Cartas com Resistência ≤ 0 vão para o lixo; repete até estabilizar (Despedidas podem matar mais). */
function resolveDeaths(ctx: Ctx) {
  const { state, log } = ctx;
  for (let guard = 0; guard < 20; guard++) {
    const auras = computeAuras(state);
    const dead = allMinions(state).filter((l) => minionStats(l.minion, auras).health <= 0);
    if (dead.length === 0) return;
    for (const l of dead) {
      removeMinion(state, l.minion.uid);
      state.players[l.side].discard.push({ uid: l.minion.uid, defId: l.minion.defId });
      log.push({ type: 'death', side: l.side, uid: l.minion.uid, defId: l.minion.defId, text: `${cardName(l.minion)} foi pro lixo.` });
    }
    for (const l of dead) {
      const def = getCard(l.minion.defId);
      if (l.minion.silenced) continue;
      for (const effect of def.effects) {
        if (effect.trigger === 'despedida') runEffect(ctx, { side: l.side, uid: null, name: def.name }, effect);
      }
    }
  }
}

function checkWinner(state: GameState): Winner {
  const [a, b] = state.players;
  const aOut = a.hero.hp <= 0;
  const bOut = b.hero.hp <= 0;
  if (aOut && bOut) return 'draw';
  if (aOut) return 1;
  if (bOut) return 0;
  if (state.turn >= MAX_TURNS) return a.hero.hp === b.hero.hp ? 'draw' : a.hero.hp > b.hero.hp ? 0 : 1;
  return null;
}

function finish(ctx: Ctx) {
  const { state, log } = ctx;
  if (state.winner !== null) return;
  const w = checkWinner(state);
  if (w === null) return;
  state.winner = w;
  const name = (s: Side) => getHero(state.players[s].hero.heroId).name;
  log.push({ type: 'end', winner: w, text: w === 'draw' ? 'Empate!' : `${name(w)} venceu o recreio!` });
}
