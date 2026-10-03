import mongoose from 'mongoose';

/**
 * ConsumedStepUpToken schema for strict anti-replay verification.
 * Automatically cleared after 5 minutes via MongoDB TTL index.
 */
const ConsumedTokenSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    actionHash: {
      type: String,
      required: true,
    },
    consumedAt: {
      type: Date,
      default: Date.now,
      expires: 300, // 5 minutes TTL
    },
  },
  { timestamps: true }
);

export const ConsumedToken = mongoose.model('ConsumedToken', ConsumedTokenSchema);
export default ConsumedToken;
