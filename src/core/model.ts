/** A scanned repository. The hierarchy is organization → repository → skill. */
export type Repository = {
  /** `owner/name`, for example `JetBrains/kotlin`; a local directory's name. */
  id: string;
  organization: string;
  name: string;
  /** `https://github.com/<owner>/<repo>`, or a local directory's file:// URL. */
  url: string;
  /** The scanned commit; empty for a local directory. */
  commit: string;
};

/** One skill. Its link is derived, by `skillLink`. */
export type Skill = {
  /** `repo:path`, for example `JetBrains/kotlin:.claude/skills/x/SKILL.md`. */
  id: string;
  repository: string;
  path: string;
  name: string;
  description: string;
  /** The scanned commit, the one the link pins; empty for a local directory. */
  commit: string;
  /** The same skill in other agents' folders. */
  copies: string[];
  /** The SKILL.md itself, as the scan read it. */
  content: string;
};

/**
 * The SKILL.md file, from where its repository is: on GitHub at the scanned commit,
 * `https://github.com/<owner>/<repo>/blob/<commit>/<path>`; in a local directory, the file itself.
 */
export function skillLink(repository: Repository, skill: Skill): string {
  const path = skill.path.split('/').map(encodeURIComponent).join('/');
  return skill.commit ? `${repository.url}/blob/${skill.commit}/${path}` : `${repository.url}/${path}`;
}

/** By name, then by path: the same order everywhere, whatever the locale. */
export function sortSkills(skills: Skill[]): Skill[] {
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return [...skills].sort((a, b) => compare(a.name, b.name) || compare(a.path, b.path));
}

/** A GitHub organization or user: `https://github.com/<owner>`. */
export type Owner = {
  /** The login as GitHub spells it, for example `JetBrains`. */
  id: string;
  url: string;
  /** How many public repositories it has. */
  repositories: number;
};

/** One of an owner's repositories, with how many project skills it keeps. */
export type OwnerRepository = { id: string; name: string; url: string; skills: number };

/** Every repository of an owner that has project skills: the most skills first, then by name. */
export type OwnerScan = { owner: Owner; repositories: OwnerRepository[]; warnings: string[] };

/** The most skills first, then by name, whatever the locale. */
export function sortRepositories(repositories: OwnerRepository[]): OwnerRepository[] {
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return [...repositories].sort((a, b) => b.skills - a.skills || compare(a.name, b.name));
}
