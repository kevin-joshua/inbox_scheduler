import { config } from 'dotenv';
import { resolve, join } from 'path';

// Load .env from project root
// When running with tsx: __dirname is backend/src, so go up 2 levels
// When running compiled: __dirname is backend/dist, so go up 2 levels
config({ path: resolve(__dirname, '../../.env') });
import { app } from './app';
import { env } from './config/env';
import { logger } from './infra/logger';
import { disconnectPrisma } from './db/client';
import { closeRedis } from './infra/redis';
import { closeElastic } from './infra/elastic';
import { closeAllTransporters } from './infra/mailer';
import { emailQueue, indexQueue, notifyQueue } from './queue/queues';

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  logger.info(`API server listening on port ${PORT}`);
  logger.info(`Bull Board available at http://localhost:${PORT}/admin/queues`);
  logger.info(`Health check available at http://localhost:${PORT}/health`);
});

// Graceful shutdown handler
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down gracefully`);
  
  try {
    // Close HTTP server (stop accepting new connections)
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          logger.error({ err }, 'Error closing HTTP server');
          reject(err);
        } else {
          logger.info('HTTP server closed');
          resolve();
        }
      });
    });

    // Close BullMQ queues (stop accepting new jobs)
    logger.info('Closing BullMQ queues...');
    await Promise.all([
      emailQueue.close(),
      indexQueue.close(),
      notifyQueue.close(),
    ]);
    logger.info('BullMQ queues closed');

    // Close all SMTP transporters
    closeAllTransporters();

    // Close database connection
    await disconnectPrisma();

    // Close Redis connection
    await closeRedis();

    // Close Elasticsearch connection
    await closeElastic();

    logger.info('Graceful shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
