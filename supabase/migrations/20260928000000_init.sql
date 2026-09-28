-- Bafo! — estrutura inicial (seção 11 do design).
-- Cartas e famílias são públicas; coleção, decks e jogadas são só do dono.
-- Moedas e figurinhas só mudam pelo servidor (funções security definer chamadas
-- pelas Edge Functions com a service role).

-- ─────────────────────────── Catálogo ───────────────────────────

create table public.families (
  id text primary key,
  name text not null,
  keyword text,
  ink_1 text,
  ink_2 text,
  bg_shape text
);

create table public.cards (
  id text primary key,
  name text not null,
  family text not null references public.families(id),
  type text not null check (type in ('pessoa', 'objeto', 'veiculo', 'bicho', 'assombracao')),
  tags text[] not null default '{}',
  cost int not null check (cost >= 0),
  power int not null,
  toughness int not null,
  speed int not null,
  text text not null default '',
  flavor text not null default '',
  effects jsonb not null default '[]',
  wildcard boolean not null default false,
  immune_to_suspend boolean not null default false,
  art_character text,
  art_action text,
  art_prompt text,
  art_url text,
  art_status text not null default 'rascunho' check (art_status in ('rascunho', 'aprovada'))
);

-- ─────────────────────────── Jogadores ───────────────────────────

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[A-Za-z0-9_.-]{3,24}$'),
  coins int not null default 0 check (coins >= 0),
  marbles int not null default 0 check (marbles >= 0),
  created_at timestamptz not null default now()
);

-- Moedas de boas-vindas até a moeda da banca ser definida (seção 8).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, coins) values (new.id, 500);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.user_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id text not null references public.cards(id),
  rarity text not null check (rarity in ('comum', 'brilhante', 'holografica', 'carimbada')),
  serial int,
  obtained_at timestamptz not null default now()
);
create index user_cards_user_idx on public.user_cards (user_id);
-- Número de série só existe (e é único) nas Carimbadas.
create unique index user_cards_serial_idx on public.user_cards (card_id, serial) where serial is not null;

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Meu deck',
  created_at timestamptz not null default now()
);
create index decks_user_idx on public.decks (user_id);

create table public.deck_cards (
  deck_id uuid not null references public.decks(id) on delete cascade,
  user_card_id uuid not null references public.user_cards(id) on delete cascade,
  primary key (deck_id, user_card_id)
);

-- ─────────────────────────── Partidas ───────────────────────────

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  player_a uuid not null references public.profiles(id),
  player_b uuid references public.profiles(id), -- null = contra o bot
  seed bigint not null,
  state jsonb not null,
  round int not null default 1,
  status text not null default 'ativa' check (status in ('ativa', 'encerrada', 'abandonada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Jogadas escondidas: ninguém lê a do outro.
create table public.match_moves (
  match_id uuid not null references public.matches(id) on delete cascade,
  round int not null,
  player uuid not null references public.profiles(id),
  move jsonb not null,
  created_at timestamptz not null default now(),
  primary key (match_id, round, player)
);

-- ─────────────────────────── RLS ───────────────────────────

alter table public.families enable row level security;
alter table public.cards enable row level security;
alter table public.profiles enable row level security;
alter table public.user_cards enable row level security;
alter table public.decks enable row level security;
alter table public.deck_cards enable row level security;
alter table public.matches enable row level security;
alter table public.match_moves enable row level security;

create policy "catálogo é público" on public.families for select using (true);
create policy "catálogo é público" on public.cards for select using (true);

create policy "vê o próprio perfil" on public.profiles for select to authenticated using (id = auth.uid());
create policy "edita o próprio perfil" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- O cliente só pode mudar o nome; moedas e bolinhas só pelo servidor.
revoke update on public.profiles from anon, authenticated;
grant update (username) on public.profiles to authenticated;

create policy "vê a própria coleção" on public.user_cards for select to authenticated using (user_id = auth.uid());

create policy "decks do dono" on public.decks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "cartas do deck do dono" on public.deck_cards for all to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid()))
  with check (
    exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid())
    and exists (select 1 from public.user_cards uc where uc.id = user_card_id and uc.user_id = auth.uid())
  );

create policy "vê as próprias partidas" on public.matches for select to authenticated
  using (auth.uid() in (player_a, player_b));

create policy "vê só as próprias jogadas" on public.match_moves for select to authenticated
  using (player = auth.uid());
-- Envio de jogada passa pela Edge Function submit-move (valida contra o estado).

-- ─────────────────────────── Pacotinho ───────────────────────────

-- Chamada só pela Edge Function open-pack (service role), que já sorteou as
-- figurinhas. Desconta as moedas e grava tudo numa transação.
create or replace function public.grant_pack(p_user uuid, p_price int, p_cards jsonb)
returns setof public.user_cards
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  next_serial int;
begin
  update public.profiles set coins = coins - p_price
    where id = p_user and coins >= p_price;
  if not found then
    raise exception 'moedas insuficientes' using errcode = 'P0001';
  end if;

  for item in select * from jsonb_array_elements(p_cards) loop
    next_serial := null;
    if item->>'rarity' = 'carimbada' then
      -- Trava por carta para dois pacotes simultâneos não repetirem o número.
      perform pg_advisory_xact_lock(hashtext('serial:' || (item->>'card_id')));
      select coalesce(max(serial), 0) + 1 into next_serial
        from public.user_cards where card_id = item->>'card_id';
    end if;
    return query
      insert into public.user_cards (user_id, card_id, rarity, serial)
      values (p_user, item->>'card_id', item->>'rarity', next_serial)
      returning *;
  end loop;
end;
$$;

revoke execute on function public.grant_pack(uuid, int, jsonb) from public, anon, authenticated;
grant execute on function public.grant_pack(uuid, int, jsonb) to service_role;
