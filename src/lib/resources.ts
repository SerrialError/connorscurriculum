// Outside videos, simulations, and practice sets a lesson links to (lesson frontmatter "resources").
// Each one says who made it and why it was picked, and the page groups them by what you do with them.

export const RESOURCE_KINDS = ['video', 'simulation', 'practice', 'reading'] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export interface Resource {
  kind: ResourceKind;
  title: string;
  url: string;
  by: string;
  minutes?: number;
  why: string;
}

const GROUP_LABELS: Record<ResourceKind, string> = {
  video: 'Watch',
  simulation: 'Try it yourself',
  practice: 'Practice',
  reading: 'Read',
};

/** Where a link goes, for the line under its title ("YouTube"). */
export function siteName(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, '');
  if (host === 'youtube.com' || host === 'youtu.be') return 'YouTube';
  if (host === 'khanacademy.org') return 'Khan Academy';
  if (host === 'phet.colorado.edu') return 'PhET';
  return host;
}

/** "Jeremy Krug · 12 min · YouTube", leaving out the site when it is also the creator. */
export function resourceMeta(r: Resource): string {
  const site = siteName(r.url);
  return [r.by, r.minutes && `${r.minutes} min`, site !== r.by && site].filter(Boolean).join(' · ');
}

/** The resources in kind order (watch, try, practice, read), keeping the author's order inside each. */
export function groupResources(resources: Resource[]): { kind: ResourceKind; label: string; items: Resource[] }[] {
  return RESOURCE_KINDS.map((kind) => ({ kind, label: GROUP_LABELS[kind], items: resources.filter((r) => r.kind === kind) })).filter(
    (g) => g.items.length > 0,
  );
}
