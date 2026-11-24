// One chapter's practice questions with their text, fetched by the practice page when a set
// needs them (lib/practice/build.ts). The page itself carries only questionMeta for each question.
import type { APIRoute, GetStaticPaths } from 'astro';
import { getQuestions, subjectIds } from '../../../../lib/content';
import { toPractice } from '../../../../lib/practice/build';

export const getStaticPaths = (async () => {
  const paths = [];
  for (const subject of subjectIds()) {
    const chapters = new Set((await getQuestions(subject)).map((q) => q.data.chapter));
    for (const chapter of chapters) paths.push({ params: { subject, chapter: String(chapter) } });
  }
  return paths;
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => {
  const subject = params.subject!;
  const chapter = Number(params.chapter);
  const questions = (await getQuestions(subject)).filter((q) => q.data.chapter === chapter);
  const body = await Promise.all(questions.map((q) => toPractice(subject, q)));
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
};
