# Web view
`./skill-atlas serve [--port <port>]`, port 4317 by default: a **local page** with a field for a repository.
Same input and core as the CLI; *nothing is stored*. Listens on `127.0.0.1` only.
## Page
- A **field**: a GitHub repository URL, an organization URL or a local directory; Enter scans
- An **organization** in the field: its repository count at the field's right, `871 repos`, *as it is typed*, before Enter; asked once per name, after a short pause
- An **organization scanned**: `27 with skills, among them`, the three repositories with the most skills, each with `N skills`, then `+24 more`, which shows the rest. A repository opens its own scan; Back shows the organization again *without scanning it again*: code search allows 10 requests a minute
- The **skills**: name, the description's *first sentence*, the root (`.claude`, `.agents`, …); sorted by name
- A **filter** over them, when there is more than one; see [Filter](#filter)
- The selected skill: name, description, path, `also in` copies, the other front matter keys, a link to the SKILL.md
- Its **SKILL.md**: the body rendered as Markdown, or the source as it is
- Warnings and errors, as in the CLI, shown on the page
- The address keeps the repository and the skill: `/?repo=<input>#<path>`, the skill's path, `#.claude/skills/debugging/SKILL.md`; reload, Back and Forward show the same. An address with the skill's name, `#debugging`, still opens it
- JetBrains Air style: dark, gradient accent, Inter and JetBrains Mono
- A **help button**, `?`, fixed at the bottom right of every screen; it opens the help; see [Help](#help)
## Help
- A **dialog** over the page: what Skill Atlas does, then how to scan, read and filter, and the keys. *Short*: one screen, no scrolling at 1280×720
- Closed by ✕, by Escape or by a click beside it; the focus goes back to the help button
- While it is open, the page's keys (`/`, ↑/↓, `j`/`k`) do nothing
## Filter
- The query's **words**, in any case: a skill stays when *every word* is in its name or its description
- Every occurrence of every word is **highlighted**, in the name and in the description line
- The description line: the first sentence; when the first match is past what the list shows, the text around it, with `…`
- **Smooth**: a skill left out folds away and the others slide up; one that comes back unfolds; new highlights fade in. None with reduced motion
- The count, `<shown> of <all>`; Escape clears; Enter or ↓ selects the first match
- Back to a skill the filter leaves out clears the filter; selecting the skill already selected adds no step to the history
## API
`GET /api/scan?repo=<input>` → `{ repository, skills, warnings }`; each skill has `link`, `root`, `properties`, `content`, `html`
- For an organization: `{ owner, repositories, warnings }`; the owner has `id`, `url`, `repositories` (the count); each repository `id`, `name`, `url`, `skills` (the count)
- `GET /api/owner?repo=<organization URL>` → `{ id, url, repositories }`; for the count in the field
- Unreachable repository or organization, not an organization for `/api/owner`, or no input → 400, `{ error }` with the CLI's message
## Markdown
- Headings, paragraphs, lists, quotes, code, tables, links, emphasis
- HTML in a SKILL.md is **shown as text**, never run; links only `http`, `https`, `mailto`, `file`
- Relative links resolve against the SKILL.md's link: the *scanned commit*
## Edge cases
| Case | Result |
| --- | --- |
| The port is taken | a clear message, exit code 1 |
| `serve` in the browser terminal | a message: run it from the command line |
| Malformed front matter | the skill with its directory name, the warning on the page |
| A query that matches nothing | `No skills match` |
| A query with regular expression characters, `c++` or `(x` | matched as text |
| A match only after the first sentence | the line around it, highlighted |
| Two skills with the same name | each its own address, by its path; reload shows the one selected |
## UI tests
Playwright, `tests/ui/*.spec.ts`, on a fixed server (`tests/ui/server.ts`): two recorded repositories, the second with two skills of the same name, and a recorded organization, no live GitHub, any other request is blocked.
- **Covered**: the start page, a scan and the first skill, Preview and Source, `also in` copies, HTML shown as text, the malformed front matter warning, the filter and Escape, no match, an unreachable repository, an organization with `+N more`, the address on reload, two skills with the same name on reload and Back, the help and how it closes
- **Screenshots**: every screen above is compared with `tests/ui/__screenshots__/`. **A changed pixel fails the check**: no tolerance
- **Deterministic**: shadows and backdrop blur are off in screenshots (a blur is not drawn identically on each run), fixed viewport 1280×720, scale 1, locale, time zone, dark scheme, reduced motion, animations off, one worker
- **Every run is recorded**: a video and a trace per test, an HTML report
- **Where**: screenshots are only equal in the same system, so they are made and compared in the Playwright container of the version in `package.json`, locally and in CI. On the Mac, `npm run test:ui` checks the behavior, not the pixels
- **The report in the PR**: every run, passed or failed, writes the job summary and one PR comment (updated on each run: how many tests passed, or the failed ones and why); the artifact has the expected, actual and diff images, the videos and the traces
- **An intended change**: `npm run test:ui:update`, then commit the new baselines
