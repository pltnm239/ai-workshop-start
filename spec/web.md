# Web view
`./skill-atlas serve [--port <port>]`, port 4317 by default: a **local page** with a field for a repository.
Same input and core as the CLI; *nothing is stored*, but the [theme](#theme) chosen, in the browser. Listens on `127.0.0.1` only.
## Page
- A **field**: a GitHub repository URL, an organization URL or a local directory; Enter scans
- An **organization** in the field: its repository count at the field's right, `871 repos`, *as it is typed*, before Enter; asked once per name, after a short pause
- An **organization scanned**: `27 with skills, among them`, the three repositories with the most skills, each with `N skills`, then `+24 more`, which shows the rest. A repository opens its own scan; Back shows the organization again *without scanning it again*: code search allows 10 requests a minute
- The **skills**: name, the description's *first sentence*, the root (`.claude`, `.agents`, …); sorted by name
- A **filter** over them, when there is more than one; see [Filter](#filter)
- The selected skill: name, description, path, `also in` copies, the other front matter keys, a link to the SKILL.md
- Its **SKILL.md**: the body rendered as Markdown, or the source as it is
- Warnings and errors, as in the CLI, shown on the page
- The address keeps the repository and the skill: `/?repo=<input>#<skill>`; reload shows the same
- JetBrains Air style: dark or light, gradient accent, Inter and JetBrains Mono
## Filter
- The query's **words**, in any case: a skill stays when *every word* is in its name or its description
- Every occurrence of every word is **highlighted**, in the name and in the description line
- The description line: the first sentence; when the first match is past what the list shows, the text around it, with `…`
- **Smooth**: a skill left out folds away and the others slide up; one that comes back unfolds; new highlights fade in. None with reduced motion
- The count, `<shown> of <all>`; Escape clears; Enter or ↓ selects the first match
- Back to a skill the filter leaves out clears the filter; selecting the skill already selected adds no step to the history
## Theme
- **Dark or light**: at first the system's, `prefers-color-scheme`; it follows the system as that changes
- A **toggle** at the top bar's right switches: a sun in the dark theme, a moon in the light one, labelled `Switch to the light theme` or `Switch to the dark theme`
- The choice is **kept in the browser** and wins over the system's from then on, after a reload too
- Set *before the page shows*: no flash of the other theme
- Both themes: the same gradient accent; the text readable, at least 4.5:1, on the page and its panels
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
| No theme chosen, the system light | the light theme |
| No theme chosen, the system dark or not saying | the dark theme |
| The system changes after a theme is chosen | the chosen theme stays |
| The browser keeps nothing, or keeps something else | the system's theme; the toggle still switches |
