---
name: Deslopping
description: Rules for de-slopping existing code — re-deriving domain boundaries from evidence before splitting a monolith, verifying (and deleting) the previous author's banding comments and folder names, and removing fake seams and dead abstractions. Trigger when refactoring or splitting legacy/large files, when a section comment or "domain" name looks wrong, or when planning a cleanup of code you did not write.
---

# Deslopping

De-slopping is not moving code. It is **re-establishing boundaries that were
never real**. A split that preserves the original author's confusion is slop
redistribution, not de-slopping.

## 1. Name the mode

- **New code** — `reuse-before-create` + `modular-architecture`.
- **Existing code (this skill)** — the input is untrusted. Comments, folder
  names, section banners and the file's current order are **claims**. Verify
  each against behavior before preserving it.

## 2. Band by domain, never by position

A band is a set of members that share at least one of:

- **state** — they read/write the same fields or module state;
- **change reason** — they change for the same product/regulatory reason;
- **consumer** — the same caller, screen, or job uses them together;
- **data flow** — they form one pipeline (parse → validate → persist).

**The independence test:** members of different bands must be able to change
without touching each other. If every change to one forces a change in the
other, they are the same band — or the cut is in the wrong place.

Never band by: line ranges, file order, "looks similar", or the previous
author's comments.

## 3. The previous author's banding is evidence, not truth

Slop signatures — treat every one as a claim to check:

| Signal | What it usually means |
|---|---|
| `// --- Utils ---` over mixed code | a grab-bag was labeled a domain |
| `// domain: billing` on code that also auths and formats | the label is aspirational or stale |
| A "domain" spanning persistence, HTTP and validation | layers were flattened into one file |
| Two halves of one feature in distant regions | edit history won, not design |
| `helpers.ts`, `common/`, `manager.ts` | an ownerless bucket |

For each claimed band, list its members' state, consumers and change reasons.
If the list gives two different answers, **the band is fiction**: re-derive the
real one and rewrite or delete the comment. Carrying a false banner into a new
file copies the slop and makes it look intentional.

## 4. Evidence inventory (before any move)

For every member: name, size, every `this.*`/import it touches (state vs
behavior), its callers, and the commits that recently touched it (co-change
clustering). Then cluster. Sharing a prefix is not sharing a domain.

Write the result down as a **band map** — one line per band:
`band: name — members — shared state — consumers — why they cohere`.
No band map, no split.

The band map is a **required artifact of the task report**: a split with no
written band map cannot be reviewed, so it cannot be accepted.

## 5. Remove before you move

- **Fake seams**: modules that only re-export a closure, or wrap with no
  independent behavior.
- **Dead abstractions**: one-implementation interfaces, unused indirection.
- **False bands and their comments** (section 3).
- **Duplicated blocks** — dedupe first, or the clone moves into the new file
  (see `abstraction-review`: incidental vs systemic).
- **Ownerless buckets**: `utils`/`helpers`/`common` — give each member a real
  owner or delete it.

## 6. Is it de-slopping or redistribution?

Any "no" means stop; the split is redistribution:

1. Can each new module be described without saying "part of the old one"?
2. Did band membership come from section 4's evidence, not line ranges or
   existing comments?
3. Do the new modules import each other far less than the old file's internals
   did?
4. Did the duplicates total fall or stay level (never rise)?
5. Would a reviewer reading one module understand why its members are together?

## 7. Order of work

1. Evidence inventory → band map (sections 3–4).
2. Remove fake seams, dead abstractions, false bands (section 5).
3. Split one band per commit using the `modular-architecture` checklist.
4. Run the redistribution test; delete empty modules and stale comments.
5. Leave the tree smaller or simpler — never just rearranged.

## Anti-patterns

- `part-1.ts` … `part-4.ts` cut by line count and called modular.
- Preserving a `// --- Admin ---` banner over code that also bills.
- Keeping `helpers.ts` because it was already there.
- Moving a clone into the new file, then updating the baseline.
- Splitting because the budget fired, with no band map.
- A "de-slop" that leaves the same methods, dependencies and comments.
