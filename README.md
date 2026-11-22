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

## Contents

- [Quick start](#quick-start)
- [The problem](#the-problem)
- [What it catches](#what-it-catches)
- [What a session looks like](#what-a-session-looks-like)
- [What's inside](#whats-inside)
- [How enforcement works](#how-enforcement-works)
- [The component index](#the-component-index)
- [Tuning per repo](#tuning-per-repo-anti-slopconfigjson)
- [Baseline mode](#adopting-a-repo-with-legacy-debt-baseline-mode)
- [What counts as duplication](#what-counts-as-duplication--and-what-doesnt)
- [Proven on a real codebase](#proven-on-a-real-codebase)
- [Tests and self-enforcement](#tests-and-self-enforcement)
- [FAQ](#faq)
- [Scope and limitations](#scope-requirements-and-limitations)
- [Framework presets](#framework-presets-experimental-mechanism)
- [Contributing](#contributing)

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
any project. It writes `opencode.json` (creating it, or merging the entry into
an existing config) so `docs/COMPONENT_INDEX.md` is loaded into every session —
the inventory is only a reuse mechanism if the agent starts with it. It prints
the steps that cannot be safely automated: an `AGENTS.md` snippet,
`package.json` scripts, and the ESLint hooks plugin.

Skills are auto-discovered by OpenCode from `.opencode/skills/` in the target
repo — no registration needed. They are advertised to the model by their
`description` and load on demand via the `skill` tool. The `/audit-ui` command
arrives with the kit and produces a prioritized refactor plan from the same
deterministic checks.

## Documentation

| Doc | What it is |
|---|---|
| [presets/README.md](presets/README.md) | **Preset author guide** — manifest reference, preset-local skills, per-gate language applicability, the experimental→stable promotion bar |
| [CONTRIBUTING.md](CONTRIBUTING.md) | PR flow, the preset PR checklist, review criteria |
| [docs/COMPONENT_INDEX.md](docs/COMPONENT_INDEX.md) | The kit's **own generated component index** — a live example of the artifact your repo will get |
| [anti-slop.schema.json](anti-slop.schema.json) | JSON schema for `anti-slop.config.json` — point `$schema` at it for editor autocomplete |
| [.opencode/skills/](.opencode/skills/) | Each skill's full rules live in its `SKILL.md` — the tree below only summarizes |
| [AGENTS.md](AGENTS.md) | Conventions for working on the kit itself |

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
| Splits that redistribute slop under new file names | `deslopping` skill: band map + redistribution test |
| Undocumented shared exports, stale component inventory | docs gate + index generator |
| Load-bearing domain rules buried in UI components | `abstraction-review` skill (post-refactor) |

A blocked commit looks like this:

```text
[anti-slop] modularity check on staged files...
src/lib/monolith.ts (612 lines):
  [file] line 1: 612 lines (> 500)
  [function] line 16: 93 lines (> 80)
  [class] line 1: class ReportOrchestrator: 12 methods (> 10)

[x] Modularity check FAILED.
    Fix: split by responsibility (see the modular-architecture skill) — transport/service/domain/data,
    smaller functions, smaller public surfaces. Do NOT compress code, raise budgets, or disable the check.
```

Every failure message names the fix and the skill that owns it. Gate thresholds
are per-repo tunable; weakening the check to pass it is the one forbidden fix.

## What a session looks like

You ask for a feature: *"add a booking history page for clients."* With the
kit installed, the agent does this:

**1. Pre-flight (auto-triggered skill).** Before writing anything, the agent
loads `reuse-before-create`, reads `docs/COMPONENT_INDEX.md`, greps the tree,
and checks `package.json` — by concept, not just by name.

**2. Reuse Plan, stated before code:**

```text
Reuse Plan:
1. Reusing:    layouts/TwoColumnLayout.tsx (sidebar slot for the filters)
2. Reusing:    lib/client-data.ts — getBookingsForClient
3. Extending:  components/carer/ClientFilters.tsx via a new `range` variant prop
4. New:        components/carer/BookingHistoryTable.tsx (colocated; promoted to
               shared only when the portal needs it)
```

No new files beyond what the plan declares. "Nothing new" in the plan and new
files in the diff is defined as a bug in the plan.

**3. Composition rules apply.** The page composes the shared layout with
slots; the table component stays presentational; fetching lives in the
container. If the page re-implemented a layout that exists, the
`layout-composition` skill's rules apply.

**4. End-of-task gate.** The agent runs typecheck, lint, targeted tests, then
the deterministic gates, then regenerates the index if it added shared
exports.

**5. Commit and push.** The pre-commit hook checks the staged files; the
pre-push hook runs the full gates plus the project's lint/typecheck/test.

**6. Periodic deep sweep.** `/audit-ui` runs all the checks at high
sensitivity and returns a ranked refactor plan — duplication clusters,
monoliths to split, layout rewrites waiting to happen, undocumented exports.

If the agent skips the pre-flight anyway, the gates catch it at commit — the
layers are independent on purpose.

## The component index

`docs/COMPONENT_INDEX.md` is the kit's central artifact: a generated inventory
of every shared export, which the reuse pre-flight is grounded in.

```markdown
## Components (47)

| File | Export | When to use |
|---|---|---|
| `components/ui/AppContainer.tsx` | `AppContainer` | Standard width/padding wrapper for every screen |
| `components/ui/PageHeader.tsx` | `PageHeader` | Page title with optional back link and subtitle |
```

- The **"When to use" column comes from the JSDoc** above each export —
  documentation and inventory are the same act, and the docs gate blocks
  commits with undocumented shared exports.
- Agents read this before creating anything; a stale index causes
  duplication, so CI asserts freshness (`--check`) and the docs gate can't
  pass with a stale entry.
- Regeneration is one command; a `## Manual Notes` section survives it.

**Two tiers, because the full index is unbounded.** Every export adds a row,
and the file is loaded into each session — 168 exports is already ~22k
characters (~5.5k tokens). So the generator also writes
`docs/COMPONENT_INDEX.digest.md`: one line per **module** (bounded by file
count, capped at 120 modules), naming its exports. That digest is what
`opencode.json` loads; the full index stays on disk as the source of truth and
is grepped for descriptions once a shortlist exists. Both files are verified by
`--check`, so neither can go stale.

## Proven on a real codebase

The kit's first adoption was a production **Next.js 16 + Payload 3
care-records system** (~90 source files, SQLite, 78 integration tests).
Measured results at the shipped thresholds:

| Metric | Before | After |
|---|---|---|
| Logic-level duplication (min-tokens 50) | 17.4% | **0.0%** |
| Undocumented shared exports | 89 | **0** |
| Oversized page components (one was a 257-line function) | 4 | **0** |

The gates also drove real refactors, not just deletions: tag-in/tag-out
server actions merged into one access-checked path, a load-bearing DBS
evidence rule moved out of a UI component into `src/lib/`, five page
preambles collapsed into one `getClientPageContext()` — and the
kit's own agent found a bug in the kit itself (a regex attaching the wrong
JSDoc to every export). Everything above was verified by the project's
78 integration tests plus e2e.

## FAQ

**Do I need OpenCode?** No. The scripts, git hooks, CI template and schema
work in any repo with any (or no) AI agent. The skills need OpenCode
natively, or Claude Code by copying them to `.claude/skills/`.

**Monorepos?** Point each package's config at its own `src` (`"src":
"packages/app/src"`), and put an `AGENTS.md` in the package — OpenCode
discovers skills and configs at every level.

**Does it slow down commits?** Pre-commit checks only the staged files
(modularity + docs) — typically a second or two. The full-tree duplicate and
import gates run at pre-push and CI. Skips are printed, never hidden.

**Can I adopt without cleaning existing debt first?** Yes — that's what
[baseline mode](#adopting-a-repo-with-legacy-debt-baseline-mode) is for:
snapshot today's debt, gates fail only on new violations, shrink the
baseline as you clean up.

**What if the agent ignores the skills?** Skills are prompt-level and
auto-load by trigger description, but they are not a guarantee — that's why
the layers are independent. The hooks and CI fail on violations regardless
of what the model did.

**Can I use just the gates?** Yes. Delete `.opencode/` after installing and
keep `scripts/anti-slop/`, the hooks and the config — everything still works
agent-free.

**My framework isn't React or Node?** The clone detector and (for brace
languages) the modularity gate work on other languages today; the
docs/import gates are JS-only and say so when they are inert. See
[presets/README.md](presets/README.md) for what a language preset can and
cannot claim.

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
                                Includes the decomposition rule, the band-by-domain
                                rule, the 7-point split checklist and the
                                lazy-fix red flags.
  deslopping/                   Existing code is untrusted: treat the previous
                                author's section banners and folder names as
                                claims, re-derive bands from state/consumers/
                                co-change, write a band map, remove fake seams,
                                and apply the redistribution test before any split.
  abstraction-review/           Post-refactor review for duplication that has
                                not happened yet: load-bearing rules left in UI
                                components, structural twins, near-clone triage,
                                incidental vs systemic duplication (N>=3) and
                                the never-relocate-debt baseline rule. Reports
                                with a cost-ranked contract; never auto-extracts.
  verify-clean-code/            End-of-task gate: typecheck -> lint -> tests ->
                                duplicate + modularity + docs checks -> index
                                freshness -> abstraction review for refactors.

.opencode/commands/
  audit-ui.md                   /audit-ui — prioritized refactor plan built from
                                the deterministic checks (duplication, monoliths,
                                layout reuse, missing docs, misplaced logic).
  deslop.md                     /deslop — evidence-first de-slopping plan: band
                                map, false-band audit, removals, ordered split
                                steps, structural acceptance table. `apply` runs it.

scripts/anti-slop/
  lib.mjs                       Shared scanning helpers (walk, stripNoise,
                                tokenize, lineOf, export extraction).
  cli.mjs                       Shared CLI plumbing (flag parsing, gate
                                bootstrap, path resolution).
  config.mjs                    Per-repo config: load + loud validation of
                                anti-slop.config.json, scan.extensions.
  baseline.mjs                  Ratchet helpers: baseline load/save/compare
                                and the shared baselineGate flow.
  generate-component-index.mjs  Scans src/ and (re)generates docs/COMPONENT_INDEX.md;
                                pulls each export's "When to use" from its JSDoc.
  check-duplicates.mjs          Copy/paste detector (token-based, zero deps);
                                exits non-zero when duplication exceeds the
                                per-repo threshold.
  check-modularity.mjs          Monolith gate: file >500 / function >80 lines,
                                class >10 methods. Per-file mode for git hooks.
  check-imports.mjs             Import-boundary gate: circular dependencies
                                (default) plus configurable layer rules
                                (imports.deny). Per-file cycles are tree-wide.
  check-docs.mjs                Docs gate: fails when exports lack a one-line
                                "When to use" JSDoc. Per-file mode for hooks.
  check-encoding.mjs            Encoding guard: fails on double-encoded UTF-8
                                (PowerShell round-trip mojibake), BOMs, and
                                corruption that is still valid UTF-8 —
                                control pictures, LRM/RLM marks, U+FFFD.
  run-project-checks.mjs        Pre-push project checks: lockfile-based
                                package-manager detection, tsc --noEmit
                                fallback, skips printed not hidden.
  install-hooks.mjs             Installs pre-commit (staged files: modularity +
                                docs, blocking) and pre-push (duplicate, import,
                                encoding + docs-link gates, project checks)
                                git hooks.

presets/                        Framework presets: <name>/manifest.json +
                                optional preset-local skills. See
                                presets/README.md for the author guide.
templates/anti-slop-ci.yml      GitHub Actions workflow the installer drops
                                into target repos (.github/workflows/).
anti-slop.schema.json           JSON schema for anti-slop.config.json.
install.mjs                     Installs skills + commands + scripts + CI
                                template into a target repo.
```

## How enforcement works

| Layer | Mechanism | Catches |
|---|---|---|
| Skills (model) | Loaded by trigger description before relevant work | Rewritten layouts, cloned components, wrong hook usage, monolith growth — at write time |
| Component index (data) | Regenerated by script; JSDoc feeds the "When to use" column | Duplicating things that already exist because "nothing existed" |
| Duplicates gate (script) | Built-in clone detector fails on duplication above threshold | Duplicates that slip past the model |
| Modularity gate (script) | Size budgets: file >500 lines, function >80, class >10 methods | Monolithic files, god classes/functions |
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
    "maxFileLines": 500,
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
  the scanned tree**; `0` disables failing (report only). It is a **ratio**:
  adding a large clean file lowers it without removing a clone, so
  `maxDuplicatedLines` (absolute ceiling, unset by default) and a committed
  baseline are the guards against dilution — the gate checks both before the
  percentage. `ignore`: globs
  relative to the scan root for **framework-idiomatic declarative files** — their
  repetition is shape, not logic. `includeTests` (default `false`): also scan
  `*.test.*`/`*.spec.*` files — copy-pasted test scaffolding is logic that
  drifts, but intentional fixture/table-test similarity adds noise, so it is
  opt-in. Exclusions are printed on every run.
- **`modularity`** — size budgets in lines, methods and **declared exports**
  (`maxExportsPerFile`, default 20; re-exports belong to barrels and are not
  counted). Each limit has a **soft band** at `softFactor` of the hard cap
  (default 0.8): findings there print one aggregated note and exit 0, so
  pressure is visible without a cliff. A file may declare a **justified
  exception** next to the code —
  `// anti-slop: file-lines 620 — generated parse table` — honoured up to that
  number, printed on every run, and capped at `maxExceptions` (default 3) per
  repo; more than that fails as "a pattern, not an exception". Exceptions are
  per limit, so a `file-lines` exception never excuses a god class's method
  count. `ignorePaths`: globs (scan-root- or repo-relative) for files exempt
  from the budgets; the gate prints a notice naming every glob it exempts,
  because an exemption is a file the budget can no longer see. There are
  deliberately **no per-file budget overrides**: a source file over budget
  needs decomposition, not an exemption (see the `modular-architecture` skill),
  and a `fileLineOverrides` key is rejected with an explicit warning rather
  than honoured.
- **`docs`** — `ignorePaths`: files exempt from the docs gate **and excluded
  from the component index**, so the generator and the gate always agree.
  `ignoreExports`: export names that are framework configuration; the Next.js
  segment-config set is auto-defaulted when `next.config.*` exists.
- **`encoding`** — `ignorePaths`: globs exempt from the mojibake/BOM gate.
  Build output (`dist`, `dist-electron`, `build`, `out`, `.output`,
  `.svelte-kit`, `.nuxt`, `release`, `_site`, ...) is skipped automatically;
  use this for repo-specific generated directories. Exemptions are printed on
  every run.
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
- **You are not starting from zero**: the kit's own skills double as worked
  examples of the format, and framework-agnostic skills
  (`reuse-before-create`, `modular-architecture`, `deslopping`,
  `abstraction-review`, `verify-clean-code`) can be selected as-is - your preset
  only adds the framework-specific vocabulary. See
  [presets/README.md](presets/README.md).

### Installing and running a preset

```sh
# 1. install (preset skills + the base gates + config + CI template)
npx opencode-anti-slop --for <preset> --hooks

# 2. generate the inventory for the preset's language
node scripts/anti-slop/generate-component-index.mjs

# 3. run the gates and read their notices
node scripts/anti-slop/check-duplicates.mjs
node scripts/anti-slop/check-modularity.mjs
node scripts/anti-slop/check-docs.mjs      # warns INERT on non-JS languages
node scripts/anti-slop/check-imports.mjs   # warns INERT on non-JS languages
```

What a preset install changes on disk: the preset's skills (plus the
framework-agnostic kit skills) land in `.opencode/skills/`, the gates land in
`scripts/anti-slop/`, and the starter `anti-slop.config.json` carries the
preset's `scan.extensions` — which retargets **every** gate at the preset's
language. The gate output after step 3 tells you honestly what is enforcing
and what is inert: the clone detector and (for brace languages) the
modularity budgets are active; the docs/import gates print an explicit INERT
warning on non-JS languages instead of passing silently.

Everyday use is identical to the default install — agents follow the skills,
pre-commit/pre-push enforce, `/audit-ui` sweeps. Updating a preset install is
the same npx command with `--force`; removing it is deleting `.opencode/`,
`scripts/anti-slop/`, the hooks, and the CI file.

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

Framework presets adapt the kit to other stacks — see
[presets/README.md](presets/README.md) for the author guide, the manifest
reference, per-gate language applicability, and the experimental→stable
promotion bar.

## Contributing

Bug reports, PRs, and framework presets are welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md). Preset PRs are validated automatically by
CI (manifest shape, skill existence, inert-gate disclosure) and land as
`experimental` by design; promotion to `stable` is a later PR showing the
preset survived a real project.

## Reusable vs. project-specific

The skills are project-agnostic: they direct the agent to discover each repo's
own structure (`package.json`, source tree, `docs/COMPONENT_INDEX.md`) at
runtime. Tuning per project happens in the target repo's `anti-slop.config.json`
and its own `AGENTS.md` — not by editing these skills.

## License

[MIT](LICENSE)
