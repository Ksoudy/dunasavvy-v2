# DunaSavvy — Deploy to GitHub Pages

The blue **"Food, Smarter"** landing page is a Create-React-App site. This repo ships two deploy paths:

## Path A — Automatic (recommended)

`.github/workflows/deploy-pages.yml` builds `frontend/` on every push to `main` and publishes the build output to GitHub Pages.

**One-time setup:**

1. In GitHub → your repo → **Settings → Pages**:
   - **Source**: *GitHub Actions*
   - **Custom domain** (optional): `dunasavvy.com` (A record `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`; or CNAME to `<user>.github.io`)
2. **Settings → Secrets and variables → Actions → New repository secret**:
   - Name: `BACKEND_URL`
   - Value: the URL of your deployed FastAPI backend (see "Backend deployment" below). Example: `https://api.dunasavvy.com` or `https://dunasavvy-api.onrender.com`
3. Push to `main`. The workflow builds and publishes automatically.

The site appears at `https://<user>.github.io/<repo>/` (or your custom domain).

## Path B — Manual (`/docs` folder on `main`)

The pre-built static output is also committed to `/docs/` so you can deploy without Actions:

1. **Settings → Pages → Source**: *Deploy from a branch*
2. **Branch**: `main` | **Folder**: `/docs`
3. Save. The `/docs/` folder already contains `index.html`, `static/…`, `.nojekyll`, and `CNAME`.

To refresh manually after code changes:

```bash
cd frontend
yarn install
REACT_APP_BACKEND_URL=https://your-backend.example.com yarn build
rm -rf ../docs && cp -r build/. ../docs/
touch ../docs/.nojekyll
echo "dunasavvy.com" > ../docs/CNAME      # remove if no custom domain
git add docs && git commit -m "deploy: refresh static site" && git push
```

## Backend deployment (required for live data)

GitHub Pages is static-only. The dashboard calls these endpoints:

- `GET  /api/demo-comparison`
- `POST /api/demo-comparison?scenario=…`
- `POST /api/search`
- `GET  /api/demo-fuzzy-match`
- `GET  /api/scraper-health`

The FastAPI backend (`/backend/server.py`) must be deployed somewhere reachable and its URL plugged into `REACT_APP_BACKEND_URL` at build time.

**Cheapest known-good hosts for this backend:**

| Host | Notes |
|---|---|
| Render | Free tier, auto-deploys from GitHub, persistent MongoDB add-on |
| Railway | $5/mo hobby, one-click FastAPI + Mongo |
| Fly.io | Free VM, bring-your-own Mongo (Atlas free tier works) |
| Your VPS | Any Linux box with `uvicorn server:app --host 0.0.0.0 --port 8001` behind Caddy/nginx |

Required env vars on the backend host: `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS` (set to your Pages origin), `EMERGENT_LLM_KEY`.

## File layout at the repo root

```
.
├─ .github/workflows/deploy-pages.yml   # CI build & deploy
├─ docs/                                # pre-built static site (Path B)
│  ├─ index.html
│  ├─ .nojekyll
│  ├─ CNAME
│  └─ static/
├─ frontend/                            # React source (built by CI)
├─ backend/                             # FastAPI — deploy elsewhere
├─ extension/                           # Chrome MV3 — load unpacked
└─ DEPLOY.md                            # this file
```

## Path audit

The build emits **relative** URLs (`./static/js/main.*.js`, `./static/css/main.*.css`) because `"homepage": "."` is set in `frontend/package.json`. This works under both a subpath (`user.github.io/repo`) and a custom domain root.

No other internal links exist in `index.html`. Fonts are fetched at runtime from `fonts.googleapis.com` (no permission needed).
