const API_BASE = 'http://localhost:3000';

async function summarizeText(payload) {
  const res = await fetch(`${API_BASE}/summarize-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Summarize failed: ${res.status}`);
  return res.json();
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'ping' });
    return;
  } catch (_) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  }
}

async function extractFromPage() {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error('No active tab found');

  if (!tab.url || !/^https?:/i.test(tab.url)) {
    throw new Error('Open a normal http/https webpage first (not chrome:// or extension pages).');
  }

  await ensureContentScript(tab.id);
  const response = await chrome.tabs.sendMessage(tab.id, { type: 'extract_content' });
  if (!response?.ok) throw new Error(response?.error || 'Extraction failed');
  return response.data;
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

async function runJob(file) {
  const status = document.getElementById('status');
  const result = document.getElementById('result');
  result.value = '';

  try {
    status.textContent = 'Submitting...';

    let job;
    if (file) {
      job = await submitJob(file);
    } else {
      const res = await fetch(`${API_BASE}/jobs`, { method: 'POST' });
      if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
      job = await res.json();
    }

    const { jobId } = job;
    status.textContent = `Job ${jobId} submitted. Processing...`;

    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const j = await getJob(jobId);
      if (j.status === 'done') {
        status.textContent = 'Done.';
        result.value = JSON.stringify(j.result, null, 2);
        return;
      }
      if (j.status === 'failed') {
        status.textContent = 'Failed.';
        result.value = j.error || 'Unknown error';
        return;
      }
      status.textContent = `Processing... (${j.status})`;
    }

    status.textContent = 'Still processing. Check backend logs.';
  } catch (e) {
    status.textContent = 'Error.';
    result.value = e.message;
  }
}

document.getElementById('submitBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('file');
  if (!fileInput.files.length) {
    document.getElementById('status').textContent = 'Please choose a file first.';
    return;
  }
  await runJob(fileInput.files[0]);
});

document.getElementById('demoBtn').addEventListener('click', async () => {
  await runJob(null);
});

document.getElementById('extractBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const result = document.getElementById('result');
  result.value = '';

  try {
    status.textContent = 'Extracting page content...';
    const extracted = await extractFromPage();

    status.textContent = 'Summarizing extracted content...';
    const summarized = await summarizeText({
      title: extracted.title,
      url: extracted.url,
      transcript: extracted.transcriptCandidate,
      pageText: extracted.pageText
    });

    status.textContent = `Done. Videos found: ${extracted.videoCount}`;
    result.value = JSON.stringify({ extractedMeta: {
      title: extracted.title,
      url: extracted.url,
      videoCount: extracted.videoCount,
      tracks: extracted.tracks,
      transcriptLineCount: extracted.transcriptLineCount,
      transcriptPreview: extracted.transcriptPreview
    }, summary: summarized }, null, 2);
  } catch (e) {
    status.textContent = 'Error.';
    result.value = e.message;
  }
});
