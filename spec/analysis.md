# Repository analysis

## Input
A **GitHub repository** URL (`/tree/<commit>` pins a commit), a local directory, or a **GitHub organization** URL: `github.com/<owner>`, an organization or a user

## Output
Every **project skill**: **name**, **description**, **link**

For an organization: how many public **repositories** it has, and each repository with project skills, with **how many**; the most skills first, then by name

## Architecture
Core: fetch → find → parse. CLI and [web view](web.md): *thin clients*.
Skill: id = `repo:path`, name, description, commit, the SKILL.md content

## Details
- **GitHub API**, no clone; *under 5 s* for intellij-community
- The name: front matter, else the directory
- The link pins the *scanned commit*
- Malformed front matter → a *warning*, the scan goes on
- Unreachable repository → a clear message, exit code 1
- GitHub asks to *wait a few seconds* (code search does, for requests close together) → the scan waits, up to 10 s, and goes on; a longer rate limit → a clear message

## Organization
- **One code search** over the whole owner, at most ten pages; *under 5 s* for JetBrains. It needs a **token**: GitHub's code search does
- A repository's skills are counted as its scan finds them: the same roots, a copy counts once; *only the default branch*
- The repository count: one request, no token needed

## Project skill
A skill the repository **keeps for its own agents**: `<root>/<name>/SKILL.md`, the root at the top of the repository.
- Roots: `.agents/skills`, `.claude/skills`, `.github/skills`, `agent/skills`
- Not a project skill: any other `SKILL.md`. It belongs to the product or to the tests, not to the agents working on the repository.
- One skill is one directory *name*, however many roots hold it

## Edge cases
| Case | Example | Result |
| --- | --- | --- |
| Duplicates, one copy per agent | `.agents/skills/x`, `.claude/skills/x` | one skill; the first root wins (`.agents` before `.claude`), the others are `also in` |
| An unusual folder | `agent/skills/x` | a skill |
| Part of the product, shipped in a plugin | `plugins/p/resources/skills/x` | not a skill |
| Test data, a fixture | `src/jvmTest/resources/skills/x` | not a skill |
| Anywhere else | `tests/x`, `docs/.claude/skills/x` | not a skill |

| Organization case | Example | Result |
| --- | --- | --- |
| A repository without project skills | only `docs/.claude/skills/x` | not listed |
| No repository with project skills | `github.com/empty-org` | `none with skills` |
| No such organization or user | `github.com/nobody` | `Organization not found: https://github.com/nobody`, exit code 1 |
| No token | `GITHUB_TOKEN` unset | `Scanning an organization needs GITHUB_TOKEN: …`, exit code 1 |
| More than 1000 SKILL.md files, or the search timed out | | a *warning*: some repositories may be missing; the scan goes on |
