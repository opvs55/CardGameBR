// Gera supabase/seed.sql a partir das cartas em src/engine/cards (a fonte da verdade).
//   npm run db:seed
// Rodar de novo é seguro: usa upsert, e não mexe em art_url/art_status.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CARDS, FAMILIES, HEROES } from '../src/engine/cards';
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
    'id', 'name', 'kind', 'family', 'type', 'tags', 'keywords', 'cost', 'power', 'toughness', 'text', 'flavor',
    'effects', 'target', 'wildcard', 'immune_to_suspend', 'collectible', 'art_character', 'art_action', 'art_prompt',
  ];
  lines.push(`insert into public.cards (${cols.join(', ')}) values`);
  lines.push(
    CARDS.map((c) => {
      const values = [
        q(c.id), q(c.name), q(c.kind), q(c.family), q(c.type), arr(c.tags), arr(c.keywords), c.cost, c.power,
        c.toughness, q(c.text), q(c.flavor), `${q(JSON.stringify(c.effects))}::jsonb`,
        c.target ? `${q(JSON.stringify(c.target))}::jsonb` : 'null', !!c.wildcard, !!c.immuneToSuspend,
        c.collectible !== false, q(c.art.character), q(c.art.action), q(buildPrompt(c, c.id !== 'filtro-de-barro')),
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
  const heroCols = ['id', 'name', 'title', 'family', 'power', 'art_character', 'art_action'];
  lines.push(`insert into public.heroes (${heroCols.join(', ')}) values`);
  lines.push(
    HEROES.map(
      (h) =>
        `  (${[q(h.id), q(h.name), q(h.title), q(h.family), `${q(JSON.stringify(h.power))}::jsonb`, q(h.art.character), q(h.art.action)].join(', ')})`,
    ).join(',\n'),
  );
  lines.push(
    `on conflict (id) do update set ${heroCols
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
  console.log(`seed com ${CARDS.length} cartas e ${HEROES.length} heróis escrito em supabase/seed.sql`);
}
