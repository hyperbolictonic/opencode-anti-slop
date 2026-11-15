#!/usr/bin/env node
/**
 * install.mjs — install the anti-slop kit into a target repository.
 *
 * Also the npx entrypoint (`bin` in package.json):
 *   npx github:hyperbolictonic/opencode-anti-slop          # install into cwd
 *   npx github:hyperbolictonic/opencode-anti-slop ./app    # explicit target
 *   npx github:hyperbolictonic/opencode-anti-slop --hooks  # + git hooks
 *
 * Copies:
 *   .opencode/skills/<skills>            -> <target>/.opencode/skills/
 *   .opencode/commands/audit-ui.md       -> <target>/.opencode/commands/
 *   scripts/anti-slop/*.mjs              -> <target>/scripts/anti-slop/
 *   templates/anti-slop-ci.yml           -> <target>/.github/workflows/
 *
 * Then prints the manual setup steps that cannot be safely automated
 * (AGENTS.md snippet, opencode.json instructions, package.json scripts,
 * ESLint setup). --hooks also installs the git pre-commit gate when the
 * target is a git repo.
 *
 * Usage:
 *   npx opencode-anti-slop [target-dir] [--force] [--hooks]
 *   node install.mjs [target-repo-dir] [--force] [--hooks]
 */

import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const force = flags.has('--force');
const wantHooks = flags.has('--hooks');
const targetArg = argv.find((a) => !a.startsWith('--'));
const helpRequested = flags.has('-h') || flags.has('--help');

if (helpRequested) {
  const help = [
    'Usage: npx github:hyperbolictonic/opencode-anti-slop [target-dir] [--force] [--hooks]',
    '',
    '  target-dir  defaults to the current directory',
    '  --force     overwrite kit files that already exist in the target',
    '  --hooks     also install the git pre-commit gate (requires .git)',
  ].join('\n');
  console.log(help);
  process.exit(0);
}

const target = path.resolve(targetArg ?? process.cwd());
if (!existsSync(target) || !statSync(target).isDirectory()) {
  console.error(`Target directory not found: ${target}`);
  process.exit(1);
}
if (path.resolve(kitRoot) === target) {
  console.error('Refusing to install the kit into itself.');
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

// --- CI workflow template -----------------------------------------------------
const templateSrc = path.join(kitRoot, 'templates', 'anti-slop-ci.yml');
const templateDest = path.join(target, '.github', 'workflows', 'anti-slop.yml');
if (existsSync(templateSrc)) {
  mkdirSync(path.dirname(templateDest), { recursive: true });
  copyOverwrite(templateSrc, templateDest);
}

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
   Consider ignoring the vendored gate scripts from your repo lint:
   \`{ ignores: ['scripts/anti-slop/**'] }\` in eslint.config — they are
   self-linted by this kit's own CI.

5. Generate the first inventory:  node scripts/anti-slop/generate-component-index.mjs

6. Git gates (recommended):  git init && node scripts/anti-slop/install-hooks.mjs
   - pre-commit: modularity + docs on staged files (blocking), duplicate/import reports
   - pre-push: full duplicate + import gates + lint/typecheck/test via --if-present
   - /audit-ui in OpenCode produces a prioritized refactor plan from the same checks
`);

// --- optional hooks ------------------------------------------------------------
if (wantHooks) {
  if (!existsSync(path.join(target, '.git'))) {
    console.error('[skip] --hooks requested but no .git directory in target; run git init first.');
  } else {
    const { spawnSync } = await import('node:child_process');
    const hookScript = path.join(scriptsDest, 'install-hooks.mjs');
    if (existsSync(hookScript)) {
      const res = spawnSync(process.execPath, [hookScript], { stdio: 'inherit', cwd: target });
      if (res.error) console.error(`[warn] hook installer failed: ${res.error.message}`);
    }
  }
}
