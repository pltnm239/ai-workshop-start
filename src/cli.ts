#!/usr/bin/env node
// The Node client: a GitHub repository or organization through the GitHub API, or a local directory; stdout and
// stderr, or the local web view. Nothing is stored.
import { run } from './commands.ts';
import { openGitHub, openOwner, parseGitHubUrl, scanOwner } from './core/github.ts';
import { openDirectory } from './local.ts';

const token = process.env.GITHUB_TOKEN || undefined;
const open = (input: string) => (parseGitHubUrl(input) ? openGitHub(input, { fetch, token }) : openDirectory(input));

const owners = { open: (input: string) => openOwner(input, { fetch, token }), scan: (input: string) => scanOwner(input, { fetch, token }) };

process.exitCode = await run(process.argv.slice(2), {
  open,
  scanOwner: owners.scan,
  // Loaded on demand: `scan` does not need the page.
  serve: async (port) => {
    const { createWebServer, listen } = await import('./web/server.ts');
    return listen(createWebServer(open, owners), port);
  },
  print: (text) => console.log(text),
  error: (text) => console.error(text),
});
