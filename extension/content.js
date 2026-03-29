function normalize(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function looksLikeTimestamp(s) {
  return /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(s);
}

function isUiNoise(line) {
  const l = line.toLowerCase();
  const bad = [
    'skip to main content',
    'accessibility overview',
    'who can see your viewing activity',
    'loaded:',
    'speed',
    'only play highlights',
    'audio transcript',
    'download',
    'share',
    'settings'
  ];
  return bad.some(k => l.includes(k));
}

function getVideoInfo() {
  const videos = [...document.querySelectorAll('video')];
  const videoCount = videos.length;
  const tracks = [];
  const cueTexts = [];

  for (const v of videos) {
    for (const t of [...v.querySelectorAll('track')]) {
      tracks.push({
        kind: t.kind || '',
        srclang: t.srclang || '',
        label: t.label || '',
        src: t.src || ''
      });
    }

    try {
      const tts = v.textTracks || [];
      for (let i = 0; i < tts.length; i++) {
        const tt = tts[i];
        const cues = tt.cues || [];
        for (let j = 0; j < cues.length; j++) {
          const text = normalize(cues[j].text || '');
          if (text) cueTexts.push(text);
        }
      }
    } catch (_) {}
  }

  return { videoCount, tracks, cueTexts };
}

function extractZoomLikeTranscript(maxLines = 300) {
  const selectors = [
    '[data-testid*="transcript"] *',
    '[class*="transcript"] *',
    '[class*="caption"] *',
    '[aria-live] *',
    '[role="log"] *'
  ];

  const lines = [];
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      const t = normalize(el.innerText || el.textContent || '');
      if (!t || t.length < 2) continue;
      if (isUiNoise(t)) continue;
      // keep transcript-ish lines or sentence-like lines
      if (looksLikeTimestamp(t) || /[a-zA-Z]{3,}.+[.?!]?$/.test(t)) {
        lines.push(t);
      }
    }
  }

  // dedupe while keeping order
  const seen = new Set();
  const deduped = [];
  for (const l of lines) {
    const key = l.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(l);
    if (deduped.length >= maxLines) break;
  }

  return deduped;
}

function extractPageText(maxChars = 12000) {
  const title = document.title || '';
  const url = location.href;
  const h1 = document.querySelector('h1')?.innerText?.trim() || '';

  const mainEl = document.querySelector('main, article, [role="main"], .content, .lecture, .player, body');
  let bodyText = normalize(mainEl?.innerText || document.body?.innerText || '');
  if (bodyText.length > maxChars) bodyText = bodyText.slice(0, maxChars);

  const video = getVideoInfo();
  const domTranscriptLines = extractZoomLikeTranscript();

  let transcriptCandidate = '';
  if (video.cueTexts.length > 0) {
    transcriptCandidate = video.cueTexts.join(' ');
  } else if (domTranscriptLines.length > 0) {
    transcriptCandidate = domTranscriptLines.join(' ');
  } else {
    transcriptCandidate = bodyText;
  }

  return {
    title,
    h1,
    url,
    videoCount: video.videoCount,
    tracks: video.tracks,
    transcriptLineCount: domTranscriptLines.length,
    transcriptPreview: domTranscriptLines.slice(0, 8),
    transcriptCandidate,
    pageText: bodyText
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'ping') {
    sendResponse({ ok: true });
    return true;
  }

  if (msg?.type === 'extract_content') {
    try {
      const data = extractPageText();
      sendResponse({ ok: true, data });
    } catch (e) {
      sendResponse({ ok: false, error: e?.message || 'extract failed' });
    }
  }
  return true;
});

console.log('Lecture Summary content script loaded');
