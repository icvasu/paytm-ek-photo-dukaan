# Paytm Ek Photo Dukaan (hackathon prototype)

Unofficial local prototype for the Paytm AI hackathon theme **AI for Small Businesses**. **Not affiliated with or endorsed by Paytm.** Does not use real Paytm APIs or production credentials. Visible in-app labelling should stay **PROTOTYPE**.

**One-line:** Photograph the shelf or printed rate card once; get an editable price list, QR/share, and restock hints on top of the Paytm-style merchant shell the shop already uses.

## Person 2 — start here

1. [CONTRIBUTING.md](CONTRIBUTING.md) — clone **icvasu/paytm-ek-photo-dukaan**, branches, `npm install && npm run dev`
2. [merchant-app/docs/V0.md](merchant-app/docs/V0.md) — problem, kirana user, one-photo scope, judge script
3. [merchant-app/docs/ARCHITECTURE.md](merchant-app/docs/ARCHITECTURE.md) — photo → VisionService → catalog → QR/share/restock
4. [merchant-app/docs/TEAM.md](merchant-app/docs/TEAM.md) — who owns what
5. [merchant-app/docs/DEMO.md](merchant-app/docs/DEMO.md) — 8–12 step walkthrough

North-star brief (two photos + payment decomposition): [`Paytm_Ek_Photo_Dukaan_Brief.md`](Paytm_Ek_Photo_Dukaan_Brief.md). **V0 is the one-photo slice.** QR Rakshak strategy markdown is a **separate** idea — do not mix into this demo.

## Run

```bash
cd merchant-app
npm install
npm run dev
```

Open `http://localhost:5173` (Vite). Details: [`merchant-app/README.md`](merchant-app/README.md).

## Branches

| Branch | Purpose |
|--------|---------|
| `main` | Stable judged demo |
| `staging` | Shared integration — **branch features off this** |
| `feature/...` | Individual work; PR into `staging` |

## Repo layout

- `merchant-app/` — Vite + React merchant demo
- `merchant-app/docs/` — teammate V0 / architecture / demo / team
- Briefs at repo root (Markdown + PDF)
- `research/` — supporting research (if present)
