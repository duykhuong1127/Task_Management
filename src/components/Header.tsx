import React, { useState } from 'react';
import { User } from '@shared/types/models';
import { dataService } from '../services/dataService';
import { Bell, ShieldCheck, UserCheck, ChevronDown, CheckCircle2, LogIn, LogOut, KeyRound } from 'lucide-react';
import { PhongPhuLogo } from './PhongPhuLogo';
import { ChangePasswordModal } from './ChangePasswordModal';

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
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
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
      </div>

      {/* Actions & Persona Selector */}
      <div className="flex items-center space-x-2 md:space-x-4">
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
                  id="btn-header-change-password"
                  onClick={() => {
                    setShowUserDropdown(false);
                    setShowChangePasswordModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded bg-[#181818] hover:bg-[#222] border border-[#333] text-left text-xs text-[#CCC] hover:text-white font-medium transition-all"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Đổi Mật Khẩu...</span>
                </button>
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

      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />
    </header>
  );
};
