import { User, Project, Task, TaskAssignment, ChatMessage, TaskFile, Notification, AuditEvent } from '@shared/types/models';
import { REGION_PREFLIGHT_VERIFIED, BUSINESS_TIMEZONE } from '@shared/constants/regions';
import { calculateT15Retention, isWithin72Hours, isOverdue, buildReminderDeduplicationKey, getVietnamCurrentDateString } from '../utils/date';

// Seed initial users matching Acceptance Criteria
export const SEED_USERS: User[] = [
  {
    uid: 'user_duykhuong',
    email: 'duykhuong332@gmail.com',
    normalizedEmail: 'duykhuong332@gmail.com',
    displayName: 'Duy Khương (Admin)',
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'ADMIN',
    status: 'ACTIVE',
    password: '123456',
    createdAt: '2026-09-01T08:00:00.000Z',
    activatedAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
  },
  {
    uid: 'user_admin',
    email: 'admin@company.com',
    normalizedEmail: 'admin@company.com',
    displayName: 'Quản Trị Viên (Admin)',
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'ADMIN',
    status: 'ACTIVE',
    password: '123456',
    createdAt: '2026-09-01T08:00:00.000Z',
    activatedAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
  },
  {
    uid: 'user_a',
    email: 'a@gmail.com',
    normalizedEmail: 'a@gmail.com',
    displayName: 'Nguyễn Văn A (Lead)',
    photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    role: 'MEMBER',
    status: 'ACTIVE',
    password: '123456',
    createdAt: '2026-09-02T08:00:00.000Z',
    activatedAt: '2026-09-02T08:30:00.000Z',
    updatedAt: '2026-09-02T08:30:00.000Z',
  },
  {
    uid: 'user_b',
    email: 'b@gmail.com',
    normalizedEmail: 'b@gmail.com',
    displayName: 'Trần Thị B',
    photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    role: 'MEMBER',
    status: 'ACTIVE',
    password: '123456',
    createdAt: '2026-09-02T08:00:00.000Z',
    activatedAt: '2026-09-02T08:35:00.000Z',
    updatedAt: '2026-09-02T08:35:00.000Z',
  },
  {
    uid: 'user_c',
    email: 'c@gmail.com',
    normalizedEmail: 'c@gmail.com',
    displayName: 'Lê Văn C',
    photoURL: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    role: 'MEMBER',
    status: 'ACTIVE',
    password: '123456',
    createdAt: '2026-09-02T08:00:00.000Z',
    activatedAt: '2026-09-02T08:40:00.000Z',
    updatedAt: '2026-09-02T08:40:00.000Z',
  },
  {
    uid: 'user_d',
    email: 'd@gmail.com',
    normalizedEmail: 'd@gmail.com',
    displayName: 'Phạm Thị D',
    photoURL: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
    role: 'MEMBER',
    status: 'ACTIVE',
    password: '123456',
    createdAt: '2026-09-02T08:00:00.000Z',
    activatedAt: '2026-09-02T08:45:00.000Z',
    updatedAt: '2026-09-02T08:45:00.000Z',
  },
  {
    uid: 'user_e',
    email: 'e_external@gmail.com',
    normalizedEmail: 'e_external@gmail.com',
    displayName: 'Người Dùng Ngoài E (Chưa cấp quyền)',
    photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    role: 'MEMBER',
    status: 'INVITED',
    password: '123456',
    createdAt: '2026-09-03T08:00:00.000Z',
    updatedAt: '2026-09-03T08:00:00.000Z',
  }
];

export const SEED_PROJECTS: Project[] = [
  {
    projectId: 'proj_alpha',
    name: 'Dự Án Alpha (Core System)',
    description: 'Hệ thống cốt lõi và kiến trúc phân tán phục vụ 15-20 nhân sự, khu vực asia-southeast1.',
    ownerId: 'user_a',
    status: 'ACTIVE',
    members: {
      user_duykhuong: { userId: 'user_duykhuong', projectRole: 'OWNER', joinedAt: '2026-09-01T08:00:00.000Z', addedBy: 'user_admin' },
      user_admin: { userId: 'user_admin', projectRole: 'OWNER', joinedAt: '2026-09-01T08:00:00.000Z', addedBy: 'user_admin' },
      user_a: { userId: 'user_a', projectRole: 'OWNER', joinedAt: '2026-09-02T08:00:00.000Z', addedBy: 'user_admin' },
      user_b: { userId: 'user_b', projectRole: 'MEMBER', joinedAt: '2026-09-02T08:00:00.000Z', addedBy: 'user_a' },
      user_c: { userId: 'user_c', projectRole: 'MEMBER', joinedAt: '2026-09-02T08:00:00.000Z', addedBy: 'user_a' },
      user_d: { userId: 'user_d', projectRole: 'MEMBER', joinedAt: '2026-09-02T08:00:00.000Z', addedBy: 'user_a' },
    },
    createdAt: '2026-09-02T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z',
    deleted: false,
  },
  {
    projectId: 'proj_beta',
    name: 'Dự Án Beta (Mobile App Client)',
    description: 'Ứng dụng PWA Mobile-First với thông báo đẩy thời gian thực.',
    ownerId: 'user_admin',
    status: 'ACTIVE',
    members: {
      user_duykhuong: { userId: 'user_duykhuong', projectRole: 'OWNER', joinedAt: '2026-09-01T08:00:00.000Z', addedBy: 'user_admin' },
      user_admin: { userId: 'user_admin', projectRole: 'OWNER', joinedAt: '2026-09-01T08:00:00.000Z', addedBy: 'user_admin' },
      user_a: { userId: 'user_a', projectRole: 'MEMBER', joinedAt: '2026-09-02T08:00:00.000Z', addedBy: 'user_admin' },
      user_b: { userId: 'user_b', projectRole: 'MEMBER', joinedAt: '2026-09-02T08:00:00.000Z', addedBy: 'user_admin' },
    },
    createdAt: '2026-09-02T09:00:00.000Z',
    updatedAt: '2026-09-02T09:00:00.000Z',
    deleted: false,
  }
];

// Calculate deadlines relative to current runtime:
// Task 1: within 72h (e.g. +48h)
// Task 2: tomorrow (+20h)
// Task 3: overdue (-24h)
const nowMs = Date.now();
const deadlineWithin72h = new Date(nowMs + 48 * 3600 * 1000).toISOString();
const deadlineTomorrow = new Date(nowMs + 20 * 3600 * 1000).toISOString();
const deadlineOverdue = new Date(nowMs - 24 * 3600 * 1000).toISOString();

export const SEED_TASKS: Task[] = [
  {
    taskId: 'TASK-001',
    projectId: 'proj_alpha',
    title: 'Báo cáo tiến độ tháng',
    description: 'Tổng hợp tiến độ triển khai giai đoạn 1, tích hợp Google Drive và báo cáo tài chính khu vực Singapore.',
    assignerId: 'user_a', // Exactly one assigner A
    assigneeIds: ['user_b', 'user_c', 'user_d'], // Multi-assignees B, C, D
    priority: 'URGENT',
    status: 'IN_PROGRESS',
    deadline: deadlineWithin72h,
    progressSummary: 13,
    createdBy: 'user_a',
    createdAt: new Date(nowMs - 5 * 3600 * 1000).toISOString(),
    updatedAt: new Date(nowMs - 1 * 3600 * 1000).toISOString(),
    deleted: false,
  },
  {
    taskId: 'TASK-002',
    projectId: 'proj_alpha',
    title: 'Kiểm toán bảo mật Firestore & RBAC',
    description: 'Rà soát toàn bộ Firestore Security Rules và đảm bảo các thành viên chỉ đọc ghi trong phạm vi dự án.',
    assignerId: 'user_b', // B -> A
    assigneeIds: ['user_a'],
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    deadline: deadlineTomorrow,
    progressSummary: 50,
    createdBy: 'user_b',
    createdAt: new Date(nowMs - 12 * 3600 * 1000).toISOString(),
    updatedAt: new Date(nowMs - 2 * 3600 * 1000).toISOString(),
    deleted: false,
  },
  {
    taskId: 'TASK-003',
    projectId: 'proj_alpha',
    title: 'Cấu hình Cloud Scheduler 08:00 & 13:00',
    description: 'Xác thực cron job thông báo định kỳ theo múi giờ Asia/Ho_Chi_Minh và kiểm tra chống trùng lặp.',
    assignerId: 'user_c', // C -> D
    assigneeIds: ['user_d'],
    priority: 'NORMAL',
    status: 'OVERDUE',
    deadline: deadlineOverdue,
    progressSummary: 0,
    createdBy: 'user_c',
    createdAt: new Date(nowMs - 48 * 3600 * 1000).toISOString(),
    updatedAt: new Date(nowMs - 24 * 3600 * 1000).toISOString(),
    deleted: false,
  }
];

export const SEED_ASSIGNMENTS: Record<string, TaskAssignment> = {
  'TASK-001_user_b': {
    taskId: 'TASK-001',
    userId: 'user_b',
    status: 'IN_PROGRESS',
    progress: 40,
    assignedAt: new Date(nowMs - 5 * 3600 * 1000).toISOString(),
    updatedAt: new Date(nowMs - 1 * 3600 * 1000).toISOString(),
  },
  'TASK-001_user_c': {
    taskId: 'TASK-001',
    userId: 'user_c',
    status: 'NOT_STARTED',
    progress: 0,
    assignedAt: new Date(nowMs - 5 * 3600 * 1000).toISOString(),
    updatedAt: new Date(nowMs - 5 * 3600 * 1000).toISOString(),
  },
  'TASK-001_user_d': {
    taskId: 'TASK-001',
    userId: 'user_d',
    status: 'NOT_STARTED',
    progress: 0,
    assignedAt: new Date(nowMs - 5 * 3600 * 1000).toISOString(),
    updatedAt: new Date(nowMs - 5 * 3600 * 1000).toISOString(),
  },
  'TASK-002_user_a': {
    taskId: 'TASK-002',
    userId: 'user_a',
    status: 'IN_PROGRESS',
    progress: 50,
    assignedAt: new Date(nowMs - 12 * 3600 * 1000).toISOString(),
    updatedAt: new Date(nowMs - 2 * 3600 * 1000).toISOString(),
  },
  'TASK-003_user_d': {
    taskId: 'TASK-003',
    userId: 'user_d',
    status: 'NOT_STARTED',
    progress: 0,
    assignedAt: new Date(nowMs - 48 * 3600 * 1000).toISOString(),
    updatedAt: new Date(nowMs - 48 * 3600 * 1000).toISOString(),
  }
};

export const SEED_MESSAGES: ChatMessage[] = [
  {
    messageId: 'msg_001',
    taskId: 'TASK-001',
    senderId: 'user_a',
    text: 'Chào @Trần Thị B và @Lê Văn C, vui lòng cập nhật tiến độ trước 17:00 ngày mai nhé.',
    mentions: ['user_b', 'user_c'],
    attachmentIds: [],
    createdAt: new Date(nowMs - 4 * 3600 * 1000).toISOString(),
    deleted: false,
  },
  {
    messageId: 'msg_002',
    taskId: 'TASK-001',
    senderId: 'user_b',
    text: 'Tôi đã hoàn thành bản phác thảo 40% và vừa upload file tài liệu mẫu lên Google Drive.',
    mentions: [],
    attachmentIds: ['file_001'],
    createdAt: new Date(nowMs - 2 * 3600 * 1000).toISOString(),
    deleted: false,
  }
];

export const SEED_FILES: TaskFile[] = [
  {
    fileId: 'file_001',
    driveFileId: 'drive_pdf_report_8829',
    projectId: 'proj_alpha',
    taskId: 'TASK-001',
    name: 'report_tiendo_thang_v1.pdf',
    mimeType: 'application/pdf',
    size: 2457600, // 2.4 MB
    uploadedBy: 'user_b',
    driveOwnerId: 'user_a', // Stored in assigner's Drive space!
    createdAt: new Date(nowMs - 2 * 3600 * 1000).toISOString(),
    deleted: false,
  }
];

export const SEED_NOTIFICATIONS: Notification[] = [
  {
    notificationId: 'notif_001',
    userId: 'user_b',
    type: 'TASK_ASSIGNED',
    title: 'Công việc mới: Báo cáo tiến độ tháng',
    body: 'Nguyễn Văn A đã giao công việc cho bạn. Hạn chót: 72 giờ tới.',
    projectId: 'proj_alpha',
    taskId: 'TASK-001',
    read: false,
    createdAt: new Date(nowMs - 5 * 3600 * 1000).toISOString(),
    deduplicationKey: 'user_b_TASK-001_ASSIGNED',
  },
  {
    notificationId: 'notif_002',
    userId: 'user_b',
    type: 'USER_MENTIONED',
    title: 'Bạn được nhắc tới trong thảo luận',
    body: 'Nguyễn Văn A nhắc tới bạn trong công việc: Báo cáo tiến độ tháng',
    projectId: 'proj_alpha',
    taskId: 'TASK-001',
    read: true,
    createdAt: new Date(nowMs - 4 * 3600 * 1000).toISOString(),
    deduplicationKey: 'user_b_msg_001_MENTIONED',
  }
];

export const SEED_AUDIT_LOGS: AuditEvent[] = [
  {
    eventId: 'audit_001',
    actorId: 'user_admin',
    action: 'PROJECT_CREATED',
    entityType: 'PROJECT',
    entityId: 'proj_alpha',
    projectId: 'proj_alpha',
    newValue: { name: 'Dự Án Alpha (Core System)' },
    createdAt: '2026-09-02T08:00:00.000Z',
  },
  {
    eventId: 'audit_002',
    actorId: 'user_a',
    action: 'TASK_CREATED',
    entityType: 'TASK',
    entityId: 'TASK-001',
    projectId: 'proj_alpha',
    taskId: 'TASK-001',
    newValue: { title: 'Báo cáo tiến độ tháng', assignerId: 'user_a', assigneeIds: ['user_b', 'user_c', 'user_d'] },
    createdAt: new Date(nowMs - 5 * 3600 * 1000).toISOString(),
  },
  {
    eventId: 'audit_003',
    actorId: 'user_b',
    action: 'FILE_UPLOADED',
    entityType: 'FILE',
    entityId: 'file_001',
    projectId: 'proj_alpha',
    taskId: 'TASK-001',
    newValue: { name: 'report_tiendo_thang_v1.pdf', driveOwnerId: 'user_a' },
    createdAt: new Date(nowMs - 2 * 3600 * 1000).toISOString(),
  }
];
