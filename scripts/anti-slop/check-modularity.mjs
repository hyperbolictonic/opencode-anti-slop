#!/usr/bin/env node
/**
 * check-modularity.mjs
 *
 * Deterministic monolith gate. Flags structural size violations:
 *   - files exceeding --max-file-lines (default 300)
 *   - functions/methods exceeding --max-function-lines (default 80)
 *   - classes exceeding --max-class-methods (default 10 public methods)
 *
 * Zero dependencies. Parsing is heuristic (brace matching on comment/string-
 * stripped source); thresholds are budgets, not exact science — treat hits as
 * "split by responsibility" signals.
 *
 * Usage:
 *   node scripts/anti-slop/check-modularity.mjs [paths...] [--src src] [--max-file-lines 300]
 *        [--max-function-lines 80] [--max-class-methods 10] [--report-only]
 *
 * With no path arguments it scans --src (default `src`).
 * With path arguments it checks exactly those files (used by git hooks to
 * check only staged files, so legacy violations don't block commits).
 * --report-only prints findings but always exits 0.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { walk, stripNoise, lineOf } from './lib.mjs';

function parseArgs(argv) {
  const a = {
    src: 'src', maxFileLines: 300, maxFunctionLines: 80,
    maxClassMethods: 10, reportOnly: false, paths: [],
  };
  for (let i = 2; i < argv.length; i++) {
    const s = argv[i];
    if (s === '--src') a.src = argv[++i];
    else if (s === '--max-file-lines') a.maxFileLines = Number(argv[++i]);
    else if (s === '--max-function-lines') a.maxFunctionLines = Number(argv[++i]);
    else if (s === '--max-class-methods') a.maxClassMethods = Number(argv[++i]);
    else if (s === '--report-only') a.reportOnly = true;
    else if (s === '-h' || s === '--help') {
      console.log('Usage: node check-modularity.mjs [paths...] [--src src] [--max-file-lines 300] [--max-function-lines 80] [--max-class-methods 10] [--report-only]');
      process.exit(0);
    } else a.paths.push(s);
  }
  for (const [k, v] of Object.entries(a)) {
    if (typeof v === 'number' && (Number.isNaN(v) || v < 0)) {
      console.error(`Invalid value for ${k}`);
      process.exit(1);
    }
  }
  return a;
}

const args = parseArgs(process.argv);

function collectFiles(paths) {
  const files = [];
  for (const p of paths) {
    const abs = path.resolve(p);
    if (!existsSync(abs)) {
      console.error(`Path not found: ${p}`);
      process.exit(1);
    }
    if (statSync(abs).isDirectory()) files.push(...walk(abs, abs));
    else if (SOURCE_EXT.has(path.extname(abs)) && !IGNORE_FILE.test(abs)) {
      files.push({ full: abs, rel: path.relative(process.cwd(), abs).split(path.sep).join('/') });
    }
  }
  return files;
}

function analyze(source, limits) {
  const findings = [];
  const stripped = stripNoise(source);
  const totalLines = source.split('\n').length;

  if (totalLines > limits.maxFileLines) {
    findings.push({ kind: 'file', line: 1, detail: `${totalLines} lines (> ${limits.maxFileLines})` });
  }

  // Brace matching; record regions opened by a function-like `{`.
  // A `{` is function-like when the preceding non-space char is `)` (params)
  // or `>` of an arrow `=>`.
  const stack = []; // { depth, start, isFn }
  let depth = 0;
  const regions = []; // { startIdx, endIdx, isFn }
  const classes = []; // { startIdx, endIdx, name, depth }
  let classStart = null; // { name, depth, braceDepth|null, methods }

  for (let i = 0; i < stripped.length; i++) {
    const c = stripped[i];
    if (c === '{') {
      let j = i - 1;
      while (j >= 0 && /\s/.test(stripped[j])) j--;
      const prev = j >= 0 ? stripped[j] : '';
      // detect `class X ... {`
      const head = stripped.slice(Math.max(0, i - 200), i);
      const cm = /(?:^|[\s;}])class\s+([A-Za-z0-9_$]+)[^{}]*$/.exec(head);
      const isFn = prev === ')' || head.trimEnd().endsWith('=>');
      if (cm && classStart === null) {
        classStart = { name: cm[1], declIdx: i, braceDepth: depth, methods: 0 };
      } else if (classStart && classStart.braceDepth !== null && depth === classStart.braceDepth + 1 && prev === ')') {
        classStart.methods++;
      }
      stack.push({ depth, start: i, isFn, classStart });
      depth++;
    } else if (c === '}') {
      depth--;
      const open = stack.pop();
      if (open) {
        if (open.isFn) regions.push({ startIdx: open.start, endIdx: i });
        if (classStart && open.depth === classStart.braceDepth) {
          classes.push({ ...classStart, endIdx: i });
          classStart = null;
        }
      }
    }
  }

  for (const r of regions) {
    const startLine = lineOf(stripped, r.startIdx);
    const endLine = lineOf(stripped, r.endIdx);
    const len = endLine - startLine + 1;
    if (len > limits.maxFunctionLines) {
      findings.push({ kind: 'function', line: startLine, detail: `${len} lines (> ${limits.maxFunctionLines})` });
    }
  }
  for (const c of classes) {
    if (c.methods > limits.maxClassMethods) {
      findings.push({
        kind: 'class',
        line: lineOf(stripped, c.declIdx),
        detail: `class ${c.name}: ${c.methods} methods (> ${limits.maxClassMethods})`,
      });
    }
  }

  return { findings, totalLines };
}

// --- run ---------------------------------------------------------------------
const files = args.paths.length > 0 ? collectFiles(args.paths) : (() => {
  const dir = path.resolve(args.src);
  if (!existsSync(dir)) { console.error(`Source directory not found: ${dir}`); process.exit(1); }
  return walk(dir, dir);
})();

const limits = {
  maxFileLines: args.maxFileLines,
  maxFunctionLines: args.maxFunctionLines,
  maxClassMethods: args.maxClassMethods,
};

let violations = 0;
for (const file of files) {
  const { findings, totalLines } = analyze(readFileSync(file.full, 'utf8'), limits);
  if (findings.length === 0) continue;
  console.log(`${file.rel} (${totalLines} lines):`);
  for (const f of findings) {
    console.log(`  [${f.kind}] line ${f.line}: ${f.detail}`);
    violations++;
  }
}

if (violations === 0) {
  console.log(`[ok] Modularity check passed (${files.length} files within budgets).`);
  process.exit(0);
}

console.log(`\n${violations} size-budget violation(s) in ${files.length} file(s).`);
console.error(
  '[x] Modularity check FAILED.\n' +
  '    Fix: split by responsibility (see the modular-architecture skill) — transport/service/domain/data,\n' +
  '    smaller functions, smaller public surfaces. Do NOT compress code, raise budgets, or disable the check.'
);
process.exit(args.reportOnly ? 0 : 1);
