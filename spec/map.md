# Skill map
`./skill-atlas map <GitHub URL | directory>`: a repository's skills in **groups**, by the words they share.
`./skill-atlas map <GitHub URL | directory> --ai`: grouped by a small model, `claude -p --model haiku`.
The same scan as `scan`, then the groups; *nothing is stored*. One repository: not an organization.
## Output
```
JetBrains/android · 6 skills in 3 groups
android · 2 skills
  android-studio-development
  android-studio-diagnostics-analysis
…
other · 2 skills
  write-evals
  writing-lint-checks
```
- The groups: the most skills first, then by name; `other` last. In a group, the skills by name
- Warnings go to *stderr*, as in `scan`
## Without AI
- A skill's **words**: lower case, plurals folded (`checks` → `check`, not `analysis`), no words that say nothing (`use`, `when`, `skill`, …), none under three letters
- Again and again, the word the **most ungrouped skills** share, at least two, makes a group, named after the word; a tie goes to the first in alphabetical order
- The words of the **names** first; then the words of the descriptions' *first sentences*
- A word in more than half of four or more skills is **skipped**: `mps` in JetBrains/MPS tells nothing apart
- A skill that shares no word: `other`
## With a tiny model
- One `claude -p --model haiku`, the prompt on *stdin*: the repository, each skill's name and first sentence, the answer's shape
- The answer: JSON, `{"groups": [{"name": …, "skills": [names]}]}`, maybe in a code fence or with words around it
- The tests **replay a recorded answer**, `tests/e2e/*.model.json`, through a stand-in for `claude` on the PATH: `npm run e2e` and `npm test` never call the model
- `node scripts/record-map.ts <input> tests/e2e/<name>.model.json` records a new answer: it calls the model
## Edge cases
| Case | Result |
| --- | --- |
| No skills | `<repo> · 0 skills`, no group; the model is not asked |
| A name the answer made up | left out |
| A skill in two of the answer's groups | in the first |
| A skill the answer leaves out | `other` |
| An answer that is not such JSON | `The model's answer is not a skill map: <answer>`, exit code 1 |
| `claude` not installed | `Grouping with a model needs Claude Code: claude is not on the PATH`, exit code 1 |
| `claude` fails | `claude -p failed, exit code <n>: <its message>`, exit code 1 |
| `claude` killed | `claude -p failed, killed by <signal>`, exit code 1 |
| Two skills with the same name, in two directories | both in the map |
| An answer with braces in the words around its JSON | the JSON is found |
| An organization | `A map is of one repository's skills, not of an organization: <input>`, exit code 1 |
| `--ai` in the browser terminal | a message: run it from the command line |
