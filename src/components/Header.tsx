import { useState } from 'react';
import { Bell, ChevronDown, LogOut, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { User } from '@shared/types/models';
import { PhongPhuLogo } from './PhongPhuLogo';

interface HeaderProps {
  currentUser: User;
  onOpenNotifications: () => void;
  onOpenAdmin: () => void;
  onOpenSettings: () => void;
  onLogout: () => Promise<void>;
  unreadCount: number;
}

export function Header({ currentUser, onOpenNotifications, onOpenAdmin, onOpenSettings, onLogout, unreadCount }: HeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
      setShowMenu(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-4 md:px-8 border-b border-[#222] bg-[#0A0A0A]/95 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <PhongPhuLogo size="md" className="h-9 sm:h-10 shrink-0" />
        <div>
          <div className="text-white font-bold text-sm sm:text-base leading-tight">Quản lý Công việc</div>
          <div className="hidden sm:block text-[11px] text-[#D4AF37]">CTY CP Dệt Gia Dụng Phong Phú</div>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <button onClick={onOpenNotifications} className="relative p-2 rounded hover:bg-[#161616] text-[#888] hover:text-white" aria-label="Thông báo">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && <span className="absolute top-0 right-0 min-w-[18px] h-[18px] grid place-items-center rounded-full bg-[#D4AF37] text-black text-[10px] font-bold">{unreadCount}</span>}
        </button>

        {currentUser.role === 'ADMIN' && (
          <button onClick={onOpenAdmin} className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#161616] border border-[#D4AF37]/30 text-[#D4AF37] text-xs">
            <ShieldCheck className="w-3.5 h-3.5" /> Quản trị
          </button>
        )}

        <div className="relative">
          <button onClick={() => setShowMenu((value) => !value)} className="flex items-center gap-2 p-1.5 rounded-lg border border-[#292929] bg-[#111] hover:border-[#D4AF37]/40 text-left" aria-expanded={showMenu}>
            {currentUser.photoURL ? (
              <img src={currentUser.photoURL} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#D4AF37] text-black grid place-items-center text-xs font-bold">{currentUser.displayName.slice(0, 1).toUpperCase()}</div>
            )}
            <div className="hidden sm:block pr-1 max-w-[180px]">
              <div className="text-xs font-medium text-white truncate">{currentUser.displayName}</div>
              <div className="text-[10px] text-[#777] truncate">{currentUser.email}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#777]" />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-[#303030] bg-[#101010] p-2 shadow-2xl">
              <div className="px-3 py-2 border-b border-[#252525] mb-1">
                <div className="text-sm text-white truncate">{currentUser.displayName}</div>
                <div className="text-xs text-[#888] truncate">{currentUser.email}</div>
              </div>
              <button onClick={() => { setShowMenu(false); onOpenSettings(); }} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#ccc] hover:bg-[#1c1c1c] hover:text-white">
                <UserRound className="w-4 h-4" /> Thông tin tài khoản
              </button>
              <button onClick={() => { setShowMenu(false); onOpenSettings(); }} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#ccc] hover:bg-[#1c1c1c] hover:text-white">
                <Settings className="w-4 h-4" /> Cài đặt
              </button>
              <button disabled={loggingOut} onClick={() => void handleLogout()} className="mt-1 w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-300 hover:bg-rose-950/30 disabled:opacity-60">
                <LogOut className="w-4 h-4" /> {loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
