// Cross-file checks for lesson and question tags. Called from schema superRefine in
// content.config.ts, so a bad tag fails the build with the entry's file and field.
import type { z } from 'astro/zod';
import { loadRegistry } from './registry';

export interface TagFields {
  subject: { id: string } | string;
  chapter: number;
  sections: string[];
  cedTopics: Array<{ id: string } | string>;
}

const idOf = (ref: { id: string } | string) => (typeof ref === 'string' ? ref : ref.id);

/** "apchem-5.4" -> "5.4" */
export function topicIdFromRef(subject: string, ref: { id: string } | string): string {
  const id = idOf(ref);
  return id.startsWith(`${subject}-`) ? id.slice(subject.length + 1) : id;
}

/**
 * Authors may write `cedTopics: ["5.4"]`; expand to the collection id "apchem-5.4"
 * so `reference('cedTopics')` resolves. Full ids are left alone.
 */
export function expandTopicIds(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const data = raw as Record<string, unknown>;
  if (typeof data.subject !== 'string' || !Array.isArray(data.cedTopics)) return raw;
  const subject = data.subject;
  return {
    ...data,
    cedTopics: data.cedTopics.map((t) =>
      typeof t === 'string' && /^\d+\.\d+$/.test(t) ? `${subject}-${t}` : t,
    ),
  };
}

export function checkTags(data: TagFields, ctx: z.RefinementCtx): void {
  const registry = loadRegistry();
  const subjectId = idOf(data.subject);
  const subject = registry.get(subjectId);
  if (!subject) {
    ctx.addIssue({
      code: 'custom',
      path: ['subject'],
      message: `unknown subject "${subjectId}" (not in src/data/subjects.json)`,
    });
    return;
  }

  const chapter = subject.chapterMap.get(data.chapter);
  if (!chapter) {
    ctx.addIssue({
      code: 'custom',
      path: ['chapter'],
      message: `chapter ${data.chapter} does not exist in src/data/${subjectId}/chapters.json`,
    });
  } else if (chapter.sections.length > 0) {
    const known = new Set(chapter.sections.map((s) => s.id));
    data.sections.forEach((s, i) => {
      if (!known.has(s)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sections', i],
          message: `section "${s}" is not listed under chapter ${data.chapter} in chapters.json`,
        });
      }
    });
  }

  const seen = new Set<string>();
  data.cedTopics.forEach((ref, i) => {
    const raw = idOf(ref);
    const topicId = topicIdFromRef(subjectId, ref);
    if (!raw.startsWith(`${subjectId}-`) || !subject.topics.has(topicId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['cedTopics', i],
        message: `unknown CED topic "${raw}" (not in src/data/${subjectId}/ced.json)`,
      });
    } else if (seen.has(topicId)) {
      ctx.addIssue({ code: 'custom', path: ['cedTopics', i], message: `topic "${topicId}" is listed twice` });
    }
    seen.add(topicId);
  });
}
