# Command line
`./skill-atlas scan <GitHub URL | directory>`
`./skill-atlas scan github.com/<owner>`: every repository of an [organization](analysis.md#organization), with how many skills each has.
`./skill-atlas map <GitHub URL | directory> [--ai]`: the skills in groups, see [Skill map](map.md).
`github.com/<owner>/<repo>/tree/<commit>` scans that commit, not the default branch; the same output with or without a token.
Prints the result **at once**; *nothing is stored*.
`GITHUB_TOKEN`, optional: a higher GitHub rate limit.
## Output
```
JetBrains/kotlin · 6 skills
build-tools-bump-gradle-api — Bumps the Gradle API…
  https://github.com/JetBrains/kotlin/blob/<commit>/…
```
- Sorted by **name**; the description's *first sentence*
- `also in <paths>` for copies; warnings go to *stderr*
## Organization output
```
JetBrains · 871 repositories, 27 with skills
MPS · 41 skills
  https://github.com/JetBrains/MPS
…
```
- Every repository with project skills: the most skills first, then by name; each with its link
- `none with skills` when there are none
