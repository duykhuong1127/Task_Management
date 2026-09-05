import { describe, it, expect, beforeEach } from 'vitest';
import { dataService } from './dataService';

describe('Business Logic & Security Authorization Scenarios', () => {
  beforeEach(() => {
    dataService.resetToSeed();
  });

  it('enforces single assigner and multi-assignees on Task creation', () => {
    dataService.setCurrentUser('user_a');
    const res = dataService.createTask({
      projectId: 'proj_alpha',
      title: 'Thiết kế giao diện PWA Dark Theme',
      description: 'Áp dụng Sophisticated Dark với phong cách Aurelius hoàng gia',
      assigneeIds: ['user_b', 'user_c'],
      priority: 'HIGH',
      deadline: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    });

    expect(res.success).toBe(true);
    expect(res.task).toBeDefined();
    if (res.task) {
      expect(res.task.assignerId).toBe('user_a');
      expect(res.task.assigneeIds).toEqual(['user_b', 'user_c']);
      expect(res.task.status).toBe('IN_PROGRESS');

      // Check assignment records initialized
      const assignments = dataService.getAssignmentsForTask(res.task.taskId);
      expect(assignments.length).toBe(2);
      expect(assignments.map((a) => a.userId).sort()).toEqual(['user_b', 'user_c']);
    }
  });

  it('completes Task only when ALL assignees complete their assignment', () => {
    // TASK-001 has assignees B, C, D
    dataService.setCurrentUser('user_b');
    dataService.updateAssignmentProgress('TASK-001', 'user_b', 100);

    let task = dataService.getTaskById('TASK-001');
    expect(task?.status).toBe('IN_PROGRESS'); // Still incomplete because C and D have not finished

    dataService.setCurrentUser('user_c');
    dataService.updateAssignmentProgress('TASK-001', 'user_c', 100);
    task = dataService.getTaskById('TASK-001');
    expect(task?.status).toBe('IN_PROGRESS'); // D still incomplete

    dataService.setCurrentUser('user_d');
    dataService.updateAssignmentProgress('TASK-001', 'user_d', 100);
    task = dataService.getTaskById('TASK-001');

    // All finished -> Task automatically becomes COMPLETED with completedAt and chatWritableUntil
    expect(task?.status).toBe('COMPLETED');
    expect(task?.completedAt).toBeDefined();
    expect(task?.chatWritableUntil).toBeDefined();
  });

  it('excludes completed assignees from subsequent scheduled reminders', () => {
    // Complete B's part in TASK-001
    dataService.setCurrentUser('user_b');
    dataService.updateAssignmentProgress('TASK-001', 'user_b', 100);

    // Run scheduled reminder
    const result = dataService.triggerScheduledReminders('0800');
    // Keys dispatched should NOT include user_b for TASK-001
    const userBKeyFound = result.keysDispatched.some((k) => k.includes('user_b') && k.includes('TASK-001'));
    expect(userBKeyFound).toBe(false);
  });

  it('maintains idempotency: running reminder twice produces no duplicates', () => {
    const run1 = dataService.triggerScheduledReminders('0800');
    const run2 = dataService.triggerScheduledReminders('0800');
    expect(run2.dispatchedCount).toBe(0); // 0 new reminders sent because already dispatched!
  });

  it('denies external user E from downloading files in private project', () => {
    dataService.setCurrentUser('user_e'); // external user
    const downloadCheck = dataService.authorizeFileDownload('file_001');
    expect(downloadCheck.authorized).toBe(false);
    expect(downloadCheck.error).toContain('TỪ CHỐI TRUY CẬP');
  });

  it('allows authorized project members to download files', () => {
    dataService.setCurrentUser('user_b'); // B is member of project Alpha
    const downloadCheck = dataService.authorizeFileDownload('file_001');
    expect(downloadCheck.authorized).toBe(true);
    expect(downloadCheck.file?.name).toBe('report_tiendo_thang_v1.pdf');
  });

  it('blocks non-admin members from promoting roles or inviting users', () => {
    dataService.setCurrentUser('user_b'); // Regular member
    const inviteRes = dataService.inviteUser('intruder@test.com', 'Intruder');
    expect(inviteRes.success).toBe(false);

    const roleRes = dataService.setUserRole('user_b', 'ADMIN');
    expect(roleRes.success).toBe(false);
  });

  it('registers new Gmail login as PENDING_APPROVAL and blocks project access until Admin approves', () => {
    // 1. User logs in with Gmail for the first time
    const loginRes = dataService.loginWithGoogle('newuser@gmail.com', 'Người Dùng Mới');
    expect(loginRes.success).toBe(true);
    expect(loginRes.isNewUser).toBe(true);
    expect(loginRes.needsApproval).toBe(true);
    expect(loginRes.user.status).toBe('PENDING_APPROVAL');

    // 2. While pending approval, user has NO access to projects or tasks
    const projects = dataService.getProjects();
    expect(projects).toEqual([]);
    const tasks = dataService.getTasks();
    expect(tasks).toEqual([]);

    // 3. Admin logs in and approves user with access to proj_alpha
    dataService.setCurrentUser('user_admin');
    const approveRes = dataService.approveUserAndGrantProjects(loginRes.user.uid, ['proj_alpha'], 'MEMBER');
    expect(approveRes.success).toBe(true);

    // 4. Now the approved user logs back in and has access to proj_alpha
    dataService.setCurrentUser(loginRes.user.uid);
    const updatedUser = dataService.getCurrentUser();
    expect(updatedUser.status).toBe('ACTIVE');
    const userProjects = dataService.getProjects();
    expect(userProjects.length).toBeGreaterThan(0);
    expect(userProjects.some((p) => p.projectId === 'proj_alpha')).toBe(true);
  });

  it('stores uploaded files in the task assigner Google Drive account', () => {
    // TASK-001 has assigner 'user_a' (a@gmail.com)
    dataService.setCurrentUser('user_b'); // member of proj_alpha
    const uploadRes = dataService.uploadFile('TASK-001', 'sample_document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 2048);
    expect(uploadRes.success).toBe(true);
    expect(uploadRes.file).toBeDefined();
    expect(uploadRes.file?.driveOwnerId).toBe('user_a');
    expect(uploadRes.file?.driveOwnerEmail).toBe('a@gmail.com');
    expect(uploadRes.file?.drivePath).toContain('Google Drive (a@gmail.com)');
  });
});
