import mongoose from 'mongoose';

const RuleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    trigger: {
      type: {
        type: String,
        enum: ['wallet_credit'],
        default: 'wallet_credit',
      },
      minAmount: {
        type: Number,
        default: 0,
      },
      senderPhone: {
        type: String,
      },
    },
    action: {
      type: {
        type: String,
        enum: ['pay_bill', 'send_money', 'move_to_savings'],
        required: true,
      },
      amount: { type: Number },
      percentage: { type: Number }, // e.g. 20%
      recipientPhone: { type: String },
      billerId: { type: String },
      billAccountNo: { type: String },
      savingsGoalId: { type: String },
    },
    mandate: {
      maxAmountPerRun: { type: Number, required: true },
      dailyCap: { type: Number },
      expiresAt: { type: Date },
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'disabled'],
      default: 'active',
      index: true,
    },
    executionCount: {
      type: Number,
      default: 0,
    },
    lastTriggeredAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

RuleSchema.index({ 'trigger.type': 1, status: 1 });

export const Rule = mongoose.model('Rule', RuleSchema);
export default Rule;
