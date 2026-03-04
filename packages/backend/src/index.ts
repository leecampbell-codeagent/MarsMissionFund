import { createApp } from './app.js';
import { createDependencies } from './composition-root.js';
import { logger } from './logger.js';

const port = Number(process.env['PORT'] ?? 3001);

async function main(): Promise<void> {
  const deps = await createDependencies();
  const app = createApp(deps);

  app.listen(port, () => {
    logger.info({ port }, 'Backend server started');
  });
}

main().catch((error: unknown) => {
  logger.fatal({ error }, 'Failed to start server');
  process.exit(1);
});
