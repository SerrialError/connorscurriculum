# connorscurriculum

**https://connorscurriculum.com/**

A free study site for AP Chemistry, written by students in the class. It has lessons, classmates'
notes typed up from their notebooks, practice questions with worked explanations, practice exams
in the format of the class tests, and links to the released AP free-response questions.

Everything is tagged twice: by textbook chapter (Brown, LeMay et al., *Chemistry: The Central
Science*, 15th ed.) and by topic in College Board's AP Chemistry Course and Exam Description. You
can study in the order the class covers it, or by AP unit before the exam.

## What's on the site

- **Lessons.** Teaching pages for each chapter, with diagrams, 3D molecule and orbital models you
  can rotate, and hand-picked outside videos and simulations.
- **Classmates' notes.** Typed up from the original pages. Each one links the photos it came from,
  and any corrections are marked as such.
- **Practice.** Filter by chapter, textbook section, AP topic, difficulty, or class test. Questions
  are marked "AP exam" or "Class only", and "Weakest first" puts the topics you miss most up front.
- **Practice exams.** Drawn fresh each time to match a class test's format and point values.
- **AP topics.** Every CED topic, whether the class has covered it, and where the textbook is thin.
- **Past FRQs.** The 2023–2026 released questions, each part tagged by AP topic, linked to College
  Board's PDFs.
- **Reference panel.** The AP equation sheet and periodic table, one click (or <kbd>R</kbd>) away
  on every class page.

## Contributing

Notes, lessons, questions, and corrections are all welcome. You don't need to write code: there's
a browser editor at [connorscurriculum.com/admin/](https://connorscurriculum.com/admin/) that
opens a pull request for you. See [CONTRIBUTING.md](CONTRIBUTING.md) for how it works and how to
format lessons and questions.

Found a wrong answer or a broken page?
[Open an issue](https://github.com/SerrialError/connorscurriculum/issues/new) with a link to the
page.

## Running it locally

You need Node 22.12 or newer.

```sh
npm install
npm run dev       # http://localhost:4321 (search only works after a build)
npm run build     # builds dist/ and the search index; fails on any bad tag
npm run preview   # serves dist/
npm run check     # type check and unit tests
npm run perf      # page speed on a throttled phone, after a build
```

With [Nix](https://nixos.org/), `devenv.nix` provides Node and installs the packages for you:
run `direnv allow` once (or use `devenv shell`), then `devenv up` to start the dev server.

## How it's built

[Astro](https://astro.build/) generates a static site, with [Svelte](https://svelte.dev/) for
the practice page and [three.js](https://threejs.org/) for the 3D models. Math is rendered with
KaTeX and mhchem, and search uses [Pagefind](https://pagefind.app/). Lessons are MDX files and
questions are YAML lists, all under `src/content/`. Course structure (chapters, AP topics, tests,
class progress) is JSON under `src/data/`. The editor is [Sveltia CMS](https://sveltiacms.app/).

```
src/
  content/lessons/<subject>/<chapter>-<slug>/index.mdx   one folder per lesson, images alongside
  content/questions/<subject>/<chapter>-<slug>.yaml      a list of questions per file
  data/<subject>/                                        chapters, AP topics, tests, progress, FRQs
  content.config.ts                                      schemas: every tag is checked at build time
  components/  lib/  pages/                              site code (lib/ has the unit tests)
```

More subjects can be added without code changes; see [docs/data.md](docs/data.md#adding-a-subject).
[docs/data.md](docs/data.md) also covers the course data files and where their contents came from.

Every pull request is type-checked, tested, built, and checked for page speed. Merges to `main`
deploy to GitHub Pages.

## Credits

Lessons and questions name their authors on each page. Classmates' notes are credited to the
classmate who wrote them. Outside videos and simulations belong to their creators and are linked,
not copied. AP is a trademark of College Board, which is not involved with this site. Released FRQs
are linked to College Board's own PDFs and never reproduced here.
