import express from 'express';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { pool } from './shared/adapters/db/pool';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

const app = express();

app.use(pinoHttp({ logger }));
app.use(express.json());

// Health check — public, no auth (per L2-002 §5.4 exception)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Backend server listening');
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close(() => {
    pool.end(() => {
      logger.info('Database pool closed');
      process.exit(0);
    });
  });
});

export { app };
