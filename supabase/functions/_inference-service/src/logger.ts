import pino from 'pino';

const level = (process.env.LOG_LEVEL || 'info').toLowerCase();

export const logger = pino({
  level,
  base: { service: 'growbro-inference-service' },
});
