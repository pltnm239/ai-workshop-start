// The local web view: a page with a field for a repository, and the scan behind it as JSON.
// Same core as the CLI, nothing stored; it listens on this machine only.
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { AtlasError } from '../core/errors.ts';
import { SKILL_ROOTS } from '../core/find.ts';
import { parseGitHubOwner } from '../core/github.ts';
import { skillLink, type Owner, type OwnerScan } from '../core/model.ts';
import { parseSkill } from '../core/parse.ts';
import { scan, type Source } from '../core/scan.ts';
import { renderMarkdown } from './markdown.ts';

const PAGE = readFileSync(new URL('./index.html', import.meta.url));

/** What the page shows for one skill. */
export type WebSkill = {
  id: string;
  name: string;
  description: string;
  path: string;
  /** The skill root holding it, such as `.claude/skills`. */
  root: string;
  link: string;
  copies: string[];
  /** The front matter keys other than name and description. */
  properties: Record<string, unknown>;
  /** The SKILL.md as it is in the repository. */
  content: string;
  /** Its body after the front matter, as HTML. */
  html: string;
};

export type WebScan = {
  repository: { id: string; url: string; commit: string };
  skills: WebSkill[];
  warnings: string[];
};

/** A GitHub organization or user: its repository count, and the scan of all its repositories. */
export type Owners = {
  open(input: string): Promise<Owner>;
  scan(input: string): Promise<OwnerScan>;
};

/**
 * `GET /`: the page; `GET /api/scan?repo=<GitHub URL | directory>`: a WebScan, or for an organization
 * URL an OwnerScan; `GET /api/owner?repo=<organization URL>`: its Owner. Errors are `{ error }`.
 */
export function createWebServer(open: (input: string) => Promise<Source>, owners: Owners): Server {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const send = (status: number, type: string, body: string | Buffer) => {
      response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(body);
    };
    const json = (status: number, body: unknown) => send(status, 'application/json; charset=utf-8', JSON.stringify(body));

    if (request.method !== 'GET') return json(405, { error: 'Only GET is supported' });
    if (url.pathname === '/') return send(200, 'text/html; charset=utf-8', PAGE);
    if (url.pathname !== '/api/scan' && url.pathname !== '/api/owner') return json(404, { error: `Not found: ${url.pathname}` });

    const input = url.searchParams.get('repo')?.trim();
    if (!input) return json(400, { error: 'Enter a GitHub repository URL or a directory' });
    try {
      if (url.pathname === '/api/owner') json(200, await owners.open(input));
      else if (parseGitHubOwner(input)) json(200, await owners.scan(input));
      else json(200, await scanForWeb(await open(input)));
    } catch (error) {
      if (error instanceof AtlasError) json(400, { error: error.message });
      else json(500, { error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` });
    }
  });
}

export async function scanForWeb(source: Source): Promise<WebScan> {
  const { repository, skills, warnings } = await scan(source);
  return {
    repository: { id: repository.id, url: repository.url, commit: repository.commit },
    skills: skills.map((skill) => {
      const link = skillLink(repository, skill);
      const parsed = parseSkill(skill.content);
      return {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        path: skill.path,
        root: SKILL_ROOTS.find((root) => skill.path.startsWith(`${root}/`)) ?? '',
        link,
        copies: skill.copies,
        properties: parsed.properties,
        content: skill.content,
        html: renderMarkdown(parsed.body, link),
      };
    }),
    warnings,
  };
}

/** Starts listening on 127.0.0.1; resolves to the page's URL. */
export function listen(server: Server, port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once('error', (error: NodeJS.ErrnoException) =>
      reject(error.code === 'EADDRINUSE' ? new AtlasError(`Port ${port} is in use; try --port <another>`) : error),
    );
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      resolve(`http://localhost:${typeof address === 'object' && address ? address.port : port}/`);
    });
  });
}
