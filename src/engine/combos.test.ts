import { describe, expect, it } from 'vitest';
import { computeAuras, statsAt } from './effects';
import { resolveRound } from './round';
import { mkState, mv } from './test-utils';
import type { LogEvent } from './types';

const texts = (log: LogEvent[]) => log.map((e) => e.text);
const effects = (log: LogEvent[]) => log.flatMap((e) => (e.type === 'effect' ? [e.name] : []));
const row = (s: ReturnType<typeof mkState>, side: 0 | 1) => s.players[side].row.map((c) => c?.defId ?? null);

describe('Filtro de Barro', () => {
  it('cura 1 nas vizinhas no fim da rodada', () => {
    const s = mkState({ a: { row: ['pudim', 'filtro-de-barro', 'moto'] } });
    s.players[0].row[0]!.damage = 2;
    s.players[0].row[2]!.damage = 1;
    const { state } = resolveRound(s, mv(0), mv(1));
    // Pudim cura 1 em si + 1 do filtro = 0 de dano; Moto cura 1 = 0.
    expect(state.players[0].row[0]!.damage).toBe(0);
    expect(state.players[0].row[2]!.damage).toBe(0);
  });

  it('com Vó na fileira: Tapetinho de Crochê cura 2 e dá +2 Resistência', () => {
    const s = mkState({ a: { row: ['moto', 'filtro-de-barro', 'vo'] } });
    expect(statsAt(s, 0, 1)!.toughness).toBe(6);
    s.players[0].row[0]!.damage = 1; // Moto 2/2 com 1 de dano
    s.players[0].row[2]!.damage = 3; // Vó 1/5 com 3 de dano
    const { state, log } = resolveRound(s, mv(0), mv(1));
    expect(effects(log)).toContain('Tapetinho de Crochê');
    expect(state.players[0].row[0]!.damage).toBe(0);
    expect(state.players[0].row[2]!.damage).toBe(1);
  });

  it('sem Vó não tem +2 Resistência', () => {
    const s = mkState({ a: { row: ['filtro-de-barro'] } });
    expect(statsAt(s, 0, 0)!.toughness).toBe(4);
  });
});

describe('Vó', () => {
  it('Parentesco: parentes vizinhos +1/+1 na rodada em que ela entra', () => {
    // Filho (1/2) na carteira 1, inimigo Moto (2/2) na frente dele.
    const s = mkState({ a: { row: [null, 'filho'], hand: ['vo'] }, b: { row: [null, 'moto'] } });
    const { state, log } = resolveRound(s, mv(0, [[0, 0]]), mv(1));
    expect(effects(log)).toContain('Parentesco');
    // Filho com 2 de Força mata a Moto; Filho 1/3 aguenta os 2 de dano.
    expect(row(state, 1)[1]).toBeNull();
    expect(row(state, 0)[1]).toBe('filho');
    // O buff acaba no fim da rodada.
    expect(statsAt(state, 0, 1)!.power).toBe(1);
  });

  it('não dá buff em quem não é parente', () => {
    const s = mkState({ a: { row: [null, 'moto'], hand: ['vo'] } });
    const { log } = resolveRound(s, mv(0, [[0, 0]]), mv(1));
    expect(log.some((e) => e.type === 'buff')).toBe(false);
  });
});

describe('Mãe', () => {
  it('Chinelo Teleguiado quando um Filho entra na fileira', () => {
    const s = mkState({ a: { row: ['mae'], hand: ['filho'] }, b: { row: [null, null, null, null, 'vo'] } });
    const { log, state } = resolveRound(s, mv(0, [[0, 2]]), mv(1));
    expect(effects(log)).toContain('Chinelo Teleguiado');
    expect(state.players[1].row[4]!.damage).toBe(3);
  });

  it('1 chinelo por Filho', () => {
    const s = mkState({ a: { row: ['mae'], hand: ['filho', 'filho'] }, b: { row: ['curupira'] } });
    const { log } = resolveRound(s, mv(0, [[0, 1], [1, 2]]), mv(1));
    expect(effects(log).filter((n) => n === 'Chinelo Teleguiado')).toHaveLength(2);
  });

  it('funciona quando Mãe e Filho entram na mesma rodada (Mãe tem mais Pressa)', () => {
    const s = mkState({ a: { hand: ['mae', 'filho'] }, b: { row: [null, null, null, null, 'vo'] } });
    const { log } = resolveRound(s, mv(0, [[0, 0], [1, 1]]), mv(1));
    expect(effects(log)).toContain('Chinelo Teleguiado');
  });

  it('Filho que levou Tapa não ativa o chinelo', () => {
    const s = mkState({ a: { row: ['mae'], hand: ['filho'] }, b: { row: [null, null, null, null, 'vo'] } });
    const { log } = resolveRound(s, mv(0, [[0, 2]]), mv(1, [], 2));
    expect(log.some((e) => e.type === 'tapaHit')).toBe(true);
    expect(effects(log)).not.toContain('Chinelo Teleguiado');
  });

  it('Mãe + Várzea: "Pra dentro, agora!" manda os jogadores de várzea dos dois lados para a mão', () => {
    const s = mkState({
      a: { row: [null, 'craque-da-varzea'], hand: ['mae'] },
      b: { row: ['craque-da-varzea'] },
    });
    const { state, log } = resolveRound(s, mv(0, [[0, 4]]), mv(1));
    expect(effects(log)).toContain('Pra dentro, agora!');
    expect(row(state, 0)).not.toContain('craque-da-varzea');
    expect(row(state, 1)).not.toContain('craque-da-varzea');
    expect(state.players[0].hand.map((c) => c.defId)).toContain('craque-da-varzea');
    expect(state.players[1].hand.map((c) => c.defId)).toContain('craque-da-varzea');
  });

  it('Mãe com só 1 jogador de várzea não faz nada', () => {
    const s = mkState({ a: { hand: ['mae'] }, b: { row: ['craque-da-varzea'] } });
    const { log } = resolveRound(s, mv(0, [[0, 4]]), mv(1));
    expect(effects(log)).not.toContain('Pra dentro, agora!');
  });
});

describe('Tapa', () => {
  it('acertou: a carta fica virada e briga como 1/1', () => {
    const s = mkState({ a: { hand: ['curupira'] }, b: { row: ['moto'] } });
    const { state, log } = resolveRound(s, mv(0, [[0, 0]]), mv(1, [], 0));
    expect(log.some((e) => e.type === 'tapaHit')).toBe(true);
    // Curupira virada (1/1) toma 2 da Moto e morre; Moto toma só 1.
    expect(row(state, 0)[0]).toBeNull();
    expect(state.players[1].row[0]!.damage).toBe(1);
    expect(state.players[1].tapas).toBe(2);
  });

  it('errou: perde o Tapa e o oponente ganha +1 Merenda na próxima rodada', () => {
    const s = mkState({ round: 3, a: { deck: ['pudim'] }, b: { deck: ['pudim'] } });
    const { state, log } = resolveRound(s, mv(0), mv(1, [], 3));
    expect(log.some((e) => e.type === 'tapaMiss')).toBe(true);
    expect(state.players[1].tapas).toBe(2);
    expect(state.players[0].merenda).toBe(5);
    expect(state.players[1].merenda).toBe(4);
  });

  it('não dá para usar Tapa sem Tapas', () => {
    const s = mkState({ a: { hand: ['moto'] }, b: { tapas: 0 } });
    const { log } = resolveRound(s, mv(0, [[0, 0]]), mv(1, [], 0));
    expect(log.some((e) => e.type === 'tapaHit' || e.type === 'tapaMiss')).toBe(false);
  });
});

describe('Tio do Pavê', () => {
  it('com Sobremesa na fileira, inimigos à frente e vizinhos perdem 1 Força', () => {
    const s = mkState({
      a: { row: ['pudim', null, 'tio-do-pave'] },
      b: { row: ['moto', 'moto', 'moto', 'moto', 'moto'] },
    });
    const auras = computeAuras(s);
    expect([0, 1, 2, 3, 4].map((i) => statsAt(s, 1, i, auras)!.power)).toEqual([2, 1, 1, 1, 2]);
  });

  it('sem Sobremesa não acontece nada', () => {
    const s = mkState({ a: { row: [null, null, 'tio-do-pave'] }, b: { row: [null, null, 'moto'] } });
    expect(statsAt(s, 1, 2)!.power).toBe(2);
  });
});

describe('Pudim', () => {
  it('a cura do fim da rodada vem antes da limpeza: sobrevive a dano letal', () => {
    const s = mkState({ a: { row: ['pudim'] }, b: { row: ['curupira'] } });
    const { state } = resolveRound(s, mv(0), mv(1));
    expect(state.players[0].row[0]!.damage).toBe(2);
  });

  it('cura 1 em si mesmo no fim da rodada', () => {
    const s = mkState({ a: { row: ['pudim'] }, b: { row: ['filho'] } });
    const { state } = resolveRound(s, mv(0), mv(1));
    // Toma 1 do Filho e cura 1.
    expect(state.players[0].row[0]!.damage).toBe(0);
  });
});

describe('Mandrake', () => {
  it('com Moto na fileira: a Moto bate direto na Moral', () => {
    const s = mkState({ a: { row: [null, 'moto'], hand: ['mandrake'] }, b: { row: [null, 'vo'] } });
    const { state, log } = resolveRound(s, mv(0, [[0, 0]]), mv(1));
    expect(effects(log)).toContain('Grau');
    // Moto (2) direto + Mandrake (2) sem ninguém na frente = 4.
    expect(state.players[1].moral).toBe(16);
    expect(state.players[1].row[1]!.damage).toBe(0);
  });

  it('sem Moto não faz nada', () => {
    const s = mkState({ a: { hand: ['mandrake'] } });
    const { log } = resolveRound(s, mv(0, [[0, 0]]), mv(1));
    expect(effects(log)).not.toContain('Grau');
  });
});

describe('Vendedor de Pamonha', () => {
  it('Carro de som: espia 1 carta da mão do oponente no início da rodada', () => {
    const s = mkState({ a: { row: ['vendedor-de-pamonha'] }, b: { hand: ['saci'] } });
    const { state } = resolveRound(s, mv(0), mv(1));
    expect(state.players[0].peek).toBe('saci');
  });
});

describe('Saci', () => {
  it('à Noite, Redemoinho troca duas cartas inimigas antes da briga', () => {
    const s = mkState({ round: 2, a: { row: ['saci'] }, b: { row: [null, 'vo', null, 'pudim'] } });
    const { state, log } = resolveRound(s, mv(0), mv(1));
    expect(log.some((e) => e.type === 'swap')).toBe(true);
    expect(row(state, 1)[1]).toBe('pudim');
    expect(row(state, 1)[3]).toBe('vo');
  });

  it('de Dia não faz nada', () => {
    const s = mkState({ round: 1, a: { row: ['saci'] }, b: { row: [null, 'vo', null, 'pudim'] } });
    const { log } = resolveRound(s, mv(0), mv(1));
    expect(log.some((e) => e.type === 'swap')).toBe(false);
  });
});

describe('Curupira', () => {
  it('à Noite, as brigas do lado dele são com a carteira i+1', () => {
    const s = mkState({ round: 2, a: { row: ['curupira'] }, b: { row: ['pudim', 'vo'] } });
    const { state } = resolveRound(s, mv(0), mv(1));
    // Curupira (3) acerta a Vó (carteira 1), não o Pudim.
    expect(state.players[1].row[1]!.damage).toBe(3);
    expect(state.players[1].row[0]!.damage).toBe(0);
  });

  it('a carta da ponta bate direto na Moral', () => {
    const s = mkState({ round: 2, a: { row: ['curupira', null, null, null, 'moto'] }, b: { row: [null, null, null, null, 'vo'] } });
    const { state } = resolveRound(s, mv(0), mv(1));
    // Curupira na 0 mira a 1 (vazia) = 3; Moto na 4 sai da mesa = 2.
    expect(state.players[1].moral).toBe(15);
  });

  it('de Dia briga normal', () => {
    const s = mkState({ round: 1, a: { row: ['curupira'] }, b: { row: ['filho', 'vo'] } });
    const { state } = resolveRound(s, mv(0), mv(1));
    expect(row(state, 1)[0]).toBeNull();
    expect(state.players[1].row[1]!.damage).toBe(0);
  });
});

describe('Loira do Banheiro', () => {
  it('Boato: entra de graça se o oponente revelar 2 cartas e usar Tapa', () => {
    const s = mkState({ a: { hand: ['loira-do-banheiro'], merenda: 0 }, b: { hand: ['filho', 'pombo'] } });
    const { state, log } = resolveRound(s, mv(0), mv(1, [[0, 0], [1, 1]], 3));
    expect(effects(log)).toContain('Boato');
    expect(row(state, 0)).toContain('loira-do-banheiro');
    expect(state.players[0].hand).toHaveLength(0);
  });

  it('não entra se o oponente só jogou 2 cartas sem Tapa', () => {
    const s = mkState({ a: { hand: ['loira-do-banheiro'], merenda: 0 }, b: { hand: ['filho', 'pombo'] } });
    const { state } = resolveRound(s, mv(0), mv(1, [[0, 0], [1, 1]]));
    expect(row(state, 0)).not.toContain('loira-do-banheiro');
  });
});

describe('Homem do Saco', () => {
  it('com Mãe: Filhos +2 Resistência e ele não briga', () => {
    const s = mkState({ a: { row: ['homem-do-saco', 'mae', 'filho'] }, b: { row: ['moto'] } });
    expect(statsAt(s, 0, 2)!.toughness).toBe(4);
    const { state } = resolveRound(s, mv(0), mv(1));
    // Homem do Saco não dá nem toma dano da Moto.
    expect(state.players[0].row[0]!.damage).toBe(0);
    expect(state.players[1].row[0]!.damage).toBe(0);
  });

  it('sem Mãe briga normal', () => {
    const s = mkState({ a: { row: ['homem-do-saco'] }, b: { row: ['moto'] } });
    const { state } = resolveRound(s, mv(0), mv(1));
    expect(row(state, 1)[0]).toBeNull();
  });
});

describe('Merendeira + Tia da Cantina', () => {
  it('Repeteco: repete o efeito de entrada da Vó', () => {
    const s = mkState({ a: { row: [null, 'filho', 'tia-da-cantina'], hand: ['vo', 'merendeira'] } });
    const { log } = resolveRound(s, mv(0, [[0, 0], [1, 3]]), mv(1));
    expect(effects(log)).toContain('Repeteco');
    expect(effects(log).filter((n) => n === 'Parentesco')).toHaveLength(2);
  });

  it('sem Tia da Cantina não tem Repeteco', () => {
    const s = mkState({ a: { row: [null, 'filho'], hand: ['vo', 'merendeira'] } });
    const { log } = resolveRound(s, mv(0, [[0, 0], [1, 3]]), mv(1));
    expect(effects(log)).not.toContain('Repeteco');
  });
});

describe('Inspetor', () => {
  it('de Dia manda uma carta inimiga de custo ≤ 3 para a Diretoria, e ela volta depois', () => {
    const s = mkState({ round: 1, a: { hand: ['inspetor'] }, b: { row: ['curupira', 'moto'] } });
    const r1 = resolveRound(s, mv(0, [[0, 4]]), mv(1));
    expect(row(r1.state, 1)).toEqual(['curupira', null, null, null, null]);
    expect(r1.state.players[1].diretoria).toHaveLength(1);
    // Fica fora a rodada 2 inteira e volta no início da 3.
    const r2 = resolveRound(r1.state, mv(0), mv(1));
    expect(row(r2.state, 1)[1]).toBe('moto');
  });

  it('se a carteira estiver ocupada, volta para a mão', () => {
    const s = mkState({ round: 1, a: { hand: ['inspetor'] }, b: { row: [null, 'moto'], hand: ['pudim'] } });
    const r1 = resolveRound(s, mv(0, [[0, 4]]), mv(1));
    const r2 = resolveRound(r1.state, mv(0), mv(1, [[0, 1]]));
    expect(row(r2.state, 1)[1]).toBe('pudim');
    expect(r2.state.players[1].hand.map((c) => c.defId)).toContain('moto');
  });

  it('Vira-lata Caramelo nunca vai para a Diretoria', () => {
    const s = mkState({ round: 1, a: { hand: ['inspetor'] }, b: { row: ['vira-lata-caramelo'] } });
    const { state } = resolveRound(s, mv(0, [[0, 4]]), mv(1));
    expect(row(state, 1)[0]).toBe('vira-lata-caramelo');
  });

  it('à Noite não faz nada', () => {
    const s = mkState({ round: 2, a: { hand: ['inspetor'] }, b: { row: ['moto'] } });
    const { state } = resolveRound(s, mv(0, [[0, 4]]), mv(1));
    expect(state.players[1].diretoria).toHaveLength(0);
  });
});

describe('Panela de Pressão', () => {
  it('explode no fim da terceira rodada: 4 de dano nas vizinhas e nas inimigas da frente', () => {
    let s = mkState({
      round: 1,
      a: { hand: ['panela-de-pressao'], row: [null, 'vo', null, 'vo'] },
      b: { row: [null, 'vo', 'vo', 'vo', 'vo'] },
    });
    s = resolveRound(s, mv(0, [[0, 2]]), mv(1)).state;
    s = resolveRound(s, mv(0), mv(1)).state;
    expect(row(s, 0)[2]).toBe('panela-de-pressao');
    const { state, log } = resolveRound(s, mv(0), mv(1));
    expect(effects(log)).toContain('Explodiu!');
    expect(row(state, 0)[2]).toBeNull();
    // 2 vizinhas do próprio lado + 3 inimigas da frente.
    expect(log.filter((e) => e.type === 'damage' && e.amount === 4)).toHaveLength(5);
  });
});

describe('Craque da Várzea', () => {
  it('Time: +1/+1 para cada outro jogador vizinho', () => {
    const s = mkState({ a: { row: ['craque-da-varzea', 'craque-da-varzea', 'craque-da-varzea'] } });
    const auras = computeAuras(s);
    expect(statsAt(s, 0, 0, auras)).toMatchObject({ power: 3, toughness: 3 });
    expect(statsAt(s, 0, 1, auras)).toMatchObject({ power: 4, toughness: 4 });
  });
});

describe('Vira-lata Caramelo', () => {
  it('conta como Filho para a Mãe', () => {
    const s = mkState({ a: { row: ['mae'], hand: ['vira-lata-caramelo'] }, b: { row: ['vo'] } });
    const { log } = resolveRound(s, mv(0, [[0, 1]]), mv(1));
    expect(effects(log)).toContain('Chinelo Teleguiado');
  });

  it('conta como Vó para o Filtro de Barro', () => {
    const s = mkState({ a: { row: ['filtro-de-barro', 'vira-lata-caramelo'] } });
    expect(statsAt(s, 0, 0)!.toughness).toBe(6);
  });
});

describe('Pombo', () => {
  it('se o oponente gastar toda a Merenda, rouba 1 dele na próxima rodada', () => {
    const s = mkState({ round: 2, a: { row: ['pombo'] }, b: { hand: ['moto'], merenda: 2 } });
    const { state } = resolveRound(s, mv(0), mv(1, [[0, 0]]));
    expect(state.round).toBe(3);
    expect(state.players[0].merenda).toBe(4);
    expect(state.players[1].merenda).toBe(2);
  });

  it('se sobrou Merenda, não rouba', () => {
    const s = mkState({ round: 2, a: { row: ['pombo'] }, b: { hand: ['filho'], merenda: 2 } });
    const { state } = resolveRound(s, mv(0), mv(1, [[0, 0]]));
    expect(state.players[0].merenda).toBe(3);
  });
});

describe('Briga e vitória', () => {
  it('carteira vazia na frente: dano vai na Moral', () => {
    const s = mkState({ a: { row: ['curupira'] } });
    const { state, log } = resolveRound(s, mv(0), mv(1));
    expect(state.players[1].moral).toBe(17);
    expect(texts(log).some((t) => t.includes('Moral'))).toBe(true);
  });

  it('dano é simultâneo', () => {
    const s = mkState({ a: { row: ['moto'] }, b: { row: ['moto'] } });
    const { state } = resolveRound(s, mv(0), mv(1));
    expect(row(state, 0)[0]).toBeNull();
    expect(row(state, 1)[0]).toBeNull();
  });

  it('Moral zerada perde; os dois zerando juntos é empate', () => {
    const win = resolveRound(mkState({ a: { row: ['curupira'] }, b: { moral: 3 } }), mv(0), mv(1));
    expect(win.state.winner).toBe(0);
    const draw = resolveRound(
      mkState({ a: { row: ['curupira'], moral: 2 }, b: { row: [null, 'moto'], moral: 3 } }),
      mv(0),
      mv(1),
    );
    expect(draw.state.winner).toBe('draw');
  });

  it('Merenda da rodada n é min(n, 10) e não acumula', () => {
    const s = mkState({ round: 10, a: { merenda: 10 } });
    const { state } = resolveRound(s, mv(0), mv(1));
    expect(state.players[0].merenda).toBe(10);
  });

  it('jogada inválida é limpa: carteira ocupada, Merenda insuficiente, mais de 2 cartas', () => {
    const s = mkState({ a: { row: ['moto'], hand: ['vo', 'filho', 'pombo', 'mae'], merenda: 4 } });
    const { state } = resolveRound(s, mv(0, [[0, 0], [0, 1], [1, 2], [2, 3]]), mv(1));
    // Vó na 0 é inválida (ocupada); Vó na 1 (3) + Filho na 2 (1) = 4; Pombo excede as 2 cartas.
    expect(row(state, 0)).toEqual(['moto', 'vo', 'filho', null, null]);
  });
});
