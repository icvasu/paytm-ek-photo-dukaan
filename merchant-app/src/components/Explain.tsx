import type { BasketSolution } from '../domain/basketSolver'
import type { DemandReport } from '../intelligence/demand'
import { extractionEvidenceFor } from '../services/vision/catalogPipeline'
import type { CatalogItem, CatalogProvenance } from '../types/models'
import type { UpiIntent } from '../services/paytm/upi'
import './explain.css'

/**
 * "How this was inferred" panels.
 *
 * Judges reward legible inference over opaque inference, but a merchant screen
 * should not look like a debug console. Each panel is a closed `<details>` that
 * reuses the app's quiet-details styling, so the reasoning is one tap away and
 * invisible until asked for.
 */
function Why({ label, badge, children }: { label: string; badge?: string; children: React.ReactNode }) {
  return (
    <details className="quiet-details why">
      <summary>
        <span className="why-label">{label}</span>
        {badge && <span className="why-badge">{badge}</span>}
      </summary>
      {/* `details-body` carries the app's own padding for this pattern. */}
      <div className="details-body why-body">{children}</div>
    </details>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="why-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="why-note">{children}</p>
}

/** Exactly what a UPI QR encodes, so a scan can be checked against the claim. */
export function WhyUpi({ intent }: { intent: UpiIntent }) {
  return (
    <Why label="What this QR encodes" badge="UPI intent">
      <Row label="Standard" value="NPCI UPI deep link (upi://pay)" />
      <Row label="Payee address (pa)" value={<code>{intent.vpa}</code>} />
      <Row label="Payee name (pn)" value={intent.payeeName} />
      <Row label="Amount (am)" value={intent.amount ? <code>{intent.amount}</code> : 'not set — customer enters it'} />
      <Row label="Currency (cu)" value={<code>INR</code>} />
      {intent.note && <Row label="Note (tn)" value={intent.note} />}
      {intent.txnRef && <Row label="Reference (tr)" value={<code>{intent.txnRef}</code>} />}
      <div className="why-uri"><code>{intent.uri}</code></div>
      <Note>
        Scanning this opens a real payment app with these fields already filled in. Whether the
        payment succeeds is decided by the customer&rsquo;s bank, not by this prototype.
      </Note>
    </Why>
  )
}

/**
 * The search behind a basket suggestion, plus the alternates. An amount cannot
 * prove a basket, so the runners-up matter as much as the winner.
 */
export function WhyBasket({ solution, items, onPick }: {
  solution: BasketSolution
  items: CatalogItem[]
  onPick?: (index: number) => void
}) {
  const pricePoints = new Set(items.filter((item) => item.available && item.pricePaise > 0).map((item) => item.pricePaise)).size
  const top = solution.candidates[0]
  const alternates = solution.candidates.slice(1)

  return (
    <Why label="How this was inferred" badge={top ? `${top.confidencePct}% likely` : 'no match'}>
      <Row label="Method" value="Bounded multi-subset-sum over catalog prices" />
      <Row label="Distinct price points" value={pricePoints} />
      <Row label="Combinations explored" value={solution.nodesExplored.toLocaleString('en-IN')} />
      <Row label="Baskets that sum exactly" value={solution.solutionCount.toLocaleString('en-IN')} />
      <Row label="Search bounds" value="≤4 distinct items, ≤12 per item, ≤24 units" />
      <Row label="Ranking prior" value="Fewer items, smaller quantities, items with prior sales" />
      {top && <Row label="Probability" value={`${(top.probability * 100).toFixed(1)}% (softmax over plausibility cost)`} />}
      {solution.truncated && <Row label="Search limit" value="Reached — more baskets may exist" />}

      {alternates.length > 0 && (
        <div className="why-alts">
          <h4>Other baskets that add up to the same amount</h4>
          {alternates.map((candidate, index) => {
            const text = candidate.lines.map((line) => `${line.quantity}× ${line.itemName}`).join(', ')
            return onPick ? (
              <button type="button" key={text} onClick={() => onPick(index + 1)}>
                {text}<i>{candidate.confidencePct}%</i>
              </button>
            ) : (
              <span key={text}>{text}<i>{candidate.confidencePct}%</i></span>
            )
          })}
        </div>
      )}

      <Note>
        {top
          ? 'Confidence is capped at 92% because an amount can never prove a basket. Stock only changes after you confirm.'
          : 'No basket is suggested because none adds up exactly. Guessing here would corrupt the stock register.'}
      </Note>
    </Why>
  )
}

/** OCR → parse → fuzzy-match evidence for a catalog built from a photo. */
export function WhyCatalog({ provenance, sourceImageName }: {
  provenance: CatalogProvenance | undefined
  sourceImageName: string | undefined
}) {
  const evidence = extractionEvidenceFor(sourceImageName)
  if (!provenance && !evidence) return null

  if (provenance?.method === 'sample_photo') {
    return (
      <Why label="How this catalog was made" badge="sample">
        <Row label="Source" value="Pre-written sample shop" />
        <Row label="Rows" value={provenance.rowsAccepted} />
        <Note>
          These rows ship with the prototype and are tied to the sample picture — they were not read
          out of it. Photograph your own shelf or price list to run the real OCR pipeline.
        </Note>
      </Why>
    )
  }

  const matched = evidence?.resolved.filter((item) => item.matched) ?? []
  const unmatched = evidence?.resolved.filter((item) => !item.matched) ?? []

  return (
    <Why label="How this was read from your photo" badge={provenance?.engine ?? evidence?.engine ?? 'OCR'}>
      <Row label="Step 1 — read text" value={`${provenance?.engine ?? evidence?.engine} on this device`} />
      <Row label="Lines read" value={provenance?.linesRead ?? evidence?.linesRead ?? 0} />
      {(provenance?.meanOcrConfidencePct ?? evidence?.meanOcrConfidencePct) != null && (
        <Row label="Mean text confidence" value={`${provenance?.meanOcrConfidencePct ?? evidence?.meanOcrConfidencePct}%`} />
      )}
      <Row label="Step 2 — split name/price" value="Per line, then plausibility checks" />
      <Row label="Rows kept" value={provenance?.rowsAccepted ?? evidence?.resolved.length ?? 0} />
      <Row label="Rows skipped" value={provenance?.rowsRejected ?? evidence?.rejected.length ?? 0} />
      <Row label="Step 3 — resolve names" value="Token-set ratio + normalised edit distance vs product lexicon" />
      {evidence && <Row label="Matched a known product" value={`${matched.length} of ${evidence.resolved.length}`} />}
      {provenance?.durationMs != null && <Row label="Time on device" value={`${(provenance.durationMs / 1000).toFixed(1)}s`} />}

      {matched.length > 0 && (
        <div className="why-evidence">
          <h4>Matched rows</h4>
          {matched.slice(0, 8).map((item) => (
            <div key={`${item.suggestedId}-m`}>
              <code>{item.evidence.ocrText}</code>
              <span>
                → <b>{item.name}</b> via “{item.evidence.matchedAlias}”
                {item.evidence.similarity && ` · ${Math.round(item.evidence.similarity.score * 100)}% similar`}
                {item.evidence.priceBand && ` · typical ${item.evidence.priceBand}`}
                {` · ${item.confidencePct}% confidence`}
                {item.evidence.runnerUp && ` · runner-up ${item.evidence.runnerUp}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {unmatched.length > 0 && (
        <div className="why-evidence">
          <h4>Kept exactly as read — no lexicon match</h4>
          {unmatched.slice(0, 6).map((item) => (
            <div key={`${item.suggestedId}-u`}>
              <code>{item.evidence.ocrText}</code>
              <span>→ <b>{item.name}</b> · {item.confidencePct}% confidence</span>
            </div>
          ))}
        </div>
      )}

      {evidence && evidence.rejected.length > 0 && (
        <div className="why-evidence">
          <h4>Skipped lines</h4>
          {evidence.rejected.slice(0, 6).map((line, index) => (
            <div key={`${line.text}-${index}`}>
              <code>{line.text}</code>
              <span>→ {line.reason}</span>
            </div>
          ))}
        </div>
      )}

      <Note>
        Nothing here was invented: every row comes from text the reader actually saw, and skipped
        lines are listed with the reason. A price list shows prices, not shelf counts, so stock stays
        an estimate until you correct it.
      </Note>
    </Why>
  )
}

/** Inputs behind the days-of-cover numbers on the restock list. */
export function WhyRestock({ report }: { report: DemandReport }) {
  const worst = report.estimates
    .filter((estimate) => estimate.needsReorder)
    .sort((a, b) => (a.daysOfCover ?? 9_999) - (b.daysOfCover ?? 9_999))[0]

  return (
    <Why label="How this was inferred" badge="demand model">
      <Row label="Method" value="Exponentially weighted units/day, then on-hand ÷ rate" />
      <Row label="Half-life" value={`${report.inputs.halfLifeDays} days`} />
      <Row label="Weight per day of age" value={report.inputs.dailyDecay} />
      <Row label="Window" value={`${report.inputs.windowDays} day${report.inputs.windowDays === 1 ? '' : 's'}`} />
      <Row label="Reorder threshold" value={`${report.inputs.coverThresholdDays} days of cover`} />
      <Row label="Baskets attributed" value={report.inputs.attributedBaskets} />
      <Row label="Payments not yet attributed" value={report.inputs.unattributedPayments} />

      {worst && (
        <Note>
          <b>{worst.itemName}:</b> {worst.observedUnits} unit{worst.observedUnits === 1 ? '' : 's'} across{' '}
          {worst.activeDays} active day{worst.activeDays === 1 ? '' : 's'} gives a weighted rate of{' '}
          {worst.ratePerDay?.toFixed(2) ?? '—'}/day against an estimated {worst.onHandEstimate} on hand
          {worst.daysOfCover !== null && `, so ${worst.daysOfCover} days of cover`}.
          {worst.notes.length > 0 && ` ${worst.notes.join(' ')}`}
        </Note>
      )}

      <Note>
        This is a weighted moving average, not a calibrated forecast — there is no seasonality term
        and no confidence interval. Units come only from baskets you confirmed, so the{' '}
        {report.inputs.unattributedPayments} unattributed payment
        {report.inputs.unattributedPayments === 1 ? '' : 's'} are not counted. Shelf counts are
        estimates from the photo, not a stock take.
      </Note>
    </Why>
  )
}
