import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Normalizes a student ID to prevent duplicates from formatting differences
 * Handles: case sensitivity, whitespace, underscores (preserves hyphens, dots, @ for emails)
 */
export function normalizeStudentId(studentId: string): string {
  if (!studentId) return '';
  
  return studentId
    .toLowerCase()                    // Convert to lowercase
    .trim()                          // Remove leading/trailing whitespace
    .replace(/\s+/g, '')             // Remove all whitespace
    .replace(/_/g, '')               // Remove underscores (but keep hyphens, dots, @)
    .replace(/[^a-z0-9\-\.@]/g, ''); // Keep alphanumeric, hyphens, dots, and @ signs
}

/**
 * Formats a student ID for display purposes (preserves original casing/format)
 * while still being searchable via normalized version
 */
export function formatStudentIdForDisplay(studentId: string): string {
  if (!studentId) return '';
  return studentId.trim().toUpperCase(); // Just clean whitespace and uppercase for consistency
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function calculateGrade(points: number, maxPoints: number): number {
  if (maxPoints === 0) return 0;
  return Math.round((points / maxPoints) * 100);
}

export function parseMarkdown(markdown: string): string {
  return markdown
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gims, '<ul>$1</ul>')
    .replace(/\n/gim, '<br/>');
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}