#!/usr/bin/env node
/**
 * install-hooks.mjs — wire the anti-slop gates into git hooks of a repo.
 *
 *   pre-commit : checks ONLY staged JS/TS files with check-modularity
 *                (blocking) + reports duplicates (non-blocking). Fast, and
 *                never blocked by legacy code.
 *   pre-push   : full duplicates gate (blocking) + lint/typecheck/test via
 *                `npm run <script> --if-present`.
 *
 * Run from the target repo root:  node scripts/anti-slop/install-hooks.mjs [--force]
 * Existing hooks are never overwritten without --force.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const force = process.argv.includes('--force');
if (process.argv.includes('-h') || process.argv.includes('--help')) {
  console.log('Usage: node scripts/anti-slop/install-hooks.mjs [--force]  (run from the target repo root)');
  process.exit(0);
}

const cwd = process.cwd();
const gitDir = existsSync(path.join(cwd, '.git')) ? path.join(cwd, '.git') : null;

if (!gitDir) {
  console.error('No .git directory here. Run from the root of a git repository.');
  process.exit(1);
}

const hooksDir = path.join(gitDir, 'hooks');
mkdirSync(hooksDir, { recursive: true });

const PRE_COMMIT = `#!/bin/sh
# anti-slop pre-commit gate (installed by scripts/anti-slop/install-hooks.mjs)
staged=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\\.(ts|tsx|js|jsx|mjs|mts)$')
[ -z "$staged" ] && exit 0

echo "[anti-slop] modularity check on staged files..."
# shellcheck disable=SC2086
node scripts/anti-slop/check-modularity.mjs $staged || exit 1

echo "[anti-slop] duplicate-code report (non-blocking):"
node scripts/anti-slop/check-duplicates.mjs --min-tokens 20 --threshold 0 || true

exit 0
`;

const PRE_PUSH = `#!/bin/sh
# anti-slop pre-push gate (installed by scripts/anti-slop/install-hooks.mjs)
echo "[anti-slop] duplicate-code gate..."
node scripts/anti-slop/check-duplicates.mjs || exit 1

echo "[anti-slop] project checks (--if-present)..."
npm run lint --if-present || exit 1
npm run typecheck --if-present || exit 1
npm test --if-present || exit 1

exit 0
`;

const writeHook = (name, body) => {
  const dest = path.join(hooksDir, name);
  if (existsSync(dest) && !force) {
    console.error(`[skip] ${name} already exists (use --force to overwrite)`);
    return;
  }
  writeFileSync(dest, body, { mode: 0o755 });
  console.log(`[ok] wrote ${path.relative(cwd, dest)}`);
};

writeHook('pre-commit', PRE_COMMIT);
writeHook('pre-push', PRE_PUSH);

console.log(`
Notes:
- Hooks require core.hooksPath to be unset (default). Verify: git config core.hooksPath
- Pre-commit only checks staged files, so pre-existing violations elsewhere do not block.
- To bypass once in an emergency: git commit --no-verify (use sparingly; it defeats the gate).
`);
