// The skill-atlas commands. The same code serves the Node CLI and the browser
// terminal: everything that differs between them comes in through the context.
import { AtlasError } from './core/errors.ts';
import { parseGitHubOwner } from './core/github.ts';
import { firstSentence, mapByWords, mapPrompt, parseMapAnswer, type SkillMap } from './core/map.ts';
import { skillLink, type OwnerScan, type Repository, type Skill } from './core/model.ts';
import { scan, type Source } from './core/scan.ts';

export type Context = {
  /** Opens what the user asked to scan. */
  open(input: string): Promise<Source>;
  /** Scans every repository of a GitHub organization or user. */
  scanOwner(input: string): Promise<OwnerScan>;
  print(text: string): void;
  /** Errors and warnings. */
  error(text: string): void;
  /** Asks a small model, `claude -p --model haiku`; resolves to its answer. Only the Node CLI has it. */
  ask?(prompt: string): Promise<string>;
  /** Starts the local web view; resolves to its URL. Only the Node CLI has it. */
  serve?(port: number): Promise<string>;
};

const usage = `Usage: skill-atlas <command>

  scan <GitHub URL | directory>   find every SKILL.md in a repository and print it
  scan <GitHub organization URL>  count the skills in each of its repositories
  map <URL | directory> [--ai]    group its skills by the words they share; --ai: by claude -p
  serve [--port <port>]           open the local web view, on port 4317 by default
  help                            show this help`;

/** Runs one command; returns its exit code. */
export async function run(args: string[], context: Context): Promise<number> {
  const [command = 'help', ...rest] = args;
  try {
    if (command === 'scan') await scanCommand(rest, context);
    else if (command === 'map') await mapCommand(rest, context);
    else if (command === 'serve') await serveCommand(rest, context);
    else if (command === 'help') context.print(usage);
    else throw new AtlasError(`Unknown command: ${command}\n\n${usage}`);
    return 0;
  } catch (error) {
    if (!(error instanceof AtlasError)) throw error;
    context.error(error.message);
    return 1;
  }
}

async function scanCommand(args: string[], context: Context) {
  if (args.length !== 1) throw new AtlasError('Usage: skill-atlas scan <GitHub URL | directory>');
  if (parseGitHubOwner(args[0])) return printOwner(await context.scanOwner(args[0]), context);
  const result = await scan(await context.open(args[0]));
  printRepository(result.repository, result.skills, context);
  for (const warning of result.warnings) context.error(`warning: ${warning}`);
}

async function mapCommand(args: string[], context: Context) {
  const usage = 'Usage: skill-atlas map <GitHub URL | directory> [--ai]';
  const ai = args.includes('--ai');
  const [input, ...extra] = args.filter((arg) => arg !== '--ai');
  if (!input || extra.length > 0 || args.filter((arg) => arg === '--ai').length > 1) throw new AtlasError(usage);
  if (parseGitHubOwner(input)) throw new AtlasError(`A map is of one repository's skills, not of an organization: ${input}\n\n${usage}`);
  if (ai && !context.ask) throw new AtlasError(`Grouping with a model runs from the command line: ./skill-atlas map ${input} --ai`);
  const result = await scan(await context.open(input));
  // No skills, nothing to ask the model about.
  const map = !ai || result.skills.length === 0 ? mapByWords(result.skills) : parseMapAnswer(await context.ask!(mapPrompt(result.repository.id, result.skills)), result.skills);
  printMap(result.repository, result.skills, map, context);
  for (const warning of result.warnings) context.error(`warning: ${warning}`);
}

async function serveCommand(args: string[], context: Context) {
  const usage = 'Usage: skill-atlas serve [--port <port>]';
  if (args.length !== 0 && (args.length !== 2 || args[0] !== '--port')) throw new AtlasError(usage);
  const port = args.length ? Number(args[1]) : 4317;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new AtlasError(`Not a port: ${args[1]}\n\n${usage}`);
  if (!context.serve) throw new AtlasError('The web view runs from the command line: ./skill-atlas serve');
  context.print(`Skill Atlas at ${await context.serve(port)} · Ctrl+C to stop`);
}

/** `<owner>/<repo> · N skills`, then each skill's name, first sentence and link. */
function printRepository(repository: Repository, skills: Skill[], { print }: Context) {
  print(`${repository.id} · ${skills.length} ${skills.length === 1 ? 'skill' : 'skills'}`);
  for (const skill of skills) {
    print(skill.description ? `${skill.name} — ${firstSentence(skill.description)}` : skill.name);
    print(`  ${skillLink(repository, skill)}`);
    if (skill.copies.length > 0) print(`  also in ${skill.copies.join(', ')}`);
  }
}

/** `<owner>/<repo> · N skills in M groups`, then each group with its skill count and the skills' names. */
function printMap(repository: Repository, skills: Skill[], map: SkillMap, { print }: Context) {
  const groups = map.length ? ` in ${map.length} ${map.length === 1 ? 'group' : 'groups'}` : '';
  print(`${repository.id} · ${skills.length} ${skills.length === 1 ? 'skill' : 'skills'}${groups}`);
  for (const group of map) {
    print(`${group.name} · ${group.skills.length} ${group.skills.length === 1 ? 'skill' : 'skills'}`);
    for (const skill of group.skills) print(`  ${skill}`);
  }
}

/** `<owner> · N repositories, M with skills`, then each of them with its skill count and link. */
function printOwner({ owner, repositories, warnings }: OwnerScan, { print, error }: Context) {
  const all = `${owner.repositories} ${owner.repositories === 1 ? 'repository' : 'repositories'}`;
  print(`${owner.id} · ${all}, ${repositories.length || 'none'} with skills`);
  for (const repository of repositories) {
    print(`${repository.name} · ${repository.skills} ${repository.skills === 1 ? 'skill' : 'skills'}`);
    print(`  ${repository.url}`);
  }
  for (const warning of warnings) error(`warning: ${warning}`);
}
