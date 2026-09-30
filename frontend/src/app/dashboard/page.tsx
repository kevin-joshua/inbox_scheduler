'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { EmailTable } from '@/components/emails/EmailTable';
import { ComposeModal } from '@/components/emails/ComposeModal';

export default function DashboardPage() {
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  // Mock data for demonstration
  const scheduledEmails = [
    {
      id: '1',
      recipient: 'example@test.com',
      subject: 'Test Email',
      status: 'SCHEDULED',
      scheduledAt: '2026-09-30T12:00:00Z',
    },
  ];

  const sentEmails = [
    {
      id: '2',
      recipient: 'sent@test.com',
      subject: 'Previous Email',
      status: 'SENT',
      scheduledAt: '2026-09-29T10:00:00Z',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Email Campaigns</h2>
          <Button onClick={() => setIsComposeOpen(true)}>
            Compose New Email
          </Button>
        </div>

        <Tabs
          tabs={[
            {
              label: 'Scheduled',
              content: <EmailTable emails={scheduledEmails} />,
            },
            {
              label: 'Sent',
              content: <EmailTable emails={sentEmails} />,
            },
          ]}
        />

        <ComposeModal
          isOpen={isComposeOpen}
          onClose={() => setIsComposeOpen(false)}
        />

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> This is a placeholder dashboard with mock data.
            TODO(lld): Integrate with useAuth and useEmails hooks to fetch real data.
          </p>
        </div>
      </main>
    </div>
  );
}
