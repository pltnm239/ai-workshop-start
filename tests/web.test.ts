// The decisions in spec/web.md, checked on the real server: the CLI's `serve`, and the same server
// in process with GitHub answering from tests/helpers.ts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createBrowserBackend } from '../src/browser.ts';
import { parseGitHubOwner } from '../src/core/github.ts';
import { renderMarkdown } from '../src/web/markdown.ts';
import { createWebServer, listen, type WebScan } from '../src/web/server.ts';
import { CLI, EXAMPLE_COMMIT, FIXTURE, open, owners } from './helpers.ts';

const server = createWebServer(open, owners);
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
  assert.match(html, /placeholder="https:\/\/github\.com\/owner\/repo, an organization, or a local directory"/);

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

async function owner(repo: string) {
  const response = await fetch(new URL(`/api/owner?repo=${encodeURIComponent(repo)}`, base));
  return { status: response.status, body: await response.json() };
}

test('an organization in the field: its repository count, from the API', async () => {
  assert.deepEqual(await owner('github.com/JetBrains'), {
    status: 200,
    body: { id: 'JetBrains', url: 'https://github.com/JetBrains', repositories: 871 },
  });
  assert.deepEqual(await owner('github.com/nobody'), { status: 400, body: { error: 'Organization not found: https://github.com/nobody' } });
  assert.deepEqual(await owner('github.com/JetBrains/example'), {
    status: 400,
    body: { error: 'Not a GitHub organization URL: github.com/JetBrains/example' },
  });
});

test('an organization in the field: the page shows the count at its right as it is typed, without Enter', async () => {
  const html = await (await fetch(base)).text();
  assert.match(html, /<input id="repo"[^>]*>\s*<span id="repo-count" class="chip count"/);
  assert.match(html, /input\.addEventListener\('input', showCount\)/);
  assert.match(html, /fetch\(`\/api\/owner\?repo=/);
  // The page knows an organization URL the way the core does.
  const pattern = new RegExp(/const ownerOf = \(text\) => \/(.+)\/i\.exec/.exec(html)![1], 'i');
  for (const input of ['https://github.com/JetBrains', 'github.com/JetBrains/', 'github.com/JetBrains/kotlin', 'JetBrains', './fixture']) {
    assert.equal(pattern.exec(input)?.[1], parseGitHubOwner(input), input);
  }
});

test('an organization scanned: the API answers each repository with skills, the most first', async () => {
  const { status, body } = await api('https://github.com/JetBrains');
  assert.equal(status, 200);
  assert.deepEqual(body, {
    owner: { id: 'JetBrains', url: 'https://github.com/JetBrains', repositories: 871 },
    repositories: [
      { id: 'JetBrains/MPS', name: 'MPS', url: 'https://github.com/JetBrains/MPS', skills: 41 },
      { id: 'JetBrains/intellij-community', name: 'intellij-community', url: 'https://github.com/JetBrains/intellij-community', skills: 38 },
      { id: 'JetBrains/kotlin', name: 'kotlin', url: 'https://github.com/JetBrains/kotlin', skills: 6 },
      { id: 'JetBrains/Exposed', name: 'Exposed', url: 'https://github.com/JetBrains/Exposed', skills: 1 },
      { id: 'JetBrains/koog', name: 'koog', url: 'https://github.com/JetBrains/koog', skills: 1 },
    ],
    warnings: [],
  });
  assert.deepEqual(await api('github.com/nobody'), { status: 400, body: { error: 'Organization not found: https://github.com/nobody' } });
});

test('an organization scanned: the page shows `N with skills, among them`, the first three, `+N more`', async () => {
  const html = await (await fetch(base)).text();
  assert.match(html, /const SHOWN_REPOSITORIES = 3;/);
  assert.match(html, /`\$\{repositories\.length\} with skills, among them`/);
  assert.match(html, /`\+\$\{more\} more`/);
  // A repository opens its own scan.
  assert.match(html, /onclick: \(\) => \{ input\.value = repository\.url; showCount\(\); form\.requestSubmit\(\); \}/);
});

/** The page's filter, exactly as the server sends it to the browser. */
async function pageFilter(): Promise<typeof import('../src/web/filter.js')> {
  const response = await fetch(new URL('/filter.js', base));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type')!, /^text\/javascript/);
  return import(`data:text/javascript,${encodeURIComponent(await response.text())}`);
}

/** The shown skill with its highlights in brackets: `[com]mits — Write [com]mit messages…`. */
type Shown = { name: { text: string; match: boolean }[]; description: { text: string; match: boolean }[] };
const marked = (shown: Shown | null) =>
  shown && [shown.name, shown.description].map((parts) => parts.map((p) => (p.match ? `[${p.text}]` : p.text)).join('')).join(' — ');

const SKILLS = [
  { name: 'code-style', description: 'How code looks here: four spaces, lines up to 120 characters. Run the formatter before committing.' },
  { name: 'commits', description: 'Write commit messages the way this repository does. Use for every commit.' },
  { name: 'release-checklist', description: '' },
];

test('filter: the page imports it from the server, on the skills the API returns', async () => {
  const page = await (await fetch(base)).text();
  assert.match(page, /import \{ firstSentence, show \} from '\/filter\.js';/);
  assert.match(page, /<input id="filter" type="search"/);
  const { show } = await pageFilter();
  const { body } = await api(FIXTURE);
  const kept = (query: string) => body.skills.filter((skill) => show(skill, query)).map((skill) => skill.name);
  assert.deepEqual(kept('COMMIT'), ['code-style', 'commits']);
  assert.deepEqual(kept('commit kotlin'), ['code-style']);
});

test('filter: every word, in any case, in the name or the description; the others are left out', async () => {
  const { show } = await pageFilter();
  const kept = (query: string) => SKILLS.filter((skill) => show(skill, query)).map((skill) => skill.name);
  assert.deepEqual(kept(''), ['code-style', 'commits', 'release-checklist']);
  assert.deepEqual(kept('   '), ['code-style', 'commits', 'release-checklist']);
  assert.deepEqual(kept('CODE'), ['code-style']);
  assert.deepEqual(kept('commit'), ['code-style', 'commits']);
  assert.deepEqual(kept('commit  messages'), ['commits']);
  assert.deepEqual(kept('style repository'), []);
  assert.deepEqual(kept('release'), ['release-checklist']);
});

test('filter: every occurrence of every word highlighted, in the name and the description line', async () => {
  const { show } = await pageFilter();
  assert.equal(marked(show(SKILLS[1], 'Commit')), '[commit]s — Write [commit] messages the way this repository does.');
  assert.equal(marked(show(SKILLS[1], 'com mes')), '[com]mits — Write [com]mit [mes]sages the way this repository does.');
  assert.equal(marked(show(SKILLS[1], 'mit commit')), '[commit]s — Write [commit] messages the way this repository does.');
  assert.equal(marked(show(SKILLS[1], '')), 'commits — Write commit messages the way this repository does.');
  assert.equal(marked(show(SKILLS[2], 'list')), 'release-check[list] — ');
});

test('filter: a query that matches nothing leaves no skill; regular expression characters are text', async () => {
  const { show } = await pageFilter();
  assert.deepEqual(SKILLS.filter((skill) => show(skill, 'nothing-like-this')), []);
  const tools = { name: 'c++-build', description: 'Builds (x) with c++ and .* globs.' };
  assert.equal(marked(show(tools, 'C++')), '[c++]-build — Builds (x) with [c++] and .* globs.');
  assert.equal(marked(show(tools, '(x')), 'c++-build — Builds [(x]) with c++ and .* globs.');
  assert.equal(marked(show(tools, '.*')), 'c++-build — Builds (x) with c++ and [.*] globs.');
  assert.equal(show(tools, 'a.b'), null);
  assert.equal(show(tools, '[x'), null);
});

test('filter: a match only after the first sentence → the line around it, highlighted', async () => {
  const { show } = await pageFilter();
  assert.equal(marked(show(SKILLS[0], 'formatter')), 'code-style — …up to 120 characters. Run the [formatter] before committing.');
  const long = {
    name: 'long',
    description: `${'A sentence with many words that goes on '.repeat(3)}and then names the formatter at last, ${'and goes on after it for quite a while '.repeat(4)}end.`,
  };
  const line = marked(show(long, 'formatter'))!.slice('long — '.length);
  assert.match(line, /^…\S.* names the \[formatter\] at last, .*\S…$/);
  assert.ok(line.length <= 145, line);
  assert.equal(line.indexOf('[formatter]'), line.indexOf('formatter') - 1);
  assert.ok(line.indexOf('[formatter]') <= 32, line);
  const url = { name: 'lint', description: 'Lints the code. Before a commit it runs https://github.com/acme/tools/blob/main/format.sh formatter on staged files.' };
  assert.equal(marked(show(url, 'formatter')), 'lint — …cme/tools/blob/main/format.sh [formatter] on staged files.');
  // 30 characters before the match is already the start of a word: the excerpt starts there.
  const words = { name: 'w', description: `Short. ${'aaaa bbbb cccc dddd eeee ffff gggg hhhh iiii jjjj kkkk llll mmmm nnnn oooo pppp qqqq rrrr ssss tttt'} target end.` };
  assert.equal(marked(show(words, 'target')), 'w — …oooo pppp qqqq rrrr ssss tttt [target] end.');
});

test('filter: the description line is still the first sentence when it holds an early match', async () => {
  const { firstSentence, show } = await pageFilter();
  assert.equal(firstSentence('One.\n  Two.'), 'One.');
  assert.equal(marked(show(SKILLS[0], 'code formatter')), '[code]-style — How [code] looks here: four spaces, lines up to 120 characters.');
});

test('filter: smooth on the page; skills fold away and come back, highlights fade in; none with reduced motion', async () => {
  const page = await (await fetch(base)).text();
  assert.match(page, /ul#skills li\.item \{[^}]*transition: grid-template-rows [^}]*opacity[^}]*transform/);
  assert.match(page, /ul#skills li\.item\.out \{ grid-template-rows: 0fr; opacity: 0;/);
  assert.match(page, /ul#skills mark\.fresh \{ animation: mark-in/);
  // As specific as the rules they turn off: `mark.fresh` beats a bare `mark`.
  assert.match(page, /@media \(prefers-reduced-motion: reduce\) \{\s*ul#skills li\.item, ul#skills mark, ul#skills mark\.fresh, \.list-empty \{ transition: none; animation: none; \}/);
  assert.match(page, /'No skills match'/);
  assert.match(page, /`\$\{count\} of \$\{result\.skills\.length\}`/);
});

/**
 * The page as the server sends it, its script running on a DOM, against this server. jsdom runs no
 * module scripts: the script runs as a classic one, with the served /filter.js in place of its import.
 */
async function openPage(path: string) {
  const html = await (await fetch(base)).text();
  const filter = (await (await fetch(new URL('/filter.js', base))).text()).replace(/^export /gm, '');
  const page = html
    .replace(/<script type="module">\s*import \{[^}]+\} from '\/filter\.js';/, () => `<script>(async () => {\n${filter}\n`)
    .replace(/<\/script>\s*<\/body>/, '})();</script></body>');
  assert.notEqual(page, html);
  const errors: unknown[] = [];
  const dom = new JSDOM(page, {
    url: new URL(path, base).href,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = ((url: string, init?: RequestInit) => fetch(new URL(url, base), init)) as typeof fetch;
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.addEventListener('error', (event) => errors.push(event.error));
    },
  });
  const { window } = dom;
  const document = window.document;
  const $ = (selector: string) => document.querySelector(selector) as HTMLElement;
  const field = $('#filter') as HTMLInputElement;
  const until = async (ready: () => boolean) => {
    for (let i = 0; i < 200 && !ready(); i++) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.ok(ready(), 'the page did not get there');
  };
  await until(() => !$('#repo-card').hidden || !$('#error').hidden || !!document.querySelector('.placeholder'));
  return {
    window, document, $, errors, until,
    /** The rows the filter shows: `name — description line`, highlights in brackets. */
    shown: () =>
      [...document.querySelectorAll('#skills li.item:not(.out)')].map((li) =>
        ['.skill-title', '.skill-description'].map((part) =>
          [...li.querySelector(part)!.childNodes].map((n) => (n.nodeName === 'MARK' ? `[${n.textContent}]` : n.textContent)).join('')).join(' — ')),
    selected: () => document.querySelector('[role="option"][aria-selected="true"] .skill-title')?.textContent,
    type(query: string) {
      field.value = query;
      field.dispatchEvent(new window.Event('input'));
    },
    key(key: string, target: Element = field) {
      (target as HTMLElement).focus();
      target.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    },
    close: () => window.close(),
  };
}

test('filter on the page: shown when there is more than one skill', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'skill-atlas-two-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const name of ['first', 'second']) {
    mkdirSync(join(directory, '.claude/skills', name), { recursive: true });
    writeFileSync(join(directory, '.claude/skills', name, 'SKILL.md'), `---\nname: ${name}\ndescription: The ${name} one.\n---\n`);
  }
  const two = await openPage(`/?repo=${encodeURIComponent(directory)}`);
  t.after(two.close);
  assert.equal(two.document.querySelectorAll('#skills li.item').length, 2);
  assert.equal(two.$('#filter-box').hidden, false);
  const three = await openPage(`/?repo=${encodeURIComponent(FIXTURE)}`);
  t.after(three.close);
  assert.equal(three.$('#filter-box').hidden, false);
  const one = await openPage(`/?repo=${encodeURIComponent('https://github.com/JetBrains/example')}`);
  t.after(one.close);
  assert.equal(one.$('#repo-card').hidden, false);
  assert.equal(one.$('#filter-box').hidden, true);
});

test('filter on the page: the others fold away, out of reach; the matches highlighted, the count', async (t) => {
  const page = await openPage(`/?repo=${encodeURIComponent(FIXTURE)}`);
  t.after(page.close);
  assert.equal(page.$('#filter-count').textContent, '');
  page.type('commit');
  assert.deepEqual(page.shown(), [
    'code-style — …code style. Use before [commit]ting Kotlin or Java changes.',
    '[commit]s — Write [commit] messages the way this repository does.',
  ]);
  const out = page.document.querySelector('#skills li.item.out') as HTMLElement & { inert: boolean };
  assert.equal(out.querySelector('.skill-title')!.textContent, 'release-checklist');
  assert.equal(out.inert, true);
  assert.equal(page.$('#filter-count').textContent, '2 of 3');
  page.type('');
  assert.equal(page.shown().length, 3);
  assert.equal(page.$('#filter-count').textContent, '');
  assert.deepEqual(page.errors, []);
});

test('filter on the page: only new highlights fade in, not the ones that grow as you type', async (t) => {
  const page = await openPage(`/?repo=${encodeURIComponent(FIXTURE)}`);
  t.after(page.close);
  const fresh = () => [...page.document.querySelectorAll('#skills li.item:not(.out) mark.fresh')].map((mark) => mark.textContent);
  page.type('commi');
  assert.deepEqual(fresh(), ['commi', 'commi', 'commi']);
  page.type('commit');
  assert.deepEqual(fresh(), []);
  page.type('commit messages');
  assert.deepEqual(fresh(), ['messages']);
});

test('filter on the page: a query that matches nothing → No skills match', async (t) => {
  const page = await openPage(`/?repo=${encodeURIComponent(FIXTURE)}`);
  t.after(page.close);
  assert.equal(page.$('#no-match').hidden, true);
  page.type('nothing-like-this');
  assert.deepEqual(page.shown(), []);
  assert.equal(page.$('#no-match').hidden, false);
  assert.equal(page.$('#no-match').textContent, 'No skills match');
  assert.equal(page.$('#filter-count').textContent, '0 of 3');
});

test('filter on the page: Enter or ↓ selects the first match; Escape clears', async (t) => {
  for (const key of ['Enter', 'ArrowDown']) {
    const page = await openPage(`/?repo=${encodeURIComponent(FIXTURE)}`);
    t.after(page.close);
    assert.equal(page.selected(), 'code-style', key);
    page.type('messages');
    page.key(key);
    assert.equal(page.selected(), 'commits', key);
    assert.equal(page.window.location.hash, '#commits', key);
    assert.equal(page.$('h1').textContent, 'commits', key);
    // The same match again is not another step back.
    const steps = page.window.history.length;
    page.key(key, page.$('#filter'));
    assert.equal(page.window.history.length, steps, key);
  }
  const page = await openPage(`/?repo=${encodeURIComponent(FIXTURE)}`);
  t.after(page.close);
  page.type('commit');
  page.key('Escape');
  assert.equal((page.$('#filter') as HTMLInputElement).value, '');
  assert.equal(page.shown().length, 3);
});

test('filter on the page: ↑/↓ in the list skip the skills it leaves out', async (t) => {
  const page = await openPage(`/?repo=${encodeURIComponent(FIXTURE)}`);
  t.after(page.close);
  page.type('e');
  assert.equal(page.shown().length, 3);
  page.type('commit');
  page.key('Enter');
  page.key('ArrowDown', page.document.activeElement!);
  assert.equal(page.selected(), 'commits');
  page.key('ArrowDown', page.document.activeElement!);
  assert.equal(page.selected(), 'commits');
});

test('filter on the page: back to a skill the filter leaves out → the filter cleared, the skill in the list', async (t) => {
  const page = await openPage(`/?repo=${encodeURIComponent(FIXTURE)}`);
  t.after(page.close);
  page.type('messages');
  page.key('Enter');
  assert.equal(page.selected(), 'commits');
  page.type('kotlin');
  page.window.history.replaceState(null, '', `/?repo=${encodeURIComponent(FIXTURE)}#code-style`);
  page.type('messages');
  page.window.dispatchEvent(new page.window.PopStateEvent('popstate'));
  assert.equal(page.$('h1').textContent, 'code-style');
  assert.equal((page.$('#filter') as HTMLInputElement).value, '');
  assert.equal(page.selected(), 'code-style');
  assert.equal(page.shown().length, 3);
});

test('filter on the page: back to the start page → no filter, and nothing breaks', async (t) => {
  const page = await openPage(`/?repo=${encodeURIComponent(FIXTURE)}`);
  t.after(page.close);
  page.window.history.pushState(null, '', '/');
  page.window.dispatchEvent(new page.window.PopStateEvent('popstate'));
  assert.equal(page.$('#filter-box').hidden, true);
  assert.ok(page.document.querySelector('.placeholder'));
  page.type('a');
  page.key('Escape');
  assert.deepEqual(page.errors, []);
});
