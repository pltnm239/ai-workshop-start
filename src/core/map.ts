// The skill map: a repository's skills in groups. Without AI, by the words they share; with a
// model, by what the model answers. Both end in the same SkillMap, printed the same way.
import { AtlasError } from './errors.ts';
import type { Skill } from './model.ts';

/** One group of the map: its name and the names of its skills, sorted. */
export type SkillGroup = { name: string; skills: string[] };

/** The groups, the largest first, then by name; `other`, the skills that fit no group, last. */
export type SkillMap = SkillGroup[];

/** The group of the skills that share nothing with another one. */
export const OTHER = 'other';

/** Words that say nothing about what a skill is for. */
const STOPWORDS = new Set(
  `a about add after agent all also an and any are as asks at author authoring be before being between both but
  by can change changing code covers create creating define defining do does each edit editing either etc for
  from get guide guidelines has have how if in inside into is it its itself like make modify modifying more
  new no non not of on one or other over per provide provides run skill skills so some such than that the
  their them then there these this those through to under up use used user uses using via what when whenever
  where which while who with within without work working write writing you your`.split(/\s+/),
);

/** Words, lower case, plurals folded, no stopwords: `Writing lint checks` → `lint`, `check`. */
export function words(text: string): Set<string> {
  // A stopword is left out as it is written, `this`, and once folded, `covers`.
  const all = text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => !STOPWORDS.has(word)).map(singular);
  return new Set(all.filter((word) => word.length > 2 && !/^\d+$/.test(word) && !STOPWORDS.has(word)));
}

/**
 * `checks` → `check`, `classes` → `class`, `libraries` → `library`, `menus` → `menu`, `apis` → `api`;
 * not the singulars `analysis`, `axis`, `various`, `status`, `focus` or `access`.
 */
function singular(word: string): string {
  if (word.length <= 3 || !word.endsWith('s') || /(?:ss|sis|xis|ous|[bclprst]us)$/.test(word)) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (/(?:ss|sh|ch|x)es$/.test(word)) return word.slice(0, -2);
  return word.slice(0, -1);
}

/**
 * Groups by shared words, no model. Again and again, the word the most ungrouped skills share,
 * at least two, makes a group of them, named after it; the first in alphabetical order on a tie.
 * The words of the names come first: `jewel-ui` and `jewel-swing-interop` are together before any
 * description is read. Then the words of the descriptions' first sentences.
 * A word in more than half of four or more skills, `mps` in JetBrains/MPS, tells them apart from nothing: skipped.
 */
export function mapByWords(skills: Pick<Skill, 'name' | 'description'>[]): SkillMap {
  // By index, not by name: two skills can have the same name, in two directories.
  const names = skills.map((skill) => words(skill.name));
  const descriptions = skills.map((skill) => words(`${skill.name} ${firstSentence(skill.description)}`));
  const left = new Set(skills.keys());
  const groups: SkillGroup[] = [];
  for (const tier of [names, descriptions]) {
    const common = new Set(skills.length >= 4 ? [...counts(tier, skills.keys())].filter(([, n]) => n > skills.length / 2).map(([word]) => word) : []);
    for (;;) {
      const [best] = [...counts(tier, left)].filter(([word, n]) => n >= 2 && !common.has(word)).sort(([a, n], [b, m]) => m - n || compare(a, b));
      if (!best) break;
      const members = [...left].filter((index) => tier[index].has(best[0]));
      for (const index of members) left.delete(index);
      groups.push({ name: best[0], skills: members.map((index) => skills[index].name) });
    }
  }
  if (left.size > 0) groups.push({ name: OTHER, skills: [...left].map((index) => skills[index].name) });
  return sortMap(groups);
}

/** How many of the skills at these indices have each word. */
function counts(tier: Set<string>[], indices: Iterable<number>): Map<string, number> {
  const count = new Map<string, number>();
  for (const index of indices) for (const word of tier[index]) count.set(word, (count.get(word) ?? 0) + 1);
  return count;
}

/** What `claude -p` is asked: the skills, one per line with the first sentence, and the answer's shape. */
export function mapPrompt(repository: string, skills: Pick<Skill, 'name' | 'description'>[]): string {
  return [
    `Group the agent skills of the repository ${repository} by what they are for: a few groups, each with a short lower-case name of one or two words.`,
    'Every skill goes into exactly one group. Answer with JSON only, no other text:',
    '{"groups": [{"name": "<group>", "skills": ["<skill name>", ...]}]}',
    '',
    'The skills:',
    ...skills.map((skill) => (skill.description ? `- ${skill.name}: ${firstSentence(skill.description)}` : `- ${skill.name}`)),
  ].join('\n');
}

/**
 * The model's answer as a map. The JSON may come inside a code fence or with words around it.
 * A name that is not one of the skills is dropped, a skill in two groups stays in the first,
 * a skill the answer leaves out goes to `other`; a name two skills have puts both in its group.
 * No JSON of that shape: an AtlasError.
 */
export function parseMapAnswer(answer: string, skills: Pick<Skill, 'name'>[]): SkillMap {
  const groups = jsonObjects(answer)
    .map((object) => (object as { groups?: unknown } | null)?.groups)
    .find((groups): groups is SkillGroup[] => Array.isArray(groups) && groups.every(isGroup));
  if (!groups) {
    const quoted = answer.trim().replace(/\s+/g, ' ');
    throw new AtlasError(`The model's answer is not a skill map: ${quoted.length > 200 ? `${quoted.slice(0, 200)}…` : quoted || '(empty)'}`);
  }
  const left = new Set(skills.keys());
  const byName = new Map<string, string[]>();
  for (const group of groups) {
    const name = group.name.trim().toLowerCase() || OTHER;
    const members = [...left].filter((index) => group.skills.includes(skills[index].name));
    for (const index of members) left.delete(index);
    byName.set(name, [...(byName.get(name) ?? []), ...members.map((index) => skills[index].name)]);
  }
  if (left.size > 0) byName.set(OTHER, [...(byName.get(OTHER) ?? []), ...[...left].map((index) => skills[index].name)]);
  return sortMap([...byName].filter(([, members]) => members.length > 0).map(([name, members]) => ({ name, skills: members })));
}

/** Every JSON object in the text, outermost ones, in order: the words around them can have braces of their own. */
function jsonObjects(text: string): unknown[] {
  const objects: unknown[] = [];
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    const end = closingBrace(text, start);
    if (end === -1) continue;
    try {
      objects.push(JSON.parse(text.slice(start, end + 1)));
      start = end;
    } catch {
      // Not JSON from this brace: try the next one.
    }
  }
  return objects;
}

/** The index of the brace that closes the one at `start`, strings skipped; -1 if none does. */
function closingBrace(text: string, start: number): number {
  let depth = 0;
  for (let index = start, string = false; index < text.length; index++) {
    const char = text[index];
    if (string) {
      if (char === '\\') index++;
      else if (char === '"') string = false;
    } else if (char === '"') string = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return index;
  }
  return -1;
}

function isGroup(group: unknown): group is SkillGroup {
  const { name, skills } = (group ?? {}) as Partial<SkillGroup>;
  return typeof name === 'string' && Array.isArray(skills) && skills.every((skill) => typeof skill === 'string');
}

function sortMap(groups: SkillGroup[]): SkillMap {
  const rank = (group: SkillGroup) => (group.name === OTHER ? 1 : 0);
  return groups
    .map((group) => ({ name: group.name, skills: [...group.skills].sort(compare) }))
    .sort((a, b) => rank(a) - rank(b) || b.skills.length - a.skills.length || compare(a.name, b.name));
}

/** The same order whatever the locale. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The description's first sentence, on one line. */
export function firstSentence(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return /^.*?[.!?](?=\s|$)/.exec(line)?.[0] ?? line;
}
