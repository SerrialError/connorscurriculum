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
