// Interpretador de efeitos. As cartas declaram efeitos como dados (cards/index.ts);
// aqui eles viram mudanças no estado + entradas no log.
//
// Cada efeito é resolvido em duas fases: `plan` (checa condições, escolhe alvos,
// consome o RNG) e `apply` (muda o estado). Assim um efeito com várias ações
// escolhe todos os alvos antes de qualquer dano acontecer.

import { getCard } from './cards';
import type { Rng } from './rng';
import { pick } from './rng';
import { allMinions, findMinion, hasTag, isNight, newMinion, other, refName } from './state';
import type { Located } from './state';
import type {
  CardDef,
  CardRef,
  CharRef,
  Condition,
  Effect,
  GameState,
  Keyword,
  LogEvent,
  Minion,
  Side,
  Target,
  TargetSpec,
  Trigger,
} from './types';
import { BOARD_SIZE, HAND_LIMIT } from './types';

export interface Ctx {
  state: GameState;
  rng: Rng;
  log: LogEvent[];
}

/** Quem disparou o efeito: uma carta na mesa, ou um feitiço/poder (uid null). */
export interface Source {
  side: Side;
  uid: string | null;
  name: string;
}

export type Thunk = () => void;

// ───────────────────────────── Stats e auras ─────────────────────────────

interface Aura {
  power: number;
  toughness: number;
  keywords: Keyword[];
}

export interface MinionStats {
  power: number;
  toughness: number;
  /** Resistência atual. */
  health: number;
  keywords: Keyword[];
}

export type Auras = Map<string, Aura>;

export function computeAuras(state: GameState): Auras {
  const table: Auras = new Map();
  const get = (uid: string) => {
    let a = table.get(uid);
    if (!a) table.set(uid, (a = { power: 0, toughness: 0, keywords: [] }));
    return a;
  };
  for (const l of allMinions(state)) {
    if (l.minion.silenced) continue;
    const src: Source = { side: l.side, uid: l.minion.uid, name: getCard(l.minion.defId).name };
    for (const effect of getCard(l.minion.defId).effects) {
      if (effect.trigger !== 'static') continue;
      if (!checkConditions(state, src, effect.conditions)) continue;
      const times = effect.repeatPer ? countAllies(state, src, effect.repeatPer.tag) : 1;
      if (times <= 0) continue;
      for (const action of effect.actions) {
        if (action.kind !== 'buff' && action.kind !== 'giveKeyword') continue;
        for (const ref of resolveTargets(state, src, action.target)) {
          if (ref.kind !== 'minion') continue;
          const a = get(ref.uid);
          if (action.kind === 'buff') {
            a.power += (action.power ?? 0) * times;
            a.toughness += (action.toughness ?? 0) * times;
          } else if (!a.keywords.includes(action.keyword)) {
            a.keywords.push(action.keyword);
          }
        }
      }
    }
  }
  return table;
}

export function minionStats(m: Minion, auras: Auras): MinionStats {
  const def = getCard(m.defId);
  const aura = auras.get(m.uid) ?? { power: 0, toughness: 0, keywords: [] };
  const power = Math.max(0, def.power + m.buffs.power + m.turnBuffs.power + aura.power);
  const toughness = def.toughness + m.buffs.toughness + m.turnBuffs.toughness + aura.toughness;
  const keywords = [
    ...new Set([...(m.silenced ? [] : def.keywords), ...m.keywords, ...m.turnKeywords, ...aura.keywords]),
  ];
  return { power, toughness, health: toughness - m.damage, keywords };
}

export function statsOf(state: GameState, uid: string, auras = computeAuras(state)): MinionStats | null {
  const l = findMinion(state, uid);
  return l ? minionStats(l.minion, auras) : null;
}

// ───────────────────────────── Condições ─────────────────────────────

function countAllies(state: GameState, src: Source, tag: string): number {
  return state.players[src.side].board.filter((m) => m.uid !== src.uid && hasTag(getCard(m.defId), tag)).length;
}

export function checkConditions(
  state: GameState,
  src: Source,
  conditions: Condition[] | undefined,
  extra: { entering?: CardRef } = {},
): boolean {
  if (!conditions) return true;
  const me = state.players[src.side];
  const opp = state.players[other(src.side)];
  return conditions.every((cond) => {
    switch (cond.kind) {
      case 'allyHasTag':
        return countAllies(state, src, cond.tag) > 0;
      case 'enteringHasTag':
        return !!extra.entering && hasTag(getCard(extra.entering.defId), cond.tag);
      case 'isNight':
        return isNight(state.turn);
      case 'isDay':
        return !isNight(state.turn);
      case 'countTag':
        return (
          allMinions(state).filter(
            (l) =>
              (cond.side === 'both' || (cond.side === 'ally') === (l.side === src.side)) &&
              hasTag(getCard(l.minion.defId), cond.tag),
          ).length >= cond.min
        );
      case 'turnsInPlay': {
        const m = src.uid ? findMinion(state, src.uid)?.minion : null;
        return !!m && Math.floor((state.turn - m.enteredTurn) / 2) + 1 === cond.eq;
      }
      case 'opponentPlayedThisTurn':
        return opp.playedThisTurn >= cond.min;
      case 'opponentSpentAllMerenda':
        return opp.maxMerenda > 0 && opp.merenda === 0;
      case 'hasBoardSpace':
        return me.board.length < BOARD_SIZE;
    }
  });
}

// ───────────────────────────── Alvos ─────────────────────────────

const minionRef = (m: Minion): CharRef => ({ kind: 'minion', uid: m.uid });
const heroRef = (side: Side): CharRef => ({ kind: 'hero', side });

/** Alvos que o jogador pode escolher para uma carta/poder. */
export function validTargets(state: GameState, side: Side, spec: TargetSpec): CharRef[] {
  const opp = other(side);
  const minions = (s: Side) =>
    state.players[s].board.filter((m) => spec.maxCost === undefined || getCard(m.defId).cost <= spec.maxCost).map(minionRef);
  switch (spec.kind) {
    case 'anyCharacter':
      return [...minions(side), ...minions(opp), heroRef(side), heroRef(opp)];
    case 'anyMinion':
      return [...minions(side), ...minions(opp)];
    case 'enemyMinion':
      return minions(opp);
    case 'allyMinion':
      return minions(side);
    case 'enemyCharacter':
      return [...minions(opp), heroRef(opp)];
    case 'allyCharacter':
      return [...minions(side), heroRef(side)];
  }
}

export function resolveTargets(
  state: GameState,
  src: Source,
  target: Target,
  opts: { rng?: Rng; chosen?: CharRef; maxCost?: number } = {},
): CharRef[] {
  const me = src.side;
  const opp = other(me);
  const board = (s: Side) => state.players[s].board;
  const costOk = (m: Minion) => opts.maxCost === undefined || getCard(m.defId).cost <= opts.maxCost;
  const self = src.uid ? findMinion(state, src.uid) : null;
  const randomOf = (refs: CharRef[]) => {
    const chosen = opts.rng ? pick(opts.rng, refs) : undefined;
    return chosen ? [chosen] : [];
  };
  if (typeof target === 'string') {
    switch (target) {
      case 'self':
        return self ? [minionRef(self.minion)] : [];
      case 'neighbors':
        return self
          ? [board(me)[self.index - 1], board(me)[self.index + 1]].filter((m): m is Minion => !!m).map(minionRef)
          : [];
      case 'chosen':
        return opts.chosen ? [opts.chosen] : [];
      case 'randomEnemy':
        return randomOf([...board(opp).map(minionRef), heroRef(opp)]);
      case 'randomEnemyMinion':
        return randomOf(board(opp).filter(costOk).map(minionRef));
      case 'allEnemyMinions':
        return board(opp).map(minionRef);
      case 'allOtherMinions':
        return allMinions(state)
          .filter((l) => l.minion.uid !== src.uid)
          .map((l) => minionRef(l.minion));
      case 'allyHero':
        return [heroRef(me)];
      case 'enemyHero':
        return [heroRef(opp)];
    }
  }
  const sides: Side[] = target.side === 'both' ? [me, opp] : target.side === 'ally' ? [me] : [opp];
  return sides
    .flatMap((s) => {
      if (target.neighbors) {
        if (!self || s !== me) return [];
        return [board(me)[self.index - 1], board(me)[self.index + 1]].filter((m): m is Minion => !!m);
      }
      return board(s);
    })
    .filter((m) => m.uid !== src.uid && hasTag(getCard(m.defId), target.tag) && costOk(m))
    .map(minionRef);
}

// ───────────────────────────── Operações básicas ─────────────────────────────

export function dealDamage(ctx: Ctx, ref: CharRef, amount: number, label: string) {
  if (amount <= 0) return;
  const { state, log } = ctx;
  if (ref.kind === 'hero') {
    state.players[ref.side].hero.hp -= amount;
    log.push({ type: 'damage', to: ref, amount, text: `${refName(state, ref)} toma ${amount} (${label}).` });
    return;
  }
  const l = findMinion(state, ref.uid);
  if (!l) return;
  if (l.minion.shield) {
    l.minion.shield = false;
    log.push({ type: 'shield', to: ref, text: `O Capacete de ${refName(state, ref)} segurou o golpe!` });
    return;
  }
  l.minion.damage += amount;
  log.push({ type: 'damage', to: ref, amount, text: `${refName(state, ref)} toma ${amount} (${label}).` });
}

function heal(ctx: Ctx, ref: CharRef, amount: number, label: string) {
  const { state, log } = ctx;
  let healed = 0;
  if (ref.kind === 'hero') {
    const h = state.players[ref.side].hero;
    healed = Math.min(amount, h.maxHp - h.hp);
    h.hp += healed;
  } else {
    const l = findMinion(state, ref.uid);
    if (!l) return;
    healed = Math.min(amount, l.minion.damage);
    l.minion.damage -= healed;
  }
  if (healed > 0) log.push({ type: 'heal', to: ref, amount: healed, text: `${refName(state, ref)} recupera ${healed} (${label}).` });
}

export function removeMinion(state: GameState, uid: string): Located | null {
  const l = findMinion(state, uid);
  if (l) state.players[l.side].board.splice(l.index, 1);
  return l;
}

export function addToHand(ctx: Ctx, side: Side, ref: CardRef) {
  const p = ctx.state.players[side];
  if (p.hand.length >= HAND_LIMIT) {
    p.discard.push(ref);
    ctx.log.push({ type: 'move', side, text: `Mão cheia: ${getCard(ref.defId).name} foi pro lixo.` });
  } else {
    p.hand.push({ uid: ref.uid, defId: ref.defId });
  }
}

export function drawCard(ctx: Ctx, side: Side) {
  const p = ctx.state.players[side];
  const card = p.deck.shift();
  if (!card) {
    p.fatigue += 1;
    ctx.log.push({ type: 'fatigue', side, amount: p.fatigue, text: `Acabou o deck! Cansaço: ${p.fatigue} de dano.` });
    dealDamage(ctx, { kind: 'hero', side }, p.fatigue, 'Cansaço');
    return;
  }
  ctx.log.push({ type: 'draw', side, text: 'Comprou 1 carta.' });
  addToHand(ctx, side, card);
}

/** Coloca uma carta na mesa (sem Chegada) e avisa as aliadas (onAllyEnter). */
export function summon(ctx: Ctx, side: Side, ref: CardRef, position?: number): Minion | null {
  const board = ctx.state.players[side].board;
  if (board.length >= BOARD_SIZE) return null;
  const m = newMinion(ref, ctx.state.turn);
  const at = position === undefined ? board.length : Math.max(0, Math.min(position, board.length));
  board.splice(at, 0, m);
  ctx.log.push({ type: 'summon', side, uid: m.uid, defId: m.defId, text: `${getCard(m.defId).name} entra na mesa.` });
  return m;
}

export function fireAllyEnter(ctx: Ctx, entering: Minion) {
  const l = findMinion(ctx.state, entering.uid);
  if (!l) return;
  for (const ally of [...ctx.state.players[l.side].board]) {
    if (ally.uid === entering.uid) continue;
    const loc = findMinion(ctx.state, ally.uid);
    if (loc) runTrigger(ctx, loc, 'onAllyEnter', { entering });
  }
}

// ───────────────────────────── Execução ─────────────────────────────

export interface RunOpts {
  chosen?: CharRef;
  entering?: CardRef;
  depth?: number;
}

/** Planeja um efeito. Retorna null se as condições não batem. */
export function planEffect(ctx: Ctx, src: Source, effect: Effect, opts: RunOpts = {}): Thunk[] | null {
  const { state, rng, log } = ctx;
  if (!checkConditions(state, src, effect.conditions, { entering: opts.entering })) return null;
  const label = effect.name ?? src.name;
  const thunks: Thunk[] = [];
  // O nome do efeito só entra no log quando ele de fato faz alguma coisa.
  let announced = false;
  const announce = () => {
    if (announced) return;
    announced = true;
    if (label === src.name) return; // "Chinelada: Chinelada!" não diz nada
    log.push({ type: 'effect', side: src.side, name: label, text: /[!?.]$/.test(label) ? `${src.name}: ${label}` : `${src.name}: ${label}!` });
  };
  const targets = (target: Target, maxCost?: number) => resolveTargets(state, src, target, { rng, chosen: opts.chosen, maxCost });
  const onMinions = (refs: CharRef[], fn: (l: Located) => void) => {
    thunks.push(() => {
      for (const ref of refs) {
        if (ref.kind !== 'minion') continue;
        const l = findMinion(state, ref.uid);
        if (l) fn(l);
      }
    });
  };

  for (const action of effect.actions) {
    switch (action.kind) {
      case 'damage': {
        const refs = targets(action.target);
        thunks.push(() => {
          for (const ref of refs) {
            announce();
            dealDamage(ctx, ref, action.amount, label);
          }
        });
        break;
      }
      case 'heal': {
        const refs = targets(action.target);
        thunks.push(() => refs.forEach((ref) => heal(ctx, ref, action.amount, label)));
        // Anuncia só se curou alguém: heal() já registra a cura.
        break;
      }
      case 'buff':
        onMinions(targets(action.target), (l) => {
          const b = action.duration === 'permanent' ? l.minion.buffs : l.minion.turnBuffs;
          b.power += action.power ?? 0;
          b.toughness += action.toughness ?? 0;
          const parts = [
            action.power ? `${action.power > 0 ? '+' : ''}${action.power} Força` : '',
            action.toughness ? `${action.toughness > 0 ? '+' : ''}${action.toughness} Resistência` : '',
          ].filter(Boolean);
          announce();
          log.push({ type: 'buff', to: minionRef(l.minion), text: `${getCard(l.minion.defId).name} fica com ${parts.join(' e ')}.` });
        });
        break;
      case 'giveKeyword':
        onMinions(targets(action.target), (l) => {
          const list = action.duration === 'permanent' ? l.minion.keywords : l.minion.turnKeywords;
          if (!list.includes(action.keyword)) list.push(action.keyword);
          if (action.keyword === 'capacete') l.minion.shield = true;
        });
        break;
      case 'suspend':
        onMinions(targets(action.target, action.maxCost), (l) => {
          const def = getCard(l.minion.defId);
          if (def.immuneToSuspend || (action.maxCost !== undefined && def.cost > action.maxCost)) return;
          removeMinion(state, l.minion.uid);
          l.minion.turnBuffs = { power: 0, toughness: 0 };
          l.minion.turnKeywords = [];
          // Perde o próximo turno do dono e volta no fim dele.
          const ownerNext = state.active === l.side ? state.turn + 2 : state.turn + 1;
          state.players[l.side].diretoria.push({ minion: l.minion, returnTurn: ownerNext });
          announce();
          log.push({ type: 'move', side: l.side, text: `${def.name} foi para a Diretoria.` });
        });
        break;
      case 'returnToHand':
        onMinions(targets(action.target, action.maxCost), (l) => {
          removeMinion(state, l.minion.uid);
          announce();
          log.push({ type: 'move', side: l.side, text: `${getCard(l.minion.defId).name} volta para a mão.` });
          addToHand(ctx, l.side, { uid: l.minion.uid, defId: l.minion.defId });
        });
        break;
      case 'silence':
        onMinions(targets(action.target), (l) => {
          const m = l.minion;
          m.silenced = true;
          m.buffs = { power: 0, toughness: 0 };
          m.turnBuffs = { power: 0, toughness: 0 };
          m.keywords = [];
          m.turnKeywords = [];
          m.shield = false;
          announce();
          log.push({ type: 'buff', to: minionRef(m), text: `${getCard(m.defId).name} ficou virada: sem efeitos.` });
        });
        break;
      case 'destroy':
        onMinions(targets(action.target), (l) => {
          removeMinion(state, l.minion.uid);
          state.players[l.side].discard.push({ uid: l.minion.uid, defId: l.minion.defId });
          announce();
          log.push({ type: 'death', side: l.side, uid: l.minion.uid, defId: l.minion.defId, text: `${getCard(l.minion.defId).name} sai do jogo.` });
        });
        break;
      case 'summon':
        thunks.push(() => {
          announce();
          for (let i = 0; i < action.count; i++) {
            const m = summon(ctx, src.side, { uid: `t${state.nextUid++}`, defId: action.cardId });
            if (m) fireAllyEnter(ctx, m);
          }
        });
        break;
      case 'draw':
        thunks.push(() => {
          announce();
          for (let i = 0; i < action.count; i++) drawCard(ctx, src.side);
        });
        break;
      case 'gainMerenda':
        thunks.push(() => {
          const p = state.players[src.side];
          announce();
          if (action.when === 'now') {
            p.merenda += action.amount;
            log.push({ type: 'merenda', side: src.side, text: `+${action.amount} de Merenda neste turno.` });
          } else {
            p.bonusMerenda += action.amount;
            log.push({ type: 'merenda', side: src.side, text: `+${action.amount} de Merenda no próximo turno.` });
          }
        });
        break;
      case 'peekHand': {
        const seen = pick(rng, state.players[other(src.side)].hand);
        if (!seen) break;
        thunks.push(() => {
          state.players[src.side].peek = seen.defId;
          announce();
          log.push({ type: 'peek', side: src.side, text: `${src.name} espiou uma carta da mão do outro lado.` });
        });
        break;
      }
      case 'repeatChegada': {
        if ((opts.depth ?? 0) > 0) break;
        const candidates = state.players[src.side].board.filter((m) => {
          const def = getCard(m.defId);
          return (
            m.uid !== src.uid &&
            !m.silenced &&
            def.effects.some((e) => e.trigger === 'chegada') &&
            !def.effects.some((e) => e.actions.some((a) => a.kind === 'repeatChegada'))
          );
        });
        const chosenAlly = pick(rng, candidates);
        if (!chosenAlly) break;
        const loc = findMinion(state, chosenAlly.uid)!;
        const def = getCard(chosenAlly.defId);
        const target = def.target ? pick(rng, validTargets(state, loc.side, def.target)) : undefined;
        thunks.push(() => {
          announce();
          log.push({ type: 'effect', side: src.side, name: label, text: `Repete a Chegada de ${def.name}.` });
        });
        for (const e of def.effects) {
          if (e.trigger !== 'chegada') continue;
          const planned = planEffect(ctx, { side: loc.side, uid: chosenAlly.uid, name: def.name }, e, {
            chosen: target,
            depth: (opts.depth ?? 0) + 1,
          });
          if (planned) thunks.push(...planned);
        }
        break;
      }
      case 'enterFree':
        break; // tratado em game.ts (a carta está na mão)
    }
  }
  return thunks;
}

export function runEffect(ctx: Ctx, src: Source, effect: Effect, opts: RunOpts = {}) {
  planEffect(ctx, src, effect, opts)?.forEach((t) => t());
}

/** Dispara um gatilho de uma carta na mesa. */
export function runTrigger(ctx: Ctx, l: Located, trigger: Trigger, opts: RunOpts = {}) {
  if (l.minion.silenced) return;
  const def = getCard(l.minion.defId);
  for (const effect of def.effects) {
    if (effect.trigger !== trigger) continue;
    // A carta pode ter saído da mesa por um efeito anterior.
    if (!findMinion(ctx.state, l.minion.uid)) return;
    runEffect(ctx, { side: l.side, uid: l.minion.uid, name: def.name }, effect, opts);
  }
}

/** Dispara um gatilho em todas as cartas de um lado, da esquerda para a direita. */
export function fireSide(ctx: Ctx, side: Side, trigger: Trigger) {
  for (const m of [...ctx.state.players[side].board]) {
    const l = findMinion(ctx.state, m.uid);
    if (l) runTrigger(ctx, l, trigger);
  }
}

/** A Chegada desta carta precisa de alvo agora? (tem alvo, condição bate e há alvos válidos) */
export function needsTarget(state: GameState, side: Side, def: CardDef): boolean {
  if (!def.target) return false;
  if (validTargets(state, side, def.target).length === 0) return false;
  if (def.kind === 'spell') return true;
  const src: Source = { side, uid: null, name: def.name };
  return def.effects.some(
    (e) =>
      e.trigger === 'chegada' &&
      e.actions.some((a) => 'target' in a && a.target === 'chosen') &&
      checkConditions(state, src, e.conditions),
  );
}

export { getCard };
