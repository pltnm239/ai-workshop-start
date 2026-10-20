# Web view
`./skill-atlas serve [--port <port>]`, port 4317 by default: a **local page** with a field for a repository.
Same input and core as the CLI; *nothing is stored*. Listens on `127.0.0.1` only.
## Page
- A **field**: a GitHub repository URL, an organization URL or a local directory; Enter scans
- An **organization** in the field: its repository count at the field's right, `871 repos`, *as it is typed*, before Enter; asked once per name, after a short pause
- An **organization scanned**: `27 with skills, among them`, the three repositories with the most skills, each with `N skills`, then `+24 more`, which shows the rest. A repository opens its own scan
- The **skills**: name, the description's *first sentence*, the root (`.claude`, `.agents`, …); sorted by name
- The selected skill: name, description, path, `also in` copies, the other front matter keys, a link to the SKILL.md
- Its **SKILL.md**: the body rendered as Markdown, or the source as it is
- Warnings and errors, as in the CLI, shown on the page
- The address keeps the repository and the skill: `/?repo=<input>#<skill>`; reload shows the same
- JetBrains Air style: dark, gradient accent, Inter and JetBrains Mono
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
