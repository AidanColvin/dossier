# Deploying Dossier

Three short steps: put it on GitHub, run it, and (optionally) publish a public URL.

## 1. Put it on GitHub

This folder is already a git repository with full history, so you only need to
publish it. Pick one:

**GitHub Desktop (easiest, no token)**
1. Open GitHub Desktop → **File → Add Local Repository** → choose this folder.
2. Click **Publish repository**, uncheck "Keep this code private", → **Publish**.

**GitHub CLI**
```bash
gh auth login
gh repo create dossier --public --source=. --push
```

**Plain git + token**
Create an empty public repo named `dossier` on github.com (no README), then:
```bash
git remote add origin https://github.com/<your-username>/dossier.git
git push -u origin main
```
The token you authenticate with needs the **`repo`** and **`workflow`** scopes.

## 2. Run it locally

**Everything at once (Docker)**
```bash
docker compose up --build
# open http://localhost:3000
```

**Frontend only** — the dashboard works standalone (bundled demo data, no backend):
```bash
cd frontend
npm install
npm run dev            # http://localhost:3000
```

**Add the live backend** (so "Run live" hits the real APIs):
```bash
pip install -e ".[dev]"
uvicorn etl_pipeline.api.app:app --reload     # http://localhost:8000
```

Or just run `./run.sh` from the project root to start both.

## 3. Publish a public URL (Vercel)

1. Push to GitHub (step 1).
2. Go to **vercel.com → Add New → Project** → import the `dossier` repo.
3. Set **Root Directory = `frontend`** → **Deploy**.

The deployed site works for anyone with no backend, because the frontend ships
its own `/demo` and `/run` route handlers. To serve live data instead, deploy
the backend (Render picks up `render.yaml` automatically) and set
`NEXT_PUBLIC_API_URL` in Vercel to the backend's URL.
