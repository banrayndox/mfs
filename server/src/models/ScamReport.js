import mongoose from 'mongoose';

const ScamReportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reportedPhone: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    messageText: {
      type: String,
      required: true,
    },
    channel: {
      type: String,
      enum: ['sms', 'call', 'whatsapp'],
      default: 'sms',
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      index: true,
    },
    analystNotes: {
      type: String,
    },
  },
  { timestamps: true }
);

export const ScamReport = mongoose.model('ScamReport', ScamReportSchema);
export default ScamReport;
