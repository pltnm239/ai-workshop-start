// The organization decisions in spec/analysis.md and spec/cli.md, checked on what the command prints
// with GitHub answering from tests/helpers.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBrowserBackend } from '../src/browser.ts';
import { parseGitHubOwner, scanOwner } from '../src/core/github.ts';
import { replay, type Recording } from '../src/core/replay.ts';
import { atlas } from './helpers.ts';

test('an organization: its repository count, then each repository with skills, the most skills first', async () => {
  const scanned = await atlas(['scan', 'https://github.com/JetBrains']);
  assert.equal(scanned.code, 0, scanned.stderr);
  assert.equal(scanned.stderr, '');
  assert.equal(
    scanned.stdout,
    [
      'JetBrains · 871 repositories, 6 with skills',
      'MPS · 41 skills',
      '  https://github.com/JetBrains/MPS',
      'intellij-community · 38 skills',
      '  https://github.com/JetBrains/intellij-community',
      'kotlin · 6 skills',
      '  https://github.com/JetBrains/kotlin',
      'Exposed · 1 skill',
      '  https://github.com/JetBrains/Exposed',
      'example · 1 skill',
      '  https://github.com/JetBrains/example',
      'koog · 1 skill',
      '  https://github.com/JetBrains/koog',
    ].join('\n'),
  );
});

test('an organization URL: with or without the scheme or a trailing slash; a repository URL is not one', () => {
  for (const input of ['https://github.com/JetBrains', 'github.com/JetBrains/', 'http://www.github.com/JetBrains']) {
    assert.equal(parseGitHubOwner(input), 'JetBrains', input);
  }
  for (const input of ['github.com/JetBrains/kotlin', 'JetBrains', './fixture', 'https://gitlab.com/JetBrains']) {
    assert.equal(parseGitHubOwner(input), undefined, input);
  }
});

test('an organization: a project skill counts as in a repository scan, copies once, other SKILL.md files not at all', async () => {
  const { stdout } = await atlas(['scan', 'github.com/JetBrains']);
  assert.match(stdout, /^intellij-community · 38 skills$/m); // 76 copies and a plugin's SKILL.md
  assert.doesNotMatch(stdout, /^docs /m); // only docs/.claude/skills
});

test('an organization without project skills → none with skills', async () => {
  const scanned = await atlas(['scan', 'github.com/empty-org']);
  assert.equal(scanned.code, 0, scanned.stderr);
  assert.equal(scanned.stdout, 'empty-org · 1 repository, none with skills');
});

test('an organization that does not exist → a clear message, exit code 1', async () => {
  const scanned = await atlas(['scan', 'github.com/nobody']);
  assert.equal(scanned.code, 1);
  assert.equal(scanned.stderr, 'Organization not found: https://github.com/nobody');
});

test('a name GitHub cannot have, such as `..` → not found, and GitHub is not asked', async () => {
  for (const name of ['..', '.', '.hidden', '-dash']) {
    const scanned = await atlas(['scan', `github.com/${name}`]);
    assert.equal(scanned.code, 1, name);
    assert.equal(scanned.stderr, `Organization not found: https://github.com/${name}`);
  }
});

test('an organization without GITHUB_TOKEN → a message that asks for it, exit code 1', async () => {
  const github = replay({
    'https://api.github.com/users/JetBrains': { status: 200, body: { login: 'JetBrains', html_url: 'https://github.com/JetBrains', public_repos: 871 } },
  });
  await assert.rejects(scanOwner('github.com/JetBrains', { fetch: github }), {
    message: 'Scanning an organization needs GITHUB_TOKEN: GitHub code search requires a token',
  });
  // The browser terminal has no token.
  const browser = createBrowserBackend({ fetch: github });
  assert.equal(await browser.run('skill-atlas scan github.com/JetBrains'), 'Scanning an organization needs GITHUB_TOKEN: GitHub code search requires a token');
});

test('more SKILL.md files than code search returns, or a search that timed out → a warning, the scan goes on', async () => {
  const hit = (index: number) => ({
    path: `.claude/skills/s${index}/SKILL.md`,
    repository: { full_name: `big-org/r${index % 3}`, name: `r${index % 3}`, html_url: `https://github.com/big-org/r${index % 3}` },
  });
  const recording: Recording = {
    'https://api.github.com/users/big-org': { status: 200, body: { login: 'big-org', html_url: 'https://github.com/big-org', public_repos: 5000 } },
  };
  for (let page = 1; page <= 10; page++) {
    const items = Array.from({ length: 100 }, (_, index) => hit((page - 1) * 100 + index));
    recording[`https://api.github.com/search/code?q=filename:SKILL.md+user:big-org&per_page=100&page=${page}`] = {
      status: 200,
      body: { total_count: 1500, incomplete_results: page === 2, items },
    };
  }
  const scanned = await scanOwner('github.com/big-org', { fetch: replay(recording), token: 'test' });
  assert.deepEqual(
    scanned.repositories.map((repository) => [repository.name, repository.skills]),
    [['r0', 334], ['r1', 333], ['r2', 333]],
  );
  assert.deepEqual(scanned.warnings, [
    'GitHub code search timed out; some repositories may be missing',
    'GitHub code search returns 1000 of the 1500 SKILL.md files; some repositories may be missing',
  ]);
});

test('GitHub asks to wait a few seconds → the scan waits and goes on; a longer rate limit → a clear message', async () => {
  const owner = { status: 200, body: { login: 'empty-org', html_url: 'https://github.com/empty-org', public_repos: 1 } };
  const page = 'https://api.github.com/search/code?q=filename:SKILL.md+user:empty-org&per_page=100&page=1';
  // What code search answers for requests close together, once, then the result.
  const asked: string[] = [];
  const answers = [
    { status: 429, body: { message: 'try again in 0.01s' } },
    { status: 200, body: { total_count: 0, items: [] } },
  ];
  const busy = replay({ 'https://api.github.com/users/empty-org': owner }, async (url) => {
    asked.push(url);
    const { status, body } = answers.shift()!;
    return new Response(JSON.stringify(body), { status });
  });
  const scanned = await scanOwner('github.com/empty-org', { fetch: busy, token: 'test' });
  assert.deepEqual(scanned.repositories, []);
  assert.deepEqual(asked, [page, page]);

  const limited = replay({
    'https://api.github.com/users/empty-org': owner,
    [page]: { status: 429, body: { message: 'try again in 60s' } },
  });
  await assert.rejects(scanOwner('github.com/empty-org', { fetch: limited, token: 'test' }), {
    message: 'GitHub rate limit reached; try again in 60 s',
  });

  // Up to 10 s in all: a second pause that would go past it is not waited.
  const pauses = [{ message: 'try again in 0.01s' }, { message: 'try again in 10s' }];
  const twice = replay({ 'https://api.github.com/users/empty-org': owner }, async () => new Response(JSON.stringify(pauses.shift()), { status: 429 }));
  const started = performance.now();
  await assert.rejects(scanOwner('github.com/empty-org', { fetch: twice, token: 'test' }), {
    message: 'GitHub rate limit reached; try again in 10 s',
  });
  assert.ok(performance.now() - started < 1000);
  assert.deepEqual(pauses, []);

  // No requests left for this minute: the wait is until the limit resets.
  const reset = String(Math.floor(Date.now() / 1000) + 40);
  const spent = replay({ 'https://api.github.com/users/empty-org': owner }, async () =>
    new Response(JSON.stringify({ message: 'API rate limit exceeded for installation.' }), {
      status: 403,
      headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': reset },
    }),
  );
  await assert.rejects(scanOwner('github.com/empty-org', { fetch: spent, token: 'test' }), { message: /^GitHub rate limit reached; try again in (39|40) s$/ });
});
