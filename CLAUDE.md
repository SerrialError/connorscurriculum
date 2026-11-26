# CLAUDE.md

Guidance for AI agents working in this repo. Read [README.md](README.md) for what the site is,
[CONTRIBUTING.md](CONTRIBUTING.md) for the lesson and question formats, and
[docs/data.md](docs/data.md) for the course data files. This file covers what those don't: how
the code fits together, the rules content has to follow, and the traps earlier agents hit.

## The project

A public AP Chemistry study site at https://connorscurriculum.com/, used by Connor's class and
anyone else studying for AP Chemistry. Connor (GitHub `SerrialError`) owns it, reviews every pull
request, and asks for most changes. Classmates contribute notes; Connor usually uploads photos of
them and asks for them to be typed up.

- Textbook: Brown, LeMay et al., *Chemistry: The Central Science*, **15th edition**. You don't
  have a copy. Never state a section number, a figure, or what the book says from memory. Ask
  Connor for a photo of the page or table of contents, or say plainly that it's unverified.
- AP scope: the *AP Chemistry Course and Exam Description, Effective Fall 2024*
  ([PDF](https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf)).
  When a question depends on what's assessed, read the CED's exclusion statements instead of
  guessing. On NixOS: `nix-shell -p poppler-utils --run "pdftotext ced.pdf ced.txt"`.
- Where the class is: `src/data/apchem/progress.json` (`chapters` finished, `current` in class).
  Only write content for the chapters Connor asks for.
- Don't save anything to Claude's memory folder. If a later session should know something, add it
  to this file.

## Commands

Node comes from devenv and isn't on the plain shell's PATH. Run commands through direnv:
`direnv exec . npm run check`. A new worktree needs `direnv allow` once, or run from the main
checkout with absolute paths.

```sh
npm run dev        # dev server, http://localhost:4321
npm run check      # astro check + vitest (all unit tests)
npm run build      # astro build + Pagefind; validates every tag; fails on run-together text
npm run perf       # page speed after a build; `-- --check` is what CI runs on PRs
npx vitest run src/lib/practice/choice-balance.test.ts   # one test file
```

Run `check` and `build` before every commit that touches content or code. The build is the real
content validator: schemas in `src/content.config.ts` check every tag against `src/data/`.

**Dev server.** Start it in the background as `npx astro dev --port 4321 --host localhost`. It does
not survive a session restart, so check it's up (`curl -sI http://localhost:4321/`) before giving
Connor a link. Give links as `http://localhost:4321/...`, never `127.0.0.1`. Restart it after
adding new image files or when a page looks stale. It sometimes keeps serving old figures or a
blank 3D viewer.

## How the code fits together

- **Astro 7, static output**, `trailingSlash: 'always'`, and `base` from `BASE_PATH`. Build every
  internal link with `url()` from `lib/content.ts`, never a hard-coded `/`.
- **Content collections** (`src/content.config.ts`): `subjects` and `cedTopics` load from
  `src/data/`; `lessons` load from MDX folders; `questions` come from a custom loader that reads
  each YAML list and rejects duplicate ids. `checkTags` (`lib/validate.ts`) checks chapters,
  sections, topics, and authors against the registry.
- **Registry** (`lib/registry.ts`): reads `src/data/<subject>/*.json` synchronously. Only
  `chapters.json` is required.
- **Multi-class.** Nothing may assume AP Chemistry or a single subject. `lib/features.ts` decides
  which pages and nav items a class gets from its data, and `lib/features.test.ts` builds a fixture
  site with a second class (`lib/fixtures/two-classes/`). `/` is a real dashboard of classes even
  with one class. Don't redirect it.
- **Practice** (`components/practice/`, Svelte 5 island; logic in `lib/practice/`). The page
  carries only question metadata, passed as one plain JSON string (Astro's typed island props were
  slow to unpack). Question text is pre-rendered to HTML at build time (`lib/practice/build.ts`)
  and fetched one chapter at a time from `pages/[subject]/practice/questions/[chapter].json.ts`,
  so the browser ships no Markdown or KaTeX. Filters live in the URL (`lib/practice/url.ts`).
- **3D viewers** (`components/molecule/`, three.js): molecule data in `lib/molecules.ts`, orbital
  scenes in `lib/orbitals.ts`, and flat SVG versions for pages with many shapes in
  `lib/svg-model.ts`. Viewers release their WebGL context off screen. The libraries are listed in
  `vite.optimizeDeps` in `astro.config.ts` so the dev server doesn't re-bundle them mid-session.
- **Reference panel** (`components/reference/`): the equation sheet and periodic table, on every
  class page, toggled with R. It is site-wide, so its script must stay small and self-contained
  (see Performance).
- **Editor** (`/admin/`, Sveltia CMS): config generated from the registry in `lib/cms.ts`.
  `lib/lesson-preview.ts` mirrors the lesson components for the live preview, so a new MDX
  component needs a preview there too, and an entry in the CMS body hint in `lib/cms.ts`.
- **Lesson components** are passed to MDX in `pages/[subject]/lessons/[slug].astro`. A new one
  goes there, in the preview, and in CONTRIBUTING's components table.
- **Build checks** in `astro.config.ts`: `text-joins` fails the build when two pieces of template
  text run together ("yet.See"). Fix it with `{' '}` between them.
- Tests sit next to their modules (`lib/**/*.test.ts`). Add or update one with any logic change.

## Content rules

These come from Connor's corrections. Breaking one has meant redoing work.

**Accuracy and sourcing**
- Work every number. Recompute every answer key after editing a question.
- Don't add anything to a copy of an official document (equation sheet, periodic table) that isn't
  on the original, even a helpful legend. If the site's version differs from the original, link
  the original.
- Credit only creators you can verify. Material with no findable creator doesn't go on the site,
  even with an "unknown author" note. A page was removed for this.
- Verify every outside link before adding it to `resources`, and every claim in its `why`. Khan
  Academy pages only render in a real browser (curl gets a bot check); use
  `chromium --headless=new --dump-dom URL`. YouTube titles, lengths, and chapter timestamps come
  from the watch page. Captions are blocked, so don't describe what happens in a video beyond its
  title, description, and timestamps.

**Class conventions** (Connor's teacher; check new content against these)
- Every test comes with the
  [AP equation sheet](https://apcentral.collegeboard.org/media/pdf/ap-chemistry-equations-sheet.pdf)
  and a periodic table. Don't tell students to memorize anything on them. Not on the sheet, so fair
  to expect: the Bohr constant 2.18 × 10⁻¹⁸ J, Å, and λ = h/mv.
- For a single hydrogen level Eₙ, the teacher grades the magnitude, not the sign. The sign matters
  for ΔE.
- Students don't memorize the order of the EM spectrum by wavelength.
- Dipole moments are compared qualitatively only (larger ΔEN or longer bond → larger μ). Don't
  write μ = Qr calculations, debyes, or partial-charge math.
- The teacher stresses theory over math. Don't ask for facts the class doesn't teach and can't be
  reasoned out ("which halogen is a liquid?"). Give the facts in the prompt and ask for reasoning.
- AP vs class only follows the CED exclusions. Not assessed: assigning quantum numbers,
  aufbau-exception configurations, deriving or drawing hybrid orbitals, d-orbital hybridization
  (shape only for 5–6 domains), and MO theory. Assessed: σ/π bonds, sp/sp²/sp³ names, resonance.
  Class-only questions get `cedTopics: []`.
- If something is on neither the AP exam nor the class tests, delete it from lessons and questions.
  Don't keep it with a "not on AP" note. For Chapters 1–3 that meant Fahrenheit, R_f values,
  calories, mass spectra of molecules, and organic naming (2.9). The atom-history experiments
  (Dalton, Thomson, Millikan, Rutherford) were on the class test, so they stay. In Chapters 4–5 the
  class covered ΔE = q + w with work signs, state functions, the longer solubility-rules table, and
  HClO₃ as a strong acid, so those stay as class-only content.
- Review sheets list only what to memorize. Don't restate what the equation sheet gives, not even as a
  "Given on the sheet" list.
- The CED has no list of polyatomic ions, but AP questions name compounds and expect the formula.
  The site teaches the common 16 plus hydronium.
- The Chapters 1–3 format (45 MCQ, about 20 of them math, including empirical formulas and
  limiting/excess reactants) and the Chapters 6–7 format (36 MCQ × 2.8 + one 7.2-point FRQ) are
  encoded in `src/data/apchem/tests.json`. Ask for the format of any new test rather than guessing
  it.

**Questions**
- `src/lib/practice/choice-balance.test.ts` fails a chapter when the correct choice is the longest
  too often, or one letter is the answer too often. Write distractors as long as the answer. Use
  four choices (a lone five-choice question fails the letter check).
- Connor wants many questions per topic, including plenty of hard ones (`difficulty: 3`). Label
  difficulty honestly; reviewers have caught "medium" questions that were easy.
- Questions on the same molecule or fact, where one gives away another, share a `group`.
- Don't repeat a lesson's worked example as a question.
- Edit YAML with the Edit tool or by splicing text. A JavaScript `String.replace` with a
  replacement string containing `$'` or `$&` once duplicated half a question file. After any
  scripted edit, check the question count and run the build (it rejects duplicate ids).

**Lessons and notes**
- Connor wants lessons to be as visual as possible: lots of diagrams, and charts instead of dense
  tables where it helps. Generated SVG figures go in the lesson folder. If a script makes a figure,
  keep the script's copy current; re-running a stale generator once overwrote a fixed figure.
  Escape `<` in SVG text.
- Notes pages: type up the notes as written, mark fixes with **Correction:** callouts, and add
  `originals` (see CONTRIBUTING). Strip metadata and resize photos first:
  `nix-shell -p imagemagick --run 'magick in.jpg -auto-orient -strip -resize "2000x2000>" -quality 80 out.jpg'`.
  When Connor uploads notes, check whether each page is really by the named classmate; some
  uploads have been online sheets.

**Writing style** (site copy, lessons, explanations, PR text)
- Plain, specific, and calm. No AI tells: no headings like "Mistakes that cost points", no
  cheerful filler, no "Let's dive in", no em-dash-heavy rhythm.
- Name things the way the site does: "AP topics", "Class only", "practice exam".

## UX and code quality

- UX comes first for Connor, then UI, and code quality is judged too. Keep technical debt low:
  reuse existing modules, no dead code, no one-off hacks.
- Check every UI change in a real browser at phone width (~390 px), a laptop (1280 px), and a large
  monitor (**2560×1440**; Connor uses one, and layouts have looked "small and squished" there), in
  light and dark mode. Use the T3 preview browser. If it's broken, system `chromium` headless
  works.
- In screenshots and browser checks, set every `img.loading = "eager"` first (lesson figures are
  lazy-loaded and come out blank), and wait for page scripts before capturing.
- Practice filters must never start a set by themselves: students combine filters, see the count,
  then press Start.

## Performance

`npm run perf` loads key pages on a throttled phone and checks them against `perf-budgets.json`.
CI fails a pull request on size, ready-time ratio, or layout shift. Run it before and after any
change that adds client JavaScript, page data, or a new page, and add heavy new pages to the
budgets. Compare against main with `PERF_DIST=<main's dist> npm run perf`.

Traps that have slowed every page without anyone noticing:
- Whatever a browser `<script>` imports is bundled for the client. Importing a module that also
  imports KaTeX shipped 260 kB to every page. Keep build-only helpers out of client imports.
- A dynamic `import()` in a site-wide script made Rolldown pull its runtime helper from the 3D
  chunk (228 kB). Avoid dynamic imports in site-wide scripts.
- A shared module imported by a script on every page becomes its own late-loading chunk (~100 ms
  on a phone). Keep site-wide scripts self-contained.

## Git and pull requests

- Branch from an up-to-date `origin/main`. Connor often has uncommitted edits in the main checkout:
  work in a `git worktree` and leave his files alone. Commit only the files you changed.
- `main` requires the `build` check. Only a **push** to `main` deploys to GitHub Pages. A
  `workflow_dispatch` run doesn't deploy, and pull requests get no hosted preview, so give Connor
  localhost links for unmerged work.
- **Avoid stacked PRs.** Base every PR on `main` unless it truly depends on another. Stacking has
  gone wrong three times: after the base PR was merged, the stacked PRs merged into the old base
  branch instead of `main`, and deleting a base branch through the API closed the PR above it. If
  you must stack: tell Connor the order, say to use **Create a merge commit** (not squash), and
  after each merge confirm the next PR now targets `main` before anything else merges. The repo
  auto-deletes head branches on merge, which retargets stacked PRs safely. Don't delete branches
  by hand.
- After a merge, check that `main` contains the change and that the deploy finished before saying
  the live site is updated.
- PR descriptions: what changed and why, before/after screenshots with the changed parts boxed,
  and steps to test locally. Screenshots go on the `pr-assets` branch under `prNN/` and are linked
  with `raw.githubusercontent.com` URLs. When an independent review was done, include its grade
  and reasoning.
- For substantial UX work Connor asks for a review loop: a subagent does the work, and a **fresh**
  subagent grades it each round, without the worker being told the target score. Keep looping
  until the grade is at least 9/10. For content work, a few rounds is enough.

## Hosting

- GitHub Pages, deployed by `.github/workflows/build.yml`, which reads `BASE_PATH` and `SITE_URL`
  from the Pages settings. Custom domain `connorscurriculum.com`. The old
  `serrialerror.github.io/connorscurriculum/` redirects to it.
- DNS is on Cloudflare: A/AAAA records for GitHub Pages on `@`, `www` CNAME to
  `serrialerror.github.io`, and a `_github-pages-challenge-SerrialError` TXT record. All must stay
  **DNS only** (grey cloud), or GitHub can't renew the HTTPS certificate. Cloudflare can take
  several minutes to serve a record after the dashboard shows it. If the site won't load, check
  the authoritative nameservers (`dig @<ns> connorscurriculum.com A`) and whether the client has
  IPv6 before blaming the site.
- Editor sign-in: "Sign In with GitHub" goes through a Cloudflare Worker built from
  `SerrialError/sveltia-cms-auth` (`CMS_AUTH_URL` in `lib/cms.ts`). `ALLOWED_DOMAINS` and
  `GITHUB_CLIENT_ID` are in that repo's `wrangler.toml`. The client secret is a dashboard Secret.
  Its `package.json` pins pnpm, because Cloudflare's default pnpm 9 rejects the lockfile. Every
  push there redeploys the Worker.
