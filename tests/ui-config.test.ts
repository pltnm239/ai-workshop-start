import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the Playwright version is pinned, and the container image of CI and of the npm scripts has the same one', () => {
  const pinned = JSON.parse(read('package.json')).devDependencies['@playwright/test'];
  assert.match(pinned, /^\d+\.\d+\.\d+$/);
  const scripts = JSON.parse(read('package.json')).scripts;
  for (const text of [read('.github/workflows/ci.yml'), scripts['test:ui:docker'], scripts['test:ui:update']]) {
    assert.match(text, new RegExp(`mcr\\.microsoft\\.com/playwright:v${pinned.replaceAll('.', '\\.')}-noble`));
  }
});

test('no screenshot may differ by a single pixel', () => {
  const config = read('playwright.config.ts');
  assert.match(config, /maxDiffPixels: 0/);
  assert.match(config, /threshold: 0\b/);
});

test('the PR gets the report of every UI run, passed or failed', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /if: always\(\) && github\.event_name == 'pull_request'/);
  assert.match(ci, /else await github\.rest\.issues\.createComment/);
});
