/**
 * @file MockPaymentProvider.js
 * Instant synchronous mock payment provider for local dev and standard tests.
 */

import crypto from 'crypto';
import PaymentProvider from './PaymentProvider.js';

export class MockPaymentProvider extends PaymentProvider {
  constructor(config = {}) {
    super({ name: 'mock_provider', ...config });
  }

  async initiatePayment({ txnId, amountPoisha, customerPhone, metadata = {} }) {
    const providerReference = `mock_ref_${crypto.randomBytes(8).toString('hex')}`;
    return {
      providerReference,
      status: 'SUCCESS',
      amountPoisha,
      txnId,
      customerPhone,
      metadata,
      completedAt: new Date().toISOString(),
    };
  }

  async verifyPayment(providerReference) {
    return {
      status: 'SUCCESS',
      providerReference,
      verifiedAt: new Date().toISOString(),
    };
  }

  async handleWebhook({ payload, signature }) {
    return {
      isValid: true,
      txnId: payload.txnId,
      providerReference: payload.providerReference || `mock_ref_${Date.now()}`,
      status: payload.status || 'SUCCESS',
    };
  }

  async refundPayment({ providerReference, amountPoisha, reason = 'requested' }) {
    return {
      success: true,
      refundReference: `ref_mock_${crypto.randomBytes(6).toString('hex')}`,
      amountPoisha,
      originalReference: providerReference,
      reason,
    };
  }
}

export default MockPaymentProvider;
