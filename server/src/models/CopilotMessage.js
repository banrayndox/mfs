import mongoose from 'mongoose';

const CopilotMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sender: {
      type: String,
      enum: ['user', 'agent', 'copilot'],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    language: {
      type: String,
      enum: ['bn', 'en'],
      default: 'bn',
    },
    intent: {
      type: String,
      trim: true,
    },
    tool: {
      type: String,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    pendingAction: {
      type: mongoose.Schema.Types.Mixed,
    },
    clientAction: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

// TTL index to automatically clean up old messages after 30 days
CopilotMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const CopilotMessage = mongoose.model('CopilotMessage', CopilotMessageSchema);
export default CopilotMessage;
