import mongoose from 'mongoose';

const LinkedAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    institutionName: {
      type: String,
      required: true,
      trim: true,
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
    },
    accountType: {
      type: String,
      enum: ['bank', 'card', 'mfs'],
      default: 'bank',
    },
    holderName: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['linked', 'unlinked'],
      default: 'linked',
      index: true,
    },
  },
  { timestamps: true }
);

export const LinkedAccount = mongoose.model('LinkedAccount', LinkedAccountSchema);
export default LinkedAccount;
