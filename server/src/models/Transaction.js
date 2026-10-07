import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema(
  {
    senderWalletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      index: true,
    },
    recipientWalletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      index: true,
    },
    senderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    type: {
      type: String,
      enum: [
        'initial_credit',
        'send',
        'cash_out',
        'recharge',
        'bill',
        'add_money',
        'transfer',
        'savings_deposit',
        'savings_withdraw',
        'payment',
        'group_bill',
        'split_bill',
      ],
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['ui', 'agent', 'schedule', 'rule'],
      default: 'ui',
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [1, 'Transaction amount must be at least 1 poisha'],
    },
    fee: {
      type: Number,
      default: 0,
      min: [0, 'Fee cannot be negative'],
    },
    total: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: [
        'initiated',
        'risk_checked',
        'awaiting_guardian',
        'authorized',
        'settled',
        'failed',
        'cancelled',
        'expired',
      ],
      default: 'initiated',
      index: true,
    },
    risk: {
      score: { type: Number, default: 0 },
      decision: { type: String, enum: ['allow', 'warn', 'hold', 'deny'], default: 'allow' },
      reasons: [
        {
          code: { type: String },
          contribution: { type: Number },
          descriptionBn: { type: String },
          descriptionEn: { type: String },
        },
      ],
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    errorMessage: {
      type: String,
    },
  },
  { timestamps: true }
);

// Compound index for querying user history efficiently
TransactionSchema.index({ senderUserId: 1, createdAt: -1 });
TransactionSchema.index({ recipientUserId: 1, createdAt: -1 });

export const Transaction = mongoose.model('Transaction', TransactionSchema);
export default Transaction;
