// The skills filter of the web view: which skills a query keeps, and which parts of the name and the
// description line to highlight. Plain JavaScript with no DOM: the page imports it as it is, and
// the tests run the same file.

/** How far into the description line a match may start and still be seen in the two-line list. */
const VISIBLE = 80;
/** The excerpt shown when the first match is further in: this much before it, this much in all. */
const BEFORE = 30;
const EXCERPT = 140;

/**
 * @typedef {{ text: string, match: boolean }} Segment A run of text, highlighted when it matches
 * @typedef {{ name: Segment[], description: Segment[] }} Shown A skill as the list shows it
 */

/** The description's first sentence, on one line. */
export function firstSentence(text) {
  const line = oneLine(text);
  return /^.*?[.!?](?=\s|$)/.exec(line)?.[0] ?? line;
}

/** The words of a query; each must occur, in any case, in the name or in the description. */
export function words(query) {
  return [...new Set(query.trim().split(/\s+/).filter(Boolean))];
}

/**
 * The skill as the list shows it for the query: its name and description line, split into
 * highlighted matches and the rest; `null` when the query leaves it out.
 * @param {{ name: string, description: string }} skill
 * @param {string} query
 * @returns {Shown | null}
 */
export function show(skill, query) {
  const all = words(query);
  const description = oneLine(skill.description);
  if (!all.every((word) => find(skill.name, [word]).length > 0 || find(description, [word]).length > 0)) return null;
  return { name: segments(skill.name, all), description: descriptionLine(description, all) };
}

/** The first sentence, or, when the first match is past what the list shows, the text around it. */
function descriptionLine(description, all) {
  const sentence = firstSentence(description);
  const first = find(description, all)[0];
  if (!first || first[0] < Math.min(sentence.length, VISIBLE)) return segments(sentence, all);
  let start = Math.max(0, first[0] - BEFORE);
  // Start at a word, unless that leaves nothing before the match: inside a long URL, say.
  const space = description.indexOf(' ', start);
  if (start > 0 && space !== -1 && space < first[0] - 1) start = space + 1;
  let end = Math.min(description.length, start + EXCERPT);
  const last = description.lastIndexOf(' ', end);
  if (end < description.length && last > first[1]) end = last;
  return [
    ...(start > 0 ? [{ text: '…', match: false }] : []),
    ...segments(description.slice(start, end), all),
    ...(end < description.length ? [{ text: '…', match: false }] : []),
  ];
}

/** The text split at every occurrence of the words. */
function segments(text, all) {
  const result = [];
  let at = 0;
  for (const [start, end] of find(text, all)) {
    if (start > at) result.push({ text: text.slice(at, start), match: false });
    result.push({ text: text.slice(start, end), match: true });
    at = end;
  }
  if (at < text.length || result.length === 0) result.push({ text: text.slice(at), match: false });
  return result;
}

/** Where the words occur in the text, in any case: sorted `[start, end)` ranges, overlaps merged. */
function find(text, all) {
  const ranges = [];
  for (const word of all) {
    // `iu`: case-insensitive without changing the length of the text, so the ranges index into it.
    for (const match of text.matchAll(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu'))) {
      ranges.push([match.index, match.index + match[0].length]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
    else merged.push(range);
  }
  return merged;
}

const oneLine = (text) => text.replace(/\s+/g, ' ').trim();
