const $ = (id) => document.getElementById(id);

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

function setStatus(text) {
  $('status').textContent = text;
}

function appendLog(text) {
  const box = $('result');
  const prefix = box.value ? '\n\n' : '';
  box.value += `${prefix}${text}`;
}

async function queueUploadOnly() {
  const fileInput = $('file');
  if (!fileInput.files.length) {
    setStatus('Please choose a file first.');
    return;
  }

  const file = fileInput.files[0];
  setStatus('Upload queued (framework mode, no backend call).');
  appendLog([
    '[Upload Queued]',
    `Name: ${file.name}`,
    `Type: ${file.type || 'unknown'}`,
    `Size: ${file.size} bytes`,
    'Next step: connect backend endpoint in popup.js'
  ].join('\n'));
}

async function extractPageFrameworkOnly() {
  try {
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

    const d = response.data || {};
    setStatus('Extraction complete (framework mode).');

    appendLog(JSON.stringify({
      mode: 'framework-only',
      title: d.title,
      url: d.url,
      videoCount: d.videoCount,
      transcriptLineCount: d.transcriptLineCount,
      transcriptPreview: d.transcriptPreview,
      note: 'Summarization is intentionally not executed yet.'
    }, null, 2));
  } catch (err) {
    setStatus('Error.');
    appendLog(`[Error]\n${err.message}`);
  }
}

function clearOutput() {
  $('result').value = '';
  setStatus('Idle. Waiting for your action.');
}

$('uploadBtn').addEventListener('click', queueUploadOnly);
$('extractBtn').addEventListener('click', extractPageFrameworkOnly);
$('clearBtn').addEventListener('click', clearOutput);
