import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  Unsubscribe,
  where,
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

type LegacySnapshot = {
  users: User[];
  projects: Project[];
  tasks: Task[];
  assignments: TaskAssignment[];
  messages: ChatMessage[];
  files: TaskFile[];
  notifications: Notification[];
  auditLogs: AuditEvent[];
};

type PendingWrite = {
  path: string;
  hash: string;
  promise: Promise<void>;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined).map((item) => stripUndefined(item)) as T;
  }

  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    // Preserve Firestore Timestamp/Date and other SDK value objects.
    if (prototype !== Object.prototype && prototype !== null) return value;

    const clean = Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefined(item)])
    );
    return clean as T;
  }

  return value;
}

function isRetryableWriteError(reason: unknown): boolean {
  const code = String((reason as { code?: string } | null)?.code || '').replace('firestore/', '');
  return new Set([
    'aborted',
    'cancelled',
    'deadline-exceeded',
    'internal',
    'resource-exhausted',
    'unavailable',
    'unknown',
  ]).has(code);
}

function iso(value: any): string {
  if (!value) return new Date(0).toISOString();
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  return new Date(value).toISOString();
}

class ProductionSyncService {
  private user: User | null = null;
  private rootUnsubs: Unsubscribe[] = [];
  private taskUnsubs = new Map<string, Unsubscribe[]>();
  private localUnsub: (() => void) | null = null;
  private applyingRemote = false;
  private readyProjects = false;
  private readyTasks = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushInFlight = false;
  private flushAgain = false;
  private hashes = new Map<string, string>();
  private legacy: LegacySnapshot | null = null;
  private initialCloudProjects = -1;
  private initialCloudTasks = -1;

  private assignmentsByTask = new Map<string, TaskAssignment[]>();
  private messagesByTask = new Map<string, ChatMessage[]>();
  private filesByTask = new Map<string, TaskFile[]>();

  public connect(user: User): () => void {
    this.disconnect();
    this.user = user;
    if (!isFirebaseConfigured || user.status !== 'ACTIVE') return () => undefined;

    this.legacy = this.captureLocalState();
    this.subscribeUsers();
    this.subscribeProjects();
    this.subscribeTasks();
    this.subscribeNotifications();
    if (user.role === 'ADMIN') this.subscribeAuditLogs();

    this.localUnsub = dataService.subscribe(() => {
      if (this.applyingRemote || !this.isReady()) return;
      this.scheduleFlush();
    });

    return () => this.disconnect();
  }

  public disconnect(): void {
    this.rootUnsubs.forEach((unsub) => unsub());
    this.rootUnsubs = [];
    this.taskUnsubs.forEach((rows) => rows.forEach((unsub) => unsub()));
    this.taskUnsubs.clear();
    this.localUnsub?.();
    this.localUnsub = null;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.user = null;
    this.applyingRemote = false;
    this.readyProjects = false;
    this.readyTasks = false;
    this.flushInFlight = false;
    this.flushAgain = false;
    this.hashes.clear();
    this.assignmentsByTask.clear();
    this.messagesByTask.clear();
    this.filesByTask.clear();
    this.legacy = null;
    this.initialCloudProjects = -1;
    this.initialCloudTasks = -1;
  }

  public isReady(): boolean {
    return Boolean(this.user && this.readyProjects && this.readyTasks);
  }

  private captureLocalState(): LegacySnapshot {
    const internals = dataService as any;
    return {
      users: clone(internals.users || []),
      projects: clone(internals.projects || []),
      tasks: clone(internals.tasks || []),
      assignments: clone(Object.values(internals.assignments || {})),
      messages: clone(internals.messages || []),
      files: clone(internals.files || []),
      notifications: clone(internals.notifications || []),
      auditLogs: clone(internals.auditLogs || []),
    };
  }

  private subscribeUsers(): void {
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const rows = snapshot.docs.map((snap) => {
          const raw = snap.data() as any;
          const value: User = {
            ...raw,
            uid: raw.uid || snap.id,
            createdAt: iso(raw.createdAt),
            updatedAt: iso(raw.updatedAt),
            activatedAt: raw.activatedAt ? iso(raw.activatedAt) : undefined,
            disabledAt: raw.disabledAt ? iso(raw.disabledAt) : undefined,
            lastLoginAt: raw.lastLoginAt ? iso(raw.lastLoginAt) : undefined,
          };
          this.remember(`users/${value.uid}`, value);
          return value;
        });
        this.applyRemote(() => {
          const internals = dataService as any;
          internals.users = rows;
          if (this.user && !rows.some((row) => row.uid === this.user!.uid)) internals.users.push(this.user);
        });
      },
      (error) => console.error('[ProductionSync] users', error)
    );
    this.rootUnsubs.push(unsub);
  }

  private subscribeProjects(): void {
    const ref = collection(db, 'projects');
    const source = this.user?.role === 'ADMIN' ? ref : query(ref, where('memberIds', 'array-contains', this.user!.uid));
    const unsub = onSnapshot(
      source,
      (snapshot) => {
        if (this.initialCloudProjects < 0) this.initialCloudProjects = snapshot.size;
        const rows = snapshot.docs.map((snap) => {
          const raw = snap.data() as any;
          const value: Project = {
            ...raw,
            projectId: raw.projectId || snap.id,
            members: raw.members || {},
            memberIds: raw.memberIds || Object.keys(raw.members || {}),
            createdAt: iso(raw.createdAt),
            updatedAt: iso(raw.updatedAt),
            archivedAt: raw.archivedAt ? iso(raw.archivedAt) : undefined,
            deletedAt: raw.deletedAt ? iso(raw.deletedAt) : undefined,
          };
          this.remember(`projects/${value.projectId}`, this.projectPayload(value));
          return value;
        });
        this.applyRemote(() => ((dataService as any).projects = rows));
        this.readyProjects = true;
        void this.maybeMigrateLegacy();
      },
      (error) => console.error('[ProductionSync] projects', error)
    );
    this.rootUnsubs.push(unsub);
  }

  private subscribeTasks(): void {
    const ref = collection(db, 'tasks');
    const source = this.user?.role === 'ADMIN' ? ref : query(ref, where('projectMemberIds', 'array-contains', this.user!.uid));
    const unsub = onSnapshot(
      source,
      (snapshot) => {
        if (this.initialCloudTasks < 0) this.initialCloudTasks = snapshot.size;
        const rows = snapshot.docs.map((snap) => {
          const raw = snap.data() as any;
          const value: Task = {
            ...raw,
            taskId: raw.taskId || snap.id,
            deadline: iso(raw.deadline),
            createdAt: iso(raw.createdAt),
            updatedAt: iso(raw.updatedAt),
            completedAt: raw.completedAt ? iso(raw.completedAt) : undefined,
            archivedAt: raw.archivedAt ? iso(raw.archivedAt) : undefined,
            deletedAt: raw.deletedAt ? iso(raw.deletedAt) : undefined,
            chatWritableUntil: raw.chatWritableUntil ? iso(raw.chatWritableUntil) : undefined,
          };
          this.remember(`tasks/${value.taskId}`, this.taskPayload(value));
          return value;
        });

        const visible = new Set(rows.map((task) => task.taskId));
        for (const taskId of this.taskUnsubs.keys()) {
          if (!visible.has(taskId)) this.removeTaskSubscriptions(taskId);
        }
        rows.forEach((task) => this.ensureTaskSubscriptions(task));
        this.applyRemote(() => ((dataService as any).tasks = rows));
        this.readyTasks = true;
        void this.maybeMigrateLegacy();
      },
      (error) => console.error('[ProductionSync] tasks', error)
    );
    this.rootUnsubs.push(unsub);
  }

  private subscribeNotifications(): void {
    const source = query(collection(db, 'notifications'), where('userId', '==', this.user!.uid));
    const unsub = onSnapshot(
      source,
      (snapshot) => {
        const rows = snapshot.docs.map((snap) => {
          const raw = snap.data() as any;
          const value: Notification = { ...raw, notificationId: raw.notificationId || snap.id, createdAt: iso(raw.createdAt) };
          this.remember(`notifications/${value.notificationId}`, value);
          return value;
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.applyRemote(() => ((dataService as any).notifications = rows));
      },
      (error) => console.error('[ProductionSync] notifications', error)
    );
    this.rootUnsubs.push(unsub);
  }

  private subscribeAuditLogs(): void {
    const unsub = onSnapshot(
      collection(db, 'auditLogs'),
      (snapshot) => {
        const rows = snapshot.docs.map((snap) => {
          const raw = snap.data() as any;
          const value: AuditEvent = { ...raw, eventId: raw.eventId || snap.id, createdAt: iso(raw.createdAt) };
          this.remember(`auditLogs/${value.eventId}`, value);
          return value;
        });
        this.applyRemote(() => ((dataService as any).auditLogs = rows));
      },
      (error) => console.error('[ProductionSync] auditLogs', error)
    );
    this.rootUnsubs.push(unsub);
  }

  private ensureTaskSubscriptions(task: Task): void {
    if (this.taskUnsubs.has(task.taskId)) return;
    const unsubs: Unsubscribe[] = [];

    unsubs.push(onSnapshot(collection(db, 'tasks', task.taskId, 'assignments'), (snapshot) => {
      const rows = snapshot.docs.map((snap) => {
        const raw = snap.data() as any;
        const value: TaskAssignment = {
          ...raw,
          taskId: raw.taskId || task.taskId,
          userId: raw.userId || snap.id,
          assignedAt: iso(raw.assignedAt),
          updatedAt: iso(raw.updatedAt),
          startedAt: raw.startedAt ? iso(raw.startedAt) : undefined,
          submittedAt: raw.submittedAt ? iso(raw.submittedAt) : undefined,
          revisionRequestedAt: raw.revisionRequestedAt ? iso(raw.revisionRequestedAt) : undefined,
          completedAt: raw.completedAt ? iso(raw.completedAt) : undefined,
        };
        this.remember(`tasks/${task.taskId}/assignments/${value.userId}`, value);
        return value;
      });
      this.assignmentsByTask.set(task.taskId, rows);
      this.applyRemote(() => this.rebuildAssignments());
    }, (error) => console.error(`[ProductionSync] assignments/${task.taskId}`, error)));

    unsubs.push(onSnapshot(collection(db, 'tasks', task.taskId, 'messages'), (snapshot) => {
      const rows = snapshot.docs.map((snap) => {
        const raw = snap.data() as any;
        const value: ChatMessage = {
          ...raw,
          taskId: raw.taskId || task.taskId,
          messageId: raw.messageId || snap.id,
          createdAt: iso(raw.createdAt),
          editedAt: raw.editedAt ? iso(raw.editedAt) : undefined,
          deletedAt: raw.deletedAt ? iso(raw.deletedAt) : undefined,
        };
        this.remember(`tasks/${task.taskId}/messages/${value.messageId}`, value);
        return value;
      });
      this.messagesByTask.set(task.taskId, rows);
      this.applyRemote(() => this.rebuildMessages());
    }, (error) => console.error(`[ProductionSync] messages/${task.taskId}`, error)));

    unsubs.push(onSnapshot(collection(db, 'tasks', task.taskId, 'files'), (snapshot) => {
      const rows = snapshot.docs.map((snap) => {
        const raw = snap.data() as any;
        const value: TaskFile = {
          ...raw,
          taskId: raw.taskId || task.taskId,
          projectId: raw.projectId || task.projectId,
          fileId: raw.fileId || snap.id,
          createdAt: iso(raw.createdAt),
          deletedAt: raw.deletedAt ? iso(raw.deletedAt) : undefined,
        };
        this.remember(`tasks/${task.taskId}/files/${value.fileId}`, this.filePayload(value));
        return value;
      });
      this.filesByTask.set(task.taskId, rows);
      this.applyRemote(() => this.rebuildFiles());
    }, (error) => console.error(`[ProductionSync] files/${task.taskId}`, error)));

    this.taskUnsubs.set(task.taskId, unsubs);
  }

  private removeTaskSubscriptions(taskId: string): void {
    this.taskUnsubs.get(taskId)?.forEach((unsub) => unsub());
    this.taskUnsubs.delete(taskId);
    this.assignmentsByTask.delete(taskId);
    this.messagesByTask.delete(taskId);
    this.filesByTask.delete(taskId);
    this.applyRemote(() => {
      this.rebuildAssignments();
      this.rebuildMessages();
      this.rebuildFiles();
    });
  }

  private rebuildAssignments(): void {
    const record: Record<string, TaskAssignment> = {};
    this.assignmentsByTask.forEach((rows) => rows.forEach((row) => (record[`${row.taskId}_${row.userId}`] = row)));
    (dataService as any).assignments = record;
  }

  private rebuildMessages(): void {
    (dataService as any).messages = [...this.messagesByTask.values()].flat().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  private rebuildFiles(): void {
    (dataService as any).files = [...this.filesByTask.values()].flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private applyRemote(mutator: () => void): void {
    this.applyingRemote = true;
    try {
      mutator();
      const internals = dataService as any;
      if (typeof internals.saveState === 'function') internals.saveState();
      if (typeof internals.notify === 'function') internals.notify();
    } finally {
      queueMicrotask(() => (this.applyingRemote = false));
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushCurrentState();
    }, 250);
  }

  private async flushCurrentState(): Promise<void> {
    if (!this.user || !this.isReady()) return;
    if (this.flushInFlight) {
      this.flushAgain = true;
      return;
    }
    this.flushInFlight = true;
    try {
      await this.persistSnapshot(this.captureLocalState(), false);
    } finally {
      this.flushInFlight = false;
      if (this.flushAgain) {
        this.flushAgain = false;
        this.scheduleFlush();
      }
    }
  }

  private async persistSnapshot(snapshot: LegacySnapshot, force: boolean): Promise<void> {
    if (!this.user) return;
    const writes: PendingWrite[] = [];

    const queueWrite = (
      path: string,
      reference: ReturnType<typeof doc>,
      plain: Record<string, any>,
      firestoreValue?: Record<string, any>
    ) => {
      const cleanPlain = stripUndefined(plain);
      const cleanFirestoreValue = stripUndefined(firestoreValue || plain);
      const hash = stableStringify(cleanPlain);
      if (!force && this.hashes.get(path) === hash) return;

      writes.push({
        path,
        hash,
        promise: setDoc(reference, cleanFirestoreValue, { merge: false }),
      });
    };

    // Admin user management (approve/disable/role) must propagate to every client.
    if (this.user.role === 'ADMIN') {
      snapshot.users.forEach((value) => queueWrite(`users/${value.uid}`, doc(db, 'users', value.uid), value));
    }

    snapshot.projects.forEach((project) => {
      const payload = this.projectPayload(project);
      queueWrite(`projects/${project.projectId}`, doc(db, 'projects', project.projectId), payload);
    });

    snapshot.tasks.forEach((task) => {
      const payload = this.taskPayload(task, snapshot.projects);
      const cloudPayload = { ...payload };
      if (typeof payload.chatWritableUntil === 'string' && payload.chatWritableUntil) {
        cloudPayload.chatWritableUntil = Timestamp.fromDate(new Date(payload.chatWritableUntil));
      }
      queueWrite(`tasks/${task.taskId}`, doc(db, 'tasks', task.taskId), payload, cloudPayload);
    });

    snapshot.assignments.forEach((value) => queueWrite(
      `tasks/${value.taskId}/assignments/${value.userId}`,
      doc(db, 'tasks', value.taskId, 'assignments', value.userId),
      { ...value }
    ));

    snapshot.messages.forEach((value) => queueWrite(
      `tasks/${value.taskId}/messages/${value.messageId}`,
      doc(db, 'tasks', value.taskId, 'messages', value.messageId),
      { ...value }
    ));

    snapshot.files.forEach((value) => queueWrite(
      `tasks/${value.taskId}/files/${value.fileId}`,
      doc(db, 'tasks', value.taskId, 'files', value.fileId),
      this.filePayload(value)
    ));

    snapshot.notifications.forEach((value) => {
      const payload = { ...value, createdBy: value.createdBy || this.user!.uid };
      queueWrite(`notifications/${value.notificationId}`, doc(db, 'notifications', value.notificationId), payload);
    });

    snapshot.auditLogs.forEach((value) => {
      if (value.actorId !== this.user!.uid && this.user!.role !== 'ADMIN') return;
      queueWrite(`auditLogs/${value.eventId}`, doc(db, 'auditLogs', value.eventId), { ...value });
    });

    const results = await Promise.allSettled(writes.map((write) => write.promise));
    results.forEach((result, index) => {
      const write = writes[index];
      if (result.status === 'fulfilled') {
        this.hashes.set(write.path, write.hash);
        return;
      }

      console.error(`[ProductionSync] Firestore write rejected: ${write.path}`, result.reason);

      // Permission/validation errors are deterministic and should not spin in a
      // retry loop. Transient backend/network errors are retried once the
      // current flush finishes. Do not mark them as synchronized.
      if (isRetryableWriteError(result.reason)) {
        if (this.hashes.get(write.path) === write.hash) this.hashes.delete(write.path);
        this.flushAgain = true;
      } else {
        // Suppress repeated identical invalid writes until local state changes.
        this.hashes.set(write.path, write.hash);
      }
    });
  }

  private projectPayload(project: Project): Record<string, any> {
    const members = project.members || {};
    return { ...project, members, memberIds: Object.keys(members) };
  }

  private taskPayload(task: Task, projects?: Project[]): Record<string, any> {
    const sourceProjects = projects || ((dataService as any).projects as Project[]) || [];
    const project = sourceProjects.find((row) => row.projectId === task.projectId);
    return { ...task, projectMemberIds: Object.keys(project?.members || {}) };
  }

  private filePayload(file: TaskFile): Record<string, any> {
    const { dataUrl: _binary, ...metadata } = file;
    return metadata;
  }

  private remember(path: string, value: unknown): void {
    this.hashes.set(path, stableStringify(stripUndefined(value)));
  }

  private async maybeMigrateLegacy(): Promise<void> {
    if (!this.readyProjects || !this.readyTasks || !this.user || !this.legacy) return;
    if (this.user.role !== 'ADMIN') return;
    if (import.meta.env.VITE_AUTO_MIGRATE_LOCAL_DATA !== 'true') return;
    if (this.initialCloudProjects !== 0 || this.initialCloudTasks !== 0) return;

    const migration = this.legacy;
    this.legacy = null;
    if (migration.projects.length === 0 && migration.tasks.length === 0) return;

    console.info('[ProductionSync] Migrating legacy local workspace to Firestore once.');
    await this.persistSnapshot(migration, true);
  }
}

export const productionSyncService = new ProductionSyncService();
