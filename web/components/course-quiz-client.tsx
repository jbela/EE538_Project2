'use client';

import { useCallback, useState } from 'react';

type Flashcard = { front: string; back: string };
type Mcq = { question: string; choices: string[]; correctIndex: number };

type Props = { courseLabel: string };

export function CourseQuizClient({ courseLabel }: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [mcqs, setMcqs] = useState<Mcq[]>([]);
  const [mode, setMode] = useState<'flashcards' | 'mcq'>('flashcards');
  const [fcIdx, setFcIdx] = useState(0);
  const [fcReveal, setFcReveal] = useState(false);
  const [mcqIdx, setMcqIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const generate = useCallback(async () => {
    setErr(null);
    setLoading(true);
    setFlashcards([]);
    setMcqs([]);
    setFcIdx(0);
    setFcReveal(false);
    setMcqIdx(0);
    setPicked(null);
    try {
      const res = await fetch('/api/course/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ courseLabel }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.error === 'string' ? data.error : 'Could not generate quiz');
        return;
      }
      const fc = Array.isArray(data.flashcards) ? data.flashcards : [];
      const qs = Array.isArray(data.questions) ? data.questions : [];
      setFlashcards(fc);
      setMcqs(qs);
      if (!fc.length && qs.length) setMode('mcq');
      if (fc.length && !qs.length) setMode('flashcards');
    } finally {
      setLoading(false);
    }
  }, [courseLabel]);

  const fc = flashcards[fcIdx];
  const q = mcqs[mcqIdx];

  function nextFlashcard() {
    setFcReveal(false);
    setFcIdx((i) => (flashcards.length ? (i + 1) % flashcards.length : 0));
  }

  function nextMcq() {
    setPicked(null);
    setMcqIdx((i) => (mcqs.length ? (i + 1) % mcqs.length : 0));
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading}
          className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate quiz from class materials'}
        </button>
        {(flashcards.length > 0 || mcqs.length > 0) && (
          <div className="flex rounded-lg border border-stone-200 bg-white p-0.5 text-sm shadow-sm">
            <button
              type="button"
              onClick={() => setMode('flashcards')}
              className={`rounded-md px-3 py-1.5 font-medium ${
                mode === 'flashcards' ? 'bg-violet-100 text-violet-900' : 'text-slate-600 hover:bg-stone-50'
              }`}
            >
              Flashcards ({flashcards.length})
            </button>
            <button
              type="button"
              onClick={() => setMode('mcq')}
              className={`rounded-md px-3 py-1.5 font-medium ${
                mode === 'mcq' ? 'bg-violet-100 text-violet-900' : 'text-slate-600 hover:bg-stone-50'
              }`}
            >
              Multiple choice ({mcqs.length})
            </button>
          </div>
        )}
      </div>

      {err && (
        <p className="rounded-lg border border-red-100 bg-red-50/90 px-3 py-2 text-sm text-red-800">{err}</p>
      )}

      {!loading && !flashcards.length && !mcqs.length && !err && (
        <p className="text-sm text-slate-600">
          Build a corpus from every item tagged with <span className="font-medium">{courseLabel}</span> — summaries,
          notes, transcripts, and text extracted from uploads — then generate flashcards and multiple-choice questions.
        </p>
      )}

      {mode === 'flashcards' && flashcards.length > 0 && fc && (
        <div className="rounded-2xl border border-violet-200/80 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-800/80">
            Card {fcIdx + 1} / {flashcards.length}
          </p>
          <p className="mt-4 text-lg font-medium text-slate-900">{fc.front}</p>
          {fcReveal ? (
            <p className="mt-4 rounded-xl bg-emerald-50/80 px-4 py-3 text-base leading-relaxed text-emerald-950">
              {fc.back}
            </p>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Tap reveal to see the answer.</p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            {!fcReveal ? (
              <button
                type="button"
                onClick={() => setFcReveal(true)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
              >
                Reveal answer
              </button>
            ) : (
              <button
                type="button"
                onClick={nextFlashcard}
                className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-stone-50"
              >
                Next card
              </button>
            )}
          </div>
        </div>
      )}

      {mode === 'mcq' && mcqs.length > 0 && q && (
        <div className="rounded-2xl border border-violet-200/80 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-800/80">
            Question {mcqIdx + 1} / {mcqs.length}
          </p>
          <p className="mt-4 text-lg font-medium text-slate-900">{q.question}</p>
          <ul className="mt-4 space-y-2">
            {q.choices.map((c, i) => {
              const show = picked !== null;
              const correct = i === q.correctIndex;
              const wrongPick = show && picked === i && !correct;
              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={picked !== null}
                    onClick={() => setPicked(i)}
                    className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                      show && correct ?
                        'border-emerald-400 bg-emerald-50 font-medium text-emerald-950'
                      : show && wrongPick ?
                        'border-red-300 bg-red-50 text-red-900'
                      : 'border-stone-200 bg-stone-50/50 text-slate-800 hover:border-violet-300 hover:bg-violet-50/40'
                    }`}
                  >
                    <span className="mr-2 font-semibold text-slate-500">{String.fromCharCode(65 + i)}.</span>
                    {c}
                  </button>
                </li>
              );
            })}
          </ul>
          {picked !== null && (
            <button
              type="button"
              onClick={nextMcq}
              className="mt-6 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-stone-50"
            >
              Next question
            </button>
          )}
        </div>
      )}
    </div>
  );
}
