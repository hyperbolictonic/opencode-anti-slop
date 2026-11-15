#!/usr/bin/env node
/**
 * install.mjs — install the anti-slop kit into a target repository.
 *
 * Copies:
 *   .opencode/skills/<4 skills>          -> <target>/.opencode/skills/
 *   scripts/anti-slop/*.mjs              -> <target>/scripts/anti-slop/
 *
 * Then prints the manual setup steps that cannot be safely automated
 * (AGENTS.md snippet, opencode.json instructions, package.json scripts,
 * ESLint setup).
 *
 * Usage:
 *   node install.mjs <target-repo-dir> [--force]
 */

import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const force = process.argv.includes('--force');
const targetArg = process.argv.find((a, i) => i >= 2 && a !== '--force');

if (process.argv.includes('-h') || process.argv.includes('--help') || !targetArg) {
  console.log('Usage: node install.mjs <target-repo-dir> [--force]');
  process.exit(process.argv.includes('-h') || process.argv.includes('--help') ? 0 : 1);
}

const target = path.resolve(targetArg);
if (!existsSync(target)) {
  console.error(`Target directory not found: ${target}`);
  process.exit(1);
}

const copyOverwrite = (src, dest) => {
  if (existsSync(dest) && !force) {
    console.error(`[skip] ${dest} already exists (use --force to overwrite)`);
    return false;
  }
  cpSync(src, dest, { recursive: true });
  console.log(`[ok] ${dest}`);
  return true;
};

// --- skills -----------------------------------------------------------------
const skillsSrc = path.join(kitRoot, '.opencode', 'skills');
const skillsDest = path.join(target, '.opencode', 'skills');
mkdirSync(skillsDest, { recursive: true });

for (const entry of readdirSync(skillsSrc, { withFileTypes: true })) {
  if (entry.isDirectory() && existsSync(path.join(skillsSrc, entry.name, 'SKILL.md'))) {
    copyOverwrite(path.join(skillsSrc, entry.name), path.join(skillsDest, entry.name));
  }
}

// --- scripts ----------------------------------------------------------------
const scriptsSrc = path.join(kitRoot, 'scripts', 'anti-slop');
const scriptsDest = path.join(target, 'scripts', 'anti-slop');
mkdirSync(path.dirname(scriptsDest), { recursive: true });
copyOverwrite(scriptsSrc, scriptsDest);

// --- commands ----------------------------------------------------------------
// Copy command FILES individually so a pre-existing commands dir doesn't nest
// (dir-into-dir copy would produce commands/commands/x.md → /commands/x).
const commandsSrc = path.join(kitRoot, '.opencode', 'commands');
const commandsDest = path.join(target, '.opencode', 'commands');
mkdirSync(commandsDest, { recursive: true });
for (const entry of readdirSync(commandsSrc, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.md')) {
    copyOverwrite(path.join(commandsSrc, entry.name), path.join(commandsDest, entry.name));
  }
}

// --- manual steps -----------------------------------------------------------
console.log(`
Manual setup in ${target} (one-time):

1. AGENTS.md — add:
   ${'```markdown'}
   ## Anti-slop skills
   - Before creating any new component, hook, or utility: load the \`reuse-before-create\` skill.
   - When building/refactoring React UI: load \`react-composition-patterns\`.
   - When touching state/effects/memo/context: load \`react-state-and-effects\`.
   - Before marking any coding task complete: run the \`verify-clean-code\` checklist.
   ${'```'}

2. opencode.json (optional, makes the inventory always loaded):
   ${'```json'}
   { "$schema": "https://opencode.ai/config.json", "instructions": ["docs/COMPONENT_INDEX.md"] }
   ${'```'}

3. package.json scripts:
   ${'```json'}
   "scripts:anti-slop": {
     "index": "node scripts/anti-slop/generate-component-index.mjs",
     "dupes": "node scripts/anti-slop/check-duplicates.mjs"
   }
   ${'```'}
   (flatten to plain keys if you prefer: "index:components", "check:dupes")

4. ESLint: enable eslint-plugin-react-hooks (and the React Compiler eslint
   plugin if the project uses the compiler) so hook misuse fails in the linter.

5. Generate the first inventory:  node scripts/anti-slop/generate-component-index.mjs

6. Git gates (recommended):  git init && node scripts/anti-slop/install-hooks.mjs
   - pre-commit: modularity check on staged files (blocking) + duplicate report
   - pre-push: full duplicate gate + lint/typecheck/test via --if-present
   - /audit-ui in OpenCode produces a prioritized refactor plan from the same checks
`);
