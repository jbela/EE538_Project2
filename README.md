# EE538 Project2 — C++-First Lecture Summary Starter

You asked for C++ wherever possible. This scaffold is now **C++-first**:

- `extension/` — Chrome extension UI (**must be JS/HTML** due to browser platform rules)
- `cpp-backend/` — C++ HTTP API server (job endpoints)
- `cpp-worker/` — C++ worker placeholder

## Important constraint
Browser extensions cannot be written purely in C++. Chrome extension logic must be JavaScript/HTML/CSS.  
So we keep extension code in JS, and move backend/processing to C++.

## Run C++ Backend

### Option A: MSVC (Visual Studio Developer Command Prompt)
```bat
cd cpp-backend
build.bat
server.exe
```

### Option B: CMake
```bash
cd cpp-backend
cmake -S . -B build
cmake --build build --config Release
./build/Release/server.exe
```

Server starts on: `http://localhost:3000`

## If no C++ toolchain is available (presentation fallback)
Use the Node stub backend so you can still demo end-to-end:
```bash
cd backend
npm install
node server.js
```

## Extension
Load `extension/` in `chrome://extensions` (Developer mode -> Load unpacked).

## 2-minute presentation demo flow
1. Start backend (C++ preferred; Node fallback works now).
2. Open extension popup on a lecture/video webpage.
3. Click **Extract This Page (No Recording)**.
4. Show extracted metadata + summary/topics/notes.
5. Backup path: click **Run Demo Sample**.

## Direct website content extraction (no manual recording)
- The extension reads page text and available `<video>` subtitle/cue data directly.
- It sends extracted text to `POST /summarize-text` for fast summarization.
- Works best on pages with visible text/subtitles.
- DRM-protected or heavily obfuscated players may not expose transcript content.

## API (MVP)
- `GET /health`
- `POST /jobs` (stub create job)
- `GET /jobs/{id}`
- `GET /search?q=...`
