import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MARKER, renderReport } from '../scripts/ui-report.ts';

const spec = (title: string, status: string, message?: string) => ({
  title,
  file: 'filter.spec.ts',
  tests: [{ status, results: [{ status: status === 'expected' ? 'passed' : 'failed', error: message ? { message } : undefined }] }],
});

test('a failed screenshot is reported with the test, the reason and the way to update', () => {
  const report = {
    suites: [{ suites: [{ specs: [spec('narrows', 'expected'), spec('restores', 'unexpected', '\u001b[31mError: Screenshot comparison failed:\n\n  1042 pixels (ratio 0.01 of all image pixels) are different.\u001b[39m')] }] }],
  };
  const text = renderReport(report, 'https://github.com/o/r/actions/runs/1');
  assert.ok(text.startsWith(MARKER));
  assert.match(text, /### UI tests: 1 failed of 2/);
  assert.match(text, /\| `filter\.spec\.ts` restores \| Screenshot differs: 1042 pixels .* are different\. \|/);
  assert.match(text, /npm run test:ui:update/);
  assert.match(text, /\[The run and its artifacts\]\(https:\/\/github\.com\/o\/r\/actions\/runs\/1\)/);
  assert.doesNotMatch(text, /\u001b/);
});

test('a green run says so, and keeps the marker so the PR comment can be updated', () => {
  const text = renderReport({ suites: [{ specs: [spec('narrows', 'expected')] }] });
  assert.ok(text.startsWith(MARKER));
  assert.match(text, /### UI tests: all 1 passed/);
  assert.doesNotMatch(text, /npm run test:ui:update/);
});
