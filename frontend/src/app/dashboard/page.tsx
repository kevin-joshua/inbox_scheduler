'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { ScheduledEmailsTable } from '@/components/emails/ScheduledEmailsTable';
import { SentEmailsTable } from '@/components/emails/SentEmailsTable';
import { ComposeModal } from '@/components/emails/ComposeModal';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const tabs = [
    { id: 'scheduled', label: 'Scheduled Emails' },
    { id: 'sent', label: 'Sent Emails' },
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Header />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Email Dashboard</h2>
            <Button
              onClick={() => setIsComposeOpen(true)}
              size="lg"
            >
              + Compose New Email
            </Button>
          </div>

          {/* Tabs */}
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as 'scheduled' | 'sent')}
          />

          {/* Content */}
          <div className="mt-6">
            {activeTab === 'scheduled' && <ScheduledEmailsTable />}
            {activeTab === 'sent' && <SentEmailsTable />}
          </div>
        </main>

        {/* Compose Modal */}
        <ComposeModal
          isOpen={isComposeOpen}
          onClose={() => setIsComposeOpen(false)}
        />
      </div>
    </ProtectedRoute>
  );
}
