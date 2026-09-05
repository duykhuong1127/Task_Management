import React, { useState } from 'react';
import { Task, User, TaskAssignment, ChatMessage, TaskFile } from '@shared/types/models';
import { dataService } from '../services/dataService';
import { formatVietnamDateTime, isOverdue, isWithin72Hours, isChatWritable } from '../utils/date';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  User as UserIcon,
  Send,
  Upload,
  Download,
  FileText,
  Lock,
  RotateCcw,
  Trash2,
  AtSign,
  MessageSquare,
  Paperclip,
  Activity,
  HardDrive,
  Info,
} from 'lucide-react';

interface TaskDetailsModalProps {
  task: Task;
  currentUser: User;
  onClose: () => void;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  task,
  currentUser,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'files' | 'chat' | 'activity'>('details');
  const [chatInput, setChatInput] = useState('');
  const [mentionTarget, setMentionTarget] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const assignments = dataService.getAssignmentsForTask(task.taskId);
  const messages = dataService.getMessages(task.taskId);
  const files = dataService.getFiles(task.taskId);
  const auditLogs = dataService.getAuditLogs().filter((l) => l.taskId === task.taskId);
  const project = dataService.getProjectById(task.projectId);
  const assigner = dataService.getUserById(task.assignerId);

  const isCompleted = task.status === 'COMPLETED';
  const overdue = !isCompleted && isOverdue(task.deadline);
  const dueSoon = !isCompleted && isWithin72Hours(task.deadline);

  // T+15 check: is chat writable or locked?
  const chatWritable = isChatWritable(task.chatWritableUntil);

  // Handle progress slider update
  const handleProgressChange = (userId: string, newProgress: number) => {
    const res = dataService.updateAssignmentProgress(task.taskId, userId, newProgress);
    if (!res.success) {
      alert(res.error);
    }
  };

  // Handle posting message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const mentions = mentionTarget ? [mentionTarget] : [];
    const res = dataService.postMessage(task.taskId, chatInput, mentions);
    if (!res.success) {
      alert(res.error);
    } else {
      setChatInput('');
      setMentionTarget(null);
    }
  };

  // Handle simulated Google Drive file upload
  const handleUploadFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFileName.trim()) return;

    setIsUploading(true);
    const assignerEmail = assigner?.email || 'nguoigiaoviec@gmail.com';
    setTimeout(() => {
      const res = dataService.uploadFile(task.taskId, uploadFileName, 'application/pdf', 1024 * 1024 * 2.5);
      setIsUploading(false);
      if (!res.success) {
        alert(res.error);
      } else {
        setUploadFileName('');
        alert(`Tài liệu đã được gửi và lưu trữ thành công vào Google Drive của Người giao việc:\n- Chủ sở hữu Drive: ${assignerEmail}\n- Thư mục: /Task Management App/${project?.name || 'Alpha'}/${task.taskId}/\n- Tên tệp: ${uploadFileName}`);
      }
    }, 400);
  };

  const handlePhysicalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const assignerEmail = assigner?.email || 'nguoigiaoviec@gmail.com';
      setTimeout(() => {
        const res = dataService.uploadFile(task.taskId, file.name, file.type || 'application/octet-stream', file.size || 1024 * 500);
        setIsUploading(false);
        if (!res.success) {
          alert(res.error);
        } else {
          alert(`Tệp "${file.name}" đã được tải lên và lưu trực tiếp vào tài khoản Google Drive của Người giao việc:\n- Gmail người nhận lưu trữ: ${assignerEmail}\n- Đường dẫn Drive: /Task Management App/${project?.name || 'Alpha'}/${task.taskId}/${file.name}`);
        }
      }, 500);
    }
  };

  // Handle file download with security check
  const handleDownloadFile = (fileId: string) => {
    const res = dataService.authorizeFileDownload(fileId);
    if (!res.authorized) {
      alert(res.error || 'Quyền bị từ chối!');
    } else {
      alert(`Đã cấp quyền truy cập bảo mật thành công cho tệp: ${res.file?.name}\nĐang truyền tải luồng dữ liệu bảo mật từ Google Drive.`);
    }
  };

  // Reopen task
  const handleReopen = () => {
    const res = dataService.reopenTask(task.taskId);
    if (!res.success) alert(res.error);
  };

  const canDelete =
    currentUser.role === 'ADMIN' ||
    currentUser.uid === task.assignerId ||
    (project && project.ownerId === currentUser.uid);

  // Soft delete task
  const handleConfirmDelete = () => {
    setIsDeleting(true);
    setDeleteError(null);
    const res = dataService.softDeleteTask(task.taskId);
    setIsDeleting(false);
    if (!res.success) {
      setDeleteError(res.error || 'Có lỗi xảy ra khi xóa công việc.');
    } else {
      setShowDeleteModal(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-[#0A0A0A] border border-[#333] rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222] bg-[#0E0E0E]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded border border-[#D4AF37]/30 font-semibold">
              {task.taskId}
            </span>
            <span className="text-xs text-[#888] truncate max-w-[200px]">{project?.name}</span>
          </div>

          <div className="flex items-center gap-2">
            {isCompleted && (
              <button
                onClick={handleReopen}
                className="px-2.5 py-1 rounded bg-[#161616] hover:bg-[#222] border border-[#444] text-xs text-[#ccc] hover:text-white flex items-center gap-1 transition-all"
                title="Mở lại công việc"
              >
                <RotateCcw className="w-3 h-3 text-[#D4AF37]" />
                <span>Mở Lại</span>
              </button>
            )}

            {canDelete && (
              <button
                onClick={() => {
                  setDeleteError(null);
                  setShowDeleteModal(true);
                }}
                className="p-1.5 rounded hover:bg-rose-950/40 text-[#666] hover:text-rose-400 transition-colors"
                title="Xóa công việc"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-[#222] text-[#888] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Task Title & Status Summary Banner */}
        <div className="px-6 py-4 border-b border-[#1f1f1f] bg-[#0B0B0B] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 flex-1">
            <h2 className="text-lg md:text-xl font-serif text-white font-semibold">{task.title}</h2>
            <div className="flex items-center gap-3 text-xs text-[#777] flex-wrap">
              <span>
                Người giao việc: <strong className="text-white font-normal">{assigner?.displayName || 'Ẩn danh'}</strong>
              </span>
              <span>•</span>
              <span>
                Hạn chót: <strong className="text-[#D4AF37] font-mono font-normal">{formatVietnamDateTime(task.deadline)}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isCompleted ? (
              <div className="px-3 py-1 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>HOÀN THÀNH</span>
              </div>
            ) : overdue ? (
              <div className="px-3 py-1 rounded bg-rose-950/70 border border-rose-800/40 text-rose-300 text-xs font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>QUÁ HẠN</span>
              </div>
            ) : dueSoon ? (
              <div className="px-3 py-1 rounded bg-amber-950/60 border border-amber-800/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>SẮP ĐẾN HẠN (&lt;72h)</span>
              </div>
            ) : (
              <div className="px-3 py-1 rounded bg-sky-950/60 border border-sky-800/40 text-sky-300 text-xs font-semibold flex items-center gap-1.5">
                <span>ĐANG THỰC HIỆN</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs (Section 43: Chi tiết, Tệp, Trao đổi, Hoạt động) */}
        <div className="flex items-center border-b border-[#222] bg-[#0A0A0A] px-6 text-xs">
          <button
            id="tab-task-details"
            onClick={() => setActiveTab('details')}
            className={`py-3 px-4 font-medium tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'details'
                ? 'border-[#D4AF37] text-[#D4AF37]'
                : 'border-transparent text-[#777] hover:text-white'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Chi Tiết & Tiến Độ</span>
          </button>

          <button
            id="tab-task-files"
            onClick={() => setActiveTab('files')}
            className={`py-3 px-4 font-medium tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'files'
                ? 'border-[#D4AF37] text-[#D4AF37]'
                : 'border-transparent text-[#777] hover:text-white'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>Tệp Google Drive ({files.length})</span>
          </button>

          <button
            id="tab-task-chat"
            onClick={() => setActiveTab('chat')}
            className={`py-3 px-4 font-medium tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'chat'
                ? 'border-[#D4AF37] text-[#D4AF37]'
                : 'border-transparent text-[#777] hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Trao Đổi ({messages.length})</span>
          </button>

          <button
            id="tab-task-activity"
            onClick={() => setActiveTab('activity')}
            className={`py-3 px-4 font-medium tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'activity'
                ? 'border-[#D4AF37] text-[#D4AF37]'
                : 'border-transparent text-[#777] hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Hoạt Động ({auditLogs.length})</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* 1. TAB CHI TIẾT */}
          {activeTab === 'details' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Description */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-[#666] font-semibold">
                  Mô Tả Nhiệm Vụ
                </div>
                <div className="p-4 rounded border border-[#222] bg-[#0E0E0E] text-xs text-[#ccc] leading-relaxed">
                  {task.description || 'Chưa có mô tả chi tiết cho công việc này.'}
                </div>
              </div>

              {/* SECTION 44: INDIVIDUAL ASSIGNEE PROGRESS UI */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-semibold">
                    Tiến Độ Từng Cá Nhân (Multi-Assignee Completion Rule)
                  </div>
                  <div className="text-[10px] text-[#777]">
                    Công việc hoàn thành khi <strong className="text-[#D4AF37]">TẤT CẢ</strong> thành viên đạt 100%
                  </div>
                </div>

                <div className="space-y-3">
                  {task.assigneeIds.map((uid) => {
                    const user = dataService.getUserById(uid);
                    const assignment = assignments.find((a) => a.userId === uid) || {
                      taskId: task.taskId,
                      userId: uid,
                      status: 'NOT_STARTED',
                      progress: 0,
                      assignedAt: task.createdAt,
                      updatedAt: task.createdAt,
                    };

                    const canEdit = currentUser.uid === uid || currentUser.role === 'ADMIN' || currentUser.uid === task.assignerId;
                    const isAssigneeDone = assignment.status === 'COMPLETED';

                    return (
                      <div
                        key={uid}
                        className="p-3.5 rounded border border-[#222] bg-[#0E0E0E] flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-[#333]"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={user?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                            alt={user?.displayName}
                            className="w-8 h-8 rounded-full object-cover border border-[#D4AF37]/30"
                          />
                          <div>
                            <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                              <span>{user?.displayName || uid}</span>
                              {currentUser.uid === uid && (
                                <span className="text-[9px] px-1 rounded bg-[#D4AF37]/20 text-[#D4AF37]">
                                  (Bạn)
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#666]">
                              Trạng thái: <span className={isAssigneeDone ? 'text-emerald-400 font-medium' : 'text-[#888]'}>
                                {isAssigneeDone ? 'Hoàn thành' : assignment.progress > 0 ? 'Đang thực hiện' : 'Chưa bắt đầu'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Progress Control */}
                        <div className="flex items-center gap-4 flex-1 md:max-w-xs">
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-[#555]">Mức độ hoàn thành</span>
                              <span className="font-mono text-white font-bold">{assignment.progress}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={assignment.progress}
                              disabled={!canEdit}
                              onChange={(e) => handleProgressChange(uid, Number(e.target.value))}
                              className="w-full accent-[#D4AF37] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </div>

                          {canEdit && (
                            <button
                              onClick={() => handleProgressChange(uid, isAssigneeDone ? 0 : 100)}
                              className={`px-2.5 py-1 rounded text-[10px] uppercase font-bold shrink-0 transition-all ${
                                isAssigneeDone
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-900/60'
                                  : 'bg-[#1a1a1a] text-[#aaa] border border-[#333] hover:text-white hover:border-[#D4AF37]'
                              }`}
                            >
                              {isAssigneeDone ? 'Hoàn thành' : 'Đánh dấu 100%'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* T+15 Retention Rule Info Card */}
              {isCompleted && (
                <div className="p-4 rounded border border-[#D4AF37]/30 bg-[#0E0E0E] text-xs space-y-1">
                  <div className="flex items-center gap-2 text-[#D4AF37] font-semibold">
                    <Lock className="w-4 h-4" />
                    <span>Quy Tắc Lưu Trữ Trao Đổi T+15 (T+15 Chat Retention)</span>
                  </div>
                  <p className="text-[#888]">
                    Công việc đã hoàn thành lúc: <span className="font-mono text-white">{formatVietnamDateTime(task.completedAt)}</span>.
                    {chatWritable ? (
                      <span> Cuộc trao đổi vẫn có thể gửi tin nhắn cho đến: <strong className="text-[#D4AF37] font-mono">{formatVietnamDateTime(task.chatWritableUntil)}</strong> (15 ngày sau khi hoàn thành).</span>
                    ) : (
                      <span className="text-rose-400 font-medium"> Đã quá thời hạn 15 ngày. Cuộc trao đổi hiện đã chuyển sang chế độ CHỈ ĐỌC (Read-Only).</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 2. TAB TỆP ĐÍNH KÈM (GOOGLE DRIVE) */}
          {activeTab === 'files' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Google Drive Owner Architecture Note */}
              <div className="p-4 rounded-lg border border-[#D4AF37]/30 bg-[#0E0E0E] text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <HardDrive className="w-4 h-4 text-[#D4AF37]" />
                    <span>Lưu Trữ Bằng Google Drive Của Người Giao Việc</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 font-mono">
                    Google Drive API
                  </span>
                </div>
                <div className="text-[#aaa] text-xs leading-relaxed space-y-1">
                  <p>
                    • Người giao việc: <strong className="text-white">{assigner?.displayName || 'Người giao việc'}</strong>
                  </p>
                  <p>
                    • Tài khoản Gmail lưu trữ: <strong className="text-[#D4AF37] font-mono">{assigner?.email || 'nguoigiaoviec@gmail.com'}</strong>
                  </p>
                  <p className="text-[11px] text-[#777]">
                    Theo quy định, người giao việc sẽ sử dụng Gmail của mình để lưu trữ tài liệu khi người dùng gửi lên. Mọi tệp đính kèm được lưu tại thư mục:
                  </p>
                  <code className="block p-2 rounded bg-[#141414] border border-[#222] text-[#D4AF37] font-mono text-[10.5px]">
                    Google Drive: /Task Management App/{project?.name || 'Project Alpha'}/{task.taskId}/
                  </code>
                </div>
              </div>

              {/* Upload Form */}
              <div className="p-4 rounded-lg border border-[#222] bg-[#0E0E0E] space-y-3">
                <div className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-semibold flex items-center justify-between">
                  <span>Gửi Tài Liệu Lên Google Drive Của Người Giao Việc</span>
                  <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                </div>

                {/* File picker & manual input */}
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <label className="w-full sm:w-auto px-4 py-2.5 rounded bg-[#1C1C1C] hover:bg-[#252525] border border-[#333] hover:border-[#D4AF37]/50 text-white text-xs font-medium cursor-pointer transition-all flex items-center justify-center gap-2 shrink-0">
                    <Paperclip className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Chọn tệp từ thiết bị</span>
                    <input
                      type="file"
                      onChange={handlePhysicalFileChange}
                      disabled={isUploading}
                      className="hidden"
                    />
                  </label>

                  <span className="text-xs text-[#555] hidden sm:inline">hoặc nhập tên tệp:</span>

                  <form onSubmit={handleUploadFile} className="w-full flex-1 flex gap-2">
                    <input
                      type="text"
                      placeholder="Ví dụ: baocao_tien_do.pdf, banve.dwg..."
                      value={uploadFileName}
                      onChange={(e) => setUploadFileName(e.target.value)}
                      className="flex-1 px-3 py-2 rounded bg-[#141414] border border-[#2a2a2a] text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#D4AF37]"
                    />
                    <button
                      type="submit"
                      disabled={isUploading || !uploadFileName.trim()}
                      className="px-4 py-2 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploading ? 'Đang lưu...' : 'Gửi lên'}</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Files List */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-[#666] font-semibold flex items-center justify-between">
                  <span>Danh Sách Tệp Đính Kèm Đã Lưu ({files.length})</span>
                  <span className="text-[10px] text-[#888]">Chủ sở hữu: {assigner?.email}</span>
                </div>
                {files.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#666] border border-[#222] rounded bg-[#0E0E0E]">
                    Chưa có tệp nào được tải lên cho công việc này.
                  </div>
                ) : (
                  files.map((file) => {
                    const uploader = dataService.getUserById(file.uploadedBy);
                    return (
                      <div
                        key={file.fileId}
                        className="p-3.5 rounded border border-[#222] bg-[#0E0E0E] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#333]"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-2 rounded bg-[#161616] border border-[#333] text-[#D4AF37] shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="truncate text-xs">
                            <div className="font-medium text-white truncate flex items-center gap-2">
                              <span className="truncate">{file.name}</span>
                              <span className="text-[9px] px-1 rounded bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 font-mono shrink-0">
                                Google Drive
                              </span>
                            </div>
                            <div className="text-[10px] text-[#666] flex flex-wrap items-center gap-2 mt-0.5">
                              <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                              <span>•</span>
                              <span>Tải lên bởi: {uploader?.displayName || 'Thành viên'}</span>
                              <span>•</span>
                              <span>{formatVietnamDateTime(file.createdAt)}</span>
                            </div>
                            <div className="text-[9px] text-[#D4AF37]/80 font-mono mt-0.5 truncate">
                              Drive Owner: {file.driveOwnerEmail || assigner?.email || 'nguoigiaoviec@gmail.com'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            onClick={() => {
                              navigator.clipboard?.writeText(file.drivePath || '');
                              alert(`Đã sao chép đường dẫn Google Drive:\n${file.drivePath}`);
                            }}
                            className="px-2.5 py-1.5 rounded bg-[#161616] hover:bg-[#222] border border-[#333] text-[11px] text-[#aaa] hover:text-[#D4AF37] transition-all"
                            title="Sao chép đường dẫn Google Drive"
                          >
                            Đường dẫn Drive
                          </button>
                          <button
                            onClick={() => handleDownloadFile(file.fileId)}
                            className="px-3 py-1.5 rounded bg-[#161616] hover:bg-[#222] border border-[#333] hover:border-[#D4AF37]/50 text-xs text-[#bbb] hover:text-white flex items-center gap-1.5 transition-all"
                          >
                            <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                            <span>Tải về</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 3. TAB TRAO ĐỔI (REALTIME CHAT & T+15 LOCK) */}
          {activeTab === 'chat' && (
            <div className="space-y-4 animate-in fade-in flex flex-col h-full">
              {/* T+15 Warning Banner if locked */}
              {!chatWritable && (
                <div className="p-3 rounded border border-rose-900/60 bg-rose-950/40 text-rose-300 text-xs flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>
                    Chế độ CHỈ ĐỌC (Read-Only): Đã quá 15 ngày kể từ khi công việc hoàn thành ({formatVietnamDateTime(task.completedAt)}). Không thể đăng tin nhắn mới.
                  </span>
                </div>
              )}

              {/* Messages Container */}
              <div className="space-y-3 min-h-[220px] max-h-[350px] overflow-y-auto p-2">
                {messages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#666]">
                    Chưa có tin nhắn nào trong cuộc trao đổi này. Hãy gửi tin nhắn đầu tiên!
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.senderId === currentUser.uid;
                    const sender = dataService.getUserById(msg.senderId);

                    return (
                      <div
                        key={msg.messageId}
                        className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        <img
                          src={sender?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                          alt={sender?.displayName}
                          className="w-7 h-7 rounded-full object-cover shrink-0 border border-[#333]"
                        />
                        <div className={`max-w-[75%] space-y-1 ${isMe ? 'items-end text-right' : 'items-start text-left'}`}>
                          <div className="text-[10px] text-[#666] flex items-center gap-2">
                            <span className="font-semibold text-[#888]">{sender?.displayName || 'Ẩn danh'}</span>
                            <span>{formatVietnamDateTime(msg.createdAt)}</span>
                          </div>
                          <div
                            className={`p-3 rounded-lg text-xs leading-relaxed text-left ${
                              isMe
                                ? 'bg-[#1c1c1c] text-white border border-[#D4AF37]/30'
                                : 'bg-[#121212] text-[#ddd] border border-[#222]'
                            }`}
                          >
                            {msg.text}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Send Message Input */}
              {chatWritable ? (
                <form onSubmit={handleSendMessage} className="pt-2 border-t border-[#222] space-y-2">
                  <div className="flex items-center gap-2 text-xs text-[#777]">
                    <AtSign className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Nhắc tên thành viên:</span>
                    {task.assigneeIds.map((uid) => {
                      const u = dataService.getUserById(uid);
                      const isSelected = mentionTarget === uid;
                      return (
                        <button
                          key={uid}
                          type="button"
                          onClick={() => setMentionTarget(isSelected ? null : uid)}
                          className={`px-2 py-0.5 rounded text-[10px] transition-all ${
                            isSelected
                              ? 'bg-[#D4AF37] text-black font-bold'
                              : 'bg-[#161616] text-[#888] hover:text-white border border-[#333]'
                          }`}
                        >
                          @{u?.displayName?.split(' ')[0] || uid}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={mentionTarget ? `Đang nhắc @${dataService.getUserById(mentionTarget)?.displayName}...` : 'Nhập nội dung trao đổi...'}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 px-3 py-2 rounded bg-[#121212] border border-[#262626] text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#D4AF37]"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="px-4 py-2 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black text-xs font-bold uppercase tracking-wider disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Gửi</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-3 text-center text-xs text-[#666] border border-[#222] rounded bg-[#0B0B0B]">
                  Khung nhập tin nhắn đã bị khóa theo quy tắc T+15.
                </div>
              )}
            </div>
          )}

          {/* 4. TAB HOẠT ĐỘNG (AUDIT TRAIL TIMELINE) */}
          {activeTab === 'activity' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-[10px] uppercase tracking-wider text-[#666] font-semibold">
                Dòng Thời Gian Hoạt Động (Immutable Audit Trail)
              </div>
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#666] border border-[#222] rounded bg-[#0E0E0E]">
                  Chưa có nhật ký ghi nhận cho công việc này.
                </div>
              ) : (
                <div className="relative pl-6 border-l border-[#262626] space-y-6">
                  {auditLogs.map((log) => {
                    const actor = dataService.getUserById(log.actorId);
                    return (
                      <div key={log.eventId} className="relative space-y-1">
                        {/* Dot */}
                        <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-[#D4AF37] border-2 border-[#0A0A0A]"></div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white">
                            {actor?.displayName || log.actorId}
                          </span>
                          <span className="font-mono text-[10px] text-[#666]">
                            {formatVietnamDateTime(log.createdAt)}
                          </span>
                        </div>
                        <div className="text-xs text-[#aaa]">
                          Hành động: <span className="text-[#D4AF37] font-mono text-[11px]">{log.action}</span>
                        </div>
                        {log.newValue && (
                          <pre className="p-2 rounded bg-[#121212] border border-[#222] text-[10px] font-mono text-[#888] overflow-x-auto">
                            {JSON.stringify(log.newValue, null, 2)}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        title="Xác Nhận Xóa Công Việc"
        itemName={task.title}
        itemType="công việc"
        warningMessage="Công việc này sẽ được chuyển vào danh mục đã xóa (soft-delete) và lưu nhật ký kiểm toán."
        errorMessage={deleteError}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteModal(false);
            setDeleteError(null);
          }
        }}
      />
    </div>
  );
};
