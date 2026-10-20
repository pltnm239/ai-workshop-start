# AGENTS.md
## Specs
Read [./spec](spec/) first. Update it with the code.
## Tests
Integration tests for every case in the spec.
## Definition of done
- All tests pass locally
- The CI build is green
- A PR is open in this repository, not in the original one
- A demo video is attached to the PR, when the change is visible in the web view

## Commands
- `npm ci`: first, in a fresh checkout
- `GITHUB_TOKEN=$(gh auth token) npm test`: the tests; the end-to-end ones scan real repositories and need the token
