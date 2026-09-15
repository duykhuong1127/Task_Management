import {
  deleteObject,
  getBlob,
  ref as storageRef,
  uploadBytesResumable,
} from 'firebase/storage';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { Task, TaskFile, User } from '@shared/types/models';
import { db, isFirebaseConfigured, storage } from '../config/firebase';
import { dataService } from './dataService';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'ps1', 'vbs', 'js', 'jar', 'apk', 'dmg',
]);

function safeName(name: string): string {
  return name
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160) || 'file';
}

function extensionOf(name: string): string {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `file_${crypto.randomUUID()}`;
  }
  return `file_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

class FileStorageService {
  public validate(file: File): { valid: boolean; error?: string } {
    if (!file || file.size <= 0) return { valid: false, error: 'Tệp không hợp lệ hoặc trống.' };
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: 'Tệp vượt quá giới hạn 25 MB.' };
    }
    if (BLOCKED_EXTENSIONS.has(extensionOf(file.name))) {
      return { valid: false, error: 'Loại tệp thực thi này không được phép tải lên.' };
    }
    return { valid: true };
  }

  public async upload(
    task: Task,
    file: File,
    actor: User,
    onProgress?: (percent: number) => void
  ): Promise<TaskFile> {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase chưa được cấu hình để lưu tệp production.');
    }

    const validation = this.validate(file);
    if (!validation.valid) throw new Error(validation.error);

    if (!dataService.isUserInProject(task.projectId, actor.uid) && actor.role !== 'ADMIN') {
      throw new Error('Bạn không có quyền tải tệp lên dự án này.');
    }

    const fileId = makeId();
    const normalizedName = safeName(file.name);
    const path = `projects/${task.projectId}/tasks/${task.taskId}/${fileId}/${normalizedName}`;
    const objectRef = storageRef(storage, path);

    const uploadTask = uploadBytesResumable(objectRef, file, {
      contentType: file.type || 'application/octet-stream',
      customMetadata: {
        projectId: task.projectId,
        taskId: task.taskId,
        fileId,
        uploadedBy: actor.uid,
        assignerId: task.assignerId,
      },
    });

    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
          }
        },
        reject,
        resolve
      );
    });

    const now = new Date().toISOString();
    const metadata: TaskFile = {
      fileId,
      projectId: task.projectId,
      taskId: task.taskId,
      name: normalizedName,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      uploadedBy: actor.uid,
      driveOwnerId: task.assignerId,
      createdAt: now,
      deleted: false,
      storageProvider: 'firebase-storage',
      storagePath: path,
    };

    try {
      // Binary bytes are in Storage; only small metadata is written to Firestore.
      await setDoc(doc(db, 'tasks', task.taskId, 'files', fileId), metadata);
    } catch (metadataError) {
      // Avoid orphaned binary objects if the Firestore metadata transaction is
      // rejected by rules or interrupted after Storage upload completes.
      try {
        await deleteObject(objectRef);
      } catch (cleanupError) {
        console.error('[FileStorage] failed to clean orphaned object', cleanupError);
      }
      throw metadataError;
    }

    this.upsertLocal(metadata);
    return metadata;
  }

  public async download(file: TaskFile): Promise<void> {
    if (!file.storagePath) {
      throw new Error('Tệp cũ chưa có đường dẫn Firebase Storage. Hãy tải lại tệp vào hệ thống mới.');
    }

    // getBlob enforces Firebase Storage Security Rules on every download. The
    // production bucket must whitelist the web app origin in CORS settings.
    const blob = await getBlob(storageRef(storage, file.storagePath));
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
  }

  public async remove(file: TaskFile, actor: User): Promise<void> {
    if (!file.storagePath) throw new Error('Không tìm thấy tệp trên Firebase Storage.');
    const task = dataService.getTaskById(file.taskId);
    const canDelete =
      actor.role === 'ADMIN' ||
      file.uploadedBy === actor.uid ||
      task?.assignerId === actor.uid;
    if (!canDelete) throw new Error('Bạn không có quyền xóa tệp này.');

    await deleteObject(storageRef(storage, file.storagePath));
    const deletedAt = new Date().toISOString();
    await updateDoc(doc(db, 'tasks', file.taskId, 'files', file.fileId), {
      deleted: true,
      deletedAt,
      deletedBy: actor.uid,
    });

    const local: TaskFile = { ...file, deleted: true, deletedAt };
    this.upsertLocal(local);
  }

  private upsertLocal(file: TaskFile): void {
    const internals = dataService as any;
    const current: TaskFile[] = Array.isArray(internals.files) ? internals.files : [];
    internals.files = [file, ...current.filter((item) => item.fileId !== file.fileId)];
    if (typeof internals.saveState === 'function') internals.saveState();
    if (typeof internals.notify === 'function') internals.notify();
  }
}

export const fileStorageService = new FileStorageService();
