// Abre um pacotinho: sorteia no servidor e grava em user_cards (seção 8).
// POST /functions/v1/open-pack  (com o token do usuário no Authorization)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { cryptoRandom, PACK_PRICE, rollPack } from '../_shared/pack.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await asUser.auth.getUser();
  if (!user) return json({ error: 'Faça login para abrir pacotinhos.' }, 401);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: cards, error: cardsError } = await admin.from('cards').select('id').eq('collectible', true);
  if (cardsError || !cards?.length) return json({ error: 'Catálogo de cartas indisponível.' }, 500);

  const pack = rollPack(
    cards.map((c: { id: string }) => c.id),
    cryptoRandom,
  );
  const { data, error } = await admin.rpc('grant_pack', { p_user: user.id, p_price: PACK_PRICE, p_cards: pack });
  if (error) {
    if (error.message.includes('moedas insuficientes')) {
      return json({ error: `Faltam moedas: o pacotinho custa ${PACK_PRICE}.` }, 402);
    }
    return json({ error: 'Não deu para abrir o pacotinho. Tente de novo.' }, 500);
  }

  const { data: profile } = await admin.from('profiles').select('coins').eq('id', user.id).single();
  return json({ cards: data, coins: profile?.coins ?? null });
});
