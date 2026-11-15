#!/usr/bin/env node
/**
 * generate-component-index.mjs
 *
 * Scans a source tree and (re)generates docs/COMPONENT_INDEX.md — the
 * inventory that the `reuse-before-create` skill treats as the source of
 * truth for existing layouts, components, hooks, and utilities.
 *
 * Zero dependencies (plain Node >= 18, ESM). Classification is heuristic
 * (paths + export names + file extension); it is a discovery aid, not a parser.
 *
 * Usage:
 *   node scripts/anti-slop/generate-component-index.mjs [--src src] [--out docs/COMPONENT_INDEX.md] [--root .]
 *
 * A "## Manual Notes" section at the end of an existing index is preserved.
 */

import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import path from 'node:path';
import { walk } from './lib.mjs';

// --- args -------------------------------------------------------------------
function parseArgs(argv) {
  const args = { src: 'src', out: 'docs/COMPONENT_INDEX.md', root: '.' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--src') args.src = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--root') args.root = argv[++i];
    else if (a === '-h' || a === '--help') {
      console.log('Usage: node generate-component-index.mjs [--src src] [--out docs/COMPONENT_INDEX.md] [--root .]');
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(1);
    }
  }
  return args;
}

const args = parseArgs(process.argv);

const SRC_DIR = path.resolve(args.root, args.src);
const OUT_FILE = path.resolve(args.root, args.out);

if (!existsSync(SRC_DIR)) {
  console.error(`Source directory not found: ${SRC_DIR}`);
  process.exit(1);
}

// --- export extraction ------------------------------------------------------
/**
 * Returns the first line of the JSDoc/TSDoc block immediately preceding
 * source index `idx`, or null if there is none.
 */
function jsdocBefore(source, idx) {
  const m = /\/\*\*([\s\S]*?)\*\/\s*$/.exec(source.slice(0, idx));
  if (!m) return null;
  const lines = m[1]
    .split('\n')
    .map((l) => l.replace(/^\s*\*+\s?/, '').trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  const desc = lines[0];
  return desc.startsWith('@') ? null : desc; // tag-only blocks are not usage docs
}

function extractExports(source) {
  const found = [];
  const add = (name, kind, index) => {
    if (name && !found.some((e) => e.name === name)) found.push({ name, kind, index });
  };

  for (const m of source.matchAll(/export\s+(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z0-9_$]+)/g)) {
    add(m[1], 'function', m.index);
  }
  for (const m of source.matchAll(/export\s+(?:default\s+)?const\s+([A-Za-z0-9_$]+)/g)) {
    add(m[1], /=>/.test(source.slice(m.index, m.index + 200)) ? 'function' : 'value', m.index);
  }
  for (const m of source.matchAll(/export\s+(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/g)) {
    add(m[1], 'class', m.index);
  }
  for (const m of source.matchAll(/export\s+(?:type|interface)\s+([A-Za-z0-9_$]+)/g)) {
    add(m[1], 'type', m.index);
  }
  if (/export\s+default\s+(?!function|class|const)/.test(source)) {
    add('default', 'default', source.length);
  }
  return found.map((e) => ({ ...e, desc: jsdocBefore(source, e.index) }));
}

// --- classification ---------------------------------------------------------
function classify(relPath, exports) {
  const base = path.basename(relPath);
  const dir = path.dirname(relPath).toLowerCase();
  const baseName = path.basename(base, path.extname(base));
  const isTsx = /\.(tsx|jsx)$/.test(base);

  const hasJsxLike = exports.length > 0 && isTsx;

  if (/^use[A-Z0-9]/.test(baseName) || /(^|\/)hooks?\//.test(dir)) return 'Hook';
  if (/(^|\/)layouts?(\/|$)/.test(dir) || /layout/i.test(baseName)) return 'Layout';
  if (hasJsxLike && exports.some((e) => /^[A-Z]/.test(e.name))) return 'Component';
  if (/(^|\/)(services?|adapters?)(\/|$)/.test(dir)) return 'Service';
  if (/(^|\/)(utils?|lib|helpers?)(\/|$)/.test(dir)) return 'Util';
  if (exports.some((e) => e.kind === 'type')) return 'Types';
  return 'Module';
}

// --- build ------------------------------------------------------------------
const files = walk(SRC_DIR, SRC_DIR);
const index = new Map(); // kind -> [{rel, name, kind, desc, lines}]
let missingDocs = 0;

for (const file of files) {
  const source = readFileSync(file.full, 'utf8');
  const exports = extractExports(source);
  if (exports.length === 0) continue;
  const kind = classify(file.rel, exports);
  const lines = source.split('\n').length;
  const list = index.get(kind) ?? [];
  for (const exp of exports) {
    if (!exp.desc) missingDocs++;
    list.push({ rel: file.rel, name: exp.name, kind: exp.kind, desc: exp.desc, lines });
  }
  index.set(kind, list);
}

// --- preserve manual notes --------------------------------------------------
let manualNotes = '';
if (existsSync(OUT_FILE)) {
  const existing = readFileSync(OUT_FILE, 'utf8');
  const marker = existing.indexOf('## Manual Notes');
  if (marker !== -1) manualNotes = existing.slice(marker);
}

// --- render -----------------------------------------------------------------
const KIND_ORDER = ['Layout', 'Component', 'Hook', 'Service', 'Util', 'Types', 'Module'];
const totalExports = KIND_ORDER.reduce((n, k) => n + (index.get(k)?.length ?? 0), 0);

let md = `# Component Index\n\n`;
md += `<!-- generated: run \`node scripts/anti-slop/generate-component-index.mjs\` to regenerate -->\n\n`;
md += `Inventory of shared layouts, components, hooks, services, and utilities under \`${args.src}/\`. `;
md += `Generated ${new Date().toISOString().slice(0, 10)}, ${files.length} files, ${totalExports} exports.\n\n`;
md += `> Rule of use: before creating any new component, hook, or utility, check this file first (see the \`reuse-before-create\` skill). When you add a shared abstraction, rerun the generator and fill in the "When to use" column.\n\n`;

for (const kind of KIND_ORDER) {
  const list = index.get(kind);
  if (!list || list.length === 0) continue;
  md += `## ${kind}s (${list.length})\n\n`;
  md += `| File | Export | When to use |\n|---|---|---|\n`;
  for (const e of list) {
    const doc = e.desc ? e.desc.replace(/\|/g, '\\|') : '';
    md += `| \`${e.rel}\` | \`${e.name}\`${e.kind === 'type' ? ' *(type)*' : ''} | ${doc || '-'} |\n`;
  }
  md += `\n`;
}

md += manualNotes ? `${manualNotes}\n` : `## Manual Notes\n\n(Add notes here; they are preserved when the index is regenerated.)\n`;

mkdirSync(path.dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, md);

console.log(`Wrote ${OUT_FILE}`);
console.log(`  ${files.length} source files, ${totalExports} exports across ${KIND_ORDER.filter((k) => index.has(k)).length} categories.`);
if (missingDocs > 0) {
  console.log(`  [doc] ${missingDocs} export(s) have no JSDoc description. Shared components/hooks/utils must carry a one-line "/** When to use ... */" above the export.`);
}
