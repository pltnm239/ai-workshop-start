import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CLI } from './helpers.ts';

const COMMITS = {
  MPS: 'd7e4f5c1394535b05e90dde6e3e7e8a3f3e174a2',
  android: '6c1bcc42a2cbb45c241fafea9fbd82d32ac4d765',
  koog: '22e342e033c716f835312dd6cbe83193e1cbcf76',
};

for (const [repository, commit] of Object.entries(COMMITS)) {
  test(`JetBrains/${repository} at ${commit.slice(0, 7)} prints what tests/e2e/${repository}.txt has`, () => {
    const scanned = spawnSync(process.execPath, [CLI, 'scan', `github.com/JetBrains/${repository}/tree/${commit}`], { encoding: 'utf8' });
    assert.equal(scanned.status, 0, scanned.stderr);
    assert.equal(scanned.stderr, '');
    assert.equal(scanned.stdout, readFileSync(fileURLToPath(new URL(`e2e/${repository}.txt`, import.meta.url)), 'utf8'));
  });
}

test('github.com/JetBrains in under 5 s: every repository with project skills, MPS, intellij-community and kotlin among them', (t) => {
  const scan = () => {
    const started = performance.now();
    return { ...spawnSync(process.execPath, [CLI, 'scan', 'github.com/JetBrains'], { encoding: 'utf8' }), elapsed: performance.now() - started };
  };
  let { elapsed, ...scanned } = scan();
  // Code search allows 10 requests a minute, and CI's push and pull request runs share them: wait as
  // GitHub asks, up to WAIT_BUDGET in all. A longer hold on CI's own token is GitHub's call: a skip.
  const WAIT_BUDGET = 240;
  let waited = 0;
  for (let wait = rateLimitWait(scanned.stderr); wait !== undefined; wait = rateLimitWait(scanned.stderr)) {
    if (waited + wait > WAIT_BUDGET) {
      if (process.env.CI) return t.skip(`${scanned.stderr.trim()}, after ${waited} s of waiting`);
      break;
    }
    spawnSync('sleep', [String(wait + 1)]);
    waited += wait + 1;
    ({ elapsed, ...scanned } = scan());
  }
  assert.equal(scanned.status, 0, scanned.stderr);
  assert.ok(elapsed < 5000, `${Math.round(elapsed)} ms`);
  const [header, ...lines] = scanned.stdout.trimEnd().split('\n');
  const [, all, withSkills] = /^JetBrains · (\d+) repositories, (\d+) with skills$/.exec(header) ?? assert.fail(header);
  assert.ok(Number(all) > 500 && Number(withSkills) >= 3, header);
  assert.equal(lines.length, 2 * Number(withSkills));
  for (const repository of ['MPS', 'intellij-community', 'kotlin']) {
    assert.match(scanned.stdout, new RegExp(`^${repository} · \\d+ skills?\\n  https://github\\.com/JetBrains/${repository}$`, 'm'));
  }
  const counts = lines.filter((_, index) => index % 2 === 0).map((line) => Number(/ · (\d+) skills?$/.exec(line)![1]));
  assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
});

/** How long the CLI's rate limit message says to wait, in seconds; undefined for any other output. */
function rateLimitWait(stderr: string): number | undefined {
  const match = /^GitHub rate limit reached; try again in (?:(\d+) s|a minute)$/m.exec(stderr);
  return match ? Number(match[1] ?? 60) : undefined;
}
