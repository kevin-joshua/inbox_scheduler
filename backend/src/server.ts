import 'dotenv/config';
import { app } from './app';
import { env } from './config/env';
import { logger } from './infra/logger';

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  logger.info(`API server listening on port ${PORT}`);
  logger.info(`Bull Board available at http://localhost:${PORT}/admin/queues`);
  logger.info(`Health check available at http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('API server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('API server closed');
    process.exit(0);
  });
});
