#!/usr/bin/env node
/**
 * check-duplicates.mjs
 *
 * Built-in copy/paste detector for JS/TS/React code. Fails (exit 1) when the
 * percentage of duplicated lines across the source tree exceeds `threshold`.
 * Used as a pre-completion / pre-commit gate by the `verify-clean-code` skill.
 *
 * Zero dependencies. Why not jscpd: verified in testing that jscpd (v3 and v4
 * via npx) can analyze 0 files on some Windows setups; a built-in token-stream
 * detector is deterministic and needs no downloads.
 *
 * Method: strip comments, tokenize, compare sliding windows of `min-tokens`
 * consecutive tokens between files (and within a file). Windows are
 * normalized: string/number literals are abstracted so clones with changed
 * text/numbers are still caught.
 *
 * Usage:
 *   node scripts/anti-slop/check-duplicates.mjs [--src src] [--min-tokens 50] [--threshold 3]
 *   threshold = max allowed duplicated-lines percent; 0 disables failing.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// --- args -------------------------------------------------------------------
function parseArgs(argv) {
  const a = { src: 'src', minTokens: 50, threshold: 3 };
  for (let i = 2; i < argv.length; i++) {
    const s = argv[i];
    if (s === '--src') a.src = argv[++i];
    else if (s === '--min-tokens') a.minTokens = Number(argv[++i]);
    else if (s === '--threshold') a.threshold = Number(argv[++i]);
    else if (s === '-h' || s === '--help') {
      console.log('Usage: node check-duplicates.mjs [--src src] [--min-tokens 50] [--threshold 3]');
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${s}`);
      process.exit(1);
    }
  }
  if (Number.isNaN(a.minTokens) || a.minTokens < 10) {
    console.error('--min-tokens must be a number >= 10');
    process.exit(1);
  }
  return a;
}

const args = parseArgs(process.argv);
const SRC_DIR = path.resolve(args.src);

if (!existsSync(SRC_DIR)) {
  console.error(`Source directory not found: ${SRC_DIR}`);
  process.exit(1);
}

// --- walk -------------------------------------------------------------------
const EXCLUDE_DIRS = new Set([
  'node_modules', 'dist', 'build', 'out', '.next', '.turbo',
  'coverage', 'storybook-static', '__tests__', '__mocks__',
]);
const IGNORE_FILE = /(\.test|\.spec|\.stories|\.d)\.[tj]sx?$/;
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts']);

function walk(dir, base) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || EXCLUDE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full).split(path.sep).join('/');
    if (entry.isDirectory()) files.push(...walk(full, base));
    else if (SOURCE_EXT.has(path.extname(entry.name)) && !IGNORE_FILE.test(entry.name)) {
      files.push({ full, rel });
    }
  }
  return files;
}

// --- strip comments ----------------------------------------------------------
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n'; // preserve line numbers
        i++;
      }
      i += 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

// --- tokenize ----------------------------------------------------------------
// Strings/numbers become placeholders; identifiers and symbols stay literal.
const TOKEN_RE =
  /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|\S/g;

function tokenize(stripped) {
  const tokens = []; // { t: normalized text, line }
  for (const m of stripped.matchAll(TOKEN_RE)) {
    const raw = m[0];
    // line = 1 + newlines before the match start
    let nl = 0;
    for (let k = 0; k < m.index; k++) if (m.input[k] === '\n') nl++;
    const line = 1 + nl;
    let t;
    if (raw[0] === '"' || raw[0] === "'" || raw[0] === '`') t = '<str>';
    else if (/^\d/.test(raw)) t = '<num>';
    else t = raw;
    tokens.push({ t, line });
  }
  return tokens;
}

// --- detect -------------------------------------------------------------------
const files = walk(SRC_DIR, SRC_DIR);
const K = args.minTokens;

// Map: window key -> [{ file, idx }]
const windows = new Map();

for (const file of files) {
  const stripped = stripComments(readFileSync(file.full, 'utf8'));
  file.tokens = tokenize(stripped);
  file.totalLines = stripped.split('\n').length;
  if (file.tokens.length < K) continue;
  for (let i = 0; i + K <= file.tokens.length; i++) {
    const key = file.tokens.slice(i, i + K).map((x) => x.t).join('\u0000');
    let list = windows.get(key);
    if (!list) { list = []; windows.set(key, list); }
    list.push({ file, idx: i });
  }
}

// Merge overlapping window hits into clone regions (per file pair).
const clones = []; // { aFile, bFile, aStart, aEnd, bStart, bEnd, tokens }
const seenPairs = new Set();

for (const list of windows.values()) {
  if (list.length < 2) continue;
  for (let x = 0; x < list.length; x++) {
    for (let y = x + 1; y < list.length; y++) {
      const A = list[x];
      const B = list[y];
      if (A.file === B.file && Math.abs(A.idx - B.idx) < K) continue; // overlapping self-match
      const pairKey = `${A.file.rel}|${A.idx}|${B.file.rel}|${B.idx}`;
      // skip if this (A,B) pair region is already covered by a longer clone
      const idPair = `${A.file.rel}~${B.file.rel}`;
      let covered = false;
      for (const c of clones) {
        if (c.aFile !== A.file.rel || c.bFile !== B.file.rel) continue;
        if (A.idx >= c.aStart - K && A.idx <= c.aEnd + K && B.idx >= c.bStart - K && B.idx <= c.bEnd + K) {
          // extend if adjacent
          if (A.idx <= c.aEnd + 1 || B.idx <= c.bEnd + 1) {
            c.aEnd = Math.max(c.aEnd, A.idx + K - 1);
            c.bEnd = Math.max(c.bEnd, B.idx + K - 1);
            c.tokens = Math.max(c.tokens, c.aEnd - c.aStart + 1);
            covered = true;
            break;
          }
        }
      }
      if (covered) continue;
      if (seenPairs.has(idPair) && clones.length > 200) continue; // hard cap on pathological input
      clones.push({
        aFile: A.file.rel, bFile: B.file.rel,
        aStart: A.idx, aEnd: A.idx + K - 1,
        bStart: B.idx, bEnd: B.idx + K - 1,
        tokens: K,
      });
      seenPairs.add(idPair);
    }
  }
}

// --- compute duplicated lines per file ---------------------------------------
const dupLines = new Map(); // rel -> Set<line>
const totalLines = new Map();
for (const f of files) totalLines.set(f.rel, f.totalLines);

const cloneRegions = [];
for (const c of clones) {
  const aTok = files.find((f) => f.rel === c.aFile).tokens;
  const bTok = files.find((f) => f.rel === c.bFile).tokens;
  cloneRegions.push({
    aFile: c.aFile, aLine: aTok[c.aStart]?.line ?? 1, aEndLine: aTok[Math.min(c.aEnd, aTok.length - 1)]?.line ?? aTok.length,
    bFile: c.bFile, bLine: bTok[c.bStart]?.line ?? 1, bEndLine: bTok[Math.min(c.bEnd, bTok.length - 1)]?.line ?? bTok.length,
    tokens: c.tokens,
  });
}

for (const r of cloneRegions) {
  for (const [rel, s, e] of [[r.aFile, r.aLine, r.aEndLine], [r.bFile, r.bLine, r.bEndLine]]) {
    let set = dupLines.get(rel);
    if (!set) { set = new Set(); dupLines.set(rel, set); }
    for (let l = s; l <= e; l++) set.add(l);
  }
}

let totalDup = 0;
let totalAll = 0;
for (const f of files) {
  totalAll += f.totalLines;
  totalDup += dupLines.get(f.rel)?.size ?? 0;
}
const pct = totalAll > 0 ? (totalDup / totalAll) * 100 : 0;

// --- report -------------------------------------------------------------------
console.log(`Checked ${files.length} files (${totalAll} lines), min-tokens=${K}, threshold=${args.threshold}%`);

if (cloneRegions.length === 0) {
  console.log('[ok] No duplicates found.');
  process.exit(0);
}

const MAX_REPORT = 40;
console.log(`Found ${cloneRegions.length} clone region(s). Showing up to ${MAX_REPORT}:\n`);
for (const r of cloneRegions.slice(0, MAX_REPORT)) {
  console.log(`  ${r.aFile}:${r.aLine}-${r.aEndLine}  <->  ${r.bFile}:${r.bLine}-${r.bEndLine}  (~${r.tokens} tokens)`);
}

const worst = [...dupLines.entries()]
  .map(([rel, set]) => ({ rel, dup: set.size, total: totalLines.get(rel) }))
  .filter((f) => f.dup > 0)
  .sort((a, b) => b.dup / b.total - a.dup / a.total)
  .slice(0, 5);
console.log('\nMost duplicated files:');
for (const w of worst) console.log(`  ${w.rel}: ${w.dup}/${w.total} lines (${((w.dup / w.total) * 100).toFixed(1)}%)`);
console.log(`\nTotal duplicated lines: ${totalDup}/${totalAll} (${pct.toFixed(1)}%)`);

if (args.threshold > 0 && pct > args.threshold) {
  console.error(
    `\n[x] Duplicate-code check FAILED (${pct.toFixed(1)}% > ${args.threshold}%).\n` +
    '    Fix: extract duplicates into existing shared modules (see the reuse-before-create skill).\n' +
    '    Do NOT weaken the threshold or add ignore comments to pass.'
  );
  process.exit(1);
}
console.log('[ok] Duplicate-code check passed.');
