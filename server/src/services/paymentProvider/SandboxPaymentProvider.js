/**
 * @file SandboxPaymentProvider.js
 * Realistic Asynchronous Sandbox Payment Provider.
 * Features:
 * - Transaction Lifecycle State Machine: CREATED -> PENDING -> PROCESSING -> SUCCESS / FAILED
 * - Cryptographic HMAC SHA-256 Webhook Signatures
 * - In-memory sandbox ledger & callback dispatcher
 * - Simulates upstream bank network responses, timeouts, and failure scenarios.
 */

import crypto from 'crypto';
import PaymentProvider from './PaymentProvider.js';

export class SandboxPaymentProvider extends PaymentProvider {
  /**
   * @param {object} [config]
   * @param {string} [config.webhookSecret]
   * @param {number} [config.simulatedLatencyMs=0]
   * @param {boolean} [config.simulateFailure=false]
   */
  constructor(config = {}) {
    super({ name: 'upay_sandbox', ...config });
    this.simulatedLatencyMs = config.simulatedLatencyMs || 0;
    this.simulateFailure = config.simulateFailure || false;
    this.orders = new Map();
  }

  /**
   * Generates HMAC-SHA256 signature for webhook payload verification.
   * @param {object|string} payload
   * @returns {string} Hex signature
   */
  generateSignature(payload) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHmac('sha256', this.webhookSecret).update(raw).digest('hex');
  }

  /**
   * Verifies incoming webhook HMAC-SHA256 signature using timing-safe comparison.
   * @param {object|string} payload
   * @param {string} signature
   * @returns {boolean}
   */
  verifySignature(payload, signature) {
    if (!signature) return false;
    const expected = this.generateSignature(payload);
    try {
      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expected, 'hex');
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }

  /**
   * Initiates payment order and transitions state from CREATED -> PENDING.
   */
  async initiatePayment({ txnId, amountPoisha, customerPhone, metadata = {} }) {
    if (this.simulatedLatencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.simulatedLatencyMs));
    }

    const providerReference = `upay_sbx_${crypto.randomBytes(8).toString('hex')}`;
    const initialStatus = 'PENDING';

    const orderRecord = {
      providerReference,
      txnId: String(txnId),
      amountPoisha,
      customerPhone,
      metadata,
      status: initialStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [{ status: 'CREATED', timestamp: new Date().toISOString() }, { status: initialStatus, timestamp: new Date().toISOString() }],
    };

    this.orders.set(providerReference, orderRecord);

    return {
      providerReference,
      status: initialStatus,
      checkoutUrl: `https://sandbox.upay.internal/checkout/${providerReference}`,
      amountPoisha,
      currency: 'BDT',
    };
  }

  /**
   * Transitions state machine: PENDING -> PROCESSING -> SUCCESS or FAILED.
   * Dispatches simulated webhook payload with valid HMAC signature.
   * @param {object} params
   * @param {string} params.providerReference
   * @param {'SUCCESS'|'FAILED'} [params.targetStatus='SUCCESS']
   * @param {string} [params.failureReason]
   * @returns {{ payload: object, signature: string }}
   */
  simulateWebhookCallback({ providerReference, targetStatus = 'SUCCESS', failureReason = null }) {
    const order = this.orders.get(providerReference);
    if (!order) {
      throw new Error(`Order ${providerReference} not found in sandbox registry.`);
    }

    const finalStatus = this.simulateFailure ? 'FAILED' : targetStatus;
    order.status = finalStatus;
    order.updatedAt = new Date().toISOString();
    order.history.push({ status: 'PROCESSING', timestamp: new Date().toISOString() });
    order.history.push({ status: finalStatus, timestamp: order.updatedAt, reason: failureReason });

    const payload = {
      event: finalStatus === 'SUCCESS' ? 'payment.success' : 'payment.failed',
      provider: 'upay_sandbox',
      providerReference,
      txnId: order.txnId,
      amountPoisha: order.amountPoisha,
      status: finalStatus,
      failureReason: finalStatus === 'FAILED' ? failureReason || 'SIMULATED_REJECTION' : null,
      timestamp: new Date().toISOString(),
    };

    const signature = this.generateSignature(payload);
    return { payload, signature };
  }

  /**
   * Verifies payment order status directly.
   */
  async verifyPayment(providerReference) {
    const order = this.orders.get(providerReference);
    if (!order) {
      throw new Error(`Order ${providerReference} not found in sandbox.`);
    }
    return {
      providerReference,
      status: order.status,
      amountPoisha: order.amountPoisha,
      history: order.history,
    };
  }

  /**
   * Processes incoming webhook callback with cryptographic validation.
   */
  async handleWebhook({ payload, signature }) {
    const isValid = this.verifySignature(payload, signature);
    if (!isValid) {
      return {
        isValid: false,
        error: 'INVALID_SIGNATURE: HMAC SHA-256 signature verification failed.',
      };
    }

    return {
      isValid: true,
      txnId: payload.txnId,
      providerReference: payload.providerReference,
      status: payload.status,
      amountPoisha: payload.amountPoisha,
      failureReason: payload.failureReason,
    };
  }

  /**
   * Simulates partial or full refunds.
   */
  async refundPayment({ providerReference, amountPoisha, reason = 'customer_requested' }) {
    const order = this.orders.get(providerReference);
    if (!order) {
      throw new Error(`Order ${providerReference} not found for refund.`);
    }

    const refundReference = `rfnd_sbx_${crypto.randomBytes(6).toString('hex')}`;
    order.history.push({ status: 'REFUNDED', refundReference, amountPoisha, reason });

    return {
      success: true,
      refundReference,
      originalReference: providerReference,
      amountPoisha,
      reason,
      refundedAt: new Date().toISOString(),
    };
  }
}

export default SandboxPaymentProvider;
