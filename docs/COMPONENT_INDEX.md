# Component Index

<!-- generated: run `node scripts/anti-slop/generate-component-index.mjs` to regenerate -->

Inventory of shared layouts, components, hooks, services, and utilities under `scripts/`. Generated 2026-11-15, 7 files, 18 exports.

> Rule of use: before creating any new component, hook, or utility, check this file first (see the `reuse-before-create` skill). When you add a shared abstraction, rerun the generator and fill in the "When to use" column.

## Modules (18)

| File | Export | When to use |
|---|---|---|
| `anti-slop/cli.mjs` | `parseFlags` | Parse CLI flags uniformly across gate scripts. |
| `anti-slop/cli.mjs` | `bootstrapGate` | Common gate bootstrap: handle -h/--help with `usage`, parse flags per `spec`, |
| `anti-slop/cli.mjs` | `collectPathFiles` | Resolve explicit path arguments (files or directories) into { full, rel } |
| `anti-slop/cli.mjs` | `resolveScanTarget` | Resolve the scan root given to a gate (--src): accepts a directory (walked) |
| `anti-slop/cli.mjs` | `loadConfig` | "] }, |
| `anti-slop/cli.mjs` | `globToRegex` | Convert a glob (`**`, `*`, `?`) into a RegExp tested against '/'-separated rel paths. |
| `anti-slop/cli.mjs` | `matchesAnyGlob` | True when relPath matches any ignore glob. |
| `anti-slop/lib.mjs` | `isGenerated` | True when relPath is a generated artifact (see GENERATED_FILE). |
| `anti-slop/lib.mjs` | `walk` | Recursively list source files under `dir`, as { full, rel } with '/'-separated rel paths. |
| `anti-slop/lib.mjs` | `stripNoise` | Remove comments and string contents so brace/regex analysis is reliable. |
| `anti-slop/lib.mjs` | `tokenize` | Tokenize stripped source into normalized tokens [{ t, line }] (1-based lines): strings -> `<str>`, numbers -> `<num>`, identifiers/symbols stay literal. |
| `anti-slop/lib.mjs` | `lineOf` | 1-based line number of char index `idx` within comment/string-stripped source. |
| `anti-slop/lib.mjs` | `jsdocBefore` | Returns the first line of the JSDoc/TSDoc block immediately preceding |
| `anti-slop/lib.mjs` | `extractExports` | Extract exported declarations from source: [{ name, kind, index, desc }]. |
| `anti-slop/lib.mjs` | `EXCLUDE_DIRS` | Directories never scanned by the gates (deps, build output, tests, tooling). |
| `anti-slop/lib.mjs` | `IGNORE_FILE` | Filename patterns never gated: test/spec/story files (any JS/TS extension incl. mjs/mts) and type declaration shims. |
| `anti-slop/lib.mjs` | `GENERATED_FILE` | Generated files that must never be gated (sizes/counts are machine-owned). |
| `anti-slop/lib.mjs` | `SOURCE_EXT` | Source file extensions the gates scan. |

## Manual Notes

(Add notes here; they are preserved when the index is regenerated.)
