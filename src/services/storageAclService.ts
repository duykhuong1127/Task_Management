import { doc, setDoc } from 'firebase/firestore';
import { Project, User } from '@shared/types/models';
import { defaultDb, isFirebaseConfigured } from '../config/firebase';
import { dataService } from './dataService';

const BOOTSTRAP_ADMINS = new Set(['duykhuong332@gmail.com', 'admin@company.com']);

/**
 * Cloud Storage Security Rules may only read the project's (default) Firestore
 * database. The application itself uses an AI-Studio-provisioned named database,
 * so we mirror only the minimum authorization attributes needed by Storage:
 *
 *   storageUsers/{uid}: role, status, email
 *   storageProjects/{projectId}: ownerId, memberIds
 *
 * No task content, messages, files, descriptions or other business data are
 * duplicated into the default database.
 */
class StorageAclService {
  private actor: User | null = null;
  private unsub: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private syncing = false;
  private rerun = false;

  public connect(actor: User): () => void {
    this.disconnect();
    this.actor = actor;
    if (!isFirebaseConfigured || actor.status !== 'ACTIVE') return () => undefined;

    void this.ensureBootstrapAdmin(actor).finally(() => this.schedule());
    this.unsub = dataService.subscribe(() => this.schedule());
    return () => this.disconnect();
  }

  public disconnect(): void {
    this.unsub?.();
    this.unsub = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.actor = null;
    this.syncing = false;
    this.rerun = false;
  }

  private schedule(): void {
    if (!this.actor) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.sync();
    }, 350);
  }

  private async ensureBootstrapAdmin(actor: User): Promise<void> {
    const email = actor.email.toLowerCase();
    if (actor.role !== 'ADMIN' || !BOOTSTRAP_ADMINS.has(email)) return;

    await setDoc(doc(defaultDb, 'storageUsers', actor.uid), {
      uid: actor.uid,
      email: actor.email,
      normalizedEmail: email,
      role: 'ADMIN',
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }

  private async sync(): Promise<void> {
    const actor = this.actor;
    if (!actor) return;
    if (this.syncing) {
      this.rerun = true;
      return;
    }

    this.syncing = true;
    try {
      const writes: Promise<void>[] = [];
      const projects = dataService.getProjects();

      if (actor.role === 'ADMIN') {
        dataService.getUsers().forEach((user) => {
          writes.push(setDoc(doc(defaultDb, 'storageUsers', user.uid), {
            uid: user.uid,
            email: user.email,
            normalizedEmail: user.normalizedEmail || user.email.toLowerCase(),
            role: user.role,
            status: user.status,
            updatedAt: user.updatedAt,
          }, { merge: true }));
        });
      }

      projects
        .filter((project) => actor.role === 'ADMIN' || project.ownerId === actor.uid)
        .forEach((project) => writes.push(this.writeProjectAcl(project)));

      const results = await Promise.allSettled(writes);
      results.forEach((result) => {
        if (result.status === 'rejected') {
          console.error('[StorageACL] mirror write rejected', result.reason);
        }
      });
    } finally {
      this.syncing = false;
      if (this.rerun) {
        this.rerun = false;
        this.schedule();
      }
    }
  }

  private writeProjectAcl(project: Project): Promise<void> {
    return setDoc(doc(defaultDb, 'storageProjects', project.projectId), {
      projectId: project.projectId,
      ownerId: project.ownerId,
      memberIds: Object.keys(project.members || {}),
      deleted: Boolean(project.deleted),
      updatedAt: project.updatedAt,
    }, { merge: false });
  }
}

export const storageAclService = new StorageAclService();
