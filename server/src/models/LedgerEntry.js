import mongoose from 'mongoose';

const LedgerEntrySchema = new mongoose.Schema(
  {
    txnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
      index: true,
    },
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ['debit', 'credit'],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [1, 'Ledger entry amount must be positive integer poisha'],
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: [0, 'Balance after ledger entry cannot be negative'],
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable append-only
  }
);

// Prevent modifications to existing ledger entries
LedgerEntrySchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('Ledger entries are strictly immutable and cannot be updated.'));
  }
  next();
});

export const LedgerEntry = mongoose.model('LedgerEntry', LedgerEntrySchema);
export default LedgerEntry;
