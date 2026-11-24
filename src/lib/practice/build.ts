// The practice page's question data, built at build time (server only). questionMeta is the
// small part every question carries on the practice page itself; toPractice adds the text, with
// Markdown and KaTeX pre-rendered to HTML so the practice island ships no Markdown or math parser.
// The text is served one chapter per file (pages/[subject]/practice/questions/[chapter].json.ts).
import { dirname, join } from 'node:path';
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import { type Question, getSubjectData, isClassContent, topicIds } from '../content';
import { renderInlineMarkdown, renderMarkdown, renderPlainText } from '../markdown';
import type { PracticeQuestion, QuestionMeta } from './types';

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

/** What filtering and picking a set need: no text. */
export function questionMeta(subject: string, q: Question): QuestionMeta {
  const data = getSubjectData(subject);
  const cedTopics = topicIds(q);
  return {
    id: q.id,
    type: q.data.type,
    chapter: q.data.chapter,
    sections: q.data.sections,
    cedTopics,
    units: [...new Set(cedTopics.map((t) => data.topics.get(t)!.unitId))],
    difficulty: q.data.difficulty,
    ...(q.data.calculation ? { calculation: true as const } : {}),
    ...(q.data.group ? { groups: [q.data.group].flat() } : {}),
    // Samples and later chapters stay out of practice unless their chapter is picked.
    ...(isClassContent(data, q) ? {} : { extra: true }),
  };
}

/** The whole question, text included. */
export async function toPractice(subject: string, q: Question): Promise<PracticeQuestion> {
  const { type: _, ...meta } = questionMeta(subject, q);
  const base = {
    ...meta,
    promptHtml: await renderMarkdown(q.data.prompt),
    promptText: await renderPlainText(q.data.prompt),
    image: await questionImage(q),
    explanationHtml: await renderMarkdown(q.data.explanation),
  };
  if (q.data.type === 'mcq') {
    return {
      ...base,
      type: 'mcq',
      answer: q.data.answer,
      choices: await Promise.all(
        q.data.choices.map(async (c) => ({ id: c.id, html: await renderInlineMarkdown(c.text), text: await renderPlainText(c.text) })),
      ),
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
