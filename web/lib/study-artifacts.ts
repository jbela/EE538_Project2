/** Stored in LibraryItem.studyArtifacts (Json). */

export type StudyArtifacts = {
  documentExtractedText?: string;
};

export function mergeStudyArtifacts(
  current: unknown,
  patch: StudyArtifacts
): StudyArtifacts {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, ...patch };
}
