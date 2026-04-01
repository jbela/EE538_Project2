const API_BASE = 'http://localhost:3000';
const $ = (id) => document.getElementById(id);

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
  setStatus('Done.');
}

function clearOutput() {
  $('result').value = '';
  setStatus('Idle. Waiting for your action.');
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
