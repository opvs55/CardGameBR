import { createClient } from '@supabase/supabase-js';
import type { Rarity } from '../engine';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null quando o projeto não está configurado: o jogo segue funcionando offline contra o bot. */
export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export interface UserCard {
  id: string;
  card_id: string;
  rarity: Rarity;
  serial: number | null;
  obtained_at: string;
}

function client() {
  if (!supabase) throw new Error('Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  return supabase;
}

export async function fetchProfile() {
  const { data, error } = await client().from('profiles').select('id, username, coins, marbles').single();
  if (error) throw error;
  return data as { id: string; username: string | null; coins: number; marbles: number };
}

export async function fetchCollection(): Promise<UserCard[]> {
  const { data, error } = await client()
    .from('user_cards')
    .select('id, card_id, rarity, serial, obtained_at')
    .order('obtained_at', { ascending: false });
  if (error) throw error;
  return data as UserCard[];
}

/** Abre um pacotinho na Edge Function open-pack (o sorteio acontece no servidor). */
export async function openPack(): Promise<{ cards: UserCard[]; coins: number }> {
  const { data, error } = await client().functions.invoke('open-pack', { method: 'POST' });
  if (error) throw error;
  return data;
}
