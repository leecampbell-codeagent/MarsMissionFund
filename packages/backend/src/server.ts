import express, { type NextFunction, type Request, type Response } from 'express';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { healthRouter } from './health/api/health-router.js';

const transport = process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined;

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info', transport });

const app = express();

app.use(pinoHttp({ logger }));

app.use('/health', healthRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
});

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT ?? 3001);
  app.listen(port, () => {
    logger.info({ port }, 'Backend server started');
  });
}

export { app };
