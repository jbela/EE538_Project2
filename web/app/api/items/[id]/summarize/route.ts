import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLibraryAccess } from "@/lib/library-access";
import { KIND_FILE_UPLOAD } from "@/lib/material-kinds";
import { cacheExtractedTextIfNeeded } from "@/lib/library-document-service";
import { postSummarizeText } from "@/lib/summarize-backend";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  if (!(await verifyLibraryAccess(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const item = await prisma.libraryItem.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      kind: true,
      summary: true,
      storedFileName: true,
      originalFileName: true,
      studyArtifacts: true,
    },
  });

  if (!item || item.kind !== KIND_FILE_UPLOAD || !item.storedFileName || !item.originalFileName) {
    return NextResponse.json({ error: "Not a file upload or file missing" }, { status: 400 });
  }

  const extracted = await cacheExtractedTextIfNeeded({
    id: item.id,
    storedFileName: item.storedFileName,
    originalFileName: item.originalFileName,
    studyArtifacts: item.studyArtifacts,
  });

  if (!extracted.trim()) {
    return NextResponse.json(
      {
        error:
          "Could not extract readable text from this file type. Try PDF, DOCX, PPTX, TXT, or Markdown.",
      },
      { status: 400 }
    );
  }

  try {
    const { summary, model } = await postSummarizeText({
      title: item.title,
      pageText: extracted,
    });

    await prisma.libraryItem.update({
      where: { id: item.id },
      data: { summary },
    });

    return NextResponse.json({ summary, model });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Summarization failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
