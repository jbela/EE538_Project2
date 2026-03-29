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

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/jobs', upload.single('file'), (req, res) => {
  const jobId = uuidv4();
  jobs.set(jobId, { status: 'queued', createdAt: Date.now() });

  setTimeout(() => {
    jobs.set(jobId, {
      status: 'done',
      result: {
        summary: 'Stub summary: replace with Python worker output.',
        topics: ['Topic A', 'Topic B'],
        notes: ['Key point 1', 'Key point 2']
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
      summary: 'No extractable transcript/text found on page.',
      topics: [],
      notes: []
    };
  }

  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const summary = sentences.slice(0, 3).join(' ').slice(0, 600);

  const stop = new Set(['the','a','an','and','or','to','of','in','on','for','is','are','was','were','be','by','with','as','that','this','it','from','at','we','you','they','he','she','i']);
  const freq = new Map();
  for (const w of clean.toLowerCase().match(/[a-z]{3,}/g) || []) {
    if (stop.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const topics = [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([w]) => w);
  const notes = sentences.slice(0, 5).map(s => s.slice(0, 140));

  return { summary, topics, notes };
}

app.post('/summarize-text', (req, res) => {
  const { title, url, transcript, pageText } = req.body || {};
  const sourceText = transcript || pageText || '';
  const result = simpleSummarize(sourceText);
  res.json({
    title: title || null,
    url: url || null,
    ...result
  });
});

app.get('/search', (req, res) => {
  const q = req.query.q || '';
  res.json({ query: q, results: [], message: 'Stub search endpoint' });
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
