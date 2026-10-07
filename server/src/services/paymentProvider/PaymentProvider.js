/**
 * @file PaymentProvider.js
 * Abstract Payment Provider interface.
 * Implements standard provider contracts for MFS deposits, gateway checkouts, and webhooks.
 */

export class PaymentProvider {
  /**
   * @param {object} [config]
   * @param {string} [config.name]
   * @param {string} [config.webhookSecret]
   */
  constructor(config = {}) {
    this.name = config.name || 'base_provider';
    this.webhookSecret = config.webhookSecret || process.env.PAYMENT_WEBHOOK_SECRET || 'dev-webhook-secret-key-32chars';
  }

  /**
   * Initiates payment flow with the upstream provider.
   * @param {object} params
   * @param {string} params.txnId
   * @param {number} params.amountPoisha
   * @param {string} params.customerPhone
   * @param {object} [params.metadata]
   * @returns {Promise<{ providerReference: string, redirectUrl?: string, status: string }>}
   */
  async initiatePayment(params) {
    throw new Error('initiatePayment must be implemented by payment provider subclass.');
  }

  /**
   * Queries provider directly for status of a reference.
   * @param {string} providerReference
   * @returns {Promise<{ status: string, amountPoisha: number, raw: object }>}
   */
  async verifyPayment(providerReference) {
    throw new Error('verifyPayment must be implemented by payment provider subclass.');
  }

  /**
   * Verifies and parses incoming webhook payload from provider.
   * @param {object} params
   * @param {object} params.payload
   * @param {string} params.signature
   * @returns {Promise<{ isValid: boolean, txnId: string, providerReference: string, status: string, error?: string }>}
   */
  async handleWebhook(params) {
    throw new Error('handleWebhook must be implemented by payment provider subclass.');
  }

  /**
   * Issues refund through provider.
   * @param {object} params
   * @param {string} params.providerReference
   * @param {number} params.amountPoisha
   * @param {string} [params.reason]
   * @returns {Promise<{ success: boolean, refundReference: string }>}
   */
  async refundPayment(params) {
    throw new Error('refundPayment must be implemented by payment provider subclass.');
  }
}


export default PaymentProvider;
