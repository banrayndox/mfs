import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : isTest ? 'silent' : 'debug'),
  transport: (isProduction || isTest)
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
          sync: true,
        },
      },
  // Strict non-negotiable PII and secret redaction (AGENTS.md rule 4 & Security Hardening)
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-step-up-token"]',
      'req.headers.cookie',
      '*.pin',
      '*.pinHash',
      '*.nid',
      '*.password',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.stepUpToken',
      '*.jwt',
      '*.secret',
      '*.groqApiKey',
      '*.apiKey',
      '*.clientSecret',
      '*.birthCertificate',
      '*.otp',
    ],
    censor: '[REDACTED]',
  },
});

export default logger;

