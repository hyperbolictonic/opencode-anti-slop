#!/usr/bin/env node
/**
 * install.mjs — install the anti-slop kit into a target repository.
 *
 * Also the npx entrypoint (`bin` in package.json):
 *   npx github:hyperbolictonic/opencode-anti-slop          # install into cwd
 *   npx github:hyperbolictonic/opencode-anti-slop ./app    # explicit target
 *   npx github:hyperbolictonic/opencode-anti-slop --hooks  # + git hooks
 *   npx github:hyperbolictonic/opencode-anti-slop --for <preset>
 *
 * Presets (presets/<name>/manifest.json) select which skills are installed,
 * the scanned file extensions, and the starter config. "default" is the
 * original React/Node kit; presets with "status": "experimental" print a
 * warning and have not been validated against real projects.
 *
 * Copies:
 *   .opencode/skills/<selected skills>   -> <target>/.opencode/skills/
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
 *   npx opencode-anti-slop [target-dir] [--for <preset>] [--force] [--hooks]
 *   node install.mjs [target-repo-dir] [--for <preset>] [--force] [--hooks]
 */

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { availablePresetNames, resolvePreset, mergeStarterConfig } from './presets/resolve.mjs';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const presetsDir = path.join(kitRoot, 'presets');

function printHelp() {
  const names = ['default', ...availablePresetNames(presetsDir)]
    .filter((v, i, a) => a.indexOf(v) === i);
  console.log([
    'Usage: npx github:hyperbolictonic/opencode-anti-slop [target-dir] [--for <preset>] [--force] [--hooks]',
    '',
    '  target-dir  defaults to the current directory',
    `  --for       install a framework preset (available: ${names.join(', ')})`,
    '  --force     overwrite kit files that already exist in the target',
    '  --hooks     also install the git pre-commit gate (requires .git)',
  ].join('\n'));
}

function fail(msg) {
  console.error(msg);
  printHelp();
  process.exit(1);
}

// --- argument parsing ---------------------------------------------------------
const kitTarget = path.resolve(kitRoot);
const argv = process.argv.slice(2);
const flags = new Set();
let forPreset = null;
let targetArg = null;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--for') {
    forPreset = argv[++i];
    if (!forPreset || forPreset.startsWith('--')) {
      fail('--for requires a preset name.');
    }
  } else if (a === '--force' || a === '--hooks') {
    flags.add(a);
  } else if (a === '-h' || a === '--help') {
    printHelp();
    process.exit(0);
  } else if (a.startsWith('--')) {
    fail(`Unknown option: ${a}`);
  } else if (targetArg === null) {
    targetArg = a;
  } else {
    fail(`Unexpected extra argument: ${a}`);
  }
}

const force = flags.has('--force');
const wantHooks = flags.has('--hooks');
const target = path.resolve(targetArg ?? process.cwd());

if (!existsSync(target) || !statSync(target).isDirectory()) {
  console.error(`Target directory not found: ${target}`);
  process.exit(1);
}
if (kitTarget === target) {
  console.error('Refusing to install the kit into itself. Pass a target directory.');
  process.exit(1);
}

// --- preset selection ---------------------------------------------------------
let selectedSkills = null; // null = every skill in the kit
let preset = null;

if (forPreset) {
  preset = resolvePreset(presetsDir, forPreset);
  if (preset) {
    selectedSkills = preset.skills;
    if (preset.status === 'experimental') {
      console.warn(
        `\n[experimental] The "${preset.name}" preset is marked experimental: it has not been\n` +
        'validated against a real project. Skills, rules and config may change or be\n' +
        'wrong. Report anything that misleads at\n' +
        'https://github.com/hyperbolictonic/opencode-anti-slop/issues\n'
      );
    }
    console.log(`Preset: ${preset.name} (${preset.status}) — ${preset.description}`);
  }
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
  if (!entry.isDirectory() || !existsSync(path.join(skillsSrc, entry.name, 'SKILL.md'))) continue;
  if (selectedSkills && !selectedSkills.has(entry.name)) continue;
  copyOverwrite(path.join(skillsSrc, entry.name), path.join(skillsDest, entry.name));
}
if (selectedSkills) {
  for (const name of selectedSkills) {
    if (!existsSync(path.join(skillsDest, name, 'SKILL.md'))) {
      console.error(`[warn] preset listed skill "${name}" but the kit does not ship it — skipped.`);
    }
  }
}

// --- preset-local skills -------------------------------------------------------
// A preset can ship its own skills in presets/<name>/skills/<skill>/SKILL.md.
// They are installed in addition to the kit skills, after them, so a preset
// skill may deliberately override a same-named kit skill. Namespacing preset
// skills by framework (e.g. juce-audio-thread) is the documented convention.
if (preset?.skillsDir && existsSync(preset.skillsDir)) {
  console.log(`[preset] installing preset-local skills from ${path.relative(kitRoot, preset.skillsDir)}`);
  for (const entry of readdirSync(preset.skillsDir, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(path.join(preset.skillsDir, entry.name, 'SKILL.md'))) {
      copyOverwrite(path.join(preset.skillsDir, entry.name), path.join(skillsDest, entry.name));
    }
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

// --- starter config -----------------------------------------------------------
// Scaffold anti-slop.config.json when the target has none, so the tuning
// surface exists from day one. A preset's manifest config takes precedence
// per section; JSON has no comments, so the reasoning for starter rules is
// printed in the manual steps below.
const configDest = path.join(target, 'anti-slop.config.json');
if (!existsSync(configDest)) {
  const base = {
    duplicates: { src: 'src', minTokens: 50, threshold: 3, ignore: [] },
    modularity: { src: 'src', maxFileLines: 500, maxFunctionLines: 80, maxClassMethods: 10 },
    docs: { src: 'src', ignorePaths: [], ignoreExports: [] },
    imports: { deny: [] },
  };
  const merged = mergeStarterConfig(base, preset?.config ?? null);
  if (preset?.extensions) {
    merged.scan = { extensions: preset.extensions };
  }
  writeFileSync(configDest, `${JSON.stringify(merged, null, 2)}\n`);
  console.log(`[ok] ${configDest} (starter — tune ignore lists to your framework's declarative files)`);
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
   - pre-push: full duplicate + import gates + lint/typecheck/test via run-project-checks
   - /audit-ui in OpenCode produces a prioritized refactor plan from the same checks

7. Layer direction (imports.deny): the import gate detects cycles out of the box;
   it enforces layer direction once you declare rules in anti-slop.config.json.
   Starter rules to adapt (paths must match your layout):

   "imports": { "deny": [
     { "from": "src/components/**", "forbid": "src/collections/**" },
     { "from": "src/app/**", "forbid": "src/collections/**" },
     { "from": "src/access/**", "forbid": "src/app/**" }
   ] }

   With no rules the gate prints a cycles-only notice so a green result is never
   mistaken for full architectural enforcement.
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
