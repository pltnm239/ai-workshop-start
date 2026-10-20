---
name: demo-video
description: Record a short demo video of how a change works in the web view, to attach to the pull request. Use for changes a user can see in the web view, for example a feature from an issue.
---
# Demo video

## When
The change is visible in the web view: a new control, a new view, a changed behavior. For a spec, CI or CLI-only change there is no video: say so in one line in the PR.

## How
1. Start the web view from the PR's branch. Give it a GitHub token if the case scans GitHub. Stop it when done.
2. Open the page in a browser and record the browser window. 10 to 40 seconds.
3. Play one case from the table, or write one for the issue. Slowly: type the input, wait for the result, stay on the result for two seconds.
4. Look at the video, or at frames from it. A blank page or an error on screen: record again.
5. Upload the video into a **comment on the PR**, through the browser: open the PR signed in to GitHub, drop the file into the comment box, wait for the upload to finish, then post the comment. One line in it: what the video shows. Under 10 MB, as a GIF or an MP4.
6. A new case that will repeat goes into the table below, in the same PR.

## Cases
Pinned commits, so the video is the same every time.

| Case | Input | Steps | Shows |
| --- | --- | --- | --- |
| Scan | `github.com/JetBrains/koog/tree/22e342e033c716f835312dd6cbe83193e1cbcf76` | Enter the input, press Enter, open a skill | 2 skills, the SKILL.md rendered |
| Copies | `github.com/JetBrains/MPS/tree/d7e4f5c1394535b05e90dde6e3e7e8a3f3e174a2` | Scan, open `actions` | `also in .claude/skills/actions/SKILL.md` |
| Filter | the same MPS input | Scan, type `mps-aspect` in the filter, then Escape | 42 skills narrowed to the matches, then back |
| Local | the repository's own `fixture` directory | Scan | 3 skills, the warning for the malformed one |
| Organization | `github.com/JetBrains` | Scan | the repositories with skills (live, can be slow) |

## Rules
- **Never put the video in the repository**: not in a commit, a branch or a file of the PR. GitHub keeps the uploaded file itself.
- No browser signed in to GitHub? Do not fall back to a commit. Say in the PR that the video was recorded but not uploaded, and where the file is.
- No secrets on screen: never type or show the token.
- Under 40 seconds, one case per video.
- No AI attribution in the video name or in the PR text.
