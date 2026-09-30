/**
 * CSV / plain-text parsing utilities for email extraction
 *
 * Supported input formats
 * ─────────────────────────────────────────────────────────────
 * 1. CSV with a header row containing "email" or "recipient"
 *    email,name
 *    alice@example.com,Alice
 *
 * 2. CSV with no header – every cell is treated as a potential email
 *
 * 3. Plain-text files – one address per line (whitespace trimmed)
 *
 * The parser extracts every token that looks like a valid RFC-5322
 * email address, deduplicates them (case-insensitive), and reports
 * addresses that were rejected as invalid.
 */

export interface CsvParseResult {
  emails: string[];     // Unique, valid email addresses (lowercased)
  invalid: string[];    // Tokens that failed validation
  duplicates: number;   // Count of removed duplicates
}

/**
 * Loose but practical e-mail validator.
 * Matches the vast majority of real-world addresses without the
 * full complexity of RFC 5322.
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Parse a CSV or plain-text string and extract valid email addresses.
 */
export function parseEmailCsv(csvContent: string): CsvParseResult {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { emails: [], invalid: [], duplicates: 0 };
  }

  // Detect whether the first line is a header row that names which
  // column contains the email address.
  let emailColumnIndex: number | null = null;
  let startIndex = 0;

  const firstLineCells = splitCsvLine(lines[0]);
  const headerIndex = firstLineCells.findIndex((cell) =>
    /^(email|recipient|e-mail|e_mail|mail)$/i.test(cell.trim())
  );

  if (headerIndex !== -1) {
    emailColumnIndex = headerIndex;
    startIndex = 1; // Skip header row
  }

  const seen = new Set<string>();
  const emails: string[] = [];
  const invalid: string[] = [];
  let duplicates = 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const cells = splitCsvLine(line);

    // Decide which tokens to inspect
    const candidates: string[] =
      emailColumnIndex !== null
        ? [cells[emailColumnIndex] ?? ''].filter(Boolean)
        : cells;

    for (const raw of candidates) {
      const token = raw.trim().replace(/^["']|["']$/g, ''); // Strip surrounding quotes

      if (!token) continue;

      if (!validateEmail(token)) {
        // The entire line might just be a plain email address
        if (candidates.length === 1 && !validateEmail(token)) {
          invalid.push(token);
        }
        continue;
      }

      const normalized = token.toLowerCase();

      if (seen.has(normalized)) {
        duplicates++;
        continue;
      }

      seen.add(normalized);
      emails.push(normalized);
    }
  }

  return { emails, invalid, duplicates };
}

/**
 * Split a single CSV line respecting quoted fields.
 */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped double-quote inside quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Deduplicate an array of email addresses (case-insensitive).
 * Returns { unique, duplicates } where duplicates is the count removed.
 */
export function deduplicateEmails(emails: string[]): {
  unique: string[];
  duplicates: number;
} {
  const seen = new Set<string>();
  const unique: string[] = [];
  let duplicates = 0;

  for (const email of emails) {
    const normalized = email.toLowerCase().trim();
    if (seen.has(normalized)) {
      duplicates++;
    } else {
      seen.add(normalized);
      unique.push(normalized);
    }
  }

  return { unique, duplicates };
}
