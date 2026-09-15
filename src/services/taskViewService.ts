import { TaskStatus, User } from '@shared/types/models';
import { dataService } from './dataService';

const BOARD_EDITABLE_STATUSES: TaskStatus[] = ['NEW', 'IN_PROGRESS', 'WAITING'];

class TaskViewService {
  public moveTask(
    taskId: string,
    nextStatus: TaskStatus,
    actor: User
  ): { success: boolean; error?: string } {
    if (!BOARD_EDITABLE_STATUSES.includes(nextStatus)) {
      return {
        success: false,
        error: 'Trạng thái Hoàn thành/Quá hạn không thể đặt bằng kéo-thả. Hãy dùng quy trình nghiệm thu trong chi tiết công việc.',
      };
    }

    const task = dataService.getTaskById(taskId);
    if (!task) return { success: false, error: 'Không tìm thấy công việc.' };

    const project = dataService.getProjectById(task.projectId);
    const canEdit =
      actor.role === 'ADMIN' ||
      task.assignerId === actor.uid ||
      task.assigneeIds.includes(actor.uid) ||
      project?.ownerId === actor.uid;

    if (!canEdit) return { success: false, error: 'Bạn không có quyền thay đổi trạng thái công việc này.' };
    if (task.status === 'COMPLETED') {
      return { success: false, error: 'Công việc đã nghiệm thu. Hãy mở lại công việc trước khi thay đổi trạng thái.' };
    }

    task.status = nextStatus;
    task.updatedAt = new Date().toISOString();

    const internals = dataService as any;
    if (typeof internals.saveState === 'function') internals.saveState();
    if (typeof internals.notify === 'function') internals.notify();
    return { success: true };
  }
}

export const taskViewService = new TaskViewService();
