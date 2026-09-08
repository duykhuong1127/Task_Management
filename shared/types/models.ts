export type UserRole = 'ADMIN' | 'MEMBER';
export type UserStatus = 'INVITED' | 'ACTIVE' | 'DISABLED' | 'PENDING_APPROVAL';

export interface User {
  uid: string;
  email: string;
  normalizedEmail: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  password?: string;
  driveAccessStatus?: 'GRANTED' | 'DENIED' | 'NOT_PROMPTED';
  driveAccessGrantedAt?: string;
  driveAccessDeniedAt?: string;
  driveAccessToken?: string;
  driveRootFolderId?: string;
  driveRootFolderName?: string;
  canAssignTasks?: boolean;
  createdAt: string;
  activatedAt?: string;
  disabledAt?: string;
  lastLoginAt?: string;
  createdBy?: string;
  updatedAt: string;
}

export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type ProjectMemberRole = 'OWNER' | 'MEMBER';

export interface ProjectMember {
  userId: string;
  projectRole: ProjectMemberRole;
  joinedAt: string;
  addedBy: string;
}

export interface Project {
  projectId: string;
  name: string;
  description: string;
  ownerId: string;
  status: ProjectStatus;
  members?: Record<string, ProjectMember>;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  deleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type TaskStatus = 'NEW' | 'IN_PROGRESS' | 'WAITING' | 'COMPLETED' | 'OVERDUE' | 'ARCHIVED';

export type AssignmentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'WAITING' | 'SUBMITTED' | 'NEEDS_REVISION' | 'COMPLETED';

export interface TaskAssignment {
  taskId: string;
  userId: string;
  status: AssignmentStatus;
  progress: number; // 0–100
  assignedAt: string;
  startedAt?: string;
  submittedAt?: string;
  submissionNote?: string;
  revisionRequestedAt?: string;
  revisionNote?: string;
  completedAt?: string;
  updatedAt: string;
}

export interface Task {
  taskId: string;
  projectId: string;
  title: string;
  description: string;
  assignerId: string; // EXACTLY ONE ASSIGNER
  assigneeIds: string[]; // ONE OR MORE ASSIGNEES
  priority: TaskPriority;
  status: TaskStatus;
  deadline: string; // ISO 8601 Timestamp
  progressSummary: number; // 0-100 average or aggregated progress
  driveFolderId?: string;
  driveFolderUrl?: string;
  driveOwnerEmail?: string;
  driveSyncedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  archivedAt?: string;
  deleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
  chatWritableUntil?: string; // completedAt + 15 days
}

export interface ChatMessage {
  messageId: string;
  taskId: string;
  senderId: string;
  text: string;
  mentions: string[]; // User IDs mentioned
  replyToMessageId?: string;
  attachmentIds: string[];
  createdAt: string;
  editedAt?: string;
  deleted: boolean;
  deletedAt?: string;
}

export interface TaskFile {
  fileId: string;
  driveFileId?: string;
  projectId: string;
  taskId: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  driveOwnerId: string;
  driveOwnerEmail?: string;
  drivePath?: string;
  dataUrl?: string;
  createdAt: string;
  deleted: boolean;
  deletedAt?: string;
}

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_UPDATED'
  | 'TASK_COMPLETED'
  | 'TASK_DEADLINE_SOON'
  | 'TASK_OVERDUE'
  | 'NEW_MESSAGE'
  | 'USER_MENTIONED'
  | 'NEW_FILE'
  | 'PROJECT_UPDATED'
  | 'USER_REGISTERED'
  | 'ACCOUNT_STATUS'
  | 'ASSIGNMENT_SUBMITTED'
  | 'REVISION_REQUESTED'
  | 'REVISION_SUBMITTED'
  | 'ASSIGNMENT_APPROVED'
  | 'DRIVE_PERMISSION_DENIED'
  | 'DRIVE_PERMISSION_GRANTED';

export interface Notification {
  notificationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  projectId?: string;
  taskId?: string;
  read: boolean;
  createdAt: string;
  deliveryStatus?: 'DELIVERED' | 'QUEUED' | 'FAILED';
  deduplicationKey: string;
}

export type AuditAction =
  | 'USER_INVITED'
  | 'USER_ACTIVATED'
  | 'USER_DISABLED'
  | 'USER_ENABLED'
  | 'USER_APPROVED'
  | 'USER_LOGIN'
  | 'USER_REGISTERED'
  | 'USER_UPDATED'
  | 'ROLE_CHANGED'
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'PROJECT_MEMBER_ADDED'
  | 'PROJECT_MEMBER_REMOVED'
  | 'PROJECT_ARCHIVED'
  | 'PROJECT_SOFT_DELETED'
  | 'PROJECT_DELETED'
  | 'TASK_CREATED'
  | 'TASK_ASSIGNED'
  | 'TASK_UPDATED'
  | 'TASK_DEADLINE_CHANGED'
  | 'TASK_COMPLETED'
  | 'TASK_REOPENED'
  | 'TASK_SOFT_DELETED'
  | 'FILE_UPLOADED'
  | 'FILE_REMOVED'
  | 'DRIVE_CONNECTED'
  | 'DRIVE_DISCONNECTED'
  | 'DRIVE_PERMISSION_DENIED'
  | 'DRIVE_PERMISSION_GRANTED'
  | 'ASSIGNMENT_SUBMITTED'
  | 'REVISION_REQUESTED'
  | 'REVISION_SUBMITTED'
  | 'ASSIGNMENT_APPROVED'
  | 'ASSIGNMENT_REOPENED';

export interface AuditEvent {
  eventId: string;
  actorId: string;
  action: AuditAction;
  entityType: 'USER' | 'PROJECT' | 'TASK' | 'FILE' | 'DRIVE' | 'ASSIGNMENT';
  entityId: string;
  projectId?: string;
  taskId?: string;
  previousValue?: any;
  newValue?: any;
  createdAt: string;
}

export interface DeviceToken {
  tokenId: string;
  uid: string;
  token: string;
  platform: 'web' | 'android' | 'ios';
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
  enabled: boolean;
}
