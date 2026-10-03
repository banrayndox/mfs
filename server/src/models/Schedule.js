import mongoose from 'mongoose';

const ScheduleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actionType: {
      type: String,
      enum: [
        'send_money',
        'pay_bill',
        'recharge',
        'cash_out',
        'add_money',
        'fund_transfer',
        'savings_deposit',
        'reminder',
      ],
      required: true,
      index: true,
    },
    frequency: {
      type: String,
      enum: ['one_time', 'recurring_daily', 'recurring_weekly', 'recurring_monthly'],
      required: true,
    },
    actionPayload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    nextRunAt: {
      type: Date,
      required: true,
      index: true,
    },
    lastRunAt: {
      type: Date,
    },
    mandate: {
      maxAmountPerRun: { type: Number, required: true },
      dailyCap: { type: Number },
      allowedRecipient: { type: String },
      expiresAt: { type: Date },
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'failed', 'cancelled'],
      default: 'active',
      index: true,
    },
    leaseOwner: { type: String },
    leaseExpiresAt: { type: Date },
    retryCount: { type: Number, default: 0 },
    lastError: { type: String },
  },
  { timestamps: true }
);

ScheduleSchema.index({ status: 1, nextRunAt: 1 });

export const Schedule = mongoose.model('Schedule', ScheduleSchema);
export default Schedule;
