import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  Unsubscribe,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  AuditEvent,
  ChatMessage,
  Notification,
  Project,
  Task,
  TaskAssignment,
  TaskFile,
  User,
} from '@shared/types/models';
import { db, isFirebaseConfigured } from '../config/firebase';
import { dataService } from './dataService';

/**
 * Production persistence adapter.
 *
 * The existing DataService remains the synchronous business-logic/cache layer so
 * current UI and unit tests do not need a risky full rewrite. This adapter makes
 * Firestore the shared source of truth in authenticated production sessions:
 *
 *   Firestore snapshot -> DataService in-memory cache -> React UI
 *   DataService mutation -> debounced Firestore write-through
 *
 * Firestore itself provides offline queueing and conflict reconciliation.
 */
class FirestoreSyncService {
  private rootUnsubs: Unsubscribe[] = [];
  private taskUnsubs = new Map<string, Unsubscribe[]>();
  private localUnsub: (() => void) | null = null;
  private currentUser: User | null = null;
  private applyingRemote = false;
  private ready = false;
  private projectsReady = false;
  private tasksReady = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushRunning = false;
  private flushPending = false;
  private lastHashes = new Map<string, string>();

  private assignmentsByTask = new Map<string, TaskAssignment[]>();
  private messagesByTask = new Map<string, ChatMessage[]>();
  private filesByTask = new Map<string, TaskFile[]>();

  public connect(user: User): () => void {
    this.disconnect();
    this.currentUser = user;

    if (!isFirebaseConfigured || user.status !== 'ACTIVE') {
      return () => undefined;
    }

    this.subscribeUsers(user);
    this.subscribeProjects(user);
    this.subscribeTasks(user);
    this.subscribeNotifications(user);
    if (user.role === 'ADMIN') this.subscribeAuditLogs();

    // Capture local business-logic mutations and persist them after initial cloud
    // snapshots have arrived. This prevents seed/localStorage data from
    // accidentally overwriting an existing cloud workspace during startup.
    this.localUnsub = dataService.subscribe(() => {
      if (this.applyingRemote || !this.ready) return;
      this.scheduleFlush();
    });

    return () => this.disconnect();
  }

  public disconnect(): void {
    this.rootUnsubs.forEach((unsub) => unsub());
    this.rootUnsubs = [];
    this.taskUnsubs.forEach((unsubs) => unsubs.forEach((unsub) => unsub()));
    this.taskUnsubs.clear();
    this.localUnsub?.();
    this.localUnsub = null;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.currentUser = null;
    this.applyingRemote = false;
    this.ready = false;
    this.projectsReady = false;
    this.tasksReady = false;
    this.assignmentsByTask.clear();
    this.messagesByTask.clear();
    this.filesByTask.clear();
    this.lastHashes.clear();
  }

  public isConnected(): boolean {
    return Boolean(this.currentUser && this.ready && isFirebaseConfigured);
  }

  /**
   * Optional one-time migration for installations that previously stored all
   * project/task data only in localStorage.
   *
   * This is intentionally not automatic. An admin can opt in by setting
   * VITE_AUTO_MIGRATE_LOCAL_DATA=true for one deployment, then remove it after
   * the first successful sync. This avoids accidentally publishing demo seed
   * data to a production workspace.
   */
  public async migrateLegacyLocalStateIfEnabled(): Promise<boolean> {
    const user = this.currentUser;
    if (!user || user.role !== 'ADMIN') return false;
    if (import.meta.env.VITE_AUTO_MIGRATE_LOCAL_DATA !== 'true') return false;

    const internals = dataService as any;
    const projects: Project[] = Array.isArray(internals.projects) ? internals.projects : [];
    const tasks: Task[] = Array.isArray(internals.tasks) ? internals.tasks : [];
    if (projects.length === 0 && tasks.length === 0) return false;

    await this.flushSnapshot(true);
    return true;
  }

  private subscribeUsers(user: User): void {
    const usersRef = collection(db, 'users');
    const unsub = onSnapshot(
      usersRef,
      (snapshot) => {
        const users = snapshot.docs.map((snap) => this.normalizeUser(snap.data() as User, snap.id));
        this.applyRemote(() => {
          const internals = dataService as any;
          internals.users = users;
          // Keep the authenticated cache entry even during a transient directory snapshot.
          if (!internals.users.some((candidate: User) => candidate.uid === user.uid)) {
            internals.users.push(user);
          }
        });
      },
      (error) => console.error('[Realtime] users subscription failed', error)
    );
    this.rootUnsubs.push(unsub);
  }

  private subscribeProjects(user: User): void {
    const projectsRef = collection(db, 'projects');
    const source =
      user.role === 'ADMIN'
        ? projectsRef
        : query(projectsRef, where('memberIds', 'array-contains', user.uid));

    const unsub = onSnapshot(
      source,
      (snapshot) => {
        const projects = snapshot.docs.map((snap) => {
          const project = this.normalizeProject(snap.data() as any, snap.id);
          this.rememberHash(`projects/${project.projectId}`, this.projectPayload(project));
          return project;
        });

        this.applyRemote(() => {
          (dataService as any).projects = projects;
        });

        this.projectsReady = true;
        this.updateReadyState();
      },
      (error) => console.error('[Realtime] projects subscription failed', error)
    );
    this.rootUnsubs.push(unsub);
  }

  private subscribeTasks(user: User): void {
    const tasksRef = collection(db, 'tasks');
    const source =
      user.role === 'ADMIN'
        ? tasksRef
        : query(tasksRef, where('projectMemberIds', 'array-contains', user.uid));

    const unsub = onSnapshot(
      source,
      (snapshot) => {
        const tasks = snapshot.docs.map((snap) => {
          const task = this.normalizeTask(snap.data() as any, snap.id);
          this.rememberHash(`tasks/${task.taskId}`, this.taskPayload(task));
          return task;
        });

        const visibleIds = new Set(tasks.map((task) => task.taskId));
        for (const taskId of this.taskUnsubs.keys()) {
          if (!visibleIds.has(taskId)) this.removeTaskSubscriptions(taskId);
        }
        tasks.forEach((task) => this.ensureTaskSubscriptions(task));

        this.applyRemote(() => {
          (dataService as any).tasks = tasks;
        });

        this.tasksReady = true;
        this.updateReadyState();
      },
      (error) => console.error('[Realtime] tasks subscription failed', error)
    );
    this.rootUnsubs.push(unsub);
  }

  private ensureTaskSubscriptions(task: Task): void {
    if (this.taskUnsubs.has(task.taskId)) return;

    const unsubs: Unsubscribe[] = [];

    unsubs.push(
      onSnapshot(
        collection(db, 'tasks', task.taskId, 'assignments'),
        (snapshot) => {
          const rows = snapshot.docs.map((snap) => {
            const value = this.normalizeAssignment(snap.data() as any, task.taskId, snap.id);
            this.rememberHash(
              `tasks/${task.taskId}/assignments/${value.userId}`,
              this.assignmentPayload(value)
            );
            return value;
          });
          this.assignmentsByTask.set(task.taskId, rows);
          this.applyRemote(() => this.rebuildAssignmentsCache());
        },
        (error) => console.error(`[Realtime] assignments ${task.taskId} failed`, error)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'tasks', task.taskId, 'messages'),
        (snapshot) => {
          const rows = snapshot.docs.map((snap) => {
            const value = this.normalizeMessage(snap.data() as any, task.taskId, snap.id);
            this.rememberHash(
              `tasks/${task.taskId}/messages/${value.messageId}`,
              this.messagePayload(value)
            );
            return value;
          });
          this.messagesByTask.set(task.taskId, rows);
          this.applyRemote(() => this.rebuildMessagesCache());
        },
        (error) => console.error(`[Realtime] messages ${task.taskId} failed`, error)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'tasks', task.taskId, 'files'),
        (snapshot) => {
          const rows = snapshot.docs.map((snap) => {
            const value = this.normalizeFile(snap.data() as any, task, snap.id);
            this.rememberHash(`tasks/${task.taskId}/files/${value.fileId}`, this.filePayload(value));
            return value;
          });
          this.filesByTask.set(task.taskId, rows);
          this.applyRemote(() => this.rebuildFilesCache());
        },
        (error) => console.error(`[Realtime] files ${task.taskId} failed`, error)
      )
    );

    this.taskUnsubs.set(task.taskId, unsubs);
  }

  private removeTaskSubscriptions(taskId: string): void {
    this.taskUnsubs.get(taskId)?.forEach((unsub) => unsub());
    this.taskUnsubs.delete(taskId);
    this.assignmentsByTask.delete(taskId);
    this.messagesByTask.delete(taskId);
    this.filesByTask.delete(taskId);
    this.applyRemote(() => {
      this.rebuildAssignmentsCache();
      this.rebuildMessagesCache();
      this.rebuildFilesCache();
    });
  }

  private subscribeNotifications(user: User): void {
    const source = query(collection(db, 'notifications'), where('userId', '==', user.uid));
    const unsub = onSnapshot(
      source,
      (snapshot) => {
        const values = snapshot.docs
          .map((snap) => {
            const value = this.normalizeNotification(snap.data() as any, snap.id);
            this.rememberHash(`notifications/${value.notificationId}`, this.notificationPayload(value));
            return value;
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.applyRemote(() => {
          (dataService as any).notifications = values;
        });
      },
      (error) => console.error('[Realtime] notifications subscription failed', error)
    );
    this.rootUnsubs.push(unsub);
  }

  private subscribeAuditLogs(): void {
    const unsub = onSnapshot(
      collection(db, 'auditLogs'),
      (snapshot) => {
        const values = snapshot.docs.map((snap) => {
          const value = this.normalizeAuditEvent(snap.data() as any, snap.id);
          this.rememberHash(`auditLogs/${value.eventId}`, this.auditPayload(value));
          return value;
        });
        this.applyRemote(() => {
          (dataService as any).auditLogs = values;
        });
      },
      (error) => console.error('[Realtime] audit log subscription failed', error)
    );
    this.rootUnsubs.push(unsub);
  }

  private updateReadyState(): void {
    const wasReady = this.ready;
    this.ready = this.projectsReady && this.tasksReady;
    if (!wasReady && this.ready) {
      void this.migrateLegacyLocalStateIfEnabled().catch((error) =>
        console.error('[Realtime] legacy migration failed', error)
      );
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushSnapshot(false);
    }, 250);
  }

  private async flushSnapshot(force: boolean): Promise<void> {
    if (!this.currentUser || !this.ready) return;
    if (this.flushRunning) {
      this.flushPending = true;
      return;
    }

    this.flushRunning = true;
    try {
      const internals = dataService as any;
      const projects: Project[] = Array.isArray(internals.projects) ? internals.projects : [];
      const tasks: Task[] = Array.isArray(internals.tasks) ? internals.tasks : [];
      const assignments: TaskAssignment[] = Object.values(internals.assignments || {});
      const messages: ChatMessage[] = Array.isArray(internals.messages) ? internals.messages : [];
      const files: TaskFile[] = Array.isArray(internals.files) ? internals.files : [];
      const notifications: Notification[] = Array.isArray(internals.notifications) ? internals.notifications : [];
      const auditLogs: AuditEvent[] = Array.isArray(internals.auditLogs) ? internals.auditLogs : [];

      const batches: ReturnType<typeof writeBatch>[] = [];
      let batch = writeBatch(db);
      let operationCount = 0;

      const enqueue = (path: string, ref: ReturnType<typeof doc>, plainPayload: Record<string, any>, firestorePayload?: Record<string, any>) => {
        const nextHash = this.hash(plainPayload);
        if (!force && this.lastHashes.get(path) === nextHash) return;
        if (operationCount >= 400) {
          batches.push(batch);
          batch = writeBatch(db);
          operationCount = 0;
        }
        batch.set(ref, firestorePayload || plainPayload, { merge: false });
        operationCount += 1;
        this.lastHashes.set(path, nextHash);
      };

      projects.forEach((project) => {
        const payload = this.projectPayload(project);
        enqueue(`projects/${project.projectId}`, doc(db, 'projects', project.projectId), payload);
      });

      tasks.forEach((task) => {
        const payload = this.taskPayload(task);
        enqueue(
          `tasks/${task.taskId}`,
          doc(db, 'tasks', task.taskId),
          payload,
          this.taskFirestorePayload(payload)
        );
      });

      assignments.forEach((assignment) => {
        const payload = this.assignmentPayload(assignment);
        enqueue(
          `tasks/${assignment.taskId}/assignments/${assignment.userId}`,
          doc(db, 'tasks', assignment.taskId, 'assignments', assignment.userId),
          payload
        );
      });

      messages.forEach((message) => {
        const payload = this.messagePayload(message);
        enqueue(
          `tasks/${message.taskId}/messages/${message.messageId}`,
          doc(db, 'tasks', message.taskId, 'messages', message.messageId),
          payload
        );
      });

      files.forEach((file) => {
        const payload = this.filePayload(file);
        enqueue(
          `tasks/${file.taskId}/files/${file.fileId}`,
          doc(db, 'tasks', file.taskId, 'files', file.fileId),
          payload
        );
      });

      notifications.forEach((notification) => {
        const payload = this.notificationPayload(notification);
        enqueue(
          `notifications/${notification.notificationId}`,
          doc(db, 'notifications', notification.notificationId),
          payload
        );
      });

      auditLogs.forEach((event) => {
        const payload = this.auditPayload(event);
        enqueue(`auditLogs/${event.eventId}`, doc(db, 'auditLogs', event.eventId), payload);
      });

      if (operationCount > 0) batches.push(batch);
      for (const pendingBatch of batches) await pendingBatch.commit();
    } catch (error) {
      console.error('[Realtime] failed to persist local mutation to Firestore', error);
    } finally {
      this.flushRunning = false;
      if (this.flushPending) {
        this.flushPending = false;
        this.scheduleFlush();
      }
    }
  }

  private applyRemote(mutator: () => void): void {
    this.applyingRemote = true;
    try {
      mutator();
      const internals = dataService as any;
      // Keep localStorage only as a non-authoritative offline cache. Firestore is
      // the source of truth once this adapter is connected.
      if (typeof internals.saveState === 'function') internals.saveState();
      if (typeof internals.notify === 'function') internals.notify();
    } finally {
      queueMicrotask(() => {
        this.applyingRemote = false;
      });
    }
  }

  private rebuildAssignmentsCache(): void {
    const next: Record<string, TaskAssignment> = {};
    this.assignmentsByTask.forEach((rows) => {
      rows.forEach((assignment) => {
        next[`${assignment.taskId}_${assignment.userId}`] = assignment;
      });
    });
    (dataService as any).assignments = next;
  }

  private rebuildMessagesCache(): void {
    (dataService as any).messages = [...this.messagesByTask.values()]
      .flat()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  private rebuildFilesCache(): void {
    (dataService as any).files = [...this.filesByTask.values()]
      .flat()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private projectPayload(project: Project): Record<string, any> {
    const members = project.members || {};
    return {
      ...project,
      members,
      memberIds: Object.keys(members),
    };
  }

  private taskPayload(task: Task): Record<string, any> {
    const project = ((dataService as any).projects || []).find((p: Project) => p.projectId === task.projectId) as Project | undefined;
    return {
      ...task,
      projectMemberIds: Object.keys(project?.members || {}),
    };
  }

  private taskFirestorePayload(payload: Record<string, any>): Record<string, any> {
    const next = { ...payload };
    if (typeof payload.chatWritableUntil === 'string' && payload.chatWritableUntil) {
      next.chatWritableUntil = Timestamp.fromDate(new Date(payload.chatWritableUntil));
    }
    return next;
  }

  private assignmentPayload(value: TaskAssignment): Record<string, any> {
    return { ...value };
  }

  private messagePayload(value: ChatMessage): Record<string, any> {
    return { ...value };
  }

  private filePayload(value: TaskFile): Record<string, any> {
    // Never put file bytes/base64 into Firestore. Binary content belongs in
    // Firebase Storage. This also keeps documents below Firestore size limits.
    const { dataUrl: _legacyDataUrl, ...metadata } = value;
    return { ...metadata };
  }

  private notificationPayload(value: Notification): Record<string, any> {
    return { ...value, createdBy: (value as any).createdBy || this.currentUser?.uid || null };
  }

  private auditPayload(value: AuditEvent): Record<string, any> {
    return { ...value };
  }

  private normalizeProject(raw: any, id: string): Project {
    return {
      ...raw,
      projectId: raw.projectId || id,
      createdAt: this.iso(raw.createdAt),
      updatedAt: this.iso(raw.updatedAt),
      archivedAt: raw.archivedAt ? this.iso(raw.archivedAt) : undefined,
      deletedAt: raw.deletedAt ? this.iso(raw.deletedAt) : undefined,
      members: raw.members || {},
    } as Project;
  }

  private normalizeTask(raw: any, id: string): Task {
    return {
      ...raw,
      taskId: raw.taskId || id,
      deadline: this.iso(raw.deadline),
      createdAt: this.iso(raw.createdAt),
      updatedAt: this.iso(raw.updatedAt),
      completedAt: raw.completedAt ? this.iso(raw.completedAt) : undefined,
      archivedAt: raw.archivedAt ? this.iso(raw.archivedAt) : undefined,
      deletedAt: raw.deletedAt ? this.iso(raw.deletedAt) : undefined,
      chatWritableUntil: raw.chatWritableUntil ? this.iso(raw.chatWritableUntil) : undefined,
    } as Task;
  }

  private normalizeAssignment(raw: any, taskId: string, userId: string): TaskAssignment {
    const dateFields = ['assignedAt', 'startedAt', 'submittedAt', 'revisionRequestedAt', 'completedAt', 'updatedAt'];
    const value: any = { ...raw, taskId: raw.taskId || taskId, userId: raw.userId || userId };
    dateFields.forEach((field) => {
      if (value[field]) value[field] = this.iso(value[field]);
    });
    return value as TaskAssignment;
  }

  private normalizeMessage(raw: any, taskId: string, messageId: string): ChatMessage {
    return {
      ...raw,
      taskId: raw.taskId || taskId,
      messageId: raw.messageId || messageId,
      createdAt: this.iso(raw.createdAt),
      editedAt: raw.editedAt ? this.iso(raw.editedAt) : undefined,
      deletedAt: raw.deletedAt ? this.iso(raw.deletedAt) : undefined,
    } as ChatMessage;
  }

  private normalizeFile(raw: any, task: Task, fileId: string): TaskFile {
    return {
      ...raw,
      fileId: raw.fileId || fileId,
      taskId: raw.taskId || task.taskId,
      projectId: raw.projectId || task.projectId,
      createdAt: this.iso(raw.createdAt),
      deletedAt: raw.deletedAt ? this.iso(raw.deletedAt) : undefined,
    } as TaskFile;
  }

  private normalizeNotification(raw: any, id: string): Notification {
    return {
      ...raw,
      notificationId: raw.notificationId || id,
      createdAt: this.iso(raw.createdAt),
    } as Notification;
  }

  private normalizeAuditEvent(raw: any, id: string): AuditEvent {
    return {
      ...raw,
      eventId: raw.eventId || id,
      createdAt: this.iso(raw.createdAt),
    } as AuditEvent;
  }

  private normalizeUser(raw: User, id: string): User {
    return {
      ...raw,
      uid: raw.uid || id,
      createdAt: this.iso(raw.createdAt),
      updatedAt: this.iso(raw.updatedAt),
      activatedAt: raw.activatedAt ? this.iso(raw.activatedAt) : undefined,
      disabledAt: raw.disabledAt ? this.iso(raw.disabledAt) : undefined,
      lastLoginAt: raw.lastLoginAt ? this.iso(raw.lastLoginAt) : undefined,
    };
  }

  private iso(value: any): string {
    if (!value) return new Date(0).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value?.toDate === 'function') return value.toDate().toISOString();
    return new Date(value).toISOString();
  }

  private rememberHash(path: string, payload: Record<string, any>): void {
    this.lastHashes.set(path, this.hash(payload));
  }

  private hash(value: unknown): string {
    return JSON.stringify(value, Object.keys(value as any).sort());
  }
}

export const firestoreSyncService = new FirestoreSyncService();
