import React, { useState } from 'react';
import { User } from '@shared/types/models';
import { dataService } from '../services/dataService';
import { APP_REGION, BUSINESS_TIMEZONE } from '@shared/constants/regions';
import { Bell, ShieldCheck, UserCheck, ChevronDown, CheckCircle2, AlertTriangle, Sparkles, LogIn, LogOut } from 'lucide-react';
import { PhongPhuLogo } from './PhongPhuLogo';

interface HeaderProps {
  currentUser: User;
  onOpenNotifications: () => void;
  onOpenAdmin: () => void;
  onOpenLoginModal: () => void;
  unreadCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenNotifications,
  onOpenAdmin,
  onOpenLoginModal,
  unreadCount,
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const users = dataService.getUsers();

  const handleSwitchUser = (uid: string) => {
    dataService.setCurrentUser(uid);
    setShowUserDropdown(false);
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-4 md:px-8 border-b border-[#222] bg-[#0A0A0A]/95 backdrop-blur-md">
      {/* Brand & Identity */}
      <div className="flex items-center space-x-3 md:space-x-5">
        <div className="flex items-center space-x-3">
          <PhongPhuLogo size="md" className="h-9 sm:h-10 shrink-0" />
          <div className="flex flex-col justify-center">
            <div className="text-white font-bold text-sm sm:text-base md:text-lg tracking-tight leading-tight flex items-center gap-1.5">
              <span>Quản lý Công việc</span>
              <span className="text-[9px] uppercase font-sans tracking-wider px-1.5 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 hidden sm:inline-block">
                PWA
              </span>
            </div>
            <div className="text-[10px] sm:text-[11px] md:text-xs font-semibold text-[#D4AF37] tracking-normal leading-tight">
              CTY CP Dệt Gia Dụng Phong Phú
            </div>
          </div>
        </div>

        {/* Region & Timezone Tag (Non-negotiable lock) */}
        <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-[#222] text-[10px] font-mono text-[#888]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
          <span>{APP_REGION} (Singapore)</span>
          <span className="text-[#444]">|</span>
          <span className="text-[#D4AF37]">{BUSINESS_TIMEZONE}</span>
        </div>
      </div>

      {/* Actions & Persona Selector */}
      <div className="flex items-center space-x-2 md:space-x-4">
        {/* Scheduled Reminders Quick Button */}
        <button
          id="btn-run-reminders-header"
          onClick={() => {
            const res = dataService.triggerScheduledReminders('0800');
            alert(`Đã kiểm tra lịch nhắc việc (08:00 / 13:00) múi giờ Asia/Ho_Chi_Minh.\nSố thông báo mới gửi: ${res.dispatchedCount}`);
          }}
          className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#161616] hover:bg-[#202020] border border-[#333] text-[#bbb] hover:text-[#D4AF37] text-[11px] tracking-wide transition-all"
          title="Chạy kiểm tra nhắc hạn 08:00 & 13:00"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>Cron 08:00 / 13:00</span>
        </button>

        {/* Notification Bell */}
        <button
          id="btn-header-notifications"
          onClick={onOpenNotifications}
          className="relative p-2 rounded hover:bg-[#161616] text-[#888] hover:text-white transition-colors"
          title="Thông báo hệ thống"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-[#D4AF37] text-black">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Admin Link if role === 'ADMIN' */}
        {currentUser.role === 'ADMIN' && (
          <button
            id="btn-header-admin"
            onClick={onOpenAdmin}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#161616] hover:bg-[#222] border border-[#D4AF37]/30 text-[#D4AF37] text-xs uppercase tracking-wider font-medium transition-all"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Quản Trị</span>
          </button>
        )}

        {/* Google / Gmail Sign In Trigger */}
        <button
          id="btn-header-google-signin"
          onClick={onOpenLoginModal}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded bg-white hover:bg-neutral-200 text-black text-xs font-semibold tracking-wide transition-all shadow-sm"
          title="Đăng nhập tài khoản Google / Gmail"
        >
          {/* Google SVG Icon */}
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span className="hidden sm:inline">Đăng Nhập Gmail</span>
          <span className="sm:hidden">Gmail</span>
        </button>

        {/* Active Persona Switcher */}
        <div className="relative">
          <button
            id="btn-user-switcher"
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 p-1.5 rounded border border-[#222] bg-[#111] hover:border-[#D4AF37]/40 transition-all text-left"
          >
            <img
              src={currentUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={currentUser.displayName}
              className="w-7 h-7 rounded-full object-cover border border-[#D4AF37]/50"
            />
            <div className="hidden sm:block text-left pr-1">
              <div className="text-xs font-medium text-white flex items-center gap-1">
                <span className="max-w-[120px] truncate">{currentUser.displayName}</span>
                {currentUser.role === 'ADMIN' && (
                  <span className="text-[9px] px-1 rounded bg-[#D4AF37]/20 text-[#D4AF37] font-mono">
                    ADMIN
                  </span>
                )}
              </div>
              <div className="text-[10px] text-[#666] truncate max-w-[120px]">{currentUser.email}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#666]" />
          </button>

          {/* Persona switch dropdown for Acceptance Testing */}
          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-72 bg-[#0E0E0E] border border-[#333] rounded-md shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-1">
              <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-[#D4AF37] border-b border-[#222] font-semibold flex items-center justify-between">
                <span>Chuyển Đổi Tài Khoản (Audit Demo)</span>
                <UserCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
              </div>
              <div className="py-1 max-h-64 overflow-y-auto space-y-1">
                {users.map((u) => {
                  const isCurrent = u.uid === currentUser.uid;
                  return (
                    <button
                      key={u.uid}
                      onClick={() => handleSwitchUser(u.uid)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded text-left transition-colors ${
                        isCurrent ? 'bg-[#1c1c1c] border border-[#D4AF37]/30 text-white' : 'hover:bg-[#161616] text-[#999] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <img src={u.photoURL} alt={u.displayName} className="w-6 h-6 rounded-full object-cover shrink-0" />
                        <div className="truncate text-xs">
                          <div className="font-medium text-white flex items-center gap-1">
                            {u.displayName}
                            {u.role === 'ADMIN' && <span className="text-[9px] text-[#D4AF37]">[Admin]</span>}
                            {u.status === 'DISABLED' && <span className="text-[9px] text-rose-400">[Vô hiệu]</span>}
                            {u.status === 'INVITED' && <span className="text-[9px] text-amber-400">[Chưa kích hoạt]</span>}
                          </div>
                          <div className="text-[10px] text-[#555] truncate">{u.email}</div>
                        </div>
                      </div>
                      {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <div className="pt-2 border-t border-[#222] space-y-1">
                <button
                  id="btn-switch-gmail-dropdown"
                  onClick={() => {
                    setShowUserDropdown(false);
                    onOpenLoginModal();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded bg-[#181818] hover:bg-[#222] border border-[#333] text-left text-xs text-[#D4AF37] font-medium transition-all"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Đăng Nhập Bằng Gmail Khác...</span>
                </button>
                <button
                  id="btn-header-logout"
                  onClick={() => {
                    setShowUserDropdown(false);
                    dataService.logout();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded bg-rose-950/20 hover:bg-rose-950/40 border border-rose-800/40 text-left text-xs text-rose-300 font-medium transition-all"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span>Đăng Xuất Khỏi Hệ Thống</span>
                </button>
              </div>
              <div className="mt-2 pt-2 border-t border-[#222] flex items-center justify-between px-1">
                <button
                  onClick={() => {
                    dataService.resetToSeed();
                    setShowUserDropdown(false);
                  }}
                  className="text-[10px] text-[#888] hover:text-[#D4AF37] transition-colors"
                >
                  Khôi phục dữ liệu mẫu
                </button>
                <button
                  onClick={() => {
                    onOpenAdmin();
                    setShowUserDropdown(false);
                  }}
                  className="text-[10px] text-[#D4AF37] hover:underline"
                >
                  Mở Quản Trị
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
