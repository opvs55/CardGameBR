// Roda a migração e o seed num Postgres em memória (PGlite) com um "auth" mínimo
// imitando o Supabase, e confere as regras de acesso (RLS) e o pacotinho.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { CARDS } from '../src/engine/cards';

const dir = import.meta.dirname;

// O mínimo do Supabase que a migração usa: papéis, auth.users, auth.uid() e os
// privilégios padrão que o Supabase dá para tabelas novas no schema public.
const SUPABASE_STUB = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';

let db: PGlite;

async function as<T>(user: string | null, role: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${user ?? ''}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

const pack = (items: [string, string][]) =>
  JSON.stringify(items.map(([card_id, rarity]) => ({ card_id, rarity })));

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of readdirSync(join(dir, 'migrations')).sort()) {
    await db.exec(readFileSync(join(dir, 'migrations', f), 'utf8'));
  }
  await db.exec(readFileSync(join(dir, 'seed.sql'), 'utf8'));
  await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}');`);
});

describe('banco', () => {
  it('seed tem as 20 cartas e é público', async () => {
    const r = await as(null, 'anon', () => db.query<{ n: number }>('select count(*)::int as n from public.cards'));
    expect(r.rows[0].n).toBe(CARDS.length);
    const mae = await db.query<{ effects: unknown[] }>(`select effects from public.cards where id = 'mae'`);
    expect(mae.rows[0].effects).toEqual(CARDS.find((c) => c.id === 'mae')!.effects);
  });

  it('seed pode rodar de novo sem erro', async () => {
    await db.exec(readFileSync(join(dir, 'seed.sql'), 'utf8'));
  });

  it('cadastro cria o perfil com 500 moedas', async () => {
    const r = await db.query<{ coins: number }>(`select coins from public.profiles where id = '${A}'`);
    expect(r.rows[0].coins).toBe(500);
  });

  it('grant_pack desconta as moedas e grava as figurinhas; Carimbada ganha número de série', async () => {
    const rows = await as(null, 'service_role', () =>
      db.query<{ serial: number | null; rarity: string }>(
        `select * from public.grant_pack('${A}', 100, $1::jsonb)`,
        [pack([['vo', 'carimbada'], ['vo', 'carimbada'], ['mae', 'comum'], ['pudim', 'brilhante'], ['moto', 'comum']])],
      ),
    );
    expect(rows.rows).toHaveLength(5);
    expect(rows.rows.filter((r) => r.rarity === 'carimbada').map((r) => r.serial)).toEqual([1, 2]);
    expect(rows.rows.filter((r) => r.rarity !== 'carimbada').every((r) => r.serial === null)).toBe(true);
    const coins = await db.query<{ coins: number }>(`select coins from public.profiles where id = '${A}'`);
    expect(coins.rows[0].coins).toBe(400);
  });

  it('grant_pack sem moedas suficientes não grava nada', async () => {
    await expect(
      as(null, 'service_role', () => db.query(`select * from public.grant_pack('${B}', 9999, $1::jsonb)`, [pack([['vo', 'comum']])])),
    ).rejects.toThrow(/moedas insuficientes/);
    const r = await db.query<{ n: number }>(`select count(*)::int as n from public.user_cards where user_id = '${B}'`);
    expect(r.rows[0].n).toBe(0);
  });

  it('jogador não pode chamar grant_pack', async () => {
    await expect(
      as(A, 'authenticated', () => db.query(`select * from public.grant_pack('${A}', 0, $1::jsonb)`, [pack([['vo', 'carimbada']])])),
    ).rejects.toThrow(/permission denied/);
  });

  it('cada um só vê a própria coleção e o próprio perfil', async () => {
    const mine = await as(A, 'authenticated', () => db.query('select * from public.user_cards'));
    expect(mine.rows).toHaveLength(5);
    const theirs = await as(B, 'authenticated', () => db.query('select * from public.user_cards'));
    expect(theirs.rows).toHaveLength(0);
    const profiles = await as(B, 'authenticated', () => db.query<{ id: string }>('select id from public.profiles'));
    expect(profiles.rows.map((r) => r.id)).toEqual([B]);
  });

  it('jogador muda o nome mas não as moedas', async () => {
    await as(A, 'authenticated', () => db.query(`update public.profiles set username = 'vo_do_bafo' where id = '${A}'`));
    await expect(
      as(A, 'authenticated', () => db.query(`update public.profiles set coins = 999999 where id = '${A}'`)),
    ).rejects.toThrow(/permission denied/);
    const r = await db.query<{ username: string; coins: number }>(`select username, coins from public.profiles where id = '${A}'`);
    expect(r.rows[0]).toEqual({ username: 'vo_do_bafo', coins: 400 });
  });

  it('não dá para colocar carta de outra pessoa no seu deck', async () => {
    const card = (await db.query<{ id: string }>(`select id from public.user_cards where user_id = '${A}' limit 1`)).rows[0].id;
    const deck = await as(B, 'authenticated', () =>
      db.query<{ id: string }>(`insert into public.decks (user_id, name) values ('${B}', 'Pirata') returning id`),
    );
    await expect(
      as(B, 'authenticated', () =>
        db.query(`insert into public.deck_cards (deck_id, user_card_id) values ('${deck.rows[0].id}', '${card}')`),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('heróis são públicos; fichas ficam fora dos pacotinhos', async () => {
    const heroes = await as(null, 'anon', () => db.query<{ n: number }>('select count(*)::int as n from public.heroes'));
    expect(heroes.rows[0].n).toBe(2);
    const tokens = await db.query<{ id: string }>('select id from public.cards where not collectible order by id');
    expect(tokens.rows.map((r) => r.id)).toEqual(['moleque-da-varzea', 'troco']);
  });

  it('partida: jogadores veem o andamento, mas não o estado completo (mão do outro)', async () => {
    const m = await db.query<{ id: string }>(
      `insert into public.matches (player_a, player_b, seed, state) values ('${A}', '${B}', 1, '{"segredo": true}') returning id`,
    );
    const id = m.rows[0].id;
    await db.exec(`insert into public.match_actions (match_id, seq, player, action) values ('${id}', 1, '${A}', '{"type":"end"}');`);
    const seen = await as(B, 'authenticated', () => db.query<{ turn: number }>('select id, turn, active, status from public.matches'));
    expect(seen.rows).toHaveLength(1);
    await expect(as(B, 'authenticated', () => db.query('select state from public.matches'))).rejects.toThrow(/permission denied/);
    const actions = await as(B, 'authenticated', () => db.query('select seq from public.match_actions'));
    expect(actions.rows).toHaveLength(1);
    const outsider = '00000000-0000-0000-0000-00000000000c';
    await db.exec(`insert into auth.users (id) values ('${outsider}');`);
    const none = await as(outsider, 'authenticated', () => db.query('select id from public.matches'));
    expect(none.rows).toHaveLength(0);
  });
});
