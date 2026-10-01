'use client';

import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { ScheduledEmailsTable } from '@/components/emails/ScheduledEmailsTable';
import { SentEmailsTable } from '@/components/emails/SentEmailsTable';
import { ComposeModal } from '@/components/emails/ComposeModal';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; recipient: string; subject: string; status: string; scheduledAt: string; sentAt: string | null }>>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const query = search.trim();
    if (!query) { setSearchResults([]); return; }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try { setSearchResults((await api.searchEmails(query)).data); }
      catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const tabs = [
    { id: 'scheduled', label: 'Scheduled Emails' },
    { id: 'sent', label: 'Sent Emails' },
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#f8faf9] flex">
        <Header />

        <main className="flex-1 min-w-0 px-8 py-8">
          {/* Page Header */}
          <div className="flex justify-between items-center mb-6">
            <div><p className="text-xs text-[#8a948e] mb-1">Workspace / Emails</p><h2 className="text-2xl font-bold tracking-tight text-[#202522]">Email Dashboard</h2></div>
            <Button
              onClick={() => setIsComposeOpen(true)}
              size="lg"
            >
              + Compose New Email
            </Button>
          </div>

          <div className="mb-5 relative">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search sent and scheduled emails..."
              className="w-full rounded-lg border border-[#dfe8e2] bg-white px-4 py-3 text-sm text-[#202522] outline-none transition focus:border-[#8bc9aa] focus:ring-2 focus:ring-[#dff4e7]"
            />
            {search && (
              <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-lg border border-[#e6ece8] bg-white shadow-lg">
                {searching ? <div className="px-4 py-3 text-sm text-[#7a8580]">Searching Elasticsearch...</div> : searchResults.length === 0 ? <div className="px-4 py-3 text-sm text-[#7a8580]">No matching emails</div> : searchResults.map((email) => (
                  <div key={email.id} className="flex items-center justify-between border-b border-[#f0f3f1] px-4 py-3 last:border-0">
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-[#202522]">{email.subject}</p><p className="truncate text-xs text-[#8a948e]">{email.recipient}</p></div>
                    <span className="ml-4 rounded-full bg-[#eef8f1] px-2 py-1 text-[11px] font-medium text-[#4c8d65]">{email.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as 'scheduled' | 'sent')}
          />

          {/* Content */}
          <div className="mt-5 rounded-xl border border-[#e6ece8] bg-white overflow-hidden shadow-[0_4px_20px_rgba(32,37,34,0.03)]">
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
