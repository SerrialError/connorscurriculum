# Contributing content

Everything on the site is generated from plain files in this repo. You don't need to touch
any code to add a lesson or a question. If a tag is wrong (an unknown topic, a chapter that
doesn't exist, a missing author), `npm run build` stops and tells you which file and field.

## Ground rules

- Write it yourself. Do not copy text, figures, or problems from the textbook, AP Classroom,
  or past College Board exams. Paraphrase ideas in your own words and make up your own numbers.
- Check the chemistry. Work every number in a worked example or explanation before you commit it.
- Put your name in `authors`.

## Tags

Every lesson and question has both kinds of tag:

| Field | Meaning | Example |
|---|---|---|
| `subject` | Subject id from `src/data/subjects.json` | `apchem` |
| `chapter` | Textbook chapter number from `src/data/<subject>/chapters.json` | `14` |
| `sections` | Optional textbook sections. Checked only once that chapter's `sections` list is filled in. | `["14.3"]` |
| `cedTopics` | AP CED topic ids from `src/data/<subject>/ced.json`. **Required**, but `[]` means "class only, not on the AP exam". | `["5.2", "5.3"]` |
| `authors` | At least one name | `["Jordan"]` |

## Lessons

One folder per lesson: `src/content/lessons/<subject>/<chapter>-<slug>/index.mdx`.
Images go in the same folder.

```mdx
---
title: Reaction Rates and Rate Laws
subject: apchem
chapter: 14
sections: []
cedTopics: ["5.1", "5.2"]
order: 1            # position within the chapter (lower first)
authors: ["Jordan"]
summary: One sentence shown on cards and in search.
draft: false        # true hides it from the production build
---

Normal **Markdown** here.

Inline math: $k = 0.693 / t_{1/2}$. Display math:

$$
\ce{2H2 + O2 -> 2H2O}
$$

![Describe the image for screen readers](./my-graph.png)

<Callout type="note">Note, warning, ap-tip, or not-on-ap.</Callout>

<Reveal label="Show answer">
Worked solution, hidden until clicked.
</Reveal>

<YouTube id="wYqQCojggyM" start={30} />
```

`Callout`, `Reveal`, and `YouTube` are available in every lesson without importing them.
`\ce{...}` (mhchem) works anywhere math works.

Watch out for curly braces `{ }` in ordinary MDX text (outside `$...$`): MDX reads them as code.
Write `\{` or put the text inside math.

## Questions

One YAML file per chapter or topic, holding a list: `src/content/questions/<subject>/<chapter>-<slug>.yaml`.
Question images go next to the YAML file (for example in an `images/` folder) and are referenced
relative to it.

Every `id` must be unique across the whole site. Use `<subject>-<chapter>-<short-name>`.

```yaml
- id: apchem-14-half-life
  type: mcq
  subject: apchem
  chapter: 14
  cedTopics: ["5.3"]
  difficulty: 2            # 1 easy, 2 medium, 3 hard
  authors: ["Jordan"]
  prompt: |
    Markdown with $math$ and \ce{...}.
  choices:                 # 2 to 5 choices, ids are single letters
    - { id: a, text: "33%" }
    - { id: b, text: "12.5%" }
  answer: b                # must be one of the choice ids
  explanation: |
    Why b is right, and why the others are wrong.

- id: apchem-14-mechanism-frq
  type: frq
  subject: apchem
  chapter: 14
  cedTopics: ["5.7", "5.8"]
  difficulty: 3
  authors: ["Jordan"]
  prompt: |
    Shared stem for all parts.
  image: ./images/profile.svg     # optional
  imageAlt: Describe the image.
  parts:
    - label: a
      points: 1
      prompt: What the part asks.
      scoring:                    # one statement per point
        - What earns the point.
  explanation: |
    Full worked answer.
```

In YAML, text containing a colon followed by a space, or starting with `$`, `{`, `[`, or `*`, must be quoted.
Inside double quotes, backslashes must be doubled (`"$\\ce{H2O}$"`). Using `|` block text avoids both problems.

## Past AP FRQs

Released exam questions live in `src/data/<subject>/past-frqs.json`. We **link** to College Board's
PDFs and never copy the question text. Each part is tagged with the CED topics it tests:

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

- `page` is where the question starts in the questions PDF, so the link opens at the right page.
- Take point values from the scoring guidelines. A unit test checks that each exam's questions add
  up to 10, 10, 10, 4, 4, 4, 4.
- `skills` are the CED science-practice skill codes (the six practices and their skills are listed
  in `ced.json` under `sciencePractices`). College Board states the skill for each part in the
  scoring commentary or the Chief Reader Report, which usually come out in the fall after the exam.
  Copy theirs when available, and set the exam's `"skillsSource"` to `"official"`; until then,
  tag them yourself and use `"unofficial"`.
- Tag a part with every topic it really needs, not every topic it mentions. These tags drive the
  "pts ready" badges and the FRQ lists on topic and practice pages.

When a new exam is released (usually in the summer), add an entry at the top of `exams`.

## Class tests

Add an entry to `src/data/<subject>/tests.json`:

```json
{ "id": "ch15-test", "title": "Chapter 15 Test", "date": "2026-12-03", "chapters": [15], "sections": [] }
```

Empty `sections` means the whole chapters. `date` is optional.

## Class progress

When the class finishes a chapter, add its number to `src/data/<subject>/progress.json`:

```json
{ "chapters": [1, 2, 3, 4, 5, 6] }
```

That's all. The AP topics fill in by themselves, because each chapter in `chapters.json` lists
the CED topics it teaches:

```json
{ "number": 6, "title": "Electronic Structure of Atoms", "cedTopics": ["1.5", "1.6", "3.11", "3.12"] }
```

A topic gets a ✓ once **every** chapter that lists it is finished, and a ◐ (with a note such as
"Started in Ch. 2; continues in Ch. 6.") when only some are. The checkmarks are the same for everyone.

### Last year's course

Topics already seen in an earlier course go in an optional `lastYear` block in the same file:

```json
"lastYear": {
  "course": "Scholars Chemistry",
  "covered": ["3.4", "8.2"],
  "partial": ["3.5"],
  "notes": { "3.5": "kinetic molecular theory, but not Maxwell-Boltzmann distributions." }
}
```

`covered` topics get a ↺ ("seen last year"), and `partial` ones get a ◐. The note appears as
"Partly covered in Scholars Chemistry: …". Once a topic is finished this year, the ✓ replaces the
↺ or ◐. Anything with no mark at all is completely new.

If a topic's mark looks wrong, fix the mapping in `chapters.json` rather than `progress.json`.
For example, if your teacher covers half-reactions in Ch. 4, remove `"4.9"` from Chapter 20's
`cedTopics`. The chapter's AP unit badges come from the same list. Every CED topic must be listed
by at least one chapter (a unit test checks this).

## Textbook sections

`sections` in `src/data/<subject>/chapters.json` starts empty. To turn on section checking for a
chapter, fill it in:

```json
"sections": [{ "id": "14.1", "title": "Factors That Affect Reaction Rates" }]
```

## Adding a subject

1. Add an entry to `src/data/subjects.json`.
2. Create `src/data/<id>/ced.json`, `chapters.json`, and (optionally) `tests.json`.
3. Add content under `src/content/lessons/<id>/` and `src/content/questions/<id>/`.

No code changes are needed.

## Before you push

```sh
npm run check   # type check + unit tests
npm run build   # validates every tag and builds the site
```
