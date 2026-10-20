// Runs the commands the way the CLI does, with GitHub answering from EXAMPLE and ORGANIZATIONS below.
import { fileURLToPath } from 'node:url';
import { run } from '../src/commands.ts';
import { openGitHub, openOwner, parseGitHubUrl, scanOwner } from '../src/core/github.ts';
import { replay, type Recording } from '../src/core/replay.ts';
import { openDirectory } from '../src/local.ts';

export const FIXTURE = fileURLToPath(new URL('../fixture', import.meta.url));
export const CLI = fileURLToPath(new URL('../src/cli.ts', import.meta.url));

/** The commit GitHub answers for JetBrains/example. */
export const EXAMPLE_COMMIT = '5ab6270ab772d113e8ad52ebfcaa0109c522ae00';

/** What GitHub answers for a small repository, JetBrains/example, with one skill. */
const EXAMPLE: Recording = {
  'https://api.github.com/repos/JetBrains/example': { status: 200, body: { full_name: 'JetBrains/example', default_branch: 'main' } },
  'https://api.github.com/repos/JetBrains/example/commits/main': { status: 200, body: { sha: EXAMPLE_COMMIT } },
  'https://api.github.com/search/code?q=filename:SKILL.md+repo:JetBrains/example&per_page=100&page=1': {
    status: 200,
    body: { total_count: 1, items: [{ path: '.claude/skills/commits/SKILL.md' }] },
  },
  [`https://raw.githubusercontent.com/JetBrains/example/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`]: {
    status: 200,
    body: '---\nname: commits\ndescription: Write commit messages the way this repository does. Use for every commit.\n---\n# Commits\n',
  },
};

/** One code search hit: a SKILL.md path in a repository of JetBrains. */
const hit = (repository: string, path: string) => ({
  path,
  repository: { full_name: `JetBrains/${repository}`, name: repository, html_url: `https://github.com/JetBrains/${repository}` },
});
const range = (count: number) => Array.from({ length: count }, (_, index) => index);

/**
 * Every SKILL.md GitHub's code search finds in the JetBrains organization, two pages of them:
 * intellij-community keeps each of its 38 skills twice and one more in a plugin, MPS has 41 and
 * kotlin 6, Exposed and koog one each, and the docs only an example that is not a project skill.
 */
export const ORGANIZATION_HITS = [
  ...range(38).flatMap((index) => [hit('intellij-community', `.agents/skills/s${index}/SKILL.md`), hit('intellij-community', `.claude/skills/s${index}/SKILL.md`)]),
  hit('intellij-community', 'plugins/p/resources/skills/x/SKILL.md'),
  ...range(41).map((index) => hit('MPS', `.agents/skills/m${index}/SKILL.md`)),
  ...range(6).map((index) => hit('kotlin', `.claude/skills/k${index}/SKILL.md`)),
  hit('koog', 'agent/skills/writing-lint-checks/SKILL.md'),
  hit('Exposed', '.github/skills/code-style/SKILL.md'),
  hit('docs', 'docs/.claude/skills/x/SKILL.md'),
];

const search = (owner: string, page: number) => `https://api.github.com/search/code?q=filename:SKILL.md+user:${owner}&per_page=100&page=${page}`;

/** What GitHub answers for organizations: JetBrains, with skills; empty-org, without; nobody does not exist. */
const ORGANIZATIONS: Recording = {
  'https://api.github.com/users/JetBrains': { status: 200, body: { login: 'JetBrains', html_url: 'https://github.com/JetBrains', public_repos: 871 } },
  // The second page repeats the last hit of the first: pages can.
  [search('JetBrains', 1)]: { status: 200, body: { total_count: ORGANIZATION_HITS.length, items: ORGANIZATION_HITS.slice(0, 100) } },
  [search('JetBrains', 2)]: { status: 200, body: { total_count: ORGANIZATION_HITS.length, items: ORGANIZATION_HITS.slice(99) } },
  'https://api.github.com/users/empty-org': { status: 200, body: { login: 'empty-org', html_url: 'https://github.com/empty-org', public_repos: 1 } },
  [search('empty-org', 1)]: { status: 200, body: { total_count: 0, items: [] } },
  'https://api.github.com/users/nobody': { status: 404, body: { message: 'Not Found' } },
};

const github = replay({ ...EXAMPLE, ...ORGANIZATIONS });

/** An organization as the CLI scans it, with a token; GitHub answers from ORGANIZATIONS. */
export const owners = {
  open: (input: string) => openOwner(input, { fetch: github, token: 'test' }),
  scan: (input: string) => scanOwner(input, { fetch: github, token: 'test' }),
};

/** Opens a repository as the CLI does; GitHub answers from EXAMPLE, through code search, with a token. */
export const open = (input: string) =>
  parseGitHubUrl(input) ? openGitHub(input, { fetch: github, token: 'test' }) : openDirectory(input);

/** `skill-atlas <args>`, as the CLI runs it, with GitHub answering from EXAMPLE. */
export async function atlas(args: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await run(args, {
    open,
    scanOwner: owners.scan,
    print: (text) => stdout.push(text),
    error: (text) => stderr.push(text),
  });
  return { code, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
}
