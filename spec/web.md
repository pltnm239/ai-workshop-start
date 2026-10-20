# Web view
`./skill-atlas serve [--port <port>]`, port 4317 by default: a **local page** with a field for a repository.
Same input and core as the CLI; *nothing is stored*. Listens on `127.0.0.1` only.
## Page
- A **field**: a GitHub repository URL or a local directory; Enter scans
- The **skills**: name, the description's *first sentence*, the root (`.claude`, `.agents`, …); sorted by name
- A **filter** over them, when there is more than one; see [Filter](#filter)
- The selected skill: name, description, path, `also in` copies, the other front matter keys, a link to the SKILL.md
- Its **SKILL.md**: the body rendered as Markdown, or the source as it is
- Warnings and errors, as in the CLI, shown on the page
- The address keeps the repository and the skill: `/?repo=<input>#<skill>`; reload shows the same
- JetBrains Air style: dark, gradient accent, Inter and JetBrains Mono
## Filter
- The query's **words**, in any case: a skill stays when *every word* is in its name or its description
- Every occurrence of every word is **highlighted**, in the name and in the description line
- The description line: the first sentence; when the first match is past what the list shows, the text around it, with `…`
- **Smooth**: a skill left out folds away and the others slide up; one that comes back unfolds; new highlights fade in. None with reduced motion
- The count, `<shown> of <all>`; Escape clears; Enter or ↓ selects the first match
- Back to a skill the filter leaves out clears the filter; selecting the skill already selected adds no step to the history
## API
`GET /api/scan?repo=<input>` → `{ repository, skills, warnings }`; each skill has `link`, `root`, `properties`, `content`, `html`
- Unreachable repository, or no input → 400, `{ error }` with the CLI's message
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
