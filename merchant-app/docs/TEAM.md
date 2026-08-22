# Team — two people on this repo

Git workflow lives in the repo-root **[CONTRIBUTING.md](../../CONTRIBUTING.md)** (clone, `main` / `staging`, feature branches, `npm install && npm run dev`).

## Split of work (suggested)

| Person | Own this | Do not stomp |
| --- | --- | --- |
| A | Demo API, store sync, vision adapter, insights restock rule | `App.tsx` layout unless agreed |
| B | Capture / editor / public dukaan / Home CTA / share+QR chrome | `demoApi.ts` catalog contract without a chat |

Talk before changing `src/types/models.ts` — that is the shared schema.

## Reading order for person 2

1. This file + root `CONTRIBUTING.md`
2. [V0.md](./V0.md) — what we will demo
3. [ARCHITECTURE.md](./ARCHITECTURE.md) — where to plug in
4. [DEMO.md](./DEMO.md) — click path
5. `merchant-app/README.md` — existing payments shell
6. Root `Paytm_Ek_Photo_Dukaan_Brief.md` — north star (two photos). V0 is the one-photo slice.

QR Rakshak markdown is **reference only**. Not this submission.

## Conventions

- Visible **PROTOTYPE** / unofficial Paytm labelling stays.
- Stock is a **range or flag**, never a fake integer.
- Demo vision must work with **no API keys**.
- Feature branches off **`staging`**, PRs into **`staging`**, promote to **`main`** when the judged demo is stable.
