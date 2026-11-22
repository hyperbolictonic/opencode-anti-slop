# Component Index — digest

<!-- generated: run `node scripts/anti-slop/generate-component-index.mjs` to regenerate -->

14 modules, 52 exports under `scripts/`. Full "When to use" descriptions live in [docs/COMPONENT_INDEX.md](COMPONENT_INDEX.md) — grep it by concept before creating a component, hook, or utility (see `reuse-before-create`).

| Module | Exports |
|---|---|
| `anti-slop/baseline.mjs` | 7: loadBaseline, saveBaseline, compareCounts, compareKindCounts, compareSets, baselineGate, BASELINE_FILE |
| `anti-slop/check-class-literals.mjs` | 2: normaliseClassList, extractClassLiterals |
| `anti-slop/check-docs-links.mjs` | 5: repoMarkdownFiles, githubSlug, headingSlugs, extractLinks, checkMarkdown |
| `anti-slop/check-encoding.mjs` | 5: isSuspectMojibake, hasCorruptionMarkers, utf8ToCp1252String, repairDoubleEncodedUtf8, hasUtf8Bom |
| `anti-slop/check-imports.mjs` | 3: resolveSpecifier, buildImportGraph, findCycles |
| `anti-slop/cli.mjs` | 9: parseFlags, bootstrapGate, collectPathFiles, toScanRelative, resolveScanTarget, gateArgs, applyIgnorePaths, globToRegex, … (9) |
| `anti-slop/config.mjs` | 2: scanExtensions, loadConfig |
| `anti-slop/lib.mjs` | 17: isGenerated, walk, stripNoise, stripComments, tokenize, lineOf, parseLimitExceptions, isControlFlow, … (17) |
| `anti-slop/run-project-checks.mjs` | 2: detectPackageManager, typecheckCommand |

> Capped at 120 modules so it can be loaded into every session; the full index is the source of truth.
