// `claude -p --model haiku`, replayed: the prompt on stdin must be one of tests/e2e/*.model.json, the
// answer is the recorded one. Anything else fails as claude would, with a message and exit code 1.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { replayModel, type RecordedAnswer } from '../../../src/core/replay.ts';

const directory = fileURLToPath(new URL('..', import.meta.url));
const recordings: RecordedAnswer[] = readdirSync(directory)
  .filter((file) => file.endsWith('.model.json'))
  .map((file) => JSON.parse(readFileSync(`${directory}/${file}`, 'utf8')));

const args = process.argv.slice(2).join(' ');
if (args !== '-p --model haiku') {
  console.error(`not the expected arguments: ${args}`);
  process.exit(1);
}
let prompt = '';
for await (const chunk of process.stdin) prompt += chunk;
try {
  process.stdout.write(await replayModel(recordings)(prompt));
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
