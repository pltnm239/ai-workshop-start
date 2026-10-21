// The small model, through Claude Code: the CLI's `map --ai`. The tests put a recorded answer in its place.
import { spawn } from 'node:child_process';
import { AtlasError } from './core/errors.ts';

/** `claude -p --model haiku`, the prompt on stdin; its answer, or a clear message when there is none. */
export function ask(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const claude = spawn('claude', ['-p', '--model', 'haiku'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    claude.stdout.setEncoding('utf8').on('data', (chunk) => (stdout += chunk));
    claude.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += chunk));
    claude.on('error', (error: NodeJS.ErrnoException) =>
      reject(new AtlasError(error.code === 'ENOENT' ? 'Grouping with a model needs Claude Code: claude is not on the PATH' : `claude -p failed: ${error.message}`)),
    );
    claude.on('close', (code, signal) => {
      if (code === 0) return resolve(stdout);
      const message = (stderr || stdout).trim();
      reject(new AtlasError(`claude -p failed, ${code === null ? `killed by ${signal}` : `exit code ${code}`}${message ? `: ${message}` : ''}`));
    });
    // An early exit closes stdin: the close above says why, not the write.
    claude.stdin.on('error', () => {});
    claude.stdin.end(prompt);
  });
}
