# Contributing (two-person hackathon)

**Unofficial Paytm AI hackathon prototype** (Ek Photo Dukaan). Not affiliated with or endorsed by Paytm. Do not commit `.env` files, API keys, or production credentials.

GitHub: [https://github.com/icvasu/paytm-ek-photo-dukaan](https://github.com/icvasu/paytm-ek-photo-dukaan) (private). Owner account: **icvasu**.

Product docs: `merchant-app/docs/` — start with [V0.md](merchant-app/docs/V0.md), [ARCHITECTURE.md](merchant-app/docs/ARCHITECTURE.md), [TEAM.md](merchant-app/docs/TEAM.md), [DEMO.md](merchant-app/docs/DEMO.md).

---

## Clone (person 2)

Ask the owner to add you as a collaborator, then:

```bash
gh auth status
# Expect github.com user you were invited with — not a random extra account.

git clone https://github.com/icvasu/paytm-ek-photo-dukaan.git
cd paytm-ek-photo-dukaan
git fetch origin
git checkout staging
git pull origin staging
```

Work from **`staging`**, not a stale local `main`.

---

## Branches

| Branch | Role |
| --- | --- |
| `main` | **Stable demo.** Default branch. Only merge when the judged walkthrough works. |
| `staging` | **Shared integration.** Both people merge here first. |
| `feature/...` | Individual work. **Branch off `staging`.** Examples: `feature/dukaan-capture`, `feature/dukaan-share-qr`. |

```bash
git checkout staging
git pull origin staging
git checkout -b feature/your-slice
# ... commits ...
git push -u origin feature/your-slice
```

Open a PR **into `staging`**. When staging is demo-ready:

```bash
git checkout main
git pull origin main
git merge staging   # or GitHub PR staging → main
git push origin main
```

Do not force-push `main` or `staging`. Do not rewrite history on shared branches.

---

## Run the app

Node 20+ recommended. From repo root:

```bash
cd merchant-app
npm install
npm run dev
```

Open the Vite URL (typically `http://localhost:5173`). One process serves the React UI and the in-memory REST API.

```bash
npm run build   # typecheck + production frontend (API is dev-only)
```

Do not commit `node_modules/`, `dist/`, or secrets (see `.gitignore`).

---

## What to read vs what to ignore

- **Build this:** Ek Photo Dukaan (one-photo catalog V0) inside `merchant-app/`.
- **Ignore for the demo:** `Paytm_QR_Rakshak_Winning_Strategy.md` — different concept.

If someone else has uncommitted files in your shared folder, **do not discard them** (`git checkout --`, `git reset --hard`) without asking.
