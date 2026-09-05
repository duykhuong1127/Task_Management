import React, { useState } from 'react';
import { Project, User } from '@shared/types/models';
import { dataService } from '../services/dataService';
import { Users, UserPlus, Trash2, Shield, CheckCircle2, X, AlertCircle } from 'lucide-react';

interface ManageProjectMembersModalProps {
  project: Project;
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export const ManageProjectMembersModal: React.FC<ManageProjectMembersModalProps> = ({
  project,
  currentUser,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'MEMBER' | 'OWNER'>('MEMBER');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const allUsers = dataService.getUsers();
  // Only active users can be added
  const activeUsers = allUsers.filter((u) => u.status === 'ACTIVE');
  const currentMemberIds = Object.keys(project.members || {});
  const availableUsers = activeUsers.filter((u) => !currentMemberIds.includes(u.uid));

  const isAuthorized = currentUser.role === 'ADMIN' || project.ownerId === currentUser.uid;

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setError(null);

    const res = dataService.addMemberToProject(project.projectId, selectedUserId, selectedRole);
    if (!res.success) {
      setError(res.error || 'Không thể thêm thành viên.');
    } else {
      setSelectedUserId('');
      onUpdated();
    }
  };

  const handleRemoveMember = (userId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa thành viên này khỏi dự án?')) return;
    setError(null);

    const res = dataService.removeMemberFromProject(project.projectId, userId);
    if (!res.success) {
      setError(res.error || 'Không thể xóa thành viên.');
    } else {
      onUpdated();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-[#0E0E0E] border border-[#333] rounded-lg shadow-2xl p-6 text-[#D1D1D1] space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#222]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-serif font-semibold text-white">
                Quản Lý Quyền Truy Cập Dự Án
              </h2>
              <div className="text-[11px] text-[#D4AF37] font-medium">{project.name}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Add Member Form (Admin / Project Owner only) */}
        {isAuthorized ? (
          <form onSubmit={handleAddMember} className="p-3.5 rounded border border-[#262626] bg-[#141414] space-y-3">
            <div className="text-xs uppercase tracking-wider text-white font-medium flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Cấp Quyền Tham Gia Cho Thành Viên Đã Phê Duyệt</span>
            </div>

            {availableUsers.length === 0 ? (
              <div className="text-xs text-[#777] italic py-1">
                Tất cả thành viên đã kích hoạt đều đã có mặt trong dự án này, hoặc chưa có thêm tài khoản Gmail nào được duyệt.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-[#1a1a1a] border border-[#333] rounded text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="">-- Chọn thành viên Gmail --</option>
                  {availableUsers.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName} ({u.email})
                    </option>
                  ))}
                </select>

                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as any)}
                  className="px-3 py-2 text-xs bg-[#1a1a1a] border border-[#333] rounded text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="MEMBER">Thành viên</option>
                  <option value="OWNER">Quản lý dự án</option>
                </select>

                <button
                  type="submit"
                  disabled={!selectedUserId}
                  className="px-4 py-2 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black text-xs font-bold uppercase tracking-wider disabled:opacity-40 transition-all shrink-0"
                >
                  Cấp Quyền
                </button>
              </div>
            )}
          </form>
        ) : (
          <div className="p-3 rounded bg-[#141414] border border-[#222] text-xs text-[#888]">
            Chỉ Quản trị viên (Admin) hoặc Trưởng dự án mới có quyền thêm/xóa thành viên.
          </div>
        )}

        {/* Current Members List */}
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-[#888] font-semibold flex items-center justify-between">
            <span>Danh sách thành viên hiện tại ({currentMemberIds.length})</span>
            <span className="text-[10px] text-[#666]">Được phép xem & thực hiện công việc</span>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {currentMemberIds.map((mId) => {
              const u = dataService.getUserById(mId);
              const memberMeta = project.members ? project.members[mId] : undefined;
              const isOwner = project.ownerId === mId || memberMeta?.projectRole === 'OWNER';

              return (
                <div
                  key={mId}
                  className="p-3 rounded border border-[#222] bg-[#121212] flex items-center justify-between gap-3 hover:border-[#333]"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <img
                      src={u?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                      alt={u?.displayName || mId}
                      className="w-8 h-8 rounded-full object-cover border border-[#D4AF37]/30 shrink-0"
                    />
                    <div className="truncate text-xs">
                      <div className="font-medium text-white flex items-center gap-1.5 truncate">
                        <span className="truncate">{u?.displayName || mId}</span>
                        {isOwner && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 font-mono shrink-0">
                            TRƯỞNG DỰ ÁN
                          </span>
                        )}
                        {u?.role === 'ADMIN' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-300 font-mono shrink-0">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#666] truncate font-mono">{u?.email}</div>
                    </div>
                  </div>

                  {isAuthorized && !isOwner && (
                    <button
                      onClick={() => handleRemoveMember(mId)}
                      className="p-1.5 rounded hover:bg-rose-950/40 text-[#666] hover:text-rose-400 border border-transparent hover:border-rose-800/40 transition-all shrink-0"
                      title="Thu hồi quyền truy cập khỏi dự án"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#222] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-[#1c1c1c] hover:bg-[#262626] border border-[#333] text-xs text-white font-medium"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
