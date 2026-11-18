<div align="center">

```text
 █████╗   ███╗   ██╗████████╗ ██╗                 ███████╗  ██╗        ██████╗  ██████╗
██╔══██╗  ████╗  ██║╚══██╔══╝ ██║                 ██╔════╝  ██║       ██╔═══██╗ ██╔══██╗
███████║  ██╔══██║     ██║    ██║        ═════    ███████╗  ██║       ██║   ██║ ██████╔╝
██╔══██║  ██║ ╚███║    ██║    ██║                 ╚════██║  ██║       ██║   ██║ ██╔═══╝
██║  ██║  ██║ ╚████    ██║    ██║                 ███████║  ███████╗  ╚██████╔╝ ██║
╚═╝  ╚═╝  ╚═╝  ╚═══    ╚═╝    ╚═╝                 ╚══════╝  ╚══════╝   ╚═════╝  ╚═╝
```

**Stop your AI coding agent from producing slop.**

Agent skills + deterministic checks that force [OpenCode](https://opencode.ai)
(and other AI coding agents) to reuse what exists, compose instead of rewrite,
use React primitives correctly, and keep files modular — enforced at write
time, commit time, and push time.

[![ci](https://github.com/hyperbolictonic/opencode-anti-slop/actions/workflows/ci.yml/badge.svg)](https://github.com/hyperbolictonic/opencode-anti-slop/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/opencode-anti-slop)](https://www.npmjs.com/package/opencode-anti-slop)
![zero dependencies](https://img.shields.io/badge/dependencies-zero-success)

</div>

Built for **React and Node** projects. The gates run on **any JS/TS codebase**;
the skills use the standard Agent Skills format, so they also work with Claude
Code by copying them into `.claude/skills/`. The scripts and git hooks are
agent-agnostic.

## Quick start

One command — installs skills, the `/audit-ui` command, gate scripts, the CI
workflow, and (with `--hooks`) the git gates into the current directory:

```sh
npx opencode-anti-slop --hooks
```

> **npm >= 11 and installing from GitHub instead of npm?** Use
> `npx --allow-git=all github:hyperbolictonic/opencode-anti-slop --hooks`.
> The `--allow-git=all` flag is npm's gate for git-hosted packages; older npm
> runs without it. `--force` overwrites previously installed kit files; an
> explicit target dir can be passed as the first argument.

Manual equivalent (clone first, no npm involvement):

```sh
git clone https://github.com/hyperbolictonic/opencode-anti-slop.git
node opencode-anti-slop/install.mjs path/to/your-project
node scripts/anti-slop/generate-component-index.mjs   # in your project
```

Requires Node >= 18 and git. No npm dependencies — the kit installs clean into
any project. The installer prints the manual steps that cannot be safely
automated: an `AGENTS.md` snippet, optional `opencode.json` instructions,
`package.json` scripts, and the ESLint hooks plugin.

Skills are auto-discovered by OpenCode from `.opencode/skills/` in the target
repo — no registration needed. They are advertised to the model by their
`description` and load on demand via the `skill` tool. The `/audit-ui` command
arrives with the kit and produces a prioritized refactor plan from the same
deterministic checks.

## The problem

AI agents write code that works and rots: the same layout rebuilt per page, the
same helper rewritten in three files, `useEffect` doing derived-state work,
one 400-line file doing six jobs. Prompts like "keep it DRY" drift within a
session and vanish between sessions. What does not drift is a script that exits
non-zero — so this kit pairs model-level skills with deterministic gates:

- the **agent** is instructed (skills) to check before building;
- the **inventory** (`docs/COMPONENT_INDEX.md`, generated) tells it what exists;
- the **gates** (scripts) catch whatever slips through;
- the **hooks** (git) make violations fail loudly at commit and push.

## What it catches

| Slop pattern | Caught by |
|---|---|
| Rewritten layouts instead of reused components | `reuse-before-create` + `layout-composition` skills |
| Duplicated components, hooks, utils, server actions | duplicate gate (token-based clone detection) |
| Misused `useEffect`, premature `useMemo`/`useCallback`, Context abuse | `react-state-and-effects` skill |
| Monolithic files, god classes, oversized functions | modularity gate (size budgets) |
| Undocumented shared exports, stale component inventory | docs gate + index generator |
| Load-bearing domain rules buried in UI components | `abstraction-review` skill (post-refactor) |

A blocked commit looks like this:

```text
[anti-slop] modularity check on staged files...
src/lib/monolith.ts (321 lines):
  [file] line 1: 321 lines (> 300)
  [function] line 16: 93 lines (> 80)
  [class] line 1: class ReportOrchestrator: 12 methods (> 10)

[x] Modularity check FAILED.
    Fix: split by responsibility (see the modular-architecture skill) — transport/service/domain/data,
    smaller functions, smaller public surfaces. Do NOT compress code, raise budgets, or disable the check.
```

Every failure message names the fix and the skill that owns it. Gate thresholds
are per-repo tunable; weakening the check to pass it is the one forbidden fix.

## What's inside

```
.opencode/skills/
  reuse-before-create/          Mandatory pre-flight: search inventory + package.json
                                before creating ANY new file. Rule of Two, extend
                                don't clone, adapter pattern for external services.
  layout-composition/           Pages with the same structure share ONE skeleton
                                (2-column, dashboard, settings) filled via slots;
                                page-specific widgets are sub-components.
  react-composition-patterns/   Data/UI separation, slots & children over prop
                                drilling, compound components, colocation.
  react-state-and-effects/      useEffect/useMemo/useCallback/Context decision
                                rules with explicit bans and gotchas.
  modular-architecture/         UI and non-UI: single-responsibility modules,
                                ports & adapters with injected dependencies, OO
                                composition, no god files/classes/functions.
  abstraction-review/           Post-refactor review for duplication that has
                                not happened yet: load-bearing rules left in UI
                                components, structural twins, near-clone triage.
                                Reports with a cost-ranked contract; never
                                auto-extracts.
  verify-clean-code/            End-of-task gate: typecheck -> lint -> tests ->
                                duplicate + modularity + docs checks -> index
                                freshness -> abstraction review for refactors.

.opencode/commands/
  audit-ui.md                   /audit-ui — prioritized refactor plan built from
                                the deterministic checks (duplication, monoliths,
                                layout reuse, missing docs, misplaced logic).

scripts/anti-slop/
  lib.mjs                       Shared scanning helpers (walk, stripNoise,
                                tokenize, lineOf, export extraction).
  cli.mjs                       Shared CLI/config plumbing (flag parsing,
                                per-repo config, path resolution).
  generate-component-index.mjs  Scans src/ and (re)generates docs/COMPONENT_INDEX.md;
                                pulls each export's "When to use" from its JSDoc.
  check-duplicates.mjs          Copy/paste detector (token-based, zero deps);
                                exits non-zero when duplication exceeds the
                                per-repo threshold.
  check-modularity.mjs          Monolith gate: file >300 / function >80 lines,
                                class >10 methods. Per-file mode for git hooks.
  check-imports.mjs             Import-boundary gate: circular dependencies
                                (default) plus configurable layer rules
                                (imports.deny). Per-file cycles are tree-wide.
  check-docs.mjs                Docs gate: fails when exports lack a one-line
                                "When to use" JSDoc. Per-file mode for hooks.
  install-hooks.mjs             Installs pre-commit (staged files: modularity +
                                docs, blocking) and pre-push (duplicate +
                                import gates + lint/typecheck/test) git hooks.

templates/anti-slop-ci.yml      GitHub Actions workflow the installer drops
                                into target repos (.github/workflows/).
install.mjs                     Installs skills + commands + scripts + CI
                                template into a target repo.
```

## How enforcement works

| Layer | Mechanism | Catches |
|---|---|---|
| Skills (model) | Loaded by trigger description before relevant work | Rewritten layouts, cloned components, wrong hook usage, monolith growth — at write time |
| Component index (data) | Regenerated by script; JSDoc feeds the "When to use" column | Duplicating things that already exist because "nothing existed" |
| Duplicates gate (script) | Built-in clone detector fails on duplication above threshold | Duplicates that slip past the model |
| Modularity gate (script) | Size budgets: file >300 lines, function >80, class >10 methods | Monolithic files, god classes/functions |
| Import gate (script) | Cycle detection + configurable `imports.deny` layer rules | Circular dependencies, domain logic importing transport |
| Git hooks (target repo) | pre-commit checks staged files only (modularity + docs); pre-push runs full gates | New violations and undocumented exports at commit time without blocking on legacy code |
| ESLint (config, target repo) | `eslint-plugin-react-hooks`, React Compiler rules | Hook dependency errors, redundant memoization |

Rules of thumb baked into the skills:

- **Rule of Two** — extract a shared abstraction only on the second use (or a
  file over ~150 lines); never clone on the first variation.
- **One skeleton, many fillers** — pages with the same structure share one
  layout template via slots; they differ in sub-components, not markup.
- **Monoliths are defects** — one responsibility per module; ports & adapters
  with injected dependencies; size budgets enforced by the gate.
- **Composition before Context** — slots/`children` before creating a Context.
- **Effects only for external sync** — derived state during render, events in
  handlers, data via the project's fetching library.
- **No threshold weakening** — fix the duplication/monolith, don't tune the check.

## Tuning per repo: `anti-slop.config.json`

Each gate reads `anti-slop.config.json` from the repo root. A JSON schema ships
with the kit (`anti-slop.schema.json`) and every key is validated on load —
unknown keys and wrong types are warned about instead of silently disabling
your tuning. Editor autocomplete:

```json
{
  "$schema": "https://raw.githubusercontent.com/hyperbolictonic/opencode-anti-slop/master/anti-slop.schema.json",
  "duplicates": {
    "src": "src",
    "minTokens": 50,
    "threshold": 3,
    "ignore": ["src/collections/**"]
  },
  "modularity": {
    "src": "src",
    "maxFileLines": 300,
    "maxFunctionLines": 80,
    "maxClassMethods": 10,
    "ignorePaths": ["src/generated/**"]
  },
  "docs": {
    "src": "src",
    "ignorePaths": ["src/collections/**"],
    "ignoreExports": ["metadata", "dynamic"]
  },
  "imports": {
    "deny": [{ "from": "src/app/**", "forbid": "src/collections/**" }]
  }
}
```

- **`duplicates`** — `minTokens`: clone window size in normalized tokens
  (lower = more sensitive). `threshold`: max duplicated-lines **percent across
  the scanned tree**; `0` disables failing (report only). `ignore`: globs
  relative to the scan root for **framework-idiomatic declarative files** — their
  repetition is shape, not logic. `includeTests` (default `false`): also scan
  `*.test.*`/`*.spec.*` files — copy-pasted test scaffolding is logic that
  drifts, but intentional fixture/table-test similarity adds noise, so it is
  opt-in. Exclusions are printed on every run.
- **`modularity`** — size budgets in lines/methods. `ignorePaths`: globs
  (scan-root- or repo-relative) for files exempt from the budgets.
- **`docs`** — `ignorePaths`: files exempt from the docs gate **and excluded
  from the component index**, so the generator and the gate always agree.
  `ignoreExports`: export names that are framework configuration; the Next.js
  segment-config set is auto-defaulted when `next.config.*` exists.
- **`imports.deny`** — dependency-direction rules: a file matching `from`
  importing a file matching `forbid` is a violation. With no rules, the import
  gate still detects circular dependencies and says so. Deny violations are
  never baselined.
- CLI flags override the config; the config overrides defaults. Hooks call the
  scripts bare, so the config governs them automatically.

## Adopting a repo with legacy debt: baseline mode

Whole-tree gates fail on pre-existing debt, and a red CI on day one trains
people to ignore it. The solution is a **ratchet baseline**: snapshot today's
debt once, and gates fail only on violations **newer** than the snapshot.

```sh
# one-time, per gate — writes/merges anti-slop.baseline.json
node scripts/anti-slop/check-modularity.mjs --update-baseline
node scripts/anti-slop/check-duplicates.mjs --update-baseline
node scripts/anti-slop/check-docs.mjs --update-baseline
```

Commit the baseline file. From then on the gates pass while the tree is no
worse than the snapshot, and fail the moment anyone adds new debt. After
cleanups, re-run `--update-baseline` to shrink the baseline — the goal is for
it to reach empty. The baseline records accepted debt; do **not** update it to
absorb new debt.

`check-imports` baselines cycles the same way; `imports.deny` layer-rule
violations are never baselined (rules are declared deliberately, so violating
one is always new).

## What counts as duplication — and what doesn't

- **Counts:** logic whose copies can drift — repeated guards, repeated
  fetch/map flows, hand-rolled helpers for what a library or the framework
  already provides.
- **Doesn't count:** declarative scaffolding a framework requires you to write.
  The dividing line is *drift*: extract a repeated block only when its copies
  could behave differently. If a declarative block embeds a real rule (e.g.
  who may read a record), extract that rule to one place and reference it —
  the config stays, the behavior is single-source.
- **Prefer the framework's own primitives** (auth, field-level access,
  validation, versions) over hand-rolled equivalents — a second source of
  truth is worse than repetition.

## Tests and self-enforcement

The gates are regression-tested with `node --test` (zero dependencies — same
constraint as the scripts). The `jsdocBefore` cases exist because a one-line
regex version of that function shipped a real bug: every export in an index
reported the file's first docblock. If you touch the scanners, `npm test` is
not optional.

```sh
npm test        # unit tests for lib.mjs and cli.mjs
npm run gates   # the kit runs its own gates on its own source
npm run index   # regenerate the kit's own component index
```

CI runs the tests and the self-gates on Node 20/22/24.

## Scope, requirements and limitations

- **Stacks:** React/Node rules in the skills; gates scan `.ts` `.tsx` `.js`
  `.jsx` `.mjs` `.mts`. Other languages need their own gates — the system
  design (inventory + drift principle + gates + hooks) still applies.
- **Heuristics, not compilers:** the clone detector tokenizes rather than
  parses; the modularity gate brace-matches rather than builds an AST. Treat
  findings as strong signals, and `anti-slop.config.json` as the way to live
  with rare false positives.
- **Agent support:** skills follow the Agent Skills format — native for
  OpenCode, copyable to `.claude/skills/` for Claude Code. The scripts and
  hooks work with any agent plus git. `/audit-ui` is OpenCode-specific.

## Framework presets (experimental mechanism)

Presets adapt the kit to other frameworks and stacks. A preset lives in
`presets/<name>/manifest.json` and is pure data: which skills to install, the
scanned file extensions, and a starter config. The installer selects one:

```sh
npx github:hyperbolictonic/opencode-anti-slop --for <preset>
```

- `default` is the original React/Node kit — everything above.
- New presets are added as a directory + manifest; no forks, no branches, no
  separate packages.

**Preset status:** every manifest carries `"status"`. `stable` presets are
validated against real projects (currently: `default`). `experimental`
presets print a prominent warning on install and have not been validated —
their skills, rules and config may change or be wrong. An experimental preset
is promoted to `stable` only after it has survived a real codebase, the same
bar `default` met. Building a preset without a real codebase to test it
against tends to produce fiction.

Manifest shape:

```json
{
  "name": "example",
  "status": "experimental",
  "description": "What this preset is for",
  "skills": ["reuse-before-create", "modular-architecture"],
  "extensions": [".py"],
  "config": { "modularity": { "maxFileLines": 400 } }
}
```

`extensions` flows into the target's starter config as `scan.extensions`,
which every gate honours. Note that gate coverage is language-bound: the
clone detector is near-universal, the modularity brace-matcher works for
C-family languages, and the import/docs gates are JS-specific — a preset can
only be as strong as the gates its language supports.

## Reusable vs. project-specific

The skills are project-agnostic: they direct the agent to discover each repo's
own structure (`package.json`, source tree, `docs/COMPONENT_INDEX.md`) at
runtime. Tuning per project happens in the target repo's `anti-slop.config.json`
and its own `AGENTS.md` — not by editing these skills.

## License

[MIT](LICENSE)
