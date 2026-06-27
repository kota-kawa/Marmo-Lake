# Marmo Lake

Marmo Lake is a local-first workspace for shops, classrooms, and small teams.

V1 focuses on one practical job: create a staff home screen on a local PC, then open work links, notes, manuals/files, checklists, announcements, and AI help from one place.

## Quick Start

```bash
npm install
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cd ../..
npm run dev
```

Open `http://127.0.0.1:5173`.

The API runs on `http://127.0.0.1:8000`.

## V1 Scope

- Initial setup with first admin password
- Staff home screen
- Admin lock
- Work app URL registration
- Embedded or external work app launch
- Notes and handover memos
- Important announcements
- Checklists
- File cabinet for PDF, images, and text files
- AI provider settings for OpenAI-compatible APIs and Ollama
- Basic AI chat
- Registered AI Actions
- Settings export without secrets

Not included in V1: PWA, Kiosk, QR invite, multi-user roles, full search, forms, Static Local App, Local Web App Runner, restore.

## Commands

```bash
npm run dev          # API + Web
npm run dev:api      # FastAPI only
npm run dev:web      # Vite only
npm run build        # frontend production build
npm run test:api     # backend tests
npm test             # frontend tests
```

## Data

Local data is stored under `data/` by default:

- `data/marmo.db`
- `data/uploads/`
- `data/backups/`
- `data/secret.key`

Do not commit this directory's runtime contents.

## Documentation

- [Quick Start](docs/quick-start.md)
- [First Workspace Guide](docs/first-workspace-guide.md)
- [Staff Guide](docs/staff-guide.md)
- [Admin Guide](docs/admin-guide.md)
- [AI Settings](docs/ai-settings.md)
- [Security Guide](docs/security-guide.md)
- [Custom Local Web App Guide](docs/custom-local-web-app-guide.md)

