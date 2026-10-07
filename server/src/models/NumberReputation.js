import mongoose from 'mongoose';

const NumberReputationSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    reportCount: {
      type: Number,
      default: 0,
    },
    distinctReporters: {
      type: Number,
      default: 0,
    },
    riskScore: {
      type: Number,
      default: 0.0,
      min: 0,
      max: 1,
    },
    analystStatus: {
      type: String,
      enum: ['unreviewed', 'flagged', 'cleared'],
      default: 'unreviewed',
      index: true,
    },
    tags: [String],
    lastReportedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export const NumberReputation = mongoose.model('NumberReputation', NumberReputationSchema);
export default NumberReputation;
