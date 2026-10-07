import mongoose from 'mongoose';

const SavingsPlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    planType: {
      type: String,
      enum: ['savings', 'dps'],
      default: 'savings',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    targetAmountPoisha: {
      type: Number,
      required: true,
      min: 100, // at least 1 BDT
    },
    currentAmountPoisha: {
      type: Number,
      default: 0,
      min: 0,
    },
    installmentAmountPoisha: {
      type: Number,
      default: 0,
      min: 0,
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'monthly',
    },
    durationMonths: {
      type: Number,
      default: 12,
      min: 1,
    },
    interestRatePercent: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'matured', 'cancelled'],
      default: 'active',
      index: true,
    },
    autoDebit: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const SavingsPlan = mongoose.model('SavingsPlan', SavingsPlanSchema);
export default SavingsPlan;
