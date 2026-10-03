import mongoose from 'mongoose';

const GuardianLinkSchema = new mongoose.Schema(
  {
    guardianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    wardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    relationship: {
      type: String,
      default: 'family',
    },
    warnMode: {
      type: String,
      enum: ['inform_only', 'ask_approval'],
      default: 'ask_approval',
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'revoked'],
      default: 'active',
      index: true,
    },
    consentGivenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

GuardianLinkSchema.index({ guardianId: 1, wardId: 1 }, { unique: true });

export const GuardianLink = mongoose.model('GuardianLink', GuardianLinkSchema);
export default GuardianLink;
