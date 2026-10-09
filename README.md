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
    apchem/chapters.json   textbook chapters, AP unit mapping, "not on AP" notes
    apchem/tests.json      class tests
  content/
    lessons/<subject>/<chapter>-<slug>/index.mdx
    questions/<subject>/<chapter>-<slug>.yaml
  components/              .astro components and Svelte islands (Practice, Checklist)
  lib/                     registry, validation, Markdown pipeline, practice logic (+ tests)
  pages/                   routes, all keyed by subject id
```

## Where the data came from

**`ced.json`** was checked on 2026-10-08 against the *AP Chemistry Course and Exam Description,
Effective Fall 2024* (AP Central PDF, file revised June 2026). Unit and topic titles come from the
Course at a Glance, and exam weights from the exam weighting table. `"verified"` is still `false`
so the checklist shows its notice until you've confirmed it yourself.

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
