# Notes for Claude

Read CONTRIBUTING.md for the content formats and checks. This file holds Connor's preferences and
facts about his class that aren't written down anywhere else.

Don't save anything to Claude's memory folder. If a later session should know something, add it here.

## How Connor wants work done

- UX matters most, then UI. Code quality and low tech debt are judged too, not just the result.
- No AI tells in site copy: no headings like "Mistakes that cost points", no cheerful filler.
- Keep `/` a real multi-class dashboard even with one subject, since more classes may come.
- Commit, push, or open a PR only when asked. PRs go in a sensible stacked order. Each has
  before/after screenshots with boxed highlights and steps to test it locally. Screenshots go on
  the `pr-assets` branch under `prNN/` and are linked with raw.githubusercontent URLs.
- For big UX work, a subagent does the work and a fresh, independent subagent grades it each round.
  Don't tell the worker the target score. Loop until the grade is at least 9/10, and put the grade
  and the grader's reasoning in the PR.
- For content work, keep review loops to a few rounds.

## Lessons and questions

- Lots of practice problems, including many hard ones, and lots of diagrams. SVGs generated into the
  lesson folder are fine.
- In multiple-choice questions, the longest choice shouldn't tend to be the correct one.
- If something is on neither the AP exam nor the class tests, delete it. Don't keep it with a
  "not on AP" flag. Topics that are on class tests but not AP stay, with `cedTopics: []`, and show as
  "Class only".
- Review sheets list only what to memorize. Don't restate what the equation sheet gives.
- AP vs. class-only follows the 2024 CED and its exclusion statements
  (https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description-effective-fall-2024.pdf;
  extract the text with `mutool draw -F txt`). Not assessed: assigning quantum numbers,
  aufbau-exception configurations, deriving or drawing hybrid orbitals, d-orbital hybridization
  (only the shapes for 5–6 domains), and MO theory. σ/π bonds, sp/sp²/sp³ names, and resonance
  structures are assessed.

## Connor's class

- The textbook is Brown/LeMay, *Chemistry: The Central Science*, 15th ed.
- Every class test comes with the AP Chemistry equation sheet
  (https://apcentral.collegeboard.org/media/pdf/ap-chemistry-equations-sheet.pdf). It has h, c,
  Avogadro's number, E = hν, c = λν, the metric prefixes, R, and more, so don't tell students to
  memorize those. It doesn't have the Bohr constant 2.18×10⁻¹⁸ J, the ångström, or λ = h/mv.
- For a single hydrogen level Eₙ, the teacher grades the magnitude, not the sign. The sign matters
  only for ΔE.
- Students don't memorize the order of the EM spectrum by wavelength.
- Dipole moments are compared only qualitatively (bigger ΔEN or a longer bond gives a larger μ). The
  class never calculates μ = Qr, debyes, or partial charges.
- Chapters 1–3 test: 45 multiple-choice questions, about 20 of them math (some easy, some empirical
  formulas and limiting/excess reactants). It didn't have Fahrenheit, R_f calculations, calories, mass
  spectra of molecules, or organic naming (2.9), and neither does AP, so the site leaves them out.
  It did have the atom-history experiments (Dalton, Thomson, Millikan, Rutherford).
- Chapters 6–7 test: 36 multiple-choice questions × 2.8 pts plus one 7.2-pt FRQ, 108 pts in all.
  About 13 questions on quantum numbers and configurations, 8 on energy, wavelength, and frequency,
  and 14 on periodic trends. The teacher stresses theory over math.
- Polyatomic ions: the CED has no list, but AP questions name compounds and expect the formula, so
  the site teaches the common 16 plus hydronium.

## Content sources and credit

- Connor uploads classmates' handwritten notes (Jaya, Rebecca, Ryan Rezaei, Sophia T) and sometimes
  teacher handouts. Every notes page shows the photos or PDFs it was typed from (`originals:`).
  Before committing photos, strip metadata like GPS and resize them:
  `magick in.jpg -auto-orient -strip -resize "2000x2000>" -quality 80 out.jpg`
  (`nix-shell -p imagemagick`).
- Don't add online material whose creator can't be found.
- Skip physics for now. A physics class would need its course name first.
- Check every outside resource link and every claim in its `why`. Khan Academy pages only render in
  headless chromium (`chromium --headless=new --no-sandbox --dump-dom URL`); curl gets a bot challenge.
  YouTube titles, lengths, and chapter timestamps can be read from the watch page. Captions are
  blocked, so don't describe a video beyond its title, description, and timestamps.

## Performance

Run `npm run perf` after adding client JS, big page data, or new pages, and add heavy new pages to
`perf-budgets.json`. CI runs `npm run perf -- --check` on pull requests. To compare against main, set
`PERF_DIST=<main's dist>`. These traps once slowed every page:

- Anything a browser `<script>` imports ships to the client. Importing a module that also imports
  KaTeX once added 260 kB to every page, so keep build-only helpers like `src/lib/reference.ts` out
  of client imports.
- A lazy `import()` in a site-wide script pulled in a 228 kB chunk, so avoid dynamic imports there.
- A shared module imported by a script on every page becomes its own late-loading chunk, which cost
  about 100 ms per page on a phone. Keep site-wide scripts self-contained.

## Local environment (NixOS)

- Run node and npm through `direnv exec .`.
- Try T3's preview browser first. If it breaks, use the system `chromium` headless, or drive it over
  `--remote-debugging-port` from a Node script. Set every `img.loading = "eager"` before taking
  screenshots, because lesson figures are lazy-loaded.
- The dev server (`npx astro dev --port 4321 --host localhost`) doesn't survive a session restart.
  Check `npx astro dev status` before giving Connor a link, and use http://localhost:4321, not
  127.0.0.1.
