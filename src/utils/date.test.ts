import { describe, it, expect } from 'vitest';
import {
  formatVietnamDateTime,
  isWithin72Hours,
  isOverdue,
  calculateT15Retention,
  isChatWritable,
  buildReminderDeduplicationKey,
  getVietnamCurrentDateString,
} from './date';

describe('Date & Timezone Utilities (Asia/Ho_Chi_Minh & T+15)', () => {
  it('formats datetime according to Vietnamese convention dd/MM/yyyy - HH:mm', () => {
    // 2026-09-07T10:00:00.000Z is 17:00 in UTC+7 (Asia/Ho_Chi_Minh)
    const isoString = '2026-09-07T10:00:00.000Z';
    const formatted = formatVietnamDateTime(isoString);
    expect(formatted).toContain('07/09/2026');
    expect(formatted).toContain('17:00');
  });

  it('correctly determines whether a deadline is within 72 hours', () => {
    const baseTime = new Date('2026-09-04T12:00:00.000Z');
    
    // +48h: within 72h
    const within = new Date(baseTime.getTime() + 48 * 3600 * 1000).toISOString();
    expect(isWithin72Hours(within, baseTime)).toBe(true);

    // +73h: outside 72h
    const outside = new Date(baseTime.getTime() + 73 * 3600 * 1000).toISOString();
    expect(isWithin72Hours(outside, baseTime)).toBe(false);

    // Past deadline: not considered "within upcoming 72h" (it is overdue)
    const past = new Date(baseTime.getTime() - 1 * 3600 * 1000).toISOString();
    expect(isWithin72Hours(past, baseTime)).toBe(false);
  });

  it('correctly identifies overdue tasks', () => {
    const baseTime = new Date('2026-09-04T12:00:00.000Z');
    const past = new Date(baseTime.getTime() - 1000).toISOString();
    const future = new Date(baseTime.getTime() + 1000).toISOString();

    expect(isOverdue(past, baseTime)).toBe(true);
    expect(isOverdue(future, baseTime)).toBe(false);
  });

  it('computes exact T+15 days retention timestamp', () => {
    const completedAt = '2026-09-01T00:00:00.000Z';
    const t15Retention = calculateT15Retention(completedAt);
    
    const expected = new Date(new Date(completedAt).getTime() + 15 * 24 * 3600 * 1000).toISOString();
    expect(t15Retention).toBe(expected);
  });

  it('enforces T+15 chat retention: writable up to 15 days, read-only at 16 days', () => {
    const completedAt = '2026-09-01T00:00:00.000Z';
    const chatWritableUntil = calculateT15Retention(completedAt); // 2026-09-16T00:00:00.000Z

    // Day 10 after completion -> writable
    const day10 = new Date('2026-09-11T00:00:00.000Z');
    expect(isChatWritable(chatWritableUntil, day10)).toBe(true);

    // Day 15 exact boundary -> writable
    const day15 = new Date('2026-09-16T00:00:00.000Z');
    expect(isChatWritable(chatWritableUntil, day15)).toBe(true);

    // Day 16 -> READ ONLY
    const day16 = new Date('2026-09-17T00:00:00.000Z');
    expect(isChatWritable(chatWritableUntil, day16)).toBe(false);
  });

  it('generates unique deterministic reminder deduplication key', () => {
    const key = buildReminderDeduplicationKey('uid123', 'TASK001', 'DEADLINE', '2026-09-04', '0800');
    expect(key).toBe('uid123_TASK001_DEADLINE_2026-09-04_0800');
  });
});
