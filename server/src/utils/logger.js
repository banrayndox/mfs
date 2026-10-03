import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
  // Ensure no PII (PINs, NIDs, tokens, raw passwords) can be logged accidentally
  redact: {
    paths: ['req.headers.authorization', 'req.headers["x-step-up-token"]', '*.pin', '*.pinHash', '*.nid', '*.password', '*.token'],
    censor: '[REDACTED]',
  },
});

export default logger;
