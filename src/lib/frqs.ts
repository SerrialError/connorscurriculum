// Past AP free-response questions: flattening, matching parts to topics, and readiness.
// Plain TypeScript (no Astro imports) so the practice island and tests can use it.

export interface FrqPart {
  label: string;
  points: number;
  cedTopics: string[];
  /** Science-practice skill codes, e.g. "5.F". The practice is the part before the dot. */
  skills: string[];
}

export interface FrqLink {
  year: number;
  number: number;
  title: string;
  /** Questions PDF, jumping to the question's page when known. */
  questionUrl: string;
  scoringUrl: string;
  samplesUrl?: string;
  /** False when the skill tags are ours rather than College Board's. */
  officialSkills: boolean;
  parts: FrqPart[];
}

interface ExamInput {
  year: number;
  questionsUrl: string;
  scoringUrl: string;
  skillsSource?: 'official' | 'unofficial';
  questions: { number: number; title: string; page?: number; samplesUrl?: string; parts: FrqPart[] }[];
}

export function flattenFrqs(exams: ExamInput[]): FrqLink[] {
  return exams.flatMap((exam) =>
    exam.questions.map((q) => ({
      year: exam.year,
      number: q.number,
      title: q.title,
      questionUrl: q.page ? `${exam.questionsUrl}#page=${q.page}` : exam.questionsUrl,
      scoringUrl: exam.scoringUrl,
      ...(q.samplesUrl ? { samplesUrl: q.samplesUrl } : {}),
      officialSkills: exam.skillsSource === 'official',
      parts: q.parts,
    })),
  );
}

export interface FrqMatch {
  frq: FrqLink;
  /** Parts tagged with at least one of the requested topics. */
  parts: FrqPart[];
  points: number;
}

/** Questions with at least one part on the given topics, most matching points first, then newest. */
export function matchFrqs(frqs: FrqLink[], topics: ReadonlySet<string>): FrqMatch[] {
  return frqs
    .map((frq) => {
      const parts = frq.parts.filter((p) => p.cedTopics.some((t) => topics.has(t)));
      return { frq, parts, points: parts.reduce((sum, p) => sum + p.points, 0) };
    })
    .filter((m) => m.parts.length > 0)
    .sort((a, b) => b.points - a.points || b.frq.year - a.frq.year || a.frq.number - b.frq.number);
}

export const frqTotal = (frq: FrqLink) => frq.parts.reduce((sum, p) => sum + p.points, 0);

/** Points in parts whose every topic has been learned (this year or last year). */
export function readyPoints(frq: FrqLink, isLearned: (topic: string) => boolean): number {
  return frq.parts.filter((p) => p.cedTopics.every(isLearned)).reduce((sum, p) => sum + p.points, 0);
}

/** Science-practice ids ("1"–"6") used anywhere in the question, in order. */
export function frqPractices(frq: Pick<FrqLink, 'parts'>): string[] {
  const ids = new Set(frq.parts.flatMap((p) => p.skills.map((s) => s.split('.')[0]!)));
  return [...ids].sort();
}

export const frqName = (frq: Pick<FrqLink, 'year' | 'number'>) => `${frq.year} Q${frq.number}`;

/**
 * How many past FRQs match, counted the same way everywhere: questions, plus the matching parts
 * when that's a different number. "10 past FRQs (12 parts)", "1 past FRQ".
 */
export function frqCountLabel(matches: Pick<FrqMatch, 'parts'>[], noun = 'past FRQ'): string {
  const q = matches.length;
  const parts = matches.reduce((sum, m) => sum + m.parts.length, 0);
  const label = `${q} ${noun}${q === 1 ? '' : 's'}`;
  return parts === q ? label : `${label} (${parts} parts)`;
}

/**
 * The readiness badge on an FRQ card, in plain words: "✓ Ready" when every part is on topics
 * already learned, else how many of its points are. `title` explains it on hover.
 */
export function readinessLabel(ready: number, total: number): { text: string; title: string; full: boolean } {
  const full = total > 0 && ready >= total;
  return {
    full,
    text: full ? '✓ Ready' : ready === 0 ? 'Topics not learned yet' : `${ready} of ${total} pts on topics you've learned`,
    title: full
      ? 'You have learned every topic in this question (this year or last year).'
      : 'Points in parts whose topics you have all learned (this year or last year).',
  };
}
