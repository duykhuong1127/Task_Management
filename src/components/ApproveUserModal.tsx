import React, { useState } from 'react';
import { User, Project, UserRole } from '@shared/types/models';
import { dataService } from '../services/dataService';
import { ShieldCheck, FolderKanban, Check, X, AlertCircle } from 'lucide-react';

interface ApproveUserModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ApproveUserModal: React.FC<ApproveUserModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const allProjects = dataService.getProjects();
  // Fetch projects without role restriction for Admin
  const adminProjects = (dataService as any).projects.filter((p: Project) => !p.deleted);
  const projects: Project[] = adminProjects.length > 0 ? adminProjects : allProjects;

  const [selectedRole, setSelectedRole] = useState<UserRole>('MEMBER');
  const [userName, setUserName] = useState<string>(user.displayName || user.email.split('@')[0]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    projects.map((p) => p.projectId) // Default to all active projects for convenience
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleProject = (projectId: string) => {
    if (selectedProjectIds.includes(projectId)) {
      setSelectedProjectIds(selectedProjectIds.filter((id) => id !== projectId));
    } else {
      setSelectedProjectIds([...selectedProjectIds, projectId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedProjectIds.length === projects.length) {
      setSelectedProjectIds([]);
    } else {
      setSelectedProjectIds(projects.map((p) => p.projectId));
    }
  };

  const handleApprove = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = dataService.approveUserAndGrantProjects(
      user.uid,
      selectedProjectIds,
      selectedRole,
      userName.trim()
    );

    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Có lỗi xảy ra khi phê duyệt.');
    } else {
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-[#0E0E0E] border border-[#333] rounded-lg shadow-2xl p-6 text-[#D1D1D1] space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#222]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-amber-500/20 text-[#D4AF37] border border-[#D4AF37]/40">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-serif font-semibold text-white">
                Phê Duyệt & Cấp Quyền Truy Cập Dự Án
              </h2>
              <p className="text-[11px] text-[#888]">
                Xem xét tài khoản Gmail và chỉ định các không gian dự án được phép xem
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-3.5 rounded border border-[#222] bg-[#141414] flex items-center gap-3">
          <img
            src={user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
            alt={user.displayName}
            className="w-11 h-11 rounded-full object-cover border border-[#D4AF37]/50 shrink-0"
          />
          <div className="overflow-hidden">
            <div className="font-semibold text-white text-xs sm:text-sm">{user.displayName}</div>
            <div className="text-xs font-mono text-[#D4AF37] truncate">{user.email}</div>
            <div className="text-[10px] text-[#666] mt-0.5">
              Đăng nhập lúc: {new Date(user.createdAt).toLocaleString('vi-VN')}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleApprove} className="space-y-4">
          {/* Member Name Input (Admin sets name) */}
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-[#888] font-medium">
              1. Họ và Tên Thành Viên (Admin Đặt Tên) *
            </label>
            <input
              type="text"
              required
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Nhập họ và tên thành viên..."
              className="w-full px-3 py-2 text-xs bg-[#161616] border border-[#333] rounded text-white focus:border-[#D4AF37] focus:outline-none"
            />
          </div>

          {/* Role Selection */}
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-[#888] font-medium">
              2. Phân Quyền Vai Trò Hệ Thống *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`p-3 rounded border cursor-pointer text-xs flex items-center justify-between transition-all ${
                  selectedRole === 'MEMBER'
                    ? 'border-[#D4AF37] bg-[#191919] text-white'
                    : 'border-[#262626] bg-[#121212] text-[#888]'
                }`}
              >
                <div>
                  <div className="font-semibold text-white">Thành Viên (Member)</div>
                  <div className="text-[10px] text-[#666]">Chỉ xem và làm việc trong các dự án được gán</div>
                </div>
                <input
                  type="radio"
                  name="role"
                  value="MEMBER"
                  checked={selectedRole === 'MEMBER'}
                  onChange={() => setSelectedRole('MEMBER')}
                  className="hidden"
                />
                {selectedRole === 'MEMBER' && <Check className="w-4 h-4 text-[#D4AF37]" />}
              </label>

              <label
                className={`p-3 rounded border cursor-pointer text-xs flex items-center justify-between transition-all ${
                  selectedRole === 'ADMIN'
                    ? 'border-[#D4AF37] bg-[#191919] text-white'
                    : 'border-[#262626] bg-[#121212] text-[#888]'
                }`}
              >
                <div>
                  <div className="font-semibold text-white">Quản Trị Viên (Admin)</div>
                  <div className="text-[10px] text-[#666]">Toàn quyền phê duyệt và quản lý toàn bộ hệ thống</div>
                </div>
                <input
                  type="radio"
                  name="role"
                  value="ADMIN"
                  checked={selectedRole === 'ADMIN'}
                  onChange={() => setSelectedRole('ADMIN')}
                  className="hidden"
                />
                {selectedRole === 'ADMIN' && <Check className="w-4 h-4 text-[#D4AF37]" />}
              </label>
            </div>
          </div>

          {/* Project Access Checkboxes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wider text-[#888] font-medium flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>2. Chọn Dự Án Cấp Quyền Truy Cập ({selectedProjectIds.length}/{projects.length})</span>
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-[#D4AF37] hover:underline"
              >
                {selectedProjectIds.length === projects.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả dự án'}
              </button>
            </div>

            <div className="max-h-44 overflow-y-auto space-y-1.5 border border-[#222] rounded-lg p-2 bg-[#121212]">
              {projects.map((proj) => {
                const isSelected = selectedProjectIds.includes(proj.projectId);
                return (
                  <label
                    key={proj.projectId}
                    className={`p-2.5 rounded border flex items-center justify-between text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-[#D4AF37]/50 bg-[#1c1c1c] text-white'
                        : 'border-[#222] hover:bg-[#161616] text-[#888]'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-medium text-white truncate">{proj.name}</div>
                      <div className="text-[10px] text-[#666] truncate">{proj.description || 'Dự án nội bộ'}</div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                        isSelected ? 'bg-[#D4AF37] border-[#D4AF37] text-black' : 'border-[#444]'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-3 border-t border-[#222] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-[#181818] hover:bg-[#222] border border-[#333] text-xs text-[#aaa] hover:text-white"
            >
              Hủy
            </button>
            <button
              id="btn-confirm-approve-user"
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black text-xs font-bold uppercase tracking-wider transition-all shadow disabled:opacity-50"
            >
              {loading ? 'Đang kích hoạt...' : 'Kích Hoạt & Cấp Quyền Ngay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
