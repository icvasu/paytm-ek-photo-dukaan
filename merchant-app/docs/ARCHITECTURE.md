# Architecture — photo → catalog → QR / share / restock

**Unofficial prototype.** Local Vite app + in-memory demo API. Not official Paytm infrastructure.

This document is for a second engineer: where to plug UI, what is replaceable, what not to invent twice.

---

## System sketch

```text
Browser (React, hash routes, mobile-width shell)
  App.tsx  ──Zustand──  useMerchantStore.ts
       │                      │ persist: paytm-merchant-demo-v*
       │                      │ syncFromApi() on boot
       │                      ▼
       │              fetch /api/*
       │                      │
VisionService                 │
  analyze(file meta)          │
  DemoVisionService now       │
  RealVisionService later     │
       │                      │
       ▼                      ▼
 VisionResult          Vite plugin: server/demoApi.ts
 (items, confidence,     in-memory db = buildSeed()
  readingNote,           authority for catalog + payments
  sourceKind)
       │
       └── POST /api/catalog ──► DukaanCatalog
                                    ├─ GET /api/catalog        (merchant)
                                    ├─ GET /api/dukaan/:slug   (share payload)
                                    ├─ POST item mutate/add/remove
                                    └─ buildInsights(db) includes catalog restock

PaytmService (ApiPaytmService) ──► POST /api/payments, settlements, refunds
IntelligenceEngine (rules)     ──► GET /api/insights + client generate()
domain/metrics.ts              ──► dashboard numbers (do not duplicate in UI)
```

**Authority:** the demo API’s in-memory `db` is source of truth for catalog mutations. Zustand mirrors it and also persists to `localStorage` so the UI survives a refresh. **Reset** hits `POST /api/reset` and re-seeds; catalog starts as `null`. Dev-server restart also wipes API memory — UI persist can look “ahead” until `syncFromApi` runs.

---

## Vertical slice (V0)

1. **Input** — one image (camera or file). Prefer printed shelf / rate card. Seeded filenames trigger high-confidence lists (see Vision).
2. **VisionService.analyze** — returns `VisionResult`. No payment side effects.
3. **Catalog creation** — the vision result is saved through `createCatalog` → `POST /api/catalog`, then the merchant reviews and edits API-authoritative fields.
4. **Catalog** — `DukaanCatalog` (`src/types/models.ts`): slug `meena-kirana`, items with `pricePaise`, `stockFlag` (`in_stock` | `low` | `out`), `stockLabel` as a **range string**.
5. **Customer list** — hash route `/#/dukaan/:slug` should render the same items (read-only). Payload also at `GET /api/dukaan/:slug`.
6. **QR / share** — reuse `qrcode.react` (already used on My QR). Share text is a WhatsApp `wa.me` draft, not Cloud API send.
7. **Restock** — `src/intelligence/engine.ts` `buildInsights`: if catalog exists, surface unavailable/low items and count how many item prices appear as successful **ticket amounts**. Hint only.

---

## Where the code lives

| Concern | File | Contract |
| --- | --- | --- |
| Vision adapter | `src/services/vision/VisionService.ts` | `analyze({ fileName, fileSize, imageType })` |
| DI / payments / insights | `src/services/container.ts` | Exports `paytmService` and `intelligenceEngine`; demo vision is imported directly by the capture route. |
| Catalog + payments UI state | `src/store/useMerchantStore.ts` | `createCatalog`, `updateCatalogItem`, `addCatalogItem`, `removeCatalogItem`, `syncFromApi`, `resetDemo` |
| HTTP demo backend | `server/demoApi.ts` | Vite middleware; catalog + dukaan GET/POST |
| Seeded merchant | `src/data/seed.ts` | Meena Kirana, `catalog: null` |
| Insights | `src/intelligence/engine.ts` | `buildInsights` (API) / `ruleBasedIntelligence.generate` (client) |
| Metrics | `src/domain/metrics.ts` | Sales, tickets, hours — keep as SSoT |
| Paytm adapter | `src/services/paytm/PaytmService.ts` | Mock processor; `ApiPaytmService` calls REST |
| Shell | `src/App.tsx` | Existing merchant routes plus capture, editor and customer price-list routes in the same app |

### Catalog REST (demo)

- `GET /api/catalog` — merchant catalog or `null`
- `GET /api/dukaan/:slug` — public-ish price list JSON (`404` if slug mismatch)
- `POST /api/catalog` — body: `VisionResult & { sourceImageName }`
- `POST /api/catalog/items` — append blank line
- `POST /api/catalog/items/:id` — patch name / pricePaise / available
- `POST /api/catalog/items/:id/remove`

Plus existing payments/settlements/notifications/insights/reset. Full list: `merchant-app/README.md`.

---

## Demo vision vs real vision

**Now — `DemoVisionService`**

- Artificial delay (~350ms).
- **Does not read pixels.** Uses `fileName` (and size as a weak fallback).
- `counter` / `rate` / `tea` → tea-counter list (chai, samosa, Thums Up, …).
- `meena` / `shelf` / `kirana` → Meena shelf list (Tata Salt, atta, Thums Up, Amul, …).
- Anything else → shorter **starter** list, `confidence: 'starter'`, `sourceKind: 'upload'`, explicit “could not reliably read” note.

**Later — `RealVisionService` (same interface)**

- Compress image, POST to an approved model endpoint (env-gated).
- Must return the same `VisionResult` shape: items, `confidence`, `readingNote`, `sourceKind`.
- Cache by image hash for the judged demo so Wi-Fi failure is invisible.
- Merchant edits remain authoritative after the model returns.
- Never authorize payment, never claim exact stock from one frame.
- Keep secrets and raw images **off** the client if you add a key; V0 has no keys.

Feature-flag idea: `import.meta.env.VITE_VISION_MODE=demo|real`. Default demo so `npm run dev` works offline.

---

## Paytm and WhatsApp (honest)

| Action | V0 | Later |
| --- | --- | --- |
| Collect / QR pay | Simulated `PaytmService` + seeded stream | Staging payment-link if the event gives credentials |
| Restock | Insight card only | Pre-filled Paytm vendor pay + WhatsApp order draft (brief photo 2) |
| WhatsApp | `wa.me` with prefilled catalog/order text | Cloud API only if credentials exist; still not “WhatsApp Payments” |

If you swapped Paytm for another PSP, both the **sensor** (amounts) and the **reorder action** disappear. Keep that in the pitch.

---

## UI routes

Existing: `/#/`, `/#/payments`, `/#/collect`, `/#/qr`, `/#/business`, `/#/customers`, `/#/settlements`, `/#/insights`, `/#/notifications`, `/#/search`, `/#/profile`.

Implemented (separate from the merchant's payment QR route):

- `/#/dukaan/scan` — sample or image upload and demo-vision disclosure
- `/#/dukaan/manage` — editable merchant catalog, restock hint, share QR/link
- `/#/dukaan/:slug` — read-only customer price list (slug `meena-kirana`)

Home has one **Ek Photo Dukaan** shortcut, under the **More for your business** heading below the sales hero, the Collect / My QR pair and the settlement balance; the Business tab carries the same entry. Profile → **Advanced** → **Reset to sample data** clears the catalog with the rest of the seeded state.

---

## What not to rebuild

- Do not add a second state store for catalog.
- Do not compute dashboard totals in React; use `deriveDashboard`.
- Do not train or fake a learning curve on stage.
- Do not merge QR-missing-payment (Rakshak) into this flow.
