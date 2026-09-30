'use client';

import { Table } from '../ui/Table';

interface Email {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  scheduledAt: string;
}

interface EmailTableProps {
  emails: Email[];
  loading?: boolean;
}

/**
 * TODO(lld): Implement email table
 * - Display emails with columns: recipient, subject, status, scheduled time
 * - Add actions: cancel, retry
 * - Add filtering by status
 * - Add pagination
 * - Real-time updates via polling or WebSocket
 */

export function EmailTable({ emails, loading = false }: EmailTableProps) {
  return (
    <Table
      data={emails}
      columns={[
        { header: 'Recipient', accessor: 'recipient' },
        { header: 'Subject', accessor: 'subject' },
        { header: 'Status', accessor: 'status' },
        { header: 'Scheduled At', accessor: 'scheduledAt' },
        {
          header: 'Actions',
          accessor: () => <span className="text-gray-400">TODO</span>,
        },
      ]}
      loading={loading}
      emptyMessage="No emails scheduled"
    />
  );
}
