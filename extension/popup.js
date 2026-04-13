const API_BASE = 'http://localhost:3000';

/**
 * Local demo only — must match LIBRARY_API_KEY in web/.env. Do not publish this extension
 * with a real secret; anyone can read extension source.
 */
const DEMO_LIBRARY_BASE = 'http://localhost:3001';
const DEMO_LIBRARY_KEY = 'ee538-local-demo-library-key';

const $ = (id) => document.getElementById(id);

/** Last summarized source (page or file) for export metadata. */
let lastSourceMeta = { title: '', url: '', transcript: '' };

function setStatus(text) {
  $('status').textContent = text;
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'ping' });
  } catch (_) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  }
}

async function submitJob(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/jobs`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
  return res.json();
}

async function getJob(id) {
  const res = await fetch(`${API_BASE}/jobs/${id}`);
  if (!res.ok) throw new Error(`Status failed: ${res.status}`);
  return res.json();
}

async function summarizeText(payload) {
  const res = await fetch(`${API_BASE}/summarize-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Summarize failed: ${res.status}`);
  return res.json();
}

async function runFileSummary() {
  const fileInput = $('file');
  if (!fileInput.files.length) {
    setStatus('Please choose a file first.');
    return;
  }

  const file = fileInput.files[0];
  $('result').value = '';
  setStatus('Submitting file...');

  const { jobId } = await submitJob(file);

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const job = await getJob(jobId);

    if (job.status === 'done') {
      const summary = job?.result?.summary || 'No summary returned.';
      $('result').value = summary;
      const fn = job?.input?.filename || file.name;
      lastSourceMeta = { title: fn || 'Uploaded media', url: '', transcript: '' };
      setStatus('Done.');
      return;
    }

    if (job.status === 'failed') {
      throw new Error(job.error || 'Job failed.');
    }

    setStatus(`Processing... (${job.status})`);
  }

  throw new Error('Timed out while waiting for job result.');
}

async function runPageSummary() {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error('No active tab found.');

  if (!tab.url || !/^https?:/i.test(tab.url)) {
    throw new Error('Open a regular http/https page first.');
  }

  setStatus('Extracting page content...');
  await ensureContentScript(tab.id);
  const response = await chrome.tabs.sendMessage(tab.id, { type: 'extract_content' });

  if (!response?.ok) {
    throw new Error(response?.error || 'Extraction failed.');
  }

  setStatus('Summarizing...');
  const d = response.data || {};
  const summarized = await summarizeText({
    title: d.title,
    url: d.url,
    transcript: d.transcriptCandidate,
    pageText: d.pageText
  });

  $('result').value = summarized?.summary || 'No summary returned.';
  lastSourceMeta = {
    title: (d.title || d.h1 || 'Web page').trim() || 'Web page',
    url: d.url || '',
    transcript: d.transcriptCandidate || '',
  };
  setStatus('Done.');
}

function clearOutput() {
  $('result').value = '';
  lastSourceMeta = { title: '', url: '', transcript: '' };
  setStatus('Idle. Waiting for your action.');
}

async function loadLibrarySettings() {
  const { libraryBaseUrl, libraryToken } = await chrome.storage.local.get([
    'libraryBaseUrl',
    'libraryToken',
  ]);
  $('libraryBaseUrl').value = libraryBaseUrl || DEMO_LIBRARY_BASE;
  $('libraryToken').value = libraryToken || DEMO_LIBRARY_KEY;
}

async function saveLibrarySettings() {
  const libraryBaseUrl = ($('libraryBaseUrl').value || '').trim() || DEMO_LIBRARY_BASE;
  const libraryToken = ($('libraryToken').value || '').trim() || DEMO_LIBRARY_KEY;
  await chrome.storage.local.set({ libraryBaseUrl, libraryToken });
  setStatus('Library settings saved.');
}

async function exportToLibrary() {
  const summary = ($('result').value || '').trim();
  if (!summary) {
    setStatus('Summarize something first, then export.');
    return;
  }

  const token = ($('libraryToken').value || '').trim() || DEMO_LIBRARY_KEY;
  let base = ($('libraryBaseUrl').value || '').trim() || DEMO_LIBRARY_BASE;
  base = base.replace(/\/$/, '');

  const courseLabel = ($('courseLabel').value || '').trim();
  const topic = ($('topic').value || '').trim();
  const title = (lastSourceMeta.title || 'Untitled summary').trim() || 'Untitled summary';

  setStatus('Exporting to library...');

  const body = {
    title,
    summary,
    kind: 'summary',
    ...(lastSourceMeta.transcript ? { transcript: lastSourceMeta.transcript } : {}),
    ...(lastSourceMeta.url ? { sourceUrl: lastSourceMeta.url } : {}),
    ...(courseLabel ? { courseLabel } : {}),
    ...(topic ? { topic } : {}),
  };

  const res = await fetch(`${base}/api/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Export failed (${res.status})`);
  }

  setStatus(`Exported: ${title}`);
}

function appendChatMessage(role, text) {
  const box = $('chatBox');
  const msg = document.createElement('div');
  msg.className = `chat-msg ${role}`;
  msg.textContent = text;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
}

function handleChatSend() {
  const input = $('chatInput');
  const text = (input.value || '').trim();
  if (!text) return;

  appendChatMessage('user', text);
  input.value = '';

  const placeholderReply = $('result').value
    ? 'No LLM connected yet.'
    : 'No LLM: summarize first.';

  setTimeout(() => {
    appendChatMessage('assistant', placeholderReply);
  }, 250);
}

$('file').addEventListener('change', () => {
  const f = $('file').files?.[0];
  const name = f ? f.name : 'No file selected';
  $('fileName').textContent = name;
});

$('uploadBtn').addEventListener('click', async () => {
  try {
    await runFileSummary();
  } catch (err) {
    setStatus('Error.');
    $('result').value = err.message;
  }
});

$('extractBtn').addEventListener('click', async () => {
  try {
    $('result').value = '';
    await runPageSummary();
  } catch (err) {
    setStatus('Error.');
    $('result').value = err.message;
  }
});

$('clearBtn').addEventListener('click', clearOutput);

loadLibrarySettings().catch(() => {});

$('saveLibraryBtn').addEventListener('click', async () => {
  try {
    await saveLibrarySettings();
  } catch (err) {
    setStatus('Error saving settings.');
    $('result').value = err.message;
  }
});

$('exportLibraryBtn').addEventListener('click', async () => {
  try {
    await exportToLibrary();
  } catch (err) {
    setStatus('Export failed.');
    $('result').value = err.message;
  }
});
$('chatSendBtn').addEventListener('click', handleChatSend);
$('chatInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleChatSend();
});
