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
