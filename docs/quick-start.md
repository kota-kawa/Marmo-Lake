# Quick Start

## Docker Compose

```bash
docker compose up --build
```

Open `http://localhost:8080`.

Runtime data is stored in the `marmo-data` Docker volume.

## Local Development

### 1. Install

```bash
npm install
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cd ../..
```

### 2. Run

```bash
npm run dev
```

Open `http://127.0.0.1:5173`.

### 3. First Setup

Create:

- workspace name
- first admin name
- admin password
- scene template
- optional AI provider

AI can be skipped and configured later.
