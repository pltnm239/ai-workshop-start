// The decisions in spec/web.md, checked on the real server: the CLI's `serve`, and the same server
// in process with GitHub answering from tests/helpers.ts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { createBrowserBackend } from '../src/browser.ts';
import { renderMarkdown } from '../src/web/markdown.ts';
import { createWebServer, listen, type WebScan } from '../src/web/server.ts';
import { CLI, EXAMPLE_COMMIT, FIXTURE, open } from './helpers.ts';

const server = createWebServer(open);
const base = await listen(server, 0);
test.after(() => server.close());

async function api(repo?: string) {
  const response = await fetch(new URL(repo === undefined ? '/api/scan' : `/api/scan?repo=${encodeURIComponent(repo)}`, base));
  return { status: response.status, body: (await response.json()) as WebScan & { error?: string } };
}

/** `./skill-atlas serve <args>` until it prints its first line, or exits. */
async function serve(...args: string[]) {
  const child = spawn(process.execPath, [CLI, 'serve', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => (stdout += chunk));
  child.stderr.on('data', (chunk) => (stderr += chunk));
  const exited = once(child, 'exit').then(([code]) => code as number);
  await Promise.race([exited, once(child.stdout, 'data')]);
  return { child, stdout: () => stdout, stderr: () => stderr, exited };
}

test('serve: the page at the printed URL, with a field for the repository; the scan behind it', async (t) => {
  const served = await serve('--port', '0');
  t.after(() => served.child.kill());
  const url = /^Skill Atlas at (http:\/\/localhost:\d+\/) · Ctrl\+C to stop\n$/.exec(served.stdout())?.[1];
  assert.ok(url, served.stdout() + served.stderr());

  const page = await fetch(url);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type')!, /^text\/html/);
  const html = await page.text();
  assert.match(html, /<input id="repo" name="repo"/);
  assert.match(html, /placeholder="https:\/\/github\.com\/owner\/repo, or a local directory"/);

  const scanned = (await (await fetch(new URL(`/api/scan?repo=${encodeURIComponent(FIXTURE)}`, url))).json()) as WebScan;
  assert.deepEqual(scanned.skills.map((skill) => skill.name), ['code-style', 'commits', 'release-checklist']);
});

test('serve listens on this machine only', async () => {
  assert.equal((server.address() as AddressInfo).address, '127.0.0.1');
});

test('the API: every skill, sorted by name, with its root, pinned link, SKILL.md and rendered body', async () => {
  const { status, body } = await api('https://github.com/JetBrains/example');
  assert.equal(status, 200);
  assert.deepEqual(body.repository, { id: 'JetBrains/example', url: 'https://github.com/JetBrains/example', commit: EXAMPLE_COMMIT });
  assert.deepEqual(body.warnings, []);
  assert.deepEqual(body.skills, [
    {
      id: 'JetBrains/example:.claude/skills/commits/SKILL.md',
      name: 'commits',
      description: 'Write commit messages the way this repository does. Use for every commit.',
      path: '.claude/skills/commits/SKILL.md',
      root: '.claude/skills',
      link: `https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`,
      copies: [],
      properties: {},
      content: '---\nname: commits\ndescription: Write commit messages the way this repository does. Use for every commit.\n---\n# Commits\n',
      html: '<h1>Commits</h1>',
    },
  ]);
});

test('a local directory: file links, and the SKILL.md body as Markdown', async () => {
  const { body } = await api(FIXTURE);
  const style = body.skills.find((skill) => skill.name === 'code-style')!;
  assert.equal(style.link, `${pathToFileURL(FIXTURE).href}/.github/skills/code-style/SKILL.md`);
  assert.equal(style.root, '.github/skills');
  assert.equal(
    style.html,
    '<h1>Code style</h1>\n<ul><li>Four spaces, no tabs; lines up to 120 characters.</li><li>Prefer <code>val</code> over <code>var</code>.</li></ul>',
  );
});

test('malformed front matter → the skill with its directory name, the warning in the answer', async () => {
  const { body } = await api(FIXTURE);
  const checklist = body.skills.find((skill) => skill.path === '.agents/skills/release-checklist/SKILL.md')!;
  assert.equal(checklist.name, 'release-checklist');
  assert.equal(checklist.description, '');
  assert.match(checklist.html, /<ol><li>Tag the release\.<\/li>/);
  assert.match(body.warnings[0], /^\.agents\/skills\/release-checklist\/SKILL\.md: malformed front matter: /);
});

test('unreachable repository, or no input → 400 with the CLI message', async () => {
  assert.deepEqual(await api('no-such-directory'), { status: 400, body: { error: 'Not a GitHub URL or a readable directory: no-such-directory' } });
  assert.deepEqual(await api('https://github.com/JetBrains/not-answered'), {
    status: 400,
    body: { error: 'Cannot reach GitHub: not recorded: https://api.github.com/repos/JetBrains/not-answered' },
  });
  assert.deepEqual(await api(), { status: 400, body: { error: 'Enter a GitHub repository URL or a directory' } });
  assert.equal((await fetch(new URL('/nothing', base))).status, 404);
});

test('Markdown: headings, lists, quotes, code, tables, links and emphasis', () => {
  const html = renderMarkdown(
    [
      '## Steps',
      '',
      'Run **all** the *tests* with `npm test`.',
      '',
      '1. one',
      '2. two',
      '   - nested',
      '',
      '> a note',
      '',
      '```sh',
      'npm ci',
      '```',
      '',
      '| Key | Value |',
      '| --- | :---: |',
      '| a | b |',
    ].join('\n'),
  );
  assert.equal(
    html,
    [
      '<h2>Steps</h2>',
      '<p>Run <strong>all</strong> the <em>tests</em> with <code>npm test</code>.</p>',
      '<ol><li>one</li><li>two\n<ul><li>nested</li></ul></li></ol>',
      '<blockquote><p>a note</p></blockquote>',
      '<pre><code class="language-sh">npm ci</code></pre>',
      '<table><thead><tr><th>Key</th><th style="text-align:center">Value</th></tr></thead><tbody><tr><td>a</td><td style="text-align:center">b</td></tr></tbody></table>',
    ].join('\n'),
  );
});

test('Markdown: HTML is shown as text, never run; only safe links', () => {
  assert.equal(
    renderMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)>'),
    '<p>&#60;script&#62;alert(1)&#60;/script&#62; &#60;img src=x onerror=alert(1)&#62;</p>',
  );
  assert.equal(renderMarkdown('[click](javascript:alert(1))'), '<p>click</p>');
  assert.equal(
    renderMarkdown('[docs](https://example.com/"onmouseover="x)'),
    '<p><a href="https://example.com/%22onmouseover=%22x" target="_blank" rel="noopener noreferrer">docs</a></p>',
  );
});

test('Markdown: relative links resolve against the SKILL.md at the scanned commit', () => {
  const link = `https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`;
  assert.equal(
    renderMarkdown('See [the examples](references/examples.md).', link),
    `<p>See <a href="https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/references/examples.md" target="_blank" rel="noopener noreferrer">the examples</a>.</p>`,
  );
});

test('the port is taken → a clear message, exit code 1', async (t) => {
  const taken = createServer();
  await new Promise<void>((resolve) => taken.listen(0, '127.0.0.1', resolve));
  t.after(() => taken.close());
  const port = (taken.address() as AddressInfo).port;
  const served = await serve('--port', String(port));
  assert.equal(await served.exited, 1);
  assert.equal(served.stderr(), `Port ${port} is in use; try --port <another>\n`);
});

test('serve: a bad port → usage, exit code 1', async () => {
  const served = await serve('--port', 'many');
  assert.equal(await served.exited, 1);
  assert.match(served.stderr(), /^Not a port: many\n\nUsage: skill-atlas serve \[--port <port>\]\n$/);
});

test('serve in the browser terminal → run it from the command line', async () => {
  const browser = createBrowserBackend({ fetch: async () => new Response('', { status: 500 }) });
  assert.equal(await browser.run('skill-atlas serve'), 'The web view runs from the command line: ./skill-atlas serve');
  assert.match(await browser.run('skill-atlas help'), /serve \[--port <port>\] {11}open the local web view/);
});
