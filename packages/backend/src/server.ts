import { Pool } from 'pg';
import pino from 'pino';
import { createApp } from './app.js';
import { createServices } from './composition-root.js';

const logger = pino(
  process.env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }
    : {},
);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  logger.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

const services = createServices(pool, logger);
const app = createApp({ ...services, logger });

const port = Number.parseInt(process.env.PORT ?? '3000', 10);

app.listen(port, () => {
  logger.info({ port }, 'Backend server started');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down gracefully');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received — shutting down gracefully');
  await pool.end();
  process.exit(0);
});




























