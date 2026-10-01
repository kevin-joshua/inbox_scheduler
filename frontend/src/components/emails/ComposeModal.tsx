'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, ApiError } from '@/lib/api';
import { parseCSVEmails } from '@/lib/utils';
import { useSenders } from '@/hooks/useSenders';

interface ComposeModalProps { isOpen: boolean; onClose: () => void; }

const field = 'h-10 rounded-lg border border-[#e2e9e5] bg-[#fbfdfc] px-3 text-sm text-[#202522] outline-none transition focus:border-[#6bcda5] focus:ring-2 focus:ring-[#dff5e9]';

export function ComposeModal({ isOpen, onClose }: ComposeModalProps) {
  const [step, setStep] = useState<'compose' | 'recipients' | 'schedule'>('compose');
  const [fromEmail, setFromEmail] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [invalidEmails, setInvalidEmails] = useState<string[]>([]);
  const [startAt, setStartAt] = useState('');
  const [delayMs, setDelayMs] = useState('1000');
  const [hourlyLimit, setHourlyLimit] = useState('100');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const minStartAt = new Date(Date.now() + 60_000).toISOString().slice(0, 16);
  const { senders, isLoading: sendersLoading } = useSenders();

  useEffect(() => {
    if (!fromEmail && senders[0]) setFromEmail(senders[0].email);
  }, [fromEmail, senders]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = parseCSVEmails((e.target?.result as string) || '');
      setRecipients(result.valid); setInvalidEmails(result.invalid);
      if (result.valid.length) setError(null);
    };
    reader.readAsText(file);
  };

  const resetForm = () => {
    setStep('compose'); setFromEmail(senders[0]?.email || ''); setToEmail(''); setSubject(''); setBody('');
    setRecipients([]); setInvalidEmails([]); setStartAt(''); setDelayMs('1000'); setHourlyLimit('100');
    setError(null); setSuccessMessage(null);
  };

  const handleClose = () => { if (!isSubmitting) { onClose(); resetForm(); } };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true); setError(null);
      if (!senders.length) {
        setError('Add a sender account before scheduling email.'); return;
      }
      if (!fromEmail.trim() || !subject.trim() || !body.trim() || !recipients.length || !startAt) {
        setError('Complete the sender, subject, message, recipients, and start time before scheduling.'); return;
      }
      if (Number.isNaN(new Date(startAt).getTime()) || new Date(startAt).getTime() <= Date.now() + 30_000) {
        setError('Choose a start time at least 30 seconds in the future.'); return;
      }
      await api.scheduleBatch({ fromEmail: fromEmail.trim(), recipients, subject, body, startAt: new Date(startAt).toISOString(), delayMs: parseInt(delayMs), hourlyLimit: parseInt(hourlyLimit) });
      setSuccessMessage(`Successfully scheduled ${recipients.length} emails.`);
      setTimeout(() => { onClose(); resetForm(); window.location.reload(); }, 1500);
    } catch (err) {
      if (err instanceof ApiError && err.data && typeof err.data === 'object' && 'details' in err.data) {
        const details = (err.data as { details?: Array<{ path?: string; message?: string }> }).details || [];
        setError(details.map((detail) => `${detail.path || 'Field'}: ${detail.message || 'invalid value'}`).join(' '));
      } else {
        setError(err instanceof Error ? err.message : 'Failed to schedule emails');
      }
    } finally { setIsSubmitting(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="" size="xl" showHeader={false}>
      <div className="overflow-hidden rounded-xl bg-white">
        <div className="flex items-center justify-between border-b border-[#e8eeeb] px-7 py-5">
          <button onClick={step === 'compose' ? handleClose : () => setStep(step === 'schedule' ? 'recipients' : 'compose')} className="flex items-center gap-2 text-sm font-medium text-[#4d5953] hover:text-[#2c9b71]">
            <span className="text-xl leading-none">←</span> {step === 'compose' ? 'Compose New Email' : step === 'recipients' ? 'Choose Recipients' : 'Schedule Email'}
          </button>
          <button onClick={handleClose} className="text-[#9aa49f] hover:text-[#202522]">✕</button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto px-7 py-6">
          {successMessage && <div className="mb-5 rounded-lg border border-[#bde7d1] bg-[#effbf5] px-4 py-3 text-sm font-medium text-[#2c9b71]">✓ {successMessage}</div>}
          {error && <div className="mb-5 rounded-lg border border-[#f2cfcb] bg-[#fff6f5] px-4 py-3 text-sm text-[#c85d56]">{error}</div>}

          {step === 'compose' && <div className="space-y-5">
            <div className="grid grid-cols-[72px_1fr_auto] items-center gap-3">
              <label className="text-xs font-medium text-[#7d8982]">From</label>
              <input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder={sendersLoading ? 'Loading sender accounts...' : 'sender@example.com'} className={`${field} w-full`} />
              <span className="text-xs text-[#9aa49f]">Sender account</span>
            </div>
            <div className="grid grid-cols-[72px_1fr_auto] items-center gap-3">
              <label className="text-xs font-medium text-[#7d8982]">To</label>
              <input className={`${field} w-full`} placeholder="recipient@example.com" value={toEmail} onChange={(e) => setToEmail(e.target.value)} />
              <button type="button" onClick={() => setStep('recipients')} className="whitespace-nowrap text-xs font-semibold text-[#31936a] hover:text-[#217d54]">Upload list</button>
            </div>
            <div className="grid grid-cols-[72px_1fr] items-center gap-3">
              <label className="text-xs font-medium text-[#7d8982]">Subject</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Enter subject" className={field} />
            </div>
            <div className="overflow-hidden rounded-lg border border-[#e2e9e5]">
              <div className="flex items-center gap-4 border-b border-[#e8eeeb] bg-[#fbfdfc] px-4 py-2 text-xs text-[#7d8982]"><button type="button" className="font-semibold text-[#202522]">B</button><button type="button" className="italic">I</button><button type="button" className="underline">U</button><span className="h-4 w-px bg-[#dfe7e2]" /><button type="button">☷</button><button type="button">↗</button><button type="button">⌁</button></div>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your email message..." rows={10} className="block w-full resize-none border-0 px-4 py-4 text-sm text-[#202522] outline-none placeholder:text-[#b0bbb5]" />
            </div>
            {!sendersLoading && !senders.length && <div className="rounded-lg border border-[#f3dfad] bg-[#fffaf0] px-4 py-3 text-xs text-[#a87518]">No sender accounts configured. <Link href="/senders" onClick={handleClose} className="font-semibold underline">Add a sender account</Link> first.</div>}
            <div className="flex items-center justify-between pt-1"><span className="text-xs text-[#9aa49f]">{body.length} characters</span><div className="flex gap-2"><Button variant="outline" onClick={handleClose}>Cancel</Button><Button onClick={() => { if (toEmail.trim()) setRecipients(toEmail.split(/[\s,;]+/).filter(Boolean)); setStep('recipients'); }} disabled={!senders.length || !fromEmail || !toEmail.trim() || !subject || !body}>Continue</Button></div></div>
          </div>}

          {step === 'recipients' && <div className="space-y-5">
            <div><p className="text-sm font-semibold text-[#202522]">Upload recipient list</p><p className="mt-1 text-xs text-[#8a948e]">Add one email per line or upload a CSV file.</p></div>
            <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex min-h-36 w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#b6e3d0] bg-[#f7fcf9] text-sm text-[#31936a] hover:bg-[#effaf4]"><span className="mb-2 text-2xl">↑</span><span className="font-semibold">Choose CSV or TXT file</span><span className="mt-1 text-xs text-[#8a948e]">or drag and drop it here</span></button>
            {recipients.length > 0 && <div className="rounded-lg border border-[#bde7d1] bg-[#effbf5] p-4 text-sm text-[#2c9b71]">✓ {recipients.length} valid recipient{recipients.length === 1 ? '' : 's'} detected</div>}
            {invalidEmails.length > 0 && <div className="rounded-lg border border-[#f3dfad] bg-[#fffaf0] p-4 text-sm text-[#a87518]">{invalidEmails.length} invalid entries skipped.</div>}
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setStep('compose')}>Back</Button><Button onClick={() => setStep('schedule')} disabled={!recipients.length}>Continue</Button></div>
          </div>}

          {step === 'schedule' && <div className="space-y-5">
            <div><p className="text-sm font-semibold text-[#202522]">Schedule delivery</p><p className="mt-1 text-xs text-[#8a948e]">Choose when the first message should be sent.</p></div>
            <label className="block text-xs font-medium text-[#7d8982]">Start time<Input type="datetime-local" min={minStartAt} value={startAt} onChange={(e) => setStartAt(e.target.value)} className={`${field} mt-2`} /></label>
            <div className="grid grid-cols-2 gap-4"><label className="text-xs font-medium text-[#7d8982]">Delay between emails<Input type="number" value={delayMs} onChange={(e) => setDelayMs(e.target.value)} min="1000" step="1000" className={`${field} mt-2`} /></label><label className="text-xs font-medium text-[#7d8982]">Hourly limit<Input type="number" value={hourlyLimit} onChange={(e) => setHourlyLimit(e.target.value)} min="1" max="200" className={`${field} mt-2`} /></label></div>
            <div className="rounded-lg bg-[#f7faf8] p-4 text-sm text-[#53605a]"><p className="font-semibold text-[#202522]">Campaign summary</p><p className="mt-2">{recipients.length} recipients · {subject || 'No subject'} · {delayMs}ms delay</p></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setStep('recipients')}>Back</Button><Button onClick={handleSubmit} disabled={isSubmitting || !startAt}>{isSubmitting ? 'Scheduling...' : 'Schedule email'}</Button></div>
          </div>}
        </div>
      </div>
    </Modal>
  );
}
