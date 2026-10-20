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
8. **Review** the PR with the `code-review` skill. It posts the summary and the inline comments to the PR. Tell the issue: `review 1 of 3`, the verdict and how many findings.
9. **Fix** each comment: reproduce it with its `Repro:`, fix it, add a test. New commits, no force-push. Push, and reply on the thread with the commit or the reason for not fixing. A comment already answered is handled (see `address-review`): do not answer it again.
10. **Review the fixes**, not the whole PR again. Only a real problem blocks. Tell the issue: `review <n> of 3`. At most 3 rounds.
11. **Merge** the PR as soon as the review has nothing blocking and CI is green. Do not wait for more review. CI still running: wait for it to finish, that is all.
12. **Confirm**: CI on `main` is green, the issue is closed. Tell the issue: merged, with the PR link.

Stopped without merging, for a reason from the rules below? Leave the PR open and tell the issue why. Comments added to it later are for `address-review`.

## Telling the issue
A comment on the issue at the places marked above.
- One to three lines each: what happened and a link. No details: they are in the PR.
- Stopped for a reason from the rules below? Tell the issue that too: why, and what is needed.

## Rules
- Stop and tell the user, rather than merge, when: CI is red and the cause is not the change, a finding is still there after its fix, the third round has blocking findings, or the branch conflicts with `main`.
- Resolve conflicts by merging `main` into the branch, then run all the checks. Stop and ask when the two changes clash in meaning, not only in text.
- Comment on the issue as above. Do not edit its description or labels, or the PR description beyond step 7.
