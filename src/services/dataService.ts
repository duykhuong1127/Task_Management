import {
  User,
  Project,
  Task,
  TaskAssignment,
  ChatMessage,
  TaskFile,
  Notification,
  AuditEvent,
  UserRole,
  TaskPriority,
  TaskStatus,
  AssignmentStatus,
} from '@shared/types/models';
import {
  SEED_USERS,
  SEED_PROJECTS,
  SEED_TASKS,
  SEED_ASSIGNMENTS,
  SEED_MESSAGES,
  SEED_FILES,
  SEED_NOTIFICATIONS,
  SEED_AUDIT_LOGS,
} from './seedData';
import { calculateT15Retention, isChatWritable, isWithin72Hours, isOverdue, buildReminderDeduplicationKey, getVietnamCurrentDateString } from '../utils/date';

class DataService {
  private users: User[] = [];
  private projects: Project[] = [];
  private tasks: Task[] = [];
  private assignments: Record<string, TaskAssignment> = {};
  private messages: ChatMessage[] = [];
  private files: TaskFile[] = [];
  private notifications: Notification[] = [];
  private auditLogs: AuditEvent[] = [];
  private currentUserId: string | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('task_pwa_state_v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          this.users = (parsed.users || SEED_USERS).map((rawUser: User & { password?: string }) => {
            const { password: _legacyPassword, ...safeUser } = rawUser;
            return safeUser as User;
          });
          this.projects = parsed.projects || SEED_PROJECTS;
          this.tasks = parsed.tasks || SEED_TASKS;
          this.assignments = parsed.assignments || SEED_ASSIGNMENTS;
          this.messages = parsed.messages || SEED_MESSAGES;
          this.files = parsed.files || SEED_FILES;
          this.notifications = parsed.notifications || SEED_NOTIFICATIONS;
          this.auditLogs = parsed.auditLogs || SEED_AUDIT_LOGS;

          // Always ensure designated admin users (like duykhuong332@gmail.com and admin@company.com) are ACTIVE ADMINs
          for (const seedU of SEED_USERS) {
            const existing = this.users.find((u) => u.normalizedEmail === seedU.normalizedEmail);
            if (!existing) {
              this.users.unshift(JSON.parse(JSON.stringify(seedU)));
            } else {
              if (seedU.role === 'ADMIN') {
                existing.role = 'ADMIN';
                existing.status = 'ACTIVE';
              }
            }
          }
          // Ensure admin user_duykhuong is member of projects
          for (const proj of this.projects) {
            if (!proj.members['user_duykhuong']) {
              proj.members['user_duykhuong'] = {
                userId: 'user_duykhuong',
                projectRole: 'OWNER',
                joinedAt: '2026-09-01T08:00:00.000Z',
                addedBy: 'user_admin',
              };
            }
          }

          // Firebase Authentication is the only authority for the active session.
          this.currentUserId = null;
          return;
        }
      }
    } catch (e) {
      console.warn('Could not load cached state, loading seed data.', e);
    }
    this.resetToSeed();
  }

  public resetToSeed() {
    this.users = JSON.parse(JSON.stringify(SEED_USERS));
    this.projects = JSON.parse(JSON.stringify(SEED_PROJECTS));
    this.tasks = JSON.parse(JSON.stringify(SEED_TASKS));
    this.assignments = JSON.parse(JSON.stringify(SEED_ASSIGNMENTS));
    this.messages = JSON.parse(JSON.stringify(SEED_MESSAGES));
    this.files = JSON.parse(JSON.stringify(SEED_FILES));
    this.notifications = JSON.parse(JSON.stringify(SEED_NOTIFICATIONS));
    this.auditLogs = JSON.parse(JSON.stringify(SEED_AUDIT_LOGS));
    this.currentUserId = null;
    this.saveState();
    this.notify();
  }

  private saveState() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          'task_pwa_state_v1',
          JSON.stringify({
            users: this.users,
            projects: this.projects,
            tasks: this.tasks,
            assignments: this.assignments,
            messages: this.messages,
            files: this.files,
            notifications: this.notifications,
            auditLogs: this.auditLogs,
            currentUserId: null, // Ensure fresh entry always starts at login screen
          })
        );
      }
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // Current authenticated user management
  public getCurrentUser(): User {
    if (this.currentUserId) {
      const u = this.users.find((user) => user.uid === this.currentUserId);
      if (u) return u;
    }
    return (
      this.users.find((u) => u.role === 'ADMIN') ||
      this.users[0] || {
        uid: 'anonymous',
        email: 'anonymous@domain.com',
        normalizedEmail: 'anonymous@domain.com',
        displayName: 'Khách',
        role: 'MEMBER',
        status: 'DISABLED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
  }

  public getSessionUser(): User | null {
    if (!this.currentUserId) return null;
    return this.users.find((u) => u.uid === this.currentUserId) || null;
  }

  public isAuthenticated(): boolean {
    if (!this.currentUserId) return false;
    const user = this.users.find((u) => u.uid === this.currentUserId);
    return Boolean(user);
  }

  public logout(): void {
    this.currentUserId = null;
    this.saveState();
    this.notify();
  }

  public setCurrentUser(uid: string): boolean {
    const user = this.users.find((u) => u.uid === uid);
    if (!user) return false;
    this.currentUserId = uid;
    this.saveState();
    this.notify();
    return true;
  }

  /**
   * Synchronize a user only after Firebase has verified the Google account.
   * Role and status come from the trusted Firestore profile, never from an email allowlist.
   */
  public syncAuthenticatedUser(profile: {
    googleUid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    role?: UserRole;
    status?: User['status'];
    createdAt?: string;
    lastLoginAt?: string;
  }): User {
    const normalizedEmail = profile.email.trim().toLowerCase();
    let user = this.users.find(
      (candidate) => candidate.googleUid === profile.googleUid || candidate.normalizedEmail === normalizedEmail
    );
    const now = new Date().toISOString();

    if (!user) {
      user = {
        uid: profile.googleUid,
        googleUid: profile.googleUid,
        email: profile.email,
        normalizedEmail,
        displayName: profile.displayName || normalizedEmail.split('@')[0],
        photoURL: profile.photoURL,
        provider: 'google',
        role: profile.role || 'MEMBER',
        status: profile.status || 'ACTIVE',
        createdAt: profile.createdAt || now,
        lastLoginAt: profile.lastLoginAt || now,
        updatedAt: now,
      };
      this.users.push(user);
    } else {
      user.googleUid = profile.googleUid;
      user.email = profile.email;
      user.normalizedEmail = normalizedEmail;
      user.displayName = profile.displayName || user.displayName;
      user.photoURL = profile.photoURL || user.photoURL;
      user.provider = 'google';
      user.role = profile.role || user.role;
      user.status = profile.status || user.status;
      user.lastLoginAt = profile.lastLoginAt || now;
      user.updatedAt = now;
    }

    this.currentUserId = user.uid;
    this.addAuditLog('USER_LOGIN', 'USER', user.uid, undefined, {
      provider: 'google',
      googleUid: profile.googleUid,
    });
    this.saveState();
    this.notify();
    return user;
  }

  // All Users
  public getUsers(): User[] {
    return [...this.users];
  }

  public getUserById(uid: string): User | undefined {
    return this.users.find((u) => u.uid === uid);
  }

  public getUserByEmail(email: string): User | undefined {
    const normalized = email.trim().toLowerCase();
    return this.users.find(
      (u) => u.normalizedEmail.toLowerCase() === normalized || u.email.toLowerCase() === normalized
    );
  }

  public registerOrLoginUser(email: string, displayName?: string): User {
    const normalized = email.trim().toLowerCase();
    let existing = this.getUserByEmail(normalized);
    const now = new Date().toISOString();
    const isDesignatedAdmin = ['duykhuong332@gmail.com', 'admin@company.com'].includes(normalized);

    if (!existing) {
      existing = {
        uid: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        googleUid: `google_${Date.now()}`,
        email: email.trim(),
        normalizedEmail: normalized,
        displayName: displayName?.trim() || normalized.split('@')[0],
        photoURL: undefined,
        provider: 'google',
        role: isDesignatedAdmin ? 'ADMIN' : 'MEMBER',
        status: isDesignatedAdmin ? 'ACTIVE' : 'PENDING_APPROVAL',
        createdAt: now,
        lastLoginAt: now,
        updatedAt: now,
      };
      this.users.push(existing);
      this.addAuditLog('USER_REGISTERED', 'USER', existing.uid, undefined, {
        email: existing.email,
        status: existing.status,
      });
      this.saveState();
      this.notify();
    } else {
      existing.lastLoginAt = now;
      existing.updatedAt = now;
      this.saveState();
      this.notify();
    }

    this.currentUserId = existing.uid;
    return existing;
  }

  // Admin User Management
  public inviteUser(email: string, displayName: string, role: UserRole = 'MEMBER'): { success: boolean; error?: string } {
    const actor = this.getCurrentUser();
    if (actor.role !== 'ADMIN') {
      return { success: false, error: 'Chỉ Quản trị viên (ADMIN) mới có quyền mời thành viên mới.' };
    }

    const normalized = email.trim().toLowerCase();
    if (this.users.some((u) => u.normalizedEmail === normalized)) {
      return { success: false, error: 'Tài khoản Google email này đã tồn tại trong danh sách.' };
    }

    const newUser: User = {
      uid: 'user_' + Math.random().toString(36).substring(2, 9),
      email: email.trim(),
      normalizedEmail: normalized,
      displayName: displayName.trim() || normalized.split('@')[0],
      role,
      status: 'INVITED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: actor.uid,
    };

    this.users.push(newUser);
    this.addAuditLog('USER_INVITED', 'USER', newUser.uid, undefined, { email: newUser.email, role: newUser.role });
    this.saveState();
    this.notify();
    return { success: true };
  }

  public approveUserAndGrantProjects(
    userId: string,
    projectIds: string[],
    role: UserRole = 'MEMBER',
    newDisplayName?: string
  ): { success: boolean; error?: string } {
    const actor = this.getCurrentUser();
    if (actor.role !== 'ADMIN') {
      return { success: false, error: 'Chỉ Quản trị viên (ADMIN) mới có quyền phê duyệt người dùng.' };
    }
    const target = this.users.find((u) => u.uid === userId);
    if (!target) return { success: false, error: 'Không tìm thấy người dùng.' };

    const prevStatus = target.status;
    target.status = 'ACTIVE';
    target.role = role;
    if (newDisplayName && newDisplayName.trim()) {
      target.displayName = newDisplayName.trim();
    }
    target.activatedAt = target.activatedAt || new Date().toISOString();
    target.updatedAt = new Date().toISOString();

    // Grant access to selected projects
    projectIds.forEach((pId) => {
      const p = this.projects.find((proj) => proj.projectId === pId && !proj.deleted);
      if (p) {
        if (!p.members) p.members = {};
        p.members[target.uid] = {
          userId: target.uid,
          projectRole: 'MEMBER',
          joinedAt: new Date().toISOString(),
          addedBy: actor.uid,
        };
        this.addAuditLog(
          'PROJECT_MEMBER_ADDED',
          'PROJECT',
          pId,
          undefined,
          { userId: target.uid, email: target.email },
          pId
        );
      }
    });

    this.addAuditLog(
      'USER_APPROVED',
      'USER',
      target.uid,
      { status: prevStatus },
      { status: 'ACTIVE', role, projectIds }
    );

    // Send notification to user
    this.addNotification({
      userId: target.uid,
      type: 'PROJECT_UPDATED',
      title: 'Tài khoản của bạn đã được phê duyệt!',
      body: `Quản trị viên đã kích hoạt tài khoản của bạn và cấp quyền truy cập vào ${projectIds.length} dự án.`,
      deduplicationKey: `${target.uid}_APPROVED_${Date.now()}`,
    });

    this.saveState();
    this.notify();
    return { success: true };
  }

  public addMemberToProject(
    projectId: string,
    userId: string,
    role: 'OWNER' | 'MEMBER' = 'MEMBER'
  ): { success: boolean; error?: string } {
    const actor = this.getCurrentUser();
    const p = this.projects.find((proj) => proj.projectId === projectId && !proj.deleted);
    if (!p) return { success: false, error: 'Không tìm thấy dự án.' };

    if (actor.role !== 'ADMIN' && p.ownerId !== actor.uid) {
      return { success: false, error: 'Chỉ Quản trị viên hoặc Trưởng dự án mới có quyền thêm thành viên.' };
    }

    const target = this.getUserById(userId);
    if (!target) return { success: false, error: 'Không tìm thấy người dùng.' };

    if (!p.members) p.members = {};
    p.members[userId] = {
      userId,
      projectRole: role,
      joinedAt: new Date().toISOString(),
      addedBy: actor.uid,
    };

    this.addAuditLog('PROJECT_MEMBER_ADDED', 'PROJECT', projectId, undefined, { userId, role }, projectId);
    this.saveState();
    this.notify();
    return { success: true };
  }

  public removeMemberFromProject(projectId: string, userId: string): { success: boolean; error?: string } {
    const actor = this.getCurrentUser();
    const p = this.projects.find((proj) => proj.projectId === projectId && !proj.deleted);
    if (!p) return { success: false, error: 'Không tìm thấy dự án.' };

    if (actor.role !== 'ADMIN' && p.ownerId !== actor.uid) {
      return { success: false, error: 'Chỉ Quản trị viên hoặc Trưởng dự án mới có quyền xóa thành viên khỏi dự án.' };
    }

    if (p.ownerId === userId) {
      return { success: false, error: 'Không thể xóa Trưởng dự án khỏi dự án.' };
    }

    if (p.members && p.members[userId]) {
      delete p.members[userId];
      this.addAuditLog('PROJECT_MEMBER_REMOVED', 'PROJECT', projectId, undefined, { userId }, projectId);
      this.saveState();
      this.notify();
    }

    return { success: true };
  }

  public setUserStatus(uid: string, status: 'ACTIVE' | 'DISABLED'): { success: boolean; error?: string } {
    const actor = this.getCurrentUser();
    if (actor.role !== 'ADMIN') {
      return { success: false, error: 'Chỉ Quản trị viên mới có quyền thay đổi trạng thái người dùng.' };
    }
    const target = this.users.find((u) => u.uid === uid);
    if (!target) return { success: false, error: 'Không tìm thấy người dùng.' };

    const oldStatus = target.status;
    target.status = status;
    target.updatedAt = new Date().toISOString();
    if (status === 'ACTIVE') {
      target.activatedAt = target.activatedAt || new Date().toISOString();
      this.addAuditLog('USER_ACTIVATED', 'USER', uid, { status: oldStatus }, { status });
    } else {
      target.disabledAt = new Date().toISOString();
      this.addAuditLog('USER_DISABLED', 'USER', uid, { status: oldStatus }, { status });
    }

    this.saveState();
    this.notify();
    return { success: true };
  }

  public setUserRole(uid: string, newRole: UserRole): { success: boolean; error?: string } {
    const actor = this.getCurrentUser();
    if (actor.role !== 'ADMIN') {
      return { success: false, error: 'Quyền bị từ chối: Chỉ Quản trị viên mới có thể phân quyền.' };
    }
    const target = this.users.find((u) => u.uid === uid);
    if (!target) return { success: false, error: 'Không tìm thấy người dùng.' };

    const oldRole = target.role;
    target.role = newRole;
    target.updatedAt = new Date().toISOString();
    this.addAuditLog('ROLE_CHANGED', 'USER', uid, { role: oldRole }, { role: newRole });

    this.saveState();
    this.notify();
    return { success: true };
  }

  // Projects
  public getProjects(): Project[] {
    const actor = this.getCurrentUser();
    // User must be ACTIVE to see projects; otherwise pending approval / disabled returns empty
    if (actor.status !== 'ACTIVE') return [];
    // Admin sees all active non-deleted projects; Members see only projects they belong to
    return this.projects.filter((p) => {
      if (p.deleted) return false;
      if (actor.role === 'ADMIN') return true;
      // If a project has no members, or member is not in project, do not show
      if (!p.members || Object.keys(p.members).length === 0) return false;
      return Boolean(p.members[actor.uid]);
    });
  }

  public getProjectById(projectId: string): Project | undefined {
    const p = this.projects.find((proj) => proj.projectId === projectId && !proj.deleted);
    if (!p) return undefined;
    const actor = this.getCurrentUser();
    if (actor.role === 'ADMIN') return p;
    // If project has no members or user is not in the project, deny access
    if (!p.members || Object.keys(p.members).length === 0 || !p.members[actor.uid]) {
      return undefined;
    }
    return p;
  }

  public isUserInProject(projectId: string, userId: string): boolean {
    const p = this.projects.find((proj) => proj.projectId === projectId && !proj.deleted);
    if (!p) return false;
    const user = this.getUserById(userId);
    if (user?.role === 'ADMIN') return true;
    if (!p.members || Object.keys(p.members).length === 0) return false;
    return Boolean(p.members[userId]);
  }

  public createProject(name: string, description: string, memberIds: string[]): { success: boolean; project?: Project; error?: string } {
    const actor = this.getCurrentUser();
    if (actor.status !== 'ACTIVE') {
      return { success: false, error: 'Tài khoản chưa được kích hoạt.' };
    }

    const projectId = 'proj_' + Math.random().toString(36).substring(2, 9);
    const membersMap: Record<string, any> = {};

    // Creator is always OWNER
    membersMap[actor.uid] = {
      userId: actor.uid,
      projectRole: 'OWNER',
      joinedAt: new Date().toISOString(),
      addedBy: actor.uid,
    };

    memberIds.forEach((mId) => {
      if (mId !== actor.uid) {
        membersMap[mId] = {
          userId: mId,
          projectRole: 'MEMBER',
          joinedAt: new Date().toISOString(),
          addedBy: actor.uid,
        };
      }
    });

    const newProject: Project = {
      projectId,
      name: name.trim(),
      description: description.trim(),
      ownerId: actor.uid,
      status: 'ACTIVE',
      members: membersMap,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deleted: false,
    };

    this.projects.push(newProject);
    this.addAuditLog('PROJECT_CREATED', 'PROJECT', projectId, undefined, { name: newProject.name, ownerId: actor.uid }, projectId);

    this.saveState();
    this.notify();
    return { success: true, project: newProject };
  }

  public softDeleteProject(projectId: string): { success: boolean; error?: string } {
    const actor = this.getCurrentUser();
    const project = this.getProjectById(projectId);
    if (!project) return { success: false, error: 'Không tìm thấy dự án.' };

    const isOwner = project.ownerId === actor.uid;
    const isAdmin = actor.role === 'ADMIN';

    if (!isAdmin && !isOwner) {
      return { success: false, error: 'Chỉ Trưởng dự án (Owner) hoặc Quản trị viên mới có thể xóa dự án.' };
    }

    project.deleted = true;
    project.deletedAt = new Date().toISOString();
    project.deletedBy = actor.uid;

    // Soft delete all tasks under this project
    this.tasks.forEach((t) => {
      if (t.projectId === projectId && !t.deleted) {
        t.deleted = true;
        t.deletedAt = new Date().toISOString();
        t.deletedBy = actor.uid;
      }
    });

    this.addAuditLog('PROJECT_SOFT_DELETED', 'PROJECT', projectId, undefined, { deleted: true }, projectId);

    this.saveState();
    this.notify();
    return { success: true };
  }

  public deleteProject(projectId: string): { success: boolean; error?: string } {
    return this.softDeleteProject(projectId);
  }

  // Tasks
  public getTasks(): Task[] {
    const actor = this.getCurrentUser();
    // Inactive or unapproved users cannot see tasks
    if (actor.status !== 'ACTIVE') return [];
    return this.tasks.filter((t) => {
      if (t.deleted) return false;
      if (actor.role === 'ADMIN') return true;
      // Member MUST be in the project to see any tasks of that project
      return this.isUserInProject(t.projectId, actor.uid);
    });
  }

  public getTaskById(taskId: string): Task | undefined {
    const task = this.tasks.find((t) => t.taskId === taskId && !t.deleted);
    if (!task) return undefined;
    const actor = this.getCurrentUser();
    if (actor.role === 'ADMIN') return task;
    // If actor is not in the project, they cannot view or access the task
    if (!this.isUserInProject(task.projectId, actor.uid)) {
      return undefined;
    }
    return task;
  }

  public getAssignmentsForTask(taskId: string): TaskAssignment[] {
    const task = this.tasks.find((t) => t.taskId === taskId && !t.deleted);
    if (!task) return [];
    const actor = this.getCurrentUser();
    if (actor.role !== 'ADMIN' && !this.isUserInProject(task.projectId, actor.uid)) {
      return [];
    }
    return Object.values(this.assignments).filter((a) => a.taskId === taskId);
  }

  public createTask(params: {
    projectId: string;
    title: string;
    description: string;
    assigneeIds: string[];
    priority: TaskPriority;
    deadline: string;
  }): { success: boolean; task?: Task; error?: string } {
    const actor = this.getCurrentUser();
    if (actor.status !== 'ACTIVE') {
      return { success: false, error: 'Tài khoản chưa được kích hoạt để tạo công việc.' };
    }

    if (!params.title.trim()) {
      return { success: false, error: 'Vui lòng nhập tiêu đề công việc.' };
    }

    if (!params.assigneeIds || params.assigneeIds.length === 0) {
      return { success: false, error: 'Công việc phải có ít nhất 1 người nhận (Assignee).' };
    }

    if (!params.deadline) {
      return { success: false, error: 'Hạn chót (deadline) là bắt buộc.' };
    }

    if (!this.isUserInProject(params.projectId, actor.uid)) {
      return { success: false, error: 'Bạn không thuộc thành viên của dự án này.' };
    }

    for (const aId of params.assigneeIds) {
      if (!this.isUserInProject(params.projectId, aId)) {
        const u = this.getUserById(aId);
        return {
          success: false,
          error: `Người nhận việc (${u?.displayName || aId}) chưa được thêm vào thành viên dự án này.`,
        };
      }
    }

    const taskId = 'TASK-' + Math.floor(100 + Math.random() * 900);
    const nowIso = new Date().toISOString();

    const safeAssignerSlug = actor.email.replace(/[^a-zA-Z0-9]/g, '_');
    const driveFolderId = `drive_folder_${safeAssignerSlug}_${taskId.toLowerCase()}`;
    const driveFolderUrl = `https://drive.google.com/drive/folders/${driveFolderId}`;

    // Invariant: Exactly ONE assigner (the authenticated creator), 1+ assignees
    const newTask: Task = {
      taskId,
      projectId: params.projectId,
      title: params.title.trim(),
      description: params.description.trim(),
      assignerId: actor.uid, // EXACTLY ONE ASSIGNER
      assigneeIds: [...new Set(params.assigneeIds)], // ONE OR MORE ASSIGNEES
      priority: params.priority,
      status: 'IN_PROGRESS',
      deadline: params.deadline,
      progressSummary: 0,
      driveFolderId,
      driveFolderUrl,
      driveOwnerEmail: actor.email,
      driveSyncedAt: nowIso,
      createdBy: actor.uid,
      createdAt: nowIso,
      updatedAt: nowIso,
      deleted: false,
    };

    this.tasks.push(newTask);

    // Initialize individual assignments for each assignee
    newTask.assigneeIds.forEach((uid) => {
      const key = `${taskId}_${uid}`;
      this.assignments[key] = {
        taskId,
        userId: uid,
        status: 'NOT_STARTED',
        progress: 0,
        assignedAt: nowIso,
        updatedAt: nowIso,
      };

      // Notify assignee
      if (uid !== actor.uid) {
        this.addNotification({
          userId: uid,
          type: 'TASK_ASSIGNED',
          title: `Công việc mới: ${newTask.title}`,
          body: `${actor.displayName} đã giao việc cho bạn. Mức ưu tiên: ${newTask.priority}.`,
          projectId: newTask.projectId,
          taskId: newTask.taskId,
          deduplicationKey: `${uid}_${taskId}_ASSIGNED`,
        });
      }
    });

    this.addAuditLog('TASK_CREATED', 'TASK', taskId, undefined, {
      title: newTask.title,
      assignerId: newTask.assignerId,
      assigneeIds: newTask.assigneeIds,
      deadline: newTask.deadline,
    }, newTask.projectId, taskId);

    this.saveState();
    this.notify();
    return { success: true, task: newTask };
  }

  // Update Individual Assignment Progress
  public updateAssignmentProgress(taskId: string, userId: string, progress: number, status?: AssignmentStatus): { success: boolean; error?: string } {
    const actor = this.getCurrentUser();
    // Only the assignee themselves or admin or assigner can update progress
    const task = this.getTaskById(taskId);
    if (!task) return { success: false, error: 'Không tìm thấy công việc.' };

    if (actor.uid !== userId && actor.role !== 'ADMIN' && actor.uid !== task.assignerId) {
      return { success: false, error: 'Bạn chỉ có thể cập nhật tiến độ phần việc của chính mình.' };
    }

    const key = `${taskId}_${userId}`;
    let assignment = this.assignments[key];
    if (!assignment) {
      assignment = {
        taskId,
        userId,
        status: 'IN_PROGRESS',
        progress: 0,
        assignedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.assignments[key] = assignment;
    }

    const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));
    assignment.progress = clampedProgress;
    assignment.updatedAt = new Date().toISOString();

    if (status) {
      assignment.status = status;
    } else {
      if (clampedProgress === 100) {
        assignment.status = 'COMPLETED';
        assignment.completedAt = assignment.completedAt || new Date().toISOString();
      } else if (clampedProgress > 0) {
        assignment.status = 'IN_PROGRESS';
        assignment.startedAt = assignment.startedAt || new Date().toISOString();
      } else {
        assignment.status = 'NOT_STARTED';
      }
    }

    // Recalculate Task overall status & progress summary
    this.recalculateTask(taskId);

    this.saveState();
    this.notify();
    return { success: true };
  }

  // Recalculate Task overall progress and status based on multi-assignee completion rule
  public recalculateTask(taskId: string): void {
    const task = this.tasks.find((t) => t.taskId === taskId && !t.deleted);
    if (!task) return;

    const taskAssignments = this.getAssignmentsForTask(taskId);
    const totalAssignees = task.assigneeIds.length;

    if (totalAssignees === 0) {
      task.progressSummary = 0;
      return;
    }

    const completedCount = taskAssignments.filter((a) => a.status === 'COMPLETED').length;
    // Each assignee is allocated an equal percentage: 100% / totalAssignees
    task.progressSummary = Math.round((completedCount / totalAssignees) * 100);
    task.updatedAt = new Date().toISOString();

    // COMPLETION RULE: Only when ALL assignees are approved COMPLETED by the assigner does the task become COMPLETED
    const allCompleted = completedCount === totalAssignees && totalAssignees > 0;

    if (allCompleted && task.status !== 'COMPLETED') {
      task.status = 'COMPLETED';
      task.completedAt = new Date().toISOString();
      task.chatWritableUntil = calculateT15Retention(task.completedAt);

      this.addAuditLog('TASK_COMPLETED', 'TASK', taskId, { status: 'IN_PROGRESS' }, { status: 'COMPLETED', completedAt: task.completedAt }, task.projectId, taskId);

      // Notify assigner
      const actor = this.getCurrentUser();
      if (task.assignerId !== actor.uid) {
        this.addNotification({
          userId: task.assignerId,
          type: 'TASK_COMPLETED',
          title: `Công việc hoàn thành 100%: ${task.title}`,
          body: `Tất cả ${totalAssignees} người nhận việc đã được nghiệm thu và hoàn thành nhiệm vụ.`,
          projectId: task.projectId,
          taskId: task.taskId,
          deduplicationKey: `${task.assignerId}_${taskId}_ALL_COMPLETED`,
        });
      }
    } else if (!allCompleted && task.status === 'COMPLETED') {
      // Reopened or incomplete
      task.status = 'IN_PROGRESS';
      delete task.completedAt;
      delete task.chatWritableUntil;
    }
  }

  // Handover Assignment: Assignee submits their work for review
  public handoverAssignment(taskId: string, userId: string, submissionNote?: string): { success: boolean; error?: string } {
    const actor = this.getCurrentUser();
    const task = this.getTaskById(taskId);
    if (!task) return { success: false, error: 'Không tìm thấy công việc.' };

    const isAuthorized = actor.uid === userId || actor.role === 'ADMIN';
    if (!isAuthorized) {
      return { success: false, error: 'Bạn chỉ có thể bàn giao phần công việc của chính mình.' };
    }

    const key = `${taskId}_${userId}`;
    let assignment = this.assignments[key];
    if (!assignment) {
      assignment = {
        taskId,
        userId,
        status: 'IN_PROGRESS',
        progress: 0,
        assignedAt: task.createdAt,
        updatedAt: new Date().toISOString(),
      };
      this.assignments[key] = assignment;
    }

    assignment.status = 'SUBMITTED';
    assignment.submittedAt = new Date().toISOString();
    assignment.submissionNote = submissionNote?.trim() || '';
    assignment.updatedAt = new Date().toISOString();

    const user = this.getUserById(userId);
    // Notify assigner
    if (task.assignerId !== actor.uid) {
      this.addNotification({
        userId: task.assignerId,
        type: 'TASK_UPDATED',
        title: `Đã bàn giao công việc: ${task.title}`,
        body: `${user?.displayName || 'Thành viên'} đã bàn giao công việc. Vui lòng kiểm tra và nghiệm thu.${submissionNote ? ` Ghi chú: "${submissionNote}"` : ''}`,
        projectId: task.projectId,
        taskId: task.taskId,
        deduplicationKey: `${task.assignerId}_${taskId}_${userId}_HANDOVER_${Date.now()}`,
      });
    }

    this.addAuditLog('ASSIGNMENT_SUBMITTED', 'TASK', taskId, undefined, { userId, submissionNote }, task.projectId, taskId);

    this.saveState();
    this.notify();
    return { success: true };
  }

  // Request Revision: Assigner inspects work and requests changes
  public requestRevision(taskId: string, userId: string, revisionNote: string): { success: boolean; error?: string } {
    const actor = this.getCurrentUser();
    const task = this.getTaskById(taskId);
    if (!task) return { success: false, error: 'Không tìm thấy công việc.' };

    const canReview = actor.uid === task.assignerId || actor.role === 'ADMIN';
    if (!canReview) {
      return { success: false, error: 'Chỉ người giao việc hoặc Quản trị viên mới có quyền yêu cầu chỉnh sửa.' };
    }

    const key = `${taskId}_${userId}`;
    let assignment = this.assignments[key];
    if (!assignment) {
      return { success: false, error: 'Không tìm thấy thông tin phân công.' };
    }

    assignment.status = 'NEEDS_REVISION';
    assignment.revisionRequestedAt = new Date().toISOString();
    assignment.revisionNote = revisionNote.trim() || 'Vui lòng kiểm tra và chỉnh sửa lại theo yêu cầu.';
    assignment.progress = 0;
    delete assignment.completedAt;
    assignment.updatedAt = new Date().toISOString();

    // Notify assignee
    const assigner = this.getUserById(task.assignerId);
    this.addNotification({
      userId,
      type: 'TASK_UPDATED',
      title: `Yêu cầu chỉnh sửa: ${task.title}`,
      body: `${assigner?.displayName || 'Người giao việc'} đã yêu cầu bạn chỉnh sửa công việc: "${assignment.revisionNote}"`,
      projectId: task.projectId,
      taskId: task.taskId,
      deduplicationKey: `${userId}_${taskId}_REVISION_${Date.now()}`,
    });

    this.addAuditLog('REVISION_REQUESTED', 'TASK', taskId, undefined, { userId, revisionNote }, task.projectId, taskId);

    this.recalculateTask(taskId);
    this.saveState();
    this.notify();
    return { success: true };
  }

  // Submit Revision: Assignee finishes edits and hands over again for review
  public submitRevision(taskId: string, userId: string, note?: string): { success: boolean; error?: string } {
    const actor = this.getCurrentUser();
    const task = this.getTaskById(taskId);
    if (!task) return { success: false, error: 'Không tìm thấy công việc.' };

    const isAuthorized = actor.uid === userId || actor.role === 'ADMIN';
    if (!isAuthorized) {
      return { success: false, error: 'Bạn chỉ có thể xác nhận chỉnh sửa phần việc của chính mình.' };
    }

    const key = `${taskId}_${userId}`;
    let assignment = this.assignments[key];
    if (!assignment) {
      return { success: false, error: 'Không tìm thấy thông tin phân công.' };
    }

    assignment.status = 'SUBMITTED';
    assignment.submittedAt = new Date().toISOString();
    if (note?.trim()) {
      assignment.submissionNote = `[Đã chỉnh sửa]: ${note.trim()}`;
    }
    assignment.updatedAt = new Date().toISOString();

    // Notify assigner
    const user = this.getUserById(userId);
    if (task.assignerId !== actor.uid) {
      this.addNotification({
        userId: task.assignerId,
        type: 'TASK_UPDATED',
        title: `Đã chỉnh sửa xong: ${task.title}`,
        body: `${user?.displayName || 'Thành viên'} đã hoàn thành chỉnh sửa và bàn giao lại cho bạn kiểm tra.${note ? ` Ghi chú: "${note}"` : ''}`,
        projectId: task.projectId,
        taskId: task.taskId,
        deduplicationKey: `${task.assignerId}_${taskId}_${userId}_REVISED_${Date.now()}`,
      });
    }

    this.addAuditLog('REVISION_SUBMITTED', 'TASK', taskId, undefined, { userId, note }, task.projectId, taskId);

    this.saveState();
    this.notify();
    return { success: true };
  }

  // Approve Completion: ONLY assigner can confirm completion
  public approveAssignmentCompletion(taskId: string, userId: string): { success: boolean; error?: string } {
    const actor = this.getCurrentUser();
    const task = this.getTaskById(taskId);
    if (!task) return { success: false, error: 'Không tìm thấy công việc.' };

    const canReview = actor.uid === task.assignerId || actor.role === 'ADMIN';
    if (!canReview) {
      return { success: false, error: 'Chỉ người giao việc hoặc Quản trị viên mới có quyền xác nhận hoàn thành công việc.' };
    }

    const key = `${taskId}_${userId}`;
    let assignment = this.assignments[key];
    if (!assignment) {
      assignment = {
        taskId,
        userId,
        status: 'IN_PROGRESS',
        progress: 0,
        assignedAt: task.createdAt,
        updatedAt: new Date().toISOString(),
      };
      this.assignments[key] = assignment;
    }

    assignment.status = 'COMPLETED';
    assignment.progress = 100;
    assignment.completedAt = new Date().toISOString();
    assignment.updatedAt = new Date().toISOString();

    // Notify assignee
    const assigner = this.getUserById(task.assignerId);
    this.addNotification({
      userId,
      type: 'TASK_COMPLETED',
      title: `Xác nhận hoàn thành: ${task.title}`,
      body: `${assigner?.displayName || 'Người giao việc'} đã nghiệm thu và xác nhận bạn hoàn thành công việc!`,
      projectId: task.projectId,
      taskId: task.taskId,
      deduplicationKey: `${userId}_${taskId}_APPROVED_${Date.now()}`,
    });

    this.addAuditLog('ASSIGNMENT_APPROVED', 'TASK', taskId, undefined, { userId, status: 'COMPLETED' }, task.projectId, taskId);

    this.recalculateTask(taskId);
    this.saveState();
    this.notify();
    return { success: true };
  }

  // Reopen Assignment: Assigner reopens an assignment if needed
  public reopenAssignment(taskId: string, userId: string): { success: boolean; error?: string } {
    const actor = this.getCurrentUser();
    const task = this.getTaskById(taskId);
    if (!task) return { success: false, error: 'Không tìm thấy công việc.' };

    const canReview = actor.uid === task.assignerId || actor.role === 'ADMIN';
    if (!canReview) {
      return { success: false, error: 'Chỉ người giao việc hoặc Quản trị viên mới có quyền mở lại phần việc.' };
    }

    const key = `${taskId}_${userId}`;
    const assignment = this.assignments[key];
    if (assignment) {
      assignment.status = 'IN_PROGRESS';
      assignment.progress = 0;
      delete assignment.completedAt;
      assignment.updatedAt = new Date().toISOString();
    }

    this.recalculateTask(taskId);
    this.saveState();
    this.notify();
    return { success: true };
  }

  // Project Progress Stats:
  // "1 dự án có 10 người thì chia đều % cho tất cả người nhận việc và khi mọi người được người giao việc xác nhận hoàn thành thì dự án hoàn thành 100%"
  public getProjectProgressStats(projectId: string): {
    totalAssignments: number;
    completedAssignments: number;
    progressPct: number;
    totalTasks: number;
    completedTasks: number;
  } {
    const projectTasks = this.tasks.filter((t) => t.projectId === projectId && !t.deleted);
    let totalAssignments = 0;
    let completedAssignments = 0;

    projectTasks.forEach((t) => {
      totalAssignments += t.assigneeIds.length;
      const assignments = this.getAssignmentsForTask(t.taskId);
      completedAssignments += assignments.filter((a) => a.status === 'COMPLETED').length;
    });

    let progressPct = 0;
    if (totalAssignments > 0) {
      progressPct = Math.round((completedAssignments / totalAssignments) * 100);
    } else if (projectTasks.length > 0) {
      const completedTasks = projectTasks.filter((t) => t.status === 'COMPLETED').length;
      progressPct = Math.round((completedTasks / projectTasks.length) * 100);
    }

    return {
      totalAssignments,
      completedAssignments,
      progressPct,
      totalTasks: projectTasks.length,
      completedTasks: projectTasks.filter((t) => t.status === 'COMPLETED').length,
    };
  }

  // Reopen Task
  public reopenTask(taskId: string): { success: boolean; error?: string } {
    const actor = this.getCurrentUser();
    const task = this.getTaskById(taskId);
    if (!task) return { success: false, error: 'Không tìm thấy công việc.' };

    if (actor.role !== 'ADMIN' && actor.uid !== task.assignerId) {
      return { success: false, error: 'Chỉ người giao việc hoặc Quản trị viên mới có thể mở lại công việc.' };
    }

    const previousStatus = task.status;
    task.status = 'IN_PROGRESS';
    delete task.completedAt;
    delete task.chatWritableUntil; // Clears lock
    task.updatedAt = new Date().toISOString();

    this.addAuditLog('TASK_REOPENED', 'TASK', taskId, { status: previousStatus }, { status: 'IN_PROGRESS' }, task.projectId, taskId);

    this.saveState();
    this.notify();
    return { success: true };
  }

  // Soft-delete Task
  public softDeleteTask(taskId: string): { success: boolean; error?: string } {
    const actor = this.getCurrentUser();
    const task = this.getTaskById(taskId);
    if (!task) return { success: false, error: 'Không tìm thấy công việc.' };

    const project = this.getProjectById(task.projectId);
    const isOwner = project?.ownerId === actor.uid;
    const isAssigner = task.assignerId === actor.uid;
    const isAdmin = actor.role === 'ADMIN';

    if (!isAdmin && !isAssigner && !isOwner) {
      return { success: false, error: 'Chỉ người giao việc, trưởng dự án hoặc Quản trị viên mới có quyền xóa công việc.' };
    }

    task.deleted = true;
    task.deletedAt = new Date().toISOString();
    task.deletedBy = actor.uid;

    this.addAuditLog('TASK_SOFT_DELETED', 'TASK', taskId, undefined, { deleted: true }, task.projectId, taskId);

    this.saveState();
    this.notify();
    return { success: true };
  }

  public deleteTask(taskId: string): { success: boolean; error?: string } {
    return this.softDeleteTask(taskId);
  }

  // Chat Messages & T+15 Enforcement
  public getMessages(taskId: string): ChatMessage[] {
    const task = this.getTaskById(taskId);
    if (!task) return [];
    return this.messages.filter((m) => m.taskId === taskId && !m.deleted);
  }

  public postMessage(taskId: string, text: string, mentions: string[] = [], replyToMessageId?: string): { success: boolean; error?: string } {
    const actor = this.getCurrentUser();
    if (actor.status !== 'ACTIVE') {
      return { success: false, error: 'Tài khoản chưa được kích hoạt.' };
    }

    const task = this.getTaskById(taskId);
    if (!task) return { success: false, error: 'Không tìm thấy công việc.' };

    // Membership verification
    if (!this.isUserInProject(task.projectId, actor.uid)) {
      return { success: false, error: 'Quyền bị từ chối: Bạn không thuộc dự án này.' };
    }

    // T+15 Rule Enforcement:
    // When completed, chatWritableUntil = completedAt + 15 days.
    // If current time > chatWritableUntil, chat is strictly READ-ONLY!
    if (!isChatWritable(task.chatWritableUntil)) {
      return {
        success: false,
        error: 'Quy tắc T+15: Cuộc trao đổi này đã chuyển sang chế độ CHỈ ĐỌC do công việc đã hoàn thành quá 15 ngày.',
      };
    }

    const messageId = 'msg_' + Math.random().toString(36).substring(2, 9);
    const newMessage: ChatMessage = {
      messageId,
      taskId,
      senderId: actor.uid, // Untrusted client senderId prevented: always uses authenticated actor.uid
      text: text.trim(),
      mentions,
      replyToMessageId,
      attachmentIds: [],
      createdAt: new Date().toISOString(),
      deleted: false,
    };

    this.messages.push(newMessage);

    // Notify mentioned users
    mentions.forEach((mentionedUid) => {
      if (mentionedUid !== actor.uid) {
        this.addNotification({
          userId: mentionedUid,
          type: 'USER_MENTIONED',
          title: `Bạn được nhắc tới bởi ${actor.displayName}`,
          body: `${actor.displayName}: "${text.length > 60 ? text.substring(0, 57) + '...' : text}"`,
          projectId: task.projectId,
          taskId: task.taskId,
          deduplicationKey: `${mentionedUid}_${messageId}_MENTIONED`,
        });
      }
    });

    this.saveState();
    this.notify();
    return { success: true };
  }

  // Files & Google Drive Integration
  public getFiles(taskId: string): TaskFile[] {
    const task = this.getTaskById(taskId);
    if (!task) return [];
    return this.files.filter((f) => f.taskId === taskId && !f.deleted);
  }

  public uploadFile(
    taskId: string,
    name: string,
    mimeType: string,
    size: number,
    dataUrl?: string
  ): { success: boolean; file?: TaskFile; error?: string } {
    const actor = this.getCurrentUser();
    if (actor.status !== 'ACTIVE') {
      return { success: false, error: 'Tài khoản chưa được kích hoạt.' };
    }

    const task = this.getTaskById(taskId);
    if (!task) return { success: false, error: 'Không tìm thấy công việc.' };

    if (!this.isUserInProject(task.projectId, actor.uid)) {
      return { success: false, error: 'Quyền bị từ chối: Bạn không phải thành viên dự án.' };
    }

    const assigner = this.getUserById(task.assignerId);
    const project = this.getProjectById(task.projectId);
    const driveOwnerEmail = assigner?.email || '';
    const drivePath = `Google Drive (${driveOwnerEmail || 'Người giao việc'}) / Task Management App / ${project?.name || 'Project'} / ${task.taskId} / ${name.trim()}`;

    const fileId = 'file_' + Math.random().toString(36).substring(2, 9);
    const newFile: TaskFile = {
      fileId,
      driveFileId: 'drive_' + Math.random().toString(36).substring(2, 12),
      projectId: task.projectId,
      taskId,
      name: name.trim(),
      mimeType: mimeType || 'application/octet-stream',
      size,
      uploadedBy: actor.uid,
      driveOwnerId: task.assignerId, // Business requirement: stored in assigner's Google Drive space
      driveOwnerEmail,
      drivePath,
      dataUrl,
      createdAt: new Date().toISOString(),
      deleted: false,
    };

    this.files.push(newFile);

    this.addAuditLog('FILE_UPLOADED', 'FILE', fileId, undefined, {
      name: newFile.name,
      size: newFile.size,
      driveOwnerId: newFile.driveOwnerId,
      driveOwnerEmail: newFile.driveOwnerEmail,
      drivePath: newFile.drivePath,
    }, task.projectId, taskId);

    // Notify assigner about incoming file to their Google Drive storage
    if (task.assignerId !== actor.uid) {
      this.addNotification({
        userId: task.assignerId,
        type: 'NEW_FILE',
        title: `Tệp mới lưu vào Google Drive của bạn`,
        body: `${actor.displayName} đã gửi tài liệu "${name.trim()}" và lưu trữ vào Google Drive (${driveOwnerEmail}) cho công việc "${task.title}".`,
        projectId: task.projectId,
        taskId: task.taskId,
        deduplicationKey: `${task.assignerId}_${fileId}_NEWFILE`,
      });
    }

    this.saveState();
    this.notify();
    return { success: true, file: newFile };
  }

  // File Download Security Authorization
  public authorizeFileDownload(fileId: string): { authorized: boolean; file?: TaskFile; error?: string } {
    const actor = this.getCurrentUser();
    const file = this.files.find((f) => f.fileId === fileId && !f.deleted);
    if (!file) return { authorized: false, error: 'Không tìm thấy tệp đính kèm.' };

    // Security attack simulation 6: External user without project access cannot download file
    if (!this.isUserInProject(file.projectId, actor.uid)) {
      return { authorized: false, error: 'TỪ CHỐI TRUY CẬP: Bạn không có quyền tải tệp tin của dự án này.' };
    }

    return { authorized: true, file };
  }

  // Notifications
  public getNotifications(): Notification[] {
    const actor = this.getCurrentUser();
    return this.notifications.filter((n) => n.userId === actor.uid);
  }

  public getUnreadNotificationCount(): number {
    return this.getNotifications().filter((n) => !n.read).length;
  }

  public markNotificationAsRead(notificationId: string) {
    const n = this.notifications.find((notif) => notif.notificationId === notificationId);
    if (n) {
      n.read = true;
      this.saveState();
      this.notify();
    }
  }

  public markAllNotificationsAsRead() {
    const actor = this.getCurrentUser();
    this.notifications.forEach((n) => {
      if (n.userId === actor.uid) n.read = true;
    });
    this.saveState();
    this.notify();
  }

  public addNotification(params: Omit<Notification, 'notificationId' | 'createdAt' | 'read'>) {
    // Idempotency check: prevent duplicate notifications
    if (this.notifications.some((n) => n.deduplicationKey === params.deduplicationKey)) {
      return; // Already exists
    }

    const newNotif: Notification = {
      notificationId: 'notif_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
      read: false,
      ...params,
    };

    this.notifications.unshift(newNotif);
    this.saveState();
    this.notify();
  }

  // Scheduler Reminders (08:00 & 13:00) with Idempotency
  public triggerScheduledReminders(timeSlot: '0800' | '1300' = '0800'): { dispatchedCount: number; keysDispatched: string[] } {
    const localDate = getVietnamCurrentDateString();
    let dispatchedCount = 0;
    const keysDispatched: string[] = [];

    this.tasks.forEach((task) => {
      if (task.deleted || task.status === 'COMPLETED') return;

      const assignments = this.getAssignmentsForTask(task.taskId);
      const isDueSoon = isWithin72Hours(task.deadline);
      const isTaskOverdue = isOverdue(task.deadline);

      if (!isDueSoon && !isTaskOverdue) return;

      assignments.forEach((assignment) => {
        // EXCLUSION: If assignment is COMPLETED, do NOT send reminder!
        if (assignment.status === 'COMPLETED') return;

        const reminderType = isTaskOverdue ? 'OVERDUE' : 'DEADLINE';
        // Unique notification key: userId + taskId + reminderType + localDate + timeSlot
        const dedupKey = buildReminderDeduplicationKey(
          assignment.userId,
          task.taskId,
          reminderType,
          localDate,
          timeSlot
        );

        if (this.notifications.some((n) => n.deduplicationKey === dedupKey)) {
          return; // Idempotent: already sent
        }

        const title = isTaskOverdue
          ? `Quá hạn: ${task.title}`
          : `Sắp đến hạn: ${task.title} (< 72h)`;
        const body = isTaskOverdue
          ? `Công việc đã quá hạn chót. Vui lòng hoàn thành phần việc của bạn sớm nhất.`
          : `Hạn chót công việc đang đến gần. Vui lòng kiểm tra và cập nhật tiến độ.`;

        this.addNotification({
          userId: assignment.userId,
          type: isTaskOverdue ? 'TASK_OVERDUE' : 'TASK_DEADLINE_SOON',
          title,
          body,
          projectId: task.projectId,
          taskId: task.taskId,
          deduplicationKey: dedupKey,
        });

        dispatchedCount++;
        keysDispatched.push(dedupKey);
      });
    });

    return { dispatchedCount, keysDispatched };
  }

  // Audit Logs (Immutable)
  public getAuditLogs(): AuditEvent[] {
    return [...this.auditLogs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private addAuditLog(
    action: AuditEvent['action'],
    entityType: AuditEvent['entityType'],
    entityId: string,
    previousValue?: any,
    newValue?: any,
    projectId?: string,
    taskId?: string
  ) {
    const actor = this.getCurrentUser();
    const event: AuditEvent = {
      eventId: 'audit_' + Math.random().toString(36).substring(2, 9),
      actorId: actor.uid,
      action,
      entityType,
      entityId,
      projectId,
      taskId,
      previousValue,
      newValue,
      createdAt: new Date().toISOString(),
    };
    this.auditLogs.unshift(event);
  }
}

export const dataService = new DataService();
