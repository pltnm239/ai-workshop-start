---
name: status-update
description: Report the pull requests merged and the issues resolved since a given time and date, and post the report to a private Slack channel. Use when asked for a status update, a digest or what changed since a date.
---
# Status update

Work in the repository you are asked about. If it is a fork, report on the fork, never on the original repository.

## Steps
1. **Take the time and date** from the request, with the time zone. None given? Stop and ask for it: do not guess.
2. **Collect** what happened in the repository from that moment until now:
   - the pull requests **merged** into `main`: title, number, link, author
   - the issues **resolved**: closed as completed, with title, number, link. Closed as not planned is not resolved.
3. **Fold** an issue that a listed PR closes into that PR's line, so the work appears once.
4. **Write** the report, short:
   - the first line: the repository and the period, from and to
   - **Merged**: one line per PR
   - **Resolved**: one line per issue not already folded in
   - nothing in a section? Write "none". Never invent items to fill it.
5. **Record one video** of every fix and feature in the report, on the latest `main`, with the `demo-video` skill. One short segment per item, in the order of the report, each showing the change working. An item with no visible change in the web view, such as a spec, a test or a skill, gets no segment: the report line is enough. No browser to record with? Post the report without the video and say so in it.
6. **Post** the report to the private Slack channel from the request, with the bot token in `SLACK_BOT_TOKEN`, and attach the video to the same post. No channel in the request, or no token? Do not post: give the report and the video to the user and say why.
7. **Confirm** the post went through. It failed? Say so with the error, and give the report and the video to the user.

## Rules
- Only what is in the repository: no guesses about work in progress.
- The token is read from the environment and never printed, logged or put in the report.
- The video is never committed to the repository. It shows only what the report lists, with no secrets on screen.
- Post once per request. Do not repost to fix wording: say it is wrong and ask.
- No AI attribution lines in the report.
