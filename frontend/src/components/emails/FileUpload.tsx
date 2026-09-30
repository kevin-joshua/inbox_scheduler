'use client';

/**
 * TODO(lld): Implement file upload component
 * - Drag and drop CSV file upload
 * - File validation (CSV only)
 * - Display file preview with recipient count
 * - Parse CSV and extract email addresses
 * - Integrate with batch scheduling
 */

export function FileUpload() {
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
      <p className="text-gray-500">
        TODO(lld): Drag and drop CSV file or click to browse
      </p>
      <input type="file" accept=".csv" className="hidden" />
    </div>
  );
}
