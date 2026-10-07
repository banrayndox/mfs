import mongoose from 'mongoose';

const ProtectedProfileSchema = new mongoose.Schema(
  {
    guardianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    childUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    birthCertificateMasked: {
      type: String,
      required: true,
    },
    birthCertHash: {
      type: String,
      required: true,
      index: true,
    },
    dailyLimitPoisha: {
      type: Number,
      default: 50000, // 500 BDT default
    },
    requireApprovalForNewRecipients: {
      type: Boolean,
      default: true,
    },
    controlMode: {
      type: String,
      enum: ['APPROVAL_REQUIRED', 'LIMITED', 'UPDATES_ONLY'],
      default: 'APPROVAL_REQUIRED',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true }
);

export const ProtectedProfile = mongoose.model('ProtectedProfile', ProtectedProfileSchema);
export default ProtectedProfile;
