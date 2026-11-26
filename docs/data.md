# Course data

The course structure lives in `src/data/`: one `subjects.json`, and a folder per subject with its
chapters, AP topics, tests, class progress, and past FRQs. Pages are generated from these files, so
updating them updates the site. The build stops on anything that doesn't fit, such as an unknown
topic id or a chapter in two lists, and says which file and field is wrong.

For lessons and questions, see [CONTRIBUTING.md](../CONTRIBUTING.md).

| File | What it holds |
|---|---|
| `subjects.json` | Every class: `id`, `name`, `textbook`, and for an AP class `standardsUrl` (the CED PDF) |
| `<subject>/chapters.json` | Textbook chapters, their sections, the CED topics each one teaches, and "not on AP" notes |
| `<subject>/ced.json` | AP units, topics, exam weights, and science practices |
| `<subject>/progress.json` | Chapters the class has finished or is on now, topics it skipped, last year's course |
| `<subject>/tests.json` | Class tests, their handouts, and practice-exam formats |
| `<subject>/textbook-gaps.json` | AP topics the textbook covers thinly, and what to learn elsewhere |
| `<subject>/past-frqs.json` | Released AP FRQs (links only), each part tagged by CED topic and skill |

## Class progress

When the class finishes a chapter, add its number to `chapters` in `progress.json`. List the
chapters the class is on now in `current` (optional; a chapter can't be in both):

```json
{ "chapters": [1, 2, 3, 4, 5, 6, 7], "current": [8, 9] }
```

`current` chapters show as "Now in class" on the class home and chapters page. Without `current`,
the first unfinished chapter after the last finished one shows as "Up next". Chapters the class
hasn't reached are left off the home page, and their questions are left out of practice unless a
student picks that chapter.

The AP topic marks follow on their own, because each chapter in `chapters.json` lists the CED
topics it teaches:

```json
{ "number": 6, "title": "Electronic Structure of Atoms", "cedTopics": ["1.5", "1.6", "3.11", "3.12"] }
```

A topic gets a ✓ once every chapter that lists it is finished, and a ◐ (with a note such as
"Started in Ch. 2; continues in Ch. 6.") when only some are.

**Last year's course.** Topics seen in an earlier course go in an optional `lastYear` block:

```json
"lastYear": {
  "course": "Scholars Chemistry",
  "covered": ["3.4", "8.2"],
  "partial": ["3.5"],
  "notes": { "3.5": "kinetic molecular theory, but not Maxwell-Boltzmann distributions." }
}
```

`covered` topics get a ↺ ("seen last year") and `partial` ones a ◐, with the note shown as "Partly
covered in Scholars Chemistry: …". A ✓ replaces either once the topic is finished this year.

**Topics the class skipped.** If the class finished a chapter but skipped one of its AP topics,
list it in `notCovered` with a short note. It then shows "! Skipped in class" instead of a ✓:

```json
"notCovered": { "1.6": "the class skipped photoelectron spectroscopy in Ch. 6–7, so learn it on your own." }
```

The build fails if the topic doesn't exist or none of its chapters is finished yet.

**A mark looks wrong?** Fix the mapping in `chapters.json`, not `progress.json`. For example, if
half-reactions are taught in Ch. 4, remove `"4.9"` from Chapter 20's `cedTopics`. Every CED topic
must be listed by at least one chapter (a unit test checks this), and a chapter's AP unit badges
come from the same list.

## Class tests

Add an entry to `tests.json`:

```json
{ "id": "ch15-test", "title": "Chapter 15 Test", "date": "2026-12-03", "chapters": [15], "sections": [] }
```

Empty `sections` means the whole chapters, and `date` is optional. A `kind: review` lesson in one of
the test's chapters is featured on the test page and the class home.

`exclude` (optional) lists question ids in the test's chapters and sections that the test doesn't
cover, such as AP-only material the teacher left out. They're left out of the test page, the "Class
test" practice filter, and the practice exam. The Chapters 8–9 test excludes its lattice-energy
questions this way, and a unit test fails if one of the remaining questions asks about lattice energy.

`handouts` (optional) lists what students get with the test, such as an equation sheet:

```json
"handouts": [{ "title": "AP Chemistry equation sheet", "url": "https://apcentral.collegeboard.org/media/pdf/ap-chemistry-equations-sheet.pdf" }]
```

`exam` (optional) describes the test's format, so students can take a practice exam drawn fresh
from the question bank. The test page, the class home, and Practice then offer "Take a practice
exam":

```json
"exam": {
  "mcqPoints": 2.8,
  "sections": [
    { "id": "light", "label": "Energy, wavelength, and frequency", "count": 8,
      "match": { "chapters": [6], "sections": ["6.1", "6.2", "6.3", "6.4"] }, "maxCalculations": 3 },
    { "id": "trends", "label": "Periodic trends", "count": 14, "match": { "chapters": [7] } }
  ],
  "extra": 1,
  "frq": { "count": 1, "points": 7.2 }
}
```

- Each section draws `count` multiple-choice questions that `match`: from one of `chapters`, and if
  `sections` is given, tagged with one of those sections. A question counts toward the first
  section it matches.
- `maxCalculations` caps how many of a section's questions can have `calculation: true`, and
  `minCalculations` sets how many must, so a test with "about 20 math questions" can be drawn that
  way. The Chapters 1–3 test uses both.
- `extra` adds that many more multiple-choice questions from any section.
- `frq.count` free-response questions come from the test's chapters, self-scored and scaled to
  `frq.points`.
- Questions sharing a `group` are never drawn together.

The build stops if a section has fewer matching questions than it draws. For a real test, aim for
at least twice as many, so that two practice exams don't repeat each other. A unit test checks this
for each class test that has an exam.

## Textbook sections

`sections` in `chapters.json` starts empty. Filling it in turns on section checking for that
chapter's lessons and questions:

```json
"sections": [{ "id": "14.1", "title": "Factors That Affect Reaction Rates" }]
```

Copy section numbers and titles from the book itself, not from memory or another edition.
Chapters 1–10 have lists so far. Chapters 1–3 were copied from the 15th edition's table of
contents in Pearson's preview (ISBN 9780137493609). Chapters 4–5 were copied from the table of
contents in the preview of the 15th edition in SI Units (Global Edition, ISBN 9781292407623), whose
Chapter 3 numbering matches the US edition. Chapter 10 was copied from Pearson's table-of-contents PDF
for the 15th edition in SI Units, Expanded Edition (ISBN 9781292408767,
https://pearson.com/en-au/media/vwnd02wq/9781292408767-toc.pdf), whose Chapter 9 list matches the one
here exactly. Check their titles against the US edition when a copy is available.

## Topics the textbook covers thinly

`textbook-gaps.json` (optional) lists AP topics the textbook teaches only briefly (`"thin"`) or not
at all (`"missing"`), and what students should learn elsewhere:

```json
{
  "topics": [
    { "id": "3.13", "coverage": "thin", "book": "A short treatment in Ch. 14.", "learn": "A = εbc and calibration curves." }
  ],
  "other": [
    { "title": "Lab skills", "coverage": "thin", "book": "…", "learn": "…" }
  ]
}
```

These show on the AP topics page, on each listed topic's page, and next to the topic on chapter
pages.

## Past AP FRQs

`past-frqs.json` **links** to College Board's PDFs and never copies question text. Each part is
tagged with the CED topics it tests:

```json
{
  "number": 2,
  "title": "Ascorbic acid (vitamin C)",
  "page": 6,
  "samplesUrl": "https://apcentral.collegeboard.org/media/pdf/ap25-apc-chemistry-q2.pdf",
  "parts": [
    { "label": "A(i)", "points": 1, "cedTopics": ["1.1"], "skills": ["5.F"] },
    { "label": "B(iii)", "points": 1, "cedTopics": ["8.9"], "skills": ["5.F"] }
  ]
}
```

- `page` is where the question starts in the questions PDF, so the link opens on it.
- Take point values from the scoring guidelines. A unit test checks that each exam's questions add
  up to 10, 10, 10, 4, 4, 4, 4.
- `skills` are CED science-practice codes (listed in `ced.json` under `sciencePractices`). College
  Board publishes them in the scoring commentary or the Chief Reader Report, usually in the fall
  after the exam. Copy theirs and set the exam's `"skillsSource"` to `"official"`; until then, tag
  them yourself and use `"unofficial"`.
- Tag a part with every topic it needs, not every topic it mentions. These tags drive the "pts
  ready" badges and the FRQ lists on topic and practice pages.

When a new exam is released (usually in the summer), add it at the top of `exams`.

## Adding a subject

1. Add an entry to `src/data/subjects.json`.
2. Create `src/data/<id>/chapters.json`. The other files are optional. Without a `ced.json`, pages
   don't mention AP topics, AP units, or "not on the AP exam".
3. Add content under `src/content/lessons/<id>/` and `src/content/questions/<id>/`.

No code changes are needed. The home page (`/`) lists every class with what it's on now, and each
class has its own home at `/<id>/`. A class gets a Tests, AP topics, or Past FRQs page only when it
has that data (`src/lib/features.ts`), and search inside a class finds only its pages.
`src/lib/features.test.ts` builds a site with a second, minimal class to keep it that way.

## Where the AP Chemistry data came from

**`ced.json`** was checked on 2026-10-08 against the *AP Chemistry Course and Exam Description,
Effective Fall 2024* ([PDF](https://apcentral.collegeboard.org/media/pdf/ap-chemistry-course-and-exam-description.pdf),
file revised June 2026). Unit and topic titles come from the Course at a Glance, exam weights from
the exam weighting table, and the six science practices and 28 skills from the Science Practices
table (pp. 12–13). `"verified"` is still `false`, so the AP topics page says the list hasn't been
checked; set it to `true` once someone has confirmed it.

The current CED differs from the older (2020) topic list:

- Unit titles: Unit 2 is "Compound Structure and Properties", Unit 3 is "Properties of Substances
  and Mixtures", Unit 6 is "Thermochemistry", and Unit 9 is "Thermodynamics and Electrochemistry".
  (The exam weighting table calls Unit 7 "Principles of Equilibrium"; the Course at a Glance says
  "Equilibrium", which is used here.)
- Renamed topics: 1.2 Mass Spectra of Elements, 2.7 VSEPR and Hybridization, 3.1 Intermolecular and
  Interparticle Forces, 3.9 Separation of Solutions and Mixtures, 3.12 Properties of Photons,
  5.9 Pre-Equilibrium Approximation.
- Moved topics: "pH and Solubility" is now 8.11 (was 7.13), and "Free Energy of Dissolution" is now
  9.6 (was 7.14). That leaves Unit 7 with 12 topics and Units 8 and 9 with 11 each, 91 in total.

**`chapters.json`** chapter titles come from Pearson's listing for the 15th edition. Two differ from
older editions: Chapter 3 is "Chemical Reactions and Reaction Stoichiometry" and Chapter 17 is
"Aqueous Equilibria: Buffers, Titrations, and Solubility". The `notOnAP` notes follow the CED's
exclusion statements (for example phase diagrams, colligative properties, Arrhenius-equation
calculations, Kc/Kp conversion, and Lewis acid-base concepts).

**Chapter-to-topic mapping.** Each chapter lists the CED topics it teaches, from comparing each
topic's learning objectives with the chapter contents. Topics taught across several chapters are
listed under each: 1.5 (Ch. 2 and 6), 1.7 (Ch. 7, and Ch. 8 for electronegativity), 1.8 (Ch. 2, 7,
8), 3.7 (Ch. 4 and 13), 3.9 (Ch. 1 and 13), 4.8 (Ch. 4 and 16), and 4.9 (Ch. 4 and 20).
Beer–Lambert (3.13) is under Ch. 14, where the book uses absorbance to measure reaction rates.
Photoelectron spectroscopy (1.6) couldn't be placed with certainty in the 15th edition, so it's
under both Ch. 6 and 7. The class skipped it, so `progress.json` lists it under `notCovered`.

**`textbook-gaps.json`** lists 1.4, 1.6, 3.9, 3.11, 3.13, 4.4, 6.3, 9.4, 9.7, and lab skills.

**`progress.json`**'s `lastYear` block records what the class covered in Scholars Chemistry, from
the owner's answers on 2026-10-09: fully 3.4, 4.8, 8.1, 8.2, 9.1, 9.2, and 9.3, and partly 1.5,
3.5, 8.3, and 8.5.

**`past-frqs.json`** links the released FRQs for 2023–2026, the years AP Central currently hosts
(older URLs redirect to a general page). Each of the 169 parts was tagged on 2026-10-09 by reading
the questions and scoring guidelines against the CED, with point values from the scoring
guidelines. Sample responses exist for 2023–2025, and the posted 2026 exam is Version J for
questions 2, 3, and 6. The topic tags are judgment calls, so spot-check the ones you use.

The skills are College Board's own for 2023 and 2024 (scoring commentaries) and 2025 (Chief Reader
Report). The 2026 skills are our own, modeled on how earlier years label similar parts, and the site
shows them as "our labels". Replace them when the 2026 Chief Reader Report is published.
