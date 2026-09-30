export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Future dates
  if (diffInSeconds < 0) {
    const absDiff = Math.abs(diffInSeconds);
    if (absDiff < 60) return 'in a few seconds';
    if (absDiff < 3600) return `in ${Math.floor(absDiff / 60)} minutes`;
    if (absDiff < 86400) return `in ${Math.floor(absDiff / 3600)} hours`;
    if (absDiff < 604800) return `in ${Math.floor(absDiff / 86400)} days`;
  }

  // Past dates
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;

  // Older dates - full format
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function parseCSVEmails(csvContent: string): { 
  valid: string[]; 
  invalid: string[];
} {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const validEmails = new Set<string>();
  const invalidEntries = new Set<string>();

  // Split by common delimiters
  const lines = csvContent.split(/[\n,;]/);
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if it matches email pattern
    const match = trimmed.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (match) {
      validEmails.add(match[0]);
    } else if (trimmed.length > 0) {
      // Non-empty but not a valid email
      invalidEntries.add(trimmed);
    }
  }

  return {
    valid: Array.from(validEmails),
    invalid: Array.from(invalidEntries).slice(0, 10), // Limit to first 10 invalid
  };
}

export function cn(...classes: (string | boolean | undefined)[]):string {
  return classes.filter(Boolean).join(' ');
}
