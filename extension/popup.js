const API_BASE = 'http://localhost:3000';

/**
 * Local demo only — must match LIBRARY_API_KEY in web/.env. Do not publish this extension
 * with a real secret; anyone can read extension source.
 */
const DEMO_LIBRARY_BASE = 'http://localhost:3001';
const DEMO_LIBRARY_KEY = 'ee538-local-demo-library-key';

const $ = (id) => document.getElementById(id);

/** Last summarized source — used for export and as context for chat. */
let lastSourceMeta = {
  title: '',
  url: '',
  transcript: '',
  segments: [], // [{text, startTime, endTime}]
  tabId: null    // remembered so citations can drive the source video
};

/** Running chat history sent to /chat each turn. */
let chatHistory = []; // [{role: 'user'|'assistant', content: string}]

/** GET /api/library/taxonomy — course pickers in Export section */
let taxonomyCourses = [];
let taxonomyTopicsByCourse = {};

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

// ---------- Backend calls ----------

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

async function callChat(messages) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      title: lastSourceMeta.title || undefined,
      transcript: lastSourceMeta.transcript || undefined,
      segments: lastSourceMeta.segments?.length ? lastSourceMeta.segments : undefined
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Chat failed: ${res.status}`);
  }
  return res.json();
}

// ---------- Citation rendering ----------

function formatSeconds(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}

/**
 * Click handler for a [t=SEC] citation. Tries to seek the source tab's video
 * to that timestamp; if that's not feasible (cross-origin video, no <video>
 * element, source tab closed), opens the source URL with ?t=SEC appended.
 */
async function jumpToTimestamp(seconds) {
  const sec = Math.max(0, Math.round(Number(seconds) || 0));

  if (lastSourceMeta.tabId) {
    try {
      const tab = await chrome.tabs.get(lastSourceMeta.tabId);
      if (tab) {
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (t) => {
            const v = document.querySelector('video');
            if (v) {
              try { v.currentTime = t; v.play?.(); } catch (_) {}
            }
          },
          args: [sec]
        });
        return;
      }
    } catch (_) {
      // Tab gone — fall through to URL-based jump.
    }
  }

  if (lastSourceMeta.url) {
    const sep = lastSourceMeta.url.includes('?') ? '&' : '?';
    const url = `${lastSourceMeta.url}${sep}t=${sec}s`;
    chrome.tabs.create({ url });
  }
}

/**
 * Render text containing [t=SEC] markers into a DOM fragment with clickable
 * citation chips. Other text is preserved as plain text.
 */
function renderTextWithCitations(text, container) {
  container.replaceChildren();

  const parts = String(text || '').split(/(\[t=\d+(?:\.\d+)?\])/g);
  for (const part of parts) {
    const m = part.match(/^\[t=(\d+(?:\.\d+)?)\]$/);
    if (m) {
      const sec = Number(m[1]);
      const link = document.createElement('a');
      link.href = '#';
      link.className = 'citation';
      link.textContent = formatSeconds(sec);
      link.title = `Jump to ${formatSeconds(sec)}`;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        jumpToTimestamp(sec);
      });
      container.appendChild(link);
    } else if (part) {
      container.appendChild(document.createTextNode(part));
    }
  }
}

// ---------- Page summary flow ----------

async function runFileSummary() {
  const fileInput = $('file');
  if (!fileInput.files.length) {
    setStatus('Please choose a file first.');
    return;
  }

  const file = fileInput.files[0];
  $('result').value = '';
  renderTextWithCitations('', $('resultRich'));
  setStatus('Submitting file...');

  const { jobId } = await submitJob(file);

  // Whisper jobs can take a while — extend the polling window.
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const job = await getJob(jobId);

    if (job.status === 'done') {
      const summary = job?.result?.summary || 'No summary returned.';
      const segments = job?.result?.segments || [];
      const fn = job?.input?.filename || file.name;

      $('result').value = summary;
      renderTextWithCitations(summary, $('resultRich'));

      lastSourceMeta = {
        title: fn || 'Uploaded media',
        url: '',
        transcript: segments.map((s) => s.text).join(' '),
        segments,
        tabId: null
      };
      chatHistory = [];
      $('chatBox').replaceChildren();

      const segCount = segments.length;
      setStatus(segCount
        ? `Done. ${segCount} timestamped segments — ask the chat anything.`
        : 'Done.');
      return;
    }

    if (job.status === 'failed') {
      throw new Error(job.error || 'Job failed.');
    }

    setStatus(`Processing... (${job.stage || job.status})`);
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

  if (!response?.ok) throw new Error(response?.error || 'Extraction failed.');
  const d = response.data || {};

  setStatus('Summarizing...');
  const summarized = await summarizeText({
    title: d.title,
    url: d.url,
    transcript: d.transcriptCandidate,
    pageText: d.pageText,
    segments: d.segments
  });

  const summary = summarized?.summary || 'No summary returned.';
  $('result').value = summary;
  renderTextWithCitations(summary, $('resultRich'));

  lastSourceMeta = {
    title: (d.title || d.h1 || 'Web page').trim() || 'Web page',
    url: d.url || '',
    transcript: d.transcriptCandidate || '',
    segments: Array.isArray(d.segments) ? d.segments : [],
    tabId: tab.id
  };
  chatHistory = [];
  $('chatBox').replaceChildren();

  const segCount = lastSourceMeta.segments.length;
  setStatus(segCount
    ? `Done. Source: ${d.segmentSource || 'unknown'} (${segCount} segments).`
    : 'Done.');
}

function clearOutput() {
  $('result').value = '';
  renderTextWithCitations('', $('resultRich'));
  lastSourceMeta = { title: '', url: '', transcript: '', segments: [], tabId: null };
  chatHistory = [];
  $('chatBox').replaceChildren();
  setStatus('Idle. Waiting for your action.');
}

// ---------- Library export ----------

async function loadLibrarySettings() {
  const { libraryBaseUrl, libraryToken } = await chrome.storage.local.get([
    'libraryBaseUrl',
    'libraryToken'
  ]);
  $('libraryBaseUrl').value = libraryBaseUrl || DEMO_LIBRARY_BASE;
  $('libraryToken').value = libraryToken || DEMO_LIBRARY_KEY;
}

async function saveLibrarySettings() {
  const libraryBaseUrl = ($('libraryBaseUrl').value || '').trim() || DEMO_LIBRARY_BASE;
  const libraryToken = ($('libraryToken').value || '').trim() || DEMO_LIBRARY_KEY;
  await chrome.storage.local.set({ libraryBaseUrl, libraryToken });
  setStatus('Library settings saved.');
  await refreshTaxonomy();
}

function populateCourseSelect() {
  const sel = $('courseSelect');
  const previous = sel.value;
  sel.innerHTML = '<option value="">— Pick an existing class —</option>';
  for (const c of taxonomyCourses) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  }
  const typed = ($('courseLabel').value || '').trim();
  if (previous && taxonomyCourses.includes(previous)) {
    sel.value = previous;
  } else if (typed && taxonomyCourses.includes(typed)) {
    sel.value = typed;
  }
}

function syncTopicSelectForCourse() {
  const c = ($('courseLabel').value || '').trim();
  const topics = (c && taxonomyTopicsByCourse[c]) || [];
  const sel = $('topicSelect');
  const previous = sel.value;
  sel.innerHTML = '<option value="">— Pick an existing topic —</option>';
  for (const t of topics) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  }
  const typedTopic = ($('topic').value || '').trim();
  if (previous && topics.includes(previous)) {
    sel.value = previous;
  } else if (typedTopic && topics.includes(typedTopic)) {
    sel.value = typedTopic;
  }
}

async function refreshTaxonomy(options = {}) {
  const silent = options.silent === true;
  const token = ($('libraryToken').value || '').trim() || DEMO_LIBRARY_KEY;
  let base = ($('libraryBaseUrl').value || '').trim() || DEMO_LIBRARY_BASE;
  base = base.replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/api/library/taxonomy`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    taxonomyCourses = Array.isArray(data.courses) ? data.courses : [];
    taxonomyTopicsByCourse =
      data.topicsByCourse && typeof data.topicsByCourse === 'object' ? data.topicsByCourse : {};
    populateCourseSelect();
    syncTopicSelectForCourse();
    if (!silent) setStatus('Class and topic lists loaded from library.');
  } catch (e) {
    taxonomyCourses = [];
    taxonomyTopicsByCourse = {};
    populateCourseSelect();
    syncTopicSelectForCourse();
    const msg = e instanceof Error ? e.message : String(e);
    setStatus(`Could not load class lists: ${msg}`);
  }
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
    ...(topic ? { topic } : {})
  };

  const res = await fetch(`${base}/api/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Export failed (${res.status})`);
  }

  setStatus(`Exported: ${title}`);
}

// ---------- Chat ----------

function appendChatMessage(role, text) {
  const box = $('chatBox');
  const msg = document.createElement('div');
  msg.className = `chat-msg ${role}`;
  // Render assistant replies with clickable [t=SEC] citations.
  if (role === 'assistant') {
    renderTextWithCitations(text, msg);
  } else {
    msg.textContent = text;
  }
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
}

async function handleChatSend() {
  const input = $('chatInput');
  const text = (input.value || '').trim();
  if (!text) return;

  if (!lastSourceMeta.transcript && !lastSourceMeta.segments?.length) {
    appendChatMessage('assistant', 'Summarize a page or upload a file first so I have context.');
    return;
  }

  appendChatMessage('user', text);
  input.value = '';
  chatHistory.push({ role: 'user', content: text });

  // Optimistic placeholder while we wait.
  const box = $('chatBox');
  const thinking = document.createElement('div');
  thinking.className = 'chat-msg assistant thinking';
  thinking.textContent = 'Thinking...';
  box.appendChild(thinking);
  box.scrollTop = box.scrollHeight;

  try {
    const { reply } = await callChat(chatHistory);
    thinking.remove();
    appendChatMessage('assistant', reply || '(empty reply)');
    chatHistory.push({ role: 'assistant', content: reply || '' });
  } catch (err) {
    thinking.remove();
    appendChatMessage('assistant', `Error: ${err.message}`);
  }
}

// ---------- Wire up ----------

$('file').addEventListener('change', () => {
  const f = $('file').files?.[0];
  $('fileName').textContent = f ? f.name : 'No file selected';
});

$('uploadBtn').addEventListener('click', async () => {
  try { await runFileSummary(); }
  catch (err) { setStatus('Error.'); $('result').value = err.message; }
});

$('extractBtn').addEventListener('click', async () => {
  try { $('result').value = ''; await runPageSummary(); }
  catch (err) { setStatus('Error.'); $('result').value = err.message; }
});

$('clearBtn').addEventListener('click', clearOutput);

loadLibrarySettings()
  .then(() => refreshTaxonomy({ silent: true }))
  .catch(() => {});

$('courseSelect').addEventListener('change', () => {
  const v = $('courseSelect').value;
  if (v) $('courseLabel').value = v;
  syncTopicSelectForCourse();
});

$('courseLabel').addEventListener('input', () => {
  const typed = ($('courseLabel').value || '').trim();
  const sel = $('courseSelect');
  if (!typed) {
    sel.value = '';
  } else if (taxonomyCourses.includes(typed)) {
    sel.value = typed;
  } else {
    sel.value = '';
  }
  syncTopicSelectForCourse();
});

$('topicSelect').addEventListener('change', () => {
  const v = $('topicSelect').value;
  if (v) $('topic').value = v;
});

$('topic').addEventListener('input', () => {
  const typed = ($('topic').value || '').trim();
  const c = ($('courseLabel').value || '').trim();
  const topics = (c && taxonomyTopicsByCourse[c]) || [];
  const sel = $('topicSelect');
  if (!typed) {
    sel.value = '';
  } else if (topics.includes(typed)) {
    sel.value = typed;
  } else {
    sel.value = '';
  }
});

$('refreshTaxonomyBtn').addEventListener('click', async () => {
  try {
    await refreshTaxonomy();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'Refresh failed.');
  }
});

$('saveLibraryBtn').addEventListener('click', async () => {
  try { await saveLibrarySettings(); }
  catch (err) { setStatus('Error saving settings.'); $('result').value = err.message; }
});

$('exportLibraryBtn').addEventListener('click', async () => {
  try { await exportToLibrary(); }
  catch (err) { setStatus('Export failed.'); $('result').value = err.message; }
});

$('chatSendBtn').addEventListener('click', handleChatSend);
$('chatInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleChatSend();
  }
});
