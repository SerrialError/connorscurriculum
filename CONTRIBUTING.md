# Contributing

Thanks for helping. Everything on the site is generated from plain files in this repo, so adding a
lesson, your notes, or a question doesn't take any code. If something is tagged wrong (an unknown
topic, a chapter that doesn't exist, a missing author), the build stops and names the file and
field.

You can help in a few ways:

- **Share your notes or write a lesson** in the [browser editor](#using-the-editor-cms). It turns
  your work into a pull request, and Connor reviews it before it goes live.
- **Add practice questions** by editing a YAML file. Editing a file on GitHub works fine for this
  (see [Questions](#questions)).
- **Report a mistake**, like a wrong answer key, a typo in a formula, or a broken page, by
  [opening an issue](https://github.com/SerrialError/connorscurriculum/issues/new). Include a link
  to the page.

## Ground rules

- **Write it yourself.** Don't copy text, figures, or problems from the textbook, AP Classroom,
  or College Board exams. Explain ideas in your own words and make up your own numbers.
- **Check the chemistry.** Work every number in an example or explanation before you submit it.
- **Credit people.** Put your name in `authors`. If you're typing up someone else's notes, they're
  the author. Material whose creator you can't name doesn't go on the site.

## Using the editor (CMS)

The editor is at [connorscurriculum.com/admin/](https://connorscurriculum.com/admin/). The
**Share your notes or write a lesson** link at the bottom of every page leads here. It previews
your lesson with the math, chemistry, and boxes as the site will show them, and it flags anything
that would break the build, like an unclosed `<Callout>`, a stray `{`, or an unknown component. The
chapter and AP topic pickers list the real chapters and topics.

1. Make a free GitHub account if you don't have one.
2. Open the editor and click **Sign In with GitHub**. The first time you save, GitHub makes your
   own copy (a fork) of the repo. Your edits go there, so you can't break the live site.
3. Write the lesson and click **Save** as often as you like. Each lesson becomes a pull request.
4. When it's finished, set its status to **In Review**. Connor reviews it, and it goes live once
   it's merged.

Turning on `draft` keeps a lesson hidden even after it's merged.

To try the editor without signing in, run the site locally (`npm run dev`), open
http://localhost:4321/admin/ in Chrome, Edge, or another Chromium browser, click **Work with Local
Repository**, and pick the repo folder. Saving writes straight into `src/content/lessons/`.

## Working with the files

Fork the repo, then:

```sh
npm install
npm run dev     # http://localhost:4321, reloads as you edit
```

Before you open a pull request:

```sh
npm run check   # type check and unit tests
npm run build   # validates every tag and builds the site
```

The same checks run on every pull request.

## Tags

Every lesson and question has both kinds of tag:

| Field | Meaning | Example |
|---|---|---|
| `subject` | Subject id from `src/data/subjects.json` | `apchem` |
| `chapter` | Textbook chapter number from `src/data/<subject>/chapters.json` | `14` |
| `sections` | Optional textbook sections. Checked once that chapter's section list is filled in. | `["14.3"]` |
| `cedTopics` | AP CED topic ids from `src/data/<subject>/ced.json`. **Required**; `[]` means "class only, not on the AP exam". | `["5.2", "5.3"]` |
| `authors` | At least one name | `["Jordan"]` |
| `sample` | Optional. `true` only for content written to show the format (see [Sample content](#sample-content)). | `true` |

**AP or class only?** Tag `cedTopics` only when the content is something the AP exam assesses.
The CED's exclusion statements decide this. For example, assigning quantum numbers, hybrid orbitals
with d orbitals, and molecular orbital diagrams are excluded, so questions on them get
`cedTopics: []`. Students see every question marked "AP exam" or "Class only" and can filter by it.
In a lesson, mark a class-only part with `<Callout type="not-on-ap">`.

## Lessons

One folder per lesson: `src/content/lessons/<subject>/<chapter>-<slug>/index.mdx`. Images go in
the same folder.

```mdx
---
title: Reaction Rates and Rate Laws
subject: apchem
chapter: 14
sections: ["14.1", "14.3"]
cedTopics: ["5.1", "5.2"]
kind: lesson        # lesson, notes (a classmate's notes), or review (a test review sheet)
order: 1            # position within the chapter (lower first)
authors: ["Jordan"]
summary: One sentence shown on cards and in search.
draft: false        # true hides it from the live site
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
```

`\ce{...}` (mhchem) works anywhere math works.

**Watch out for curly braces** `{ }` in ordinary text (outside `$...$`): MDX reads them as code.
Write `\{` or put the text inside math.

### Components

These work in every lesson without importing them:

| Component | What it shows |
|---|---|
| `<Callout type="note">` | A box: `note`, `warning`, `ap-tip`, or `not-on-ap`. Optional `title`. |
| `<Reveal label="Show answer">` | Content hidden until clicked |
| `<YouTube id="wYqQCojggyM" start={30} />` | A video that plays on the page. Optional `start` (seconds), `title`, `minutes`. |
| `<Molecule id="sf4" />` | A 3D molecule you can rotate. Ids are in `src/lib/molecules.ts`. |
| `<ShapeExplorer />` | Pick electron domains and lone pairs to see each VSEPR shape in 3D |
| `<OrbitalViewer ids="ch4,nh3" boxes />` | Step-by-step 3D hybridization, σ and π bonds. Ids are in `src/lib/orbitals.ts`; `boxes` adds orbital box diagrams. |
| `<ShapeGrid />` | Cards for every molecular shape. `kind="domains"` groups them by electron domains. Its "Turn it in 3D" links need a `<ShapeExplorer />` on the same page. |
| `<HybridCards />` | One card per hybridization: what's mixed, the geometry, what's left for π bonds |

### Outside resources

`resources` in the frontmatter lists the best videos, simulations, practice sets, or readings for
the lesson. They're shown near the end of the page:

```yaml
resources:
  - kind: video                  # video, simulation, practice, or reading
    title: VSEPR Theory and Molecular Geometry (AP Chem 2.7B)
    url: https://www.youtube.com/watch?v=a8xDFQLYtYE
    by: Jeremy Krug
    minutes: 18
    why: Every shape you need for AP, including expanded octets from 8:57, then a summary table at 12:10.
```

`why` says what the resource does better than the lesson, in a sentence or two. Open every link
and check every claim in `why` (titles, lengths, timestamps) before adding it. A Khan Academy video
that's also on YouTube can add `youtube: <video id>` so it plays on the page.

### Notes pages

A classmate's notes use `kind: notes` with the classmate in `authors`. The page tells readers
these are a classmate's notes with the wording kept, so the file doesn't need to say so.

- Type the notes up as written. Fill in blank cells left by merged table cells so each row reads
  on its own.
- Mark a mistake with `<Callout type="warning">**Correction:** …</Callout>` right below the line it
  corrects, rather than changing the original.
- List the photos or PDFs the notes came from in `originals`, with the files in an `originals/`
  folder next to `index.mdx`. They're shown at the end of the page.

```yaml
originals:
  - { file: originals/page-1.jpg, caption: "8.1–8.4" }
  - { file: originals/notes.pdf }
```

Phone photos can carry your location. Strip their metadata and shrink them before committing, for
example with ImageMagick: `magick in.jpg -auto-orient -strip -resize "2000x2000>" -quality 80 out.jpg`.

### Where lessons show up

Every lesson is listed on the **Lessons** page (`/<subject>/lessons/`), grouped by chapter, and on
its chapter page. The class home lists the lessons and notes from the latest finished chapters. A
`kind: review` page is featured on its test's page.

Practice links each question to the `kind: lesson` pages in its chapter that share one of its
`sections` (or, failing that, an AP topic). Tag `sections` on lessons and questions alike so the
links are precise.

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
  sections: ["14.4"]
  cedTopics: ["5.3"]
  difficulty: 2            # 1 easy, 2 medium, 3 hard
  calculation: true        # optional: the question needs a numeric calculation
  authors: ["Jordan"]
  prompt: |
    Markdown with $math$ and \ce{...}.
  choices:                 # 2 to 5 choices, ids are single letters
    - { id: a, text: "33%" }
    - { id: b, text: "12.5%" }
    - { id: c, text: "25%" }
    - { id: d, text: "6.25%" }
  answer: b                # one of the choice ids
  # A choice can be a picture (a Lewis structure, say). Its text then becomes the image's alt
  # text: describe what's drawn, at about the same length as the other choices.
  #   - id: a
  #     text: "Cl bonded to three F atoms, with two lone pairs on Cl"
  #     image: ./images/ch8-9/clf3-two-pairs.svg
  # For a choice on two lines, end the first line with a backslash inside a |- block.
  explanation: |
    Why (B) is right, and why the others are wrong. Students see the choices
    labeled A, B, C, D, so refer to them as (A), (B), and so on.

- id: apchem-14-mechanism-frq
  type: frq
  subject: apchem
  chapter: 14
  cedTopics: ["5.7", "5.8"]
  difficulty: 3
  authors: ["Jordan"]
  group: n2o5-mechanism     # optional, see below
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

### Writing good questions

- **Don't let the answer give itself away.** A unit test fails if, across a chapter's
  multiple-choice questions, the correct choice is the longest one or one letter is the answer
  much more often than chance. Write wrong choices as long and specific as the right one, and
  spread answers over A–D. Stick to four choices: a lone five-choice question in a chapter fails the
  letter check whichever letter it uses.
- **Test understanding, not trivia.** If a student couldn't reason their way to the answer from
  what the class teaches, give them the facts in the prompt and ask for the reasoning.
- **Use the equation sheet.** Class tests come with the
  [AP equation sheet](https://apcentral.collegeboard.org/media/pdf/ap-chemistry-equations-sheet.pdf)
  and periodic table, so don't ask students to recall what's on them.
- **Rate difficulty honestly.** Hard questions are welcome; label them 3.
- **Set `calculation: true`** when the question needs numbers plugged into an equation. Practice
  exams limit how many of these they draw.
- **Use `group`** for questions about the same molecule or fact, where one gives away another's
  answer. A practice exam draws at most one question from each group. A question can list several:
  `group: [n2o5-mechanism, rate-law]`.

### YAML pitfalls

Text containing a colon followed by a space, or starting with `$`, `{`, `[`, or `*`, must be
quoted. Inside double quotes, backslashes must be doubled (`"$\\ce{H2O}$"`). Using `|` block text
for anything longer than a few words avoids both problems.

## Linking to practice

`/<subject>/practice/?chapter=7&difficulty=3` opens Practice with those filters picked. `section`,
`topic`, `unit`, `test`, `type=mcq|frq`, `mode=all|weak`, and `n=5|all` work the same way. The
default is 10 shuffled questions. Add `start=1` to start the set right away. While a set is open,
its address also has a `seed`, so the same link opens the same questions.

`/<subject>/lessons/?kind=notes&q=bohr` opens the Lessons page filtered to one kind (`lesson`,
`notes`, or `review`) and the typed words.

## Sample content

`sample: true` marks a page or question written only to show the format (it needs no `authors`).
Sample pages, and anything in a chapter the class hasn't reached yet, are labeled as not class
material, listed in a closed "Sample pages" section at the end of the Lessons page, and left off
the class home. Practice leaves their questions out unless the student picks their chapter.

## Course data

Chapters, AP topics, class tests and practice exams, class progress, and past FRQs are JSON files
under `src/data/`. See [docs/data.md](docs/data.md).
