---
name: address-review
description: Answer the open review comments on a pull request. Fix each one, reply with the commit, and merge when nothing blocks. Use when a PR has review comments nobody answered, for example after an issue-to-pr session ended.
---
# Address review

Work in the repository of the PR. If it is a fork, never touch the original repository. One PR at a time: the one in the task, or each open PR.

## Handled
A review comment is **handled** when its thread has a reply from us that names the fixing commit, or the reason for not fixing it. Never answer a handled comment again.

`issue-to-pr` uses this rule too. Both can work on the same PR, so look again for our reply right before posting one.

## Steps
1. **Find** the comments that are not handled. None: stop, say nothing.
2. **Count the rounds**: the issue's comments say `review <n> of 3`. Already 3: stop and tell the issue why.
3. **Fix** each one: reproduce it with its `Repro:`, fix it, add a test. New commits, no force-push. Run the checks from `AGENTS.md`. Push.
4. **Reply** on each thread with the commit, or the reason for not fixing it.
5. **Review the fixes**, not the whole PR again. Only a real problem blocks: wrong behavior, a spec case without a test, a broken contract. Tell the issue: `review <n+1> of 3`, and the verdict.
6. **Merge** when CI is green and nothing blocks. Check CI on `main` and that the issue is closed. Tell the issue: merged, with the PR link.

## Stop and tell the issue
Do not merge, and say why and what is needed, when:
- a finding is still there after its fix: the same Repro fails again
- CI is red and the cause is not the change
- the branch conflicts with `main`: merge `main` into the branch, run the checks, and stop if the two changes clash in meaning, not only in text
- the third round has blocking findings

## Rules
- Comments on the issue: one to three lines, what happened and a link.
- No AI attribution lines in commits or replies.
- Do not edit the issue or PR description, or the labels.
