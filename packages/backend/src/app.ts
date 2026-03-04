import express from 'express';
import pinoHttp from 'pino-http';
import { logger } from './logger.js';
import { healthRouter } from './health/health.router.js';

function createApp(): express.Express {
  const app = express();

  // Structured request logging
  app.use(
    pinoHttp({
      logger,
      // Redact sensitive headers
      serializers: {
        req(req: { id: string; method: string; url: string }) {
          return {
            id: req.id,
            method: req.method,
            url: req.url,
          };
        },
      },
    }),
  );

  // Parse JSON request bodies
  app.use(express.json());

  // Routes
  app.use(healthRouter);

  return app;
}

export { createApp };
