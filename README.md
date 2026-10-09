# Study Site

A static study site for AP Chemistry, built so more subjects can be added later. Lessons and
practice questions are plain files tagged with both a textbook chapter and an AP CED topic, so the
same content can be studied in class order or in AP order.

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add lessons, questions, and tests.

## Running it

Requires Node 22.12 or newer (24 recommended). On NixOS, `nix-shell` provides it.

```sh
npm install
npm run dev       # dev server at http://localhost:4321 (search only works after a build)
npm run build     # astro build + Pagefind index, output in dist/
npm run preview   # serve dist/
npm run check     # astro check + vitest
```

To host under a sub-path (for example GitHub Pages at `/<repo>/`), build with
`BASE_PATH=/<repo>/ npm run build`. Set `SITE_URL` to the full site URL if you want canonical URLs.
The site name lives in `src/site.ts`.

## Layout

```
src/
  content.config.ts        collection schemas and loaders (validation happens here)
  data/
    subjects.json
    apchem/ced.json        AP CED units and topics
    apchem/chapters.json   textbook chapters, the CED topics each one teaches, "not on AP" notes
    apchem/tests.json      class tests
    apchem/progress.json   chapters the class has finished (topic checkmarks follow)
    apchem/past-frqs.json  released AP FRQs (links only), each part tagged by CED topic
  content/
    lessons/<subject>/<chapter>-<slug>/index.mdx
    questions/<subject>/<chapter>-<slug>.yaml
  components/              .astro components and the Practice Svelte island
  lib/                     registry, validation, Markdown pipeline, practice logic (+ tests)
  pages/                   routes, all keyed by subject id
```

## Where the data came from

**`ced.json`** was checked on 2026-10-08 against the *AP Chemistry Course and Exam Description,
Effective Fall 2024* (AP Central PDF, file revised June 2026). Unit and topic titles come from the
Course at a Glance, and exam weights from the exam weighting table. `"verified"` is still `false`,
so the AP topics page shows a notice until you have confirmed the list yourself.

The current CED differs from the older (2020) topic list in several places:

- Unit titles: Unit 2 is "Compound Structure and Properties", Unit 3 is "Properties of Substances
  and Mixtures", Unit 6 is "Thermochemistry", and Unit 9 is "Thermodynamics and Electrochemistry".
  (The exam weighting table calls Unit 7 "Principles of Equilibrium"; the Course at a Glance says
  "Equilibrium", which is used here.)
- Renamed topics: 1.2 Mass Spectra of Elements, 2.7 VSEPR and Hybridization, 3.1 Intermolecular and
  Interparticle Forces, 3.9 Separation of Solutions and Mixtures, 3.12 Properties of Photons,
  5.9 Pre-Equilibrium Approximation.
- Moved topics: "pH and Solubility" is now 8.11 (was 7.13), and "Free Energy of Dissolution" is now
  9.6 (was 7.14). That leaves Unit 7 with 12 topics, and Units 8 and 9 with 11 each, for 91 in total.

**`chapters.json`** chapter titles come from Pearson's listing for the 15th edition. Two differ from
older editions: Chapter 3 is "Chemical Reactions and Reaction Stoichiometry" and Chapter 17 is
"Aqueous Equilibria: Buffers, Titrations, and Solubility". The `notOnAP` notes are based on the
CED's exclusion statements (for example: phase diagrams, colligative properties, Arrhenius-equation
calculations, Kc/Kp conversion, Lewis acid-base concepts). Section lists are empty until someone
fills them in from the book.

**Chapter-to-topic mapping.** Each chapter in `chapters.json` lists the CED topics it teaches,
based on comparing each topic's learning objectives in the CED with the chapter contents. Topics
taught across several chapters are listed under each one, for example 1.5 (Ch. 2 and 6), 1.8
(Ch. 2, 7, 8), 3.9 (Ch. 1 and 13), 4.8 (Ch. 4 and 16), and 4.9 (Ch. 4 and 20). One placement could
not be confirmed for the 15th edition: photoelectron spectroscopy (1.6) is listed under both Ch. 6 and 7.
Beer–Lambert (3.13) is under Ch. 14, where the book uses absorbance to measure reaction rates.

**`progress.json`** lists finished chapters (1–5 as of 2026-10-09); topic checkmarks are derived
from the mapping above. Its `lastYear` block records what was covered in Scholars Chemistry,
based on the owner's answers on 2026-10-09: fully covered were 3.4, 4.8, 8.1, 8.2, 9.1, 9.2, and 9.3,
and partly covered were 1.5, 3.5, 8.3, and 8.5.

**`past-frqs.json`** links the released AP Chemistry FRQs for 2023–2026, which are the years AP
Central currently hosts; the older URLs now redirect to a general page. Each of the 169 parts was
tagged by reading the 2026-10 versions of the questions and scoring guidelines against the CED.
Point values were copied from the scoring guidelines. Sample-response PDFs exist for 2023–2025,
and the posted 2026 exam is Version J for questions 2, 3, and 6. The tags are judgment calls, so
spot-check the ones you use.
