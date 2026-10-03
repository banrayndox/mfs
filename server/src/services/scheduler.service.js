import { Schedule, Reminder, User, Wallet, Notification, AuditLog } from '../models/index.js';
import { sendMoney, payBill, mobileRecharge } from './transaction.service.js';
import { emitToUser, notifyNewNotification } from './socket.service.js';
import logger from '../utils/logger.js';

let workerInterval = null;

/**
 * Create a new scheduled automation with mandate.
 */
export async function createSchedule({
  userId,
  actionType,
  frequency,
  actionPayload,
  nextRunAt,
  mandate,
}) {
  if (!userId || !actionType || !frequency || !nextRunAt || !mandate) {
    throw new Error('userId, actionType, frequency, nextRunAt, and mandate are required.');
  }

  const schedule = await Schedule.create({
    userId,
    actionType,
    frequency,
    actionPayload,
    nextRunAt: new Date(nextRunAt),
    mandate: {
      maxAmountPerRun: mandate.maxAmountPerRun,
      dailyCap: mandate.dailyCap,
      allowedRecipient: mandate.allowedRecipient,
      expiresAt: mandate.expiresAt ? new Date(mandate.expiresAt) : undefined,
    },
    status: 'active',
  });

  await AuditLog.create({
    userId,
    action: 'SCHEDULE_CREATED',
    actorType: 'user',
    status: 'success',
    details: { scheduleId: schedule._id, actionType, frequency },
  });

  return schedule;
}

/**
 * Calculate the next run time after execution for recurring schedules.
 */
export function calculateNextRun(frequency, currentDate = new Date()) {
  const next = new Date(currentDate);
  switch (frequency) {
    case 'recurring_daily':
      next.setDate(next.getDate() + 1);
      return next;
    case 'recurring_weekly':
      next.setDate(next.getDate() + 7);
      return next;
    case 'recurring_monthly':
      next.setMonth(next.getMonth() + 1);
      return next;
    default:
      return null;
  }
}

/**
 * Execute a single scheduled job with mandate validation.
 */
export async function executeScheduledJob(job) {
  logger.info({ jobId: job._id, actionType: job.actionType }, 'Executing scheduled job...');

  const { userId, actionType, actionPayload, mandate } = job;
  const amountPoisha = actionPayload.amountPoisha || 0;

  // 1. Mandate Validation
  if (mandate.maxAmountPerRun && amountPoisha > mandate.maxAmountPerRun) {
    throw new Error(`Amount ৳${amountPoisha / 100} exceeds scheduled mandate limit ৳${mandate.maxAmountPerRun / 100}`);
  }

  if (mandate.expiresAt && new Date() > new Date(mandate.expiresAt)) {
    job.status = 'completed';
    await job.save();
    throw new Error('Schedule mandate has expired.');
  }

  // 2. Dispatch to single service layer
  let txnResult = null;
  switch (actionType) {
    case 'send_money':
      txnResult = await sendMoney({
        senderUserId: userId,
        recipientPhone: actionPayload.recipientPhone,
        amountPoisha,
        channel: 'schedule',
        idempotencyKey: `sched-${job._id}-${Date.now()}`,
      });
      break;

    case 'pay_bill':
      txnResult = await payBill({
        userId,
        billerId: actionPayload.billerId || 'DPDC',
        accountNo: actionPayload.accountNo || '442109',
        amountPoisha,
        channel: 'schedule',
        idempotencyKey: `sched-bill-${job._id}-${Date.now()}`,
      });
      break;

    case 'recharge':
      txnResult = await mobileRecharge({
        userId,
        phone: actionPayload.phone,
        operator: actionPayload.operator,
        amountPoisha,
        channel: 'schedule',
        idempotencyKey: `sched-recharge-${job._id}-${Date.now()}`,
      });
      break;

    default:
      logger.warn({ actionType }, 'Unsupported schedule action type');
  }

  // 3. Update job recurrence or mark complete
  job.lastRunAt = new Date();
  job.retryCount = 0;
  job.lastError = null;

  if (job.frequency === 'one_time') {
    job.status = 'completed';
  } else {
    job.nextRunAt = calculateNextRun(job.frequency, job.nextRunAt);
  }

  await job.save();

  // Notification for scheduled execution
  await Notification.create({
    userId,
    title: 'শিডিউল পেমেন্ট সফল (Scheduled Payment Settled)',
    body: `আপনার শিডিউল করা ${actionType === 'pay_bill' ? 'বিদ্যুৎ বিল' : 'টাকা পাঠানো'} সফলভাবে সম্পন্ন হয়েছে।`,
    type: 'scheduled_due',
    metadata: { scheduleId: job._id, txnId: txnResult?._id },
  });

  return txnResult;
}

/**
 * Worker polling loop: atomically claims due jobs and executes them.
 */
export async function pollAndExecuteDueSchedules() {
  const now = new Date();
  const leaseDurationMs = 30000; // 30s lease
  const leaseExpiry = new Date(Date.now() + leaseDurationMs);

  try {
    // Atomically claim due job using findOneAndUpdate lock
    const job = await Schedule.findOneAndUpdate(
      {
        status: 'active',
        nextRunAt: { $lte: now },
        $or: [{ leaseExpiresAt: null }, { leaseExpiresAt: { $lt: now } }],
      },
      {
        $set: {
          leaseOwner: `worker-${process.pid}`,
          leaseExpiresAt: leaseExpiry,
        },
      },
      { new: true }
    );

    if (!job) return;

    try {
      await executeScheduledJob(job);
    } catch (err) {
      logger.error({ err, jobId: job._id }, 'Execution of scheduled job failed');
      job.retryCount += 1;
      job.lastError = err.message;
      if (job.retryCount >= 3) {
        job.status = 'failed';
      }
      job.leaseExpiresAt = null;
      await job.save();
    }
  } catch (err) {
    logger.error({ err }, 'Scheduler polling error');
  }
}

/**
 * Worker polling loop: finds and executes due reminders, creating notifications and socket events.
 */
export async function pollAndExecuteDueReminders() {
  const now = new Date();
  try {
    const dueReminders = await Reminder.find({
      isCompleted: false,
      dueAt: { $lte: now },
    }).limit(20);

    for (const reminder of dueReminders) {
      reminder.isCompleted = true;
      reminder.completedAt = now;
      await reminder.save();

      const notif = await Notification.create({
        userId: reminder.userId,
        title: 'রিমাইন্ডার সময় হয়েছে (Reminder Due)',
        body: reminder.title + (reminder.amount ? ` (৳${reminder.amount})` : ''),
        type: 'reminder',
        metadata: {
          reminderId: reminder._id,
          amount: reminder.amount,
          deepLink: reminder.deepLink,
        },
      });

      emitToUser(reminder.userId.toString(), 'reminder:due', {
        reminder,
        notification: notif,
      });
      notifyNewNotification(reminder.userId.toString(), notif);
      logger.info({ reminderId: reminder._id, userId: reminder.userId }, 'Dispatched due reminder notification.');
    }
  } catch (err) {
    logger.error({ err }, 'Reminder polling error');
  }
}

/**
 * Poll both scheduled payments and reminders.
 */
export async function pollAllDueJobs() {
  await pollAndExecuteDueSchedules();
  await pollAndExecuteDueReminders();
}

/**
 * Start the persistent background scheduler worker.
 */
export function startSchedulerWorker(intervalMs = 5000) {
  if (workerInterval) return;
  logger.info(`Starting Scheduler Worker (polling every ${intervalMs / 1000}s)...`);
  workerInterval = setInterval(pollAllDueJobs, intervalMs);
}

/**
 * Stop scheduler worker.
 */
export function stopSchedulerWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}

export default {
  createSchedule,
  executeScheduledJob,
  pollAndExecuteDueSchedules,
  pollAndExecuteDueReminders,
  pollAllDueJobs,
  startSchedulerWorker,
  stopSchedulerWorker,
};
