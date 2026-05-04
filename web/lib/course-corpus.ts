import { prisma } from "@/lib/prisma";
import { KIND_FILE_UPLOAD } from "@/lib/material-kinds";
import { cacheExtractedTextIfNeeded } from "@/lib/library-document-service";

function section(title: string, body: string | null | undefined): string {
  const t = String(body || "").trim();
  if (!t) return "";
  return `### ${title}\n${t}\n\n`;
}

/**
 * Concatenate summaries, notes, transcripts, and extracted document text for one class.
 */
export async function buildCourseCorpus(courseLabel: string): Promise<string> {
  const label = courseLabel.trim();
  if (!label) return "";

  const items = await prisma.libraryItem.findMany({
    where: { courseLabel: label },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      summary: true,
      transcript: true,
      noteContent: true,
      kind: true,
      storedFileName: true,
      originalFileName: true,
      studyArtifacts: true,
    },
  });

  const parts: string[] = [`Course: ${label}\n`];

  for (const item of items) {
    parts.push(section(`${item.title} — summary`, item.summary));
    parts.push(section(`${item.title} — notes`, item.noteContent));
    parts.push(section(`${item.title} — transcript`, item.transcript));

    if (item.kind === KIND_FILE_UPLOAD && item.storedFileName && item.originalFileName) {
      const doc = await cacheExtractedTextIfNeeded({
        id: item.id,
        storedFileName: item.storedFileName,
        originalFileName: item.originalFileName,
        studyArtifacts: item.studyArtifacts,
      });
      if (doc) {
        const slice = doc.length > 45_000 ? `${doc.slice(0, 45_000)}\n… [truncated]` : doc;
        parts.push(section(`${item.title} — uploaded document`, slice));
      }
    }
  }

  return parts.join("").trim();
}
