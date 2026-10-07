import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    actorType: {
      type: String,
      enum: ['user', 'agent_ai', 'guardian', 'scheduler', 'rule_engine', 'system'],
      default: 'user',
    },
    status: {
      type: String,
      enum: ['success', 'failure', 'blocked', 'pending_approval'],
      required: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
export default AuditLog;

