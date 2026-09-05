import { BUSINESS_TIMEZONE } from '@shared/constants/regions';

/**
 * Format timestamp in Asia/Ho_Chi_Minh timezone
 * e.g. "07/09/2026 - 17:00"
 */
export function formatVietnamDateTime(isoStringOrDate: string | Date | undefined): string {
  if (!isoStringOrDate) return 'Chưa có hạn';
  try {
    const d = typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate;
    if (isNaN(d.getTime())) return 'Ngày không hợp lệ';

    const formatter = new Intl.DateTimeFormat('vi-VN', {
      timeZone: BUSINESS_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    // Format parts to ensure "dd/MM/yyyy - HH:mm"
    const parts = formatter.formatToParts(d);
    const day = parts.find((p) => p.type === 'day')?.value || '01';
    const month = parts.find((p) => p.type === 'month')?.value || '01';
    const year = parts.find((p) => p.type === 'year')?.value || '2026';
    const hour = parts.find((p) => p.type === 'hour')?.value || '00';
    const minute = parts.find((p) => p.type === 'minute')?.value || '00';

    return `${day}/${month}/${year} - ${hour}:${minute}`;
  } catch {
    return 'Lỗi định dạng ngày';
  }
}

/**
 * Get current date string in Asia/Ho_Chi_Minh (YYYY-MM-DD)
 */
export function getVietnamCurrentDateString(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now); // Output format: YYYY-MM-DD
}

/**
 * Check if a deadline is within 72 hours (< 72 hours) and not yet passed
 */
export function isWithin72Hours(deadlineIso: string, now: Date = new Date()): boolean {
  const deadline = new Date(deadlineIso);
  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours > 0 && diffHours <= 72;
}

/**
 * Check if a deadline is overdue (deadline < now)
 */
export function isOverdue(deadlineIso: string, now: Date = new Date()): boolean {
  const deadline = new Date(deadlineIso);
  return deadline.getTime() < now.getTime();
}

/**
 * Calculate T+15 days retention timestamp
 * chatWritableUntil = completedAt + 15 days
 */
export function calculateT15Retention(completedAtIso: string): string {
  const completedDate = new Date(completedAtIso);
  const lockDate = new Date(completedDate.getTime() + 15 * 24 * 60 * 60 * 1000);
  return lockDate.toISOString();
}

/**
 * Check if chat is still writable under T+15 rule
 * Returns true if not completed OR current time < chatWritableUntil
 */
export function isChatWritable(chatWritableUntil?: string, now: Date = new Date()): boolean {
  if (!chatWritableUntil) return true; // If not set, task is active and writable
  const lockDate = new Date(chatWritableUntil);
  return now.getTime() <= lockDate.getTime();
}

/**
 * Build a deterministic idempotency key for scheduled reminder
 * userId + taskId + reminderType + localDate + timeSlot
 * e.g. "uid123_TASK001_DEADLINE_2026-09-04_0800"
 */
export function buildReminderDeduplicationKey(
  userId: string,
  taskId: string,
  reminderType: 'DEADLINE' | 'OVERDUE',
  localDate: string,
  timeSlot: '0800' | '1300'
): string {
  return `${userId}_${taskId}_${reminderType}_${localDate}_${timeSlot}`;
}
