# Skill Atlas

Every agent skill in a repository: `./skill-atlas scan` finds each `SKILL.md` and prints its name,
description and link.

```console
$ npm ci
$ ./skill-atlas scan https://github.com/JetBrains/kotlin
JetBrains/kotlin · 6 skills
…
build-tools-bump-gradle-api — Bumps the Gradle API version that Kotlin Gradle plugins are compiled against in the Kotlin compiler repository.
  https://github.com/JetBrains/kotlin/blob/5ab6270ab772d113e8ad52ebfcaa0109c522ae00/.claude/skills/build-tools-bump-gradle-api/SKILL.md
…
```

`./skill-atlas scan https://github.com/JetBrains` counts the skills in each repository of an organization;
it needs `GITHUB_TOKEN`, for GitHub's code search.

`./skill-atlas map <repository>` groups the skills by the words they share; with `--ai`, a small model groups
them, `claude -p --model haiku`.

`./skill-atlas serve` opens the same scan as a local web page, http://localhost:4317/: a field for the
repository, its skills, and each SKILL.md rendered.

Set `GITHUB_TOKEN` for a higher GitHub rate limit. `GITHUB_TOKEN=$(gh auth token) npm test` runs the tests, the end-to-end ones scan real repositories; `npm run e2e` runs only those, and replays a recorded model answer.

- [spec/](spec/): what it does. [AGENTS.md](AGENTS.md): the definition of done.
- [fixture/](fixture/README.md): a small repository for the tests.
