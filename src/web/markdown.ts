// A small Markdown renderer for SKILL.md bodies: headings, paragraphs, lists, quotes, code, tables,
// links and emphasis. Every character of the source is escaped first, so raw HTML in a SKILL.md is
// shown as text: a page about a repository never runs what the repository wrote.

/** The body as HTML; relative links resolve against `base`, the SKILL.md's own URL. */
export function renderMarkdown(text: string, base?: string): string {
  return blocks(text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n'), base);
}

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^ {0,3}>\s?/;
const ITEM = /^( {0,3})([-*+]|\d{1,9}[.)])(\s+|$)/;
const TABLE_RULE = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;

function blocks(lines: string[], base: string | undefined): string {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith(fence[1]); i++) code.push(lines[i]);
      i++;
      const language = fence[2] ? ` class="language-${escape(fence[2])}"` : '';
      out.push(`<pre><code${language}>${escape(code.join('\n'))}</code></pre>`);
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      out.push(`<h${heading[1].length}>${inline(heading[2], base)}</h${heading[1].length}>`);
      i++;
      continue;
    }
    if (RULE.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      for (; i < lines.length && QUOTE.test(lines[i]); i++) quoted.push(lines[i].replace(QUOTE, ''));
      out.push(`<blockquote>${blocks(quoted, base)}</blockquote>`);
      continue;
    }
    if (ITEM.test(line)) {
      i = list(lines, i, out, base);
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      i = table(lines, i, out, base);
      continue;
    }
    if (/^ {4}/.test(line)) {
      const code: string[] = [];
      for (; i < lines.length && (/^ {4}/.test(lines[i]) || !lines[i].trim()); i++) code.push(lines[i].slice(4));
      while (code.length && !code.at(-1)!.trim()) code.pop();
      out.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`);
      continue;
    }
    const paragraph: string[] = [];
    for (; i < lines.length && lines[i].trim() && !startsBlock(lines[i]); i++) paragraph.push(lines[i].trim());
    out.push(`<p>${inline(paragraph.join('\n'), base)}</p>`);
  }
  return out.join('\n');
}

function startsBlock(line: string): boolean {
  return FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || ITEM.test(line);
}

/** One list, its items and their nested blocks; returns the line after it. */
function list(lines: string[], start: number, out: string[], base: string | undefined): number {
  const ordered = /\d/.test(ITEM.exec(lines[start])![2]);
  const first = ordered ? Number.parseInt(ITEM.exec(lines[start])![2], 10) : 1;
  const items: string[][] = [];
  let loose = false;
  let i = start;
  while (i < lines.length) {
    const marker = ITEM.exec(lines[i]);
    if (!marker || /\d/.test(marker[2]) !== ordered) break;
    const width = marker[0].length || marker[1].length + marker[2].length + 1;
    const item = [lines[i].slice(marker[0].length)];
    for (i++; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) {
        const next = lines.slice(i + 1).find((l) => l.trim());
        if (next === undefined || (!/^\s/.test(next) && !ITEM.test(next))) break;
        const sibling = ITEM.exec(next);
        if (sibling && !/^\s{2,}/.test(next) && /\d/.test(sibling[2]) === ordered) loose = true;
        item.push('');
        continue;
      }
      if (/^\s/.test(line) && !ITEM.test(line)) item.push(line.replace(new RegExp(`^ {0,${width}}`), ''));
      else if (/^\s{2,}/.test(line)) item.push(line.replace(new RegExp(`^ {0,${width}}`), ''));
      else if (ITEM.test(line)) break;
      else item.push(line); // a lazy continuation of the item's paragraph
    }
    items.push(item);
    while (i < lines.length && !lines[i].trim()) i++;
  }
  const rendered = items.map((item) => {
    const html = blocks(item, base);
    return loose ? html : html.replace(/<p>([\s\S]*?)<\/p>/g, '$1');
  });
  const tag = ordered ? 'ol' : 'ul';
  const startAttribute = ordered && first !== 1 ? ` start="${first}"` : '';
  out.push(`<${tag}${startAttribute}>${rendered.map((html) => `<li>${html}</li>`).join('')}</${tag}>`);
  return i;
}

/** A pipe table with a header row; returns the line after it. */
function table(lines: string[], start: number, out: string[], base: string | undefined): number {
  const cells = (line: string) =>
    line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
  const alignments = cells(lines[start + 1]).map((cell) =>
    cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : cell.startsWith(':') ? 'left' : '',
  );
  const row = (line: string, tag: string) =>
    `<tr>${cells(line)
      .map((cell, index) => {
        const align = alignments[index] ? ` style="text-align:${alignments[index]}"` : '';
        return `<${tag}${align}>${inline(cell, base)}</${tag}>`;
      })
      .join('')}</tr>`;
  const body: string[] = [];
  let i = start + 2;
  for (; i < lines.length && lines[i].includes('|') && lines[i].trim(); i++) body.push(row(lines[i], 'td'));
  out.push(`<table><thead>${row(lines[start], 'th')}</thead><tbody>${body.join('')}</tbody></table>`);
  return i;
}

/** Code spans, links, emphasis and line breaks inside one block. */
function inline(text: string, base: string | undefined): string {
  const kept: string[] = [];
  const keep = (html: string) => `\u0000${kept.push(html) - 1}\u0000`;
  let html = text
    .replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, _ticks, code: string) => keep(`<code>${escape(code.trim() || code)}</code>`))
    .replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, (_, character: string) => keep(escape(character)));
  html = html.replace(/!?\[([^\]]*)\]\(\s*<?((?:[^()\s>]|\([^()\s]*\))*)>?(?:\s+"[^"]*")?\s*\)/g, (_, label: string, href: string) => {
    const url = safeUrl(href, base);
    return url ? keep(`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`) : label;
  });
  html = html.replace(/<(https?:\/\/[^\s>]+)>|\bhttps?:\/\/[^\s<>()]*[^\s<>().,;:!?'"]/g, (match: string, bracketed?: string) => {
    const url = bracketed ?? match;
    return keep(`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(url)}</a>`);
  });
  html = escape(html)
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*|__(?=\S)([\s\S]*?\S)__/g, (_, a?: string, b?: string) => `<strong>${a ?? b}</strong>`)
    .replace(/\*(?=\S)([\s\S]*?\S)\*|\b_(?=\S)([\s\S]*?\S)_\b/g, (_, a?: string, b?: string) => `<em>${a ?? b}</em>`)
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>')
    .replace(/(?: {2,}|\\)\n/g, '<br>\n');
  return html.replace(/\u0000(\d+)\u0000/g, (_, index: string) => kept[Number(index)]);
}

/** Web and mail links, and links relative to the SKILL.md; nothing that runs script. */
function safeUrl(href: string, base: string | undefined): string | undefined {
  if (!href) return undefined;
  try {
    const url = base ? new URL(href, base) : new URL(href);
    return ['http:', 'https:', 'mailto:', 'file:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return href.startsWith('#') ? href : undefined;
  }
}

export function escape(text: string): string {
  return text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}
