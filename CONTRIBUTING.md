# Contributing

## Bug reports and gate findings

Open an issue with the exact command, the output, and the repo shape
(language, framework, package manager). Findings that reproduce win.

## Pull requests

Small and focused beats large and complete. Run `npm test` and `npm run gates`
before pushing — CI runs both on Node 20/22/24, plus the kit's own gates on
its own source.

## Preset PRs

New framework presets land as **experimental** — a PR adds
`presets/<name>/`, and promotion to `stable` is a later, separate PR that
shows the preset survived a real project. Read
[presets/README.md](presets/README.md) (the author guide) before starting;
it covers the manifest reference, preset-local skills, and the per-gate
language applicability table.

A preset PR must include:

- [ ] `presets/<name>/manifest.json` — `name` matches the directory,
      `status: "experimental"`, honest one-line description
- [ ] `presets/<name>/skills/` — framework-specific skills, namespaced by
      framework (`juce-audio-thread`, not `audio-thread`), each under
      ~150 lines, same quality bar as the kit's own skills
- [ ] `extensions` matching the language
- [ ] `config` seeds sensible `ignorePaths` for framework-generated or
      declarative files — with the drift rationale in the PR description
- [ ] Gates run on a real project of that framework; inert gates (see the
      applicability table) are named in the manifest description
- [ ] At least one genuine catch documented — a finding the preset produced
      that the base kit could not

CI validates every preset manifest automatically: it must parse, `name` must
match the directory, `status` must be `experimental` or `stable`, every
listed skill must exist (kit or preset-local), and `extensions` must be
well-formed. Broken manifests fail CI before review.

Review looks for: honest description, rules that are checkable rather than
aspirational, framework vocabulary that only makes sense in your stack, and
no invented enforcement (a rule the gates cannot express belongs in a skill,
not in config).

## License

By contributing you agree your contributions are licensed MIT, same as the
repository.
