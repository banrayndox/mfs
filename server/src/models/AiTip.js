import mongoose from 'mongoose';

const AiTipSchema = new mongoose.Schema(
  {
    txnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        'new_recipient',
        'high_amount',
        'cash_out_fee',
        'recurring_bill_schedule',
        'salary_savings_opportunity',
        'recharge_reminder',
        'budget_alert',
        'general',
      ],
      default: 'general',
      index: true,
    },
    factsJson: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    tipBn: {
      type: String,
      required: true,
    },
    tipEn: {
      type: String,
      required: true,
    },
    explanationBn: {
      type: String,
    },
    explanationEn: {
      type: String,
    },
    isTemplateFallback: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

AiTipSchema.index({ userId: 1, createdAt: -1 });

export const AiTip = mongoose.model('AiTip', AiTipSchema);
export default AiTip;
