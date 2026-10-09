import { describe, expect, it } from 'vitest';
import { getSubjectData } from './registry';
import { type FrqLink, flattenFrqs, frqPractices, frqTotal, matchFrqs, readyPoints } from './frqs';

const frq = (year: number, number: number, parts: FrqLink['parts']): FrqLink => ({
  year,
  number,
  title: '',
  questionUrl: '',
  scoringUrl: '',
  officialSkills: true,
  parts,
});

describe('matchFrqs', () => {
  const frqs = [
    frq(2024, 1, [
      { label: 'a', points: 1, cedTopics: ['5.1'], skills: ['5.F'] },
      { label: 'b', points: 2, cedTopics: ['6.4'], skills: ['6.D', '5.F'] },
    ]),
    frq(2025, 2, [{ label: 'A', points: 1, cedTopics: ['5.1', '5.2'], skills: [] }]),
    frq(2023, 3, [{ label: 'a', points: 3, cedTopics: ['7.1'], skills: ['2.F'] }]),
  ];

  it('returns only matching parts, most points first, then newest', () => {
    const m = matchFrqs(frqs, new Set(['5.1', '6.4']));
    expect(m.map((x) => `${x.frq.year}:${x.parts.map((p) => p.label).join('')}:${x.points}`)).toEqual(['2024:ab:3', '2025:A:1']);
  });

  it('counts ready points only for parts whose topics are all learned', () => {
    const learned = new Set(['5.1', '6.4']);
    expect(readyPoints(frqs[0]!, (t) => learned.has(t))).toBe(3);
    expect(readyPoints(frqs[1]!, (t) => learned.has(t))).toBe(0);
  });
});

describe('frqPractices', () => {
  it('lists each science practice once, in order', () => {
    expect(
      frqPractices({
        parts: [
          { label: 'a', points: 1, cedTopics: [], skills: ['6.D', '5.F'] },
          { label: 'b', points: 1, cedTopics: [], skills: ['5.E'] },
        ],
      }),
    ).toEqual(['5', '6']);
  });
});

describe('apchem past-frqs.json', () => {
  const data = getSubjectData('apchem');
  const frqs = flattenFrqs(data.pastFrqs);

  it('has 7 questions per exam worth 10, 10, 10, 4, 4, 4, 4 points', () => {
    for (const exam of data.pastFrqs) {
      const totals = frqs.filter((f) => f.year === exam.year).map(frqTotal);
      expect(totals, `${exam.year}`).toEqual([10, 10, 10, 4, 4, 4, 4]);
    }
  });

  it('tags every part with at least one science-practice skill', () => {
    const untagged = frqs.flatMap((f) => f.parts.filter((p) => p.skills.length === 0).map((p) => `${f.year} Q${f.number} ${p.label}`));
    expect(untagged).toEqual([]);
    expect(data.skills.size).toBe(28);
  });

  it('jumps to the question page in the PDF', () => {
    expect(frqs.every((f) => /#page=\d+$/.test(f.questionUrl))).toBe(true);
  });
});
