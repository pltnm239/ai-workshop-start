import { readFileSync } from 'node:fs';

type Attachment = { name: string; path?: string };
type Result = { status: string; error?: { message?: string }; attachments?: Attachment[] };
type Test = { status: string; results: Result[] };
type Spec = { title: string; file: string; tests: Test[] };
type Suite = { specs?: Spec[]; suites?: Suite[] };
type Report = { suites: Suite[] };

export const MARKER = '<!-- ui-tests -->';

const clean = (text: string) => text.replace(/\u001b\[[0-9;]*m/g, '');

function specsOf(suites: Suite[]): Spec[] {
  return suites.flatMap((suite) => [...(suite.specs ?? []), ...specsOf(suite.suites ?? [])]);
}

function reason(result: Result): string {
  const lines = clean(result.error?.message ?? 'failed').split('\n').map((line) => line.trim()).filter(Boolean);
  const pixels = lines.find((line) => /pixels?.*different/i.test(line));
  const text = pixels ? `Screenshot differs: ${pixels}` : lines[0];
  return text.replace(/\|/g, '\\|').slice(0, 200);
}

export function renderReport(report: Report, runUrl?: string): string {
  const specs = specsOf(report.suites);
  const failed = specs.filter((spec) => spec.tests.some((test) => test.status !== 'expected' && test.status !== 'skipped'));
  const head = failed.length === 0 ? `### UI tests: all ${specs.length} passed` : `### UI tests: ${failed.length} failed of ${specs.length}`;
  const lines = [MARKER, head, ''];
  if (failed.length > 0) {
    lines.push('| Test | What failed |', '| --- | --- |');
    for (const spec of failed) {
      const result = spec.tests.flatMap((test) => test.results).find((r) => r.status !== 'passed') ?? spec.tests[0].results[0];
      lines.push(`| \`${spec.file}\` ${spec.title.replace(/\|/g, '\\|')} | ${reason(result)} |`);
    }
    lines.push('', 'Any changed pixel fails the check. The artifact has the expected, actual and diff images, a video and a trace of every run.');
    lines.push('', 'Intended change? Update the baselines in the container and commit them: `npm run test:ui:update`.');
  } else {
    lines.push('Every screenshot matches its baseline. The videos of the run are in the artifact.');
  }
  if (runUrl) lines.push('', `[The run and its artifacts](${runUrl})`);
  return lines.join('\n') + '\n';
}

if (import.meta.main) {
  const runUrl = process.argv.find((arg) => arg.startsWith('--run-url='))?.slice('--run-url='.length);
  const file = process.argv.find((arg) => arg.endsWith('.json')) ?? 'test-results/report.json';
  process.stdout.write(renderReport(JSON.parse(readFileSync(file, 'utf8')) as Report, runUrl));
}
