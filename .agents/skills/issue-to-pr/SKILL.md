---
name: issue-to-pr
description: Take a GitHub issue to a merged pull request. Implement it with tests, open a PR, review it, fix the findings and merge. Use when asked to implement, fix or close an issue.
---
# Issue to PR

Work in the repository the issue is in. If it is a fork, never touch the original repository.

## Steps
1. **Read the issue** with its comments. If it is ambiguous, ask before writing code.
2. **Read** `AGENTS.md` and `spec/`. Update the spec together with the code.
3. **Branch** from an up to date `main`, named after the issue. Tell the issue: the branch.
4. **Implement** the issue. Add integration tests for every case it adds to the spec.
5. **Check** with the commands from `AGENTS.md`: the tests and the typecheck must pass.
6. **Commit and push** the branch. No AI attribution lines in commits or in the PR.
7. **Open the PR** into `main`. Title: what changed. Body: it closes the issue, then a few lines on the change and how to run its tests. Tell the issue: the PR link.
8. **Review** the PR with the `code-review` skill. It posts the summary and the inline comments to the PR. Tell the issue: the verdict and how many findings.
9. **Fix** each comment: reproduce it with its `Repro:`, fix it, add a test. New commits, no force-push. Push, and reply on the thread with the commit.
10. **Review again** until nothing blocks. A finding you disagree with gets a reply with the reason, not silence.
11. **Merge** the PR when CI is green and the review has nothing blocking.
12. **Confirm**: CI on `main` is green, the issue is closed. Tell the issue: merged, with the PR link.

## Telling the issue
A comment on the issue at the four places above.
- One to three lines each: what happened and a link. No details: they are in the PR.
- Stopped for a reason from the rules below? Tell the issue that too: why, and what is needed.

## Rules
- Stop and tell the user, rather than merge, when: CI is red and the cause is not the change, a review finding is unresolved, or the branch conflicts with `main`.
- Resolve conflicts by merging `main` into the branch, then run the checks again.
- Comment on the issue as above. Do not edit its description or labels, or the PR description beyond step 7.
