import { createApp } from './app.js';
import { env } from './config/env.js';
import { openDatabase } from './db/database.js';
import { logger } from './lib/logger.js';

const db = openDatabase(env.DATABASE_PATH);
const app = createApp({ db });

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, `Server listening on ${env.PUBLIC_BASE_URL}`);
});

/** Stops accepting connections, lets in-flight requests finish, then closes the database. */
function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'Shutting down');
  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close((err) => {
    db.close();
    if (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
    process.exit(0);
  });
  server.closeIdleConnections();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});
