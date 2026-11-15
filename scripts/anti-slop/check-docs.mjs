#!/usr/bin/env node
/**
 * check-docs.mjs
 *
 * Documentation gate for shared exports. Fails (exit 1) when exported
 * declarations in the checked files lack a one-line `/** When to use ... *\/`
 * JSDoc above them. Keeps docs/COMPONENT_INDEX.md (generated from the same
 * JSDoc) a maintained, trustworthy inventory instead of a stale artifact.
 *
 * Zero dependencies.
 *
 * Usage:
 *   node scripts/anti-slop/check-docs.mjs [paths...] [--src src] [--report-only]
 *
 * With no path arguments it scans --src (default `src`). With path arguments
 * it checks exactly those files — used by git hooks to check only staged
 * files, so legacy undocumented code never blocks commits.
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { walk, extractExports } from './lib.mjs';
import { loadConfig, bootstrapGate, collectPathFiles, resolveScanTarget } from './cli.mjs';

// Defaults < anti-slop.config.json < CLI flags.
const cfgDocs = loadConfig().docs ?? {};
const { args, positionals } = bootstrapGate(process.argv.slice(2), {
  usage: 'Usage: node check-docs.mjs [paths...] [--src src] [--report-only]\n' +
         'Config: anti-slop.config.json "docs" section (src).\n' +
         'With path arguments, checks exactly those files (git-hook staged mode).',
  spec: { '--src': 'string', '--report-only': 'flag' },
  defaults: { src: cfgDocs.src ?? 'src' },
});

const files = positionals.length > 0 ? collectPathFiles(positionals) : resolveScanTarget(args.src);

let missing = 0;
const detail = [];
for (const file of files) {
  let exports;
  try {
    exports = extractExports(readFileSync(file.full, 'utf8'));
  } catch {
    continue;
  }
  const undocumented = exports.filter((e) => !e.desc && e.name !== 'default');
  if (undocumented.length === 0) continue;
  missing += undocumented.length;
  detail.push({ rel: file.rel, names: undocumented.map((e) => e.name) });
}

if (missing === 0) {
  console.log(`[ok] Docs check passed (${files.length} file(s), every export documented).`);
  process.exit(0);
}

console.log(`${missing} undocumented export(s) in ${detail.length} file(s):`);
for (const d of detail.slice(0, 20)) {
  console.log(`  ${d.rel}: ${d.names.join(', ')}`);
}
if (detail.length > 20) console.log(`  ... and ${detail.length - 20} more file(s)`);

console.error(
  '\n[x] Docs check FAILED.\n' +
  '    Fix: add a one-line "/** When to use ... */" JSDoc above each export —\n' +
  '    this is what feeds docs/COMPONENT_INDEX.md, the inventory the\n' +
  '    reuse-before-create pre-flight depends on. Do NOT delete the check or\n' +
  '    leave the doc as a bare restatement of the name.'
);
process.exit(args.reportOnly ? 0 : 1);
