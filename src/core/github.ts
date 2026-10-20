import { AtlasError } from './errors.ts';
import { findSkills, SKILL_ROOTS } from './find.ts';
import { sortRepositories, type Owner, type OwnerRepository, type OwnerScan } from './model.ts';
import type { Source } from './scan.ts';

/** The part of `fetch` the core uses, so tests and the browser can pass their own. */
export type Fetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<Response>;

export type GitHubOptions = {
  fetch: Fetch;
  /** With a token, skills are found through code search; without it, or for a given ref, through the tree. */
  token?: string;
};

const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';

/**
 * `https://github.com/owner/repo`, with or without the scheme, a trailing slash or `.git`,
 * and with `/tree/<ref>` for a commit, tag or branch other than the default one.
 */
export function parseGitHubUrl(input: string): { owner: string; repo: string; ref?: string } | undefined {
  const match = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/([^?#]+?))?\/?$/i.exec(input.trim());
  return match ? { owner: match[1], repo: match[2], ref: match[3] } : undefined;
}

/** `https://github.com/owner`, an organization or a user, with or without the scheme or a trailing slash. */
export function parseGitHubOwner(input: string): string | undefined {
  return /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/?$/i.exec(input.trim())?.[1];
}

/** The organization or user, and how many public repositories it has: one request, no token needed. */
export async function openOwner(input: string, options: GitHubOptions): Promise<Owner> {
  return owner(client(options), input);
}

/**
 * Every repository of the owner that keeps project skills, with how many. One code search over the
 * whole owner, at most ten pages; the skills of each repository are found as in a repository scan.
 * GitHub's code search needs a token.
 */
export async function scanOwner(input: string, options: GitHubOptions): Promise<OwnerScan> {
  const github = client(options);
  const found = await owner(github, input);
  if (!options.token) throw new AtlasError('Scanning an organization needs GITHUB_TOKEN: GitHub code search requires a token');
  const byRepository = new Map<string, { repository: Omit<OwnerRepository, 'skills'>; paths: Set<string> }>();
  const warnings: string[] = [];
  let total = 0;
  for (let page = 1; page <= 10; page++) {
    const result = await github.json<SearchResult>(`${API}/search/code?q=filename:SKILL.md+user:${found.id}&per_page=100&page=${page}`);
    total = result.total_count;
    if (result.incomplete_results && warnings.length === 0) warnings.push('GitHub code search timed out; some repositories may be missing');
    for (const { path, repository } of result.items) {
      const entry = byRepository.get(repository.full_name) ?? { repository: { id: repository.full_name, name: repository.name, url: repository.html_url }, paths: new Set() };
      entry.paths.add(path); // pages can repeat a result
      byRepository.set(repository.full_name, entry);
    }
    if (result.items.length < 100 || page * 100 >= result.total_count) break;
  }
  if (total > 1000) warnings.push(`GitHub code search returns 1000 of the ${total} SKILL.md files; some repositories may be missing`);
  const repositories = [...byRepository.values()]
    .map(({ repository, paths }) => ({ ...repository, skills: findSkills([...paths]).length }))
    .filter((repository) => repository.skills > 0);
  return { owner: found, repositories: sortRepositories(repositories), warnings };
}

type SearchResult = {
  total_count: number;
  incomplete_results?: boolean;
  items: { path: string; repository: { full_name: string; name: string; html_url: string } }[];
};

async function owner(github: Client, input: string): Promise<Owner> {
  const name = parseGitHubOwner(input);
  if (!name) throw new AtlasError(`Not a GitHub organization URL: ${input}`);
  const info = await github.json<{ login: string; html_url: string; public_repos: number }>(
    `${API}/users/${encodeURIComponent(name)}`,
    `Organization not found: https://github.com/${name}`,
  );
  return { id: info.login, url: info.html_url, repositories: info.public_repos };
}

/** Resolves the default branch to a commit and lists the files that may be skills. */
export async function openGitHub(input: string, options: GitHubOptions): Promise<Source> {
  const name = parseGitHubUrl(input);
  if (!name) throw new AtlasError(`Not a GitHub repository URL: ${input}`);
  const github = client(options);
  const info = await github.json<{ full_name: string; default_branch: string }>(
    `${API}/repos/${name.owner}/${name.repo}`,
    `Repository not found: https://github.com/${name.owner}/${name.repo}`,
  );
  const id = info.full_name;
  const { sha } = await github.json<{ sha: string }>(`${API}/repos/${id}/commits/${encodePath(name.ref ?? info.default_branch)}`);
  const warnings: string[] = [];
  const paths = options.token && !name.ref ? await searchPaths(github, id) : await treePaths(github, id, sha, warnings);
  const [organization, repo] = id.split('/');
  return {
    repository: { id, organization, name: repo, url: `https://github.com/${id}`, commit: sha },
    paths,
    warnings,
    read: (path) => github.raw(`${RAW}/${id}/${sha}/${encodePath(path)}`),
  };
}

/** Code search looks at the whole default branch, 100 results a page. */
async function searchPaths(github: Client, id: string): Promise<string[]> {
  const paths = new Set<string>(); // pages can repeat a result
  // GitHub returns at most 1000 results: ten pages.
  for (let page = 1; page <= 10; page++) {
    const result = await github.json<{ total_count: number; items: { path: string }[] }>(
      `${API}/search/code?q=filename:SKILL.md+repo:${id}&per_page=100&page=${page}`,
    );
    for (const item of result.items) paths.add(item.path);
    if (result.items.length < 100 || page * 100 >= result.total_count) break;
  }
  return [...paths];
}

type Tree = { truncated: boolean; tree: { path: string; mode: string; type: string; sha: string }[] };

/** The whole tree at once, or only the skill roots when it is too large for one answer. */
async function treePaths(github: Client, id: string, sha: string, warnings: string[]): Promise<string[]> {
  const tree = await github.json<Tree>(`${API}/repos/${id}/git/trees/${sha}?recursive=1`);
  if (!tree.truncated) return files(tree);
  const paths: string[] = [];
  for (const root of SKILL_ROOTS) {
    const rootSha = await directory(github, id, sha, root);
    if (!rootSha) continue;
    const subtree = await github.json<Tree>(`${API}/repos/${id}/git/trees/${rootSha}?recursive=1`);
    paths.push(...files(subtree).map((path) => `${root}/${path}`));
  }
  return paths;
}

/** Walks down one level at a time; the directory's tree, or undefined if it does not exist. */
async function directory(github: Client, id: string, sha: string, path: string): Promise<string | undefined> {
  let current = sha;
  for (const segment of path.split('/')) {
    const tree = await github.json<Tree>(`${API}/repos/${id}/git/trees/${current}`);
    const entry = tree.tree.find((item) => item.path === segment && item.type === 'tree');
    if (!entry) return undefined;
    current = entry.sha;
  }
  return current;
}

/** Regular files only: a symbolic link's content is its target, not a SKILL.md. */
function files(tree: Tree): string[] {
  return tree.tree.filter((item) => item.type === 'blob' && item.mode !== '120000').map((item) => item.path);
}

type Client = ReturnType<typeof client>;

function client({ fetch, token }: GitHubOptions) {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const answers = new Map<string, Promise<unknown>>(); // the root tree is asked for once per skill root

  async function get(url: string, init?: { headers: Record<string, string> }): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (error) {
      throw new AtlasError(`Cannot reach GitHub: ${describe(error)}`);
    }
  }

  async function request(url: string, notFound: string, retries = MAX_RETRIES): Promise<unknown> {
    const response = await get(url, { headers });
    if (response.ok) return response.json();
    const body: unknown = await response.json().catch(() => undefined);
    const message = (body as { message?: unknown } | undefined)?.message;
    const text = typeof message === 'string' ? message : '';
    if (response.status === 404) throw new AtlasError(notFound);
    const limited = response.status === 429 || (response.status === 403 && /rate limit/i.test(text));
    // Code search asks for a pause of a few seconds when requests come close together: wait it out.
    const wait = limited ? retryAfter(response, text) : undefined;
    if (wait !== undefined && wait <= MAX_WAIT && retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      return request(url, notFound, retries - 1);
    }
    if (limited) {
      const later = wait === undefined ? 'a minute' : `${Math.ceil(wait)} s`;
      throw new AtlasError(`GitHub rate limit reached; ${token ? `try again in ${later}` : 'set GITHUB_TOKEN'}`);
    }
    if (response.status === 401) throw new AtlasError('GitHub rejected the token in GITHUB_TOKEN');
    throw new AtlasError(`GitHub answered ${response.status} for ${url}${text && `: ${text}`}`);
  }

  return {
    /** A GitHub API answer; `notFound` explains a 404. */
    json<T>(url: string, notFound = `Not found on GitHub: ${url}`): Promise<T> {
      if (!answers.has(url)) answers.set(url, request(url, notFound));
      return answers.get(url) as Promise<T>;
    },
    /** A file's bytes at the scanned commit, or undefined if it is not there. */
    async raw(url: string): Promise<Uint8Array | undefined> {
      const response = await get(url);
      if (response.status === 404) return undefined;
      if (!response.ok) throw new AtlasError(`GitHub answered ${response.status} for ${url}`);
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}

/** How many times a request is repeated after GitHub asks to wait, and the longest wait, in seconds. */
const MAX_RETRIES = 3;
const MAX_WAIT = 10;

/**
 * The pause GitHub asks for, in seconds: the Retry-After header, `try again in 2.7s` in the message,
 * or, with no requests left, the time until the limit resets.
 */
function retryAfter(response: Response, text: string): number | undefined {
  const header = Number(response.headers.get('retry-after') ?? NaN);
  if (Number.isFinite(header)) return header;
  const match = /try again in ([\d.]+)\s*s/i.exec(text);
  if (match) return Number(match[1]);
  const reset = Number(response.headers.get('x-ratelimit-reset') ?? NaN);
  if (response.headers.get('x-ratelimit-remaining') === '0' && Number.isFinite(reset)) return Math.max(0, reset - Date.now() / 1000);
  return undefined;
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.cause instanceof Error ? `${error.message} (${error.cause.message})` : error.message;
}
