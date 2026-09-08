import React, { useState } from 'react';
import { Project, User, TaskPriority } from '@shared/types/models';
import { dataService } from '../services/dataService';
import { GoogleDriveConsentModal } from './GoogleDriveConsentModal';
import { X, Calendar, Flag, Users, FolderKanban, Check, HardDrive, ShieldAlert, Lock, ArrowRight } from 'lucide-react';

interface CreateTaskModalProps {
  currentUser: User;
  projects: Project[];
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  currentUser,
  projects,
  onClose,
  onSuccess,
}) => {
  const [projectId, setProjectId] = useState<string>(projects[0]?.projectId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [showConsentModal, setShowConsentModal] = useState(false);
  
  // Default deadline: 48 hours from now in Vietnam time format YYYY-MM-DDTHH:mm
  const defaultDeadline = new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 16);
  const [deadline, setDeadline] = useState(defaultDeadline);

  const users = dataService.getUsers().filter((u) => u.status === 'ACTIVE');
  // Only users who belong to the selected project can be assigned
  const projectMembers = users.filter((u) => {
    if (!projectId) return false;
    return dataService.isUserInProject(projectId, u.uid);
  });

  const isDriveDenied = currentUser.driveAccessStatus === 'DENIED';
  const isDriveGranted = currentUser.driveAccessStatus === 'GRANTED';

  const handleProjectChange = (newProjectId: string) => {
    setProjectId(newProjectId);
    // Remove any assignees that are not members of the newly selected project
    setSelectedAssigneeIds((prev) =>
      prev.filter((uid) => dataService.isUserInProject(newProjectId, uid))
    );
  };

  const toggleAssignee = (uid: string) => {
    if (selectedAssigneeIds.includes(uid)) {
      setSelectedAssigneeIds(selectedAssigneeIds.filter((id) => id !== uid));
    } else {
      setSelectedAssigneeIds([...selectedAssigneeIds, uid]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isDriveDenied) {
      alert('Quyền giao việc của bạn đang bị khóa do chưa cấp quyền Google Drive! Quản trị viên đã được thông báo.');
      return;
    }

    if (!title.trim()) {
      alert('Vui lòng nhập tiêu đề công việc!');
      return;
    }

    if (selectedAssigneeIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 người nhận việc (Assignee)!');
      return;
    }

    if (!deadline) {
      alert('Vui lòng chọn hạn chót (Deadline)!');
      return;
    }

    const isoDeadline = new Date(deadline).toISOString();

    const res = dataService.createTask({
      projectId,
      title,
      description,
      assigneeIds: selectedAssigneeIds,
      priority,
      deadline: isoDeadline,
    });

    if (!res.success) {
      alert(res.error || 'Có lỗi xảy ra khi tạo công việc');
    } else {
      onSuccess();
      onClose();
    }
  };

  const selectedProject = projects.find((p) => p.projectId === projectId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-[#0E0E0E] border border-[#333] rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222] bg-[#111]">
          <div className="text-white font-serif italic text-lg font-semibold flex items-center gap-2">
            <span className="text-[#D4AF37]">+</span>
            <span>Giao Việc Mới (Tạo Công Việc)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#222] text-[#888] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        {projects.length === 0 ? (
          <div className="p-8 text-center space-y-4">
            <div className="p-3 rounded-full bg-amber-500/10 text-amber-400 w-fit mx-auto border border-amber-500/20">
              <FolderKanban className="w-8 h-8" />
            </div>
            <h3 className="text-white font-medium text-sm">Bạn Chưa Có Dự Án Khả Dụng</h3>
            <p className="text-xs text-[#888] leading-relaxed max-w-sm mx-auto">
              Chỉ các thành viên trực thuộc dự án mới có thể tạo và giao công việc. Vui lòng liên hệ Quản trị viên để được cấp quyền vào dự án.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-[#222] hover:bg-[#333] text-xs text-white uppercase tracking-wider font-semibold"
            >
              Đóng
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Assigner invariant notification & Google Drive Destination */}
          <div className="p-2.5 rounded bg-[#161616] border border-[#262626] text-[11px] text-[#888] flex items-center justify-between">
            <span>Người giao việc (Assigner):</span>
            <strong className="text-white font-medium">{currentUser.displayName} ({currentUser.email})</strong>
          </div>

          {/* Google Drive Requirement Notice */}
          {isDriveDenied ? (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 space-y-2">
              <div className="flex items-center gap-2 text-rose-300 text-xs font-semibold">
                <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Quyền giao việc đang bị khóa (Chưa cấp quyền Google Drive)</span>
              </div>
              <p className="text-[11px] text-rose-200/80 leading-relaxed">
                Dữ liệu công việc bắt buộc phải được lưu vào Google Drive của người giao việc. Bạn đã từ chối quyền này nên không thể giao việc. Quản trị viên (Admin) đã nhận được thông báo.
              </p>
              <button
                type="button"
                id="btn-re-grant-drive-create-modal"
                onClick={() => setShowConsentModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow cursor-pointer"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Cấp quyền Google Drive ngay để mở khóa</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/30 text-[11px] text-emerald-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Dữ liệu sẽ tự động lưu vào Google Drive: <strong className="text-white">{currentUser.email}</strong></span>
              </div>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">
                Đã kết nối
              </span>
            </div>
          )}

          {/* Project Selection */}
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-[#888] font-medium flex items-center gap-1.5">
              <FolderKanban className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Dự Án Trực Thuộc *</span>
            </label>
            <select
              id="select-create-project"
              value={projectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[#141414] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#D4AF37]"
            >
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Task Title */}
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-[#888] font-medium">
              Tiêu Đề Công Việc *
            </label>
            <input
              id="input-create-title"
              type="text"
              required
              placeholder="Ví dụ: Báo cáo phân bổ ngân sách Singapore..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[#141414] border border-[#2a2a2a] text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-[#888] font-medium">
              Mô Tả Chi Tiết
            </label>
            <textarea
              id="textarea-create-description"
              rows={3}
              placeholder="Chi tiết công việc cần đạt được, tài liệu tham khảo..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[#141414] border border-[#2a2a2a] text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          {/* Multiple Assignees Selection */}
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-[#888] font-medium flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Người Nhận Việc (Thành viên dự án) *</span>
              </span>
              <span className="text-[#D4AF37] font-mono text-[10px]">
                Đã chọn: {selectedAssigneeIds.length}
              </span>
            </label>
            <div className="p-2 border border-[#2a2a2a] rounded bg-[#141414] max-h-36 overflow-y-auto space-y-1">
              {projectMembers.length === 0 ? (
                <div className="text-xs text-[#666] py-3 text-center italic">
                  Dự án này chưa có thành viên nào khác để giao việc
                </div>
              ) : (
                projectMembers.map((u) => {
                  const isSelected = selectedAssigneeIds.includes(u.uid);
                  return (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={() => toggleAssignee(u.uid)}
                      className={`w-full flex items-center justify-between p-2 rounded text-left transition-colors ${
                        isSelected
                          ? 'bg-[#1e1e1e] border border-[#D4AF37]/40 text-white'
                          : 'hover:bg-[#181818] text-[#999]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <img src={u.photoURL} alt={u.displayName} className="w-5 h-5 rounded-full object-cover" />
                        <span className="text-xs">{u.displayName}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#D4AF37]" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Priority & Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-[#888] font-medium flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Mức Ưu Tiên</span>
              </label>
              <select
                id="select-create-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 rounded bg-[#141414] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="LOW">Thấp (Low)</option>
                <option value="NORMAL">Bình thường (Normal)</option>
                <option value="HIGH">Cao (High)</option>
                <option value="URGENT">Khẩn cấp (Urgent)</option>
              </select>
            </div>

            {/* Deadline */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-[#888] font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Hạn Chót (Deadline) *</span>
              </label>
              <input
                id="input-create-deadline"
                type="datetime-local"
                required
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#141414] border border-[#2a2a2a] text-xs text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-[#222] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border border-[#333] hover:bg-[#1a1a1a] text-xs text-[#aaa] transition-colors"
            >
              Hủy
            </button>
            <button
              id="btn-create-task-submit"
              type="submit"
              disabled={isDriveDenied}
              className="px-5 py-2 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black text-xs font-bold uppercase tracking-wider shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Tạo Công Việc
            </button>
          </div>
        </form>
        )}

        {showConsentModal && (
          <GoogleDriveConsentModal
            user={currentUser}
            isOpen={showConsentModal}
            onClose={() => setShowConsentModal(false)}
            onDecisionComplete={(granted) => {
              if (granted) {
                setShowConsentModal(false);
              }
            }}
          />
        )}
      </div>
    </div>
  );
};
