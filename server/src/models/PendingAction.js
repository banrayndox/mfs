import mongoose from 'mongoose';

const PendingActionSchema = new mongoose.Schema(
  {
    actionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    actionHash: {
      type: String,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tool: {
      type: String,
      required: true,
    },
    args: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    preview: {
      actionType: { type: String, required: true },
      title: { type: String, required: true },
      amountPoisha: { type: Number },
      feePoisha: { type: Number, default: 0 },
      totalPoisha: { type: Number },
      recipientName: { type: String },
      recipientLabel: { type: String },
      recipientPhone: { type: String },
      details: { type: mongoose.Schema.Types.Mixed },
    },
    riskDecision: {
      score: { type: Number, default: 0 },
      decision: { type: String, default: 'allow' },
      reasons: [{ code: String, contribution: Number, descriptionBn: String, descriptionEn: String }],
    },
    requiredTier: {
      type: String,
      enum: ['T0', 'T1', 'T2', 'T3'],
      default: 'T2',
    },
    status: {
      type: String,
      enum: ['pending', 'executed', 'cancelled', 'expired'],
      default: 'pending',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    executedTxnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
    },
  },
  { timestamps: true }
);

export const PendingAction = mongoose.model('PendingAction', PendingActionSchema);
export default PendingAction;
