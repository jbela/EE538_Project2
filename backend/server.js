import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

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
  jobs.set(jobId, { status: 'queued', createdAt: Date.now() });

  setTimeout(() => {
    jobs.set(jobId, {
      status: 'done',
      result: {
        summary: 'Stub summary: replace with Python worker output.'
      }
    });
  }, 3000);

  res.status(202).json({ jobId, filename: req.file?.originalname || null });
});

app.get('/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

function simpleSummarize(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) {
    return {
      summary: 'No extractable transcript/text found on page.'
    };
  }

  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const summary = sentences.slice(0, 3).join(' ').slice(0, 600);

  return { summary };
}

async function openAISummarize(text, { title, url } = {}) {
  const prompt = [
    'You are a lecture summarizer.',
    'Return only a concise plain-text summary (no markdown, no bullets unless needed).',
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

    let result;
    let model;

    if (OPENAI_API_KEY) {
      result = await openAISummarize(sourceText, { title, url });
      model = OPENAI_MODEL;
    } else {
      result = simpleSummarize(sourceText);
      model = 'heuristic-fallback';
    }

    res.json({
      title: title || null,
      url: url || null,
      summary: result.summary,
      model
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
