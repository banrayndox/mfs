import mongoose from 'mongoose';

const WalletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['primary', 'savings', 'agent', 'system'],
      default: 'primary',
      index: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Wallet balance cannot be negative'],
    },
    currency: {
      type: String,
      default: 'BDT',
    },
    status: {
      type: String,
      enum: ['active', 'frozen'],
      default: 'active',
      index: true,
    },
    dailySpendPoisha: {
      type: Number,
      default: 0,
    },
    monthlySpendPoisha: {
      type: Number,
      default: 0,
    },
    lastResetDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound index for user and wallet type
WalletSchema.index({ userId: 1, type: 1 }, { unique: true });

export const Wallet = mongoose.model('Wallet', WalletSchema);
export default Wallet;
