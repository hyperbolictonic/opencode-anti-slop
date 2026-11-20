#!/usr/bin/env node
/**
 * check-modularity.mjs
 *
 * Deterministic monolith gate. Flags structural size violations:
 *   - files exceeding --max-file-lines (default 500)
 *   - functions/methods exceeding --max-function-lines (default 80)
 *   - classes exceeding --max-class-methods (default 10 public methods)
 *
 * Zero dependencies. Parsing is heuristic (brace matching on comment/string-
 * stripped source); thresholds are budgets, not exact science — treat hits as
 * "split by responsibility" signals.
 *
 * Usage:
 *   node scripts/anti-slop/check-modularity.mjs [paths...] [--src src] [--max-file-lines 500]
 *        [--max-function-lines 80] [--max-class-methods 10] [--report-only]
 *
 * With no path arguments it scans --src (default `src`).
 * With path arguments it checks exactly those files (used by git hooks to
 * check only staged files, so legacy violations don't block commits).
 * --report-only prints findings but always exits 0.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  stripNoise, lineOf, isFunctionBody,
} from './lib.mjs';
import {
  gateArgs, collectPathFiles, resolveScanTarget, applyIgnorePaths, toScanRelative,
} from './cli.mjs';
import { loadConfig, scanExtensions } from './config.mjs';
import { baselineGate } from './baseline.mjs';

// Defaults < anti-slop.config.json < CLI flags.
const cfgMod = ((loadConfig().modularity) ?? {});
const { args, positionals } = gateArgs({
  argv: process.argv.slice(2),
  usage: 'Usage: node check-modularity.mjs [paths...] [--src src] [--max-file-lines 500] [--max-function-lines 80] [--max-class-methods 10] [--report-only] [--baseline file] [--update-baseline]\n' +
         'Config: anti-slop.config.json "modularity" section (src, maxFileLines, maxFunctionLines, maxClassMethods).\n' +
         'With path arguments, checks exactly those files (git-hook staged mode).\n' +
         'With a baseline file (default anti-slop.baseline.json) the gate fails only on NEW violations.',
  spec: {
    '--src': 'string', '--max-file-lines': 'number', '--max-function-lines': 'number',
    '--max-class-methods': 'number', '--report-only': 'flag',
    '--baseline': 'string', '--update-baseline': 'flag',
  },
  defaults: {
    src: cfgMod.src ?? 'src',
    maxFileLines: cfgMod.maxFileLines ?? 500,
    maxFunctionLines: cfgMod.maxFunctionLines ?? 80,
    maxClassMethods: cfgMod.maxClassMethods ?? 10,
  },
  allowPositionals: true,
});
const paths = positionals;

function analyze(source, limits) {
  const findings = [];
  const stripped = stripNoise(source);
  const totalLines = source.split('\n').length;

  if (totalLines > limits.maxFileLines) {
    findings.push({ kind: 'file', line: 1, detail: `${totalLines} lines (> ${limits.maxFileLines})` });
  }

  // Brace matching; record regions opened by a function-like `{`.
  // isFunctionBody covers params, typed return annotations and arrows.
  const stack = []; // { depth, start, isFn }
  let depth = 0;
  const regions = []; // { startIdx, endIdx, isFn }
  const classes = []; // { startIdx, endIdx, name, depth }
  let classStart = null; // { name, depth, braceDepth|null, methods }

  for (let i = 0; i < stripped.length; i++) {
    const c = stripped[i];
    if (c === '{') {
      // detect `class X ... {`
      const head = stripped.slice(Math.max(0, i - 200), i);
      const cm = /(?:^|[\s;}])class\s+([A-Za-z0-9_$]+)[^{}]*$/.exec(head);
      // `if (x) {` / `for (...) {` are control flow; `run(): Promise<T> {` is a
      // function body even though the brace follows the return type.
      const isFn = isFunctionBody(stripped, i);
      if (cm && classStart === null) {
        classStart = { name: cm[1], declIdx: i, braceDepth: depth, methods: 0 };
      } else if (classStart && classStart.braceDepth !== null && depth === classStart.braceDepth + 1 && isFn) {
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
// modularity.ignorePaths exempts declarative/framework files from size
// budgets, matching the drift principle (shape, not logic).
const modIgnore = Array.isArray(cfgMod.ignorePaths) ? cfgMod.ignorePaths : [];
if (modIgnore.length > 0) {
  console.log(
    `[note] ${modIgnore.length} glob(s) exempt from size budgets via modularity.ignorePaths - ` +
    'the budget cannot see matching files. Exempt declarative/framework files only; ' +
    'a source file here needs decomposition, not an exemption.',
  );
}
const files = applyIgnorePaths(
  toScanRelative(
    positionals.length > 0
      ? collectPathFiles(positionals, { extensions: scanExtensions(loadConfig()) })
      : resolveScanTarget(args.src, { extensions: scanExtensions(loadConfig()) }),
    args.src,
  ),
  modIgnore,
  { label: 'modularity.ignorePaths', src: args.src },
);

const limits = {
  maxFileLines: args.maxFileLines,
  maxFunctionLines: args.maxFunctionLines,
  maxClassMethods: args.maxClassMethods,
};

let violations = 0;
const perFileKinds = {};
const fileLines = {};
for (const file of files) {
  const { findings, totalLines } = analyze(readFileSync(file.full, 'utf8'), limits);
  fileLines[file.rel] = totalLines;
  if (findings.length === 0) continue;
  console.log(`${file.rel} (${totalLines} lines):`);
  const kinds = {};
  for (const f of findings) {
    console.log(`  [${f.kind}] line ${f.line}: ${f.detail}`);
    kinds[f.kind] = (kinds[f.kind] ?? 0) + 1;
    violations++;
  }
  perFileKinds[file.rel] = kinds;
}

if (files.length === 0 && positionals.length > 0) {
  console.log(
    `[note] ${positionals.length} path(s) given, but none are checkable - test files, ` +
    'generated files and ignorePaths are excluded. Nothing was enforced by this run.',
  );
}

if (violations === 0) {
  console.log(`[ok] Modularity check passed (${files.length} files within budgets).`);
  process.exit(0);
}

// --- baseline (ratchet) mode ---------------------------------------------------
const decision = baselineGate({
  args,
  section: 'modularity',
  current: perFileKinds,
  kindCounts: true,
  unit: 'violation(s)',
  showKind: true,
  fixLine: 'Fix: split by responsibility (see the modular-architecture skill).',
});
if (decision === 'ok') process.exit(0);
if (decision === 'fail') process.exit(1);

console.log(`\n${violations} size-budget violation(s) in ${files.length} file(s).`);
console.error(
  '[x] Modularity check FAILED.\n' +
  '    Fix: split by responsibility (see the modular-architecture skill) — transport/service/domain/data,\n' +
  '    smaller functions, smaller public surfaces. Do NOT compress code, raise budgets, or disable the check.\n' +
  '    Adopting a repo with legacy violations? Snapshot them once:\n' +
  '    node scripts/anti-slop/check-modularity.mjs --update-baseline — the gate then fails only on NEW ones.'
);
process.exit(args.reportOnly ? 0 : 1);
