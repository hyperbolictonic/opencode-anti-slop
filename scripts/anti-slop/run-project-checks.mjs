#!/usr/bin/env node
/**
 * run-project-checks.mjs — pre-push project checks, without silent skips.
 *
 * Runs the repo's own lint/typecheck/test scripts with the package manager
 * detected from the lockfile, and:
 *   - prints every check as present or skipped, so "nothing ran" is visible;
 *   - falls back to `tsc --noEmit` when there is no typecheck script but a
 *     tsconfig.json exists (a TypeScript repo must not pass untypechecked);
 *   - works with npm, pnpm, yarn and bun.
 *
 * Zero dependencies. Exits non-zero on the first failing check.
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(cwd, 'package.json'), 'utf8'));
const scripts = pkg.scripts ?? {};

function detectPackageManager() {
  if (existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
  if (existsSync(path.join(cwd, 'bun.lockb')) || existsSync(path.join(cwd, 'bun.lock'))) return 'bun';
  return 'npm';
}

const pm = detectPackageManager();
const run = (cmd, args) => spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });

/** Run `<pm> run <script>` when it exists. Returns 'ran' | 'skipped'. */
function runScript(name) {
  if (!scripts[name]) {
    console.log(`[skip] ${name}: no "${name}" script in package.json`);
    return 'skipped';
  }
  console.log(`[run] ${name} (${pm} run ${name})`);
  const res = run(pm, ['run', name]);
  if (res.status !== 0) {
    console.error(`\n[x] "${name}" failed (exit ${res.status ?? 'signal'}).`);
    process.exit(res.status ?? 1);
  }
  return 'ran';
}

/** tsc --noEmit fallback for TypeScript repos without a typecheck script. */
function runTypecheck() {
  if (scripts.typecheck) return runScript('typecheck');

  const hasTs = existsSync(path.join(cwd, 'tsconfig.json')) ||
    scripts.typescript !== undefined ||
    (pkg.devDependencies && pkg.devDependencies.typescript);
  if (!hasTs) {
    console.log('[skip] typecheck: no typecheck script and no TypeScript setup detected');
    return 'skipped';
  }
  console.log('[run] typecheck (fallback: tsc --noEmit — no "typecheck" script was found)');
  const exec = pm === 'bun' ? 'bunx' : pm === 'npm' ? 'npx' : pm;
  const res = run(exec, ['--no-install', 'tsc', '--noEmit']);
  if (res.status !== 0) {
    console.error(`\n[x] typecheck failed (exit ${res.status ?? 'signal'}).`);
    process.exit(res.status ?? 1);
  }
  return 'ran';
}

console.log(`[anti-slop] project checks via ${pm}`);
runScript('lint');
runTypecheck();
runScript('test');
console.log('[ok] project checks done.');
