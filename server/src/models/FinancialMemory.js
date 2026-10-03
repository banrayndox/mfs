import mongoose from 'mongoose';

const FinancialMemorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    // Micro-savings configuration & state
    microSavings: {
      enabled: { type: Boolean, default: false },
      paused: { type: Boolean, default: false },
      mode: {
        type: String,
        enum: ['percentage', 'round_up', 'threshold', 'none'],
        default: 'percentage',
      },
      percentage: { type: Number, default: 2 }, // default 2%
      roundUpUnit: { type: Number, default: 10000 }, // default round to nearest ৳100 (10000 poisha)
      thresholdMinPoisha: { type: Number, default: 50000 }, // default ৳500
      targetPlanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SavingsPlan',
      },
      autoDeductOnSpend: { type: Boolean, default: true },
      totalSavedPoisha: { type: Number, default: 0 },
      savingsCount: { type: Number, default: 0 },
    },
    // Guardian Risk Awareness Preferences
    guardianAlerts: {
      enabled: { type: Boolean, default: true },
      warnOnNewRecipient: { type: Boolean, default: true },
      warnOnUnusualAmount: { type: Boolean, default: true },
      warnOnUnusualHours: { type: Boolean, default: true },
    },
    // Natural Language Financial Goals remembered by Copilot (e.g. "Laptop", "Tuition")
    financialGoals: [
      {
        keyword: { type: String, trim: true }, // e.g. "laptop"
        title: { type: String, trim: true },
        targetPoisha: { type: Number, default: 0 },
        durationMonths: { type: Number, default: 3 },
        notes: { type: String, trim: true },
        savingsPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'SavingsPlan' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    // Context notes and remembered preferences
    userContextNotes: [
      {
        fact: { type: String, trim: true },
        category: { type: String, default: 'general' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const FinancialMemory = mongoose.model('FinancialMemory', FinancialMemorySchema);
export default FinancialMemory;
