import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';

const app = express();
const port = 3000;
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

const jobs = new Map();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

app.get('/health', (_req, res) => {
  res.json({ ok: true, llm: OPENAI_API_KEY ? 'openai-enabled' : 'heuristic-only' });
});

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
  if (!clean) {
    return { summary: 'No extractable transcript/text found on page.' };
  }

  const sentences = splitSentences(clean);
  if (!sentences.length) {
    return { summary: clean.slice(0, 600) };
  }

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

    // Light bias toward earlier sentences and medium length informative lines.
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

function chunkText(text, maxChars = 2800) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks = [];
  let current = '';

  for (const s of sentences) {
    if ((current + ' ' + s).trim().length > maxChars) {
      if (current.trim()) chunks.push(current.trim());
      current = s;
    } else {
      current += (current ? ' ' : '') + s;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function openAISummarize(text, { title, url, mode = 'generic' } = {}) {
  const modeLine = mode === 'video'
    ? 'This content comes from a lecture video transcript. Keep timeline coherence when possible.'
    : 'This content comes from webpage extracted text.';

  const prompt = [
    'You are a lecture summarizer.',
    'Return only concise plain text.',
    modeLine,
    'Focus on key ideas and actionable takeaways.',
    '',
    title ? `Page title: ${title}` : '',
    url ? `Page URL: ${url}` : '',
    '',
    'Content:',
    text
  ].filter(Boolean).join('\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Summarize clearly and accurately.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const summary = data?.choices?.[0]?.message?.content?.trim();
  if (!summary) throw new Error('OpenAI returned empty summary.');
  return { summary };
}

async function summarizeLongText(text, meta = {}) {
  const chunks = chunkText(text, 2800);
  if (!chunks.length) {
    return {
      summary: 'No extractable transcript/text found on page.',
      chunkCount: 0,
      timeline: []
    };
  }

  const timeline = [];
  const partials = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    let partial;

    if (OPENAI_API_KEY) {
      partial = await openAISummarize(chunk, meta);
    } else {
      partial = simpleSummarize(chunk);
    }

    partials.push(partial.summary);
    timeline.push({
      section: i + 1,
      startSec: i * 180,
      endSec: (i + 1) * 180,
      summary: partial.summary
    });
  }

  const merged = partials.join('\n\n');
  const final = OPENAI_API_KEY
    ? await openAISummarize(merged, { ...meta, mode: 'video' })
    : simpleSummarize(merged);

  return {
    summary: final.summary,
    chunkCount: chunks.length,
    timeline
  };
}

async function transcribeUploadedMediaStub(file) {
  // Phase-1 skeleton: no real ASR yet.
  // Future: replace this with ffmpeg audio extraction + Whisper transcription.
  const filename = file?.originalname || 'uploaded media';
  return [
    `Transcript stub for ${filename}.`,
    'This placeholder transcript represents what an ASR engine would output.',
    'In production, this step will extract audio from video and run speech-to-text.',
    'Then chunked summarization will build an overall summary and timeline highlights.'
  ].join(' ');
}

async function processUploadedMediaJob(jobId, file) {
  jobs.set(jobId, { status: 'processing', stage: 'transcribing' });

  if (!file) {
    throw new Error('No uploaded file found in request.');
  }

  const transcript = await transcribeUploadedMediaStub(file);

  jobs.set(jobId, { status: 'processing', stage: 'summarizing' });

  const summarized = await summarizeLongText(transcript, {
    title: file.originalname,
    mode: 'video'
  });

  jobs.set(jobId, {
    status: 'done',
    result: {
      summary: summarized.summary,
      timeline: summarized.timeline,
      meta: {
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        chunkCount: summarized.chunkCount,
        model: OPENAI_API_KEY ? OPENAI_MODEL : 'heuristic-fallback',
        pipeline: 'phase1-video-skeleton'
      }
    }
  });

  // cleanup temp upload file
  try {
    await fs.unlink(file.path);
  } catch (_) {
    // ignore cleanup errors
  }
}

app.post('/summarize-text', async (req, res) => {
  try {
    const { title, url, transcript, pageText } = req.body || {};
    const sourceText = String(transcript || pageText || '').trim();

    if (!sourceText) {
      return res.json({
        title: title || null,
        url: url || null,
        summary: 'No extractable transcript/text found on page.',
        model: OPENAI_API_KEY ? OPENAI_MODEL : 'heuristic-fallback'
      });
    }

    const result = OPENAI_API_KEY
      ? await openAISummarize(sourceText, { title, url, mode: 'generic' })
      : simpleSummarize(sourceText);

    res.json({
      title: title || null,
      url: url || null,
      summary: result.summary,
      model: OPENAI_API_KEY ? OPENAI_MODEL : 'heuristic-fallback'
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'summarization failed' });
  }
});

app.get('/search', (req, res) => {
  const q = req.query.q || '';
  res.json({ query: q, results: [], message: 'Stub search endpoint' });
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  console.log(OPENAI_API_KEY ? `LLM enabled: ${OPENAI_MODEL}` : 'LLM disabled: using heuristic fallback');
});
