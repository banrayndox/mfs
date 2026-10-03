import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    pinHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    accountType: {
      type: String,
      enum: ['CUSTOMER', 'AGENT', 'CHILD'],
      default: 'CUSTOMER',
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'agent', 'analyst', 'admin'],
      default: 'user',
      index: true,
    },
    dob: {
      type: String,
      trim: true,
    },
    language: {
      type: String,
      enum: ['bn', 'en'],
      default: 'bn',
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'light',
    },
    status: {
      type: String,
      enum: ['active', 'locked', 'suspended'],
      default: 'active',
      index: true,
    },
    failedPinAttempts: {
      type: Number,
      default: 0,
    },
    lockoutUntil: {
      type: Date,
      default: null,
    },
    // Agent-specific fields if accountType === 'AGENT'
    agentProfile: {
      agentId: { type: String, sparse: true, index: true },
      businessName: { type: String, trim: true },
      location: { type: String, trim: true },
      address: { type: String, trim: true },
      status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    },
    // WebAuthn Passkeys
    webAuthnCredentials: [
      {
        credentialId: { type: String, required: true },
        publicKey: { type: String, required: true },
        counter: { type: Number, default: 0 },
        deviceType: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const User = mongoose.model('User', UserSchema);
export default User;
