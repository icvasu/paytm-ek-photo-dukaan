# Contributing (two-person hackathon)

**Unofficial Paytm AI hackathon prototype** (Ek Photo Dukaan). Not affiliated with or endorsed by Paytm.

GitHub: [icvasu/paytm-ek-photo-dukaan](https://github.com/icvasu/paytm-ek-photo-dukaan).  
Owner: **icvasu**. Teammate: **@Jaiaggarwaaaaal** (write).

Do not commit `.env` files, API keys, tokens, or production credentials.

---

## Clone

```bash
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
| `main` | **Stable judged demo.** Default branch. Merge here only when the walkthrough in `merchant-app/docs/DEMO.md` works. |
| `staging` | **Shared integration.** Both people land work here first. |
| `feature/…` | Individual work. **Always branch off `staging`.** |

```bash
git checkout staging
git pull origin staging
git checkout -b feature/your-slice
# …commits…
git push -u origin feature/your-slice
```

Open a PR **into `staging`**. When staging is demo-ready, promote **and push both**:

```bash
git checkout main
git pull origin main
git merge staging
git push origin main
git checkout staging
git merge main
git push origin staging
```

Keep `main` and `staging` at the same SHA after a promote so the teammate who uses `staging` is not left behind.

**Never force-push `main` or `staging`.** Never rewrite shared history. Never change global git config in this folder.

If someone else has uncommitted files in a shared working tree, **do not discard them** (`git checkout --`, `git reset --hard`) without asking.

---

## Run

Node 20+ recommended.

```bash
cd merchant-app
npm install
npm run dev      # http://127.0.0.1:5173 — UI + demo API
npm run build
npm run lint
npm test
```

Do not commit `node_modules/`, `dist/`, `.vercel/`, `.gstack/`, or secrets (see `.gitignore`).

---

## What to build vs ignore

- **Build this:** Ek Photo Dukaan inside `merchant-app/`.
- **North star:** `Paytm_Ek_Photo_Dukaan_Brief.md`.
- **Before promoting to `main`:** the walkthrough in `merchant-app/docs/DEMO.md` works, `npm test` and `npm run build` pass, and `node server/verifyJudgePath.mjs` is 40/40.

Talk before changing `merchant-app/src/types/models.ts` — that is the shared schema.
