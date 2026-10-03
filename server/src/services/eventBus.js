import EventEmitter from 'events';
import logger from '../utils/logger.js';

class GuardianEventBus extends EventEmitter {}

export const eventBus = new GuardianEventBus();

// Log system events for observability
eventBus.on('wallet.credit', (data) => {
  logger.info({ userId: data.userId, amountPoisha: data.amountPoisha }, 'Event: wallet.credit');
});

eventBus.on('transaction.settled', (txn) => {
  logger.info({ txnId: txn._id, type: txn.type, amount: txn.amount }, 'Event: transaction.settled');

  // Trigger automated micro-savings if enabled and non-savings transaction
  if (txn.senderUserId && txn.type !== 'savings_deposit' && txn.status === 'settled') {
    setImmediate(async () => {
      try {
        const { processMicroSavingsForTransaction } = await import('./microSavings.service.js');
        await processMicroSavingsForTransaction({
          userId: txn.senderUserId,
          amountPoisha: txn.amount,
        });
      } catch (err) {
        logger.error({ err, txnId: txn._id }, 'Micro-savings trigger failed');
      }
    });
  }
});

export default eventBus;
