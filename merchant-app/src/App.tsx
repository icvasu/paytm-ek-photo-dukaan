import { useEffect, useMemo, useState } from 'react'
import {
  HashRouter, NavLink, Route, Routes, useLocation, useNavigate, useParams,
} from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Banknote, Bell, BellRing, Building2, Camera, Check,
  ChevronRight, CircleAlert, Clock3, Copy, Eye, Home, Image, IndianRupee, Lightbulb,
  MessageCircle, Package, Plus, QrCode, ReceiptText, RefreshCw, Search, Settings, Sparkles,
  Store, Trash2, Truck, Upload, Users, WalletCards, X,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis,
} from 'recharts'
import './App.css'
import './Dukaan.css'
import { useMerchantStore } from './store/useMerchantStore'
import { averageTicket, customerStats, dailySalesSeries, deriveDashboard, hourlyActivity, returningShare } from './domain/metrics'
import { intelligenceEngine, paytmService } from './services/container'
import { formatINR } from './lib/money'
import { formatDayLabel, formatTime } from './lib/dates'
import type { PaymentMethod, Transaction } from './types/models'
import { demoVisionService } from './services/vision/VisionService'
import { buildStockForecasts } from './intelligence/engine'
import type { BasketLine, CatalogItem, DukaanCatalog } from './types/models'

const methodName: Record<PaymentMethod, string> = {
  upi: 'UPI', paytm_wallet: 'Paytm Wallet', card: 'Card', netbanking: 'Net banking',
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

function PageHeader({ title, back, action }: { title: string; back?: boolean; action?: React.ReactNode }) {
  const navigate = useNavigate()
  return <header className="page-header">
    <div className="header-row">
      {back && <button className="icon-btn on-navy" onClick={() => navigate(-1)} aria-label="Go back"><ArrowLeft /></button>}
      <div className="brand-mark">{back ? title : <><span>pay</span><b>tm</b> <small>for Business</small><em>PROTOTYPE</em></>}</div>
      {action ?? <span className="header-spacer" />}
    </div>
  </header>
}

function TransactionRow({ txn }: { txn: Transaction }) {
  const navigate = useNavigate()
  const statusIcon = txn.status === 'success' ? <Check /> : txn.status === 'pending' ? <Clock3 /> : <X />
  return <button className="txn-row" onClick={() => navigate(`/payments/${txn.id}`)}>
    <span className={`txn-icon ${txn.status}`}>{statusIcon}</span>
    <span className="txn-main"><strong>{txn.customerName}</strong><small>{formatTime(txn.createdAt)} · {methodName[txn.paymentMethod]}</small></span>
    <span className="txn-amount"><strong>{formatINR(txn.amountPaise)}</strong><small className={`status ${txn.status}`}>{txn.status}</small></span>
  </button>
}

function SectionTitle({ children, link, label = 'View all' }: { children: React.ReactNode; link?: string; label?: string }) {
  const navigate = useNavigate()
  return <div className="section-title"><h2>{children}</h2>{link && <button onClick={() => navigate(link)}>{label}<ChevronRight /></button>}</div>
}

function HomePage() {
  const data = useData()
  const dash = deriveDashboard(data)
  const insight = intelligenceEngine.generate(data)[0]
  const navigate = useNavigate()
  const unread = data.notifications.filter((n) => !n.read).length
  return <>
    <PageHeader title="Home" action={<div className="header-actions">
      <button className="icon-btn on-navy" onClick={() => navigate('/search')} aria-label="Search"><Search /></button>
      <button className="icon-btn on-navy bell-btn" onClick={() => navigate('/notifications')} aria-label="Notifications"><Bell />{unread > 0 && <i>{unread}</i>}</button>
    </div>} />
    <main className="page home-page">
      <div className="welcome"><div><small>Good afternoon, Meena</small><h1>Today’s business</h1></div><span className="live-pill">● LIVE DEMO</span></div>
      <button className="dukaan-shortcut hero" onClick={() => navigate(data.catalog ? '/dukaan/manage' : '/dukaan/scan')}>
        <span><Camera /></span>
        <div><small>EK PHOTO DUKAAN · DEMO AI</small><strong>{data.catalog ? 'Your digital dukaan is ready' : 'Scan shop. Build dukaan.'}</strong><p>{data.catalog ? `${data.catalog.items.length} items · Manage, QR & share` : 'One photo → catalog, QR, share & restock hints'}</p></div>
        <ChevronRight />
      </button>
      <section className="sales-card">
        <div className="eyebrow">TODAY’S SALES</div>
        <div className="hero-amount">{formatINR(dash.salesToday)}</div>
        <div className="sales-meta"><span><b>{dash.successToday}</b> successful</span><span><b>{dash.pendingToday}</b> pending</span><span><b>{dash.failedToday}</b> failed</span></div>
      </section>
      <div className="quick-grid">
        <button onClick={() => navigate('/collect')}><span className="quick-icon cyan"><IndianRupee /></span><b>Collect</b><small>Request payment</small></button>
        <button onClick={() => navigate('/qr')}><span className="quick-icon navy"><QrCode /></span><b>My QR</b><small>Show to customer</small></button>
      </div>
      <section className="balance-card" onClick={() => navigate('/settlements')}>
        <div><small>Available for settlement</small><strong>{formatINR(dash.availablePaise)}</strong><span>To HDFC Bank ••{data.merchant.bankAccountLast4}</span></div>
        <div className="round-arrow"><ArrowRight /></div>
      </section>
      {insight && <button className="insight-teaser" onClick={() => navigate('/insights')}>
        <span><Sparkles /></span><div><small>SMART BUSINESS INSIGHT</small><strong>{insight.title}</strong><p>{insight.description}</p></div><ChevronRight />
      </button>}
      <SectionTitle link="/payments">Recent payments</SectionTitle>
      <section className="list-card">{dash.recent.slice(0, 5).map((txn) => <TransactionRow txn={txn} key={txn.id} />)}</section>
      <p className="prototype-note">Hackathon prototype · Not an official Paytm product</p>
    </main>
  </>
}

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
  return <>
    <PageHeader title="Payments" />
    <main className="page">
      <div className="title-row"><div><h1>Payments</h1><p>{data.transactions.length} transactions</p></div><WalletCards /></div>
      <label className="search-box"><Search /><input placeholder="Search name, amount or reference" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All status</option><option value="success">Success</option><option value="failed">Failed</option><option value="pending">Pending</option><option value="refunded">Refunded</option></select>
        <select value={method} onChange={(e) => setMethod(e.target.value)}><option value="all">All methods</option><option value="upi">UPI</option><option value="paytm_wallet">Wallet</option><option value="card">Card</option></select>
        <select value={range} onChange={(e) => setRange(e.target.value)}><option value="all">All dates</option><option value="1">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="latest">Latest</option><option value="amount">Highest amount</option></select>
      </div>
      <div className="result-label">{rows.length} results</div>
      <section className="list-card">{rows.length ? rows.map((t) => <TransactionRow key={t.id} txn={t} />) : <EmptyState icon={<Search />} title="No payments found" text="Try changing your search or filters." />}</section>
    </main>
  </>
}

function PaymentDetailPage() {
  const { id } = useParams()
  const data = useData()
  const txn = data.transactions.find((t) => t.id === id)
  const refund = useMerchantStore((s) => s.refundTransaction)
  const confirm = useMerchantStore((s) => s.confirmPending)
  const attachBasket = useMerchantStore((s) => s.attachBasket)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const suggestedBasket = txn && data.catalog ? decomposeBasket(txn.amountPaise, data.catalog.items) : []
  const existingBasket = (data.basketAssignments ?? []).find((assignment) => assignment.transactionId === txn?.id)
  if (!txn) return <><PageHeader title="Payment details" back /><main className="page"><EmptyState icon={<CircleAlert />} title="Payment not found" text="This transaction does not exist." /></main></>
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
    <main className="page">
      <section className="receipt">
        <span className={`receipt-icon ${txn.status}`}>{txn.status === 'success' ? <Check /> : txn.status === 'pending' ? <Clock3 /> : <X />}</span>
        <p>{txn.status === 'success' ? 'Payment received' : txn.status === 'pending' ? 'Payment processing' : txn.status === 'refunded' ? 'Payment refunded' : 'Payment failed'}</p>
        <h1>{formatINR(txn.amountPaise)}</h1><small>{formatDayLabel(txn.createdAt, data.demoClock)}, {formatTime(txn.createdAt)}</small>
      </section>
      {txn.failureReason && <div className="alert error"><CircleAlert />{txn.failureReason}</div>}
      <section className="detail-card">
        <Detail label="Customer" value={txn.customerName} />
        <Detail label="Payment method" value={methodName[txn.paymentMethod]} />
        <Detail label="Order reference" value={txn.referenceId} mono />
        {txn.upiTxnId && <Detail label="UPI transaction ID" value={txn.upiTxnId} mono />}
        <Detail label="Settlement" value={txn.settlementId ? `Settled · ${txn.settlementId}` : txn.status === 'success' ? 'Available to settle' : 'Not applicable'} />
        {txn.note && <Detail label="Note" value={txn.note} />}
      </section>
      {txn.status === 'success' && data.catalog && <section className="basket-card">
        <small>PAYMENT → ITEMS · DEMO</small><h2>Yeh payment kis saman ka tha?</h2>
        {existingBasket
          ? <p className="basket-result"><Check />{existingBasket.lines.map((line) => `${line.quantity}× ${line.itemName}`).join(', ')}</p>
          : suggestedBasket.length
            ? <><p>Amount-based suggestion: {suggestedBasket.map((line) => `${line.quantity}× ${line.itemName}`).join(', ')}</p>
              <button className="primary full" disabled={busy} onClick={async () => {
                setBusy(true)
                try { await attachBasket(txn.id, suggestedBasket); setMessage('Basket attached. Stock forecast updated.') } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Could not attach basket') } finally { setBusy(false) }
              }}>Confirm items / सामान जोड़ें</button></>
            : <p>No exact catalog basket matches {formatINR(txn.amountPaise)}. Collect a catalog-priced payment, then attach it here.</p>}
        <small>Merchant-confirmed heuristic; Paytm amount alone does not identify every basket.</small>
      </section>}
      {message && <div className={`alert ${/fail|could not/i.test(message) ? 'error' : 'success'}`}>{message}</div>}
      {txn.status === 'success' && !txn.settlementId && <button className="outline-danger full" disabled={busy} onClick={doRefund}>{busy ? 'Processing refund…' : 'Refund payment'}</button>}
      {txn.status === 'pending' && <div className="button-pair"><button className="secondary" disabled={busy} onClick={() => void doConfirm(false)}>Mark failed</button><button className="primary" disabled={busy} onClick={() => void doConfirm(true)}>{busy ? 'Updating…' : 'Confirm success'}</button></div>}
    </main>
  </>
}

function decomposeBasket(amountPaise: number, items: CatalogItem[]): BasketLine[] {
  const available = items.filter((item) => item.available && item.pricePaise > 0).slice(0, 15)
  const exact = available.find((item) => item.pricePaise === amountPaise)
  if (exact) {
    return [{ skuId: exact.id, itemName: exact.name, quantity: 1, pricePaise: exact.pricePaise }]
  }
  for (const item of available) {
    if (amountPaise % item.pricePaise === 0 && amountPaise / item.pricePaise <= 6) {
      return [{ skuId: item.id, itemName: item.name, quantity: amountPaise / item.pricePaise, pricePaise: item.pricePaise }]
    }
  }
  for (let first = 0; first < available.length; first += 1) {
    for (let second = first + 1; second < available.length; second += 1) {
      for (let q1 = 1; q1 <= 4; q1 += 1) {
        for (let q2 = 1; q2 <= 4; q2 += 1) {
          if (available[first].pricePaise * q1 + available[second].pricePaise * q2 === amountPaise) {
            return [
              { skuId: available[first].id, itemName: available[first].name, quantity: q1, pricePaise: available[first].pricePaise },
              { skuId: available[second].id, itemName: available[second].name, quantity: q2, pricePaise: available[second].pricePaise },
            ]
          }
        }
      }
    }
  }
  return []
}

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
  if (stage === 'processing') return <><PageHeader title="Collect payment" back /><main className="page centered"><div className="spinner" /><h1>Processing payment</h1><p>Waiting for confirmation…</p></main></>
  if (stage === 'success') return <><PageHeader title="Payment received" back /><main className="page centered result-page"><span className="big-success"><Check /></span><p>Payment received</p><h1>{formatINR(txn!.amountPaise)}</h1><small>from {txn!.customerName}</small>{data.merchant.soundboxEnabled && <div className="soundbox"><BellRing /><div><b>Soundbox announcement</b><span>“Received {formatINR(txn!.amountPaise)}”</span></div></div>}<button className="primary full" onClick={() => navigate(`/payments/${txn!.id}`)}>View payment</button><button className="text-btn" onClick={() => { setAmount(''); setNote(''); setStage('form') }}>Collect another</button></main></>
  if (stage === 'failed') return <><PageHeader title="Payment failed" back /><main className="page centered result-page"><span className="big-fail"><X /></span><h1>Payment failed</h1><p>{error}</p><button className="primary full" onClick={() => setStage('form')}>Try again</button></main></>
  return <>
    <PageHeader title="Collect payment" back />
    <main className="page">
      <div className="title-row"><div><h1>Collect payment</h1><p>Send a simulated payment request</p></div><IndianRupee /></div>
      <label className="amount-input"><span>₹</span><input inputMode="decimal" autoFocus placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <FormField label="Choose customer"><select value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Walk-in customer</option>{data.customers.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></FormField>
      {!customerId && <FormField label="Customer name (optional)"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Walk-in customer" /></FormField>}
      <FormField label="Payment method"><div className="method-grid">{(['upi', 'paytm_wallet', 'card', 'netbanking'] as PaymentMethod[]).map((m) => <button className={method === m ? 'selected' : ''} key={m} onClick={() => setMethod(m)}>{methodName[m]}</button>)}</div></FormField>
      <FormField label="Note (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Grocery order" /></FormField>
      <div className="demo-hint">Demo tip: ₹13 or a note containing “fail” simulates failure.</div>
      <button className="primary full sticky-action" disabled={!amount || Number(amount) <= 0} onClick={submit}>Collect {Number(amount) > 0 ? `₹${Number(amount).toLocaleString('en-IN')}` : 'payment'}</button>
    </main>
  </>
}

function QRPage() {
  const data = useData()
  const collect = useMerchantStore((s) => s.collectPayment)
  const [amount, setAmount] = useState('')
  const [stage, setStage] = useState<'ready' | 'processing' | 'done' | 'failed'>('ready')
  const [txn, setTxn] = useState<Transaction | null>(null)
  const payload = paytmService.qrPayload(data.merchant.vpa, data.merchant.businessName, Number(amount) || undefined)
  const simulate = async () => {
    setStage('processing')
    try { const t = await collect({ amountRupees: Number(amount), paymentMethod: 'upi', customerName: 'QR customer', note: 'QR counter payment' }); setTxn(t); setStage(t.status === 'success' ? 'done' : 'failed') } catch { setStage('failed') }
  }
  return <>
    <PageHeader title="My QR" back />
    <main className="page qr-page">
      <section className="qr-card">
        <div className="qr-brand"><span>pay</span><b>tm</b></div>
        <h2>{data.merchant.businessName}</h2><p>Scan & pay securely</p>
        <div className="qr-wrap"><QRCodeSVG value={payload} size={210} level="H" fgColor="#012b72" /></div>
        <strong>{data.merchant.vpa}</strong>
      </section>
      {stage === 'done' ? <div className="alert success"><Check />Received {formatINR(txn!.amountPaise)}. Dashboard updated.</div> : stage === 'failed' ? <div className="alert error"><X />Payment failed. Change amount and retry.</div> : <FormField label="Add amount to QR"><div className="input-prefix"><span>₹</span><input inputMode="decimal" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} /></div></FormField>}
      {stage === 'done' ? <button className="primary full" onClick={() => { setAmount(''); setStage('ready') }}>Create another QR payment</button> : <button className="primary full" disabled={!amount || stage === 'processing'} onClick={simulate}>{stage === 'processing' ? 'Customer is paying…' : 'Simulate customer payment'}</button>}
      <p className="prototype-note">Demo QR payload only · No real payment API is used</p>
    </main>
  </>
}

type ScanStage = 'idle' | 'uploading' | 'reading' | 'building' | 'error'

function DukaanScanPage() {
  const navigate = useNavigate()
  const createCatalog = useMerchantStore((s) => s.createCatalog)
  const [stage, setStage] = useState<ScanStage>('idle')
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')

  const processFile = async (file: File, imageUrl?: string) => {
    if (!file.type.startsWith('image/')) {
      setError('Choose a JPG, PNG, WebP or demo shop image.')
      setStage('error')
      return
    }
    setError('')
    setPreview(imageUrl ?? URL.createObjectURL(file))
    try {
      setStage('uploading')
      await wait(650)
      setStage('reading')
      const result = await demoVisionService.analyze({ fileName: file.name, fileSize: file.size, imageType: file.type })
      await wait(750)
      setStage('building')
      await createCatalog({ ...result, sourceImageName: file.name })
      await wait(650)
      navigate('/dukaan/manage')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not build the catalog. Try the demo photo.')
      setStage('error')
    }
  }

  const processSample = async (path: string, name: string) => {
    try {
      const response = await fetch(path)
      if (!response.ok) throw new Error('Demo image is unavailable')
      const blob = await response.blob()
      await processFile(new File([blob], name, { type: blob.type || 'image/svg+xml' }), path)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load demo image')
      setStage('error')
    }
  }

  if (stage !== 'idle' && stage !== 'error') {
    const copy = stage === 'uploading'
      ? ['Uploading photo', 'Keeping one clear shop image ready']
      : stage === 'reading'
        ? ['Reading shelf', 'Finding products, visible prices and stock cues']
        : ['Building catalog', 'Creating your editable digital dukaan']
    return <>
      <PageHeader title="Ek Photo Dukaan" back />
      <main className="page scan-processing">
        <div className="scan-preview">{preview && <img src={preview} alt="Selected shop" />}<span><Sparkles /></span></div>
        <div className="spinner" />
        <small>DEMO VISION · HEURISTIC</small><h1>{copy[0]}</h1><p>{copy[1]}…</p>
        <div className="stage-track"><i className="done" /><i className={stage !== 'uploading' ? 'done' : ''} /><i className={stage === 'building' ? 'done' : ''} /></div>
        <p className="vision-disclosure">No production OCR is running. Seeded demo images map deterministically; unknown photos receive an editable starter list.</p>
      </main>
    </>
  }

  return <>
    <PageHeader title="Ek Photo Dukaan" back />
    <main className="page">
      <section className="scan-hero">
        <span><Camera /></span><small>ONE PHOTO · ZERO DATA ENTRY</small>
        <h1>Photo lo. Dukaan banao.</h1>
        <p>Take one clear photo of your shelf, counter or printed price list. We’ll make an editable catalog, QR and share text.</p>
      </section>
      {error && <div className="alert error"><CircleAlert />{error}</div>}
      <label className="capture-button">
        <Camera /><span><b>Take shop photo</b><small>दुकान की फोटो लें</small></span>
        <input type="file" accept="image/*" capture="environment" onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void processFile(file)
        }} />
      </label>
      <label className="upload-button">
        <Upload />Upload one image
        <input type="file" accept="image/*" onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void processFile(file)
        }} />
      </label>
      <SectionTitle>Or use a reliable demo photo</SectionTitle>
      <div className="sample-grid">
        <button onClick={() => void processSample('/demo/meena-kirana-shelf.svg', 'meena-kirana-shelf.svg')}><img src="/demo/meena-kirana-shelf.svg" alt="Meena Kirana shelf demo" /><b>Meena’s shelf</b><small>10 kirana items</small></button>
        <button onClick={() => void processSample('/demo/tea-counter-rate-card.svg', 'tea-counter-rate-card.svg')}><img src="/demo/tea-counter-rate-card.svg" alt="Printed tea counter rate card demo" /><b>Printed rate card</b><small>12 counter items</small></button>
      </div>
      <div className="demo-boundary"><Sparkles /><p><b>Honest demo boundary</b><br />Seeded photos use deterministic mappings. Other images get a visual-heuristic starter catalog for editing.</p></div>
      <p className="prototype-note">Unofficial hackathon prototype · No real Paytm API or vision model</p>
    </main>
  </>
}

function SupplierInvoicePage() {
  const navigate = useNavigate()
  const catalog = useMerchantStore((s) => s.catalog)
  const saveInvoice = useMerchantStore((s) => s.saveSupplierInvoice)
  const [stage, setStage] = useState<'idle' | 'reading' | 'saving' | 'error'>('idle')
  const [error, setError] = useState('')
  const source = (catalog?.sourceImageName ?? '').toLowerCase()
  const teaShop = catalog?.items.some((item) => item.id === 'chai' || item.id === 'samosa') || /tea|counter|rate/.test(source)
  const sampleName = teaShop ? 'tea-counter-invoice.jpg' : 'meena-kirana-invoice.jpg'
  const sampleLabel = teaShop ? 'Use Sharma Traders demo bill' : 'Use Sri Balaji demo bill'
  const process = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Choose an invoice image.')
      setStage('error')
      return
    }
    try {
      setError('')
      setStage('reading')
      const result = await demoVisionService.analyzeInvoice({ fileName: file.name, fileSize: file.size, imageType: file.type })
      setStage('saving')
      await saveInvoice(result)
      navigate('/dukaan/manage')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save invoice')
      setStage('error')
    }
  }
  if (!catalog) return <><PageHeader title="Supplier invoice" back /><main className="page"><EmptyState icon={<ReceiptText />} title="Scan the shop first" text="Photo one builds the catalog. Photo two adds the supplier bill." /><button className="primary full" onClick={() => navigate('/dukaan/scan')}>Scan shop photo</button></main></>
  if (stage === 'reading' || stage === 'saving') return <>
    <PageHeader title="Supplier invoice" back />
    <main className="page centered scan-processing"><div className="spinner" /><small>DEMO VISION · HEURISTIC</small><h1>{stage === 'reading' ? 'Reading supplier bill' : 'Adding stock-in'}</h1><p>{stage === 'reading' ? 'Finding supplier, quantities and unit costs…' : 'Saving supplier and updating catalog ranges…'}</p></main>
  </>
  return <>
    <PageHeader title="Supplier invoice" back />
    <main className="page">
      <section className="scan-hero invoice"><span><ReceiptText /></span><small>PHOTO TWO · SUPPLIER SETUP</small><h1>Bill ki photo lo.</h1><p>Demo vision extracts supplier, quantities and unit cost. You approve every later order.</p></section>
      {error && <div className="alert error"><CircleAlert />{error}</div>}
      <label className="capture-button"><Camera /><span><b>Take invoice photo</b><small>सप्लायर बिल की फोटो लें</small></span><input type="file" accept="image/*" capture="environment" onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) void process(file)
      }} /></label>
      <button className="sample-invoice" onClick={() => void process(new File(['demo'], sampleName, { type: 'image/jpeg' }))}><ReceiptText /><span><b>{sampleLabel}</b><small>4 lines · deterministic offline sample</small></span><ChevronRight /></button>
      <div className="demo-boundary"><Sparkles /><p><b>DEMO heuristic</b><br />Filename mapping, not production OCR. No payable or bank instruction is created automatically.</p></div>
    </main>
  </>
}

function DukaanManagePage() {
  const data = useData()
  const navigate = useNavigate()
  const updateItem = useMerchantStore((s) => s.updateCatalogItem)
  const addItem = useMerchantStore((s) => s.addCatalogItem)
  const removeItem = useMerchantStore((s) => s.removeCatalogItem)
  const raiseOrder = useMerchantStore((s) => s.raiseSupplierOrder)
  const confirmOrder = useMerchantStore((s) => s.confirmSupplierOrder)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState('')
  const catalog = data.catalog
  if (!catalog) return <><PageHeader title="Ek Photo Dukaan" back /><main className="page"><EmptyState icon={<Image />} title="No dukaan yet" text="Take one shop photo to create your catalog." /><button className="primary full" onClick={() => navigate('/dukaan/scan')}>Scan shop photo</button></main></>

  const link = `${window.location.origin}${window.location.pathname}#/dukaan/${catalog.slug}`
  const available = catalog.items.filter((item) => item.available)
  const needsAttention = catalog.items.filter((item) => !item.available || item.stockFlag === 'low')
  const forecasts = buildStockForecasts(data)
  const reorderForecasts = forecasts.filter((forecast) => forecast.needsReorder)
  const latestOrder = data.supplierOrders?.[0]
  const shareText = `Namaste! ${data.merchant.businessName} ka digital price list dekhiye: ${link}\n${available.slice(0, 4).map((item) => `${item.name} – ${formatINR(item.pricePaise)}`).join('\n')}\nAvailability may change.`
  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setMessage(`${label} copied.`)
    } catch {
      setMessage('Copy was blocked. Open the dukaan and copy from the address bar.')
    }
  }

  return <>
    <PageHeader title="Ek Photo Dukaan" back action={<button className="header-link" onClick={() => navigate(`/dukaan/${catalog.slug}`)}>View live</button>} />
    <main className="page">
      <section className="catalog-summary">
        <div><small>DIGITAL DUKAAN · LIVE</small><h1>{catalog.title}</h1><p>{catalog.items.length} items · {available.length} available</p></div>
        <span><Check /></span>
      </section>
      <div className={`vision-note ${catalog.confidence}`}><Sparkles /><p><b>{catalog.confidence === 'starter' ? 'Starter list — please review' : 'Photo read complete'}</b><br />{catalog.readingNote}</p></div>
      {message && <div className={`alert ${/fail|could not|blocked/i.test(message) ? 'error' : 'success'}`}>{message}</div>}
      <SectionTitle>Catalog / सामान और दाम</SectionTitle>
      <section className="catalog-editor">
        {catalog.items.map((item) => <article key={item.id} className={!item.available ? 'unavailable' : ''}>
          <span className={`stock-dot ${item.stockFlag}`} />
          <div className="item-fields">
            <input aria-label="Item name" defaultValue={item.name} onBlur={(event) => {
              if (event.target.value.trim() !== item.name) void updateItem(item.id, { name: event.target.value })
            }} />
            <span><b className={`stock-text ${item.stockFlag}`}>{item.stockLabel}</b> · {item.category}</span>
          </div>
          <label className="price-edit">₹<input aria-label={`${item.name} price`} inputMode="decimal" defaultValue={item.pricePaise / 100} onBlur={(event) => {
            const price = Number(event.target.value)
            if (Number.isFinite(price) && price >= 0 && price * 100 !== item.pricePaise) void updateItem(item.id, { pricePaise: Math.round(price * 100) })
          }} /></label>
          <button className={`availability ${item.available ? 'on' : ''}`} onClick={() => void updateItem(item.id, { available: !item.available })}>{item.available ? 'Available' : 'Hidden'}</button>
          <button className="remove-item" aria-label={`Remove ${item.name}`} onClick={() => void removeItem(item.id)}><Trash2 /></button>
        </article>)}
        <button className="add-item" disabled={busy === 'add'} onClick={async () => { setBusy('add'); await addItem(); setBusy('') }}><Plus />{busy === 'add' ? 'Adding…' : 'Add item'}</button>
      </section>
      <SectionTitle>Share dukaan</SectionTitle>
      <section className="share-card">
        <div className="mini-qr"><QRCodeSVG value={link} size={104} fgColor="#012b72" /></div>
        <div><b>Customer price list QR</b><p>Scan opens the public-ish catalog. No checkout or payment is implied.</p><button onClick={() => navigate(`/dukaan/${catalog.slug}`)}><Eye />Preview</button></div>
      </section>
      <div className="share-actions">
        <button onClick={() => void copy(link, 'Dukaan link')}><Copy />Copy link</button>
        <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer')}><MessageCircle />WhatsApp</button>
      </div>
      <SectionTitle>Restock hints / फिर से मंगाएं</SectionTitle>
      <section className="restock-card">
        <Package />
        <div><b>{needsAttention.length} items need attention</b><p>{needsAttention.length ? needsAttention.map((item) => item.name).slice(0, 3).join(', ') : 'No low-stock visual flags right now.'}</p><small>Photo cues + seeded payment amount matches · not exact inventory</small></div>
      </section>
      <section className="forecast-list">
        {forecasts.filter((forecast) => forecast.needsReorder).slice(0, 4).map((forecast) => <article key={forecast.skuId}>
          <div><b>{forecast.itemName}</b><small>Estimated {forecast.estimatedMin}–{forecast.estimatedMax} · {forecast.confidencePct}% rule confidence</small></div>
          <strong>{forecast.stockoutDays == null ? 'Low shelf flag' : `~${forecast.stockoutDays} days`}</strong>
        </article>)}
      </section>
      {!data.supplier
        ? <button className="primary full supplier-action" onClick={() => navigate('/dukaan/invoice')}><ReceiptText />Scan supplier bill / बिल जोड़ें</button>
        : <section className="supplier-card">
          <Truck /><div><small>SUPPLIER · DEMO</small><b>{data.supplier.name}</b><p>{data.supplier.lines.length} invoice lines · normal order {formatINR(data.supplier.normalOrderPaise)}</p></div>
          <button disabled={busy === 'order' || latestOrder?.status === 'queued'} onClick={async () => {
            setBusy('order')
            try {
              const matching = data.supplier!.lines.filter((line) => reorderForecasts.some((forecast) => forecast.skuId === line.skuId)).map((line) => line.skuId)
              await raiseOrder(matching)
              setMessage('Supplier order queued. Simulated payout note created.')
            } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Could not raise order') } finally { setBusy('') }
          }}>{busy === 'order' ? 'Queuing…' : latestOrder?.status === 'queued' ? 'Reorder queued' : 'Approve reorder'}</button>
        </section>}
      {latestOrder && <section className={`order-status ${latestOrder.status}`}>
        <div><small>ORDER {latestOrder.status.toUpperCase()} · NO BANK API</small><b>{formatINR(latestOrder.amountPaise)} to {data.supplier?.name}</b><p>{latestOrder.note}</p></div>
        <button className="whatsapp-order" onClick={() => {
          const text = `Namaste ${data.supplier?.name}, ${data.merchant.businessName} ke liye order:\n${latestOrder.lines.map((line) => `${line.quantity} × ${line.itemName}`).join('\n')}\nTotal quote: ${formatINR(latestOrder.amountPaise)}. Please confirm availability. DEMO draft.`
          window.open(`https://wa.me/${data.supplier?.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
        }}><MessageCircle />WhatsApp order draft</button>
        {latestOrder.status === 'queued' && <button disabled={busy === 'confirm'} onClick={async () => {
          setBusy('confirm')
          try { await confirmOrder(latestOrder.id); setMessage('Demo payout confirmed. Stock-in ranges updated.') } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Could not confirm') } finally { setBusy('') }
        }}>Simulate payout confirmation</button>}
      </section>}
      <button className="secondary full rescan" onClick={() => navigate('/dukaan/scan')}><RefreshCw />Scan a different photo</button>
      <p className="prototype-note">Unofficial prototype · Catalog edits are saved by the demo API</p>
    </main>
  </>
}

function PublicDukaanPage() {
  const { slug } = useParams()
  const data = useData()
  const [catalog, setCatalog] = useState<DukaanCatalog | null>(
    data.catalog?.slug === slug ? data.catalog : null,
  )
  const [catalogStatus, setCatalogStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => {
    const controller = new AbortController()
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
        if (error instanceof DOMException && error.name === 'AbortError') return
        setCatalogStatus('error')
      })
    return () => controller.abort()
  }, [slug])
  if (catalogStatus === 'loading' && !catalog) return <><PageHeader title="Digital Dukaan" /><main className="page centered"><div className="spinner" /><h1>Opening digital dukaan</h1><p>Loading the latest catalog…</p></main></>
  if (!catalog || catalog.slug !== slug || catalogStatus === 'error') return <><PageHeader title="Digital Dukaan" /><main className="page"><EmptyState icon={<Store />} title="Dukaan unavailable" text="This demo catalog could not be loaded." /></main></>
  const rows = catalog.items.filter((item) => item.available)
  return <>
    <PageHeader title="Digital Dukaan" />
    <main className="page public-dukaan">
      <section className="public-hero"><span><Store /></span><small>PRICE LIST · DEMO</small><h1>{data.merchant.businessName}</h1><p>{data.merchant.address}, {data.merchant.city}</p><i>Open today · Call {data.merchant.phone.replace('+91 ', '')}</i></section>
      <div className="public-note">Prices and availability are merchant-edited. Contact the shop to order.</div>
      <section className="public-list">{rows.map((item) => <article key={item.id}><span>{item.name.slice(0, 1)}</span><div><b>{item.name}</b><small>{item.category}</small></div><strong>{formatINR(item.pricePaise)}</strong></article>)}</section>
      {!rows.length && <EmptyState icon={<Package />} title="Updating stock" text="The merchant has temporarily hidden all items." />}
      <a className="call-shop" href={`tel:${data.merchant.phone.replace(/\s/g, '')}`}>Call shop / दुकान को कॉल करें</a>
      <p className="prototype-note">Hackathon price-list prototype · Not official Paytm · No online checkout</p>
    </main>
  </>
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function BusinessPage() {
  const data = useData()
  const dash = deriveDashboard(data)
  return <>
    <PageHeader title="Business" />
    <main className="page">
      <div className="title-row"><div><h1>Business hub</h1><p>Understand and manage your store</p></div><Building2 /></div>
      <div className="business-stats"><div><span>7-day sales</span><b>{formatINR(dash.last7Sales)}</b><small className={dash.weekDeltaPct >= 0 ? 'positive' : 'negative'}>{dash.weekDeltaPct >= 0 ? '↑' : '↓'} {Math.abs(dash.weekDeltaPct).toFixed(0)}% vs prior week</small></div><div><span>Success rate</span><b>{(dash.successRate * 100).toFixed(0)}%</b><small>{data.transactions.length} attempts</small></div></div>
      <section className="menu-card">
        <MenuItem icon={<Users />} title="Customers" text="Customer history and repeat spend" to="/customers" />
        <MenuItem icon={<Banknote />} title="Settlements" text={`${formatINR(dash.availablePaise)} available`} to="/settlements" />
        <MenuItem icon={<Lightbulb />} title="Smart insights" text="Trends, peak hours and opportunities" to="/insights" badge="DEMO" />
      </section>
      <div className="info-banner"><Sparkles /><div><b>Built for small businesses</b><p>This merchant stack plug-in turns payment activity into simple, useful answers.</p></div></div>
    </main>
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
    <main className="page"><div className="title-row"><div><h1>Customers</h1><p>{data.customers.length} saved customers</p></div><Users /></div>
      <label className="search-box"><Search /><input placeholder="Search customers" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      <section className="list-card customer-list">{rows.map((c) => <button className="customer-row" key={c.id} onClick={() => navigate(`/customers/${c.id}`)}><span className="avatar">{c.name.split(' ').map((x) => x[0]).slice(0, 2)}</span><span><b>{c.name}</b><small>{c.stats.successCount} successful payments · {c.segment}</small></span><strong>{formatINR(c.stats.totalSpendPaise)}<ChevronRight /></strong></button>)}</section>
    </main>
  </>
}

function CustomerDetailPage() {
  const { id } = useParams()
  const data = useData()
  const customer = data.customers.find((c) => c.id === id)
  if (!customer) return <><PageHeader title="Customer" back /><main className="page"><EmptyState icon={<Users />} title="Customer not found" text="This customer does not exist." /></main></>
  const stats = customerStats(data, customer.id)
  const txns = [...data.transactions].filter((t) => t.customerId === customer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return <>
    <PageHeader title="Customer details" back />
    <main className="page">
      <section className="customer-hero"><span className="avatar large">{customer.name.split(' ').map((x) => x[0]).slice(0, 2)}</span><h1>{customer.name}</h1><p>{customer.phone}</p><span className="segment">{customer.segment} customer</span></section>
      <div className="stat-grid"><div><small>Total spend</small><strong>{formatINR(stats.totalSpendPaise)}</strong></div><div><small>Payments</small><strong>{stats.successCount}</strong></div></div>
      {customer.notes && <div className="note-card"><b>Merchant note</b><p>{customer.notes}</p></div>}
      <SectionTitle>Payment history</SectionTitle><section className="list-card">{txns.map((t) => <TransactionRow key={t.id} txn={t} />)}</section>
    </main>
  </>
}

function SettlementsPage() {
  const data = useData()
  const dash = deriveDashboard(data)
  const settle = useMerchantStore((s) => s.settleNow)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const run = async () => { setBusy(true); setMessage(''); try { await settle(); setMessage('Settlement completed and transactions updated.') } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not settle') } finally { setBusy(false) } }
  return <>
    <PageHeader title="Settlements" back />
    <main className="page">
      <section className="settle-hero"><small>AVAILABLE BALANCE</small><h1>{formatINR(dash.availablePaise)}</h1><p>HDFC Bank ••{data.merchant.bankAccountLast4}</p><button disabled={busy || dash.availablePaise < 5000} onClick={run}>{busy ? 'Settling…' : 'Settle now'}<ArrowRight /></button></section>
      {message && <div className={`alert ${message.startsWith('Settlement') ? 'success' : 'error'}`}>{message}</div>}
      <div className="stat-grid"><div><small>Credited today</small><strong>{formatINR(dash.todaySettlementPaise)}</strong></div><div><small>Upcoming</small><strong>{formatINR(dash.upcomingPaise)}</strong></div></div>
      <SectionTitle>Settlement history</SectionTitle>
      <section className="list-card">{data.settlements.map((s) => <div className="settlement-row" key={s.id}><span className={`txn-icon ${s.status === 'completed' ? 'success' : 'pending'}`}>{s.status === 'completed' ? <Check /> : <Clock3 />}</span><span><b>{s.mode === 'instant' ? 'Instant settlement' : 'Daily settlement'}</b><small>{formatDayLabel(s.completedAt ?? s.expectedDate, data.demoClock)} · {s.transactionIds.length} payments</small></span><strong>{formatINR(s.amountPaise)}<small>{s.status}</small></strong></div>)}</section>
    </main>
  </>
}

function InsightsPage() {
  const data = useData()
  const insights = intelligenceEngine.generate(data)
  const series = dailySalesSeries(data, 14).map((d) => ({ ...d, rupees: d.paise / 100 }))
  const hours = hourlyActivity(data).filter((h) => h.hour >= 6 && h.hour <= 22).map((h) => ({ ...h, label: `${h.hour % 12 || 12}${h.hour < 12 ? 'a' : 'p'}` }))
  const repeat = returningShare(data)
  return <>
    <PageHeader title="Smart insights" back />
    <main className="page">
      <div className="insights-title"><span><Sparkles /></span><div><h1>Business insights</h1><p>Rule-based answers from your demo payment data</p></div></div>
      <section className="chart-card"><SectionTitle>How are sales trending?</SectionTitle><ResponsiveContainer width="100%" height={190}><AreaChart data={series}><defs><linearGradient id="sales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00baf2" stopOpacity={.35}/><stop offset="95%" stopColor="#00baf2" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fontSize:10}} interval={2}/><Tooltip formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Sales']}/><Area type="monotone" dataKey="rupees" stroke="#012b72" fill="url(#sales)" strokeWidth={2}/></AreaChart></ResponsiveContainer></section>
      <section className="chart-card"><SectionTitle>When are customers active?</SectionTitle><ResponsiveContainer width="100%" height={165}><BarChart data={hours}><XAxis dataKey="label" tick={{fontSize:9}} interval={2}/><Tooltip/><Bar dataKey="count" name="Payments" fill="#00baf2" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></section>
      <div className="answer-grid"><div><small>Average ticket</small><b>{formatINR(averageTicket(data))}</b></div><div><small>Repeat customer share</small><b>{repeat.returningPct.toFixed(0)}%</b></div></div>
      <SectionTitle>What should I know?</SectionTitle>
      <section className="insight-list">{insights.map((i) => <article className={`insight-card ${i.priority}`} key={i.id}><span><Sparkles /></span><div><small>{i.metricLabel}</small><h3>{i.title}</h3><p>{i.description}</p></div>{i.metricValue && <b>{i.metricValue}</b>}</article>)}</section>
      <p className="prototype-note">Insights are deterministic demo rules, not financial advice.</p>
    </main>
  </>
}

function NotificationsPage() {
  const data = useData()
  const mark = useMerchantStore((s) => s.markNotificationRead)
  const markAll = useMerchantStore((s) => s.markAllNotificationsRead)
  const navigate = useNavigate()
  return <>
    <PageHeader title="Notifications" back action={<button className="header-link" onClick={markAll}>Read all</button>} />
    <main className="page notification-list">{data.notifications.length ? data.notifications.map((n) => <button className={!n.read ? 'unread' : ''} key={n.id} onClick={() => { mark(n.id); if (n.relatedRoute) navigate(n.relatedRoute) }}><span className={`notif-icon ${n.type}`}>{n.type === 'payment_received' ? <IndianRupee /> : n.type === 'settlement' ? <Banknote /> : n.type === 'insight' ? <Sparkles /> : <Bell />}</span><div><b>{n.title}</b><p>{n.body}</p><small>{formatDayLabel(n.createdAt, data.demoClock)}, {formatTime(n.createdAt)}</small></div>{!n.read && <i />}</button>) : <EmptyState icon={<Bell />} title="No notifications" text="New updates will appear here." />}</main>
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
    <main className="page"><label className="search-box large"><Search /><input autoFocus placeholder="Search payments and customers" value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button onClick={() => setQuery('')}><X /></button>}</label>
      {!query ? <EmptyState icon={<Search />} title="Search your business" text="Find a transaction by name, amount or reference, or look up a customer." /> : <>
        <SectionTitle>Customers</SectionTitle><section className="list-card">{customers.length ? customers.map((c) => <button className="simple-result" onClick={() => navigate(`/customers/${c.id}`)} key={c.id}><span className="avatar">{c.name.split(' ').map((x) => x[0]).slice(0, 2)}</span><span><b>{c.name}</b><small>{c.phone}</small></span><ChevronRight /></button>) : <p className="no-result">No matching customers</p>}</section>
        <SectionTitle>Payments</SectionTitle><section className="list-card">{txns.length ? txns.map((t) => <TransactionRow key={t.id} txn={t} />) : <p className="no-result">No matching payments</p>}</section>
      </>}
    </main>
  </>
}

function ProfilePage() {
  const data = useData()
  const setSoundbox = useMerchantStore((s) => s.setSoundbox)
  const updatePrefs = useMerchantStore((s) => s.updatePreferences)
  const reset = useMerchantStore((s) => s.resetDemo)
  const [done, setDone] = useState(false)
  return <>
    <PageHeader title="Profile" />
    <main className="page">
      <section className="profile-hero"><span className="shop-avatar"><Store /></span><h1>{data.merchant.businessName}</h1><p>{data.merchant.ownerName} · {data.merchant.category}</p><span>Verified demo merchant</span></section>
      <SectionTitle>Merchant information</SectionTitle><section className="detail-card"><Detail label="Merchant ID" value={data.merchant.mid} mono/><Detail label="Pay address" value={data.merchant.vpa}/><Detail label="Phone" value={data.merchant.phone}/><Detail label="Bank account" value={`${data.merchant.bankName} ••${data.merchant.bankAccountLast4}`}/><Detail label="Store address" value={`${data.merchant.address}, ${data.merchant.city} ${data.merchant.pincode}`}/></section>
      <SectionTitle>Payment experience</SectionTitle><section className="settings-card"><Toggle label="Soundbox announcements" text="Announce successful collections" value={data.merchant.soundboxEnabled} onChange={setSoundbox}/></section>
      <SectionTitle>Notification preferences</SectionTitle><section className="settings-card"><Toggle label="Payment alerts" value={data.preferences.paymentAlerts} onChange={(v) => updatePrefs({paymentAlerts:v})}/><Toggle label="Settlement alerts" value={data.preferences.settlementAlerts} onChange={(v) => updatePrefs({settlementAlerts:v})}/><Toggle label="Business insights" value={data.preferences.insightAlerts} onChange={(v) => updatePrefs({insightAlerts:v})}/></section>
      {done && <div className="alert success"><Check />Demo data restored.</div>}
      <button className="reset-btn" onClick={async () => {
        if (!window.confirm('Reset all demo activity and preferences?')) return
        setDone(false)
        try { await reset(); setDone(true) } catch { setDone(false) }
      }}><RefreshCw />Reset demo data</button>
      <p className="prototype-note">Hackathon prototype · Not affiliated with or endorsed by Paytm</p>
    </main>
  </>
}

function NotFound() {
  const navigate = useNavigate()
  return <><PageHeader title="Not found" back/><main className="page"><EmptyState icon={<CircleAlert/>} title="Page not found" text="The page you requested does not exist."/><button className="primary full" onClick={() => navigate('/')}>Go home</button></main></>
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div className="detail-row"><span>{label}</span><strong className={mono ? 'mono' : ''}>{value}</strong></div>
}
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="form-field"><span>{label}</span>{children}</label>
}
function Toggle({ label, text, value, onChange }: { label: string; text?: string; value: boolean; onChange: (v: boolean) => void }) {
  return <label className="toggle-row"><span><b>{label}</b>{text && <small>{text}</small>}</span><input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)}/><i /></label>
}
function MenuItem({ icon, title, text, to, badge }: { icon: React.ReactNode; title: string; text: string; to: string; badge?: string }) {
  const navigate = useNavigate()
  return <button onClick={() => navigate(to)}><span className="menu-icon">{icon}</span><span><b>{title}{badge && <i>{badge}</i>}</b><small>{text}</small></span><ChevronRight /></button>
}
function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="empty-state"><span>{icon}</span><h2>{title}</h2><p>{text}</p></div>
}

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
  useEffect(() => { void syncFromApi() }, [syncFromApi])
  const hideNav = ['/collect', '/qr', '/search', '/notifications', '/insights', '/settlements', '/customers', '/dukaan'].some((p) => location.pathname.startsWith(p)) || /^\/payments\/.+/.test(location.pathname)
  if (bootStatus === 'loading') {
    return <div className="device-shell"><div className="app-surface"><PageHeader title="Loading" /><main className="page centered"><div className="spinner" /><h1>Loading merchant demo</h1><p>Syncing payments and settlements…</p></main></div></div>
  }
  if (bootStatus === 'error') {
    return <div className="device-shell"><div className="app-surface"><PageHeader title="Demo unavailable" /><main className="page centered"><EmptyState icon={<CircleAlert />} title="Couldn’t load demo data" text={actionError ?? 'Start the Vite demo server and try again.'} /><button className="primary full" onClick={() => void syncFromApi()}>Try again</button></main></div></div>
  }
  return <div className="device-shell"><div className="app-surface">
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
    {!hideNav && <nav className="bottom-nav">{tabs.map((t) => <NavLink to={t.to} end={t.to === '/'} key={t.to}>{t.icon}<span>{t.label}</span></NavLink>)}</nav>}
  </div></div>
}

export default function App() {
  return <HashRouter><AppShell /></HashRouter>
}
