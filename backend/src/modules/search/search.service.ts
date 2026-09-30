/**
 * Elasticsearch Search Service
 *
 * Index schema (created lazily on first write if absent)
 * ───────────────────────────────────────────────────────
 * Index:  "emails"
 *
 * Mappings:
 *   emailId    keyword   – exact match, used as _id
 *   userId     keyword   – mandatory filter for all searches (user-scoped)
 *   batchId    keyword   – optional filter
 *   recipient  keyword   – exact search by email address
 *   subject    text      – full-text, english analyzer
 *   body       text      – full-text, english analyzer
 *   status     keyword   – SCHEDULED | PROCESSING | SENT | FAILED
 *   sentAt     date      – ISO 8601
 *   scheduledAt date     – ISO 8601
 *   indexedAt  date      – when this document was (last) indexed
 *
 * All searches are scoped to `userId` via a `filter` clause, so users can
 * never see each other's emails even if they share the same Elasticsearch node.
 *
 * Indexing failure is intentionally non-blocking for email delivery –
 * the index job is fire-and-forget from the email worker.
 */

import { getElasticClient } from '../../infra/elastic';
import { logger } from '../../infra/logger';

const INDEX = 'emails';

// ─── Index document shape ─────────────────────────────────────────────────────

export interface EmailIndexDocument {
  emailId:     string;
  userId:      string;
  batchId:     string;
  recipient:   string;
  subject:     string;
  body:        string;
  status:      string;
  sentAt:      string | null;
  scheduledAt: string;
  indexedAt:   string;
}

export interface SearchHit {
  id:          string;   // emailId
  userId:      string;
  batchId:     string;
  recipient:   string;
  subject:     string;
  body:        string;
  status:      string;
  sentAt:      string | null;
  scheduledAt: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class SearchService {
  /**
   * Ensure the emails index exists with the correct mappings.
   * Idempotent – called before the first write; subsequent calls are no-ops.
   */
  async ensureIndex(): Promise<void> {
    const client = getElasticClient();

    const exists = await client.indices.exists({ index: INDEX });
    if (exists) return;

    await client.indices.create({
      index: INDEX,
      mappings: {
        properties: {
          emailId:     { type: 'keyword' },
          userId:      { type: 'keyword' },
          batchId:     { type: 'keyword' },
          recipient:   { type: 'keyword'  },
          subject:     { type: 'text', analyzer: 'english' },
          body:        { type: 'text', analyzer: 'english' },
          status:      { type: 'keyword' },
          sentAt:      { type: 'date' },
          scheduledAt: { type: 'date' },
          indexedAt:   { type: 'date' },
        },
      },
      settings: {
        number_of_shards:   1,
        number_of_replicas: 0,   // Set to 1 in production with multiple ES nodes
        refresh_interval:  '5s', // Relax for write throughput
      },
    });

    logger.info({ index: INDEX }, 'Elasticsearch index created');
  }

  /**
   * Index (or re-index) a single email document.
   * Uses emailId as the ES document `_id` → idempotent upsert.
   * userId is stored in the document so every search can filter by it.
   */
  async indexEmail(doc: EmailIndexDocument): Promise<void> {
    const client = getElasticClient();

    await client.index({
      index:   INDEX,
      id:      doc.emailId,
      document: {
        ...doc,
        indexedAt: new Date().toISOString(),
      },
    });

    logger.debug({ emailId: doc.emailId }, 'Email indexed in Elasticsearch');
  }

  /**
   * Full-text search across subject and body, scoped to the given userId.
   *
   * @param userId   Authenticated user – mandatory filter (cannot be bypassed)
   * @param query    Free-text search string
   * @param filters  Optional additional filters
   * @param page     1-indexed page number (default 1)
   * @param limit    Results per page (default 20, max 100)
   */
  async searchEmails(
    userId:  string,
    query:   string,
    filters?: { status?: string; batchId?: string; recipient?: string },
    page  = 1,
    limit = 20
  ): Promise<{ hits: SearchHit[]; total: number }> {
    const client = getElasticClient();

    const from = (page - 1) * Math.min(limit, 100);

    // Build filter clauses (all conditions must match – AND semantics)
    const filterClauses: object[] = [
      { term: { userId } }, // ← always applied; user can never see others' emails
    ];

    if (filters?.status)    filterClauses.push({ term: { status:    filters.status } });
    if (filters?.batchId)   filterClauses.push({ term: { batchId:   filters.batchId } });
    if (filters?.recipient) filterClauses.push({ term: { recipient: filters.recipient } });

    // Query clause: multi-match across subject + body, or match_all when blank
    const queryClause = query.trim()
      ? {
          multi_match: {
            query,
            fields:  ['subject^2', 'body'],  // subject weighted 2×
            type:    'best_fields' as const,
            fuzziness: 'AUTO',
          },
        }
      : { match_all: {} };

    const result = await client.search<EmailIndexDocument>({
      index: INDEX,
      from,
      size:  Math.min(limit, 100),
      query: {
        bool: {
          must:   queryClause,
          filter: filterClauses,
        },
      },
      sort: [
        { _score: { order: 'desc' } },
        { scheduledAt: { order: 'desc' } },
      ],
      _source: ['emailId', 'userId', 'batchId', 'recipient', 'subject', 'body', 'status', 'sentAt', 'scheduledAt'],
    });

    const total =
      typeof result.hits.total === 'number'
        ? result.hits.total
        : (result.hits.total?.value ?? 0);

    const hits: SearchHit[] = result.hits.hits
      .filter((h) => h._source)
      .map((h) => ({
        id:          h._source!.emailId,
        userId:      h._source!.userId,
        batchId:     h._source!.batchId,
        recipient:   h._source!.recipient,
        subject:     h._source!.subject,
        body:        h._source!.body,
        status:      h._source!.status,
        sentAt:      h._source!.sentAt,
        scheduledAt: h._source!.scheduledAt,
      }));

    return { hits, total };
  }

  /**
   * Remove an email document from the index.
   * Idempotent – does not throw if the document doesn't exist.
   */
  async removeEmail(emailId: string): Promise<void> {
    const client = getElasticClient();

    try {
      await client.delete({ index: INDEX, id: emailId });
      logger.debug({ emailId }, 'Email removed from Elasticsearch index');
    } catch (err: any) {
      if (err?.meta?.statusCode === 404) {
        // Document not found – already gone, this is fine
        return;
      }
      throw err;
    }
  }

  /**
   * Bulk index multiple email documents in a single Elasticsearch request.
   * Used by the index worker when processing large batches.
   */
  async bulkIndexEmails(docs: EmailIndexDocument[]): Promise<void> {
    if (docs.length === 0) return;

    const client = getElasticClient();
    const indexedAt = new Date().toISOString();

    const operations = docs.flatMap((doc) => [
      { index: { _index: INDEX, _id: doc.emailId } },
      { ...doc, indexedAt },
    ]);

    const result = await client.bulk({ operations, refresh: false });

    if (result.errors) {
      const failed = result.items
        .filter((item) => item.index?.error)
        .map((item) => ({ id: item.index?._id, error: item.index?.error }));

      logger.warn({ failed }, 'Some emails failed to bulk-index');
    }

    logger.debug({ count: docs.length }, 'Bulk email indexing completed');
  }
}

export const searchService = new SearchService();
