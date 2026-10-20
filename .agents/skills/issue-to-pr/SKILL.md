---
name: issue-to-pr
description: Take a GitHub issue to a merged pull request. Implement it with tests, open a PR, review it, fix the findings and merge. Use when asked to implement, fix or close an issue.
---
# Issue to PR

Always pass `--repo <owner>/<repo>` to `gh`: a fork's `gh` defaults to the original repository.

## Steps
1. **Read the issue**: `gh issue view <n> --repo <owner>/<repo> --comments`. If it is ambiguous, ask before writing code.
2. **Read** `AGENTS.md` and `spec/`. Update the spec together with the code.
3. **Branch** from an up to date `main`: `git switch -c issue-<n>-<short-name>`.
4. **Implement** the issue. Add integration tests for every case it adds to the spec.
5. **Check** with the commands from `AGENTS.md`: the tests and the typecheck must pass.
6. **Commit and push** the branch. No AI attribution lines in commits or in the PR.
7. **Open the PR**: `gh pr create --repo <owner>/<repo> --base main --head <branch>`. Title: what changed. Body: `Closes #<n>`, then a few lines on the change and how to run its tests.
8. **Review** the PR with the `code-review` skill. It posts the summary and the inline comments to the PR.
9. **Fix** each comment: reproduce it with its `Repro:`, fix it, add a test. New commits, no force-push. Push, and reply on the thread with the commit.
10. **Review again** until nothing blocks. A finding you disagree with gets a reply with the reason, not silence.
11. **Merge** when CI is green and the review has nothing blocking: `gh pr merge <n> --repo <owner>/<repo> --merge`.
12. **Confirm**: CI on `main` is green, the issue is closed.

## Rules
- Stop and tell the user, rather than merge, when: CI is red and the cause is not the change, a review finding is unresolved, or the branch conflicts with `main`.
- Resolve conflicts by merging `main` into the branch, then run the checks again.
- Do not edit the issue, its labels or the PR description beyond step 7.
