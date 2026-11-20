// The original photos and documents a lesson was typed up from (lesson frontmatter "originals").
// Paths are relative to the lesson's folder, so two lessons can share a file
// ("../06-notes-jaya/originals/study-guide.jpg").

/** The site-relative path of an original, e.g. "/src/content/lessons/apchem/07-notes-jaya/originals/a.jpg". */
export function originalPath(lessonId: string, file: string): string {
  return new URL(file, `file:///src/content/lessons/${lessonId}/`).pathname;
}

export const isImage = (file: string): boolean => /\.(jpe?g|png|webp)$/i.test(file);
export const isPdf = (file: string): boolean => /\.pdf$/i.test(file);
