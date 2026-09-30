import { Client } from '@elastic/elasticsearch';
import { logger } from './logger';

let elasticClient: Client | null = null;

/**
 * Get or create Elasticsearch client instance
 */
export function getElasticClient(): Client {
  if (!elasticClient) {
    const elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
    
    elasticClient = new Client({
      node: elasticsearchUrl,
    });

    logger.info('Elasticsearch client initialized');
  }

  return elasticClient;
}

/**
 * Check if Elasticsearch is reachable
 */
export async function checkElasticHealth(): Promise<boolean> {
  try {
    const client = getElasticClient();
    const health = await client.cluster.health();
    return health.status === 'green' || health.status === 'yellow';
  } catch (error) {
    logger.error({ error }, 'Elasticsearch health check failed');
    return false;
  }
}

/**
 * Gracefully close the Elasticsearch connection
 */
export async function closeElastic(): Promise<void> {
  if (elasticClient) {
    await elasticClient.close();
    elasticClient = null;
    logger.info('Elasticsearch connection closed');
  }
}
