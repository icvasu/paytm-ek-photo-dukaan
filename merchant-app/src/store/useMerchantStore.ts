import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildSeed, SEED_VERSION } from '../data/seed'
import { paytmService } from '../services/container'
import type {
  AppNotification,
  CatalogItem,
  CollectPaymentInput,
  Customer,
  Merchant,
  MerchantPreferences,
  MerchantStoreData,
  BasketLine,
  SupplierProfile,
  VisionResult,
  Settlement,
  Transaction,
} from '../types/models'

const STORAGE_KEY = `paytm-merchant-demo-v${SEED_VERSION}`

type Status = 'idle' | 'loading' | 'error'

interface MerchantStore extends MerchantStoreData {
  bootStatus: Status
  actionError: string | null
  hydrateSeed: () => void
  syncFromApi: () => Promise<void>
  resetDemo: () => Promise<void>
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  updatePreferences: (patch: Partial<MerchantPreferences>) => void
  setSoundbox: (enabled: boolean) => void
  collectPayment: (input: CollectPaymentInput) => Promise<Transaction>
  settleNow: () => Promise<void>
  refundTransaction: (id: string) => Promise<void>
  confirmPending: (id: string, success: boolean) => Promise<void>
  createCatalog: (input: VisionResult & { sourceImageName: string }) => Promise<void>
  updateCatalogItem: (id: string, patch: Partial<Pick<CatalogItem, 'name' | 'pricePaise' | 'available'>>) => Promise<void>
  addCatalogItem: () => Promise<void>
  removeCatalogItem: (id: string) => Promise<void>
  saveSupplierInvoice: (input: Omit<SupplierProfile, 'id' | 'lastStockInAt'>) => Promise<void>
  attachBasket: (transactionId: string, lines: BasketLine[]) => Promise<void>
  raiseSupplierOrder: (skuIds: string[]) => Promise<void>
  confirmSupplierOrder: (id: string) => Promise<void>
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  const payload = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Demo API request failed')
  return payload
}

async function fetchApiState() {
  const [merchant, customers, transactions, settlements, notifications, catalog, supplier, supplierOrders, basketAssignments] = await Promise.all([
    apiJson<Merchant>('/api/merchant'),
    apiJson<Customer[]>('/api/customers'),
    apiJson<Transaction[]>('/api/transactions'),
    apiJson<Settlement[]>('/api/settlements'),
    apiJson<AppNotification[]>('/api/notifications'),
    apiJson<MerchantStoreData['catalog']>('/api/catalog'),
    apiJson<MerchantStoreData['supplier']>('/api/supplier'),
    apiJson<MerchantStoreData['supplierOrders']>('/api/supplier-orders'),
    apiJson<MerchantStoreData['basketAssignments']>('/api/basket-assignments'),
  ])
  return { merchant, customers, transactions, settlements, notifications, catalog, supplier, supplierOrders, basketAssignments }
}

export const useMerchantStore = create<MerchantStore>()(
  persist(
    (set, get) => ({
      ...buildSeed(),
      bootStatus: 'idle',
      actionError: null,

      hydrateSeed: () => set({ ...buildSeed(), actionError: null }),

      syncFromApi: async () => {
        set({ bootStatus: 'loading', actionError: null })
        try {
          const apiState = await fetchApiState()
          set({ ...apiState, bootStatus: 'idle' })
        } catch (error) {
          set({ bootStatus: 'error', actionError: error instanceof Error ? error.message : 'Could not load demo data' })
        }
      },

      resetDemo: async () => {
        set({ bootStatus: 'loading', actionError: null })
        try {
          await apiJson<{ ok: boolean }>('/api/reset', { method: 'POST' })
          const apiState = await fetchApiState()
          const fresh = buildSeed()
          set({ ...fresh, ...apiState, bootStatus: 'idle', actionError: null })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not reset demo'
          set({ bootStatus: 'error', actionError: message })
          throw new Error(message)
        }
      },

      markNotificationRead: (id) =>
        set((s) => {
          void apiJson('/api/notifications/read', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
          }).catch(() => undefined)
          return {
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
          }
        }),

      markAllNotificationsRead: () =>
        set((s) => {
          void apiJson('/api/notifications/read', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }),
          }).catch(() => undefined)
          return {
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
          }
        }),

      updatePreferences: (patch) =>
        set((s) => ({ preferences: { ...s.preferences, ...patch } })),

      setSoundbox: (enabled) =>
        set((s) => ({ merchant: { ...s.merchant, soundboxEnabled: enabled } })),

      collectPayment: async (input) => {
        set({ actionError: null })
        const state = get()
        if (!Number.isFinite(input.amountRupees) || input.amountRupees <= 0) {
          const err = 'Enter a valid amount'
          set({ actionError: err })
          throw new Error(err)
        }
        try {
          const result = await paytmService.charge({
            merchantId: state.merchant.id,
            amountRupees: input.amountRupees,
            method: input.paymentMethod,
            vpa: state.merchant.vpa,
            note: input.note,
            customerId: input.customerId,
            customerName: input.customerName,
            customerPhone: input.customerPhone,
          })
          if (!result.transaction) throw new Error('Payment API returned no transaction')
          const apiState = await fetchApiState()
          set({ ...apiState, actionError: null })
          return result.transaction
        } catch (error) {
          const err = error instanceof Error ? error.message : 'Network issue. Try again.'
          set({ actionError: err })
          throw new Error(err)
        }
      },

      settleNow: async () => {
        const state = get()
        const amountPaise = state.transactions
          .filter((t) => t.status === 'success' && !t.settlementId)
          .reduce((sum, transaction) => sum + transaction.amountPaise, 0)
        if (amountPaise < 5000) {
          const err = 'Need at least ₹50 available to settle'
          set({ actionError: err })
          throw new Error(err)
        }
        try {
          await paytmService.settleNow({
            merchantId: state.merchant.id,
            amountPaise,
            accountLast4: state.merchant.bankAccountLast4,
          })
          const apiState = await fetchApiState()
          set({ ...apiState, actionError: null })
        } catch (e) {
          const err = e instanceof Error ? e.message : 'Settlement could not be completed'
          set({ actionError: err })
          throw new Error(err)
        }
      },

      refundTransaction: async (id) => {
        const txn = get().transactions.find((t) => t.id === id)
        if (!txn || txn.status !== 'success') {
          const err = 'Only a successful payment can be refunded'
          set({ actionError: err })
          throw new Error(err)
        }
        if (txn.settlementId) {
          const err = 'Already settled. Refund from bank settlement is not enabled in demo.'
          set({ actionError: err })
          throw new Error(err)
        }
        await apiJson(`/api/transactions/${id}/refund`, { method: 'POST' })
        const apiState = await fetchApiState()
        set({ ...apiState, actionError: null })
      },

      confirmPending: async (id, success) => {
        await apiJson(`/api/transactions/${id}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success }),
        })
        const apiState = await fetchApiState()
        set({ ...apiState, actionError: null })
      },

      createCatalog: async (input) => {
        const catalog = await apiJson<MerchantStoreData['catalog']>('/api/catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        set({ catalog, actionError: null })
      },

      updateCatalogItem: async (id, patch) => {
        const catalog = await apiJson<MerchantStoreData['catalog']>(`/api/catalog/items/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        set({ catalog, actionError: null })
      },

      addCatalogItem: async () => {
        const catalog = await apiJson<MerchantStoreData['catalog']>('/api/catalog/items', { method: 'POST' })
        set({ catalog, actionError: null })
      },

      removeCatalogItem: async (id) => {
        const catalog = await apiJson<MerchantStoreData['catalog']>(`/api/catalog/items/${id}/remove`, { method: 'POST' })
        set({ catalog, actionError: null })
      },

      saveSupplierInvoice: async (input) => {
        await apiJson('/api/supplier/invoice', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
        })
        const apiState = await fetchApiState()
        set({ ...apiState, actionError: null })
      },

      attachBasket: async (transactionId, lines) => {
        await apiJson(`/api/transactions/${transactionId}/basket`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lines }),
        })
        const transaction = get().transactions.find((candidate) => candidate.id === transactionId)
        const assignment = { transactionId, lines, assignedAt: new Date().toISOString(), source: 'merchant' as const }
        set((state) => ({
          basketAssignments: [...state.basketAssignments.filter((candidate) => candidate.transactionId !== transactionId), assignment],
          transactions: state.transactions.map((candidate) => candidate.id === transactionId
            ? { ...candidate, note: `Items: ${lines.map((line) => `${line.quantity}× ${line.itemName}`).join(', ')}` }
            : candidate),
          actionError: transaction ? null : 'Payment not found',
        }))
      },

      raiseSupplierOrder: async (skuIds) => {
        await apiJson('/api/supplier-orders', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skuIds }),
        })
        const apiState = await fetchApiState()
        set({ ...apiState, actionError: null })
      },

      confirmSupplierOrder: async (id) => {
        await apiJson(`/api/supplier-orders/${id}/confirm`, { method: 'POST' })
        const apiState = await fetchApiState()
        set({ ...apiState, actionError: null })
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (s) => ({
        merchant: s.merchant,
        customers: s.customers,
        transactions: s.transactions,
        settlements: s.settlements,
        notifications: s.notifications,
        preferences: s.preferences,
        demoClock: s.demoClock,
        catalog: s.catalog,
        supplier: s.supplier,
        basketAssignments: s.basketAssignments,
        supplierOrders: s.supplierOrders,
      }),
    },
  ),
)
