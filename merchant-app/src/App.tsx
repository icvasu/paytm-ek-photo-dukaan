import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  HashRouter, NavLink, Route, Routes, useLocation, useNavigate, useParams,
} from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Banknote, Bell, BellRing, Building2, Camera, Check,
  ChevronRight, CircleAlert, CircleCheck, Clock3, Copy, Eye, Home, Image, IndianRupee,
  Info, Lightbulb, Link2, MapPin, MessageCircle, Minus, Package, Phone, Plus, QrCode,
  ReceiptText, RefreshCw, Search, Settings, Sparkles, Store, Trash2, TrendingDown,
  TrendingUp, Truck, Upload, Users, WalletCards, X,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import './App.css'
import './Dukaan.css'
import { useMerchantStore } from './store/useMerchantStore'
import { averageTicket, customerStats, dailySalesSeries, deriveDashboard, hourlyActivity, returningShare } from './domain/metrics'
import { intelligenceEngine } from './services/container'
import { formatINR } from './lib/money'
import { formatDayLabel, formatTime } from './lib/dates'
import type { PaymentMethod, Transaction } from './types/models'
import { buildDemandReport, buildStockForecasts } from './intelligence/engine'
import {
  NoTextFoundError, OcrUnavailableError, analyzePhoto, analyzeSample,
  loadSampleInvoice, sampleShopForCatalog, type OcrPhase,
} from './services/vision/catalogPipeline'
import { SAMPLE_SHOPS } from './services/vision/VisionService'
import { NoInvoiceFoundError, analyzeInvoicePhoto } from './services/vision/invoicePipeline'
import { solveBasket, unitsSoldBySku } from './domain/basketSolver'
import {
  collectIntent, merchantVpa, shopIntent, supportsUpiIntentLink, type UpiIntent,
} from './services/paytm/upi'
import { WhyBasket, WhyCatalog, WhyInvoice, WhyRestock, WhyUpi } from './components/Explain'
import type { BasketLine, CatalogItem, DukaanCatalog, SupplierProfile } from './types/models'

const methodName: Record<PaymentMethod, string> = {
  upi: 'UPI', paytm_wallet: 'Paytm Wallet', card: 'Card', netbanking: 'Net banking',
}

const statusLabel: Record<Transaction['status'], string> = {
  success: 'Received', pending: 'Processing', failed: 'Failed', refunded: 'Refunded',
}

/* -------------------------------------------------------------------------- */
/* Shared primitives                                                          */
/* -------------------------------------------------------------------------- */

/** Money always renders with tabular figures so amounts never shift width. */
function Money({ paise, className }: { paise: number; className?: string }) {
  return <span className={className ? `num ${className}` : 'num'}>{formatINR(paise)}</span>
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia(REDUCED_MOTION_QUERY).matches)
  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

interface ToastRequest {
  text: string
  tone?: 'success' | 'error' | 'info'
  action?: { label: string; run: () => void }
}

const ToastContext = createContext<(request: ToastRequest) => void>(() => undefined)
const useToast = () => useContext(ToastContext)

function ToastHost({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<(ToastRequest & { key: number }) | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((request: ToastRequest) => {
    window.clearTimeout(timer.current)
    setToast({ ...request, key: Date.now() })
    timer.current = window.setTimeout(() => setToast(null), request.action ? 6000 : 4000)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return <ToastContext.Provider value={show}>
    {children}
    <div className="toast-host" aria-live="polite" aria-atomic="true">
      {toast && <div className="toast" key={toast.key}>
        {toast.tone === 'error' ? <CircleAlert /> : <CircleCheck />}
        <span>{toast.text}</span>
        {toast.action && <button onClick={() => { toast.action?.run(); setToast(null) }}>{toast.action.label}</button>}
      </div>}
    </div>
  </ToastContext.Provider>
}

function useData() {
  const merchant = useMerchantStore((s) => s.merchant)
  const customers = useMerchantStore((s) => s.customers)
  const transactions = useMerchantStore((s) => s.transactions)
  const settlements = useMerchantStore((s) => s.settlements)
  const notifications = useMerchantStore((s) => s.notifications)
  const preferences = useMerchantStore((s) => s.preferences)
  const demoClock = useMerchantStore((s) => s.demoClock)
  const catalog = useMerchantStore((s) => s.catalog)
  const supplier = useMerchantStore((s) => s.supplier)
  const basketAssignments = useMerchantStore((s) => s.basketAssignments)
  const supplierOrders = useMerchantStore((s) => s.supplierOrders)
  return { merchant, customers, transactions, settlements, notifications, preferences, demoClock, catalog, supplier, basketAssignments, supplierOrders }
}

/**
 * App bar. The title is plain text rather than a heading element so that each
 * screen keeps exactly one <h1> in its main region.
 */
function PageHeader({ title, back, action, brand }: {
  title: string; back?: boolean; action?: React.ReactNode; brand?: boolean
}) {
  const navigate = useNavigate()
  return <header className="page-header">
    <div className="header-row">
      {back
        ? <button className="icon-btn on-navy" onClick={() => navigate(-1)} aria-label="Go back"><ArrowLeft /></button>
        : !brand && <span className="header-spacer" aria-hidden="true" />}
      {brand
        ? <div className="brand-mark"><span>pay</span><b>tm</b><small>for Business</small></div>
        : <div className="header-title">{title}</div>}
      {action ?? <span className="header-spacer" aria-hidden="true" />}
    </div>
  </header>
}

function Page({ children, className, centered }: { children: React.ReactNode; className?: string; centered?: boolean }) {
  return <main
    id="main"
    tabIndex={-1}
    className={['page', centered ? 'centered' : '', className ?? ''].filter(Boolean).join(' ')}
  >{children}</main>
}

function TransactionRow({ txn }: { txn: Transaction }) {
  const navigate = useNavigate()
  const statusIcon = txn.status === 'success' ? <Check /> : txn.status === 'pending' ? <Clock3 /> : <X />
  return <button className="txn-row" onClick={() => navigate(`/payments/${txn.id}`)}>
    <span className={`txn-icon ${txn.status}`} aria-hidden="true">{statusIcon}</span>
    <span className="txn-main">
      <strong>{txn.customerName}</strong>
      <small>{formatTime(txn.createdAt)} · {methodName[txn.paymentMethod]}</small>
    </span>
    <span className="txn-amount">
      <strong><Money paise={txn.amountPaise} /></strong>
      <small className={`status ${txn.status}`}>{statusLabel[txn.status]}</small>
    </span>
  </button>
}

function SectionTitle({ children, link, label = 'View all' }: { children: React.ReactNode; link?: string; label?: string }) {
  const navigate = useNavigate()
  return <div className="section-title">
    <h2>{children}</h2>
    {link && <button onClick={() => navigate(link)}>{label}<ChevronRight /></button>}
  </div>
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return <div className="skeleton-list" aria-hidden="true">
    {Array.from({ length: rows }, (_, index) => <div className="skeleton-row" key={index}>
      <div className="skeleton" /><div className="skeleton" />
    </div>)}
  </div>
}

function Sheet({ title, description, onClose, children }: {
  title: string; description?: string; onClose: () => void; children: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return <div className="sheet-backdrop" onClick={onClose}>
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
      <div className="sheet-grip" aria-hidden="true" />
      <div className="sheet-head">
        <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
        <button className="sheet-close" onClick={onClose} aria-label="Close"><X /></button>
      </div>
      {children}
    </div>
  </div>
}

/**
 * A real, scannable UPI intent QR.
 *
 * The encoded string is built by `services/paytm/upi`, so what a phone reads is
 * exactly what the caption says. When the payee is still the placeholder handle
 * the card says so out loud rather than implying a live merchant account.
 */
function UpiQr({ intent, size = 200, caption, showPayButton }: {
  intent: UpiIntent
  size?: number
  caption?: string
  showPayButton?: boolean
}) {
  const toast = useToast()
  const canOpenApp = showPayButton && supportsUpiIntentLink()
  return <section className="upi-qr">
    <div className="upi-qr-head">
      <span className="upi-qr-icon" aria-hidden="true"><QrCode /></span>
      <div>
        <b>{intent.payeeName}</b>
        <p>{intent.isStatic ? 'Scan and enter any amount' : `Scan to pay ${formatINR(Math.round(Number(intent.amount) * 100))}`}</p>
      </div>
    </div>
    <div className="upi-qr-wrap">
      <QRCodeSVG value={intent.uri} size={size} level="M" fgColor="#012b72" bgColor="#ffffff" />
    </div>
    <p className="upi-qr-vpa num">{intent.vpa}</p>
    {caption && <p className="upi-qr-caption">{caption}</p>}
    <div className="upi-qr-actions">
      {canOpenApp && <a className="upi-open" href={intent.uri}><WalletCards aria-hidden="true" />Open UPI app</a>}
      <button className="upi-copy" onClick={() => {
        void navigator.clipboard.writeText(intent.vpa)
          .then(() => toast({ text: 'UPI ID copied' }))
          .catch(() => toast({ text: 'Copy was blocked by the browser', tone: 'error' }))
      }}><Copy aria-hidden="true" />Copy UPI ID</button>
    </div>
    {intent.usesPlaceholderVpa && <p className="upi-qr-note">
      <Info aria-hidden="true" />
      This QR encodes a valid UPI request to a placeholder ID, so scanning opens your
      payment app but no money can move. Set a real UPI ID to accept payments.
    </p>}
    <WhyUpi intent={intent} />
  </section>
}

/* -------------------------------------------------------------------------- */
/* Home                                                                       */
/* -------------------------------------------------------------------------- */

function HomePage() {
  const data = useData()
  const dash = deriveDashboard(data)
  const insight = intelligenceEngine.generate(data)[0]
  const navigate = useNavigate()
  const unread = data.notifications.filter((n) => !n.read).length
  const hasCatalog = Boolean(data.catalog)
  return <>
    <PageHeader title="Home" brand action={<div className="header-actions">
      <button className="icon-btn on-navy" onClick={() => navigate('/search')} aria-label="Search payments and customers"><Search /></button>
      <button className="icon-btn on-navy bell-btn" onClick={() => navigate('/notifications')}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}>
        <Bell />{unread > 0 && <i aria-hidden="true">{unread}</i>}
      </button>
    </div>} />
    <Page className="home-page">
      <div className="welcome">
        <p>Good afternoon, {data.merchant.ownerName.split(' ')[0]}</p>
        <h1>Today’s business</h1>
      </div>

      <button className="dukaan-shortcut" onClick={() => navigate(hasCatalog ? '/dukaan/manage' : '/dukaan/scan')}>
        <span aria-hidden="true"><Camera /></span>
        <div>
          <small>Ek Photo Dukaan</small>
          <strong>{hasCatalog ? 'Your digital dukaan is live' : 'Turn one photo into your catalog'}</strong>
          <p>{hasCatalog
            ? `${data.catalog!.items.length} items · manage prices, QR and sharing`
            : 'Photo lo, dukaan banao — catalog, QR and share text in one go'}</p>
        </div>
        <ChevronRight aria-hidden="true" />
      </button>

      <section className="sales-card" aria-label="Today’s sales">
        <div className="eyebrow">Today’s sales</div>
        <div className="hero-amount num">{formatINR(dash.salesToday)}</div>
        <div className="sales-meta">
          <span><Check aria-hidden="true" /><b className="num">{dash.successToday}</b> received</span>
          <span><Clock3 aria-hidden="true" /><b className="num">{dash.pendingToday}</b> pending</span>
          <span><X aria-hidden="true" /><b className="num">{dash.failedToday}</b> failed</span>
        </div>
      </section>

      <div className="quick-grid">
        <button onClick={() => navigate('/collect')}>
          <span className="quick-icon cyan" aria-hidden="true"><IndianRupee /></span>
          <b>Collect</b><small>Request a payment</small>
        </button>
        <button onClick={() => navigate('/qr')}>
          <span className="quick-icon navy" aria-hidden="true"><QrCode /></span>
          <b>My QR</b><small>Show at the counter</small>
        </button>
      </div>

      <button className="balance-card" onClick={() => navigate('/settlements')}>
        <div>
          <small>Available for settlement</small>
          <strong><Money paise={dash.availablePaise} /></strong>
          <span>To {data.merchant.bankName} ••{data.merchant.bankAccountLast4}</span>
        </div>
        <div className="round-arrow" aria-hidden="true"><ArrowRight /></div>
      </button>

      {insight && <button className="insight-teaser" onClick={() => navigate('/insights')}>
        <span aria-hidden="true"><Sparkles /></span>
        <div><small>Business insight</small><strong>{insight.title}</strong><p>{insight.description}</p></div>
        <ChevronRight aria-hidden="true" />
      </button>}

      <SectionTitle link="/payments">Recent payments</SectionTitle>
      <section className="list-card">
        {dash.recent.length
          ? dash.recent.slice(0, 5).map((txn) => <TransactionRow txn={txn} key={txn.id} />)
          : <EmptyState icon={<WalletCards />} title="No payments yet"
            text="Collect your first payment and it will show up here instantly." />}
      </section>
    </Page>
  </>
}

/* -------------------------------------------------------------------------- */
/* Payments                                                                   */
/* -------------------------------------------------------------------------- */

function PaymentsPage() {
  const data = useData()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [method, setMethod] = useState('all')
  const [range, setRange] = useState('all')
  const [sort, setSort] = useState('latest')
  const rows = useMemo(() => {
    const now = new Date(data.demoClock).getTime()
    return [...data.transactions].filter((t) => {
      const q = query.toLowerCase()
      const within = range === 'all' || now - new Date(t.createdAt).getTime() <= Number(range) * 86400000
      return (!q || `${t.customerName} ${t.referenceId} ${t.amountPaise / 100}`.toLowerCase().includes(q))
        && (status === 'all' || t.status === status) && (method === 'all' || t.paymentMethod === method) && within
    }).sort((a, b) => sort === 'amount' ? b.amountPaise - a.amountPaise : b.createdAt.localeCompare(a.createdAt))
  }, [data, query, status, method, range, sort])
  const filtered = status !== 'all' || method !== 'all' || range !== 'all' || query !== ''
  return <>
    <PageHeader title="Payments" />
    <Page>
      <div className="title-row">
        <div><h1>Payments</h1><p className="num">{data.transactions.length} transactions</p></div>
        <WalletCards aria-hidden="true" />
      </div>
      <label className="search-box">
        <Search aria-hidden="true" />
        <span className="sr-only">Search payments</span>
        <input type="search" placeholder="Search name, amount or reference" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="filters">
        <label><span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All status</option><option value="success">Received</option>
            <option value="failed">Failed</option><option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
          </select>
        </label>
        <label><span>Method</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="all">All methods</option><option value="upi">UPI</option>
            <option value="paytm_wallet">Wallet</option><option value="card">Card</option>
          </select>
        </label>
        <label><span>Period</span>
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="all">All dates</option><option value="1">Today</option>
            <option value="7">Last 7 days</option><option value="30">Last 30 days</option>
          </select>
        </label>
        <label><span>Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="latest">Latest first</option><option value="amount">Highest amount</option>
          </select>
        </label>
      </div>
      <div className="result-label num" aria-live="polite">{rows.length} {rows.length === 1 ? 'result' : 'results'}</div>
      <section className="list-card">
        {rows.length
          ? rows.map((t) => <TransactionRow key={t.id} txn={t} />)
          : <EmptyState icon={<Search />} title="No payments found"
            text={filtered ? 'Try a different search term or widen the filters.' : 'Collect a payment to see it listed here.'} />}
      </section>
    </Page>
  </>
}

function PaymentDetailPage() {
  const { id } = useParams()
  const data = useData()
  const txn = data.transactions.find((t) => t.id === id)
  const refund = useMerchantStore((s) => s.refundTransaction)
  const confirm = useMerchantStore((s) => s.confirmPending)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const existingBasket = (data.basketAssignments ?? []).find((assignment) => assignment.transactionId === txn?.id)
  if (!txn) return <>
    <PageHeader title="Payment details" back />
    <Page><h1 className="sr-only">Payment details</h1>
      <EmptyState icon={<CircleAlert />} title="Payment not found" text="This transaction does not exist." />
    </Page>
  </>
  const doRefund = async () => {
    setBusy(true); setMessage('')
    try { await refund(txn.id); setMessage('Refund completed successfully.') } catch (e) { setMessage(e instanceof Error ? e.message : 'Refund failed') } finally { setBusy(false) }
  }
  const doConfirm = async (success: boolean) => {
    setBusy(true); setMessage('')
    try {
      await confirm(txn.id, success)
      setMessage(success ? 'Payment confirmed successfully.' : 'Payment marked as failed.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update payment')
    } finally {
      setBusy(false)
    }
  }
  return <>
    <PageHeader title="Payment details" back />
    <Page>
      <section className="receipt">
        <span className={`receipt-icon ${txn.status}`} aria-hidden="true">
          {txn.status === 'success' ? <Check /> : txn.status === 'pending' ? <Clock3 /> : <X />}
        </span>
        <h1>{txn.status === 'success' ? 'Payment received' : txn.status === 'pending' ? 'Payment processing' : txn.status === 'refunded' ? 'Payment refunded' : 'Payment failed'}</h1>
        <p className="receipt-amount num" style={{ fontSize: 'var(--fs-display)', fontWeight: 700, color: 'var(--color-text)', margin: '8px 0 4px' }}>{formatINR(txn.amountPaise)}</p>
        <small>{formatDayLabel(txn.createdAt, data.demoClock)}, {formatTime(txn.createdAt)}</small>
      </section>
      {txn.failureReason && <div className="alert error" role="alert"><CircleAlert />{txn.failureReason}</div>}
      <section className="detail-card">
        <Detail label="Customer" value={txn.customerName} />
        <Detail label="Payment method" value={methodName[txn.paymentMethod]} />
        <Detail label="Order reference" value={txn.referenceId} mono />
        {txn.upiTxnId && <Detail label="UPI transaction ID" value={txn.upiTxnId} mono />}
        <Detail label="Settlement" value={txn.settlementId ? `Settled · ${txn.settlementId}` : txn.status === 'success' ? 'Available to settle' : 'Not applicable'} />
        {txn.note && <Detail label="Note" value={txn.note} />}
      </section>

      {txn.status === 'success' && data.catalog && <BasketAttribution
        transactionId={txn.id}
        amountPaise={txn.amountPaise}
        items={data.catalog.items}
        existing={existingBasket?.lines}
      />}

      {message && <div className={`alert ${/fail|could not/i.test(message) ? 'error' : 'success'}`} role="status">{message}</div>}
      {txn.status === 'success' && !txn.settlementId && <button className="outline-danger full" disabled={busy} onClick={doRefund}>{busy ? 'Processing refund…' : 'Refund payment'}</button>}
      {txn.status === 'pending' && <div className="button-pair">
        <button className="secondary" disabled={busy} onClick={() => void doConfirm(false)}>Mark failed</button>
        <button className="primary" disabled={busy} onClick={() => void doConfirm(true)}>{busy ? 'Updating…' : 'Confirm success'}</button>
      </div>}
    </Page>
  </>
}

/**
 * Links a payment to the items sold.
 *
 * The suggestion comes from the exact-sum basket solver; the amount alone can
 * never prove what was bought, so the top candidate is offered as one tap with
 * a correction path always in reach, and low-confidence reads say so plainly.
 */
function BasketAttribution({ transactionId, amountPaise, items, existing }: {
  transactionId: string
  amountPaise: number
  items: CatalogItem[]
  existing?: BasketLine[]
}) {
  const toast = useToast()
  const attachBasket = useMerchantStore((s) => s.attachBasket)
  const assignments = useMerchantStore((s) => s.basketAssignments)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)

  const solution = useMemo(
    () => solveBasket(amountPaise, items, { unitsSoldBySku: unitsSoldBySku(assignments ?? []) }),
    [amountPaise, items, assignments],
  )
  const best = solution.candidates[0]

  const save = async (lines: BasketLine[]) => {
    setBusy(true)
    try {
      await attachBasket(transactionId, lines)
      setPicking(false)
      toast({ text: 'Items linked to this payment. Stock estimate updated.' })
    } catch (reason) {
      toast({ text: reason instanceof Error ? reason.message : 'Could not link items', tone: 'error' })
    } finally { setBusy(false) }
  }

  return <>
    <section className="basket-card">
      <h2>What did this customer buy?</h2>
      {existing?.length
        ? <>
          <p className="basket-result"><Check aria-hidden="true" />{existing.map((line) => `${line.quantity}× ${line.itemName}`).join(', ')}</p>
          <button className="text-btn" style={{ paddingLeft: 0 }} onClick={() => setPicking(true)}>Change items</button>
        </>
        : best
          ? <>
            <p>{solution.status === 'ambiguous'
              ? `${solution.solutionCount} baskets add up to this amount. The most likely one:`
              : 'Best match for this amount:'}</p>
            <div className="basket-suggestion">
              {best.lines.map((line) => <span className="basket-chip" key={line.skuId}>
                <b className="num">{line.quantity}×</b> {line.itemName}
              </span>)}
            </div>
            <p className="basket-confidence">
              <span className={`confidence-dot ${best.confidencePct >= 70 ? 'high' : best.confidencePct >= 50 ? 'medium' : 'low'}`} aria-hidden="true" />
              <span className="num">{best.confidencePct}%</span> confidence · {best.rationale}
            </p>
            <button className="primary full" disabled={busy} onClick={() => void save(best.lines)}>
              {busy ? 'Saving…' : 'Confirm items'}
            </button>
            <button className="text-btn full" onClick={() => setPicking(true)}>Not these? Pick items</button>
          </>
          : <>
            <p>{solution.explanation}</p>
            <button className="primary full" onClick={() => setPicking(true)}>Pick items</button>
          </>}
      <small>Matched from the amount and confirmed by you — the payment itself does not identify the basket.</small>
      {!existing?.length && <WhyBasket solution={solution} items={items} />}
    </section>

    {picking && <BasketPicker
      items={items}
      target={amountPaise}
      initial={existing ?? best?.lines ?? []}
      busy={busy}
      onClose={() => setPicking(false)}
      onSave={save}
    />}
  </>
}

/** Manual basket correction. Big steppers, live total, no typing required. */
function BasketPicker({ items, target, initial, busy, onClose, onSave }: {
  items: CatalogItem[]
  target: number
  initial: BasketLine[]
  busy: boolean
  onClose: () => void
  onSave: (lines: BasketLine[]) => void
}) {
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {}
    initial.forEach((line) => { seed[line.skuId] = line.quantity })
    return seed
  })
  const sellable = items.filter((item) => item.pricePaise > 0)
  const lines: BasketLine[] = sellable
    .filter((item) => (counts[item.id] ?? 0) > 0)
    .map((item) => ({ skuId: item.id, itemName: item.name, quantity: counts[item.id], pricePaise: item.pricePaise }))
  const total = lines.reduce((sum, line) => sum + line.quantity * line.pricePaise, 0)
  const matches = total === target
  const bump = (id: string, delta: number) =>
    setCounts((prev) => ({ ...prev, [id]: Math.max(0, Math.min(20, (prev[id] ?? 0) + delta)) }))

  return <Sheet title="Pick the items sold" description={`Payment was ${formatINR(target)}`} onClose={onClose}>
    <div className="picker-list">
      {sellable.map((item) => {
        const count = counts[item.id] ?? 0
        return <div className={`picker-row ${count > 0 ? 'chosen' : ''}`} key={item.id}>
          <div><b>{item.name}</b><small className="num">{formatINR(item.pricePaise)} · {item.category}</small></div>
          <div className="stepper">
            <button onClick={() => bump(item.id, -1)} disabled={count === 0} aria-label={`Remove one ${item.name}`}><Minus /></button>
            <output aria-label={`${item.name} quantity`} className="num">{count}</output>
            <button onClick={() => bump(item.id, 1)} aria-label={`Add one ${item.name}`}><Plus /></button>
          </div>
        </div>
      })}
    </div>
    <div className={`picker-total ${matches ? 'match' : ''}`} aria-live="polite">
      <span>{matches ? 'Matches the payment exactly' : 'Basket total'}</span>
      <strong className="num">{formatINR(total)}</strong>
    </div>
    <button className="primary full" disabled={busy || !lines.length} onClick={() => onSave(lines)}>
      {busy ? 'Saving…' : 'Save these items'}
    </button>
  </Sheet>
}

/* -------------------------------------------------------------------------- */
/* Collect and QR                                                             */
/* -------------------------------------------------------------------------- */

function CollectPage() {
  const data = useData()
  const collect = useMerchantStore((s) => s.collectPayment)
  const [amount, setAmount] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('upi')
  const [stage, setStage] = useState<'form' | 'processing' | 'success' | 'failed'>('form')
  const [txn, setTxn] = useState<Transaction | null>(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const submit = async () => {
    const selected = data.customers.find((c) => c.id === customerId)
    setStage('processing'); setError('')
    try {
      const result = await collect({ amountRupees: Number(amount), customerId: selected?.id, customerName: selected?.name || name, customerPhone: selected?.phone, paymentMethod: method, note })
      setTxn(result); setStage(result.status === 'success' ? 'success' : 'failed')
      if (result.status === 'failed') setError(result.failureReason ?? 'Payment failed')
    } catch (e) { setError(e instanceof Error ? e.message : 'Payment failed'); setStage('failed') }
  }
  if (stage === 'processing') return <>
    <PageHeader title="Collect payment" back />
    <Page centered>
      <div className="spinner" aria-hidden="true" />
      <h1>Waiting for the customer</h1>
      <p>Keep this screen open until the payment is confirmed.</p>
    </Page>
  </>
  if (stage === 'success') return <>
    <PageHeader title="Payment received" back />
    <Page centered className="result-page">
      <span className="big-success" aria-hidden="true"><Check /></span>
      <h1>Payment received</h1>
      <p className="num" style={{ fontSize: 'var(--fs-display)', fontWeight: 700, color: 'var(--color-text)' }}>{formatINR(txn!.amountPaise)}</p>
      <small style={{ color: 'var(--color-text-muted)' }}>from {txn!.customerName}</small>
      {data.merchant.soundboxEnabled && <div className="soundbox">
        <BellRing aria-hidden="true" />
        <div><b>Soundbox announcement</b><span>“Received {formatINR(txn!.amountPaise)}”</span></div>
      </div>}
      <button className="primary full" onClick={() => navigate(`/payments/${txn!.id}`)}>View payment</button>
      <button className="text-btn" onClick={() => { setAmount(''); setNote(''); setStage('form') }}>Collect another</button>
    </Page>
  </>
  if (stage === 'failed') return <>
    <PageHeader title="Payment failed" back />
    <Page centered className="result-page">
      <span className="big-fail" aria-hidden="true"><X /></span>
      <h1>Payment failed</h1>
      <p>{error}</p>
      <button className="primary full" onClick={() => setStage('form')}>Try again</button>
      <button className="text-btn" onClick={() => navigate('/payments')}>Back to payments</button>
    </Page>
  </>
  return <>
    <PageHeader title="Collect payment" back />
    <Page>
      <div className="title-row">
        <div><h1>Collect payment</h1><p>Ask a customer to pay at the counter</p></div>
        <IndianRupee aria-hidden="true" />
      </div>
      <label className="amount-input">
        <span aria-hidden="true">₹</span>
        <span className="sr-only">Amount in rupees</span>
        <input inputMode="decimal" autoFocus placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <FormField label="Choose customer">
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Walk-in customer</option>
          {data.customers.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}
        </select>
      </FormField>
      {!customerId && <FormField label="Customer name" hint="Optional — leave blank for a walk-in customer">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Walk-in customer" autoComplete="name" />
      </FormField>}
      <FormField label="Payment method">
        <div className="method-grid" role="group" aria-label="Payment method">
          {(['upi', 'paytm_wallet', 'card', 'netbanking'] as PaymentMethod[]).map((m) => <button
            className={method === m ? 'selected' : ''} key={m} aria-pressed={method === m} onClick={() => setMethod(m)}
          >{methodName[m]}</button>)}
        </div>
      </FormField>
      <FormField label="Note" hint="Optional — shows on the payment record">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Grocery order" />
      </FormField>
      <button className="primary full" style={{ marginTop: 'var(--space-5)' }} disabled={!amount || Number(amount) <= 0} onClick={submit}>
        Collect {Number(amount) > 0 ? formatINR(Math.round(Number(amount) * 100)) : 'payment'}
      </button>
    </Page>
  </>
}

function QRPage() {
  const data = useData()
  const collect = useMerchantStore((s) => s.collectPayment)
  const [amount, setAmount] = useState('')
  const [stage, setStage] = useState<'ready' | 'processing' | 'done' | 'failed'>('ready')
  const [txn, setTxn] = useState<Transaction | null>(null)
  const rupees = Number(amount)
  /* An invalid amount must not break the QR: fall back to the static shop QR. */
  const intent = useMemo(() => {
    if (rupees > 0) {
      try { return collectIntent(data.merchant.businessName, rupees, { note: 'Counter payment' }) } catch { /* fall through */ }
    }
    return shopIntent(data.merchant.businessName)
  }, [data.merchant.businessName, rupees])
  const simulate = async () => {
    setStage('processing')
    try { const t = await collect({ amountRupees: Number(amount), paymentMethod: 'upi', customerName: 'QR customer', note: 'QR counter payment' }); setTxn(t); setStage(t.status === 'success' ? 'done' : 'failed') } catch { setStage('failed') }
  }
  return <>
    <PageHeader title="My QR" back />
    <Page className="qr-page">
      <h1 className="sr-only">My QR code</h1>
      <UpiQr intent={intent} size={210} showPayButton />
      {stage === 'done' ? <div className="alert success" role="status"><Check />Received {formatINR(txn!.amountPaise)}. Your dashboard is updated.</div>
        : stage === 'failed' ? <div className="alert error" role="alert"><X />Payment failed. Change the amount and try again.</div>
          : <FormField label="Add an amount to the QR" hint="Optional — leave blank to let the customer enter it">
            <div className="input-prefix"><span aria-hidden="true">₹</span>
              <input inputMode="decimal" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount in rupees" />
            </div>
          </FormField>}
      {stage === 'done'
        ? <button className="primary full" onClick={() => { setAmount(''); setStage('ready') }}>Show the QR again</button>
        : <button className="secondary full" disabled={!amount || stage === 'processing'} onClick={simulate}>
          {stage === 'processing' ? 'Recording…' : 'Record a counter payment'}
        </button>}
    </Page>
  </>
}

/* -------------------------------------------------------------------------- */
/* Ek Photo Dukaan — capture                                                  */
/* -------------------------------------------------------------------------- */

function DukaanScanPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const createCatalog = useMerchantStore((s) => s.createCatalog)
  const fileInput = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<OcrPhase | null>(null)
  const [error, setError] = useState<{ title: string; text: string } | null>(null)
  const busy = phase !== null
  const progress = Math.round((phase?.progress ?? 0) * 100)

  const build = async (run: () => Promise<Parameters<typeof createCatalog>[0]>) => {
    setError(null)
    try {
      const result = await run()
      await createCatalog(result)
      toast({ text: 'Your dukaan is ready. Check every price before sharing.' })
      navigate('/dukaan/manage')
    } catch (reason) {
      if (reason instanceof NoTextFoundError) {
        setError({ title: 'Nothing readable in that photo', text: reason.message })
      } else if (reason instanceof OcrUnavailableError) {
        setError({ title: 'The reader could not start', text: `${reason.message} You can still start a list by hand from a sample shop below.` })
      } else {
        setError({ title: 'That photo could not be read', text: reason instanceof Error ? reason.message : 'Please try another photo.' })
      }
    } finally {
      setPhase(null)
    }
  }

  const onFile = (file: File | undefined) => {
    if (!file) return
    setPhase({ progress: 0, label: 'Starting the reader' })
    void build(() => analyzePhoto(file, file.name, setPhase))
  }

  if (busy) return <>
    <PageHeader title="Reading your photo" />
    <Page className="scan-page">
      <h1>Reading your photo</h1>
      <p aria-live="polite">{phase.label} — this runs on your phone, nothing is uploaded.</p>
      <div className="scan-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0}
        aria-valuemax={100} aria-label="Reading progress">
        <span style={{ width: `${Math.max(6, progress)}%` }} />
      </div>
      <p className="scan-progress-value num">{progress}%</p>
      <ListSkeleton rows={5} />
    </Page>
  </>

  return <>
    <PageHeader title="Ek Photo Dukaan" back />
    <Page className="scan-page">
      <section className="scan-hero">
        <span aria-hidden="true"><Camera /></span>
        <h1>One photo becomes your dukaan</h1>
        <p>Photograph your shelf or your printed rate card. The text is read on this
          phone and turned into a price list you can edit and share.</p>
      </section>

      {error && <div className="alert error" role="alert">
        <CircleAlert aria-hidden="true" />
        <div><b>{error.title}</b><p>{error.text}</p></div>
      </div>}

      <input ref={fileInput} type="file" accept="image/*" capture="environment" className="sr-only"
        onChange={(event) => { onFile(event.target.files?.[0]); event.target.value = '' }} />
      <button className="primary full" onClick={() => fileInput.current?.click()}>
        <Camera aria-hidden="true" />Take or choose a photo
      </button>

      <div className="scan-divider"><span>or start from a sample shop</span></div>
      <div className="sample-grid">
        {SAMPLE_SHOPS.map((shop) => <button className="sample-card" key={shop.id}
          onClick={() => { setPhase({ progress: 0.9, label: 'Loading the sample shop' }); void build(async () => analyzeSample(shop.id)) }}>
          <img src={shop.imagePath} alt="" width={72} height={72} loading="lazy" />
          <span><b>{shop.label}</b><small>{shop.caption}</small></span>
          <ChevronRight aria-hidden="true" />
        </button>)}
      </div>

      <div className="note">
        <Info aria-hidden="true" />
        <div>
          <b>Reading happens on your phone</b>
          <p>Your photo is not uploaded anywhere. Sample shops are pre-written lists that
            ship with the app — they are not read from the picture.</p>
        </div>
      </div>
    </Page>
  </>
}

function SupplierInvoicePage() {
  const data = useData()
  const navigate = useNavigate()
  const toast = useToast()
  const saveInvoice = useMerchantStore((s) => s.saveSupplierInvoice)
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<OcrPhase | null>(null)
  const [error, setError] = useState<{ title: string; text: string } | null>(null)
  const reading = phase !== null
  const progress = Math.round((phase?.progress ?? 0) * 100)

  const catalog = data.catalog

  /* The API refuses a bill without a catalog, so do not offer the camera yet. */
  if (!catalog) return <>
    <PageHeader title="Supplier bill" back />
    <Page><h1 className="sr-only">Supplier bill</h1>
      <EmptyState icon={<ReceiptText />} title="Build your dukaan first"
        text="A supplier bill is matched against your own items, so the price list has to exist before the bill can be read." />
      <button className="primary full" onClick={() => navigate('/dukaan/scan')}><Camera />Take shop photo</button>
    </Page>
  </>

  const shop = sampleShopForCatalog(catalog.items)
  const sample = loadSampleInvoice(shop)

  const commit = async (
    run: () => Promise<Omit<SupplierProfile, 'id' | 'lastStockInAt'>>,
    message: string,
  ) => {
    setError(null)
    setBusy(true)
    try {
      await saveInvoice(await run())
      toast({ text: message })
      navigate('/dukaan/manage')
    } catch (reason) {
      if (reason instanceof NoInvoiceFoundError) {
        setError({ title: 'No bill rows in that photo', text: reason.message })
      } else if (reason instanceof OcrUnavailableError) {
        setError({ title: 'The reader could not start', text: `${reason.message} You can still load the sample bill below.` })
      } else {
        setError({ title: 'That bill could not be read', text: reason instanceof Error ? reason.message : 'Please try another photo.' })
      }
    } finally {
      setBusy(false)
      setPhase(null)
    }
  }

  const onFile = (file: File | undefined) => {
    if (!file) return
    setPhase({ progress: 0, label: 'Starting the reader' })
    void commit(
      () => analyzeInvoicePhoto(file, file.name, catalog.items, setPhase),
      'Supplier bill read. Check every quantity before ordering.',
    )
  }

  if (reading) return <>
    <PageHeader title="Reading your bill" />
    <Page className="scan-page">
      <h1>Reading your bill</h1>
      <p aria-live="polite">{phase.label} — this runs on your phone, nothing is uploaded.</p>
      <div className="scan-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0}
        aria-valuemax={100} aria-label="Reading progress">
        <span style={{ width: `${Math.max(6, progress)}%` }} />
      </div>
      <p className="scan-progress-value num">{progress}%</p>
      <ListSkeleton rows={4} />
    </Page>
  </>

  return <>
    <PageHeader title="Supplier bill" back />
    <Page className="scan-page">
      <section className="scan-hero">
        <span aria-hidden="true"><ReceiptText /></span>
        <h1>Photograph your supplier bill</h1>
        <p>The bill says what came in and at what cost. Read on this phone, matched
          against your own items, so restock can quote a real total.</p>
      </section>

      {error && <div className="alert error" role="alert">
        <CircleAlert aria-hidden="true" />
        <div><b>{error.title}</b><p>{error.text}</p></div>
      </div>}

      <input ref={fileInput} type="file" accept="image/*" capture="environment" className="sr-only"
        onChange={(event) => { onFile(event.target.files?.[0]); event.target.value = '' }} />
      <button className="primary full" disabled={busy} onClick={() => fileInput.current?.click()}>
        <Camera aria-hidden="true" />Take or choose a photo of the bill
      </button>

      <div className="scan-divider"><span>or load a sample bill</span></div>

      <section className="invoice-preview">
        <div className="invoice-head">
          <Truck aria-hidden="true" />
          <div><b>{sample.name}</b><small className="num">{sample.phone}</small></div>
        </div>
        <ul>
          {sample.lines.map((line) => <li key={line.skuId}>
            <span>{line.itemName}</span>
            <span className="num">{line.quantity} × {formatINR(line.unitCostPaise)}</span>
          </li>)}
        </ul>
        <div className="invoice-total">
          <span>Usual order</span>
          <strong className="num">{formatINR(sample.invoiceTotalPaise)}</strong>
        </div>
      </section>

      <button className="secondary full" disabled={busy}
        onClick={() => void commit(async () => sample, 'Sample supplier bill loaded. Nothing is payable until you approve it.')}>
        <Upload aria-hidden="true" />{busy ? 'Saving…' : 'Use this sample bill instead'}
      </button>

      <div className="note">
        <Info aria-hidden="true" />
        <div>
          <b>Nothing is paid automatically</b>
          <p>A photograph is read on this device and never uploaded. The sample bill is
            pre-written and clearly labelled as such. Either way, no payable and no bank
            instruction is created without your approval.</p>
        </div>
      </div>
    </Page>
  </>
}

/* -------------------------------------------------------------------------- */
/* Ek Photo Dukaan — manage                                                   */
/* -------------------------------------------------------------------------- */

const stockCopy: Record<CatalogItem['stockFlag'], string> = {
  in_stock: 'In stock', low: 'Running low', out: 'Out of stock',
}

function DukaanManagePage() {
  const data = useData()
  const navigate = useNavigate()
  const toast = useToast()
  const updateItem = useMerchantStore((s) => s.updateCatalogItem)
  const addItem = useMerchantStore((s) => s.addCatalogItem)
  const removeItem = useMerchantStore((s) => s.removeCatalogItem)
  const raiseOrder = useMerchantStore((s) => s.raiseSupplierOrder)
  const confirmOrder = useMerchantStore((s) => s.confirmSupplierOrder)
  const [busy, setBusy] = useState('')
  const [savedId, setSavedId] = useState('')
  const [sharing, setSharing] = useState(false)
  const [removing, setRemoving] = useState<string[]>([])
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const catalog = data.catalog
  if (!catalog) return <>
    <PageHeader title="Ek Photo Dukaan" back />
    <Page><h1 className="sr-only">Ek Photo Dukaan</h1>
      <EmptyState icon={<Image />} title="Your dukaan is empty"
        text="Take one photo of your shelf or rate card and we’ll build the catalog for you." />
      <button className="primary full" onClick={() => navigate('/dukaan/scan')}><Camera />Take shop photo</button>
    </Page>
  </>

  const link = `${window.location.origin}${window.location.pathname}#/dukaan/${catalog.slug}`
  const visibleItems = catalog.items.filter((item) => !removing.includes(item.id))
  const available = visibleItems.filter((item) => item.available)
  const needsAttention = visibleItems.filter((item) => !item.available || item.stockFlag === 'low')
  const forecasts = buildStockForecasts(data)
  const reorderForecasts = forecasts.filter((forecast) => forecast.needsReorder)
  const demandReport = buildDemandReport(data)
  const latestOrder = data.supplierOrders?.[0]
  const shareText = `Namaste! ${data.merchant.businessName} ka digital price list dekhiye: ${link}\n${available.slice(0, 4).map((item) => `${item.name} – ${formatINR(item.pricePaise)}`).join('\n')}\nAvailability may change.`

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast({ text: `${label} copied` })
    } catch {
      toast({ text: 'Copy was blocked. Open the dukaan and copy from the address bar.', tone: 'error' })
    }
  }

  const save = async (id: string, patch: Parameters<typeof updateItem>[1]) => {
    await updateItem(id, patch)
    setSavedId(id)
    window.setTimeout(() => setSavedId((current) => (current === id ? '' : current)), 1600)
  }

  /* Delete is deferred so the toast can genuinely undo it. */
  const requestRemove = (item: CatalogItem) => {
    setRemoving((prev) => [...prev, item.id])
    const timer = window.setTimeout(() => {
      setRemoving((prev) => prev.filter((id) => id !== item.id))
      void removeItem(item.id)
    }, 5000)
    timers.current.push(timer)
    toast({
      text: `Removed ${item.name}`,
      action: {
        label: 'Undo',
        run: () => {
          window.clearTimeout(timer)
          setRemoving((prev) => prev.filter((id) => id !== item.id))
        },
      },
    })
  }

  return <>
    <PageHeader title="Ek Photo Dukaan" back action={
      <button className="header-link" onClick={() => navigate(`/dukaan/${catalog.slug}`)}>Preview</button>
    } />
    <Page>
      <section className="catalog-summary">
        <div>
          <small>Digital dukaan</small>
          <h1>{catalog.title}</h1>
          <p className="num">{visibleItems.length} items · {available.length} showing to customers</p>
        </div>
        <span aria-hidden="true"><Check /></span>
      </section>

      <div className={`vision-note ${catalog.confidence}`}>
        <Info aria-hidden="true" />
        <div>
          <b>{catalog.confidence === 'starter' ? 'Starter list — please check every row' : 'Photo read complete — check the prices'}</b>
          <p>{catalog.readingNote}</p>
        </div>
      </div>
      <WhyCatalog provenance={catalog.provenance} sourceImageName={catalog.sourceImageName} />

      <SectionTitle>Items and prices</SectionTitle>
      <section className="catalog-editor">
        {visibleItems.map((item) => <article key={item.id} className={!item.available ? 'unavailable' : ''}>
          <div className="item-top">
            <input aria-label={`${item.name} name`} defaultValue={item.name} onBlur={(event) => {
              if (event.target.value.trim() !== item.name) void save(item.id, { name: event.target.value })
            }} />
            <span className={`stock-tag ${item.stockFlag}`}>
              {item.stockFlag === 'out' ? <X aria-hidden="true" /> : item.stockFlag === 'low' ? <CircleAlert aria-hidden="true" /> : <Check aria-hidden="true" />}
              {item.stockLabel || stockCopy[item.stockFlag]}
            </span>
          </div>
          <div className="item-bottom">
            <label className="price-edit">
              <span aria-hidden="true">₹</span>
              <span className="sr-only">{item.name} price in rupees</span>
              <input inputMode="decimal" defaultValue={item.pricePaise / 100} onBlur={(event) => {
                const price = Number(event.target.value)
                if (Number.isFinite(price) && price >= 0 && price * 100 !== item.pricePaise) void save(item.id, { pricePaise: Math.round(price * 100) })
              }} />
            </label>
            <button className={`availability ${item.available ? 'on' : ''}`} aria-pressed={item.available}
              onClick={() => void save(item.id, { available: !item.available })}>
              {item.available ? <><Eye aria-hidden="true" />Showing</> : <>Hidden</>}
            </button>
            <button className="remove-item" aria-label={`Remove ${item.name}`} onClick={() => requestRemove(item)}><Trash2 /></button>
          </div>
          <p className="item-meta">
            {item.category}
            {savedId === item.id && <> · <span className="saved-flash"><Check aria-hidden="true" />Saved</span></>}
          </p>
        </article>)}
        <button className="add-item" disabled={busy === 'add'} onClick={async () => { setBusy('add'); await addItem(); setBusy('') }}>
          <Plus aria-hidden="true" />{busy === 'add' ? 'Adding…' : 'Add an item'}
        </button>
      </section>

      <SectionTitle>Share your dukaan</SectionTitle>
      <section className="share-card">
        <div className="mini-qr"><QRCodeSVG value={link} size={100} fgColor="#012b72" /></div>
        <div>
          <b>Customer price list</b>
          <p>Customers scan or tap the link to see today’s items and prices.</p>
          <button onClick={() => setSharing(true)}><Link2 aria-hidden="true" />Share options</button>
        </div>
      </section>
      <div className="share-actions">
        <button onClick={() => void copy(link, 'Dukaan link')}><Copy aria-hidden="true" />Copy link</button>
        <button className="whatsapp" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer')}>
          <MessageCircle aria-hidden="true" />WhatsApp
        </button>
      </div>

      {sharing && <Sheet title="Share your dukaan" description="Customers see your live price list — nothing else." onClose={() => setSharing(false)}>
        <div className="share-card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="mini-qr"><QRCodeSVG value={link} size={100} fgColor="#012b72" /></div>
          <div><b>Scan to open</b><p>Print this and stick it near your counter.</p></div>
        </div>
        <div className="link-preview"><Link2 aria-hidden="true" /><span>{link}</span></div>
        <div className="share-actions">
          <button onClick={() => void copy(link, 'Dukaan link')}><Copy aria-hidden="true" />Copy link</button>
          <button className="whatsapp" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer')}>
            <MessageCircle aria-hidden="true" />WhatsApp
          </button>
        </div>
        <button className="secondary full" style={{ marginTop: 'var(--space-2)' }} onClick={() => { setSharing(false); navigate(`/dukaan/${catalog.slug}`) }}>
          <Eye aria-hidden="true" />Preview as a customer
        </button>
      </Sheet>}

      <SectionTitle>Restock</SectionTitle>
      <section className="restock-card">
        <Package aria-hidden="true" />
        <div>
          <b className="num">{needsAttention.length} items need attention</b>
          <p>{needsAttention.length ? needsAttention.map((item) => item.name).slice(0, 3).join(', ') : 'Nothing is flagged low right now.'}</p>
          <small>Estimated from shelf cues in your photo plus confirmed payment baskets — not an exact stock count.</small>
        </div>
      </section>
      {reorderForecasts.length > 0 && <section className="forecast-list">
        {reorderForecasts.slice(0, 4).map((forecast) => <article key={forecast.skuId}>
          <div>
            <b>{forecast.itemName}</b>
            <small className="num">About {forecast.estimatedMin}–{forecast.estimatedMax} left · {forecast.confidencePct}% confidence</small>
          </div>
          <strong className="num">{forecast.stockoutDays == null ? 'Low on shelf' : `~${forecast.stockoutDays} days`}</strong>
        </article>)}
      </section>}
      <WhyRestock report={demandReport} />

      {!data.supplier
        ? <button className="primary full supplier-action" onClick={() => navigate('/dukaan/invoice')}>
          <ReceiptText aria-hidden="true" />Add supplier bill
        </button>
        : <section className="supplier-card">
          <div className="supplier-head">
            <Truck aria-hidden="true" />
            <div>
              <b>{data.supplier.name}</b>
              <p className="num">{data.supplier.lines.length} bill lines · usual order {formatINR(data.supplier.normalOrderPaise)}</p>
            </div>
          </div>
          <p className="supplier-disclosure">{data.supplier.disclosure}</p>
          <WhyInvoice sourceImageName={data.supplier.sourceImageName} />
          <button className="primary full" style={{ marginTop: 'var(--space-3)' }}
            disabled={busy === 'order' || latestOrder?.status === 'queued'}
            onClick={async () => {
              setBusy('order')
              try {
                const matching = data.supplier!.lines.filter((line) => reorderForecasts.some((forecast) => forecast.skuId === line.skuId)).map((line) => line.skuId)
                await raiseOrder(matching)
                toast({ text: 'Reorder prepared. Nothing is sent until you share it.' })
              } catch (reason) { toast({ text: reason instanceof Error ? reason.message : 'Could not prepare the order', tone: 'error' }) } finally { setBusy('') }
            }}>
            {busy === 'order' ? 'Preparing…' : latestOrder?.status === 'queued' ? 'Reorder ready below' : 'Approve reorder'}
          </button>
        </section>}

      {latestOrder && <section className={`order-status ${latestOrder.status}`}>
        <div className="order-head">
          {latestOrder.status === 'confirmed' ? <CircleCheck aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
          Order {latestOrder.status === 'confirmed' ? 'confirmed' : 'ready to send'}
        </div>
        <b><Money paise={latestOrder.amountPaise} /> to {data.supplier?.name}</b>
        <p>{latestOrder.note}</p>
        <div className="order-actions">
          <button className="whatsapp-order" onClick={() => {
            const text = `Namaste ${data.supplier?.name}, ${data.merchant.businessName} ke liye order:\n${latestOrder.lines.map((line) => `${line.quantity} × ${line.itemName}`).join('\n')}\nTotal quote: ${formatINR(latestOrder.amountPaise)}. Please confirm availability.`
            window.open(`https://wa.me/${data.supplier?.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
          }}><MessageCircle aria-hidden="true" />Send on WhatsApp</button>
          {latestOrder.status === 'queued' && <button disabled={busy === 'confirm'} onClick={async () => {
            setBusy('confirm')
            try { await confirmOrder(latestOrder.id); toast({ text: 'Order confirmed. Stock estimates updated.' }) } catch (reason) { toast({ text: reason instanceof Error ? reason.message : 'Could not confirm', tone: 'error' }) } finally { setBusy('') }
          }}>{busy === 'confirm' ? 'Confirming…' : 'Mark as paid and received'}</button>}
        </div>
      </section>}

      <button className="secondary full rescan" onClick={() => navigate('/dukaan/scan')}>
        <RefreshCw aria-hidden="true" />Rebuild from a new photo
      </button>
    </Page>
  </>
}

/* -------------------------------------------------------------------------- */
/* Public storefront                                                          */
/* -------------------------------------------------------------------------- */

function PublicDukaanPage() {
  const { slug } = useParams()
  const data = useData()
  const [catalog, setCatalog] = useState<DukaanCatalog | null>(
    data.catalog?.slug === slug ? data.catalog : null,
  )
  const [catalogStatus, setCatalogStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    // A customer scanning the QR is on a venue network. Without this cap the
    // storefront can sit on the skeleton forever instead of offering a retry.
    let timedOut = false
    const timer = globalThis.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 12_000)
    setCatalogStatus('loading')
    void fetch(`/api/dukaan/${encodeURIComponent(slug ?? '')}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Dukaan not found')
        return response.json() as Promise<DukaanCatalog>
      })
      .then((value) => {
        setCatalog(value)
        setCatalogStatus('ready')
      })
      .catch((error: unknown) => {
        // An abort from unmount must stay silent; an abort from the timeout is a
        // real failure the customer needs to see.
        if (!timedOut && error instanceof DOMException && error.name === 'AbortError') return
        setCatalogStatus('error')
      })
      .finally(() => globalThis.clearTimeout(timer))
    return () => {
      globalThis.clearTimeout(timer)
      controller.abort()
    }
  }, [slug, attempt])

  const shopName = catalog?.title ?? data.merchant.businessName
  const intent = useMemo(() => shopIntent(data.merchant.businessName), [data.merchant.businessName])

  if (catalogStatus === 'loading' && !catalog) return <>
    <PageHeader title="Loading" />
    <Page className="public-dukaan">
      <h1 className="sr-only">Loading the shop</h1>
      <div className="storefront-skeleton" aria-hidden="true">
        <div className="skeleton hero" />
        <div className="skeleton bar" />
        <ListSkeleton rows={6} />
      </div>
    </Page>
  </>

  if (!catalog || catalog.slug !== slug || catalogStatus === 'error') return <>
    <PageHeader title="Shop unavailable" />
    <Page className="public-dukaan">
      <h1 className="sr-only">Shop unavailable</h1>
      <EmptyState icon={<Store />} title="This shop isn’t available"
        text="The price list could not be loaded. Check the link, or try again in a moment." />
      <button className="primary full" onClick={() => setAttempt((n) => n + 1)}><RefreshCw />Try again</button>
    </Page>
  </>

  const listed = catalog.items.filter((item) => item.available)
  const categories = ['all', ...Array.from(new Set(listed.map((item) => item.category)))]
  const rows = listed.filter((item) =>
    (category === 'all' || item.category === category)
    && (!query || item.name.toLowerCase().includes(query.toLowerCase())))

  return <>
    <PageHeader title={shopName} />
    <Page className="public-dukaan">
      <section className="public-hero">
        <span aria-hidden="true"><Store /></span>
        <h1>{shopName}</h1>
        <p>{data.merchant.address}, {data.merchant.city}</p>
        <div className="public-badges">
          <i className="open"><Check aria-hidden="true" />Open today</i>
          <i><Package aria-hidden="true" /><span className="num">{listed.length} items</span></i>
          <i><MapPin aria-hidden="true" />{data.merchant.category}</i>
        </div>
      </section>

      <h2 className="pay-heading"><QrCode aria-hidden="true" />Pay this shop</h2>
      <UpiQr intent={intent} size={168} showPayButton
        caption="Scan with Paytm or any UPI app, then enter the amount." />

      {listed.length > 6 && <div className="public-toolbar">
        <label className="search-box">
          <Search aria-hidden="true" />
          <span className="sr-only">Search this shop</span>
          <input type="search" placeholder="Search items" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        {categories.length > 2 && <div className="cat-chips" role="group" aria-label="Filter by category">
          {categories.map((name) => <button key={name} aria-pressed={category === name} onClick={() => setCategory(name)}>
            {name === 'all' ? 'All items' : name}
          </button>)}
        </div>}
      </div>}

      <SectionTitle>Today’s price list</SectionTitle>
      {rows.length
        ? <section className="public-list">
          {rows.map((item) => <article key={item.id}>
            <span aria-hidden="true">{item.name.slice(0, 1)}</span>
            <div><b>{item.name}</b><small>{item.category}</small></div>
            <strong><Money paise={item.pricePaise} /></strong>
          </article>)}
        </section>
        : <EmptyState icon={<Package />}
          title={listed.length ? 'Nothing matches that' : 'Stock is being updated'}
          text={listed.length ? 'Try another search word or choose a different category.' : 'The shop has hidden all items for now. Please check back shortly.'} />}

      <div className="public-actions">
        <a className="call-shop" href={`tel:${data.merchant.phone.replace(/\s/g, '')}`}>
          <Phone aria-hidden="true" />Call shop
        </a>
        <a className="whats-shop" href={`https://wa.me/${data.merchant.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Namaste ${shopName}, I would like to order:`)}`}
          target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden="true" />Order on WhatsApp
        </a>
      </div>
      <p className="public-foot">Prices and availability are set by the shop and can change. Payment happens at the counter.</p>
    </Page>
  </>
}


/* -------------------------------------------------------------------------- */
/* Business, customers, settlements                                           */
/* -------------------------------------------------------------------------- */

function BusinessPage() {
  const data = useData()
  const dash = deriveDashboard(data)
  const up = dash.weekDeltaPct >= 0
  return <>
    <PageHeader title="Business" />
    <Page>
      <div className="title-row">
        <div><h1>Business</h1><p>Understand and manage your store</p></div>
        <Building2 aria-hidden="true" />
      </div>
      <div className="business-stats">
        <div>
          <span>7-day sales</span>
          <b><Money paise={dash.last7Sales} /></b>
          <small className={up ? 'positive' : 'negative'}>
            {up ? <TrendingUp aria-hidden="true" /> : <TrendingDown aria-hidden="true" />}
            <span className="num">{Math.abs(dash.weekDeltaPct).toFixed(0)}%</span> vs prior week
          </small>
        </div>
        <div>
          <span>Success rate</span>
          <b className="num">{(dash.successRate * 100).toFixed(0)}%</b>
          <small className="num">{data.transactions.length} attempts</small>
        </div>
      </div>
      <section className="menu-card">
        <MenuItem icon={<Users />} title="Customers" text="Customer history and repeat spend" to="/customers" />
        <MenuItem icon={<Banknote />} title="Settlements" text={`${formatINR(dash.availablePaise)} available`} to="/settlements" />
        <MenuItem icon={<Lightbulb />} title="Business insights" text="Trends, peak hours and opportunities" to="/insights" />
      </section>
      <div className="info-banner">
        <Sparkles aria-hidden="true" />
        <div>
          <b>Built for small shops</b>
          <p>Every number here comes from your own payment activity — no extra bookkeeping needed.</p>
        </div>
      </div>
    </Page>
  </>
}

function CustomersPage() {
  const data = useData()
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const rows = data.customers.map((c) => ({ ...c, stats: customerStats(data, c.id) }))
    .filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.stats.totalSpendPaise - a.stats.totalSpendPaise)
  return <>
    <PageHeader title="Customers" back />
    <Page>
      <div className="title-row">
        <div><h1>Customers</h1><p className="num">{data.customers.length} saved customers</p></div>
        <Users aria-hidden="true" />
      </div>
      <label className="search-box">
        <Search aria-hidden="true" />
        <span className="sr-only">Search customers</span>
        <input type="search" placeholder="Search by name or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <section className="list-card customer-list" style={{ marginTop: 'var(--space-4)' }}>
        {rows.length ? rows.map((c) => <button className="customer-row" key={c.id} onClick={() => navigate(`/customers/${c.id}`)}>
          <span className="avatar" aria-hidden="true">{c.name.split(' ').map((x) => x[0]).slice(0, 2)}</span>
          <span><b>{c.name}</b><small className="num">{c.stats.successCount} payments · {c.segment}</small></span>
          <strong><Money paise={c.stats.totalSpendPaise} /><ChevronRight aria-hidden="true" /></strong>
        </button>) : <EmptyState icon={<Users />} title="No customers found" text="Try a different name or phone number." />}
      </section>
    </Page>
  </>
}

function CustomerDetailPage() {
  const { id } = useParams()
  const data = useData()
  const customer = data.customers.find((c) => c.id === id)
  if (!customer) return <>
    <PageHeader title="Customer" back />
    <Page><h1 className="sr-only">Customer</h1>
      <EmptyState icon={<Users />} title="Customer not found" text="This customer does not exist." />
    </Page>
  </>
  const stats = customerStats(data, customer.id)
  const txns = [...data.transactions].filter((t) => t.customerId === customer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return <>
    <PageHeader title="Customer" back />
    <Page>
      <section className="customer-hero">
        <span className="avatar large" aria-hidden="true">{customer.name.split(' ').map((x) => x[0]).slice(0, 2)}</span>
        <h1>{customer.name}</h1>
        <p>{customer.phone}</p>
        <span className="segment">{customer.segment} customer</span>
      </section>
      <div className="stat-grid">
        <div><small>Total spend</small><strong><Money paise={stats.totalSpendPaise} /></strong></div>
        <div><small>Payments</small><strong className="num">{stats.successCount}</strong></div>
      </div>
      {customer.notes && <div className="note-card"><b>Your note</b><p>{customer.notes}</p></div>}
      <SectionTitle>Payment history</SectionTitle>
      <section className="list-card">
        {txns.length ? txns.map((t) => <TransactionRow key={t.id} txn={t} />)
          : <EmptyState icon={<WalletCards />} title="No payments yet" text="This customer has not paid you yet." />}
      </section>
    </Page>
  </>
}

function SettlementsPage() {
  const data = useData()
  const dash = deriveDashboard(data)
  const settle = useMerchantStore((s) => s.settleNow)
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const canSettle = dash.availablePaise >= 5000
  const run = async () => {
    setBusy(true); setMessage('')
    try { await settle(); toast({ text: 'Settlement completed' }); setMessage('Settlement completed and your payments are updated.') }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Could not settle') } finally { setBusy(false) }
  }
  return <>
    <PageHeader title="Settlements" back />
    <Page>
      <section className="settle-hero">
        <small>Available balance</small>
        <h1 className="num">{formatINR(dash.availablePaise)}</h1>
        <p>{data.merchant.bankName} ••{data.merchant.bankAccountLast4}</p>
        <button disabled={busy || !canSettle} onClick={run}>{busy ? 'Settling…' : 'Settle now'}<ArrowRight aria-hidden="true" /></button>
        {!canSettle && <p className="settle-hint">You need at least ₹50 available before you can settle.</p>}
      </section>
      {message && <div className={`alert ${message.startsWith('Settlement') ? 'success' : 'error'}`} role="status">{message}</div>}
      <div className="stat-grid">
        <div><small>Credited today</small><strong><Money paise={dash.todaySettlementPaise} /></strong></div>
        <div><small>Upcoming</small><strong><Money paise={dash.upcomingPaise} /></strong></div>
      </div>
      <SectionTitle>Settlement history</SectionTitle>
      <section className="list-card">
        {data.settlements.length ? data.settlements.map((s) => <div className="settlement-row" key={s.id}>
          <span className={`txn-icon ${s.status === 'completed' ? 'success' : 'pending'}`} aria-hidden="true">
            {s.status === 'completed' ? <Check /> : <Clock3 />}
          </span>
          <span>
            <b>{s.mode === 'instant' ? 'Instant settlement' : 'Daily settlement'}</b>
            <small className="num">{formatDayLabel(s.completedAt ?? s.expectedDate, data.demoClock)} · {s.transactionIds.length} payments</small>
          </span>
          <strong><Money paise={s.amountPaise} /><small>{s.status}</small></strong>
        </div>) : <EmptyState icon={<Banknote />} title="No settlements yet" text="Settlements appear here once money moves to your bank." />}
      </section>
    </Page>
  </>
}

/* -------------------------------------------------------------------------- */
/* Insights                                                                   */
/* -------------------------------------------------------------------------- */

function ChartTooltip({ active, payload, label, unit }: {
  active?: boolean; payload?: { value?: number | string }[]; label?: string | number; unit: 'money' | 'count'
}) {
  if (!active || !payload?.length) return null
  const value = Number(payload[0]?.value ?? 0)
  return <div className="chart-tooltip">
    {label}
    <b>{unit === 'money' ? formatINR(Math.round(value * 100)) : `${value} payments`}</b>
  </div>
}

function InsightsPage() {
  const data = useData()
  const reducedMotion = usePrefersReducedMotion()
  const insights = intelligenceEngine.generate(data)
  const series = dailySalesSeries(data, 14).map((d) => ({ ...d, rupees: d.paise / 100 }))
  const hours = hourlyActivity(data).filter((h) => h.hour >= 6 && h.hour <= 22).map((h) => ({ ...h, label: `${h.hour % 12 || 12}${h.hour < 12 ? 'am' : 'pm'}` }))
  const repeat = returningShare(data)
  const hasSales = series.some((point) => point.rupees > 0)
  const hasHours = hours.some((point) => point.count > 0)
  const best = [...series].sort((a, b) => b.rupees - a.rupees)[0]
  return <>
    <PageHeader title="Insights" back />
    <Page>
      <div className="insights-title">
        <span aria-hidden="true"><Sparkles /></span>
        <div><h1>Business insights</h1><p>Answers from your own payment activity</p></div>
      </div>

      <section className="chart-card">
        <h2>How are sales trending?</h2>
        <p>Daily sales for the last 14 days, in rupees.</p>
        {hasSales ? <>
          <div className="chart-legend"><span><i aria-hidden="true" />Daily sales (₹)</span></div>
          <div role="img" aria-label={`Line chart of daily sales over 14 days. Best day ${best?.label ?? ''} at ${formatINR(Math.round((best?.rupees ?? 0) * 100))}.`}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={series} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="sales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00baf2" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#00baf2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e7ebf0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#54606f' }} interval="preserveStartEnd" minTickGap={16} tickLine={false} />
                <YAxis width={48} tick={{ fontSize: 11, fill: '#54606f' }} tickLine={false} axisLine={false}
                  tickFormatter={(value: number) => `₹${value >= 1000 ? `${Math.round(value / 1000)}k` : value}`} />
                <Tooltip content={<ChartTooltip unit="money" />} />
                <Area type="monotone" dataKey="rupees" name="Daily sales" stroke="#012b72" fill="url(#sales)" strokeWidth={2}
                  isAnimationActive={!reducedMotion} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="chart-tip">Tap any point to see the exact amount.</p>
        </> : <div className="chart-empty">No sales in the last 14 days yet. Collect a payment and the trend will appear here.</div>}
      </section>

      <section className="chart-card">
        <h2>When are customers active?</h2>
        <p>Number of payments by hour of the day.</p>
        {hasHours ? <>
          <div className="chart-legend"><span><i className="bar" aria-hidden="true" />Payments per hour</span></div>
          <div role="img" aria-label="Bar chart of payment counts by hour between 6am and 10pm.">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={hours} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#e7ebf0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#54606f' }} interval={2} tickLine={false} />
                <YAxis width={36} allowDecimals={false} tick={{ fontSize: 11, fill: '#54606f' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip unit="count" />} cursor={{ fill: '#eef2f7' }} />
                <Bar dataKey="count" name="Payments" fill="#00688c" radius={[4, 4, 0, 0]} isAnimationActive={!reducedMotion} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </> : <div className="chart-empty">Not enough payments yet to show busy hours.</div>}
      </section>

      <div className="answer-grid">
        <div><small>Average ticket</small><b><Money paise={averageTicket(data)} /></b></div>
        <div><small>Repeat customers</small><b className="num">{repeat.returningPct.toFixed(0)}%</b></div>
      </div>

      <SectionTitle>What should I know?</SectionTitle>
      <section className="insight-list">
        {insights.length ? insights.map((i) => <article className={`insight-card ${i.priority}`} key={i.id}>
          <span aria-hidden="true"><Sparkles /></span>
          <div><small>{i.metricLabel}</small><h3>{i.title}</h3><p>{i.description}</p></div>
          {i.metricValue && <b>{i.metricValue}</b>}
        </article>) : <EmptyState icon={<Lightbulb />} title="No insights yet" text="Insights appear once there are a few days of payments to compare." />}
      </section>
    </Page>
  </>
}

/* -------------------------------------------------------------------------- */
/* Notifications, search, profile                                             */
/* -------------------------------------------------------------------------- */

function NotificationsPage() {
  const data = useData()
  const mark = useMerchantStore((s) => s.markNotificationRead)
  const markAll = useMerchantStore((s) => s.markAllNotificationsRead)
  const navigate = useNavigate()
  const unread = data.notifications.filter((n) => !n.read).length
  return <>
    <PageHeader title="Notifications" back action={
      unread > 0 ? <button className="header-link" onClick={markAll}>Mark all read</button> : undefined
    } />
    <Page className="notification-list">
      <h1 className="sr-only">Notifications</h1>
      {data.notifications.length ? data.notifications.map((n) => <button className={!n.read ? 'unread' : ''} key={n.id}
        onClick={() => { mark(n.id); if (n.relatedRoute) navigate(n.relatedRoute) }}>
        <span className={`notif-icon ${n.type}`} aria-hidden="true">
          {n.type === 'payment_received' ? <IndianRupee /> : n.type === 'settlement' ? <Banknote /> : n.type === 'insight' ? <Sparkles /> : <Bell />}
        </span>
        <div>
          <b>{n.title}</b><p>{n.body}</p>
          <small>{formatDayLabel(n.createdAt, data.demoClock)}, {formatTime(n.createdAt)}</small>
        </div>
        {!n.read && <i aria-label="Unread" />}
      </button>) : <EmptyState icon={<Bell />} title="You’re all caught up" text="Payment, settlement and business updates will appear here." />}
    </Page>
  </>
}

function SearchPage() {
  const data = useData()
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const q = query.toLowerCase()
  const txns = q ? [...data.transactions].filter((t) => `${t.customerName} ${t.referenceId} ${t.amountPaise / 100}`.toLowerCase().includes(q)).slice(0, 8) : []
  const customers = q ? data.customers.filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(q)).slice(0, 5) : []
  return <>
    <PageHeader title="Search" back />
    <Page>
      <h1 className="sr-only">Search</h1>
      <label className="search-box large">
        <Search aria-hidden="true" />
        <span className="sr-only">Search payments and customers</span>
        <input type="search" autoFocus placeholder="Search payments and customers" value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && <button onClick={() => setQuery('')} aria-label="Clear search"><X /></button>}
      </label>
      {!query ? <EmptyState icon={<Search />} title="Search your business"
        text="Find a payment by name, amount or reference — or look up a customer." /> : <>
        <SectionTitle>Customers</SectionTitle>
        <section className="list-card">
          {customers.length ? customers.map((c) => <button className="simple-result" onClick={() => navigate(`/customers/${c.id}`)} key={c.id}>
            <span className="avatar" aria-hidden="true">{c.name.split(' ').map((x) => x[0]).slice(0, 2)}</span>
            <span><b>{c.name}</b><small>{c.phone}</small></span>
            <ChevronRight aria-hidden="true" />
          </button>) : <p className="no-result">No matching customers</p>}
        </section>
        <SectionTitle>Payments</SectionTitle>
        <section className="list-card">
          {txns.length ? txns.map((t) => <TransactionRow key={t.id} txn={t} />) : <p className="no-result">No matching payments</p>}
        </section>
      </>}
    </Page>
  </>
}

function ProfilePage() {
  const data = useData()
  const setSoundbox = useMerchantStore((s) => s.setSoundbox)
  const updatePrefs = useMerchantStore((s) => s.updatePreferences)
  const reset = useMerchantStore((s) => s.resetDemo)
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  return <>
    <PageHeader title="Profile" />
    <Page>
      <section className="profile-hero">
        <span className="shop-avatar" aria-hidden="true"><Store /></span>
        <h1>{data.merchant.businessName}</h1>
        <p>{data.merchant.ownerName}</p>
        <span className="profile-chip">{data.merchant.category}</span>
      </section>

      <SectionTitle>Business details</SectionTitle>
      <section className="detail-card">
        <Detail label="Merchant ID" value={data.merchant.mid} mono />
        {/* The QR encodes this exact handle, so it is the one worth showing. */}
        <Detail label="UPI ID on your QR" value={merchantVpa()} mono />
        <Detail label="Phone" value={data.merchant.phone} />
        <Detail label="Bank account" value={`${data.merchant.bankName} ••${data.merchant.bankAccountLast4}`} />
        <Detail label="Store address" value={`${data.merchant.address}, ${data.merchant.city} ${data.merchant.pincode}`} />
      </section>

      <SectionTitle>At the counter</SectionTitle>
      <section className="settings-card">
        <Toggle label="Soundbox announcements" text="Announce every payment out loud"
          value={data.merchant.soundboxEnabled} onChange={setSoundbox} />
      </section>

      <SectionTitle>Notifications</SectionTitle>
      <section className="settings-card">
        <Toggle label="Payment alerts" value={data.preferences.paymentAlerts} onChange={(v) => updatePrefs({ paymentAlerts: v })} />
        <Toggle label="Settlement alerts" value={data.preferences.settlementAlerts} onChange={(v) => updatePrefs({ settlementAlerts: v })} />
        <Toggle label="Business insights" value={data.preferences.insightAlerts} onChange={(v) => updatePrefs({ insightAlerts: v })} />
      </section>

      <SectionTitle>About</SectionTitle>
      <section className="about-card">
        <p>
          Ek Photo Dukaan is an independent hackathon prototype. It is not an official Paytm
          product and is not affiliated with or endorsed by Paytm.
        </p>
        <p>
          Payments, settlements and supplier payouts on this build are simulated on-device.
          No live Paytm, bank or WhatsApp Business integration is connected, and no real money
          moves. Merchant, customer and supplier records are sample data.
        </p>
      </section>

      <details className="quiet-details">
        <summary><Settings />Advanced</summary>
        <div className="details-body">
          <p>Fixed outcomes for walkthroughs: collecting ₹13, or any note containing
            “fail”, always fails. Every other amount succeeds or goes to processing.</p>
          <p>Resetting restores the sample merchant, payments and catalog to their original
            state. Anything you have edited on this device is lost.</p>
          <button className="reset-btn" disabled={busy} onClick={async () => {
            if (!window.confirm('Reset all activity and preferences to the original sample data?')) return
            setBusy(true)
            try { await reset(); toast({ text: 'Sample data restored' }) }
            catch { toast({ text: 'Could not reset. Check the connection and try again.', tone: 'error' }) }
            finally { setBusy(false) }
          }}><RefreshCw />{busy ? 'Restoring…' : 'Reset to sample data'}</button>
        </div>
      </details>
    </Page>
  </>
}

function NotFound() {
  const navigate = useNavigate()
  return <>
    <PageHeader title="Not found" back />
    <Page>
      <h1 className="sr-only">Page not found</h1>
      <EmptyState icon={<CircleAlert />} title="Page not found" text="The page you asked for does not exist." />
      <button className="primary full" onClick={() => navigate('/')}><Home />Go home</button>
    </Page>
  </>
}

/* -------------------------------------------------------------------------- */
/* Small shared pieces                                                        */
/* -------------------------------------------------------------------------- */

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div className="detail-row"><span>{label}</span><strong className={mono ? 'mono' : ''}>{value}</strong></div>
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="form-field">
    <span>{label}</span>
    {children}
    {hint && <p className="field-hint">{hint}</p>}
  </label>
}

function Toggle({ label, text, value, onChange }: { label: string; text?: string; value: boolean; onChange: (v: boolean) => void }) {
  return <label className="toggle-row">
    <span><b>{label}</b>{text && <small>{text}</small>}</span>
    <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    <i aria-hidden="true" />
  </label>
}

function MenuItem({ icon, title, text, to }: { icon: React.ReactNode; title: string; text: string; to: string }) {
  const navigate = useNavigate()
  return <button onClick={() => navigate(to)}>
    <span className="menu-icon" aria-hidden="true">{icon}</span>
    <span><b>{title}</b><small>{text}</small></span>
    <ChevronRight aria-hidden="true" />
  </button>
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="empty-state">
    <span aria-hidden="true">{icon}</span>
    <h2>{title}</h2>
    <p>{text}</p>
  </div>
}

/* -------------------------------------------------------------------------- */
/* Shell                                                                      */
/* -------------------------------------------------------------------------- */

const tabs = [
  { to: '/', label: 'Home', icon: <Home /> },
  { to: '/payments', label: 'Payments', icon: <WalletCards /> },
  { to: '/business', label: 'Business', icon: <Building2 /> },
  { to: '/profile', label: 'Profile', icon: <Settings /> },
]

function AppShell() {
  const location = useLocation()
  const bootStatus = useMerchantStore((state) => state.bootStatus)
  const actionError = useMerchantStore((state) => state.actionError)
  const syncFromApi = useMerchantStore((state) => state.syncFromApi)
  /* The store starts 'idle' and returns to 'idle' once synced, so the first
     paint would otherwise flash an empty dukaan before the data lands. */
  const [firstSyncDone, setFirstSyncDone] = useState(false)
  useEffect(() => { void syncFromApi().finally(() => setFirstSyncDone(true)) }, [syncFromApi])

  /* Move focus to the main region after every route change. */
  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true })
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  const hideNav = ['/collect', '/qr', '/search', '/notifications', '/insights', '/settlements', '/customers', '/dukaan'].some((p) => location.pathname.startsWith(p)) || /^\/payments\/.+/.test(location.pathname)

  if (bootStatus === 'loading' || !firstSyncDone) {
    return <div className="device-shell"><div className="app-surface no-nav">
      <PageHeader title="Loading" brand />
      <Page>
        <h1 className="sr-only">Loading</h1>
        <div className="skeleton" style={{ height: 132, borderRadius: 'var(--radius-xl)', marginBottom: 'var(--space-3)' }} />
        <div className="skeleton" style={{ height: 76, borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-3)' }} />
        <ListSkeleton rows={4} />
      </Page>
    </div></div>
  }
  if (bootStatus === 'error') {
    return <div className="device-shell"><div className="app-surface no-nav">
      <PageHeader title="Can’t connect" brand />
      <Page>
        <h1 className="sr-only">Can’t connect</h1>
        <EmptyState icon={<CircleAlert />} title="Couldn’t load your business"
          text={actionError ?? 'Check your connection and try again.'} />
        <button className="primary full" onClick={() => void syncFromApi()}><RefreshCw />Try again</button>
      </Page>
    </div></div>
  }

  return <div className="device-shell"><div className={`app-surface${hideNav ? ' no-nav' : ''}`}>
    <a className="skip-link" href="#main">Skip to main content</a>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/payments" element={<PaymentsPage />} />
      <Route path="/payments/:id" element={<PaymentDetailPage />} />
      <Route path="/collect" element={<CollectPage />} />
      <Route path="/qr" element={<QRPage />} />
      <Route path="/business" element={<BusinessPage />} />
      <Route path="/customers" element={<CustomersPage />} />
      <Route path="/customers/:id" element={<CustomerDetailPage />} />
      <Route path="/settlements" element={<SettlementsPage />} />
      <Route path="/insights" element={<InsightsPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/dukaan/scan" element={<DukaanScanPage />} />
      <Route path="/dukaan/invoice" element={<SupplierInvoicePage />} />
      <Route path="/dukaan/manage" element={<DukaanManagePage />} />
      <Route path="/dukaan/:slug" element={<PublicDukaanPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    {!hideNav && <nav className="bottom-nav" aria-label="Main">
      {tabs.map((t) => <NavLink to={t.to} end={t.to === '/'} key={t.to}>{t.icon}<span>{t.label}</span></NavLink>)}
    </nav>}
  </div></div>
}

export default function App() {
  return <HashRouter><ToastHost><AppShell /></ToastHost></HashRouter>
}
