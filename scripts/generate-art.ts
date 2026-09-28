// Gera a arte das cartas no estilo "Cordel Riso" usando a API do Gemini.
//
//   GEMINI_API_KEY=... npm run art                       -> gera o que falta
//   GEMINI_API_KEY=... npm run art -- --only vo,mae      -> só essas cartas
//   GEMINI_API_KEY=... npm run art -- --force            -> refaz mesmo se já existir
//   npm run art -- --dry                                  -> só imprime os prompts
//
// A chave fica só na sua máquina (variável de ambiente ou .env.local). Nunca vai
// para o cliente. As imagens vão para src/assets/art/{card_id}.{png|jpg|webp},
// e o app passa a usá-las automaticamente.
//
// Consistência (seção 10 do design): o Filtro de Barro é gerado primeiro como
// carta-âncora e entra como referência em todas as outras; a primeira carta de
// cada família vira a âncora daquela família.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CARDS } from '../src/engine/cards';
import { buildPrompt } from './art-prompt';

const OUT = join(import.meta.dirname, '..', 'src', 'assets', 'art');
const ANCHOR = 'filtro-de-barro';

function loadEnvLocal() {
  for (const f of ['.env.local', '.env']) {
    const path = join(import.meta.dirname, '..', f);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

interface Image {
  mimeType: string;
  data: string; // base64
}

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

function existing(id: string): Image | null {
  if (!existsSync(OUT)) return null;
  const file = readdirSync(OUT).find((f) => f.replace(/\.[^.]+$/, '') === id);
  if (!file) return null;
  const ext = file.split('.').pop()!;
  const mimeType = Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? 'image/png';
  return { mimeType, data: readFileSync(join(OUT, file)).toString('base64') };
}

async function generate(prompt: string, refs: Image[], key: string, model: string): Promise<Image> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [...refs.map((r) => ({ inlineData: r })), { text: prompt }],
      },
    ],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '4:5' } },
  };
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { inlineData?: Image; text?: string }[] }; finishReason?: string }[];
      };
      const parts = json.candidates?.[0]?.content?.parts ?? [];
      const img = parts.find((p) => p.inlineData)?.inlineData;
      if (img) return img;
      const why = json.candidates?.[0]?.finishReason ?? parts.map((p) => p.text).join(' ');
      throw new Error(`Gemini não devolveu imagem (${why || 'sem motivo'}).`);
    }
    const text = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const wait = 2000 * 2 ** attempt;
      console.warn(`  HTTP ${res.status}, tentando de novo em ${wait / 1000}s...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const force = args.includes('--force');
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? new Set(args[onlyIdx + 1]?.split(',')) : null;
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

  // Âncora primeiro; depois uma âncora por família (a primeira carta de cada uma).
  const ordered = [...CARDS].sort((a, b) => Number(b.id === ANCHOR) - Number(a.id === ANCHOR));
  const todo = ordered.filter((c) => !only || only.has(c.id));

  if (dry) {
    for (const c of todo) console.log(`\n## ${c.name} (${c.id})\n${buildPrompt(c, c.id !== ANCHOR)}`);
    return;
  }
  if (!key) {
    console.error('Defina GEMINI_API_KEY (variável de ambiente ou .env.local). Use --dry para só ver os prompts.');
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });

  const familyAnchor = new Map<string, Image>();
  for (const c of ordered) {
    const img = existing(c.id);
    if (img && !familyAnchor.has(c.family)) familyAnchor.set(c.family, img);
  }

  let ok = 0;
  for (const card of todo) {
    if (!force && existing(card.id)) {
      console.log(`- ${card.name}: já existe, pulando (use --force para refazer).`);
      continue;
    }
    const anchor = card.id === ANCHOR ? null : existing(ANCHOR);
    const refs = [anchor, familyAnchor.get(card.family)].filter((r): r is Image => !!r);
    const unique = refs.filter((r, i) => refs.findIndex((x) => x.data === r.data) === i);
    process.stdout.write(`- ${card.name}: gerando${unique.length ? ` com ${unique.length} referência(s)` : ''}... `);
    try {
      const img = await generate(buildPrompt(card, unique.length > 0), unique, key, model);
      for (const f of readdirSync(OUT)) if (f.replace(/\.[^.]+$/, '') === card.id) rmSync(join(OUT, f));
      const file = join(OUT, `${card.id}.${EXT[img.mimeType] ?? 'png'}`);
      writeFileSync(file, Buffer.from(img.data, 'base64'));
      if (!familyAnchor.has(card.family)) familyAnchor.set(card.family, img);
      ok++;
      console.log('ok');
    } catch (err) {
      console.log('falhou');
      console.error(`  ${(err as Error).message}`);
    }
  }
  console.log(`\n${ok} imagem(ns) gerada(s) em src/assets/art. Revise antes de commitar (seção 9: limites do humor).`);
}

main();
