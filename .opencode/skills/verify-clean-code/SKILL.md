---
name: Verify Clean Code
description: Deterministic end-of-task verification — lint, typecheck, tests, duplicate-code detection, and component-index freshness. Trigger before marking ANY coding task complete.
---

# Verify Clean Code

A task is not complete when the code works; it is complete when the checks pass.
Run from the repo root. Derive exact commands from `package.json` — do not guess.

## 1. Standard verification (in this order)

1. **Typecheck** — e.g. `tsc --noEmit` (or the repo's `typecheck` script).
2. **Lint** — the repo's `lint` script. Fix violations you introduced; do not
   disable rules or add `eslint-disable` comments to pass.
3. **Targeted tests** — run only tests covering the files you changed first;
   the full suite only if the change is cross-cutting.

## 2. Duplicate-code check

Run:

```sh
node scripts/anti-slop/check-duplicates.mjs
```

It tokenizes the source tree and fails when copy-paste duplication exceeds the
threshold (defaults tuned for typical repos; adjust in the target repo if it
has legacy duplication). If it flags your new code: extract into the existing
shared module (see reuse-before-create) rather than adjusting the threshold.
Never weaken the check to make it pass.

## 3. Modularity check

```sh
node scripts/anti-slop/check-modularity.mjs
```

Flags files over ~300 lines, functions over ~80, and classes with > ~10
public methods. The files you touched must pass. If the repo has pre-existing
violations elsewhere, report them — do not drive-by-fix unrelated files.

## 4. Documentation of shared exports

Every shared component, hook, util, service, or type you added or changed must
carry a one-line JSDoc above the export:

```ts
/** Renders the standard 2-column page shell; use for any new listing/settings page. */
export function TwoColumnLayout({ sidebar, children }: TwoColumnLayoutProps) {
```

This is mechanically enforced: `node scripts/anti-slop/check-docs.mjs` fails on
undocumented exports (the pre-commit hook runs it on staged files). Rerun
`node scripts/anti-slop/generate-component-index.mjs` after adding or removing
shared exports, and confirm the new entries show their description (not `-`) in
`docs/COMPONENT_INDEX.md`.

## 5. If the task was a refactor, review what you may have missed

Gates catch duplication that exists; they cannot catch load-bearing logic left
in the wrong layer or a skeleton built twice with different fillings. When the
task extracted components, merged duplicated flows, or moved rules between
files, run the `abstraction-review` skill before reporting, and include its
"Second-order opportunities" list in the report.

## 6. Report

End the task with a short summary: checks run, results, files touched, and any
pre-existing issues you noticed but did not fix (report, don't drive-by-fix).
