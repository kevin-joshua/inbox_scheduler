'use client';

import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * TODO(lld): Implement compose modal
 * - Form for single email or batch scheduling
 * - Fields: sender selection, recipients, subject, body, schedule time
 * - Call api.scheduleEmail() or api.scheduleBatch()
 * - File upload for CSV batch scheduling
 * - Form validation
 */

export function ComposeModal({ isOpen, onClose }: ComposeModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compose Email">
      <div className="space-y-4">
        <Input label="Sender" placeholder="Select sender" />
        <Input label="Recipients" placeholder="Enter email addresses" />
        <Input label="Subject" placeholder="Email subject" />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Body
          </label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={6}
            placeholder="Email body"
          />
        </div>
        <Input label="Scheduled Time" type="datetime-local" />
        <div className="flex justify-end space-x-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled>
            Schedule Email (TODO)
          </Button>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          TODO(lld): Implement form submission and API integration
        </p>
      </div>
    </Modal>
  );
}
