import { PrismaClient } from '@prisma/client';
import { logger } from '../infra/logger';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });

// Log Prisma events
prisma.$on('query' as never, (e: unknown) => {
  const event = e as { query: string; duration: number };
  logger.debug({ query: event.query, duration: event.duration }, 'Prisma query');
});

prisma.$on('error' as never, (e: unknown) => {
  const event = e as { message: string };
  logger.error({ error: event.message }, 'Prisma error');
});

prisma.$on('warn' as never, (e: unknown) => {
  const event = e as { message: string };
  logger.warn({ warning: event.message }, 'Prisma warning');
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Check database connection health
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return false;
  }
}

/**
 * Gracefully disconnect Prisma client
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Prisma client disconnected');
}
