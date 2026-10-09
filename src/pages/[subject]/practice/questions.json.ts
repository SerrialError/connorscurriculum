// All questions for a subject with Markdown/KaTeX pre-rendered to HTML, so the
// practice island ships no Markdown or math parser.
import { dirname, join } from 'node:path';
import type { APIRoute, GetStaticPaths, ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import { type Question, getQuestions, getSubjectData, subjectPaths, topicIds } from '../../../lib/content';
import { renderInlineMarkdown, renderMarkdown } from '../../../lib/markdown';
import type { PracticeQuestion } from '../../../lib/practice';

export const getStaticPaths = subjectPaths satisfies GetStaticPaths;

const images = import.meta.glob<ImageMetadata>('/src/content/questions/**/*.{png,jpg,jpeg,webp,gif,avif,svg}', {
  eager: true,
  import: 'default',
});

async function questionImage(q: Question) {
  if (!q.data.image) return undefined;
  const key = '/' + join(dirname(q.filePath!), q.data.image).replaceAll('\\', '/');
  const meta = images[key];
  if (!meta) throw new Error(`${q.filePath} → ${q.id}.image: could not load "${q.data.image}"`);
  const img = await getImage({ src: meta, width: Math.min(meta.width, 900) });
  return {
    src: img.src,
    width: Number(img.attributes.width ?? meta.width),
    height: Number(img.attributes.height ?? meta.height),
    alt: q.data.imageAlt ?? '',
  };
}

async function toPractice(subject: string, q: Question): Promise<PracticeQuestion> {
  const data = getSubjectData(subject);
  const cedTopics = topicIds(q);
  const base = {
    id: q.id,
    chapter: q.data.chapter,
    sections: q.data.sections,
    cedTopics,
    units: [...new Set(cedTopics.map((t) => data.topics.get(t)!.unitId))],
    difficulty: q.data.difficulty,
    promptHtml: await renderMarkdown(q.data.prompt),
    image: await questionImage(q),
    explanationHtml: await renderMarkdown(q.data.explanation),
  };
  if (q.data.type === 'mcq') {
    return {
      ...base,
      type: 'mcq',
      answer: q.data.answer,
      choices: await Promise.all(q.data.choices.map(async (c) => ({ id: c.id, html: await renderInlineMarkdown(c.text) }))),
    };
  }
  return {
    ...base,
    type: 'frq',
    parts: await Promise.all(
      q.data.parts.map(async (p) => ({
        label: p.label,
        points: p.points,
        promptHtml: await renderMarkdown(p.prompt),
        scoringHtml: await Promise.all(p.scoring.map(renderInlineMarkdown)),
      })),
    ),
  };
}

export const GET: APIRoute = async ({ params }) => {
  const subject = params.subject!;
  const questions = await getQuestions(subject);
  const body = await Promise.all(questions.map((q) => toPractice(subject, q)));
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
};
