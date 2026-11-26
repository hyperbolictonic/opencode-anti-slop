# Anti-Slop site

Source for <https://hyperbolictonic.github.io/opencode-anti-slop/>, built with
Astro 5 + Tailwind CSS v4 + daisyUI 5 and deployed to GitHub Pages by
`.github/workflows/pages.yml`.

## Local preview

```sh
npm install
npm run dev        # or: npm run preview (after a build)
npm run build
```

The dev server prints the URL including the `/opencode-anti-slop/` base, which
`astro.config.mjs` derives from the repository name. `site/README.md` is the only
instruction file here: the repo-root `AGENTS.md` governs agent behaviour, and a
second copy inside `site/` would be two sources of truth for the same rules.

## Design source

The visual system comes from the Analogue Rebellion ’83 kit. Its briefs are not
in this repository; `src/styles/global.css` holds the theme tokens, and
`public/art/` holds the original SVG assets. Keep the kit rules that still apply:

- paper `#F2E8D5`, ink `#22211E`, red `#C93632`, mustard `#E8B544`, petrol
  `#285B68`, orange `#D56B35`, muted `#655D50`;
- one strong composition per page, flat 2px rules, offset shadow only on primary
  buttons, no gradients, glass or decorative texture behind text;
- text stays legible without JavaScript; code scrolls inside its own container;
- real output, never simulated gate runs or invented versions and metrics.

## Content rules

- Every claim is traced to the repository README or a release. The field-test
  numbers are README-reported results from one project, not a benchmark.
- The catalogue lists only what the preset manifests actually contain; do not
  invent cards.
- Internal links and assets go through `sitePath()` so the project subpath keeps
  working; external links point at the upstream docs rather than duplicating
  them.
- Update the content when a release changes the facts. A stale claim is a bug.

## Checks

- `npm run build` must pass; CI runs it on every push.
- Check 320 / 768 / 1440 px, keyboard tab order, visible focus, 200% zoom,
  reduced motion, the copy-button fallback, and no page-level horizontal
  overflow.
- The kit's gates scan `scripts/` only. Astro templates are not parsed by the
  JS/TS gates — do not read a green gate run as template validation.
