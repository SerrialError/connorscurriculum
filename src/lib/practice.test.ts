import { describe, expect, it } from 'vitest';
import {
  type FrqQuestion,
  type McqQuestion,
  type PracticeQuestion,
  type PracticeTest,
  activeFilterCount,
  countWith,
  emptyFilters,
  filterTopics,
  filterQuestions,
  filtersToQuery,
  frqEarned,
  frqTotal,
  isCorrect,
  parseFilters,
  recordResult,
  retryWords,
  amendLastResult,
  seededRng,
  selectQuestions,
  sessionSize,
  summarize,
  topicAccuracy,
  topicBreakdown,
  wantsStart,
  chapterRange,
  describeScope,
  describeSet,
  weakHasNoHistory,
  CLASS_ONLY_UNIT,
  HISTORY_LIMIT,
  type PracticeLesson,
  lessonsFor,
  lessonsForMissed,
  mixedReview,
  isDefaultFilters,
  newSeed,
  parseSet,
  questionsForSet,
  rngFromSeed,
  setToQuery,
  setupQuery,
  filterChips,
  isCustomCount,
  questionScore,
  scoreStatus,
  topicQuery,
  weakTopics,
} from './practice';

const mcq = (id: string, over: Partial<McqQuestion> = {}): McqQuestion => ({
  id,
  type: 'mcq',
  chapter: 14,
  sections: [],
  cedTopics: ['5.1'],
  units: ['5'],
  difficulty: 1,
  promptHtml: '',
  promptText: '',
  explanationHtml: '',
  choices: [
    { id: 'a', html: 'A' },
    { id: 'b', html: 'B' },
  ],
  answer: 'b',
  ...over,
});

const frq: FrqQuestion = {
  id: 'f1',
  type: 'frq',
  chapter: 15,
  sections: ['15.2'],
  cedTopics: ['7.3'],
  units: ['7'],
  difficulty: 3,
  promptHtml: '',
  promptText: '',
  explanationHtml: '',
  parts: [
    { label: 'a', promptHtml: '', points: 2, scoringHtml: ['x', 'y'] },
    { label: 'b', promptHtml: '', points: 1, scoringHtml: ['z'] },
  ],
};

const questions: PracticeQuestion[] = [
  mcq('q1'),
  mcq('q2', { cedTopics: ['5.2'], difficulty: 2 }),
  mcq('q3', { chapter: 13, cedTopics: [], units: [] }),
  frq,
];

const tests: PracticeTest[] = [
  { id: 'ch14', title: 'Ch 14', chapters: [14], sections: [] },
  { id: 'ch15-part', title: 'Ch 15 part', chapters: [15], sections: ['15.1'] },
];

describe('URL filters', () => {
  it('round-trips through the query string', () => {
    const f = { ...emptyFilters(), chapters: [14, 15], test: 'ch14', topics: ['5.1', '5.2'], units: ['7'], difficulty: [1, 3], type: 'mcq' as const, mode: 'all' as const, n: 5 };
    const q = filtersToQuery(f);
    expect(q).toBe('?chapter=14,15&test=ch14&unit=7&topic=5.1,5.2&difficulty=1,3&type=mcq&mode=all&n=5');
    expect(parseFilters(q)).toEqual(f);
  });

  it('ignores junk values', () => {
    const f = parseFilters('?chapter=abc,14&difficulty=0,2,9&type=essay&mode=nope&n=-3');
    expect(f.chapters).toEqual([14]);
    expect(f.difficulty).toEqual([2]);
    expect(f.type).toBeNull();
    expect(f.mode).toBe('random');
    expect(f.n).toBe(10);
  });

  it('defaults to 10 shuffled questions, and order and count never depend on each other', () => {
    expect(emptyFilters()).toMatchObject({ mode: 'random', n: 10 });
    expect(parseFilters('')).toMatchObject({ mode: 'random', n: 10 });
    expect(parseFilters('?mode=all')).toMatchObject({ mode: 'all', n: 10 });
    expect(parseFilters('?n=all')).toMatchObject({ mode: 'random', n: null });
    expect(parseFilters('?mode=weak&n=-1')).toMatchObject({ mode: 'weak', n: 10 });
    expect(parseFilters('?n=5')).toMatchObject({ mode: 'random', n: 5 });
    expect(parseFilters('?n=9999').n).toBe(200);
  });

  it('writes order and count only when they differ from the defaults', () => {
    expect(filtersToQuery({ ...emptyFilters(), mode: 'random', n: 10 })).toBe('');
    expect(filtersToQuery({ ...emptyFilters(), mode: 'all', n: null })).toBe('?mode=all&n=all');
    expect(filtersToQuery({ ...emptyFilters(), n: 5 })).toBe('?n=5');
    for (const f of [
      { ...emptyFilters(), mode: 'random' as const, n: null },
      { ...emptyFilters(), mode: 'weak' as const, n: 25 },
      { ...emptyFilters(), mode: 'all' as const, n: 3 },
      { ...emptyFilters(), n: 3 },
    ]) {
      expect(parseFilters(filtersToQuery(f))).toEqual(f);
    }
  });

  it('keeps explicit older links (?mode=random&n=10) working', () => {
    const f = parseFilters('?test=ch6-7-test&mode=random&n=10');
    expect(f).toMatchObject({ test: 'ch6-7-test', mode: 'random', n: 10 });
    expect(filtersToQuery(f)).toBe('?test=ch6-7-test');
  });

  it('gives an empty query for default filters', () => {
    expect(filtersToQuery(emptyFilters())).toBe('');
    expect(isDefaultFilters(emptyFilters())).toBe(true);
    expect(isDefaultFilters({ ...emptyFilters(), mode: 'all' })).toBe(false);
    expect(isDefaultFilters({ ...emptyFilters(), n: null })).toBe(false);
    expect(isDefaultFilters({ ...emptyFilters(), chapters: [7] })).toBe(false);
  });
});

describe('wantsStart', () => {
  it('starts only when start is set to something truthy', () => {
    expect(wantsStart('?test=x&start=1')).toBe(true);
    expect(wantsStart('?start')).toBe(true);
    expect(wantsStart('?test=x')).toBe(false);
    expect(wantsStart('?start=0')).toBe(false);
  });

  it('is not a filter: it never ends up in the filter query', () => {
    expect(filtersToQuery(parseFilters('?test=x&mode=all&start=1&seed=abc&ids=q1'))).toBe('?test=x&mode=all');
  });
});

describe('a set in the URL', () => {
  it('is the setup screen without start=1', () => {
    expect(parseSet('?chapter=7&seed=abc')).toBeNull();
    expect(parseSet('')).toBeNull();
  });

  it('round-trips filters, seed, and ids', () => {
    const spec = { filters: { ...emptyFilters(), chapters: [7], difficulty: [3], mode: 'all' as const, n: 5 }, seed: 'k3x9a0', ids: null };
    const q = setToQuery(spec);
    expect(q).toBe('?chapter=7&difficulty=3&mode=all&n=5&start=1&seed=k3x9a0');
    expect(parseSet(q)).toEqual(spec);
    const picked = { filters: emptyFilters(), seed: 'abc123', ids: ['q2', 'q1'] };
    expect(setToQuery(picked)).toBe('?start=1&seed=abc123&ids=q2,q1');
    expect(parseSet(setToQuery(picked))).toEqual(picked);
  });

  it('accepts a link with no seed yet, and rejects junk seeds', () => {
    expect(parseSet('?chapter=7&start=1')).toEqual({ filters: { ...emptyFilters(), chapters: [7] }, seed: null, ids: null });
    expect(parseSet('?start=1&seed=<script>')?.seed).toBeNull();
  });

  it('returns to exactly the filters that made the set', () => {
    const f = { ...emptyFilters(), test: 'ch14', type: 'frq' as const, mode: 'all' as const, n: null };
    expect(setupQuery(setToQuery({ filters: f, seed: 'abc', ids: ['q1'] }))).toBe(filtersToQuery(f));
    expect(setupQuery('?chapter=7&start=1')).toBe('?chapter=7');
  });

  it('gives the same questions for the same seed, so a shared link opens the same set', () => {
    const many = Array.from({ length: 30 }, (_, i) => mcq(`m${i}`));
    const spec = { filters: { ...emptyFilters(), chapters: [14], n: 5 }, seed: 'abc123', ids: null };
    const a = questionsForSet(many, spec, tests, {}).map((q) => q.id);
    const b = questionsForSet(many, spec, tests, {}).map((q) => q.id);
    expect(a).toHaveLength(5);
    expect(b).toEqual(a);
    const other = questionsForSet(many, { ...spec, seed: 'zzz999' }, tests, {}).map((q) => q.id);
    expect(other).not.toEqual(a);
  });

  it('uses the exact ids when given, in order, skipping missing and repeated ones', () => {
    const spec = { filters: emptyFilters(), seed: 'abc', ids: ['f1', 'gone', 'q1', 'f1'] };
    expect(questionsForSet(questions, spec, tests, {}).map((q) => q.id)).toEqual(['f1', 'q1']);
  });

  it('keeps "in order" in order', () => {
    const spec = { filters: { ...emptyFilters(), mode: 'all' as const, n: null }, seed: 'abc', ids: null };
    expect(questionsForSet(questions, spec, tests, {}).map((q) => q.id)).toEqual(filterQuestions(questions, spec.filters, tests).map((q) => q.id));
  });

  it('makes short URL-safe seeds and a repeatable rng per seed', () => {
    expect(newSeed(seededRng(1))).toMatch(/^[a-z0-9]{6}$/);
    const r1 = rngFromSeed('abc');
    const r2 = rngFromSeed('abc');
    expect([r1(), r1()]).toEqual([r2(), r2()]);
    expect(rngFromSeed('abd')()).not.toBe(rngFromSeed('abc')());
  });
});

describe('filterQuestions', () => {
  const ids = (qs: PracticeQuestion[]) => qs.map((q) => q.id);

  it('filters by chapter', () => {
    expect(ids(filterQuestions(questions, { ...emptyFilters(), chapters: [14] }, tests))).toEqual(['q1', 'q2']);
  });

  it('filters by test chapters and sections', () => {
    expect(ids(filterQuestions(questions, { ...emptyFilters(), test: 'ch14' }, tests))).toEqual(['q1', 'q2']);
    expect(ids(filterQuestions(questions, { ...emptyFilters(), test: 'ch15-part' }, tests))).toEqual([]);
    expect(ids(filterQuestions(questions, { ...emptyFilters(), test: 'missing' }, tests))).toEqual([]);
  });

  it('treats units and topics as one OR group', () => {
    expect(ids(filterQuestions(questions, { ...emptyFilters(), topics: ['5.2'] }, tests))).toEqual(['q2']);
    expect(ids(filterQuestions(questions, { ...emptyFilters(), topics: ['5.2'], units: ['7'] }, tests))).toEqual(['q2', 'f1']);
  });

  it('selects class-only questions (no CED topic) with the class-only unit', () => {
    expect(ids(filterQuestions(questions, { ...emptyFilters(), units: [CLASS_ONLY_UNIT] }, tests))).toEqual(['q3']);
    expect(ids(filterQuestions(questions, { ...emptyFilters(), units: [CLASS_ONLY_UNIT, '7'] }, tests))).toEqual(['q3', 'f1']);
    // With the class-only entry, unit counts add up to the total.
    const total = ['5', '7', CLASS_ONLY_UNIT].reduce((n, u) => n + countWith(questions, emptyFilters(), tests, { units: [u] }), 0);
    expect(total).toBe(questions.length);
    expect(parseFilters('?unit=class').units).toEqual([CLASS_ONLY_UNIT]);
  });

  it('counts matches for a changed filter without changing the others', () => {
    const f = { ...emptyFilters(), difficulty: [1] };
    expect(countWith(questions, f, tests, { chapters: [14] })).toBe(1);
    expect(countWith(questions, f, tests, { chapters: [13] })).toBe(1);
    expect(countWith(questions, f, tests, { chapters: [15] })).toBe(0);
    expect(f.chapters).toEqual([]);
  });

  it('counts active filters, leaving out order and count', () => {
    expect(activeFilterCount({ ...emptyFilters(), mode: 'random', n: 5 })).toBe(0);
    expect(activeFilterCount({ ...emptyFilters(), chapters: [6, 7], test: 'x', type: 'mcq' })).toBe(4);
  });

  it('leaves out samples and later chapters unless their chapter is picked', () => {
    const qs = [mcq('a'), mcq('b', { chapter: 15, extra: true, difficulty: 2 })];
    const later: PracticeTest[] = [{ id: 't15', title: 'Ch. 15 Test', chapters: [15], sections: [] }];
    expect(ids(filterQuestions(qs, emptyFilters(), later))).toEqual(['a']);
    expect(ids(filterQuestions(qs, { ...emptyFilters(), topics: ['5.1'] }, later))).toEqual(['a']);
    expect(ids(filterQuestions(qs, { ...emptyFilters(), difficulty: [2] }, later))).toEqual([]);
    expect(ids(filterQuestions(qs, { ...emptyFilters(), chapters: [15] }, later))).toEqual(['b']);
    expect(ids(filterQuestions(qs, { ...emptyFilters(), chapters: [14, 15] }, later))).toEqual(['a', 'b']);
    expect(ids(filterQuestions(qs, { ...emptyFilters(), test: 't15' }, later))).toEqual(['b']);
    expect(countWith(qs, emptyFilters(), later, { chapters: [15] })).toBe(1);
  });

  it('filters by difficulty and type', () => {
    expect(ids(filterQuestions(questions, { ...emptyFilters(), difficulty: [2, 3] }, tests))).toEqual(['q2', 'f1']);
    expect(ids(filterQuestions(questions, { ...emptyFilters(), type: 'frq' }, tests))).toEqual(['f1']);
  });
});

describe('selection', () => {
  it('returns matching questions in order for mode "all", up to n', () => {
    expect(selectQuestions(questions, { mode: 'all', n: null }, {})).toEqual(questions);
    expect(selectQuestions(questions, { mode: 'all', n: 2 }, {}).map((q) => q.id)).toEqual(['q1', 'q2']);
  });

  it('shuffles every matching question when n is null', () => {
    expect(selectQuestions(questions, { mode: 'random', n: null }, {}, seededRng(3))).toHaveLength(questions.length);
  });

  it('reports the session size', () => {
    expect(sessionSize(40, { n: null })).toBe(40);
    expect(sessionSize(40, { n: 10 })).toBe(10);
    expect(sessionSize(4, { n: 10 })).toBe(4);
  });

  it('returns N random questions for mode "random"', () => {
    const picked = selectQuestions(questions, { mode: 'random', n: 2 }, {}, seededRng(1));
    expect(picked).toHaveLength(2);
    expect(new Set(picked.map((q) => q.id)).size).toBe(2);
  });

  it('prefers the weakest topics for mode "weak"', () => {
    let h = {};
    h = recordResult(h, 'q1', 1);
    h = recordResult(h, 'q2', 0);
    h = recordResult(h, 'f1', 0.4);
    const acc = topicAccuracy(questions, h);
    expect(acc.get('5.1')).toBe(1);
    expect(acc.get('5.2')).toBe(0);
    expect(acc.get('chapter-13')).toBeUndefined();
    // 5.2 (0) < 7.3 (0.4) < unseen chapter-13 (0.5) < 5.1 (1)
    const picked = selectQuestions(questions, { mode: 'weak', n: 4 }, h, seededRng(7));
    expect(picked.map((q) => q.id)).toEqual(['q2', 'f1', 'q3', 'q1']);
  });

  it('keeps only recent results', () => {
    let h = {};
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) h = recordResult(h, 'q1', i % 2);
    expect((h as Record<string, number[]>).q1).toHaveLength(HISTORY_LIMIT);
  });
});

describe('grading', () => {
  it('grades MCQ', () => {
    expect(isCorrect(mcq('x'), 'b')).toBe(true);
    expect(isCorrect(mcq('x'), 'a')).toBe(false);
  });

  it('totals FRQ self-marks', () => {
    expect(frqTotal(frq)).toBe(3);
    expect(frqEarned(frq, [[true, false], [true]])).toBe(2);
    expect(frqEarned(frq, [])).toBe(0);
  });

  it('summarizes a session', () => {
    expect(
      summarize([
        { type: 'mcq', correct: true },
        { type: 'mcq', correct: false },
        { type: 'frq', earned: 2, possible: 3 },
      ]),
    ).toEqual({ mcqCorrect: 1, mcqAnswered: 2, frqEarned: 2, frqPossible: 3, frqDone: 1 });
  });
});

describe('filterTopics', () => {
  const units = [{ id: '5', topics: [{ id: '5.1' }, { id: '5.2' }] }];
  const chapterTopics = { '14': ['5.1', '5.2', '3.13'], '15': ['7.1'] };

  it('is empty without topic, unit, chapter, or test filters', () => {
    expect(filterTopics({ ...emptyFilters(), difficulty: [1] }, units, chapterTopics, tests).size).toBe(0);
  });

  it('combines topics, units, chapters, and the test', () => {
    const f = { ...emptyFilters(), topics: ['9.1'], units: ['5'], chapters: [15], test: 'ch14' };
    expect([...filterTopics(f, units, chapterTopics, tests)].sort()).toEqual(['3.13', '5.1', '5.2', '7.1', '9.1']);
  });
});

describe('topicBreakdown', () => {
  it('scores each topic in a session, weakest first, skipping unanswered questions', () => {
    const b = topicBreakdown(questions, { q1: 1, q2: 0, f1: 0.5 });
    expect(b).toEqual([
      { key: '5.2', score: 0, count: 1 },
      { key: '7.3', score: 0.5, count: 1 },
      { key: '5.1', score: 1, count: 1 },
    ]);
    expect(topicBreakdown(questions, { q3: 0 })).toEqual([{ key: 'chapter-13', score: 0, count: 1 }]);
  });
});

describe('amendLastResult', () => {
  it('replaces the latest score instead of adding one', () => {
    expect(amendLastResult({ q: [1, 0.5] }, 'q', 1)).toEqual({ q: [1, 1] });
  });
  it('records a score when there is none yet', () => {
    expect(amendLastResult({}, 'q', 0.25)).toEqual({ q: [0.25] });
  });
});

describe('naming a set', () => {
  const tests: PracticeTest[] = [{ id: 'ch6-7-test', title: 'Chapters 6–7 Test', chapters: [6, 7], sections: [] }];
  it('names the test and how the set was picked', () => {
    expect(describeSet(parseFilters('?test=ch6-7-test&mode=random'), tests, 10, 116)).toBe('Chapters 6–7 Test · 10 random');
    expect(describeSet(parseFilters('?test=ch6-7-test&mode=weak'), tests, 10, 116)).toBe(
      'Chapters 6–7 Test · 10 on your weakest topics',
    );
    expect(describeSet(parseFilters('?test=ch6-7-test&mode=all&n=all'), tests, 116, 116)).toBe('Chapters 6–7 Test · all 116 in order');
  });
  it('lists the other filters, and says "All questions" when there are none', () => {
    expect(describeScope(parseFilters('?chapter=7,6&difficulty=3,1&type=mcq'), tests)).toBe('Ch. 6–7 · Easy, Hard · Multiple choice');
    expect(describeScope(parseFilters(`?unit=1,${CLASS_ONLY_UNIT}&topic=1.7`), tests)).toBe('Unit 1, Not on the AP exam · Topic 1.7');
    expect(describeSet(parseFilters('?mode=random&n=5'), tests, 3, 3)).toBe('All questions · all 3, shuffled');
  });
  it('names the default pool when later chapters are left out', () => {
    expect(describeScope(emptyFilters(), tests, 'Ch. 6–7')).toBe('Ch. 6–7');
    expect(describeScope(parseFilters('?difficulty=3'), tests, 'Ch. 6–7')).toBe('Ch. 6–7 · Hard');
    expect(describeScope(parseFilters('?chapter=7&difficulty=3'), tests, 'Ch. 6–7')).toBe('Ch. 7 · Hard');
    expect(describeScope(parseFilters('?test=ch6-7-test'), tests, 'Ch. 6–7')).toBe('Chapters 6–7 Test');
    expect(describeScope(parseFilters('?topic=3.12'), tests, 'Ch. 6–7')).toBe('Topic 3.12');
    expect(describeSet(parseFilters('?mode=weak'), tests, 10, 116, 'Ch. 6–7')).toBe('Ch. 6–7 · 10 on your weakest topics');
  });
  it('chapterRange', () => {
    expect(chapterRange([9, 8])).toBe('Ch. 8–9');
    expect(chapterRange([6, 8])).toBe('Ch. 6, 8');
    expect(chapterRange([7])).toBe('Ch. 7');
  });
  it('knows when "weakest topics" has no history to go on', () => {
    const qs = [mcq('a'), mcq('b', { cedTopics: ['5.2'] })];
    expect(weakHasNoHistory(qs, {})).toBe(true);
    expect(weakHasNoHistory(qs, { other: [1] })).toBe(true);
    expect(weakHasNoHistory(qs, { b: [0] })).toBe(false);
  });
});

describe('mixedReview', () => {
  const qs = [{ chapter: 6 }, { chapter: 6 }, { chapter: 7 }, { chapter: 14 }];
  it('draws only from taught chapters', () => {
    expect(mixedReview(qs, new Set([1, 6, 7, 8]))).toEqual({ query: '?chapter=6,7', chapters: [6, 7], count: 3 });
  });
  it('needs no chapter filter when every chapter with questions is taught', () => {
    expect(mixedReview(qs, new Set([6, 7, 14]))).toEqual({ query: '', chapters: [6, 7, 14], count: 4 });
  });
  it('is null when nothing with questions is taught', () => {
    expect(mixedReview(qs, new Set([1]))).toBeNull();
  });
});

describe('lessonsFor', () => {
  const lesson = (title: string, chapter: number, sections: string[], topics: string[]): PracticeLesson => ({
    title,
    href: `/${title}/`,
    chapter,
    sections,
    topics,
  });
  const light = lesson('light', 6, ['6.1', '6.2'], ['3.11', '3.12']);
  const bohr = lesson('bohr', 6, ['6.3'], ['3.12']);
  const qn = lesson('qn', 6, ['6.4', '6.5', '6.6', '6.7'], []);
  const config = lesson('config', 6, ['6.7', '6.8', '6.9'], ['1.5']);
  const zeff = lesson('zeff', 7, ['7.2'], ['1.7']);
  const all = [light, bohr, qn, config, zeff];

  it('prefers lessons sharing a textbook section, most shared first', () => {
    expect(lessonsFor({ chapter: 6, sections: ['6.3'], cedTopics: ['3.12'] }, all)).toEqual([bohr]);
    expect(lessonsFor({ chapter: 6, sections: ['6.7'], cedTopics: [] }, all)).toEqual([qn, config]);
    expect(lessonsFor({ chapter: 6, sections: ['6.8', '6.9', '6.5'], cedTopics: [] }, all)).toEqual([config, qn]);
  });
  it('falls back to a shared AP topic in the same chapter', () => {
    expect(lessonsFor({ chapter: 6, sections: [], cedTopics: ['1.5'] }, all)).toEqual([config]);
    expect(lessonsFor({ chapter: 7, sections: [], cedTopics: ['3.12'] }, all)).toEqual([]);
  });
  it('caps the list', () => {
    expect(lessonsFor({ chapter: 6, sections: [], cedTopics: ['3.12'] }, all, 1)).toEqual([light]);
  });
  it('collects lessons for missed questions, most missed first, and chapters with no match', () => {
    const missed = [
      { chapter: 6, sections: ['6.3'], cedTopics: ['3.12'] },
      { chapter: 6, sections: ['6.2'], cedTopics: ['3.12'] },
      { chapter: 6, sections: ['6.3'], cedTopics: ['3.12'] },
      { chapter: 7, sections: ['7.5'], cedTopics: ['1.8'] },
    ];
    expect(lessonsForMissed(missed, all)).toEqual({
      lessons: [
        { lesson: bohr, missed: 2 },
        { lesson: light, missed: 1 },
      ],
      chapters: [7],
    });
  });
});

describe('retryWords', () => {
  it('says "missed" when every question scored zero', () => {
    expect(retryWords([0, 0, 0])).toEqual({ button: 'Retry the 3 I missed', set: 'retrying the 3 you missed' });
  });
  it('says "without full marks" when any got partial credit', () => {
    expect(retryWords([0.5, 0.25, 0.8]).button).toBe('Retry the 3 without full marks');
    expect(retryWords([0, 0.5]).set).toBe('retrying the 2 without full marks');
  });
});

describe('setup helpers', () => {
  it('treats only counts without their own chip as "Other"', () => {
    expect(isCustomCount(null)).toBe(false);
    expect(isCustomCount(10)).toBe(false);
    expect(isCustomCount(7)).toBe(true);
  });

  it('lists the narrowing filters as chips, each removing only itself', () => {
    const f = { ...emptyFilters(), chapters: [7, 14], test: 'ch14', difficulty: [3], type: 'frq' as const, mode: 'all' as const };
    const chips = filterChips(f, tests, [14]);
    expect(chips.map((c) => [c.label, c.more])).toEqual([
      ['Ch. 7', false],
      ['Ch. 14', true],
      ['Ch 14', true],
      ['Hard', false],
      ['Free response', true],
    ]);
    expect(chips[0]!.without).toEqual({ ...f, chapters: [14] });
    expect(chips[4]!.without).toEqual({ ...f, type: null });
    expect(filterChips(emptyFilters(), tests, [])).toEqual([]);
  });

  it('links a topic to its practice filters', () => {
    expect(topicQuery('1.7')).toBe('?topic=1.7');
  });

  it('lists weak topics, weakest first, leaving out strong and class-only ones', () => {
    const qs = [mcq('a', { cedTopics: ['1.1'] }), mcq('b', { cedTopics: ['1.2'] }), mcq('c', { cedTopics: ['1.3'] }), mcq('d', { cedTopics: [] })];
    const history = { a: [0, 1], b: [0], c: [1], d: [0] };
    expect(weakTopics(qs, history)).toEqual([
      ['1.2', 0],
      ['1.1', 0.5],
    ]);
    expect(weakTopics(qs, history, 1)).toHaveLength(1);
  });
});

describe('scores', () => {
  const none = { picks: {}, checked: {}, marks: {}, finished: {} };
  it('scores a checked MCQ 1 or 0, and nothing before Check', () => {
    const q = mcq('m');
    expect(questionScore(q, { ...none, picks: { m: 'b' } })).toBeUndefined();
    expect(questionScore(q, { ...none, picks: { m: 'b' }, checked: { m: true } })).toBe(1);
    expect(questionScore(q, { ...none, picks: { m: 'a' }, checked: { m: true } })).toBe(0);
  });

  it('scores an FRQ by points earned once marking is done', () => {
    const marks = { f1: [[true, false], [true]] };
    expect(questionScore(frq, { ...none, marks })).toBeUndefined();
    expect(questionScore(frq, { ...none, marks, finished: { f1: true } })).toBeCloseTo(2 / 3);
  });

  it('turns a score into a status', () => {
    expect([undefined, 1, 0, 0.5].map(scoreStatus)).toEqual(['todo', 'right', 'wrong', 'partial']);
  });
});
