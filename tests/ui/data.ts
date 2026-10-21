import { AtlasError } from '../../src/core/errors.ts';
import type { Source } from '../../src/core/scan.ts';

export const DEMO_COMMIT = '5ab6270ab772d113e8ad52ebfcaa0109c522ae00';
export const DEMO_URL = 'https://github.com/JetBrains/atlas-demo';

const skill = (name: string, description: string, body: string) => `---\nname: ${name}\ndescription: ${description}\n---\n${body}`;

const FILES: Record<string, string> = {
  '.agents/skills/code-review/SKILL.md': skill(
    'code-review',
    'Review a diff or a pull request. Every comment says where the problem is and how to reproduce it.',
    '# Code review\n\nRead the spec first, then the whole diff.\n\n> A comment without a place and a repro is not a comment.\n\n1. Run the tests\n2. Check the spec\n3. Write the review\n',
  ),
  '.claude/skills/code-review/SKILL.md': skill('code-review', 'Review a diff or a pull request.', '# Code review\n'),
  '.agents/skills/commits/SKILL.md': skill(
    'commits',
    'Write commit messages the way this repository does. Use for every commit.',
    '# Commits\n\nThe subject is **imperative**, under 72 characters.\n\n```\nAdd the filter to the web view\n```\n\n<script>alert(1)</script>\n',
  ),
  '.claude/skills/commits/SKILL.md': skill('commits', 'Write commit messages.', '# Commits\n'),
  '.claude/skills/release-checklist/SKILL.md': '---\nname: release-checklist\ndescription: Steps: before a release\n---\n# Release checklist\n\n- Tag the commit\n- Publish the notes\n',
  '.github/skills/code-style/SKILL.md': skill(
    'code-style',
    "Follow the project's code style.",
    '# Code style\n\n| Rule | Why |\n| --- | --- |\n| No comments | The code says it |\n| Small functions | Easy to test |\n\nSee [the spec](https://github.com/JetBrains/atlas-demo/blob/main/spec/web.md).\n',
  ),
  'agent/skills/writing-lint-checks/SKILL.md': skill(
    'writing-lint-checks',
    'Helps to write a new lint check. Start from an existing check.',
    '# Writing lint checks\n\nCopy a check, then change `id` and `message`.\n',
  ),
  '.claude/skills/debugging/SKILL.md': skill(
    'debugging',
    'Debugging techniques and tools for development.',
    '## Reproduce first\n\nA bug without a repro is a guess.\n',
  ),
  'src/not-a-skill/SKILL.md': skill('not-a-skill', 'Outside every skill root.', '# Ignored\n'),
};

/** Two skills with the same name, in two directories. */
export const SAME_NAME_URL = 'https://github.com/JetBrains/atlas-same-name';

const SAME_NAME_FILES: Record<string, string> = {
  '.agents/skills/alpha/SKILL.md': skill('review', 'First one.', 'Alpha body\n'),
  '.agents/skills/beta/SKILL.md': skill('review', 'Second one.', 'Beta body\n'),
};

const REPOSITORIES = [
  { url: DEMO_URL, name: 'atlas-demo', files: FILES },
  { url: SAME_NAME_URL, name: 'atlas-same-name', files: SAME_NAME_FILES },
];

export async function open(input: string): Promise<Source> {
  const bare = (url: string) => url.replace(/^https?:\/\//, '');
  const found = REPOSITORIES.find((repository) => bare(repository.url) === bare(input));
  if (!found) throw new AtlasError(`Repository not found: ${input}`);
  const { url, name, files } = found;
  return {
    repository: { id: `JetBrains/${name}`, organization: 'JetBrains', name, url, commit: DEMO_COMMIT },
    paths: Object.keys(files),
    warnings: [],
    read: async (path) => (path in files ? new TextEncoder().encode(files[path]) : undefined),
  };
}
