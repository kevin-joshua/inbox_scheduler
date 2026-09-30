'use client';

import { useState, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useSenders } from '@/hooks/useSenders';
import { api } from '@/lib/api';
import { parseCSVEmails } from '@/lib/utils';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ComposeModal({ isOpen, onClose }: ComposeModalProps) {
  const { senders, isLoading: sendersLoading } = useSenders();
  const [step, setStep] = useState<'compose' | 'recipients' | 'schedule'>('compose');

  // Form state
  const [senderId, setSenderId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [invalidEmails, setInvalidEmails] = useState<string[]>([]);
  const [startAt, setStartAt] = useState('');
  const [delayMs, setDelayMs] = useState('1000');
  const [hourlyLimit, setHourlyLimit] = useState('100');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = parseCSVEmails(content);
      setRecipients(result.valid);
      setInvalidEmails(result.invalid);
      
      // Clear any previous errors
      if (result.valid.length > 0) {
        setError(null);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Validation
      if (!senderId) {
        setError('Please select a sender');
        return;
      }
      if (!subject.trim()) {
        setError('Please enter a subject');
        return;
      }
      if (!body.trim()) {
        setError('Please enter a message body');
        return;
      }
      if (recipients.length === 0) {
        setError('Please upload a recipient list');
        return;
      }
      if (!startAt) {
        setError('Please select a start time');
        return;
      }

      // Schedule batch
      await api.scheduleBatch({
        senderId,
        recipients,
        subject,
        body,
        startAt: new Date(startAt).toISOString(),
        delayMs: parseInt(delayMs),
        hourlyLimit: parseInt(hourlyLimit),
      });

      // Success - show message briefly then close
      setSuccessMessage(`✓ Successfully scheduled ${recipients.length} emails!`);
      
      setTimeout(() => {
        onClose();
        resetForm();
        // Reload page to show new emails
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Failed to schedule batch:', err);
      setError(err instanceof Error ? err.message : 'Failed to schedule emails');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep('compose');
    setSenderId('');
    setSubject('');
    setBody('');
    setRecipients([]);
    setInvalidEmails([]);
    setStartAt('');
    setDelayMs('1000');
    setHourlyLimit('100');
    setError(null);
    setSuccessMessage(null);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      resetForm();
    }
  };

  if (sendersLoading) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Compose Email">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading...</p>
        </div>
      </Modal>
    );
  }

  if (senders.length === 0) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="No Senders Available">
        <div className="p-8 text-center">
          <p className="text-gray-600 mb-4">
            You need to add at least one sender before composing emails.
          </p>
          <Button onClick={handleClose}>Close</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Compose New Email Campaign"
      size="lg"
    >
      <div className="p-6">
        {/* Progress Steps */}
        <div className="mb-6 flex justify-between">
          <div className={`flex-1 text-center ${step === 'compose' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
            1. Compose
          </div>
          <div className={`flex-1 text-center ${step === 'recipients' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
            2. Recipients
          </div>
          <div className={`flex-1 text-center ${step === 'schedule' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
            3. Schedule
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600 font-medium">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Step 1: Compose */}
        {step === 'compose' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sender Account
              </label>
              <select
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a sender...</option>
                {senders.map((sender) => (
                  <option key={sender.id} value={sender.id}>
                    {sender.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message Body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Enter your email message..."
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep('recipients')}
                disabled={!senderId || !subject || !body}
              >
                Next: Recipients
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Recipients */}
        {step === 'recipients' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload Recipient List (CSV/TXT)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                Choose File
              </Button>
              <p className="mt-2 text-xs text-gray-500">
                Upload a file containing email addresses (one per line or comma-separated)
              </p>
            </div>

            {recipients.length > 0 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm font-medium text-green-800">
                  ✓ {recipients.length} valid email address{recipients.length !== 1 ? 'es' : ''} detected
                </p>
                <div className="mt-2 max-h-32 overflow-y-auto">
                  <div className="text-xs text-green-700 space-y-1">
                    {recipients.slice(0, 10).map((email, idx) => (
                      <div key={idx}>{email}</div>
                    ))}
                    {recipients.length > 10 && (
                      <div className="font-medium">
                        ... and {recipients.length - 10} more
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {invalidEmails.length > 0 && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm font-medium text-yellow-800">
                  ⚠ {invalidEmails.length} invalid {invalidEmails.length !== 1 ? 'entries' : 'entry'} skipped
                </p>
                <div className="mt-2 max-h-32 overflow-y-auto">
                  <div className="text-xs text-yellow-700 space-y-1">
                    {invalidEmails.map((entry, idx) => (
                      <div key={idx} className="font-mono">{entry}</div>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-xs text-yellow-600">
                  These entries were not recognized as valid email addresses and will be ignored.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('compose')}>
                Back
              </Button>
              <Button
                onClick={() => setStep('schedule')}
                disabled={recipients.length === 0}
              >
                Next: Schedule
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Schedule */}
        {step === 'schedule' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <Input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">
                When should the first email be sent?
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delay Between Emails (milliseconds)
              </label>
              <Input
                type="number"
                value={delayMs}
                onChange={(e) => setDelayMs(e.target.value)}
                min="1000"
                step="1000"
              />
              <p className="mt-1 text-xs text-gray-500">
                Minimum: 1000ms (1 second). Recommended: 2000-5000ms.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hourly Limit (per sender)
              </label>
              <Input
                type="number"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(e.target.value)}
                min="1"
                max="200"
              />
              <p className="mt-1 text-xs text-gray-500">
                Maximum emails per hour per sender account.
              </p>
            </div>

            {/* Summary */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm font-medium text-blue-900 mb-2">Campaign Summary</p>
              <div className="text-sm text-blue-800 space-y-1">
                <div>• {recipients.length} recipients</div>
                <div>• Subject: {subject}</div>
                <div>• Delay: {delayMs}ms between emails</div>
                <div>• Limit: {hourlyLimit} emails/hour</div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('recipients')}>
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !startAt}
              >
                {isSubmitting ? 'Scheduling...' : 'Schedule Campaign'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
