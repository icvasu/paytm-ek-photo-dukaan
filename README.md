# Paytm Ek Photo Dukaan (hackathon prototype)

Unofficial local prototype for the Paytm AI hackathon theme **AI for Small Businesses**. Not affiliated with or endorsed by Paytm. Does not use real Paytm APIs or production credentials.

## Run the merchant app

```bash
cd merchant-app
npm install
npm run dev
```

Open the Vite URL (typically `http://localhost:5173`).

## Branch convention

| Branch | Purpose |
|--------|---------|
| `main` | Release / demo-stable. Default branch. |
| `staging` | Shared WIP for both teammates. Integrate here first. |
| `feature/...` | Individual work. Branch off `staging` (e.g. `feature/dukaan-capture`). |

Open PRs into `staging`; promote `staging` → `main` when the demo is stable.

## Repo layout

- `merchant-app/` — Vite + React merchant demo
- Briefs and strategy docs at the repo root (Markdown + PDF)
- `research/` — supporting research HTML/PDF
