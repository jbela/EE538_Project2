# EE538 Project 2 - Lecture Assistant

A Chrome extension + local backend that summarizes webpage lecture content.

## Folders
- `extension/` - Chrome extension UI and page extraction
- `backend/` - Node.js API for summarize and job endpoints
- `cpp-backend/`, `cpp-worker/` - optional C++ starter code

## Quick Start
### 1) Start backend
```bash
cd backend
npm install
npm start
```

### 2) Load extension
- Open `chrome://extensions`
- Enable Developer mode
- Click **Load unpacked**
- Select `extension/`

### 3) Use it
- Open a webpage
- Open the extension popup
- Click **Summarize Current Page**
- Output box shows summary text

## API
- `GET /health`
- `POST /summarize-text`
- `POST /jobs`
- `GET /jobs/:id`

## Notes
- Best results on pages with readable text/transcript content
- Some protected video sites may block extraction
- If `Failed to fetch`, check backend is running on `http://localhost:3000`
