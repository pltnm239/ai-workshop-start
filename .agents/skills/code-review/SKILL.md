---
name: code-review
description: Review a diff, branch or pull request. A short summary, then inline comments, each saying where the problem is and how to reproduce it. Use when asked to review changes.
---
# Code review

## Steps
1. Read `AGENTS.md` and `spec/`. The spec is what the change is checked against.
2. Read the whole diff, from the base to the head.
3. Run the test and typecheck commands from `AGENTS.md` on the head. A failure is a finding.
4. Check: the behavior matches the spec, every spec case has an integration test, the spec is updated with the code, nothing unrelated changed.

## Output
**Summary**: three to five lines. The verdict (approve, or changes requested), what the change does, what blocks it.

**Inline comments**: one per problem, in this form:

```
path/to/file.ts:42
What is wrong, and why it matters.
Repro: the exact command or input, what happens, what the spec expects.
```

## Publish
Post the review to the pull request, in the repository the PR is in (a fork, not the original):
- The summary, as one review.
- Each inline comment on its `file:line`, with its `Repro:`.

## Rules
- A comment without **where** (`file:line`) or **how to reproduce** (a command or an input that shows it) is not a comment: reproduce it, or drop it.
- Only real problems: wrong behavior, a spec case without a test, a broken contract. No style notes, no praise to fill the space.
- Say what you ran. If something was not run, say so.
- Do not edit the PR description or push code.
