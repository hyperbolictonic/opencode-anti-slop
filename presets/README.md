# Writing a framework preset

A preset adapts the kit to a framework or language. It is **data plus skills**,
not a fork: the gates (`scripts/anti-slop/`) stay shared and centrally fixed,
the preset declares what to install and how to scan.

## Layout

```
presets/<name>/
├── manifest.json          required — selects and configures
└── skills/                optional — preset-local skills
    └── <skill-name>/
        └── SKILL.md
```

Install into a real project with:

```sh
node install.mjs path/to/real-project --for <name> --force
```

(`--for default` is the original React/Node kit; omit `--for` to get it.)

## Running the preset

After install, in the target repo:

```sh
node scripts/anti-slop/generate-component-index.mjs   # inventory for your language
node scripts/anti-slop/check-duplicates.mjs           # works for nearly any language
node scripts/anti-slop/check-modularity.mjs           # brace languages: C/C++/Java/C#/JS
node scripts/anti-slop/check-docs.mjs                 # JS/TS only — prints INERT warning otherwise
node scripts/anti-slop/check-imports.mjs              # JS/TS only — prints INERT warning otherwise
```

Read the output — it tells you honestly what is enforcing:

- `scan.extensions` from the preset's manifest is in the target's
  `anti-slop.config.json`, so every gate scanned your language without extra
  flags.
- Expected inert-gate warnings (docs/import on non-JS languages) are a
  feature, not a failure: they are the gate saying "green here is not
  enforcement". Disclose them in the manifest description.
- Iterate with `--force` reinstall: change a skill in
  `presets/<name>/skills/`, reinstall into the real project, and watch what
  the agent does differently. A preset that never changes agent behavior
  is not done.
- Update an existing install with the same command + `--force`; uninstall by
  deleting `.opencode/`, `scripts/anti-slop/`, the hooks and the CI file.

## Manifest reference

```json
{
  "name": "<preset-name>",
  "status": "experimental",
  "description": "One line: what this preset is for",
  "skills": ["reuse-before-create", "modular-architecture"],
  "extensions": [".py"],
  "config": {
    "modularity": { "maxFileLines": 400 }
  }
}
```

| Field | Required | Meaning |
|---|---|---|
| `name` | yes | Must match the directory name |
| `status` | yes | `experimental` or `stable` — see lifecycle below |
| `description` | yes | One line, shown on install |
| `skills` | no | Kit skills to install. Omit to install all. Names must exist in the kit or as preset-local skills — anything else is skipped with a warning |
| `extensions` | no | File extensions the gates scan. Written into the target's starter config as `scan.extensions`; every gate honours it |
| `config` | no | Starter `anti-slop.config.json` sections, merged over the defaults. Never overwrites an existing config in the target |

## Preset-local skills

`skills/<skill-name>/SKILL.md` directories are installed alongside the kit's
skills — after them, so a preset skill may deliberately override a same-named
kit skill (avoid this; namespace instead: `juce-audio-thread`, not
`audio-thread`).

Skills are the per-framework content. This is where framework vocabulary
lives: architecture rules, framework-specific anti-patterns, the gotchas that
only make sense in your stack. Keep each skill under ~150 lines and concrete
— the same bar the kit's own skills meet.

## Use the kit's own skills as your template

Do not start from a blank page. Every kit skill is a worked example of the
format, tone and enforcement style your preset skills should meet — same
directory, same frontmatter, same sections:

- [reuse-before-create](../.opencode/skills/reuse-before-create/SKILL.md) —
  copy this structure for any pre-flight/workflow skill: numbered mandatory
  steps, an **output contract** the agent must state before writing code, and
  an anti-patterns section naming the failure modes with the reason each is
  wrong.
- [react-state-and-effects](../.opencode/skills/react-state-and-effects/SKILL.md) —
  the decision-rule style: strict bans, narrow allowed uses, numeric
  thresholds, and the *why* behind each rule in one line.
- [abstraction-review](../.opencode/skills/abstraction-review/SKILL.md) —
  the review/report style: how to make the agent produce a ranked, costed
  report instead of acting on its own ("never auto-extracts" is part of the
  contract).
- Every skill's `description` frontmatter **is the trigger** — study how each
  kit skill phrases when it loads ("Trigger when...", "Trigger BEFORE...").
  A vague description means your skill never loads when it matters.

What meets the bar:

- Rules that are checkable or decidable ("never", "only when", thresholds) —
  not aspirations.
- Named anti-patterns with the reason each is wrong.
- ~150 lines, zero filler.

And your preset does not need to rewrite what the kit already covers:
`reuse-before-create`, `modular-architecture`, `deslopping`,
`abstraction-review` and `verify-clean-code` are framework-agnostic — select
them in your manifest's
`skills` list and write **only** the framework-specific skills (for JUCE:
processor/editor separation, no allocations or blocking on the audio thread,
`juce::ignoreUnused` discipline). The default preset's manifest is a worked
example of that selection.

## Gate applicability by language — read before writing a preset

The gates are JS/TS-first and are **not equally strong for every language**:

| Gate | Works for | Inert for |
|---|---|---|
| Clone detector | Nearly any text language (token-based) | — |
| Modularity (size budgets) | Brace languages: C/C++/Java/C#/Rust/JS | Indentation-blocked languages: Python |
| Import gate (cycles + `deny` rules) | JS/TS `import`/`require` only | `#include`, Python `import`, everything else |
| Docs gate (JSDoc "When to use") | JS/TS `export` syntax only | Languages without `export` |

The gates print a **vacuous-green warning** when they parse nothing (e.g. "No
exports found in 40 file(s) — the docs gate ... is likely INERT"), so an
inert gate is visible, not silent. An experimental preset may ship with inert
gates; say which ones in the preset description. A **stable** preset should
have gates for its language's real mechanics or state plainly which are off.

For Python: the clone detector and (via a future addition) an
indentation-aware modularity gate are the realistic set — do not mark the
docs/import gates as enforcing anything.

## Lifecycle

1. `status: "experimental"` — the installer warns that the preset is
   unvalidated. Iterate against a **real project**: `--force` reinstall, run
   the gates, watch what the skills actually catch.
2. Collect evidence: which findings were real, which rules were wrong, which
   gates were inert.
3. `status: "stable"` — only after the preset has survived a real codebase,
   the same bar the `default` preset met. Building a preset without a real
   project tends to produce fiction.
4. Promote by changing one manifest line; the installer's warning
   disappears automatically.

## Checklist for a new preset

- [ ] `presets/<name>/manifest.json` with `name` matching the directory,
      `status: "experimental"`, honest `description`
- [ ] `skills/` with framework-specific skills (namespaced, <150 lines each)
- [ ] `extensions` matches the language
- [ ] `config` seeds the right `ignorePaths` for framework-generated or
      declarative files (with the drift rationale in the PR description)
- [ ] Installed with `--force` into a **real** project of that framework
- [ ] All four gates run; inert ones identified in the description
- [ ] At least one genuine catch documented (a finding the preset produced
      that the base kit could not)
- [ ] PR opened; promotion to `stable` is a later, separate PR
