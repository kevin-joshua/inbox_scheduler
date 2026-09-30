/**
 * TODO(lld): Implement job reconciliation on startup
 * 
 * On worker boot, reconcile job state:
 * 1. Find emails with status=PROCESSING (were being processed when worker crashed)
 * 2. Reset them to SCHEDULED
 * 3. Re-enqueue jobs for these emails
 * 4. Log reconciliation stats
 * 
 * This ensures no emails are lost if workers crash mid-processing.
 */

export class Reconciler {
  async reconcileOnStartup(): Promise<{ reconciledCount: number }> {
    throw new Error('Not implemented: reconcileOnStartup - TODO(lld): Reset orphaned PROCESSING emails and re-enqueue');
  }
}

export const reconciler = new Reconciler();
