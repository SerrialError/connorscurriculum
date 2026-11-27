import { describe, expect, it } from 'vitest';
import { inTest } from '../class-status';
import { getSubjectData } from '../registry';
import { compareSections, drawExam, drawable, examFormat, examFrqs, examMax, examParts, examPointsNote, examPools, examQuestions, examShortfalls, mcqCount, scoreExam, sectionOf } from './exam';
import { seededRng } from './random';
import { readQuestionFiles } from './question-files';
import { frq, mcq } from './test-fixtures';
import type { PracticeExam, PracticeQuestion } from './types';

const exam: PracticeExam = {
  mcqPoints: 2.8,
  sections: [
    { id: 'light', label: 'Energy, wavelength, and frequency', count: 3, match: { chapters: [6], sections: ['6.1', '6.2'] }, maxCalculations: 1 },
    { id: 'configs', label: 'Electron configurations', count: 2, match: { chapters: [6], sections: ['6.8'] } },
    { id: 'trends', label: 'Periodic trends', count: 2, match: { chapters: [7], sections: [] } },
  ],
  extra: 1,
  frq: { count: 1, points: 7.2 },
};

/** `n` questions for a section: ids like light1, light2; the first `calcs` are calculations. */
const pool = (prefix: string, n: number, over: Partial<PracticeQuestion>, calcs = 0): PracticeQuestion[] =>
  Array.from({ length: n }, (_, i) => mcq(`${prefix}${i + 1}`, { ...over, ...(i < calcs ? { calculation: true } : {}) } as never));

const bank: PracticeQuestion[] = [
  ...pool('light', 8, { chapter: 6, sections: ['6.2'] }, 5),
  ...pool('config', 5, { chapter: 6, sections: ['6.8'] }),
  ...pool('trend', 6, { chapter: 7, sections: ['7.3'] }),
  { ...frq, id: 'frq1', chapter: 6 },
  { ...frq, id: 'frq2', chapter: 7 },
];

describe('sectionOf and examPools', () => {
  it('puts each multiple-choice question in the first section it fits', () => {
    expect(sectionOf(bank[0]!, exam)?.id).toBe('light');
    expect(sectionOf(mcq('x', { chapter: 7, sections: [] }), exam)?.id).toBe('trends');
    expect(sectionOf(mcq('y', { chapter: 6, sections: ['6.5'] }), exam)).toBeUndefined();
    expect(sectionOf(frq, exam)).toBeUndefined();
  });

  it('counts each section and its non-calculation questions', () => {
    expect(examPools(bank, exam).map((p) => [p.section.id, p.questions.length, p.concepts])).toEqual([
      ['light', 8, 3],
      ['configs', 5, 5],
      ['trends', 6, 6],
    ]);
  });
});

describe('drawExam', () => {
  const ids = (seed: string) => drawExam(bank, exam, seededRng(seed)).map((q) => q.id);

  it("follows the blueprint: each section's count, the extras, then the FRQs", () => {
    const drawn = drawExam(bank, exam, seededRng('abc'));
    expect(drawn).toHaveLength(mcqCount(exam) + 1);
    const bySection = (id: string) => drawn.filter((q) => sectionOf(q, exam)?.id === id).length;
    const counts = [bySection('light'), bySection('configs'), bySection('trends')];
    expect(counts.reduce((a, b) => a + b)).toBe(8);
    expect(counts.map((n, i) => n - exam.sections[i]!.count).sort()).toEqual([0, 0, 1]);
    expect(drawn.at(-1)!.type).toBe('frq');
  });

  it('never draws more calculations than a section allows, even with the extras', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      expect(drawExam(bank, exam, seededRng(seed)).filter((q) => q.calculation).length).toBeLessThanOrEqual(1);
    }
  });

  it('draws at least a section\'s minCalculations, and no more than its maxCalculations', () => {
    const ranged: PracticeExam = { ...exam, extra: 0, sections: [{ ...exam.sections[0]!, minCalculations: 2, maxCalculations: 2 }, ...exam.sections.slice(1)] };
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      expect(drawExam(bank, ranged, seededRng(seed)).filter((q) => q.calculation)).toHaveLength(2);
    }
  });

  it('keeps the multiple choice in exam-section order, and by textbook section within one', () => {
    for (const seed of ['xyz', 'q1', 'q2']) {
      const drawn = drawExam(bank, exam, seededRng(seed)).filter((q) => q.type === 'mcq');
      const sectionIndex = drawn.map((q) => exam.sections.indexOf(sectionOf(q, exam)!));
      expect([...sectionIndex].sort((a, b) => a - b)).toEqual(sectionIndex);
      for (let i = 1; i < drawn.length; i++) {
        if (sectionIndex[i] === sectionIndex[i - 1]) {
          expect(compareSections(drawn[i - 1]!.sections[0], drawn[i]!.sections[0])).toBeLessThanOrEqual(0);
        }
      }
    }
  });

  it('draws the same exam for the same seed and a different one for another', () => {
    expect(ids('k3x9a0')).toEqual(ids('k3x9a0'));
    expect(['s1', 's2', 's3', 's4'].map(ids).some((x) => x.join() !== ids('k3x9a0').join())).toBe(true);
  });
});

describe('compareSections', () => {
  it('orders section ids numerically and puts missing ones last', () => {
    expect(['6.10', '6.9', undefined, '6.2'].sort(compareSections)).toEqual(['6.2', '6.9', '6.10', undefined]);
  });
});

describe('examShortfalls', () => {
  it('is empty when the questions can fill the exam', () => {
    expect(examShortfalls(bank, exam)).toEqual([]);
  });

  it('says which section is short, of questions or of non-calculations, and of FRQs', () => {
    const thin = bank.filter((q) => !['light6', 'light7', 'light8', 'config3', 'config4', 'config5', 'frq1', 'frq2'].includes(q.id));
    expect(examShortfalls(thin, exam)).toEqual([
      'section "light" allows 1 calculation, so it needs 2 other questions, but only 0 aren\'t calculations',
      'needs 1 free-response question but only 0 match',
    ]);
    expect(examShortfalls(bank.slice(0, 3), { ...exam, extra: 1 })).toContain('section "configs" needs 2 multiple-choice questions but only 0 match (counting each group once)');
    const needsCalcs = { ...exam, sections: [exam.sections[0]!, { ...exam.sections[1]!, minCalculations: 1 }, exam.sections[2]!] };
    expect(examShortfalls(bank, needsCalcs)).toEqual(['section "configs" needs at least 1 calculation, but only 0 match']);
  });
});

describe('scoreExam', () => {
  const questions = [mcq('m1', { chapter: 7 }), mcq('m2', { chapter: 7 }), mcq('m3', { chapter: 6, sections: ['6.8'] }), { ...frq, id: 'f' }];

  it('scores multiple choice at mcqPoints each and scales the FRQ rubric to its points', () => {
    const s = scoreExam(questions, exam, { m1: true, m2: false, m3: true }, { f: { earned: 2, possible: 3 } });
    expect(s.mcq).toEqual({ correct: 2, count: 3, points: 5.6, max: 8.4 });
    expect(s.frq).toEqual({ earned: 2, possible: 3, points: 4.8, max: 7.2, marked: true });
    expect(s.points).toBe(10.4);
    expect(s.max).toBe(15.6);
    expect(s.sections.map((x) => [x.section.id, x.correct, x.count])).toEqual([
      ['light', 0, 0],
      ['configs', 1, 1],
      ['trends', 1, 2],
    ]);
  });

  it('counts an FRQ that has not been marked as 0 and says so', () => {
    const s = scoreExam(questions, exam, { m1: true }, {});
    expect(s.frq).toMatchObject({ points: 0, max: 7.2, marked: false });
    expect(s.points).toBe(2.8);
  });
});

describe('exam words', () => {
  it('gives the format and what is drawn', () => {
    expect(examMax(exam)).toBe(29.6);
    expect(examFormat(exam)).toBe('8 multiple choice and 1 free response, 29.6 points in all');
    expect(examParts(exam)).toEqual([
      '3 on energy, wavelength, and frequency (no more than 1 calculation)',
      '2 on electron configurations',
      '2 on periodic trends',
      '1 more from any of these',
      '1 free-response question',
    ]);
  });
});

describe('examPointsNote', () => {
  it('says point or points', () => {
    expect(examPointsNote(exam)).toBe('2.8 points per multiple-choice question; the free response is worth 7.2');
    expect(examPointsNote({ ...exam, mcqPoints: 1, frq: { count: 0, points: 0 } })).toBe('1 point per multiple-choice question');
  });
});

type Test = ReturnType<typeof getSubjectData>['tests'][number];

/** A test's questions from the question files, picked the way the site picks them (inTest). */
const testQuestions = (test: Test) =>
  readQuestionFiles()
    .filter((q) => q.subject === 'apchem' && inTest(test, { id: q.id, data: { chapter: q.chapter, sections: q.sections ?? [] } }))
    .map((q) => ({ ...q, sections: q.sections ?? [], groups: q.group ? [q.group].flat() : undefined }));

describe('apchem: the Chapters 4–5 practice exam', () => {
  const test = getSubjectData('apchem').tests.find((t) => t.id === 'ch4-5-test')!;

  it('is 37 multiple choice at 2.6 points and a 6-point FRQ, with more Chapter 4 than Chapter 5', () => {
    expect(mcqCount(test.exam!)).toBe(37);
    expect(examMax(test.exam!)).toBe(102.2);
    const perChapter = (c: number) => test.exam!.sections.filter((s) => s.match.chapters?.includes(c)).reduce((n, s) => n + s.count, 0);
    expect(perChapter(4)).toBeGreaterThan(perChapter(5));
  });

  it('has at least twice as many questions as each section draws, and twice the concept questions it needs', () => {
    const questions = testQuestions(test);
    for (const p of examPools(questions, test.exam!)) {
      expect(p.questions.length, p.section.id).toBeGreaterThanOrEqual(2 * p.section.count);
      expect(p.concepts, `${p.section.id} concept questions`).toBeGreaterThanOrEqual(2 * (p.section.count - (p.section.maxCalculations ?? p.section.count)));
    }
  });
});

describe('apchem: the Chapters 6–7 practice exam', () => {
  const test = getSubjectData('apchem').tests.find((t) => t.id === 'ch6-7-test')!;

  it('is 36 multiple choice at 2.8 points and a 7.2-point FRQ, 108 in all', () => {
    expect(mcqCount(test.exam!)).toBe(36);
    expect(examMax(test.exam!)).toBe(108);
  });

  // So that two practice exams don't keep repeating the same questions.
  it('has at least twice as many questions as each section draws, and twice the concept questions it needs', () => {
    const questions = testQuestions(test);
    for (const p of examPools(questions, test.exam!)) {
      expect(p.questions.length, p.section.id).toBeGreaterThanOrEqual(2 * p.section.count);
      expect(p.concepts, `${p.section.id} concept questions`).toBeGreaterThanOrEqual(2 * (p.section.count - (p.section.maxCalculations ?? p.section.count)));
    }
  });
});

describe('apchem: the Chapters 8–9 practice exam', () => {
  const test = getSubjectData('apchem').tests.find((t) => t.id === 'ch8-9-test')!;
  const questions = testQuestions(test);

  // The format the teacher announced: 36 questions at 3 points each, no free response.
  it('is 36 multiple choice at 3 points each with no FRQ, 108 in all', () => {
    expect(mcqCount(test.exam!)).toBe(36);
    expect(test.exam!.mcqPoints).toBe(3);
    expect(test.exam!.frq.count).toBe(0);
    expect(test.exam!.tentative).toBeFalsy();
    expect(examMax(test.exam!)).toBe(108);
  });

  // The teacher confirmed no molecular orbitals (9.7–9.8) on this test.
  it('leaves out molecular orbitals', () => {
    expect(test.sections).not.toContain('9.7');
    expect(test.sections).not.toContain('9.8');
    for (let i = 0; i < 50; i++) {
      const drawn = drawExam(questions, test.exam!, seededRng(`seed${i}`));
      expect(drawn).toHaveLength(36);
      expect(drawn.flatMap((q) => q.sections).filter((s) => s === '9.7' || s === '9.8')).toEqual([]);
    }
  });

  // Lattice energy is on the AP exam but not the class test; its questions are excluded by id.
  it('leaves out lattice energy, and excludes only questions that exist', () => {
    const ids = new Set(readQuestionFiles().map((q) => q.id));
    expect(test.exclude.filter((id) => !ids.has(id))).toEqual([]);
    const asked = (q: (typeof questions)[number]) =>
      [q.prompt, ...(q.choices ?? []).map((c) => c.text), ...(q.parts ?? []).map((p) => p.prompt)].join(' ');
    expect(questions.filter((q) => /lattice energ|born.haber/i.test(asked(q))).map((q) => q.id)).toEqual([]);
  });

  // So that two practice exams don't keep repeating the same questions.
  it('has at least twice as many questions as each section draws, and twice the concept questions it needs', () => {
    expect(examShortfalls(questions, test.exam!)).toEqual([]);
    for (const p of examPools(questions, test.exam!)) {
      expect(drawable(p.questions), p.section.id).toBeGreaterThanOrEqual(2 * p.section.count);
      expect(p.concepts, `${p.section.id} concept questions`).toBeGreaterThanOrEqual(2 * (p.section.count - (p.section.maxCalculations ?? p.section.count)));
    }
  });
});

describe('apchem: the Chapters 1–3 practice exam', () => {
  const test = getSubjectData('apchem').tests.find((t) => t.id === 'ch1-3-test')!;
  const questions = testQuestions(test);

  it('is 45 multiple choice with no free response, about 20 of them calculations', () => {
    expect(mcqCount(test.exam!)).toBe(45);
    expect(test.exam!.frq.count).toBe(0);
    expect(test.exam!.sections.reduce((n, s) => n + (s.minCalculations ?? 0), 0)).toBe(16);
  });

  // So that two practice exams don't keep repeating the same questions.
  it('has at least twice the questions, concept questions, and calculations each section needs', () => {
    expect(examShortfalls(questions, test.exam!)).toEqual([]);
    for (const p of examPools(questions, test.exam!)) {
      const s = p.section;
      expect(p.questions.length, s.id).toBeGreaterThanOrEqual(2 * s.count);
      expect(p.concepts, `${s.id} concept questions`).toBeGreaterThanOrEqual(2 * (s.count - (s.maxCalculations ?? s.count)));
      expect(p.questions.length - p.concepts, `${s.id} calculations`).toBeGreaterThanOrEqual(2 * (s.minCalculations ?? 0));
    }
  });

  it('always draws 16 to 22 calculations, including stoichiometry and empirical formulas', () => {
    for (let i = 0; i < 100; i++) {
      const drawn = drawExam(questions, test.exam!, seededRng(`seed${i}`));
      expect(drawn).toHaveLength(45);
      const calcs = drawn.filter((q) => q.calculation);
      expect(calcs.length).toBeGreaterThanOrEqual(16);
      expect(calcs.length).toBeLessThanOrEqual(22);
      expect(calcs.some((q) => q.sections.includes('3.5'))).toBe(true);
      expect(calcs.some((q) => q.sections.includes('3.7'))).toBe(true);
    }
  });
});

describe('apchem: the Chapters 8–9 practice quiz', () => {
  const quiz = getSubjectData('apchem').tests.find((t) => t.id === 'ch8-9-quiz')!;
  const inQuiz = testQuestions(quiz);

  it('is a quiz, not a class test: 16 multiple choice at 2 points and an 8-point FRQ', () => {
    expect(quiz.kind).toBe('quiz');
    expect(mcqCount(quiz.exam!)).toBe(16);
    expect(examMax(quiz.exam!)).toBe(40);
  });

  it('draws only medium and hard questions, with at least twice what each section needs', () => {
    const pool = examQuestions(inQuiz, quiz.exam!);
    expect(pool.every((q) => q.difficulty >= 2)).toBe(true);
    expect(examShortfalls(inQuiz, quiz.exam!)).toEqual([]);
    // Counting related questions (a group) once, so quizzes don't keep repeating the same ones.
    for (const p of examPools(pool, quiz.exam!)) expect(drawable(p.questions), p.section.id).toBeGreaterThanOrEqual(2 * p.section.count);
    expect(examFrqs(pool).length).toBeGreaterThanOrEqual(3);
  });
});

describe('drawing the Chapters 8–9 quiz', () => {
  const quiz = getSubjectData('apchem').tests.find((t) => t.id === 'ch8-9-quiz')!;
  const inQuiz = testQuestions(quiz);

  it('never draws two questions from one group, an excluded question, or a calculation FRQ', () => {
    for (let i = 0; i < 200; i++) {
      const drawn = drawExam(inQuiz, quiz.exam!, seededRng(`seed${i}`));
      expect(drawn.filter((q) => q.type === 'mcq')).toHaveLength(16);
      const frqs = drawn.filter((q) => q.type === 'frq');
      expect(frqs).toHaveLength(1);
      expect(frqs[0]!.calculation).toBeFalsy();
      const groups = drawn.flatMap((q) => q.groups ?? []);
      expect(new Set(groups).size, groups.join(', ')).toBe(groups.length);
      for (const q of drawn) {
        expect(quiz.exclude).not.toContain(q.id);
        expect(q.difficulty).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
