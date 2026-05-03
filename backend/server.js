import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import 'dotenv/config';
import OpenAI from 'openai';

const app = express();
const port = 3000;
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json({ limit: '10mb' })); // transcripts can be large

const jobs = new Map();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
// gpt-5.2 is the current sweet spot for quality vs cost (Apr 2026).
// You can override with OPENAI_MODEL=gpt-5.5 for higher quality, or
// OPENAI_MODEL=gpt-4o-mini if you have older API access.
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.2';
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'whisper-1';

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// ---------- Health ----------

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    llm: openai ? 'openai-enabled' : 'heuristic-only',
    chatModel: openai ? OPENAI_MODEL : null,
    whisperModel: openai ? WHISPER_MODEL : null
  });
});

// ---------- Heuristic fallback (unchanged from your original) ----------

function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tokenize(text) {
  return String(text || '').toLowerCase().match(/[a-z][a-z0-9'-]{1,}/g) || [];
}

function simpleSummarize(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return { summary: 'No extractable transcript/text found on page.' };

  const sentences = splitSentences(clean);
  if (!sentences.length) return { summary: clean.slice(0, 600) };

  const stop = new Set([
    'the','a','an','and','or','to','of','in','on','for','is','are','was','were','be','been','being',
    'by','with','as','that','this','it','from','at','we','you','they','he','she','i','my','our','your',
    'their','but','if','then','so','than','into','about','over','under','after','before','can','could',
    'should','would','will','just','also','not','no','yes','do','does','did','have','has','had'
  ]);

  const freq = new Map();
  for (const w of tokenize(clean)) {
    if (stop.has(w) || w.length < 3) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  const scored = sentences.map((s, idx) => {
    const words = tokenize(s).filter((w) => !stop.has(w));
    let score = 0;
    for (const w of words) score += freq.get(w) || 0;
    const positionBoost = Math.max(0, 1.2 - idx * 0.08);
    const len = s.length;
    const lengthBoost = len >= 40 && len <= 220 ? 1.1 : 0.9;
    return { sentence: s, idx, score: score * positionBoost * lengthBoost };
  });

  const pickCount = Math.min(4, Math.max(2, Math.ceil(sentences.length * 0.18)));
  const selected = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, pickCount)
    .sort((a, b) => a.idx - b.idx)
    .map((x) => x.sentence);

  let summary = selected.join(' ');
  if (!summary) summary = sentences.slice(0, 3).join(' ');
  if (summary.length > 700) summary = summary.slice(0, 700);
  return { summary };
}

// ---------- Segment helpers ----------

/**
 * A Segment is { text: string, startTime: number, endTime: number } — seconds.
 *
 * Segments come from three places:
 *   1) The Chrome extension (video <track> cues, Zoom DOM).
 *   2) Whisper transcription of an uploaded file.
 *   3) Synthesized from a flat string (fallback) — startTime stays 0.
 */

function normalizeSegments(segments) {
  if (!Array.isArray(segments)) return [];
  return segments
    .map((s) => ({
      text: String(s.text || '').replace(/\s+/g, ' ').trim(),
      startTime: Number.isFinite(s.startTime) ? Math.max(0, s.startTime) : 0,
      endTime: Number.isFinite(s.endTime) ? s.endTime : 0
    }))
    .filter((s) => s.text);
}

function segmentsToTranscriptText(segments) {
  return segments.map((s) => s.text).join(' ');
}

/**
 * Format segments for a prompt so the model can reference them by start time.
 * Example output:
 *   [t=0] So today we'll talk about gradient descent...
 *   [t=42] The key insight is that the loss surface...
 */
function segmentsToPromptBlock(segments) {
  return segments
    .map((s) => `[t=${Math.round(s.startTime)}] ${s.text}`)
    .join('\n');
}

/**
 * Group segments into chunks bounded by character count, preserving timestamps.
 * Returns Array<{ text, startTime, endTime, segments }> where each chunk's
 * start/end spans its first and last segment.
 */
function chunkSegments(segments, maxChars = 6000) {
  const chunks = [];
  let buf = [];
  let bufLen = 0;

  for (const seg of segments) {
    const segLen = seg.text.length + 1;
    if (bufLen + segLen > maxChars && buf.length) {
      chunks.push({
        text: buf.map((s) => s.text).join(' '),
        startTime: buf[0].startTime,
        endTime: buf[buf.length - 1].endTime || buf[buf.length - 1].startTime,
        segments: buf
      });
      buf = [];
      bufLen = 0;
    }
    buf.push(seg);
    bufLen += segLen;
  }
  if (buf.length) {
    chunks.push({
      text: buf.map((s) => s.text).join(' '),
      startTime: buf[0].startTime,
      endTime: buf[buf.length - 1].endTime || buf[buf.length - 1].startTime,
      segments: buf
    });
  }
  return chunks;
}

// ---------- OpenAI calls ----------

async function openAISummarize(text, { title, url, mode = 'generic' } = {}) {
  const modeLine = mode === 'video'
    ? 'This content comes from a lecture video transcript. Keep timeline coherence when possible.'
    : 'This content comes from webpage extracted text.';

  const userContent = [
    modeLine,
    'Focus on key ideas and actionable takeaways. Return only concise plain text — no headings, no markdown.',
    title ? `Page title: ${title}` : '',
    url ? `Page URL: ${url}` : '',
    '',
    'Content:',
    text
  ].filter(Boolean).join('\n');

  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'You are a precise lecture summarizer. Summarize clearly and accurately.' },
      { role: 'user', content: userContent }
    ]
  });

  const summary = response.choices?.[0]?.message?.content?.trim();
  if (!summary) throw new Error('OpenAI returned empty summary.');
  return { summary };
}

/**
 * Summarize a list of timestamped segments. Returns:
 *   {
 *     summary: string,                // overall summary with [t=SEC] citations
 *     timeline: [{ section, startSec, endSec, summary }]
 *   }
 *
 * The model is instructed to insert [t=SEC] markers anchored to real segment
 * start times, which the frontend can render as clickable jump links.
 */
async function openAISummarizeSegments(segments, { title } = {}) {
  if (!segments.length) {
    return { summary: 'No transcript content to summarize.', timeline: [] };
  }

  const chunks = chunkSegments(segments, 6000);

  // 1) Per-chunk summary with citations anchored to that chunk's segments.
  const partials = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const promptBlock = segmentsToPromptBlock(chunk.segments);

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: [
            'You are a precise lecture summarizer.',
            'You will receive a chunk of transcript where each line is prefixed with a timestamp marker like [t=42] meaning "this line starts 42 seconds into the lecture".',
            'Write a concise plain-text summary (3-5 sentences) of the key ideas.',
            'After every major claim, insert a citation in the form [t=SECONDS] using the timestamp of the segment that supports it. Use only timestamps that actually appear in the input.',
            'Do not output headings, bullets, or markdown.'
          ].join(' ')
        },
        {
          role: 'user',
          content: [
            title ? `Lecture: ${title}` : '',
            `Chunk ${i + 1} of ${chunks.length}:`,
            '',
            promptBlock
          ].filter(Boolean).join('\n')
        }
      ]
    });

    const partial = response.choices?.[0]?.message?.content?.trim() || '';
    partials.push(partial);
  }

  // 2) Final pass: merge the per-chunk summaries into one coherent summary,
  //    keeping the most important [t=SEC] citations.
  const mergePrompt = [
    'Below are partial summaries of consecutive sections of one lecture, each containing [t=SEC] timestamp citations.',
    'Produce one unified summary in 5-8 sentences that captures the lecture\'s key ideas in order.',
    'Preserve the most important [t=SEC] citations so a reader can jump to the source moment. Use only timestamps that appear in the input.',
    'Plain text only — no headings, no markdown, no bullets.',
    '',
    partials.map((p, i) => `Section ${i + 1}:\n${p}`).join('\n\n')
  ].join('\n');

  const finalResp = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'You merge partial lecture summaries into one coherent overview while preserving timestamp citations.' },
      { role: 'user', content: mergePrompt }
    ]
  });

  const finalSummary = finalResp.choices?.[0]?.message?.content?.trim() || partials.join('\n\n');

  const timeline = chunks.map((c, i) => ({
    section: i + 1,
    startSec: Math.round(c.startTime),
    endSec: Math.round(c.endTime),
    summary: partials[i] || ''
  }));

  return { summary: finalSummary, timeline };
}

/**
 * Chat over a transcript. Uses segments-with-timestamps when available so the
 * model can cite [t=SEC] in its answers.
 *
 * For lectures up to ~50K tokens this fits comfortably in gpt-5.2's 1M-token
 * context window. For larger corpora, swap this for embeddings + retrieval.
 */
async function openAIChat({ messages, segments, transcriptText, title }) {
  const transcriptForPrompt = segments.length
    ? segmentsToPromptBlock(segments)
    : transcriptText;

  const systemContent = [
    'You are a study assistant for a single lecture.',
    'Answer the user\'s questions using ONLY the provided lecture transcript.',
    'If the transcript does not contain the answer, say so honestly — do not invent material.',
    segments.length
      ? 'The transcript is a list of lines, each prefixed with [t=SECONDS] indicating when that line was spoken in the lecture. After each factual claim in your answer, append a citation like [t=SECONDS] using the timestamp of the segment that supports it. Use only timestamps that appear in the transcript.'
      : 'No timestamps are available, so do not invent any.',
    'Keep answers concise — 1 to 4 short paragraphs. Plain text only, no markdown headings or bullets.',
    title ? `Lecture title: ${title}` : '',
    '',
    'TRANSCRIPT:',
    transcriptForPrompt
  ].filter(Boolean).join('\n');

  const safeMessages = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12); // cap conversation history

  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.3,
    messages: [
      { role: 'system', content: systemContent },
      ...safeMessages
    ]
  });

  const reply = response.choices?.[0]?.message?.content?.trim() || '';
  return { reply, model: OPENAI_MODEL };
}

// ---------- Endpoints: summarize ----------

app.post('/summarize-text', async (req, res) => {
  try {
    const { title, url, transcript, pageText, segments } = req.body || {};
    const normSegs = normalizeSegments(segments);
    const sourceText = String(transcript || pageText || '').trim();

    // Path A: caller provided real timestamped segments → cited summary + timeline.
    if (normSegs.length && openai) {
      const result = await openAISummarizeSegments(normSegs, { title });
      return res.json({
        title: title || null,
        url: url || null,
        summary: result.summary,
        timeline: result.timeline,
        segmentCount: normSegs.length,
        model: OPENAI_MODEL
      });
    }

    // Path B: flat text only (or no LLM key) → original behavior.
    if (!sourceText && !normSegs.length) {
      return res.json({
        title: title || null,
        url: url || null,
        summary: 'No extractable transcript/text found on page.',
        model: openai ? OPENAI_MODEL : 'heuristic-fallback'
      });
    }

    const flatText = sourceText || segmentsToTranscriptText(normSegs);
    const result = openai
      ? await openAISummarize(flatText, { title, url, mode: 'generic' })
      : simpleSummarize(flatText);

    res.json({
      title: title || null,
      url: url || null,
      summary: result.summary,
      model: openai ? OPENAI_MODEL : 'heuristic-fallback'
    });
  } catch (error) {
    console.error('[/summarize-text]', error);
    res.status(500).json({ error: error.message || 'summarization failed' });
  }
});

// ---------- Endpoints: chat ----------

app.post('/chat', async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({
        error: 'Chat requires OPENAI_API_KEY. Set it in backend/.env and restart the server.'
      });
    }

    const { messages, transcript, segments, title } = req.body || {};
    const normSegs = normalizeSegments(segments);
    const transcriptText = String(transcript || '').trim();

    if (!normSegs.length && !transcriptText) {
      return res.status(400).json({
        error: 'Provide a transcript or segments[] so the assistant has context.'
      });
    }

    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: 'messages[] is required.' });
    }

    const result = await openAIChat({
      messages,
      segments: normSegs,
      transcriptText,
      title
    });

    res.json(result);
  } catch (error) {
    console.error('[/chat]', error);
    res.status(500).json({ error: error.message || 'chat failed' });
  }
});

// ---------- Endpoints: file upload + Whisper ----------

app.post('/jobs', upload.single('file'), (req, res) => {
  const jobId = uuidv4();
  const file = req.file || null;

  jobs.set(jobId, {
    status: 'queued',
    createdAt: Date.now(),
    input: {
      filename: file?.originalname || null,
      mimetype: file?.mimetype || null,
      size: file?.size || null
    }
  });

  processUploadedMediaJob(jobId, file).catch((error) => {
    console.error('[/jobs]', error);
    jobs.set(jobId, {
      status: 'failed',
      error: error.message || 'job failed'
    });
  });

  res.status(202).json({ jobId, filename: file?.originalname || null });
});

app.get('/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

/**
 * Real Whisper transcription. Returns segments with start/end times.
 * Whisper accepts most audio/video formats directly up to 25MB. For larger
 * files, you'd add an ffmpeg pre-step to extract + compress audio.
 */
async function whisperTranscribe(file) {
  const stream = createReadStream(file.path);

  // verbose_json gives us per-segment timestamps, which we use for citations.
  const resp = await openai.audio.transcriptions.create({
    file: stream,
    model: WHISPER_MODEL,
    response_format: 'verbose_json',
    timestamp_granularities: ['segment']
  });

  const segments = (resp.segments || []).map((s) => ({
    text: String(s.text || '').trim(),
    startTime: Number(s.start) || 0,
    endTime: Number(s.end) || 0
  })).filter((s) => s.text);

  return { segments, language: resp.language || 'unknown' };
}

async function transcribeUploadedMediaStub(file) {
  const filename = file?.originalname || 'uploaded media';
  return [
    `Transcript stub for ${filename}.`,
    'This placeholder transcript represents what an ASR engine would output.',
    'Set OPENAI_API_KEY in backend/.env to enable real Whisper transcription.'
  ].join(' ');
}

async function processUploadedMediaJob(jobId, file) {
  jobs.set(jobId, { status: 'processing', stage: 'transcribing' });

  if (!file) throw new Error('No uploaded file found in request.');

  let segments = [];
  let transcriptText = '';
  let asrEngine = 'stub';

  if (openai) {
    try {
      const { segments: whisperSegs } = await whisperTranscribe(file);
      segments = whisperSegs;
      transcriptText = segmentsToTranscriptText(segments);
      asrEngine = WHISPER_MODEL;
    } catch (e) {
      console.error('[whisper] failed, falling back to stub:', e.message);
      transcriptText = await transcribeUploadedMediaStub(file);
    }
  } else {
    transcriptText = await transcribeUploadedMediaStub(file);
  }

  jobs.set(jobId, { status: 'processing', stage: 'summarizing' });

  let summary;
  let timeline = [];

  if (openai && segments.length) {
    const result = await openAISummarizeSegments(segments, { title: file.originalname });
    summary = result.summary;
    timeline = result.timeline;
  } else if (openai) {
    const result = await openAISummarize(transcriptText, { title: file.originalname, mode: 'video' });
    summary = result.summary;
  } else {
    summary = simpleSummarize(transcriptText).summary;
  }

  jobs.set(jobId, {
    status: 'done',
    result: {
      summary,
      timeline,
      segments, // frontend can use these for chat / citations
      meta: {
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        segmentCount: segments.length,
        asrEngine,
        model: openai ? OPENAI_MODEL : 'heuristic-fallback',
        pipeline: openai && segments.length ? 'whisper+chat-completions' : 'phase1-fallback'
      }
    }
  });

  try { await fs.unlink(file.path); } catch (_) {}
}

// ---------- Misc ----------

app.get('/search', (req, res) => {
  const q = req.query.q || '';
  res.json({ query: q, results: [], message: 'Stub search endpoint' });
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  console.log(openai
    ? `LLM enabled — chat: ${OPENAI_MODEL}, ASR: ${WHISPER_MODEL}`
    : 'LLM disabled — set OPENAI_API_KEY in backend/.env to enable.');
});
