import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { extractTextFromUpload } from "@/lib/document-extract";
import { mergeStudyArtifacts } from "@/lib/study-artifacts";
import { getUploadsDir } from "@/lib/uploads";

/**
 * Reads uploaded file, extracts text, caches in studyArtifacts.documentExtractedText.
 */
export async function cacheExtractedTextIfNeeded(item: {
  id: string;
  storedFileName: string | null;
  originalFileName: string | null;
  studyArtifacts: unknown;
}): Promise<string> {
  const cur = item.studyArtifacts;
  const existing =
    cur &&
    typeof cur === "object" &&
    !Array.isArray(cur) &&
    typeof (cur as { documentExtractedText?: unknown }).documentExtractedText === "string"
      ? String((cur as { documentExtractedText: string }).documentExtractedText).trim()
      : "";
  if (existing) return existing;
  if (!item.storedFileName || !item.originalFileName) return "";

  let buffer: Buffer;
  try {
    buffer = await readFile(path.join(getUploadsDir(), item.storedFileName));
  } catch {
    return "";
  }

  const text = await extractTextFromUpload(buffer, item.originalFileName);
  if (text) {
    await prisma.libraryItem.update({
      where: { id: item.id },
      data: {
        studyArtifacts: mergeStudyArtifacts(item.studyArtifacts, {
          documentExtractedText: text,
        }) as object,
      },
    });
  }
  return text;
}
