import React, { useState } from 'react';
import { User } from '@shared/types/models';
import { dataService } from '../services/dataService';
import { PhongPhuLogo } from './PhongPhuLogo';
import { ShieldAlert, RefreshCw, LogOut, ShieldCheck, CheckCircle2, UserCheck, AlertTriangle } from 'lucide-react';

interface PendingApprovalViewProps {
  currentUser: User;
  onOpenLoginModal: () => void;
  onRefresh: () => void;
}

export const PendingApprovalView: React.FC<PendingApprovalViewProps> = ({
  currentUser,
  onOpenLoginModal,
  onRefresh,
}) => {
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  const handleCheckStatus = () => {
    setChecking(true);
    setCheckMessage(null);
    setTimeout(() => {
      const refreshed = dataService.getUserById(currentUser.uid);
      if (refreshed && refreshed.status === 'ACTIVE') {
        setCheckMessage('Tài khoản đã được Quản trị viên kích hoạt! Đang tải dữ liệu...');
        onRefresh();
      } else {
        setCheckMessage('Tài khoản vẫn đang trong danh sách chờ duyệt từ Quản trị viên.');
      }
      setChecking(false);
    }, 400);
  };

  const handleSwitchToAdminForTesting = () => {
    dataService.setCurrentUser('user_admin');
    onRefresh();
  };

  const isPending = currentUser.status === 'PENDING_APPROVAL' || currentUser.status === 'INVITED';
  const isDisabled = currentUser.status === 'DISABLED';

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 text-center max-w-xl mx-auto animate-in fade-in">
      <div className="w-full bg-[#0E0E0E] border border-[#2E2E2E] rounded-xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
        {/* Accent top line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-600 via-[#D4AF37] to-amber-600"></div>

        {/* Company Header */}
        <div className="flex justify-center mb-5">
          <PhongPhuLogo size="lg" className="h-14" />
        </div>

        {/* User Profile Avatar & Badge */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <img
              src={currentUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
              alt={currentUser.displayName}
              className="w-16 h-16 rounded-full object-cover border-2 border-[#D4AF37]/60 shadow-lg"
            />
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black p-1 rounded-full">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white mt-3">{currentUser.displayName}</h2>
          <div className="text-xs font-mono text-[#D4AF37] mt-0.5">{currentUser.email}</div>

          {/* Status Badge */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-950/80 border border-amber-500/70 text-amber-300 text-xs font-bold tracking-wide shadow-md">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span>
              {isDisabled
                ? 'TÀI KHOẢN ĐÃ BỊ VÔ HIỆU HÓA'
                : 'Vui lòng chờ admin xét duyệt tài khoản'}
            </span>
          </div>
        </div>

        {/* Notice Box */}
        <div className="bg-[#141414] border-2 border-amber-600/40 rounded-lg p-5 text-left text-xs space-y-3 text-[#C5C5C5] mb-6">
          <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <span>Vui lòng chờ admin xét duyệt tài khoản</span>
          </div>
          <p className="leading-relaxed">
            Bạn đã đăng ký / đăng nhập bằng tài khoản Gmail <strong>{currentUser.email}</strong>.
          </p>
          <p className="leading-relaxed">
            Theo chính sách bảo mật nội bộ của <strong>CTY CP Dệt Gia Dụng Phong Phú</strong>, tài khoản của thành viên mới bắt buộc phải được <strong>Quản trị viên (Admin) phê duyệt</strong> và cấp quyền tham gia các dự án trước khi có thể đăng nhập vào hệ thống.
          </p>
          <div className="p-3 rounded bg-[#0A0A0A] border border-[#222] text-[11.5px] text-[#D4AF37]">
            ⏳ Trạng thái hiện tại: <strong>Đang chờ Admin xét duyệt</strong>. Vui lòng kiểm tra lại sau hoặc liên hệ Quản trị viên để được kích hoạt.
          </div>
        </div>

        {/* Status Check Feedback */}
        {checkMessage && (
          <div className="mb-5 p-3 rounded bg-[#181818] border border-[#333] text-xs text-[#D4AF37] flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{checkMessage}</span>
          </div>
        )}

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
          <button
            id="btn-refresh-approval-status"
            onClick={handleCheckStatus}
            disabled={checking}
            className="flex-1 py-2.5 px-4 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Đang kiểm tra...' : 'Kiểm tra trạng thái duyệt'}</span>
          </button>

          <button
            id="btn-switch-account-pending"
            onClick={onOpenLoginModal}
            className="py-2.5 px-4 rounded bg-[#1C1C1C] hover:bg-[#252525] border border-[#333] text-white font-medium text-xs transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4 text-[#888]" />
            <span>Đổi tài khoản Gmail</span>
          </button>
        </div>

        {/* Fast-Track Testing Card */}
        <div className="pt-4 border-t border-[#222]">
          <div className="text-[11px] text-[#777] mb-2 flex items-center justify-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Dành cho người kiểm thử & demo tính năng:</span>
          </div>
          <button
            id="btn-switch-to-admin-testing"
            onClick={handleSwitchToAdminForTesting}
            className="w-full py-2 px-3 rounded bg-amber-950/30 hover:bg-amber-950/60 border border-amber-800/40 text-amber-200 hover:text-amber-100 text-xs font-medium transition-all flex items-center justify-center gap-2"
          >
            <UserCheck className="w-4 h-4 text-[#D4AF37]" />
            <span>Chuyển sang tài khoản Quản Trị Viên (Admin) để duyệt ngay cho tài khoản này</span>
          </button>
        </div>
      </div>
    </div>
  );
};
