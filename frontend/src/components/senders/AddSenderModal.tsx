'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';

interface AddSenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddSenderModal({ isOpen, onClose, onSuccess }: AddSenderModalProps) {
  const [email, setEmail] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      // Validation
      if (!email.trim()) {
        setError('Email address is required');
        return;
      }
      if (!smtpHost.trim()) {
        setError('SMTP host is required');
        return;
      }
      if (!smtpPort) {
        setError('SMTP port is required');
        return;
      }
      if (!smtpUser.trim()) {
        setError('SMTP username is required');
        return;
      }
      if (!smtpPass.trim()) {
        setError('SMTP password is required');
        return;
      }

      // Create sender
      await api.createSender({
        email: email.trim(),
        smtpHost: smtpHost.trim(),
        smtpPort: parseInt(smtpPort),
        smtpUser: smtpUser.trim(),
        smtpPass: smtpPass.trim(),
      });

      // Success
      setSuccessMessage('✓ Sender account added successfully!');
      
      setTimeout(() => {
        resetForm();
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error('Failed to create sender:', err);
      setError(err instanceof Error ? err.message : 'Failed to create sender account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setSmtpHost('');
    setSmtpPort('587');
    setSmtpUser('');
    setSmtpPass('');
    setError(null);
    setSuccessMessage(null);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };

  // Preset configurations for common providers
  const presetProvider = (provider: 'gmail' | 'outlook' | 'ethereal') => {
    switch (provider) {
      case 'gmail':
        setSmtpHost('smtp.gmail.com');
        setSmtpPort('587');
        break;
      case 'outlook':
        setSmtpHost('smtp-mail.outlook.com');
        setSmtpPort('587');
        break;
      case 'ethereal':
        setSmtpHost('smtp.ethereal.email');
        setSmtpPort('587');
        break;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Sender Account"
      size="md"
    >
      <form onSubmit={handleSubmit} className="p-6">
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

        {/* Quick Presets */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quick Setup (Optional)
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => presetProvider('gmail')}
            >
              Gmail
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => presetProvider('outlook')}
            >
              Outlook
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => presetProvider('ethereal')}
            >
              Ethereal (Test)
            </Button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Click to auto-fill SMTP settings for common providers
          </p>
        </div>

        <div className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sender@example.com"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500">
              The email address that will appear as the sender
            </p>
          </div>

          {/* SMTP Host */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SMTP Host *
            </label>
            <Input
              type="text"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              placeholder="smtp.example.com"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500">
              Your SMTP server address
            </p>
          </div>

          {/* SMTP Port */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SMTP Port *
            </label>
            <Input
              type="number"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
              placeholder="587"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500">
              Common ports: 587 (TLS), 465 (SSL), 25 (unsecured)
            </p>
          </div>

          {/* SMTP Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SMTP Username *
            </label>
            <Input
              type="text"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              placeholder="username or email"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500">
              Usually your email address or account username
            </p>
          </div>

          {/* SMTP Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SMTP Password *
            </label>
            <Input
              type="password"
              value={smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
              placeholder="••••••••"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500">
              Your SMTP password or app-specific password
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Your SMTP credentials will be encrypted and stored securely. 
            We'll verify the connection before saving.
          </p>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Adding...' : 'Add Sender'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
