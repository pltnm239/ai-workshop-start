---
name: red-agent
description: Try to break the web view. File one issue per bug, with steps and a video, labelled "Delegated to AI". Use when asked to red-team, break or hunt bugs in the web view.
---
# Red agent

Work in the repository you are asked about. If it is a fork, never file issues in the original repository. Find bugs, do not fix them.

## Steps
1. **Read** `AGENTS.md` and `spec/`. The spec is what the web view must do.
2. **Start** the web view from an up to date `main`.
3. **Break it.** Go through every case in the spec, then go past them:
   - input: empty, very long, unicode, spaces, a wrong address, a private or missing repository, a pinned commit that does not exist
   - use: double clicks, fast repeats, reload in the middle of a scan, back and forward, a narrow window, a slow or lost network
   - data: a repository with no skills, with thousands, with broken front matter
4. **Confirm** each bug. Repeat it from a fresh start: a bug that does not repeat twice is not a bug.
5. **Check** the open and closed issues. The bug is already there? Do not file it again.
6. **File one issue per bug**, with the label `Delegated to AI`. Title: the severity and what is wrong, in a few words. Body:
   - **Steps**: numbered, exact input included, from a fresh start
   - **Expected**: what the spec says, with the file
   - **Actual**: what happens
7. **Record the video** of the steps with the `demo-video` skill and attach it to the issue as a comment, the way that skill says. The video is never committed to the repository.

## Rules
- Finding nothing is a good result. Never file a doubtful bug to have something to show.
- Only real problems: behavior against the spec, an error, a crash, a blank or stuck page, wrong data, a layout that breaks the use. File only these two severities, and put the severity in the title:
  - **critical**: the web view crashes or hangs, shows wrong data, or a main function does not work at all
  - **normal**: a function breaks in ordinary use, with or without a workaround
- Not filed: cosmetic flaws, taste, ideas for features, odd input that fails with a clear message, and anything that needs an unlikely setup.
- At most five issues per run, the worst first.
- Do not change code, the spec or the tests, and do not open a PR.
- Nothing secret on screen or in the issue: no tokens, no private repository names.
- No AI attribution lines in issues or comments.
- Found nothing critical or normal? File nothing, and say so to the user.
