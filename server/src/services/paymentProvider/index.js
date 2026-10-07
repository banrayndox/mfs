/**
 * @file index.js
 * Payment Provider abstraction module.
 */

import PaymentProvider from './PaymentProvider.js';
import MockPaymentProvider from './MockPaymentProvider.js';
import SandboxPaymentProvider from './SandboxPaymentProvider.js';

const instances = {
  mock: new MockPaymentProvider(),
  sandbox: new SandboxPaymentProvider(),
};

/**
 * Returns requested payment provider instance.
 * @param {'mock'|'sandbox'|string} [type='sandbox']
 * @returns {PaymentProvider}
 */
export function getPaymentProvider(type = 'sandbox') {
  const key = String(type).toLowerCase();
  return instances[key] || instances.sandbox;
}

export {
  PaymentProvider,
  MockPaymentProvider,
  SandboxPaymentProvider,
};

export default {
  getPaymentProvider,
  PaymentProvider,
  MockPaymentProvider,
  SandboxPaymentProvider,
};
