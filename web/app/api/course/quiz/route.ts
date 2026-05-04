import { NextResponse } from "next/server";
import { buildCourseCorpus } from "@/lib/course-corpus";
import { verifyLibraryAccess } from "@/lib/library-access";
import { postGenerateQuiz } from "@/lib/summarize-backend";

export async function POST(request: Request) {
  if (!(await verifyLibraryAccess(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const courseLabel =
    body &&
    typeof body === "object" &&
    typeof (body as { courseLabel?: unknown }).courseLabel === "string"
      ? (body as { courseLabel: string }).courseLabel.trim()
      : "";

  if (!courseLabel) {
    return NextResponse.json({ error: "courseLabel is required" }, { status: 400 });
  }

  let corpus: string;
  try {
    corpus = await buildCourseCorpus(courseLabel);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to build corpus";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (corpus.length < 80) {
    return NextResponse.json(
      {
        error:
          "Not enough material for this class. Add summaries, notes, transcripts, or uploaded documents (and run AI summary on files).",
      },
      { status: 400 }
    );
  }

  try {
    const quiz = await postGenerateQuiz({ corpus, courseTitle: courseLabel });
    return NextResponse.json(quiz);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Quiz generation failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
