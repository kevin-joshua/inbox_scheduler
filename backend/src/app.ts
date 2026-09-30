import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './infra/logger';
import { errorHandler } from './middleware/error-handler';
import { checkDatabaseHealth } from './db/client';
import { getRedisClient } from './infra/redis';
import { checkElasticHealth } from './infra/elastic';
import { authRouter } from './modules/auth/auth.routes';
import { emailsRouter } from './modules/emails/emails.routes';
import { sendersRouter } from './modules/senders/senders.routes';
import { slackRouter } from './modules/slack/slack.routes';
import { searchRouter } from './modules/search/search.routes';
import { bullBoardRouter, bullBoardAuth } from './queue/board';

export const app = express();

// Security & parsing middleware
app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(pinoHttp({ logger }));

// Health check endpoint
//
// Dependency classification:
//   CRITICAL  – database, redis   → 503 when either is down
//   OPTIONAL  – elasticsearch     → 'degraded' but still 200; email delivery
//               continues without ES (indexing is fire-and-forget)
app.get('/health', async (req, res) => {
  try {
    const [dbHealthy, esHealthy] = await Promise.all([
      checkDatabaseHealth(),
      checkElasticHealth(),
    ]);
    const redis = getRedisClient();
    const redisHealthy = redis.status === 'ready';

    const criticalOk = dbHealthy && redisHealthy;
    const allOk      = criticalOk && esHealthy;

    const body = {
      status:        allOk ? 'ok' : criticalOk ? 'degraded' : 'unhealthy',
      database:      dbHealthy    ? 'connected'    : 'disconnected',
      redis:         redisHealthy ? 'connected'    : 'disconnected',
      elasticsearch: esHealthy    ? 'connected'    : 'disconnected',
      timestamp:     new Date().toISOString(),
    };

    // Return 503 only when a CRITICAL dependency is down.
    // Elasticsearch being down keeps the service running (degraded).
    res.status(criticalOk ? 200 : 503).json(body);
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    res.status(503).json({
      status:    'error',
      message:   'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// API routes
app.use('/auth', authRouter);
app.use('/emails', emailsRouter);
app.use('/senders', sendersRouter);
app.use('/slack', slackRouter);
app.use('/search', searchRouter);

// Bull Board (protected by basic auth)
app.use('/admin/queues', bullBoardAuth, bullBoardRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler (must be last)
app.use(errorHandler);
