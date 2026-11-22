# AGENTS.md

## What this repo is

The **source kit** for a reusable OpenCode anti-slop enforcement system, applied to
your **React and Node** projects. This repo produces the enforcement artifacts;
it is not itself an app. See `README.md` for the full picture and install flow.

- **Skills** (`.opencode/skills/*/SKILL.md`): `reuse-before-create`,
  `layout-composition`, `react-composition-patterns`, `react-state-and-effects`,
  `modular-architecture`, `deslopping`, `abstraction-review`,
  `verify-clean-code`.
- **Command** (`.opencode/commands/audit-ui.md`): `/audit-ui` refactor-plan
  generator built on the deterministic checks.
- **Scripts** (`scripts/anti-slop/`): `generate-component-index.mjs` (builds
  `docs/COMPONENT_INDEX.md` from JSDoc descriptions), `check-duplicates.mjs`
  (built-in clone detector), `check-modularity.mjs` (size-budget gate),
  `check-imports.mjs` (cycle + layer gate), `check-docs.mjs` (JSDoc gate),
  `check-encoding.mjs` (mojibake/BOM guard), `run-project-checks.mjs`
  (pre-push project checks with package-manager detection),
  `install-hooks.mjs` (git pre-commit/pre-push). Shared helpers:
  `lib.mjs` (scanning), `cli.mjs` (CLI plumbing), `config.mjs` (per-repo config
  load + validation), `baseline.mjs` (ratchet).
  Zero-dependency Node ≥ 18 ESM — do not add
  runtime npm dependencies to this repo, and do not shell out to npx-based
  tools in the gates (verified: jscpd via npx scans 0 files on some Windows
  setups).
- **PowerShell 5.1 warning:** `Get-Content` reads UTF-8 as ANSI, so a
  `Get-Content`/`Set-Content` round-trip double-encodes every non-ASCII
  character (mojibake). Never round-trip repo text files through PowerShell —
  edit with tools, or use explicit UTF-8 via
  `[System.IO.File]::WriteAllText(..., [Text.UTF8Encoding]::new($false))`.
  `check-encoding.mjs` fails CI on mojibake and BOMs (found in cli.mjs,
  generate-component-index.mjs and presets/README.md this way).
- **CP1252 table warning:** the encoding gate's table must keep the five
  undefined Windows-1252 slots (0x81, 0x8D, 0x8F, 0x90, 0x9D) as `null`.
  A compacted table shifts every mapping above each gap, so a "repair"
  silently turns box-drawing characters (`├──`) into control pictures
  (U+2418 U+2400 U+2400) and em-dashes into U+2010 hyphens — still valid
  UTF-8. `check-encoding.mjs` catches the control-picture and LRM/RLM debris,
  but a file that only contained dashes leaves plausible-looking U+2010
  hyphens behind, so never trust a repair that "looks right": verify against
  the last clean commit (`git show <commit>:<file>`).
- **`install.mjs`**: copies skills + scripts into a target repo; per-repo tuning
  belongs in the target repo's `AGENTS.md`, not in these files. Framework
  presets live in `presets/<name>/manifest.json` (pure data: skills list,
  scan extensions, starter config) and are selected with `--for <preset>`.
  Presets carry a `status` field — `stable` requires validation against a real
  project; `experimental` presets warn on install and may be wrong. The kit
  repo never installs into itself (guarded).

## Working in this repo

- **Editing a skill**: keep it under ~150 lines, keep the YAML frontmatter
  (`name` + `description`) — the description is the trigger; if it's vague the
  skill won't load when needed. Skill IDs are path-derived (directory names are
  kebab-case and match).
- **Editing scripts**: keep them dependency-free and Windows-safe
  (`spawnSync` with `shell: true` for npx). Test with `node <script> --help`
  and a smoke run after changes.
- **Versions bump at publish time, not per fix.** Run
  `npm version <patch|minor>` immediately before `npm publish`. Bumping for
  every fix batch leaves holes in the published sequence (0.2.0, 0.3.0 and
  0.3.1 were tagged but superseded before they were ever published, so the
  registry jumps 0.1.12 → 0.2.1 → 0.3.2). Tags mark shipped code; the version
  number marks what users get.
- **`data/logs/`** contains Hypagon MCP server runtime logs — noise, not
  project artifacts. Never treat as requirements or code.
- Rules stated in skills/scripts must be **concrete and enforceable** — prefer
  a checkable rule ("2+ uses or >150 lines") over prose advice ("keep it DRY").

## Verified conventions for this kit

- Component index generation is heuristic (path/extension/export-name based) and
  preserves a `## Manual Notes` section on regeneration.
- The duplicates gate is a built-in token-based clone detector (string/number
  literals normalized so renamed-but-copied code is caught), must fail loudly
  (`exit 1`), and its fix guidance points at extraction, not threshold tuning.
- The modularity gate has a per-file mode (path args = staged files) so hooks
  never block on legacy code; `--report-only` always exits 0. `check-docs.mjs`
  (same per-file mode) fails on exports without a one-line JSDoc — it is the
  enforcement behind index maintenance; the generator counts undocumented
  exports but does not gate.
- JSDoc: the index generator reads the `/** ... */` block immediately above an
  export for the "When to use" column; undocumented exports are counted and
  reported.
- Gates read per-repo tuning from `anti-slop.config.json` at the repo root
  (duplicates: src/minTokens/threshold/ignore globs; modularity: budgets).
  Ignore globs match paths relative to the scan root (`collections/**`, not
  `src/collections/**`) and are always printed in gate output. CLI flags
  override the config; hooks call scripts bare, so the config governs them.
- `reuse-before-create` carries the drift principle: declarative framework
  scaffolding (Payload field configs, route tables) is shape, not duplication;
  framework primitives beat hand-rolled abstractions; extract only what can
  drift.
- Git hooks run under Git-for-Windows sh: ERE patterns need a single backslash
  (`'\.ts$'`) — a double backslash silently matches nothing and empty-matches
  make the pre-commit gate exit 0 with no output. Always smoke-test a new hook
  by running it with both a clean and a violating staged file.
- OpenCode facts (verified against docs): skills auto-discover from
  `.opencode/skills/<id>/SKILL.md`; commands from `.opencode/commands/<name>.md`
  (body = prompt template, `$ARGUMENTS` placeholder, `!`-backtick shell blocks);
  target repos register extra instruction files via the `instructions` array
  in `opencode.json`.
