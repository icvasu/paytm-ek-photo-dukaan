export type PaymentMethod = 'upi' | 'paytm_wallet' | 'card' | 'netbanking'
export type TransactionStatus = 'success' | 'failed' | 'pending' | 'refunded'
export type SettlementStatus = 'completed' | 'processing' | 'scheduled'
export type NotificationType =
  | 'payment_received'
  | 'payment_failed'
  | 'settlement'
  | 'business_alert'
  | 'customer'
  | 'insight'
  | 'ops'
export type NotificationPriority = 'low' | 'normal' | 'high'
export type InsightKind =
  | 'trend'
  | 'peak_hours'
  | 'success_rate'
  | 'customers'
  | 'settlement'
  | 'anomaly'
  | 'catalog'

export type CatalogStockFlag = 'in_stock' | 'low' | 'out'
export type VisionConfidence = 'high' | 'medium' | 'starter'

export interface CatalogItem {
  id: string
  name: string
  pricePaise: number
  available: boolean
  stockFlag: CatalogStockFlag
  stockLabel: string
  category: string
}

export interface SupplierInvoiceLine {
  skuId: string
  itemName: string
  quantity: number
  unitCostPaise: number
}

export interface SupplierProfile {
  id: string
  name: string
  phone: string
  sourceImageName: string
  lines: SupplierInvoiceLine[]
  invoiceTotalPaise: number
  normalOrderPaise: number
  lastStockInAt: string
  disclosure: string
}

export interface BasketLine {
  skuId: string
  itemName: string
  quantity: number
  pricePaise: number
}

export interface BasketAssignment {
  transactionId: string
  lines: BasketLine[]
  assignedAt: string
  source: 'merchant' | 'demo_decomposition'
}

export interface SupplierOrder {
  id: string
  supplierId: string
  status: 'queued' | 'confirmed'
  lines: SupplierInvoiceLine[]
  amountPaise: number
  createdAt: string
  confirmedAt: string | null
  note: string
}

export interface StockForecast {
  skuId: string
  itemName: string
  estimatedMin: number
  estimatedMax: number
  soldUnits: number
  dailyVelocity: number
  stockoutDays: number | null
  confidencePct: number
  needsReorder: boolean
}

export interface DukaanCatalog {
  id: string
  merchantId: string
  title: string
  slug: string
  items: CatalogItem[]
  sourceImageName: string
  sourceKind: 'demo' | 'upload'
  confidence: VisionConfidence
  readingNote: string
  createdAt: string
  updatedAt: string
}

export interface VisionResult {
  items: CatalogItem[]
  confidence: VisionConfidence
  readingNote: string
  sourceKind: 'demo' | 'upload'
}

export interface Merchant {
  id: string
  businessName: string
  ownerName: string
  category: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  pincode: string
  gstin: string
  mid: string
  vpa: string
  bankName: string
  bankAccountLast4: string
  ifscMasked: string
  soundboxEnabled: boolean
  createdAt: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  notes?: string
  segment: 'regular' | 'occasional' | 'new'
}

export interface Transaction {
  id: string
  merchantId: string
  customerId: string | null
  customerName: string
  customerPhone: string | null
  amountPaise: number
  status: TransactionStatus
  paymentMethod: PaymentMethod
  createdAt: string
  settledAt: string | null
  settlementId: string | null
  referenceId: string
  upiTxnId: string | null
  note: string | null
  failureReason: string | null
}

export interface Settlement {
  id: string
  merchantId: string
  amountPaise: number
  status: SettlementStatus
  expectedDate: string
  completedAt: string | null
  bankRef: string | null
  transactionIds: string[]
  mode: 't_plus_1' | 'instant'
}

export interface AppNotification {
  id: string
  merchantId: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  createdAt: string
  relatedEntityId: string | null
  relatedRoute: string | null
  priority: NotificationPriority
}

export interface BusinessInsight {
  id: string
  merchantId: string
  kind: InsightKind
  title: string
  description: string
  priority: NotificationPriority
  metricLabel?: string
  metricValue?: string
  createdAt: string
}

export interface MerchantPreferences {
  paymentAlerts: boolean
  settlementAlerts: boolean
  insightAlerts: boolean
}

export interface MerchantStoreData {
  merchant: Merchant
  customers: Customer[]
  transactions: Transaction[]
  settlements: Settlement[]
  notifications: AppNotification[]
  preferences: MerchantPreferences
  demoClock: string
  catalog: DukaanCatalog | null
  supplier: SupplierProfile | null
  basketAssignments: BasketAssignment[]
  supplierOrders: SupplierOrder[]
}

export interface CollectPaymentInput {
  amountRupees: number
  customerId?: string | null
  customerName?: string
  customerPhone?: string
  paymentMethod: PaymentMethod
  note?: string
}
