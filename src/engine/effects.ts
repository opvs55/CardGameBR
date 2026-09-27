// Interpretador de efeitos. As cartas declaram efeitos como dados (cards/index.ts);
// aqui eles viram mudanças no estado + entradas no log.
//
// Cada efeito é resolvido em duas fases: `plan` (checa condições, escolhe alvos,
// consome o RNG) e `apply` (muda o estado). Assim dá para planejar dois efeitos
// contra o mesmo estado e aplicar os dois "juntos" (empate de Pressa entre lados).

import { getCard } from './cards';
import { allInPlay, cardName, defOf, hasTag, isNight, locate, other, ZERO } from './state';
import type { Located } from './state';
import type { Rng } from './rng';
import { pick } from './rng';
import type {
  Buffs,
  CardDef,
  Condition,
  Effect,
  GameState,
  InPlay,
  LogEvent,
  Scope,
  Side,
  Target,
  Trigger,
} from './types';
import { ROW_SIZE } from './types';

export interface RevealMeta {
  played: [number, number];
  tapped: [boolean, boolean];
  spentAll: [boolean, boolean];
}

export interface Ctx {
  state: GameState;
  rng: Rng;
  log: LogEvent[];
  meta: RevealMeta;
}

export type Thunk = () => void;

// ───────────────────────────── Stats e auras ─────────────────────────────

export interface Stats {
  power: number;
  toughness: number;
  speed: number;
  /** Resistência atual (toughness - dano). */
  health: number;
}

/** Soma de todas as auras `static` da mesa, por lado e carteira. */
export function computeAuras(state: GameState): Buffs[][] {
  const table: Buffs[][] = [0, 1].map(() => Array.from({ length: ROW_SIZE }, () => ({ ...ZERO })));
  for (const src of allInPlay(state)) {
    if (src.card.flipped) continue;
    for (const effect of defOf(src.card).effects) {
      if (effect.trigger !== 'static') continue;
      if (!checkConditions(state, src, effect.conditions)) continue;
      const times = effect.repeatPer ? countTagAround(state, src, effect.repeatPer.tag, effect.repeatPer.scope) : 1;
      if (times <= 0) continue;
      for (const action of effect.actions) {
        if (action.kind !== 'buff') continue;
        for (const t of resolveTargets(state, src, action.target)) {
          const b = table[t.side][t.slot];
          b.power += (action.power ?? 0) * times;
          b.toughness += (action.toughness ?? 0) * times;
          b.speed += (action.speed ?? 0) * times;
        }
      }
    }
  }
  return table;
}

export function statsAt(state: GameState, side: Side, slot: number, auras = computeAuras(state)): Stats | null {
  const card = state.players[side].row[slot];
  if (!card) return null;
  const def = defOf(card);
  const aura = auras[side][slot];
  if (card.flipped) {
    // Levou Tapa: briga como 1/1 nesta rodada.
    return { power: 1, toughness: 1, speed: def.speed, health: 1 - card.damage };
  }
  const power = Math.max(0, def.power + card.permBuffs.power + card.roundBuffs.power + aura.power);
  const toughness = def.toughness + card.permBuffs.toughness + card.roundBuffs.toughness + aura.toughness;
  const speed = def.speed + card.permBuffs.speed + card.roundBuffs.speed + aura.speed;
  return { power, toughness, speed, health: toughness - card.damage };
}

// ───────────────────────────── Condições ─────────────────────────────

function slotsInScope(slot: number, scope: Scope | undefined): number[] {
  if (scope === 'neighbors') return [slot - 1, slot + 1].filter((s) => s >= 0 && s < ROW_SIZE);
  return Array.from({ length: ROW_SIZE }, (_, i) => i);
}

function countTagAround(state: GameState, src: Located, tag: string, scope: Scope): number {
  const row = state.players[src.side].row;
  return slotsInScope(src.slot, scope).filter((s) => {
    const c = row[s];
    return c && s !== src.slot && hasTag(defOf(c), tag);
  }).length;
}

export function checkConditions(
  state: GameState,
  src: Located,
  conditions: Condition[] | undefined,
  extra: { meta?: RevealMeta; entering?: InPlay } = {},
): boolean {
  if (!conditions) return true;
  const me = state.players[src.side];
  const opp = other(src.side);
  return conditions.every((cond) => {
    switch (cond.kind) {
      case 'allyHasTag':
        return countTagAround(state, src, cond.tag, cond.scope ?? 'row') > 0;
      case 'enteringHasTag':
        return !!extra.entering && hasTag(defOf(extra.entering), cond.tag);
      case 'isNight':
        return isNight(state.round);
      case 'isDay':
        return !isNight(state.round);
      case 'countFamily': {
        const row = me.row;
        const n = slotsInScope(src.slot, cond.scope).filter((s) => {
          const c = row[s];
          if (!c) return false;
          const d = defOf(c);
          return d.family === cond.family || !!d.wildcard;
        }).length;
        return n >= cond.min;
      }
      case 'countTag': {
        const n = allInPlay(state).filter(
          (l) =>
            (cond.side === 'both' || (cond.side === 'ally') === (l.side === src.side)) &&
            hasTag(defOf(l.card), cond.tag),
        ).length;
        return n >= cond.min;
      }
      case 'roundsInPlay':
        return state.round - src.card.enteredRound + 1 === cond.eq;
      case 'opponentPlayedAndTapped':
        return !!extra.meta && extra.meta.played[opp] >= cond.plays && extra.meta.tapped[opp];
      case 'opponentSpentAllMerenda':
        return !!extra.meta && extra.meta.spentAll[opp];
      case 'hasEmptySlot':
        return me.row.some((c) => c === null);
    }
  });
}

// ───────────────────────────── Alvos ─────────────────────────────

type TargetFilter = (l: Located) => boolean;

function at(state: GameState, side: Side, slots: number[]): Located[] {
  const row = state.players[side].row;
  return slots
    .filter((s) => s >= 0 && s < ROW_SIZE && row[s])
    .map((slot) => ({ side, slot, card: row[slot] as InPlay }));
}

export function resolveTargets(
  state: GameState,
  src: Located,
  target: Target,
  rng?: Rng,
  filter: TargetFilter = () => true,
): Located[] {
  const me = src.side;
  const opp = other(me);
  const i = src.slot;
  const all = (side: Side) => at(state, side, [0, 1, 2, 3, 4]);
  let out: Located[];
  if (typeof target === 'string') {
    switch (target) {
      case 'self':
        out = [src];
        break;
      case 'neighbors':
        out = at(state, me, [i - 1, i + 1]);
        break;
      case 'front':
        out = at(state, opp, [i]);
        break;
      case 'allEnemies':
        out = all(opp);
        break;
      case 'enemyNeighborsOfSelf':
        out = at(state, opp, [i - 1, i, i + 1]);
        break;
      case 'blastZone':
        out = [...at(state, me, [i - 1, i + 1]), ...at(state, opp, [i - 1, i, i + 1])];
        break;
      case 'randomEnemy': {
        const chosen = rng ? pick(rng, all(opp).filter(filter)) : undefined;
        return chosen ? [chosen] : [];
      }
    }
  } else {
    const sides: Side[] = target.side === 'both' ? [me, opp] : target.side === 'ally' ? [me] : [opp];
    out = sides.flatMap((side) =>
      side === me && target.scope === 'neighbors' ? at(state, side, [i - 1, i + 1]) : all(side),
    );
    out = out.filter((l) => {
      const d = defOf(l.card);
      return (
        !(l.side === me && l.slot === i) &&
        hasTag(d, target.tag) &&
        (target.maxCost === undefined || d.cost <= target.maxCost)
      );
    });
    if (target.random) {
      const chosen = rng ? pick(rng, out.filter(filter)) : undefined;
      return chosen ? [chosen] : [];
    }
  }
  return out.filter(filter);
}

// ───────────────────────────── Execução ─────────────────────────────

function removeFromRow(state: GameState, uid: string): Located | null {
  const l = locate(state, uid);
  if (l) state.players[l.side].row[l.slot] = null;
  return l;
}

/** Tira a carta da mesa e manda para a mão do dono, zerando dano e buffs. */
export function returnToHand(state: GameState, uid: string): Located | null {
  const l = removeFromRow(state, uid);
  if (l) state.players[l.side].hand.push({ uid: l.card.uid, defId: l.card.defId });
  return l;
}

export function sendToDiscard(state: GameState, uid: string): Located | null {
  const l = removeFromRow(state, uid);
  if (l) state.players[l.side].discard.push({ uid: l.card.uid, defId: l.card.defId });
  return l;
}

/** Planeja um efeito da carta `src`. Retorna null se as condições não batem. */
export function planEffect(ctx: Ctx, src: Located, effect: Effect, entering?: InPlay, depth = 0): Thunk[] | null {
  const { state, rng, log } = ctx;
  if (!checkConditions(state, src, effect.conditions, { meta: ctx.meta, entering })) return null;
  const def = defOf(src.card);
  const label = effect.name ?? def.name;
  const opp = other(src.side);
  const thunks: Thunk[] = [];
  // O nome do efeito só entra no log quando ele de fato faz alguma coisa.
  let announced = false;
  const announce = () => {
    if (announced) return;
    announced = true;
    log.push({
      type: 'effect',
      side: src.side,
      slot: src.slot,
      name: label,
      text: /[!?.]$/.test(label) ? `${def.name}: ${label}` : `${def.name}: ${label}!`,
    });
  };
  const say = (e: LogEvent) => {
    announce();
    log.push(e);
  };

  // Cada alvo é guardado pelo uid e reencontrado na hora de aplicar.
  const each = (targets: Located[], fn: (l: Located) => void) => {
    const uids = targets.map((t) => t.card.uid);
    thunks.push(() => {
      for (const uid of uids) {
        const l = locate(state, uid);
        if (l) fn(l);
      }
    });
  };

  for (const action of effect.actions) {
    switch (action.kind) {
      case 'damage':
        each(resolveTargets(state, src, action.target, rng), (l) => {
          l.card.damage += action.amount;
          say({
            type: 'damage',
            side: l.side,
            slot: l.slot,
            amount: action.amount,
            text: `${cardName(l.card)} toma -${action.amount} (${label}).`,
          });
        });
        break;
      case 'heal':
        each(resolveTargets(state, src, action.target, rng), (l) => {
          const healed = Math.min(action.amount, l.card.damage);
          if (healed <= 0) return;
          l.card.damage -= healed;
          say({
            type: 'heal',
            side: l.side,
            slot: l.slot,
            amount: healed,
            text: `${cardName(l.card)} recupera ${healed} (${label}).`,
          });
        });
        break;
      case 'buff':
        each(resolveTargets(state, src, action.target, rng), (l) => {
          const b = action.duration === 'permanent' ? l.card.permBuffs : l.card.roundBuffs;
          b.power += action.power ?? 0;
          b.toughness += action.toughness ?? 0;
          b.speed += action.speed ?? 0;
          const parts = [
            action.power ? `${action.power > 0 ? '+' : ''}${action.power} Força` : '',
            action.toughness ? `${action.toughness > 0 ? '+' : ''}${action.toughness} Resistência` : '',
            action.speed ? `${action.speed > 0 ? '+' : ''}${action.speed} Pressa` : '',
          ].filter(Boolean);
          say({ type: 'buff', side: l.side, slot: l.slot, text: `${cardName(l.card)} ganha ${parts.join(', ')}.` });
        });
        break;
      case 'directAttack':
        each(resolveTargets(state, src, action.target, rng), (l) => {
          l.card.directAttack = true;
          say({ type: 'buff', side: l.side, slot: l.slot, text: `${cardName(l.card)} vai direto na Moral!` });
        });
        break;
      case 'noFight':
        each(resolveTargets(state, src, action.target, rng), (l) => {
          l.card.noFight = true;
          announce();
        });
        break;
      case 'suspend': {
        const eligible: TargetFilter = (l) => {
          const d = defOf(l.card);
          return !d.immuneToSuspend && (action.maxCost === undefined || d.cost <= action.maxCost);
        };
        each(resolveTargets(state, src, action.target, rng, eligible), (l) => {
          removeFromRow(state, l.card.uid);
          l.card.roundBuffs = { ...ZERO };
          l.card.directAttack = false;
          l.card.noFight = false;
          state.players[l.side].diretoria.push({ card: l.card, slot: l.slot, returnRound: state.round + 2 });
          say({ type: 'suspend', side: l.side, slot: l.slot, text: `${cardName(l.card)} foi para a Diretoria.` });
        });
        break;
      }
      case 'returnToHand':
        each(resolveTargets(state, src, action.target, rng), (l) => {
          returnToHand(state, l.card.uid);
          say({ type: 'return', side: l.side, slot: l.slot, text: `${cardName(l.card)} volta para a mão.` });
        });
        break;
      case 'destroy':
        each(resolveTargets(state, src, action.target, rng), (l) => {
          sendToDiscard(state, l.card.uid);
          say({ type: 'death', side: l.side, slot: l.slot, defId: l.card.defId, text: `${cardName(l.card)} sai do jogo.` });
        });
        break;
      case 'swapEnemies': {
        const row = state.players[opp].row;
        const occupied = row.flatMap((c, s) => (c ? [s] : []));
        const empty = row.flatMap((c, s) => (c ? [] : [s]));
        const first = pick(rng, occupied);
        if (first === undefined) break;
        const rest = occupied.filter((s) => s !== first);
        const second = rest.length > 0 ? pick(rng, rest) : pick(rng, empty);
        if (second === undefined) break;
        thunks.push(() => {
          const r = state.players[opp].row;
          [r[first], r[second]] = [r[second], r[first]];
          say({
            type: 'swap',
            side: opp,
            a: first,
            b: second,
            text: `Redemoinho! As carteiras ${first + 1} e ${second + 1} trocaram de lugar.`,
          });
        });
        break;
      }
      case 'diagonalFight':
        thunks.push(() => {
          state.diagonal[src.side] = true;
          announce();
        });
        break;
      case 'peekHand': {
        const seen = pick(rng, state.players[opp].hand);
        if (!seen) break;
        thunks.push(() => {
          state.players[src.side].peek = seen.defId;
          say({ type: 'peek', side: src.side, text: `${def.name} espiou uma carta da mão do outro lado.` });
        });
        break;
      }
      case 'stealMerenda':
        thunks.push(() => {
          state.players[opp].stolenMerenda += action.amount;
          say({ type: 'merenda', side: src.side, amount: action.amount, text: `${def.name} vai roubar ${action.amount} de Merenda na próxima rodada.` });
        });
        break;
      case 'repeatEnterEffect': {
        if (depth > 0) break;
        const candidates = state.players[src.side].row
          .flatMap((c, slot) => (c ? [{ side: src.side, slot, card: c }] : []))
          .filter(
            (l) =>
              l.card.uid !== src.card.uid &&
              !l.card.flipped &&
              !defOf(l.card).effects.some((e) => e.actions.some((a) => a.kind === 'repeatEnterEffect')) &&
              defOf(l.card).effects.some((e) => e.trigger === 'onEnter'),
          )
          .sort((a, b) => b.card.enteredRound - a.card.enteredRound || a.slot - b.slot);
        const chosen = candidates[0];
        if (!chosen) break;
        thunks.push(() => {
          say({ type: 'buff', side: src.side, slot: src.slot, text: `Repete o efeito de entrada de ${cardName(chosen.card)}.` });
        });
        for (const e of defOf(chosen.card).effects) {
          if (e.trigger !== 'onEnter') continue;
          const planned = planEffect(ctx, chosen, e, undefined, depth + 1);
          if (planned) thunks.push(...planned);
        }
        break;
      }
      case 'enterFree':
        // Só faz sentido na mão; tratado em round.ts.
        break;
    }
  }
  return thunks;
}

export function planTrigger(ctx: Ctx, src: Located, trigger: Trigger, entering?: InPlay): Thunk[] {
  if (src.card.flipped) return [];
  const out: Thunk[] = [];
  for (const effect of defOf(src.card).effects) {
    if (effect.trigger !== trigger) continue;
    const planned = planEffect(ctx, src, effect, entering);
    if (planned) out.push(...planned);
  }
  return out;
}

/** Dispara um gatilho em todas as cartas da mesa ao mesmo tempo. */
export function fireAll(ctx: Ctx, trigger: Trigger) {
  const thunks = allInPlay(ctx.state).flatMap((src) => planTrigger(ctx, src, trigger));
  thunks.forEach((t) => t());
}

export function hasTrigger(def: CardDef, trigger: Trigger) {
  return def.effects.some((e) => e.trigger === trigger);
}

export { getCard };
