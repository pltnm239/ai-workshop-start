// The decisions in spec/map.md, checked on what `skill-atlas map` prints, with a recorded model answer
// in place of claude -p: the model is never called.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createBrowserBackend } from '../src/browser.ts';
import { run } from '../src/commands.ts';
import { mapPrompt } from '../src/core/map.ts';
import { replayModel } from '../src/core/replay.ts';
import type { Source } from '../src/core/scan.ts';
import { CLI, EXAMPLE_COMMIT, FIXTURE } from './helpers.ts';

type Fake = { name: string; description?: string };

/** A repository with these skills, each in `.claude/skills/<name>`. */
function source(skills: Fake[]): Source {
  const files = new Map(skills.map(({ name, description = '' }) => [`.claude/skills/${name}/SKILL.md`, `---\nname: ${name}\ndescription: ${description}\n---\n`]));
  const repository = { id: 'JetBrains/example', organization: 'JetBrains', name: 'example', url: 'https://github.com/JetBrains/example', commit: EXAMPLE_COMMIT };
  const read = async (path: string) => (files.has(path) ? new TextEncoder().encode(files.get(path)) : undefined);
  return { repository, paths: [...files.keys()], warnings: [], read };
}

/** `skill-atlas map x [--ai]` over these skills; the model answers `answer` to the prompt for them. */
async function map(skills: Fake[], options: { ai?: boolean; answer?: string } = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const prompts: string[] = [];
  const recorded = replayModel(options.answer === undefined ? [] : [{ prompt: mapPrompt('JetBrains/example', sorted(skills)), answer: options.answer }]);
  const code = await run(['map', 'x', ...(options.ai ? ['--ai'] : [])], {
    open: async () => source(skills),
    scanOwner: () => assert.fail('not an organization'),
    ask: (prompt) => (prompts.push(prompt), recorded(prompt)),
    print: (text) => stdout.push(text),
    error: (text) => stderr.push(text),
  });
  return { code, stdout: stdout.join('\n'), stderr: stderr.join('\n'), prompts };
}

const sorted = (skills: Fake[]) => [...skills].sort((a, b) => (a.name < b.name ? -1 : 1)).map(({ name, description = '' }) => ({ name, description }));

const answer = (groups: Record<string, string[]>) => JSON.stringify({ groups: Object.entries(groups).map(([name, skills]) => ({ name, skills })) });

test('map: the groups, the most skills first, then by name, `other` last; in a group, the skills by name', async () => {
  const mapped = await map([{ name: 'jewel-ui' }, { name: 'write-evals' }, { name: 'android-tests' }, { name: 'jewel-swing-interop' }, { name: 'android-lint' }, { name: 'android-build' }]);
  assert.equal(mapped.code, 0, mapped.stderr);
  assert.equal(
    mapped.stdout,
    [
      'JetBrains/example · 6 skills in 3 groups',
      'android · 3 skills',
      '  android-build',
      '  android-lint',
      '  android-tests',
      'jewel · 2 skills',
      '  jewel-swing-interop',
      '  jewel-ui',
      'other · 1 skill',
      '  write-evals',
    ].join('\n'),
  );
});

test('map: the words of the names first, then of the descriptions’ first sentences', async () => {
  const mapped = await map([
    { name: 'jewel-ui', description: 'Build Compose UI. Gradle is mentioned later.' },
    { name: 'jewel-interop', description: 'Swing interop.' },
    { name: 'compose-preview', description: 'Preview Compose code.' },
    { name: 'gradle-sync', description: 'Sync Compose projects.' },
    { name: 'gradle-cache' },
  ]);
  // `compose` is in three descriptions, but the names group first: jewel-ui is already taken. And `gradle`
  // after the first sentence of jewel-ui does not count.
  assert.deepEqual(groups(mapped.stdout), { jewel: ['jewel-interop', 'jewel-ui'], gradle: ['gradle-cache', 'gradle-sync'], other: ['compose-preview'] });
});

test('map: a tie goes to the first word in alphabetical order; plurals fold, stopwords and short words do not count', async () => {
  const mapped = await map([
    { name: 'lint-checks', description: 'Use when the user writes a new check.' },
    { name: 'check-style', description: 'Use the style.' },
    { name: 'ui-style' },
    { name: 'ui-tests' },
  ]);
  // `check` and `style` both have two; `check` first. `ui` is too short, `use`, `the`, `when` say nothing.
  assert.deepEqual(groups(mapped.stdout), { check: ['check-style', 'lint-checks'], other: ['ui-style', 'ui-tests'] });
});

test('map: a word in more than half of four or more skills is skipped', async () => {
  const mapped = await map([{ name: 'mps-editor' }, { name: 'mps-editor-menus' }, { name: 'mps-tests' }, { name: 'mps-build' }, { name: 'teamcity-build' }]);
  assert.deepEqual(groups(mapped.stdout), { build: ['mps-build', 'teamcity-build'], editor: ['mps-editor', 'mps-editor-menus'], other: ['mps-tests'] });
});

test('map: a skill that shares no word → `other`', async () => {
  const mapped = await map([{ name: 'commits' }, { name: 'registry' }]);
  assert.equal(mapped.stdout, ['JetBrains/example · 2 skills in 1 group', 'other · 2 skills', '  commits', '  registry'].join('\n'));
});

test('map: no skills → the count, no group, and the model is not asked', async () => {
  const mapped = await map([], { ai: true });
  assert.equal(mapped.code, 0, mapped.stderr);
  assert.equal(mapped.stdout, 'JetBrains/example · 0 skills');
  assert.deepEqual(mapped.prompts, []);
});

test('map ./fixture: warnings go to stderr, as in scan', () => {
  const mapped = spawnSync(process.execPath, [CLI, 'map', FIXTURE], { encoding: 'utf8' });
  assert.equal(mapped.status, 0, mapped.stderr);
  assert.equal(mapped.stdout, ['fixture · 3 skills in 1 group', 'other · 3 skills', '  code-style', '  commits', '  release-checklist', ''].join('\n'));
  assert.match(mapped.stderr, /^warning: \.agents\/skills\/release-checklist\/SKILL\.md: malformed front matter: /);
});

test('map --ai: one prompt with each skill’s name and first sentence; the recorded answer, in a code fence, is the map', async () => {
  const skills = [{ name: 'jewel-ui', description: 'Build Compose UI. With Jewel.' }, { name: 'write-evals', description: 'Write evals.' }, { name: 'commits' }];
  const mapped = await map(skills, { ai: true, answer: `Here it is:\n\`\`\`json\n${answer({ ui: ['jewel-ui'], 'quality checks': ['write-evals', 'commits'] })}\n\`\`\`\n` });
  assert.equal(mapped.code, 0, mapped.stderr);
  assert.equal(mapped.prompts.length, 1);
  assert.match(mapped.prompts[0], /JetBrains\/example/);
  assert.match(mapped.prompts[0], /\n- commits\n- jewel-ui: Build Compose UI\.\n- write-evals: Write evals\.$/);
  assert.equal(mapped.stdout, ['JetBrains/example · 3 skills in 2 groups', 'quality checks · 2 skills', '  commits', '  write-evals', 'ui · 1 skill', '  jewel-ui'].join('\n'));
});

test('map --ai: a made-up name is left out, a skill in two groups stays in the first, one left out goes to `other`', async () => {
  const skills = [{ name: 'a-skill' }, { name: 'b-skill' }, { name: 'c-skill' }];
  const mapped = await map(skills, { ai: true, answer: answer({ first: ['a-skill', 'made-up'], second: ['a-skill', 'b-skill'], empty: ['made-up'] }) });
  assert.deepEqual(groups(mapped.stdout), { first: ['a-skill'], second: ['b-skill'], other: ['c-skill'] });
});

test('map --ai: an answer that is not a skill map → a clear message, exit code 1', async () => {
  const mapped = await map([{ name: 'commits' }], { ai: true, answer: 'Sorry, I cannot help with that.' });
  assert.equal(mapped.code, 1);
  assert.equal(mapped.stderr, "The model's answer is not a skill map: Sorry, I cannot help with that.");
  const wrongShape = await map([{ name: 'commits' }], { ai: true, answer: '{"groups": [{"name": "x", "skills": "commits"}]}' });
  assert.equal(wrongShape.code, 1);
  assert.match(wrongShape.stderr, /^The model's answer is not a skill map: \{"groups"/);
});

test('map --ai: claude not installed → a clear message, exit code 1', () => {
  const mapped = spawnSync(process.execPath, [CLI, 'map', FIXTURE, '--ai'], { encoding: 'utf8', env: { ...process.env, PATH: '/nonexistent' } });
  assert.equal(mapped.status, 1);
  assert.equal(mapped.stdout, '');
  assert.equal(mapped.stderr, 'Grouping with a model needs Claude Code: claude is not on the PATH\n');
});

test('map --ai: claude fails → its message and exit code, exit code 1', () => {
  // The stand-in for claude knows no answer for the fixture: it fails, as claude would.
  const bin = fileURLToPath(new URL('e2e/bin', import.meta.url));
  const mapped = spawnSync(process.execPath, [CLI, 'map', FIXTURE, '--ai'], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
  assert.equal(mapped.status, 1);
  assert.match(mapped.stderr, /^claude -p failed, exit code 1: not recorded: Group the agent skills of the repository fixture /m);
});

test('map: an organization → a clear message, exit code 1; a wrong command line → the usage', async () => {
  const lines: string[] = [];
  const context = { open: () => assert.fail('not opened'), scanOwner: () => assert.fail('not scanned'), print: () => {}, error: (text: string) => lines.push(text) };
  assert.equal(await run(['map', 'github.com/JetBrains'], context), 1);
  assert.match(lines[0], /^A map is of one repository's skills, not of an organization: github\.com\/JetBrains\n\nUsage: skill-atlas map /);
  for (const args of [[], ['a', 'b'], ['a', '--ai', '--ai']]) assert.equal(await run(['map', ...args], context), 1);
  assert.deepEqual(lines.slice(1), Array(3).fill('Usage: skill-atlas map <GitHub URL | directory> [--ai]'));
});

test('map --ai in the browser terminal: run it from the command line', async () => {
  const browser = createBrowserBackend({ fetch: () => assert.fail('nothing fetched') });
  assert.equal(await browser.run('skill-atlas map github.com/JetBrains/example --ai'), 'Grouping with a model runs from the command line: ./skill-atlas map github.com/JetBrains/example --ai');
});

/** The printed map as `{ group: skills }`. */
function groups(stdout: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  let group = '';
  for (const line of stdout.split('\n').slice(1)) {
    if (line.startsWith('  ')) result[group].push(line.trim());
    else result[(group = line.split(' · ')[0])] = [];
  }
  return result;
}
