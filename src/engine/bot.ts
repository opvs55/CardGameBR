// Bot simples: joga o que couber (mais caro primeiro), usa o poder quando sobra
// Merenda, troca bem quando dá e bate na cara quando não.
import { getCard, getHero } from './cards';
import type { MinionStats } from './effects';
import { computeAuras, minionStats, needsTarget, validTargets } from './effects';
import { attackTargets, canAttack, canPlay, canUsePower } from './game';
import type { Rng } from './rng';
import { findMinion, other } from './state';
import type { Action, CharRef, Effect, GameAction, GameState, Side } from './types';

type Intent = 'harm' | 'help';

function intentOf(effects: Effect[]): Intent {
  const harmful = effects.some((e) =>
    e.actions.some(
      (a) =>
        'target' in a &&
        a.target === 'chosen' &&
        (a.kind === 'damage' || a.kind === 'silence' || a.kind === 'returnToHand' || a.kind === 'suspend' ||
          (a.kind === 'buff' && (a.power ?? 0) < 0)),
    ),
  );
  return harmful ? 'harm' : 'help';
}

function damageOf(effects: Effect[]): number {
  let total = 0;
  for (const e of effects) for (const a of e.actions as Action[]) if (a.kind === 'damage' && a.target === 'chosen') total += a.amount;
  return total;
}

/** Escolhe o melhor alvo; null se nenhum vale a pena. */
function pickTarget(state: GameState, side: Side, candidates: CharRef[], effects: Effect[]): CharRef | null {
  const auras = computeAuras(state);
  const stats = (ref: CharRef): MinionStats | null =>
    ref.kind === 'minion' ? minionStats(findMinion(state, ref.uid)!.minion, auras) : null;
  const cost = (ref: CharRef) => (ref.kind === 'minion' ? getCard(findMinion(state, ref.uid)!.minion.defId).cost : 0);
  const mine = (ref: CharRef) => (ref.kind === 'hero' ? ref.side === side : findMinion(state, ref.uid)!.side === side);

  if (intentOf(effects) === 'harm') {
    const dmg = damageOf(effects);
    const scored = candidates
      .filter((r) => !mine(r))
      .map((r) => {
        const st = stats(r);
        if (!st) return { r, score: dmg > 0 ? 1 : -1 };
        const kills = dmg > 0 && st.health <= dmg;
        return { r, score: (kills ? 10 : 0) + st.power * 2 + cost(r) + (st.keywords.includes('provocar') ? 3 : 0) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored[0]?.r ?? null;
  }
  // Ajuda: cura quem está machucado.
  const hurt = candidates
    .filter(mine)
    .map((r) => {
      if (r.kind === 'hero') {
        const h = state.players[side].hero;
        return { r, missing: h.maxHp - h.hp };
      }
      return { r, missing: findMinion(state, r.uid)!.minion.damage };
    })
    .filter((x) => x.missing >= 2)
    .sort((a, b) => b.missing - a.missing);
  return hurt[0]?.r ?? null;
}

export function botAction(state: GameState, _rng?: Rng): GameAction {
  const side = state.active;
  const me = state.players[side];
  const opp = state.players[other(side)];
  const auras = computeAuras(state);

  // 1. Cartas, da mais cara para a mais barata.
  const hand = [...me.hand].sort((a, b) => getCard(b.defId).cost - getCard(a.defId).cost);
  const canAffordAfterCoin = hand.some((c) => getCard(c.defId).cost === me.merenda + 1 && c.defId !== 'troco');
  for (const ref of hand) {
    const def = getCard(ref.defId);
    if (canPlay(state, ref.uid)) continue;
    if (def.id === 'troco' && !canAffordAfterCoin) continue;
    if (def.id === 'faxina-de-sabado' && opp.board.length < 2) continue;
    if (def.id === 'hora-do-lanche' && me.hand.length > 7) continue;
    if (needsTarget(state, side, def)) {
      const target = pickTarget(state, side, validTargets(state, side, def.target!), def.effects);
      if (!target) continue;
      return { type: 'play', uid: ref.uid, target };
    }
    return { type: 'play', uid: ref.uid };
  }

  // 2. Poder do herói.
  const power = getHero(me.hero.heroId).power;
  if (!canUsePower(state)) {
    if (!power.target) return { type: 'power' };
    const target = pickTarget(state, side, validTargets(state, side, power.target), power.effects);
    if (target) return { type: 'power', target };
  }

  // 3. Ataques: troca boa > troca contra carta perigosa > cara.
  for (const m of me.board) {
    if (!canAttack(state, m.uid)) continue;
    const st = minionStats(m, auras);
    const targets = attackTargets(state, m.uid);
    const minions = targets
      .filter((t): t is { kind: 'minion'; uid: string } => t.kind === 'minion')
      .map((t) => ({ t, s: minionStats(findMinion(state, t.uid)!.minion, auras) }));
    const good = minions
      .filter(({ s }) => s.health <= st.power && s.power < st.health)
      .sort((a, b) => b.s.power - a.s.power)[0];
    if (good) return { type: 'attack', attacker: m.uid, target: good.t };
    const even = minions.filter(({ s }) => s.health <= st.power && s.power >= 3).sort((a, b) => b.s.power - a.s.power)[0];
    if (even) return { type: 'attack', attacker: m.uid, target: even.t };
    const face = targets.find((t) => t.kind === 'hero');
    if (face) return { type: 'attack', attacker: m.uid, target: face };
    const weakest = minions.sort((a, b) => a.s.health - b.s.health)[0];
    if (weakest) return { type: 'attack', attacker: m.uid, target: weakest.t };
  }

  return { type: 'end' };
}
