function normalize(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function looksLikeTimestamp(s) {
  return /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(s);
}

function parseTimestampToSeconds(s) {
  // Matches H:MM:SS or M:SS at the start of a string like "0:42 So today..."
  const m = String(s).match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\b/);
  if (!m) return null;
  const h = m[1] ? parseInt(m[1], 10) : 0;
  const mm = parseInt(m[2], 10);
  const ss = parseInt(m[3], 10);
  return h * 3600 + mm * 60 + ss;
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

/**
 * Extract video metadata AND timestamped cue segments from any <video> element
 * on the page. Cue timestamps come for free from the browser's TextTrack API
 * — we just need to actually keep them this time.
 *
 * Returns { videoCount, tracks, cueSegments: [{text, startTime, endTime}] }
 */
function getVideoInfo() {
  const videos = [...document.querySelectorAll('video')];
  const videoCount = videos.length;
  const tracks = [];
  const cueSegments = [];

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
          const cue = cues[j];
          const text = normalize(cue.text || '');
          if (!text) continue;
          cueSegments.push({
            text,
            startTime: Number(cue.startTime) || 0,
            endTime: Number(cue.endTime) || 0
          });
        }
      }
    } catch (_) {}
  }

  return { videoCount, tracks, cueSegments };
}

/**
 * Extract Zoom/Loom-style transcript lines from the DOM. These pages often
 * render lines like "0:42 So today we'll be covering..." — we try to peel
 * the leading timestamp off into a real startTime.
 *
 * Returns { lines: string[], segments: [{text, startTime}] }
 */
function extractZoomLikeTranscript(maxLines = 2000) {
  const selectors = [
    '[data-testid*="transcript"] *',
    '[class*="transcript"] *',
    '[class*="caption"] *',
    '[aria-live] *',
    '[role="log"] *'
  ];

  const lines = [];
  const segments = [];
  const seen = new Set();

  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      const t = normalize(el.innerText || el.textContent || '');
      if (!t || t.length < 2) continue;
      if (isUiNoise(t)) continue;
      if (!(looksLikeTimestamp(t) || /[a-zA-Z]{3,}.+[.?!]?$/.test(t))) continue;

      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      lines.push(t);

      // Try to peel a leading "M:SS" or "H:MM:SS" off the line so the
      // downstream LLM has a real timestamp to cite.
      const seconds = parseTimestampToSeconds(t);
      if (seconds !== null) {
        const stripped = t.replace(/^(?:\d{1,2}:)?\d{1,2}:\d{2}\s+/, '').trim();
        if (stripped) {
          segments.push({ text: stripped, startTime: seconds, endTime: seconds });
        }
      }

      if (lines.length >= maxLines) break;
    }
    if (lines.length >= maxLines) break;
  }

  return { lines, segments };
}

/**
 * Synthesize fake-but-monotonic segments from a flat block of body text.
 * Used as a last-resort so the chat endpoint still has *something* to cite,
 * roughly proportional to position in the article. ~3 words per "second" is
 * a reasonable speaking-rate proxy.
 */
function syntheticSegmentsFromBodyText(text, wordsPerSecond = 2.5) {
  const sentences = String(text || '').split(/(?<=[.!?])\s+/).filter(Boolean);
  const segs = [];
  let elapsed = 0;
  for (const sent of sentences) {
    const words = sent.split(/\s+/).length;
    const duration = Math.max(2, Math.round(words / wordsPerSecond));
    segs.push({
      text: sent.trim(),
      startTime: elapsed,
      endTime: elapsed + duration
    });
    elapsed += duration;
  }
  return segs;
}

function extractPageText(maxChars = 80000) {
  const title = document.title || '';
  const url = location.href;
  const h1 = document.querySelector('h1')?.innerText?.trim() || '';

  const mainEl = document.querySelector('main, article, [role="main"], .content, .lecture, .player, body');
  let bodyText = normalize(mainEl?.innerText || document.body?.innerText || '');
  if (bodyText.length > maxChars) bodyText = bodyText.slice(0, maxChars);

  const video = getVideoInfo();
  const dom = extractZoomLikeTranscript();

  // Pick the best transcript source we have, in priority order.
  let transcriptCandidate = '';
  let segments = [];
  let segmentSource = 'none';

  if (video.cueSegments.length > 0) {
    segments = video.cueSegments;
    transcriptCandidate = segments.map((s) => s.text).join(' ');
    segmentSource = 'video-cues';
  } else if (dom.segments.length > 0) {
    segments = dom.segments;
    transcriptCandidate = segments.map((s) => s.text).join(' ');
    segmentSource = 'dom-transcript';
  } else if (dom.lines.length > 0) {
    transcriptCandidate = dom.lines.join(' ');
    segments = syntheticSegmentsFromBodyText(transcriptCandidate);
    segmentSource = 'dom-lines-synthetic';
  } else {
    transcriptCandidate = bodyText;
    segments = syntheticSegmentsFromBodyText(bodyText);
    segmentSource = 'body-synthetic';
  }

  return {
    title,
    h1,
    url,
    videoCount: video.videoCount,
    tracks: video.tracks,
    transcriptLineCount: dom.lines.length,
    transcriptPreview: dom.lines.slice(0, 8),
    transcriptCandidate,
    segments,
    segmentSource,
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
