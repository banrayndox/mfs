import mongoose from 'mongoose';

const ReminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    dueAt: {
      type: Date,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
    },
    deepLink: {
      type: String,
    },
    source: {
      type: String,
      enum: ['manual', 'ai_suggested', 'group_request_followup'],
      default: 'manual',
    },
    isCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export const Reminder = mongoose.model('Reminder', ReminderSchema);
export default Reminder;
