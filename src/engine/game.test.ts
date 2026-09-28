import { describe, expect, it } from 'vitest';
import { computeAuras, statsOf } from './effects';
import { applyAction, attackTargets, canAttack, startGame, validateAction } from './game';
import { b, h, hero, m, mkState } from './test-utils';
import type { GameAction, GameState, LogEvent } from './types';

const act = (s: GameState, ...actions: GameAction[]) => {
  let state = s;
  const log: LogEvent[] = [];
  for (const a of actions) {
    const r = applyAction(state, a);
    state = r.state;
    log.push(...r.log);
  }
  return { state, log };
};
const names = (s: GameState, side: 0 | 1) => s.players[side].board.map((x) => x.defId);
const effects = (log: LogEvent[]) => log.flatMap((e) => (e.type === 'effect' ? [e.name] : []));
const stats = (s: GameState, uid: string) => statsOf(s, uid, computeAuras(s))!;

describe('turnos e Merenda', () => {
  it('quem começa tem 3 cartas; o segundo tem 4 + Troco; Merenda cresce 1 por turno até 10', () => {
    const deck = Array.from({ length: 30 }, () => 'filho');
    let { state } = startGame(deck, deck, 'vo-cida', 'zeca-do-grau', 1);
    expect(state.turn).toBe(1);
    expect(state.players[0].hand).toHaveLength(4); // 3 + compra do turno
    expect(state.players[1].hand.map((c) => c.defId)).toContain('troco');
    expect(state.players[0].merenda).toBe(1);
    for (let i = 0; i < 25; i++) state = act(state, { type: 'end' }).state;
    expect(state.players[state.active].maxMerenda).toBe(10);
  });

  it('Troco da Merenda dá +1 neste turno', () => {
    const s = mkState({ a: { hand: ['troco'], merenda: 2 } });
    expect(act(s, { type: 'play', uid: h(0, 0) }).state.players[0].merenda).toBe(3);
  });

  it('deck vazio: Cansaço crescente no herói', () => {
    let s = mkState({ active: 1 });
    s = act(s, { type: 'end' }).state; // começa o turno do lado 0 sem cartas
    expect(s.players[0].hero.hp).toBe(29);
    s = act(s, { type: 'end' }, { type: 'end' }).state;
    expect(s.players[0].hero.hp).toBe(27);
  });

  it('mão cheia (10): a carta comprada vai pro lixo', () => {
    let s = mkState({ active: 1, a: { hand: Array(10).fill('filho'), deck: ['mae'] } });
    s = act(s, { type: 'end' }).state;
    expect(s.players[0].hand).toHaveLength(10);
    expect(s.players[0].discard.map((c) => c.defId)).toEqual(['mae']);
  });

  it('não dá para jogar sem Merenda', () => {
    const s = mkState({ a: { hand: ['mae'], merenda: 3 } });
    expect(validateAction(s, { type: 'play', uid: h(0, 0) })).toMatch(/Merenda/);
  });

  it('mesa cheia com 7', () => {
    const s = mkState({ a: { board: Array(7).fill('filho'), hand: ['filho'] } });
    expect(validateAction(s, { type: 'play', uid: h(0, 0) })).toMatch(/cheia/);
  });
});

describe('combate', () => {
  it('carta nova não ataca no turno em que entra; a antiga ataca 1 vez', () => {
    const s = act(mkState({ a: { board: ['filho'], hand: ['filho'] } }), { type: 'play', uid: h(0, 0) }).state;
    expect(canAttack(s, s.players[0].board[1].uid)).toBe(false);
    const after = act(s, { type: 'attack', attacker: b(0, 0), target: hero(1) }).state;
    expect(after.players[1].hero.hp).toBe(29);
    expect(canAttack(after, b(0, 0))).toBe(false);
  });

  it('dano é dos dois lados ao mesmo tempo; herói não revida', () => {
    const s = act(mkState({ a: { board: ['vo'] }, b: { board: ['mandrake'] } }), {
      type: 'attack',
      attacker: b(0, 0),
      target: m(b(1, 0)),
    }).state;
    // Mandrake tem Capacete: a Vó não causa dano, mas toma 3.
    expect(s.players[0].board[0].damage).toBe(3);
    expect(s.players[1].board[0].damage).toBe(0);
    expect(s.players[1].board[0].shield).toBe(false);
  });

  it('Provocar: só dá para atacar quem tem Provocar', () => {
    const s = mkState({ a: { board: ['vo'] }, b: { board: ['pudim', 'filtro-de-barro'] } });
    expect(attackTargets(s, b(0, 0))).toEqual([m(b(1, 1))]);
    expect(validateAction(s, { type: 'attack', attacker: b(0, 0), target: hero(1) })).toMatch(/Provocar/);
  });

  it('herói com Moral 0 perde', () => {
    const s = act(mkState({ a: { board: ['vo'] }, b: { hp: 2 } }), { type: 'attack', attacker: b(0, 0), target: hero(1) }).state;
    expect(s.winner).toBe(0);
  });
});

describe('poder do herói', () => {
  it('Vó Cida: Cafuné cura 2; só 1 vez por turno; custa 2', () => {
    const s0 = mkState({ a: { board: ['vo'], merenda: 5 } });
    s0.players[0].board[0].damage = 3;
    const { state } = act(s0, { type: 'power', target: m(b(0, 0)) });
    expect(state.players[0].board[0].damage).toBe(1);
    expect(state.players[0].merenda).toBe(3);
    expect(validateAction(state, { type: 'power', target: m(b(0, 0)) })).toMatch(/usado/);
  });

  it('Zeca do Grau: Buzinada causa 1', () => {
    const s = act(mkState({ active: 1 }), { type: 'power', target: hero(0) }).state;
    expect(s.players[0].hero.hp).toBe(29);
  });
});

describe('Família', () => {
  it('Vó: parentes vizinhos ganham +1/+1 permanente', () => {
    const s = act(mkState({ a: { board: ['filho', 'moto'], hand: ['vo'] } }), { type: 'play', uid: h(0, 0), position: 1 }).state;
    expect(names(s, 0)).toEqual(['filho', 'vo', 'moto']);
    expect(stats(s, b(0, 0))).toMatchObject({ power: 2, toughness: 3 });
    expect(stats(s, b(0, 1))).toMatchObject({ power: 2, toughness: 1 }); // Moto não é parente
  });

  it('Mãe: Chinelo Teleguiado quando um Filho entra', () => {
    const s = mkState({ a: { board: ['mae'], hand: ['filho', 'filho'] }, b: { hp: 30 } });
    const { log } = act(s, { type: 'play', uid: h(0, 0) }, { type: 'play', uid: h(0, 1) });
    expect(effects(log).filter((n) => n === 'Chinelo Teleguiado')).toHaveLength(2);
  });

  it('Mãe: Vira-lata conta como Filho', () => {
    const { log } = act(mkState({ a: { board: ['mae'], hand: ['vira-lata-caramelo'] } }), { type: 'play', uid: h(0, 0) });
    expect(effects(log)).toContain('Chinelo Teleguiado');
  });

  it('Mãe + Várzea: "Pra dentro, agora!" manda os jogadores dos dois lados para a mão', () => {
    const s = act(mkState({ a: { board: ['craque-da-varzea'], hand: ['mae'] }, b: { board: ['craque-da-varzea'] } }), {
      type: 'play',
      uid: h(0, 0),
    }).state;
    expect(names(s, 0)).toEqual(['mae']);
    expect(names(s, 1)).toEqual([]);
    expect(s.players[1].hand.map((c) => c.defId)).toContain('craque-da-varzea');
  });

  it('Tio do Pavê: com Sobremesa, uma carta inimiga perde 2 de Força', () => {
    const s = act(mkState({ a: { board: ['pudim'], hand: ['tio-do-pave'] }, b: { board: ['mae'] } }), {
      type: 'play',
      uid: h(0, 0),
      target: m(b(1, 0)),
    }).state;
    expect(stats(s, b(1, 0)).power).toBe(1);
  });

  it('Tio do Pavê: sem Sobremesa não pede alvo', () => {
    const s = mkState({ a: { hand: ['tio-do-pave'] }, b: { board: ['mae'] } });
    expect(validateAction(s, { type: 'play', uid: h(0, 0) })).toBeNull();
  });

  it('Chinelada: 2 de dano em qualquer alvo', () => {
    const s = act(mkState({ a: { hand: ['chinelada'] } }), { type: 'play', uid: h(0, 0), target: hero(1) }).state;
    expect(s.players[1].hero.hp).toBe(28);
  });
});

describe('Cozinha', () => {
  it('Filtro de Barro: fim do turno cura 1 nas vizinhas; com Vó cura 2 e ganha +2 Resistência', () => {
    const s0 = mkState({ a: { board: ['moto', 'filtro-de-barro', 'vo'] } });
    expect(stats(s0, b(0, 1)).toughness).toBe(6);
    s0.players[0].board[2].damage = 3;
    const s = act(s0, { type: 'end' }).state;
    expect(s.players[0].board[2].damage).toBe(1);
  });

  it('Pudim: fim do turno cura 1 em si mesmo', () => {
    const s0 = mkState({ a: { board: ['pudim'] } });
    s0.players[0].board[0].damage = 2;
    expect(act(s0, { type: 'end' }).state.players[0].board[0].damage).toBe(1);
  });

  it('Panela de Pressão: explode no fim do 3º turno em jogo', () => {
    let s = mkState({ turn: 1, a: { hand: ['panela-de-pressao'], board: ['mae'] }, b: { board: ['vo', 'filho'] } });
    s = act(s, { type: 'play', uid: h(0, 0) }, { type: 'end' }, { type: 'end' }, { type: 'end' }).state;
    expect(names(s, 0)).toContain('panela-de-pressao');
    const { state, log } = act(s, { type: 'end' }, { type: 'end' });
    expect(effects(log)).toContain('Explodiu!');
    expect(names(state, 0)).toEqual(['mae']);
    expect(names(state, 1)).toEqual(['vo']); // Filho (2) morreu, Vó (4) aguentou
  });

  it('Faxina de Sábado: 2 de dano em todas as inimigas', () => {
    const s = act(mkState({ a: { hand: ['faxina-de-sabado'] }, b: { board: ['filho', 'vo', 'pombo'] } }), {
      type: 'play',
      uid: h(0, 0),
    }).state;
    expect(names(s, 1)).toEqual(['vo']);
  });

  it('Hora do Lanche: compra 2', () => {
    const s = act(mkState({ a: { hand: ['hora-do-lanche'], deck: ['vo', 'mae', 'filho'] } }), { type: 'play', uid: h(0, 0) }).state;
    expect(s.players[0].hand.map((c) => c.defId)).toEqual(['vo', 'mae']);
  });
});

describe('Rua', () => {
  it('Moto tem Pressa: ataca no turno em que entra', () => {
    const s = act(mkState({ a: { hand: ['moto'] } }), { type: 'play', uid: h(0, 0) }).state;
    expect(canAttack(s, h(0, 0))).toBe(true);
  });

  it('Mandrake + Moto: +2 Força e Grau (ignora Provocar) neste turno', () => {
    const s = act(mkState({ a: { board: ['moto'], hand: ['mandrake'] }, b: { board: ['filtro-de-barro'] } }), {
      type: 'play',
      uid: h(0, 0),
    }).state;
    expect(stats(s, b(0, 0)).power).toBe(4);
    const after = act(s, { type: 'attack', attacker: b(0, 0), target: hero(1) }).state;
    expect(after.players[1].hero.hp).toBe(26);
    // No fim do turno o grau acaba.
    const next = act(after, { type: 'end' }).state;
    expect(stats(next, b(0, 0)).power).toBe(2);
  });

  it('Vendedor de Pamonha: espia a mão do oponente no início do turno', () => {
    const s = act(mkState({ active: 1, a: { board: ['vendedor-de-pamonha'] }, b: { hand: ['saci'] } }), { type: 'end' }).state;
    expect(s.players[0].peek).toBe('saci');
  });
});

describe('Folclore', () => {
  it('Saci: à Noite, devolve uma inimiga de custo ≤ 3 para a mão', () => {
    const s = act(mkState({ turn: 3, a: { hand: ['saci'] }, b: { board: ['mae', 'vo'] } }), { type: 'play', uid: h(0, 0) }).state;
    expect(names(s, 1)).toEqual(['mae']);
    expect(s.players[1].hand.map((c) => c.defId)).toEqual(['vo']);
  });

  it('Saci: de Dia não faz nada', () => {
    const s = act(mkState({ turn: 5, a: { hand: ['saci'] }, b: { board: ['vo'] } }), { type: 'play', uid: h(0, 0) }).state;
    expect(names(s, 1)).toEqual(['vo']);
  });

  it('Curupira: à Noite não pode ser atacado', () => {
    const night = mkState({ turn: 3, a: { board: ['vo'] }, b: { board: ['curupira'] } });
    expect(attackTargets(night, b(0, 0))).toEqual([hero(1)]);
    const day = mkState({ turn: 5, a: { board: ['vo'] }, b: { board: ['curupira'] } });
    expect(attackTargets(day, b(0, 0))).toHaveLength(2);
  });
});

describe('Lendas Urbanas', () => {
  it('Loira do Banheiro: entra de graça quando o oponente joga a 3ª carta no turno', () => {
    const s = act(
      mkState({ a: { hand: ['filho', 'filho', 'pudim'] }, b: { hand: ['loira-do-banheiro'] } }),
      { type: 'play', uid: h(0, 0) },
      { type: 'play', uid: h(0, 1) },
    ).state;
    expect(names(s, 1)).toEqual([]);
    const after = act(s, { type: 'play', uid: h(0, 2) }).state;
    expect(names(after, 1)).toEqual(['loira-do-banheiro']);
    expect(after.players[1].hand).toHaveLength(0);
  });

  it('Homem do Saco + Mãe: Filhos ganham +2 Resistência e Provocar', () => {
    const s = mkState({ a: { board: ['homem-do-saco', 'mae', 'filho'] } });
    expect(stats(s, b(0, 2))).toMatchObject({ toughness: 4 });
    expect(stats(s, b(0, 2)).keywords).toContain('provocar');
  });

  it('Assombração na Janela: devolve uma inimiga para a mão', () => {
    const s = act(mkState({ a: { hand: ['assombracao-na-janela'] }, b: { board: ['mae'] } }), {
      type: 'play',
      uid: h(0, 0),
      target: m(b(1, 0)),
    }).state;
    expect(s.players[1].hand.map((c) => c.defId)).toEqual(['mae']);
  });
});

describe('Escola', () => {
  it('Merendeira + Tia da Cantina: Repeteco repete a Chegada de outra carta', () => {
    const s0 = mkState({ a: { board: ['tia-da-cantina'], hand: ['merendeira'], hp: 20 } });
    const { state, log } = act(s0, { type: 'play', uid: h(0, 0) });
    expect(effects(log)).toContain('Repeteco');
    expect(state.players[0].hero.hp).toBe(22); // Salgadinho da Tia repetido
  });

  it('Inspetor: de Dia manda uma inimiga de custo ≤ 3 para a Diretoria; ela perde o turno e volta', () => {
    let s = act(mkState({ turn: 5, a: { hand: ['inspetor'] }, b: { board: ['vo'] } }), {
      type: 'play',
      uid: h(0, 0),
      target: m(b(1, 0)),
    }).state;
    expect(names(s, 1)).toEqual([]);
    s = act(s, { type: 'end' }).state; // turno do dono: a Vó está fora
    expect(names(s, 1)).toEqual([]);
    s = act(s, { type: 'end' }).state; // no fim desse turno ela volta
    expect(names(s, 1)).toEqual(['vo']);
  });

  it('Inspetor: não aceita alvo de custo 4+', () => {
    const s = mkState({ turn: 5, a: { hand: ['inspetor'] }, b: { board: ['mae'] } });
    expect(validateAction(s, { type: 'play', uid: h(0, 0) })).toBeNull(); // sem alvo válido, não pede alvo
  });

  it('Vira-lata nunca vai para a Diretoria', () => {
    const s = act(mkState({ turn: 5, a: { hand: ['inspetor'] }, b: { board: ['vira-lata-caramelo'] } }), {
      type: 'play',
      uid: h(0, 0),
      target: m(b(1, 0)),
    }).state;
    expect(names(s, 1)).toEqual(['vira-lata-caramelo']);
  });

  it('Tapa: vira a carta (perde efeitos e Provocar) e causa 1 de dano', () => {
    const s = act(mkState({ a: { hand: ['tapa'] }, b: { board: ['filtro-de-barro'] } }), {
      type: 'play',
      uid: h(0, 0),
      target: m(b(1, 0)),
    }).state;
    expect(stats(s, b(1, 0)).keywords).not.toContain('provocar');
    expect(s.players[1].board[0].damage).toBe(1);
  });
});

describe('Várzea e Bichos', () => {
  it('Craque da Várzea: +1/+1 para cada outro jogador do seu lado', () => {
    const s = act(mkState({ a: { board: ['craque-da-varzea'], hand: ['pelada-no-campinho'] } }), { type: 'play', uid: h(0, 0) }).state;
    expect(names(s, 0)).toEqual(['craque-da-varzea', 'moleque-da-varzea', 'moleque-da-varzea']);
    expect(stats(s, b(0, 0))).toMatchObject({ power: 4, toughness: 4 });
  });

  it('Pombo: se o oponente gastar toda a Merenda, +1 no seu próximo turno', () => {
    const s = act(mkState({ a: { hand: ['vo'], merenda: 3 }, b: { board: ['pombo'] } }), { type: 'play', uid: h(0, 0) }, { type: 'end' })
      .state;
    expect(s.players[1].merenda).toBe(s.players[1].maxMerenda + 1);
  });
});

describe('partida completa', () => {
  it('é determinística e não muta o estado recebido', () => {
    const deck = Array.from({ length: 30 }, (_, i) => (i % 2 ? 'mae' : 'filho'));
    const { state } = startGame(deck, deck, 'vo-cida', 'zeca-do-grau', 99);
    const before = JSON.stringify(state);
    const a = applyAction(state, { type: 'end' });
    const b2 = applyAction(state, { type: 'end' });
    expect(JSON.stringify(state)).toBe(before);
    expect(a).toEqual(b2);
  });
});
