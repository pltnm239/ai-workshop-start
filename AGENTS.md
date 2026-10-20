# AGENTS.md
## Specs
Read [./spec](spec/) first. Update it with the code.
## Tests
Integration tests for every case in the spec.
## Definition of done
- All tests pass locally
- The CI build is green
- A PR is open in this repository, not in the original one
- Attach a demo video to the PR, when applicable (see the `demo-video` skill)

## Commands
- `npm ci`: first, in a fresh checkout
- `GITHUB_TOKEN=$(gh auth token) npm test`: the tests; the end-to-end ones scan real repositories and need the token
