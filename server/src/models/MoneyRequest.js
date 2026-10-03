import mongoose from 'mongoose';

const ParticipantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    phone: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    requestedAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'partially_paid', 'void'],
      default: 'pending',
    },
    voidReason: {
      type: String,
      enum: ['covered_by_others', 'cancelled_by_creator', 'expired'],
    },
    paidAt: {
      type: Date,
    },
  },
  { _id: true }
);

const MoneyRequestSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ['individual', 'group', 'bill_split'],
      required: true,
      index: true,
    },
    splitType: {
      type: String,
      enum: ['equal', 'percent', 'manual', 'single'],
      default: 'single',
    },
    settlementMode: {
      type: String,
      enum: ['direct', 'one_pays'],
      default: 'direct',
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    remainingAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
    },
    merchantName: {
      type: String,
      trim: true,
    },
    participants: [ParticipantSchema],
    status: {
      type: String,
      enum: ['open', 'closed', 'cancelled', 'expired'],
      default: 'open',
      index: true,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
  },
  { timestamps: true }
);

export const MoneyRequest = mongoose.model('MoneyRequest', MoneyRequestSchema);
export default MoneyRequest;
