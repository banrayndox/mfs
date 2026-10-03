import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-fallback-key-32chars';

/** @type {import('socket.io').Server | null} */
let ioInstance = null;

/**
 * Initialize Socket.IO with authentication middleware and room lifecycle handlers.
 * @param {import('socket.io').Server} io
 */
export function initSocket(io) {
  ioInstance = io;

  // Socket Authentication Middleware
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
      socket.user = decoded;
      socket.userId = decoded.userId || decoded.id;

      if (!socket.userId) {
        return next(new Error('Invalid token payload'));
      }

      next();
    } catch (err) {
      logger.debug({ err: err.message }, 'Socket authentication failed');
      return next(new Error('Authentication failed: ' + err.message));
    }
  });

  // Socket Connection and Event Routing
  io.on('connection', (socket) => {
    const userId = socket.userId;
    const userRoom = `user:${userId}`;

    socket.join(userRoom);
    logger.info({ socketId: socket.id, userId }, `Socket authenticated and joined ${userRoom}`);

    // Allow joining specific resource rooms (e.g., group bill request rooms)
    socket.on('join_room', (room) => {
      if (typeof room === 'string' && room.startsWith('group_bill:')) {
        socket.join(room);
        logger.debug({ socketId: socket.id, room }, `Socket joined room: ${room}`);
      }
    });

    socket.on('leave_room', (room) => {
      if (typeof room === 'string') {
        socket.leave(room);
        logger.debug({ socketId: socket.id, room }, `Socket left room: ${room}`);
      }
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, userId, reason }, `Socket disconnected`);
    });
  });

  return ioInstance;
}

/**
 * Returns active Socket.IO server instance.
 */
export function getIO() {
  return ioInstance;
}

/**
 * Emit an event to a specific user's private room.
 * @param {string} userId
 * @param {string} event
 * @param {any} data
 */
export function emitToUser(userId, event, data) {
  if (!ioInstance || !userId) return;
  const room = `user:${userId.toString()}`;
  ioInstance.to(room).emit(event, data);
  logger.debug({ event, room }, `Socket event emitted to user`);
}

/**
 * Emit an event to a shared room.
 * @param {string} room
 * @param {string} event
 * @param {any} data
 */
export function emitToRoom(room, event, data) {
  if (!ioInstance || !room) return;
  ioInstance.to(room).emit(event, data);
  logger.debug({ event, room }, `Socket event emitted to room`);
}

/**
 * Broadcast an event to all connected sockets.
 * @param {string} event
 * @param {any} data
 */
export function broadcastEvent(event, data) {
  if (!ioInstance) return;
  ioInstance.emit(event, data);
}

/**
 * Notify a user of a wallet balance change and/or newly settled transaction.
 * @param {string} userId
 * @param {{ balancePoisha?: number, transaction?: any }} data
 */
export function notifyWalletUpdate(userId, { balancePoisha, transaction } = {}) {
  if (!userId) return;
  const uid = userId.toString();

  if (balancePoisha !== undefined) {
    emitToUser(uid, 'wallet:balance', { balancePoisha });
  }

  if (transaction) {
    emitToUser(uid, 'transaction:new', { transaction });
  }
}

/**
 * Notify a user of a newly created notification.
 * @param {string} userId
 * @param {any} notification
 */
export function notifyNewNotification(userId, notification) {
  if (!userId || !notification) return;
  emitToUser(userId.toString(), 'notification:new', { notification });
}

/**
 * Notify a guardian that a child transaction requires approval.
 * @param {string} guardianId
 * @param {any} approvalData
 */
export function notifyGuardianApprovalRequired(guardianId, approvalData) {
  if (!guardianId) return;
  emitToUser(guardianId.toString(), 'guardian:approval_request', approvalData);
}

/**
 * Notify child and guardian that an approval was decided.
 * @param {string} childId
 * @param {string} guardianId
 * @param {any} decisionData
 */
export function notifyGuardianApprovalDecided(childId, guardianId, decisionData) {
  if (childId) {
    emitToUser(childId.toString(), 'guardian:approval_decided', decisionData);
  }
  if (guardianId) {
    emitToUser(guardianId.toString(), 'guardian:approval_decided', decisionData);
  }
}

/**
 * Notify participants of a group bill request update.
 * @param {string} requestId
 * @param {any} groupBill
 * @param {string[]} [participantUserIds=[]]
 */
export function notifyGroupBillUpdate(requestId, groupBill, participantUserIds = []) {
  if (!requestId) return;
  const room = `group_bill:${requestId.toString()}`;
  emitToRoom(room, 'group_bill:update', { request: groupBill });

  // Also emit directly to each participant's personal room
  if (Array.isArray(participantUserIds)) {
    participantUserIds.forEach((pid) => {
      if (pid) {
        emitToUser(pid.toString(), 'group_bill:update', { request: groupBill });
      }
    });
  }
}

/**
 * Notify a user of an updated savings plan.
 * @param {string} userId
 * @param {any} plan
 */
export function notifySavingsPlanUpdate(userId, plan) {
  if (!userId || !plan) return;
  emitToUser(userId.toString(), 'savings:update', { plan });
}

/**
 * Notify a user of updated micro-savings configuration.
 * @param {string} userId
 * @param {any} microSavings
 */
export function notifySavingsConfigUpdate(userId, microSavings) {
  if (!userId || !microSavings) return;
  emitToUser(userId.toString(), 'savings:config', { microSavings });
}
