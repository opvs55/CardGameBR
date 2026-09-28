// Gera supabase/seed.sql a partir das cartas em src/engine/cards (a fonte da verdade).
//   npm run db:seed
// Rodar de novo é seguro: usa upsert, e não mexe em art_url/art_status.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CARDS, FAMILIES } from '../src/engine/cards';
import { buildPrompt } from './art-prompt';

const q = (v: string | null | undefined) => (v == null ? 'null' : `'${v.replace(/'/g, "''")}'`);
const arr = (items: string[]) => (items.length ? `array[${items.map(q).join(', ')}]::text[]` : `'{}'::text[]`);

export function buildSeed(): string {
  const lines = ['-- Gerado por scripts/gen-seed.ts. Não edite à mão: mude src/engine/cards e rode npm run db:seed.', ''];
  lines.push('insert into public.families (id, name, keyword, ink_1, ink_2, bg_shape) values');
  lines.push(
    Object.values(FAMILIES)
      .map((f) => `  (${[f.id, f.name, f.keyword, f.ink1, f.ink2, f.bgShape].map(q).join(', ')})`)
      .join(',\n'),
  );
  lines.push(
    'on conflict (id) do update set name = excluded.name, keyword = excluded.keyword, ink_1 = excluded.ink_1, ink_2 = excluded.ink_2, bg_shape = excluded.bg_shape;',
    '',
  );
  const cols = [
    'id', 'name', 'family', 'type', 'tags', 'cost', 'power', 'toughness', 'speed', 'text', 'flavor', 'effects',
    'wildcard', 'immune_to_suspend', 'art_character', 'art_action', 'art_prompt',
  ];
  lines.push(`insert into public.cards (${cols.join(', ')}) values`);
  lines.push(
    CARDS.map((c) => {
      const values = [
        q(c.id), q(c.name), q(c.family), q(c.type), arr(c.tags), c.cost, c.power, c.toughness, c.speed,
        q(c.text), q(c.flavor), `${q(JSON.stringify(c.effects))}::jsonb`, !!c.wildcard, !!c.immuneToSuspend,
        q(c.art.character), q(c.art.action), q(buildPrompt(c, c.id !== 'filtro-de-barro')),
      ];
      return `  (${values.join(', ')})`;
    }).join(',\n'),
  );
  lines.push(
    `on conflict (id) do update set ${cols
      .filter((c) => c !== 'id')
      .map((c) => `${c} = excluded.${c}`)
      .join(', ')};`,
    '',
  );
  return lines.join('\n');
}

if (process.argv[1]?.endsWith('gen-seed.ts')) {
  const out = join(import.meta.dirname, '..', 'supabase', 'seed.sql');
  writeFileSync(out, buildSeed());
  console.log(`seed com ${CARDS.length} cartas escrito em supabase/seed.sql`);
}
