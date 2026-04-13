# EE538 Project 2 - Lecture Assistant

A **Chrome extension** + **Node summarize backend** + **Next.js web library** for saving summaries, uploads, and notes locally. Uses a shared access key (no OAuth) — suitable for class demos on your machine.

---

## Prerequisites

Install these before the first run:

| Tool | Why |
|------|-----|
| **Node.js 20+** (includes `npm`) | Backend, web app, Prisma |
| **Google Chrome** (or Chromium) | Extension |
| **Docker Desktop** (recommended) | Local PostgreSQL via `docker compose` |

If you cannot use Docker, you need **PostgreSQL** running somewhere and a valid `DATABASE_URL` in `web/.env`.

---

## First-time installation (clone → running demo)

Do these steps **once** after cloning the repository.

### 1. Start PostgreSQL

From the **repository root** (folder that contains `docker-compose.yml`):

```bash
docker compose up -d
```

Wait until the container is healthy. Default database: `lecture_library`, user/password `postgres`/`postgres`, port **5432**.

- **No Docker?** Create a database and set `DATABASE_URL` in `web/.env` to your connection string (see `web/.env.example`).

### 2. Configure the web app environment

```bash
cd web
copy .env.example .env
```

On macOS/Linux use `cp .env.example .env` instead of `copy`.

Edit **`web/.env`**:

- **`DATABASE_URL`** — keep the default if you used Docker Compose as above.
- **`LIBRARY_API_KEY`** — pick any secret string for local demo. It **must match** `DEMO_LIBRARY_KEY` in `extension/popup.js` if you want the extension to work without pasting a key (the repo ships with both set to `ee538-local-demo-library-key`).
- **`LIBRARY_COOKIE_SECRET`** — any second random string (only used to sign the browser cookie). Example: `openssl rand -hex 32` (Git Bash / WSL / macOS).

### 3. Install web dependencies and apply database migrations

Still inside **`web/`**:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

`migrate deploy` creates/updates tables. Run it again after `git pull` if new migrations were added.

### 4. Install and run the summarize backend

Open a **new terminal**, from the **repository root**:

```bash
cd backend
npm install
npm start
```

Leave this running. The API listens on **`http://localhost:3000`**.

**Optional — better summaries:** create `backend/.env` with `OPENAI_API_KEY=...` (and optionally `OPENAI_MODEL`). Without it, the backend uses a simple heuristic summarizer.

### 5. Load the Chrome extension

1. Open Chrome → go to **`chrome://extensions`**
2. Turn **Developer mode** **ON** (top right)
3. Click **Load unpacked**
4. Choose the **`extension`** folder inside this repo (e.g. `...\EE538_Project2\extension`)

Reload the extension after you `git pull` if files changed.

### 6. Start the web app

In **`web/`** (another terminal):

```bash
npm run dev
```

The site runs at **`http://localhost:3001`**.

---

## Every time you run the demo

Start these **three** pieces (three terminals is easiest):

| Order | Where | Command |
|-------|--------|---------|
| 1 | Repo root | `docker compose up -d` (if Postgres is not already running) |
| 2 | `backend/` | `npm start` → port **3000** |
| 3 | `web/` | `npm run dev` → port **3001** |

Then use Chrome with the loaded extension.

---

## Quick test (end-to-end)

1. **`http://localhost:3001`** → **Unlock library** → enter `LIBRARY_API_KEY` from `web/.env`.
2. Open any normal **http/https** article page → extension popup → **Summarize Current Page** (backend must be on **3000**).
3. **Export to Library** in the popup (web app on **3001**; default URL/key match the demo constants in `extension/popup.js` unless you changed them).
4. In the web app: **Library** → see the item; try **Add materials** for a file or text note.

---

## Extension-only (summaries, no web library)

If you only want summarizing:

```bash
cd backend
npm install
npm start
```

Load the extension as above. You do **not** need Postgres or `web/` for this path.

---

## Folders

- **`extension/`** — Chrome UI, page extraction, export to library
- **`backend/`** — Express API: `http://localhost:3000` (`/summarize-text`, `/jobs`, …)
- **`web/`** — Next.js library UI: `http://localhost:3001`
- **`cpp-backend/`**, **`cpp-worker/`** — optional C++ starter code (not required for the demo above)

---

## API reference

### Summarize backend (`:3000`)

- `GET /health`
- `POST /summarize-text`
- `POST /jobs` — file upload job
- `GET /jobs/:id`

### Web app (`:3001`)

- `GET` / `POST /api/items` — extension (`Authorization: Bearer <LIBRARY_API_KEY>`) or browser session after login
- `POST /api/items/upload` — file upload (session cookie)
- `POST /api/items/note` — text note JSON (session cookie)
- `DELETE /api/items/[id]` — delete item and any stored file
- `GET /api/files/[id]` — download uploaded file (same auth as library)

Uploaded files are stored under **`web/uploads/`** (gitignored).

---

## Troubleshooting

| Problem | What to check |
|---------|----------------|
| **`Failed to fetch`** in extension when summarizing | `backend` running on **3000**; page is normal http/https |
| **Web app: column does not exist / Prisma errors** | In **`web/`**: `npx prisma migrate deploy` |
| **Cannot connect to database** | `docker compose up -d`; `DATABASE_URL` in `web/.env` matches Postgres |
| **Export to library 401** | `LIBRARY_API_KEY` in `web/.env` matches the extension **Access key** (or `DEMO_LIBRARY_KEY` in `popup.js`) |
| **Blank summaries** | Page has little text; or set `OPENAI_API_KEY` in `backend/.env` |

---

## Security notes (demo only)

- **Do not commit** `web/.env` or `backend/.env` — they are ignored by `web/.gitignore` for `web/`; keep API keys out of Git.
- The hardcoded demo key in **`extension/popup.js`** is **public** if you push the repo — fine for **localhost**; change it (and `LIBRARY_API_KEY`) before any real deployment.

---

## Notes

- Best summarization when the page has readable text or transcript-like content.
- Some video sites block extraction.
- Web stack: **Prisma 7** + `@prisma/adapter-pg` + **PostgreSQL**.
