import { io } from 'socket.io-client';

/** @type {import('socket.io-client').Socket | null} */
let socket = null;
let currentToken = null;

// Determine socket server URL
const getSocketUrl = () => {
  if (typeof window !== 'undefined') {
    // In dev, Vite is on 5173, backend on 5000
    if (window.location.port === '5173') {
      return `${window.location.protocol}//${window.location.hostname}:5000`;
    }
    return window.location.origin;
  }
  return 'http://localhost:5000';
};

/**
 * Connect to Socket.IO server using authenticated JWT.
 * @param {string} token
 */
export function connectSocket(token) {
  if (!token) {
    disconnectSocket();
    return null;
  }

  // If already connected with the same token, reuse existing socket
  if (socket && socket.connected && currentToken === token) {
    return socket;
  }

  // Disconnect any existing connection with old token
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token;

  socket = io(getSocketUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    // Connected to server
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket.IO] Connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect') {
      // Reconnect manually if disconnected by server
      socket.connect();
    }
  });

  return socket;
}

/**
 * Return current active socket instance.
 */
export function getSocket() {
  return socket;
}

/**
 * Disconnect and tear down active socket.
 */
export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  currentToken = null;
}

/**
 * Join a specific room (e.g. group bill request room).
 * @param {string} room
 */
export function joinRoom(room) {
  if (socket && socket.connected) {
    socket.emit('join_room', room);
  }
}

/**
 * Leave a specific room.
 * @param {string} room
 */
export function leaveRoom(room) {
  if (socket && socket.connected) {
    socket.emit('leave_room', room);
  }
}
