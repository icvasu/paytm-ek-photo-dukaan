import type { CollectPaymentInput, PaymentMethod, Transaction } from '../../types/models.js'
import { createId, paytmStyleTxnId } from '../../lib/ids.js'
import { rupeesToPaise } from '../../lib/money.js'
import { apiJson } from '../../lib/net.js'

export interface ChargeRequest {
  merchantId: string
  amountRupees: number
  method: PaymentMethod
  vpa: string
  note?: string
  customerId?: string | null
  customerName?: string
  customerPhone?: string
}

export interface ChargeResult {
  ok: boolean
  status: 'success' | 'failed'
  providerRef: string
  failureReason: string | null
  processedAt: string
  transaction?: Transaction
}

export interface InstantSettleRequest {
  merchantId: string
  amountPaise: number
  accountLast4: string
}

export interface InstantSettleResult {
  ok: boolean
  bankRef: string
  completedAt: string
}

export interface PaytmService {
  charge(request: ChargeRequest): Promise<ChargeResult>
  settleNow(request: InstantSettleRequest): Promise<InstantSettleResult>
  qrPayload(vpa: string, businessName: string, amountRupees?: number): string
}

export class DemoPaytmService implements PaytmService {
  private readonly delayMs: number

  constructor(delayMs = 900) {
    this.delayMs = delayMs
  }

  private wait() {
    return new Promise((r) => setTimeout(r, this.delayMs))
  }

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    await this.wait()
    if (request.amountRupees < 1) {
      return {
        ok: false,
        status: 'failed',
        providerRef: createId('ref'),
        failureReason: 'Enter an amount of at least ₹1',
        processedAt: new Date().toISOString(),
      }
    }
    if (request.amountRupees > 100000) {
      return {
        ok: false,
        status: 'failed',
        providerRef: createId('ref'),
        failureReason: 'Amount exceeds the demo collection limit',
        processedAt: new Date().toISOString(),
      }
    }
    const fail = request.amountRupees === 13 || request.note?.toLowerCase().includes('fail')
    const processedAt = new Date().toISOString()
    if (fail) {
      return {
        ok: false,
        status: 'failed',
        providerRef: createId('upi'),
        failureReason: 'UPI request declined by customer bank',
        processedAt,
      }
    }
    return {
      ok: true,
      status: 'success',
      // Prefixed so the screen that labels this a "UPI transaction ID" cannot
      // be mistaken for an NPCI reference. No UPI network is contacted.
      providerRef: `DEMO-UPI-${Date.now().toString().slice(-10)}`,
      failureReason: null,
      processedAt,
    }
  }

  async settleNow(request: InstantSettleRequest): Promise<InstantSettleResult> {
    await this.wait()
    if (request.amountPaise < 5000) {
      throw new Error('Minimum instant settlement is ₹50')
    }
    return {
      ok: true,
      // Deliberately not shaped like a bank UTR. Nothing here talks to a bank,
      // and a realistic looking reference would imply otherwise.
      bankRef: `DEMO-STL-${Date.now().toString().slice(-8)}`,
      completedAt: new Date().toISOString(),
    }
  }

  qrPayload(vpa: string, businessName: string, amountRupees?: number): string {
    const amt = amountRupees && amountRupees > 0 ? `&am=${amountRupees.toFixed(2)}` : ''
    return `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(businessName)}&cu=INR${amt}`
  }
}

export class ApiPaytmService implements PaytmService {
  async charge(request: ChargeRequest): Promise<ChargeResult> {
    // The server simulates a ~700ms processor delay, so allow more headroom
    // than a plain read before calling it a timeout.
    const payload = await apiJson<{ transaction?: Transaction }>('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeoutMs: 20_000,
      body: JSON.stringify({
        amountRupees: request.amountRupees,
        paymentMethod: request.method,
        note: request.note,
        customerId: request.customerId,
        customerName: request.customerName,
        customerPhone: request.customerPhone,
      }),
    })
    if (!payload?.transaction) throw new Error('The payment server answered without a transaction. Nothing was collected.')
    return {
      ok: payload.transaction.status === 'success',
      status: payload.transaction.status === 'success' ? 'success' : 'failed',
      providerRef: payload.transaction.upiTxnId ?? payload.transaction.referenceId,
      failureReason: payload.transaction.failureReason,
      processedAt: payload.transaction.createdAt,
      transaction: payload.transaction,
    }
  }

  async settleNow(request: InstantSettleRequest): Promise<InstantSettleResult> {
    const payload = await apiJson<{ settlement?: { bankRef: string; completedAt: string } }>('/api/settlements/instant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeoutMs: 20_000,
      body: JSON.stringify(request),
    })
    if (!payload?.settlement) throw new Error('The settlement server answered without a settlement. Nothing was moved.')
    return {
      ok: true,
      bankRef: payload.settlement.bankRef,
      completedAt: payload.settlement.completedAt,
    }
  }

  qrPayload(vpa: string, businessName: string, amountRupees?: number): string {
    const amount = amountRupees && amountRupees > 0 ? `&am=${amountRupees.toFixed(2)}` : ''
    return `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(businessName)}&cu=INR${amount}`
  }
}

export function applyChargeToDraft(
  draft: Omit<Transaction, 'status' | 'upiTxnId' | 'failureReason' | 'settledAt' | 'settlementId'>,
  result: ChargeResult,
): Transaction {
  return {
    ...draft,
    status: result.status,
    upiTxnId: result.status === 'success' ? result.providerRef : null,
    failureReason: result.failureReason,
    settledAt: null,
    settlementId: null,
  }
}

export function buildDraftTransaction(
  merchantId: string,
  input: CollectPaymentInput,
  clockIso: string,
  seq: number,
): Omit<Transaction, 'status' | 'upiTxnId' | 'failureReason' | 'settledAt' | 'settlementId'> {
  const created = new Date(clockIso)
  created.setMilliseconds(created.getMilliseconds() + seq)
  return {
    id: createId('txn'),
    merchantId,
    customerId: input.customerId ?? null,
    customerName: input.customerName?.trim() || 'Walk-in customer',
    customerPhone: input.customerPhone || null,
    amountPaise: rupeesToPaise(input.amountRupees),
    paymentMethod: input.paymentMethod,
    createdAt: created.toISOString(),
    referenceId: paytmStyleTxnId(created, seq),
    note: input.note?.trim() || null,
  }
}
