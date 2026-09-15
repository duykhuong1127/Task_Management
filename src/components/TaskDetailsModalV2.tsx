import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  RotateCcw,
  Send,
  Trash2,
  Upload,
  UserRoundCheck,
  X,
} from 'lucide-react';
import { Task, TaskAssignment, TaskFile, User } from '@shared/types/models';
import { dataService } from '../services/dataService';
import { fileStorageService } from '../services/fileStorageService';
import { formatVietnamDateTime, isChatWritable, isOverdue } from '../utils/date';

interface TaskDetailsModalV2Props {
  task: Task;
  currentUser: User;
  onClose: () => void;
}

type Tab = 'details' | 'files' | 'chat';

const assignmentLabel: Record<TaskAssignment['status'], string> = {
  NOT_STARTED: 'Chưa bắt đầu',
  IN_PROGRESS: 'Đang thực hiện',
  WAITING: 'Chờ xử lý',
  SUBMITTED: 'Đã bàn giao',
  NEEDS_REVISION: 'Cần chỉnh sửa',
  COMPLETED: 'Đã nghiệm thu',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const TaskDetailsModalV2: React.FC<TaskDetailsModalV2Props> = ({ task, currentUser, onClose }) => {
  const [tab, setTab] = useState<Tab>('details');
  const [chatInput, setChatInput] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [fileBusyId, setFileBusyId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const project = dataService.getProjectById(task.projectId);
  const assigner = dataService.getUserById(task.assignerId);
  const assignments = dataService.getAssignmentsForTask(task.taskId);
  const files = dataService.getFiles(task.taskId);
  const messages = dataService.getMessages(task.taskId);
  const canReview = currentUser.role === 'ADMIN' || currentUser.uid === task.assignerId;
  const canDeleteTask = canReview || project?.ownerId === currentUser.uid;
  const writableChat = isChatWritable(task.chatWritableUntil);

  const participantIds = useMemo(
    () => Array.from(new Set([task.assignerId, ...task.assigneeIds])),
    [task.assignerId, task.assigneeIds.join('|')]
  );

  const runAssignmentAction = (key: string, action: () => { success: boolean; error?: string }) => {
    setActionBusy(key);
    const result = action();
    setActionBusy(null);
    if (!result.success) window.alert(result.error || 'Không thể thực hiện thao tác.');
  };

  const updateMyProgress = (assignment: TaskAssignment, value: number) => {
    const result = dataService.updateAssignmentProgress(task.taskId, assignment.userId, value);
    if (!result.success) window.alert(result.error);
  };

  const handover = (assignment: TaskAssignment) => {
    const note = window.prompt('Ghi chú bàn giao (không bắt buộc):', assignment.submissionNote || '') ?? '';
    runAssignmentAction(`handover-${assignment.userId}`, () =>
      dataService.handoverAssignment(task.taskId, assignment.userId, note)
    );
  };

  const requestRevision = (assignment: TaskAssignment) => {
    const note = window.prompt('Nội dung cần chỉnh sửa:');
    if (!note?.trim()) return;
    runAssignmentAction(`revision-${assignment.userId}`, () =>
      dataService.requestRevision(task.taskId, assignment.userId, note)
    );
  };

  const submitRevision = (assignment: TaskAssignment) => {
    const note = window.prompt('Ghi chú sau khi chỉnh sửa (không bắt buộc):') ?? '';
    runAssignmentAction(`resubmit-${assignment.userId}`, () =>
      dataService.submitRevision(task.taskId, assignment.userId, note)
    );
  };

  const approve = (assignment: TaskAssignment) => {
    const member = dataService.getUserById(assignment.userId);
    if (!window.confirm(`Xác nhận nghiệm thu phần việc của ${member?.displayName || assignment.userId}?`)) return;
    runAssignmentAction(`approve-${assignment.userId}`, () =>
      dataService.approveAssignmentCompletion(task.taskId, assignment.userId)
    );
  };

  const reopenAssignment = (assignment: TaskAssignment) => {
    runAssignmentAction(`reopen-${assignment.userId}`, () =>
      dataService.reopenAssignment(task.taskId, assignment.userId)
    );
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setUploadProgress(0);
      await fileStorageService.upload(task, file, currentUser, setUploadProgress);
      setUploadProgress(null);
    } catch (error) {
      setUploadProgress(null);
      window.alert(error instanceof Error ? error.message : 'Không thể tải tệp lên.');
    }
  };

  const handleDownload = async (file: TaskFile) => {
    try {
      setFileBusyId(file.fileId);
      if (file.storagePath) {
        await fileStorageService.download(file);
      } else if (file.dataUrl) {
        const link = document.createElement('a');
        link.href = file.dataUrl;
        link.download = file.name;
        link.click();
      } else {
        throw new Error('Đây là metadata tệp cũ chưa được chuyển sang Firebase Storage. Vui lòng tải lại tệp gốc.');
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Không thể tải tệp.');
    } finally {
      setFileBusyId(null);
    }
  };

  const handleRemoveFile = async (file: TaskFile) => {
    if (!window.confirm(`Xóa tệp “${file.name}”?`)) return;
    try {
      setFileBusyId(file.fileId);
      await fileStorageService.remove(file, currentUser);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Không thể xóa tệp.');
    } finally {
      setFileBusyId(null);
    }
  };

  const sendMessage = (event: React.FormEvent) => {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    const result = dataService.postMessage(task.taskId, text);
    if (!result.success) {
      window.alert(result.error);
      return;
    }
    setChatInput('');
  };

  const deleteTask = () => {
    if (!window.confirm(`Xóa công việc “${task.title}”? Dữ liệu sẽ được soft-delete để giữ audit trail.`)) return;
    const result = dataService.softDeleteTask(task.taskId);
    if (!result.success) {
      window.alert(result.error);
      return;
    }
    onClose();
  };

  const reopenTask = () => {
    const result = dataService.reopenTask(task.taskId);
    if (!result.success) window.alert(result.error);
  };

  const overdue = task.status !== 'COMPLETED' && isOverdue(task.deadline);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-3 md:p-6 flex items-center justify-center">
      <div className="w-full max-w-4xl max-h-[92vh] rounded-xl border border-[#333] bg-[#090909] shadow-2xl flex flex-col overflow-hidden">
        <header className="px-5 py-4 border-b border-[#242424] bg-[#0D0D0D] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="font-mono text-[10px] text-[#D4AF37] border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-0.5 rounded">{task.taskId}</span>
              <span className="text-[10px] text-[#777]">{project?.name || task.projectId}</span>
              {overdue && <span className="text-[9px] uppercase px-2 py-0.5 rounded border border-rose-800/50 bg-rose-950/40 text-rose-300">Quá hạn</span>}
              {task.status === 'COMPLETED' && <span className="text-[9px] uppercase px-2 py-0.5 rounded border border-emerald-800/50 bg-emerald-950/40 text-emerald-300">Đã nghiệm thu</span>}
            </div>
            <h2 className="text-lg md:text-xl text-white font-semibold leading-snug">{task.title}</h2>
            <div className="text-[11px] text-[#777] mt-1">Giao bởi {assigner?.displayName || task.assignerId} · Deadline {formatVietnamDateTime(task.deadline)}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {task.status === 'COMPLETED' && canReview && (
              <button onClick={reopenTask} className="p-2 rounded hover:bg-[#1A1A1A] text-[#999] hover:text-[#D4AF37]" title="Mở lại công việc"><RotateCcw className="w-4 h-4" /></button>
            )}
            {canDeleteTask && (
              <button onClick={deleteTask} className="p-2 rounded hover:bg-rose-950/40 text-[#777] hover:text-rose-400" title="Xóa công việc"><Trash2 className="w-4 h-4" /></button>
            )}
            <button onClick={onClose} className="p-2 rounded hover:bg-[#1A1A1A] text-[#999] hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        </header>

        <nav className="px-5 border-b border-[#242424] bg-[#0B0B0B] flex gap-1">
          {([
            ['details', UserRoundCheck, 'Chi tiết'],
            ['files', Paperclip, `Tệp (${files.length})`],
            ['chat', MessageSquare, `Trao đổi (${messages.length})`],
          ] as Array<[Tab, React.ComponentType<{ className?: string }>, string]>).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`px-3 py-3 text-xs flex items-center gap-1.5 border-b-2 transition-colors ${tab === id ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-[#777] hover:text-white'}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-5 md:p-6">
          {tab === 'details' && (
            <div className="space-y-6">
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-lg border border-[#252525] bg-[#0E0E0E] p-3"><div className="text-[9px] uppercase tracking-wider text-[#666]">Tiến độ</div><div className="text-xl text-[#D4AF37] mt-1 font-mono">{task.progressSummary}%</div></div>
                <div className="rounded-lg border border-[#252525] bg-[#0E0E0E] p-3"><div className="text-[9px] uppercase tracking-wider text-[#666]">Ưu tiên</div><div className="text-sm text-white mt-2">{task.priority}</div></div>
                <div className="rounded-lg border border-[#252525] bg-[#0E0E0E] p-3"><div className="text-[9px] uppercase tracking-wider text-[#666]">Người nhận</div><div className="text-sm text-white mt-2">{task.assigneeIds.length}</div></div>
                <div className="rounded-lg border border-[#252525] bg-[#0E0E0E] p-3"><div className="text-[9px] uppercase tracking-wider text-[#666]">Trạng thái</div><div className="text-sm text-white mt-2">{task.status}</div></div>
              </section>

              <section>
                <h3 className="text-xs uppercase tracking-wider text-[#777] mb-2">Mô tả công việc</h3>
                <div className="rounded-lg border border-[#252525] bg-[#0D0D0D] p-4 text-sm text-[#bbb] whitespace-pre-wrap leading-relaxed">{task.description || 'Không có mô tả.'}</div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs uppercase tracking-wider text-[#777]">Phân công & nghiệm thu</h3>
                  <span className="text-[10px] text-[#555]">Hoàn thành task chỉ khi các phần việc được nghiệm thu.</span>
                </div>
                <div className="space-y-2.5">
                  {assignments.map((assignment) => {
                    const member = dataService.getUserById(assignment.userId);
                    const mine = assignment.userId === currentUser.uid;
                    const busy = Boolean(actionBusy?.endsWith(assignment.userId));
                    return (
                      <div key={assignment.userId} className="rounded-lg border border-[#252525] bg-[#0D0D0D] p-3.5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {member?.photoURL ? <img src={member.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" /> : <div className="w-8 h-8 rounded-full bg-[#1D1D1D] grid place-items-center text-xs text-[#D4AF37]">{member?.displayName?.[0] || '?'}</div>}
                            <div className="min-w-0">
                              <div className="text-xs text-white font-medium truncate">{member?.displayName || assignment.userId}{mine ? ' · Bạn' : ''}</div>
                              <div className="text-[10px] text-[#777] mt-0.5">{assignmentLabel[assignment.status]} · {assignment.progress}%</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {mine && !['SUBMITTED', 'COMPLETED'].includes(assignment.status) && (
                              <input type="range" min={0} max={99} value={Math.min(99, assignment.progress)} onChange={(event) => updateMyProgress(assignment, Number(event.target.value))} className="w-24 accent-[#D4AF37]" title="Cập nhật tiến độ" />
                            )}
                            {mine && assignment.status !== 'SUBMITTED' && assignment.status !== 'COMPLETED' && assignment.status !== 'NEEDS_REVISION' && (
                              <button disabled={busy} onClick={() => handover(assignment)} className="px-2.5 py-1.5 rounded bg-[#D4AF37] text-black text-[10px] font-semibold">Bàn giao</button>
                            )}
                            {mine && assignment.status === 'NEEDS_REVISION' && (
                              <button disabled={busy} onClick={() => submitRevision(assignment)} className="px-2.5 py-1.5 rounded bg-amber-500 text-black text-[10px] font-semibold">Nộp lại</button>
                            )}
                            {canReview && assignment.status === 'SUBMITTED' && (
                              <>
                                <button disabled={busy} onClick={() => approve(assignment)} className="px-2.5 py-1.5 rounded bg-emerald-700 text-white text-[10px] font-semibold">Nghiệm thu</button>
                                <button disabled={busy} onClick={() => requestRevision(assignment)} className="px-2.5 py-1.5 rounded border border-amber-700/50 text-amber-300 text-[10px]">Yêu cầu sửa</button>
                              </>
                            )}
                            {canReview && assignment.status === 'COMPLETED' && (
                              <button disabled={busy} onClick={() => reopenAssignment(assignment)} className="px-2.5 py-1.5 rounded border border-[#333] text-[#aaa] text-[10px]">Mở lại</button>
                            )}
                            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />}
                          </div>
                        </div>
                        {assignment.revisionNote && <div className="mt-2 p-2 rounded bg-amber-950/20 border border-amber-900/30 text-[10px] text-amber-200">Yêu cầu sửa: {assignment.revisionNote}</div>}
                        {assignment.submissionNote && <div className="mt-2 text-[10px] text-[#777]">Ghi chú bàn giao: {assignment.submissionNote}</div>}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {tab === 'files' && (
            <div className="space-y-5">
              <div className="rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-white font-medium">Firebase Storage bảo mật theo dự án</div>
                  <div className="text-[10px] text-[#777] mt-1">Tệp tối đa 25 MB. Binary không còn lưu Base64 trong LocalStorage/Firestore.</div>
                </div>
                <div className="flex items-center gap-2">
                  {uploadProgress !== null && <span className="text-[10px] font-mono text-[#D4AF37]">{uploadProgress}%</span>}
                  <button disabled={uploadProgress !== null} onClick={() => inputRef.current?.click()} className="px-3 py-2 rounded bg-[#D4AF37] text-black text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                    {uploadProgress !== null ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Tải tệp lên
                  </button>
                  <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} />
                </div>
              </div>

              <div className="space-y-2">
                {files.length === 0 ? (
                  <div className="p-10 rounded-lg border border-dashed border-[#333] text-center text-xs text-[#666]"><Paperclip className="w-7 h-7 mx-auto mb-2 text-[#555]" />Chưa có tệp đính kèm.</div>
                ) : files.map((file) => {
                  const uploader = dataService.getUserById(file.uploadedBy);
                  const canRemove = Boolean(file.storagePath) && (currentUser.role === 'ADMIN' || file.uploadedBy === currentUser.uid || task.assignerId === currentUser.uid);
                  const busy = fileBusyId === file.fileId;
                  return (
                    <div key={file.fileId} className="rounded-lg border border-[#252525] bg-[#0D0D0D] p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded bg-[#171717] border border-[#2A2A2A] grid place-items-center text-[#D4AF37]"><FileText className="w-4 h-4" /></div>
                        <div className="min-w-0">
                          <div className="text-xs text-white truncate">{file.name}</div>
                          <div className="text-[9px] text-[#666] mt-0.5">{formatBytes(file.size)} · {uploader?.displayName || file.uploadedBy} · {file.storagePath ? 'Firebase Storage' : 'Legacy file'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button disabled={busy} onClick={() => void handleDownload(file)} className="p-2 rounded hover:bg-[#1A1A1A] text-[#999] hover:text-white" title="Tải xuống">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}</button>
                        {canRemove && <button disabled={busy} onClick={() => void handleRemoveFile(file)} className="p-2 rounded hover:bg-rose-950/40 text-[#777] hover:text-rose-400" title="Xóa tệp"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'chat' && (
            <div className="flex flex-col min-h-[420px]">
              {!writableChat && (
                <div className="mb-3 rounded border border-amber-800/40 bg-amber-950/20 p-3 text-[10px] text-amber-200 flex items-center gap-2"><AlertCircle className="w-4 h-4" />Quy tắc T+15: cuộc trao đổi đã chuyển sang chỉ đọc.</div>
              )}
              <div className="flex-1 space-y-3 mb-4">
                {messages.length === 0 ? <div className="text-center text-xs text-[#666] py-10">Chưa có trao đổi trong công việc này.</div> : messages.map((message) => {
                  const sender = dataService.getUserById(message.senderId);
                  const mine = message.senderId === currentUser.uid;
                  return (
                    <div key={message.messageId} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[78%] rounded-xl px-3 py-2 ${mine ? 'bg-[#D4AF37] text-black' : 'bg-[#161616] border border-[#292929] text-[#ddd]'}`}>
                        {!mine && <div className="text-[9px] font-semibold mb-1 opacity-70">{sender?.displayName || message.senderId}</div>}
                        <div className="text-xs whitespace-pre-wrap break-words">{message.text}</div>
                        <div className={`text-[8px] mt-1 ${mine ? 'text-black/60' : 'text-[#666]'}`}>{formatVietnamDateTime(message.createdAt)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={sendMessage} className="sticky bottom-0 bg-[#090909] pt-3 border-t border-[#202020] flex gap-2">
                <input disabled={!writableChat} value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder={writableChat ? `Trao đổi với ${participantIds.length} thành viên...` : 'Cuộc trao đổi chỉ đọc'} className="flex-1 px-3 py-2.5 rounded-lg bg-[#111] border border-[#292929] text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#D4AF37] disabled:opacity-50" />
                <button disabled={!writableChat || !chatInput.trim()} className="px-3.5 rounded-lg bg-[#D4AF37] text-black disabled:opacity-40"><Send className="w-4 h-4" /></button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
