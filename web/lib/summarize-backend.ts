/**
 * Calls the Node summarize backend (repo `backend/server.js`, default port 3000).
 */

export function getSummarizeBackendUrl(): string {
  const raw = process.env.SUMMARIZE_BACKEND_URL?.trim();
  return raw || "http://localhost:3000";
}

export async function postSummarizeText(body: {
  title?: string | null;
  url?: string | null;
  pageText?: string;
  transcript?: string;
}): Promise<{ summary: string; model?: string }> {
  const url = `${getSummarizeBackendUrl().replace(/\/$/, "")}/summarize-text`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    summary?: string;
    model?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `Summarize failed (${res.status})`);
  }
  const summary = typeof data.summary === "string" ? data.summary : "";
  if (!summary) throw new Error("Backend returned an empty summary.");
  return { summary, model: typeof data.model === "string" ? data.model : undefined };
}

export type QuizPayload = {
  flashcards: { front: string; back: string }[];
  questions: { question: string; choices: string[]; correctIndex: number }[];
  model?: string;
};

export async function postGenerateQuiz(body: {
  corpus: string;
  courseTitle?: string | null;
}): Promise<QuizPayload> {
  const url = `${getSummarizeBackendUrl().replace(/\/$/, "")}/generate-quiz`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      corpus: body.corpus,
      courseTitle: body.courseTitle ?? undefined,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as QuizPayload & { error?: string };
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `Quiz generation failed (${res.status})`);
  }
  return {
    flashcards: Array.isArray(data.flashcards) ? data.flashcards : [],
    questions: Array.isArray(data.questions) ? data.questions : [],
    model: data.model,
  };
}

export async function postGenerateStudySheet(body: {
  corpus: string;
  courseTitle?: string | null;
}): Promise<{ studySheet: string; model?: string }> {
  const url = `${getSummarizeBackendUrl().replace(/\/$/, "")}/generate-study-sheet`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      corpus: body.corpus,
      courseTitle: body.courseTitle ?? undefined,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    studySheet?: string;
    model?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : `Study sheet generation failed (${res.status})`
    );
  }
  const studySheet = typeof data.studySheet === "string" ? data.studySheet : "";
  if (!studySheet.trim()) throw new Error("Backend returned an empty study sheet.");
  return { studySheet, model: typeof data.model === "string" ? data.model : undefined };
}
