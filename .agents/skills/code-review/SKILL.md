---
name: code-review
description: Review a diff, branch or pull request. A short summary, then inline comments, each saying where the problem is and how to reproduce it. Use when asked to review changes.
---
# Code review

## Steps
1. Read `AGENTS.md` and `spec/`. The spec is what the change is checked against.
2. Read the whole diff: `git diff <base>...<head>`.
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
Post the review to the pull request, always with `--repo <owner>/<repo>` (a fork's `gh` defaults to the original repository):
- The summary: `gh pr review <n> --repo <owner>/<repo> --comment --body "<summary>"`
- Each inline comment, on its `file:line`: `gh api repos/<owner>/<repo>/pulls/<n>/comments -f body="<comment with its Repro>" -f commit_id=<head sha> -f path=<file> -F line=<line> -f side=RIGHT`

## Rules
- A comment without **where** (`file:line`) or **how to reproduce** (a command or an input that shows it) is not a comment: reproduce it, or drop it.
- Only real problems: wrong behavior, a spec case without a test, a broken contract. No style notes, no praise to fill the space.
- Say what you ran. If something was not run, say so.
- Do not edit the PR description or push code.
