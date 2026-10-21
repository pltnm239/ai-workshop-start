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
    claude.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new AtlasError(`claude -p failed, exit code ${code}: ${(stderr || stdout).trim()}`))));
    // An early exit closes stdin: the close above says why, not the write.
    claude.stdin.on('error', () => {});
    claude.stdin.end(prompt);
  });
}
