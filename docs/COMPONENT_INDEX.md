# Component Index

<!-- generated: run `node scripts/anti-slop/generate-component-index.mjs` to regenerate -->

Inventory of shared layouts, components, hooks, services, and utilities under `scripts/`. 10 files, 34 exports.

> Rule of use: before creating any new component, hook, or utility, check this file first (see the `reuse-before-create` skill). When you add a shared abstraction, rerun the generator and fill in the "When to use" column.

## Modules (34)

| File | Export | When to use |
|---|---|---|
| `anti-slop/baseline.mjs` | `loadBaseline` | Load a baseline snapshot; null when the file is absent, warn+null when unparsable. |
| `anti-slop/baseline.mjs` | `saveBaseline` | Write a baseline snapshot with sorted keys so diffs stay stable. Merges with |
| `anti-slop/baseline.mjs` | `compareCounts` | Compare per-file counts against a baseline { rel: count }. New = file unseen or count grew. |
| `anti-slop/baseline.mjs` | `compareKindCounts` | Compare per-file/per-kind counts against a baseline { rel: { kind: count } }. |
| `anti-slop/baseline.mjs` | `compareSets` | Compare an identity set (e.g. cycle keys) against a baseline array. |
| `anti-slop/baseline.mjs` | `baselineGate` | Shared ratchet flow for count-based gates (duplicates/docs/modularity). |
| `anti-slop/baseline.mjs` | `BASELINE_FILE` | Default baseline path: gates auto-ratchet when this file exists at the repo root. |
| `anti-slop/check-imports.mjs` | `resolveSpecifier` | Resolve a relative specifier to a file inside `root`; null for packages/misses. |
| `anti-slop/check-imports.mjs` | `buildImportGraph` | Build the internal import graph: relFile -> Set<relFile> (relative imports only). |
| `anti-slop/check-imports.mjs` | `findCycles` | Find circular dependencies. Returns each cycle once, as a chain |
| `anti-slop/cli.mjs` | `parseFlags` | Parse CLI flags uniformly across gate scripts. |
| `anti-slop/cli.mjs` | `bootstrapGate` | Common gate bootstrap: handle -h/--help with `usage`, parse flags per `spec`, |
| `anti-slop/cli.mjs` | `collectPathFiles` | Resolve explicit path arguments (files or directories) into { full, rel } |
| `anti-slop/cli.mjs` | `resolveScanTarget` | Resolve the scan root given to a gate (--src): accepts a directory (walked) |
| `anti-slop/cli.mjs` | `gateArgs` | bootstrapGate plus the standard positional validation most gates share. |
| `anti-slop/cli.mjs` | `applyIgnorePaths` | Filter resolved files by a docs/duplicates-style ignore-path config: |
| `anti-slop/cli.mjs` | `loadConfig` | " }] } |
| `anti-slop/cli.mjs` | `globToRegex` | Convert a glob (`**`, `*`, `?`) into a RegExp tested against '/'-separated rel paths. |
| `anti-slop/cli.mjs` | `matchesAnyGlob` | True when relPath matches any ignore glob. |
| `anti-slop/lib.mjs` | `isGenerated` | True when relPath is a generated artifact (see GENERATED_FILE). |
| `anti-slop/lib.mjs` | `walk` | Recursively list source files under `dir`, as { full, rel } with '/'-separated rel paths. |
| `anti-slop/lib.mjs` | `stripNoise` | Remove comments and blank string contents so brace/regex analysis is |
| `anti-slop/lib.mjs` | `stripComments` | Remove comments while KEEPING string contents verbatim — used where the |
| `anti-slop/lib.mjs` | `tokenize` | Tokenize stripped source into normalized tokens [{ t, line }] (1-based lines): strings -> `<str>`, numbers -> `<num>`, identifiers/symbols stay literal. |
| `anti-slop/lib.mjs` | `lineOf` | 1-based line number of char index `idx` within comment/string-stripped source. |
| `anti-slop/lib.mjs` | `jsdocBefore` | Returns the first line of the JSDoc/TSDoc block immediately preceding |
| `anti-slop/lib.mjs` | `extractExports` | Extract exported declarations from source: [{ name, kind, index, desc }]. |
| `anti-slop/lib.mjs` | `EXCLUDE_DIRS` | Directories never scanned by the gates (deps, build output, tests, tooling). |
| `anti-slop/lib.mjs` | `IGNORE_FILE` | Filename patterns never gated: test/spec/story files (any JS/TS extension incl. mjs/mts) and type declaration shims. |
| `anti-slop/lib.mjs` | `GENERATED_FILE` | Generated files that must never be gated (sizes/counts are machine-owned). |
| `anti-slop/lib.mjs` | `SOURCE_EXT` | Source file extensions the gates scan. |
| `anti-slop/lib.mjs` | `TEST_FILE` | Filenames of test/spec files — excluded from gates by default, included when |
| `anti-slop/run-project-checks.mjs` | `detectPackageManager` | Detect the package manager from the lockfile present in `dir`. |
| `anti-slop/run-project-checks.mjs` | `typecheckCommand` | The local-binary execution for `tsc --noEmit`, per package manager. |

## Manual Notes

(Add notes here; they are preserved when the index is regenerated.)
