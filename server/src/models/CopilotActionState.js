import mongoose from 'mongoose';

const CopilotActionStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    actionId: {
      type: String,
      required: true,
    },
    intent: {
      type: String,
      enum: [
        'send_money',
        'mobile_recharge',
        'cash_out',
        'pay_bill',
        'add_money',
        'savings',
        'request_money',
        'guardian_mode',
        'reminder',
        'schedule',
        'rules',
        'group_bill',
        'app_logout',
        'app_change_pin',
        'app_navigate',
        null,
      ],
      default: null,
    },
    status: {
      type: String,
      enum: [
        'idle',
        'collecting',
        'ready',
        'awaiting_confirmation',
        'executing',
        'completed',
        'cancelled',
        'failed',
      ],
      default: 'idle',
    },
    activeTool: {
      type: String,
      default: null,
    },
    parameters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    requiredParameters: {
      type: [String],
      default: [],
    },
    missingParameters: {
      type: [String],
      default: [],
    },
    confidence: {
      type: Number,
      default: 1.0,
    },
    source: {
      type: String,
      enum: ['conversation', 'ui', 'memory', 'user_profile'],
      default: 'conversation',
    },
    preparedPendingAction: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    history: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    clientAction: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

// TTL index to clean up idle workflows after 24 hours
CopilotActionStateSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export const CopilotActionState = mongoose.model('CopilotActionState', CopilotActionStateSchema);
export default CopilotActionState;
