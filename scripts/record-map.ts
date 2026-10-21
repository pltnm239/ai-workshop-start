// Records what `claude -p --model haiku` answers for a repository's skill map, for the tests to replay:
// node scripts/record-map.ts <GitHub URL | directory> <tests/e2e/<name>.model.json>. It calls the model.
import { writeFileSync } from 'node:fs';
import { run } from '../src/commands.ts';
import { openGitHub, parseGitHubUrl } from '../src/core/github.ts';
import { openDirectory } from '../src/local.ts';
import { ask } from '../src/model.ts';

const [input, file] = process.argv.slice(2);
if (!input || !file) throw new Error('Usage: node scripts/record-map.ts <GitHub URL | directory> <file>');
const token = process.env.GITHUB_TOKEN || undefined;
let recorded: { prompt: string; answer: string } | undefined;
process.exitCode = await run(['map', input, '--ai'], {
  open: (input) => (parseGitHubUrl(input) ? openGitHub(input, { fetch, token }) : openDirectory(input)),
  scanOwner: () => Promise.reject(new Error('not an organization')),
  ask: async (prompt) => {
    const answer = await ask(prompt);
    recorded = { prompt, answer };
    return answer;
  },
  print: (text) => console.log(text),
  error: (text) => console.error(text),
});
if (recorded) writeFileSync(file, `${JSON.stringify(recorded, null, 2)}\n`);
