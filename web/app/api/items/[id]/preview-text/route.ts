import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLibraryAccess } from "@/lib/library-access";
import { KIND_FILE_UPLOAD } from "@/lib/material-kinds";
import { cacheExtractedTextIfNeeded } from "@/lib/library-document-service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  if (!(await verifyLibraryAccess(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const item = await prisma.libraryItem.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      storedFileName: true,
      originalFileName: true,
      studyArtifacts: true,
    },
  });

  if (!item || item.kind !== KIND_FILE_UPLOAD || !item.storedFileName || !item.originalFileName) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const text = await cacheExtractedTextIfNeeded({
    id: item.id,
    storedFileName: item.storedFileName,
    originalFileName: item.originalFileName,
    studyArtifacts: item.studyArtifacts,
  });

  return NextResponse.json({
    text,
    emptyReason:
      text.trim() ?
        undefined
      : "No extractable text (legacy .doc/.ppt must be converted to DOCX/PPTX, or file may be empty).",
  });
}
