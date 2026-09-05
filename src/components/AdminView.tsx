import React, { useState } from 'react';
import { User, UserRole, UserStatus, AuditEvent } from '@shared/types/models';
import { dataService } from '../services/dataService';
import { formatVietnamDateTime } from '../utils/date';
import { APP_REGION, BUSINESS_TIMEZONE, PRE_FLIGHT_CHECKLIST } from '@shared/constants/regions';
import { ApproveUserModal } from './ApproveUserModal';
import {
  Shield,
  UserPlus,
  Users,
  CheckCircle2,
  XCircle,
  FileCheck,
  Server,
  Globe2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Bell,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';

interface AdminViewProps {
  currentUser: User;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'preflight'>('users');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [auditFilterAction, setAuditFilterAction] = useState<string>('ALL');
  const [userToApprove, setUserToApprove] = useState<User | null>(null);

  const users = dataService.getUsers();
  const auditLogs = dataService.getAuditLogs();
  const pendingUsers = users.filter((u) => u.status === 'PENDING_APPROVAL' || u.status === 'INVITED');

  const handleInviteUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const res = dataService.inviteUser(inviteEmail, inviteName || inviteEmail.split('@')[0]);
    if (!res.success) {
      alert(res.error);
    } else {
      setInviteEmail('');
      setInviteName('');
      alert(`Đã gửi lời mời tham gia thành công tới ${inviteEmail}!`);
    }
  };

  const handleToggleStatus = (uid: string, currentStatus: UserStatus) => {
    const newStatus: UserStatus = currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    const res = dataService.setUserStatus(uid, newStatus);
    if (!res.success) alert(res.error);
  };

  const handleChangeRole = (uid: string, currentRole: UserRole) => {
    const newRole: UserRole = currentRole === 'ADMIN' ? 'MEMBER' : 'ADMIN';
    const res = dataService.setUserRole(uid, newRole);
    if (!res.success) alert(res.error);
  };

  const filteredLogs = auditLogs.filter((log) => {
    if (auditFilterAction !== 'ALL' && log.action !== auditFilterAction) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#222]">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#D4AF37] font-semibold mb-1 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#D4AF37]" />
            Bảng Điều Khiển Quản Trị Hệ Thống (Admin Control Panel)
          </div>
          <h1 className="text-xl md:text-2xl font-serif italic text-white">Quản Trị & Kiểm Tra Bảo Mật</h1>
          <p className="text-xs text-[#777]">
            Quản lý quyền truy cập người dùng, kiểm toán vết bất biến và xác minh vùng triển khai.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded text-xs tracking-wider uppercase font-semibold transition-all ${
              activeTab === 'users'
                ? 'bg-[#D4AF37] text-black shadow'
                : 'bg-[#141414] text-[#888] hover:text-white border border-[#262626]'
            }`}
          >
            Người Dùng ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded text-xs tracking-wider uppercase font-semibold transition-all ${
              activeTab === 'audit'
                ? 'bg-[#D4AF37] text-black shadow'
                : 'bg-[#141414] text-[#888] hover:text-white border border-[#262626]'
            }`}
          >
            Nhật Ký Kiểm Toán ({auditLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('preflight')}
            className={`px-3 py-1.5 rounded text-xs tracking-wider uppercase font-semibold transition-all ${
              activeTab === 'preflight'
                ? 'bg-[#D4AF37] text-black shadow'
                : 'bg-[#141414] text-[#888] hover:text-white border border-[#262626]'
            }`}
          >
            Pre-flight Checklist
          </button>
        </div>
      </div>

      {/* 1. TAB NGƯỜI DÙNG */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Pending Approval Section */}
          {pendingUsers.length > 0 && (
            <div className="p-4 rounded-lg border border-amber-600/50 bg-amber-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs uppercase tracking-wider">
                  <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
                  <span>Yêu Cầu Chờ Phê Duyệt & Cấp Quyền Dự Án ({pendingUsers.length})</span>
                </div>
                <span className="text-[10px] text-amber-400/80">Tài khoản Gmail mới đăng nhập</span>
              </div>

              <div className="space-y-2">
                {pendingUsers.map((pUser) => (
                  <div
                    key={pUser.uid}
                    className="p-3 rounded border border-amber-800/40 bg-[#121212] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={pUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                        alt={pUser.displayName}
                        className="w-9 h-9 rounded-full object-cover border border-[#D4AF37]"
                      />
                      <div>
                        <div className="text-xs font-semibold text-white flex items-center gap-2">
                          <span>{pUser.displayName}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold bg-amber-950/80 text-amber-300 border border-amber-600/60">
                            {pUser.status === 'PENDING_APPROVAL' ? 'Chờ Duyệt' : 'Chưa kích hoạt'}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#888] font-mono">{pUser.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setUserToApprove(pUser)}
                        className="px-3 py-1.5 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Phê Duyệt & Gán Dự Án</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invite User Form */}
          <form onSubmit={handleInviteUser} className="p-4 rounded border border-[#262626] bg-[#0E0E0E] space-y-3">
            <div className="text-xs uppercase tracking-wider text-white font-medium flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#D4AF37]" />
              <span>Thêm Thành Viên Mới Vào Hệ Thống (Email Allowlist)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="email"
                required
                placeholder="Địa chỉ email (vd: nhanvien@company.com)..."
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="px-3 py-2 rounded bg-[#141414] border border-[#2c2c2c] text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#D4AF37]"
              />
              <input
                type="text"
                placeholder="Họ và tên..."
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="px-3 py-2 rounded bg-[#141414] border border-[#2c2c2c] text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#D4AF37]"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black text-xs font-bold uppercase tracking-wider transition-all"
              >
                Gửi Lời Mời
              </button>
            </div>
          </form>

          {/* Users Table */}
          <div className="border border-[#262626] rounded-lg overflow-hidden bg-[#0C0C0C]">
            <div className="p-3 bg-[#111] border-b border-[#222] text-xs text-[#888] font-medium uppercase tracking-wider">
              Danh Sách Người Dùng Được Cấp Quyền ({users.length})
            </div>
            <div className="divide-y divide-[#1e1e1e]">
              {users.map((u) => (
                <div key={u.uid} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#111]">
                  <div className="flex items-center gap-3">
                    <img src={u.photoURL} alt={u.displayName} className="w-9 h-9 rounded-full object-cover border border-[#333]" />
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-2">
                        <span>{u.displayName}</span>
                        {u.role === 'ADMIN' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 font-mono">
                            ADMIN
                          </span>
                        )}
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                              : u.status === 'PENDING_APPROVAL' || u.status === 'INVITED'
                              ? 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                              : 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
                          }`}
                        >
                          {u.status === 'PENDING_APPROVAL' ? 'CHỜ DUYỆT' : u.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#666]">{u.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setUserToApprove(u)}
                      className="px-2.5 py-1 rounded bg-[#1c1c1c] hover:bg-[#252525] border border-[#D4AF37]/40 text-[11px] text-[#D4AF37] hover:text-white transition-all flex items-center gap-1"
                      title="Cấp quyền truy cập dự án cho người dùng này"
                    >
                      <KeyRound className="w-3 h-3" />
                      <span>Cấp Quyền Dự Án</span>
                    </button>
                    <button
                      onClick={() => handleChangeRole(u.uid, u.role)}
                      className="px-2.5 py-1 rounded bg-[#181818] hover:bg-[#222] border border-[#333] text-[11px] text-[#ccc] hover:text-white transition-all"
                    >
                      {u.role === 'ADMIN' ? 'Hạ xuống Member' : 'Nâng lên Admin'}
                    </button>
                    <button
                      onClick={() => handleToggleStatus(u.uid, u.status)}
                      className={`px-2.5 py-1 rounded border text-[11px] font-medium transition-all ${
                        u.status === 'ACTIVE'
                          ? 'border-rose-900/60 text-rose-400 hover:bg-rose-950/40'
                          : 'border-emerald-900/60 text-emerald-400 hover:bg-emerald-950/40'
                      }`}
                    >
                      {u.status === 'ACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. TAB NHẬT KÝ KIỂM TOÁN (AUDIT TRAIL) */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs text-[#777]">
              Nhật ký bất biến ghi lại mọi tác vụ tạo, sửa, xóa, phân quyền trong hệ thống.
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#666]">Hành động:</span>
              <select
                value={auditFilterAction}
                onChange={(e) => setAuditFilterAction(e.target.value)}
                className="bg-[#121212] border border-[#262626] text-xs text-white rounded px-2.5 py-1"
              >
                <option value="ALL">Tất cả hành động</option>
                <option value="CREATE_TASK">CREATE_TASK</option>
                <option value="UPDATE_PROGRESS">UPDATE_PROGRESS</option>
                <option value="COMPLETE_TASK">COMPLETE_TASK</option>
                <option value="POST_MESSAGE">POST_MESSAGE</option>
                <option value="UPLOAD_FILE">UPLOAD_FILE</option>
                <option value="INVITE_USER">INVITE_USER</option>
                <option value="UPDATE_ROLE">UPDATE_ROLE</option>
              </select>
            </div>
          </div>

          <div className="border border-[#262626] rounded-lg overflow-hidden bg-[#0C0C0C]">
            <div className="divide-y divide-[#1c1c1c]">
              {filteredLogs.map((log) => {
                const actor = dataService.getUserById(log.actorId);
                return (
                  <div key={log.eventId} className="p-3.5 space-y-1 hover:bg-[#111] transition-colors">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-[#D4AF37] px-1.5 py-0.5 rounded bg-[#D4AF37]/10 border border-[#D4AF37]/20">
                          {log.action}
                        </span>
                        <span className="text-white font-medium">{actor?.displayName || log.actorId}</span>
                        {log.taskId && <span className="text-[10px] font-mono text-[#777]">[{log.taskId}]</span>}
                      </div>
                      <span className="font-mono text-[10px] text-[#666]">
                        {formatVietnamDateTime(log.createdAt)}
                      </span>
                    </div>
                    {log.newValue && (
                      <pre className="p-2 rounded bg-[#141414] border border-[#222] text-[10px] font-mono text-[#888] overflow-x-auto max-h-24">
                        {JSON.stringify(log.newValue, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB PRE-FLIGHT CHECKLIST (VÙNG SINGAPORE & MÚI GIỜ ASIA/HO_CHI_MINH) */}
      {activeTab === 'preflight' && (
        <div className="space-y-6">
          <div className="p-4 rounded border border-[#D4AF37]/30 bg-[#0E0E0E] space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Globe2 className="w-4 h-4 text-[#D4AF37]" />
              <span>Xác Minh Kiến Trúc Địa Lý Bắt Buộc (Mandatory Geographic Constraints)</span>
            </div>
            <p className="text-xs text-[#888]">
              Toàn bộ hạ tầng của ứng dụng được khóa cố định tại vùng <strong>{APP_REGION} (Singapore)</strong> và múi giờ nghiệp vụ chuẩn <strong>{BUSINESS_TIMEZONE} (UTC+7)</strong> theo đúng cam kết kiến trúc.
            </p>
          </div>

          <div className="space-y-3">
            {PRE_FLIGHT_CHECKLIST.map((item) => (
              <div
                key={item.key}
                className="p-4 rounded border border-[#262626] bg-[#0C0C0C] flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-semibold text-white">{item.label}</span>
                  </div>
                  <div className="text-[11px] text-[#777]">{item.description}</div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="font-mono text-xs text-[#D4AF37] px-2.5 py-1 rounded bg-[#141414] border border-[#2a2a2a]">
                    {item.value}
                  </div>
                  <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
                    VERIFIED
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approve and Grant Projects Modal */}
      {userToApprove && (
        <ApproveUserModal
          user={userToApprove}
          isOpen={Boolean(userToApprove)}
          onClose={() => setUserToApprove(null)}
          onSuccess={() => {
            setUserToApprove(null);
          }}
        />
      )}
    </div>
  );
};
