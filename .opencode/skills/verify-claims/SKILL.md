---
name: Verify Claims
description: Reproduce a named blocker, failing check, issue number or review finding before acting on it. Trigger before bypassing a hook, weakening a gate, or fixing a "major" finding — and whenever a summary restates a blocker you did not verify this session.
---

# Verify Claims

A cited blocker is a claim, not a constraint. Claims survive compaction better
than the evidence for them: an unverified "kit bug #28" becomes context, then a
goal, then a `--no-verify`. Verify before acting.

## What to verify, and how

| Claim | Verification |
|---|---|
| Named issue (`#28`, "tracked as …") | `gh issue view <n>` in the right repo. If it does not resolve, the claim is retracted — do not cite it again. |
| Failing hook, test, typecheck or command | Run it. Keep the exact command and its actual output. A remembered failure is not a failure. |
| Code finding ("this leaks", "this is O(n²)") | `file:line` + observed vs expected + the smallest reproduction (test, script, exact trace). |
| Dependency, version or API limitation | The installed source, changelog or `npm view` — not memory, not a summary. |
| A gate outcome cited by a reviewer | The gate output itself, for the commit under review. |

## If it cannot be reproduced

Label it **suspected**, state what would confirm it, and do not act on it. In
particular:

- no `--no-verify`, no skipped hook, no "temporarily" relaxed gate;
- no threshold, baseline or ignore-glob change;
- no fix for a defect nobody has shown exists.

Record the verification command and result next to the finding. The next turn
and the next compaction inherit evidence, not a claim.

## After compaction

Re-verify any named blocker before acting on it. Context that arrived as a
summary is hearsay until the command runs again — this is the one case where
re-running something already "known" is the correct spend.

## Review findings

The same rule runs in reverse: a reviewer's finding is a claim too. Act only on
findings that name the line, the trigger and the wrong outcome. A finding
without a reproduction is `suspected` — report it, do not redesign the code
around it.

## When not to apply this

A user's report is evidence, not a claim to disprove: check it if cheap, then
act. This rule is about claims an agent makes on its own — self-reported
blockers, remembered gate failures, invented issue numbers — not about
disbelieving the person you work for.
