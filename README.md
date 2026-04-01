# EE538 Project 2 - Lecture Assistant

Chrome extension + backend for webpage/video summary demo.

## Folders
- `extension/` - Chrome extension UI and extraction scripts
- `backend/` - Node backend (easy default)
- `cpp-backend/` - C++ backend (now supports `/summarize-text`)
- `cpp-worker/` - C++ worker starter

## Quick Start (Node backend)
```bash
cd backend
npm install
npm start
```

## Quick Start (C++ backend on Windows)
```bat
cd cpp-backend
build.bat
server.exe
```

## Load Extension
1. Open `chrome://extensions`
2. Turn on Developer mode
3. Click **Load unpacked**
4. Select `extension/`

## Use
- Open a webpage
- Open extension popup
- Click **Summarize Current Page**
- Output box shows summary text only

## API
- `GET /health`
- `POST /summarize-text`
- `POST /jobs`
- `GET /jobs/:id`

## Notes
- Some protected video sites may block extraction
- If `Failed to fetch`, make sure backend is running on `http://localhost:3000`
