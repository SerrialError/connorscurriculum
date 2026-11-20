// Sveltia CMS configuration, generated from the registry so the chapter and AP topic
// pickers always match chapters.json and ced.json. One lesson collection per subject.
import type { SubjectData } from './registry';

export const CMS_REPO = 'SerrialError/connorscurriculum';

// GitHub sign-in goes through a sveltia-cms-auth Cloudflare Worker (see README, "Editor sign-in").
export const CMS_AUTH_URL = 'https://sveltia-cms-auth.serrialerror.workers.dev';

const BODY_HINT = [
  'Markdown. Math: `$k = 0.693/t_{1/2}$` inline, `$$ ... $$` on their own lines for display. Chemistry: `$\\ce{2H2 + O2 -> 2H2O}$`.',
  'Boxes: `<Callout type="note">...</Callout>` (note, warning, ap-tip, not-on-ap), `<Reveal label="Show answer">...</Reveal>`, `<YouTube id="wYqQCojggyM" />`. 3D models: `<Molecule id="sf4" />` (ids in src/lib/molecules.ts), `<ShapeExplorer />`, `<OrbitalViewer ids="ch4,nh3" boxes />` (ids in src/lib/orbitals.ts). Charts: `<ShapeGrid />` (its "Turn it in 3D" links need a `<ShapeExplorer />` on the page), `<ShapeGrid kind="domains" />`, `<HybridCards />`.',
  'Curly braces outside math are read as code: write `\\{` and `\\}`. The preview flags anything that would break the site.',
].join(' ');

export function lessonCollection(data: SubjectData) {
  const { subject } = data;
  return {
    name: `lessons-${subject.id}`,
    label: `${subject.name} lessons`,
    label_singular: 'Lesson',
    folder: `src/content/lessons/${subject.id}`,
    // src/content/lessons/<subject>/<chapter>-<slug>/index.mdx, images in the same folder.
    path: '{{chapter}}-{{slug}}/index',
    extension: 'mdx',
    format: 'frontmatter',
    media_folder: '',
    public_folder: '',
    create: true,
    summary: 'Ch. {{chapter}} · {{title}}',
    sortable_fields: ['chapter', 'title'],
    fields: [
      { name: 'title', label: 'Title', widget: 'string' },
      { name: 'subject', label: 'Subject', widget: 'hidden', default: subject.id },
      {
        name: 'chapter',
        label: 'Chapter',
        widget: 'select',
        options: data.chapters.map((c) => ({ label: `${c.number}. ${c.title}`, value: c.number })),
      },
      // A class without standards (no ced.json) has no topics to pick.
      ...(data.topics.size === 0
        ? []
        : [
            {
              name: 'cedTopics',
              label: 'AP topics',
              widget: 'select',
              multiple: true,
              required: false,
              default: [],
              hint: `Every AP topic this lesson teaches. Leave empty if it is class-only (not on the exam). Each topic's page lists this lesson.`,
              options: data.ced.units.flatMap((u) =>
                u.topics.map((t) => ({ label: `${t.id} ${t.title} (Unit ${u.id})`, value: t.id })),
              ),
            },
          ]),
      {
        name: 'sections',
        label: 'Textbook sections',
        widget: 'list',
        required: false,
        default: [],
        hint: 'Optional, e.g. 14.3',
      },
      {
        name: 'kind',
        label: 'Kind',
        widget: 'select',
        default: 'lesson',
        options: [
          { label: 'Lesson (teaches a topic)', value: 'lesson' },
          { label: 'Notes (your own class notes)', value: 'notes' },
          { label: 'Test review sheet', value: 'review' },
        ],
        hint: 'Chapter and test pages group lessons by kind. Review sheets are shown first on the test page.',
      },
      {
        name: 'order',
        label: 'Order in chapter',
        widget: 'number',
        value_type: 'int',
        required: false,
        default: 1,
        hint: 'Lower numbers come first within the chapter.',
      },
      { name: 'authors', label: 'Authors', widget: 'list', min: 1, hint: 'Your name (first name is fine).' },
      { name: 'summary', label: 'Summary', widget: 'text', required: false, hint: 'One sentence shown on cards and in search.' },
      {
        name: 'originals',
        label: 'Original pages',
        widget: 'list',
        required: false,
        default: [],
        hint: 'Photos or PDFs of the notes this was typed up from. Readers can open them from the end of the page.',
        fields: [
          { name: 'file', label: 'Photo or PDF', widget: 'file', media_folder: 'originals', public_folder: 'originals' },
          { name: 'caption', label: 'Caption', widget: 'string', required: false, hint: 'e.g. 8.1–8.4' },
        ],
      },
      {
        name: 'draft',
        label: 'Draft',
        widget: 'boolean',
        default: false,
        hint: 'Saving opens a pull request, and the lesson goes live when it is merged. Turn this on to keep it hidden even after merging.',
      },
      // Raw mode only: the rich-text editor would escape the backslashes and $ in math.
      { name: 'body', label: 'Lesson', widget: 'markdown', modes: ['raw'], hint: BODY_HINT },
    ],
  };
}

export function cmsConfig(registry: Map<string, SubjectData>) {
  return {
    load_config_file: false,
    backend: {
      name: 'github',
      repo: CMS_REPO,
      branch: 'main',
      ...(CMS_AUTH_URL ? { base_url: CMS_AUTH_URL } : {}),
      // Classmates without write access edit in their own fork and submit a pull request.
      open_authoring: true,
      // The repo is public, so sign-in only needs access to public repos.
      auth_scope: 'public_repo',
    },
    // Every save goes to a cms/... branch with its own pull request; CI builds it and nothing
    // reaches main (and the live site) until the pull request is merged.
    publish_mode: 'editorial_workflow',
    media_folder: 'public/media',
    public_folder: '/media',
    collections: [...registry.values()].map(lessonCollection),
  };
}
