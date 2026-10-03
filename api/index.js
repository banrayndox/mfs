import { app } from '../server/src/app.js';
import mongoose from 'mongoose';

let isConnected = false;

async function connectToDatabase() {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri || uri.trim() === '') {
    // In serverless environments, warn if MONGODB_URI is not set
    console.warn('[Vercel API] Warning: MONGODB_URI is not set. Database mutations may fail.');
    return;
  }

  try {
    await mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log('[Vercel API] Connected to MongoDB Atlas.');
  } catch (err) {
    console.error('[Vercel API] MongoDB connection error:', err);
  }
}

export default async function handler(req, res) {
  try {
    await connectToDatabase();
    return app(req, res);
  } catch (err) {
    console.error('[Vercel API] Handler error:', err);
    return res.status(500).json({
      code: 'SERVERLESS_HANDLER_ERROR',
      message: err.message || 'Internal Serverless Handler Error',
    });
  }
}
