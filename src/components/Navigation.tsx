import React from 'react';
import { Home, CheckSquare, Plus, Bell, Shield, FolderKanban, Server, Globe2 } from 'lucide-react';
import { Project, User } from '@shared/types/models';
import { APP_REGION, BUSINESS_TIMEZONE } from '@shared/constants/regions';

interface NavigationProps {
  currentTab: 'home' | 'tasks' | 'projects' | 'admin';
  onSelectTab: (tab: 'home' | 'tasks' | 'projects' | 'admin') => void;
  onOpenCreateTask: () => void;
  onOpenNotifications: () => void;
  projects: Project[];
  selectedProjectId?: string;
  onSelectProject: (projectId?: string) => void;
  currentUser: User;
  unreadCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  onOpenCreateTask,
  onOpenNotifications,
  projects,
  selectedProjectId,
  onSelectProject,
  currentUser,
  unreadCount,
}) => {
  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[#222] bg-[#0A0A0A] p-5 shrink-0 overflow-y-auto">
        {/* Navigation Section */}
        <div className="space-y-1 mb-8">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#555] mb-3 px-2 font-medium">
            Menu Chính
          </div>
          <button
            id="nav-tab-home"
            onClick={() => {
              onSelectTab('home');
              onSelectProject(undefined);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium tracking-wide transition-all ${
              currentTab === 'home'
                ? 'bg-[#161616] text-[#D4AF37] border border-[#D4AF37]/30 shadow-sm'
                : 'text-[#888] hover:text-white hover:bg-[#111]'
            }`}
          >
            <Home className="w-4 h-4 text-[#D4AF37]" />
            <span>Trang Chủ</span>
          </button>

          <button
            id="nav-tab-tasks"
            onClick={() => onSelectTab('tasks')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium tracking-wide transition-all ${
              currentTab === 'tasks'
                ? 'bg-[#161616] text-[#D4AF37] border border-[#D4AF37]/30 shadow-sm'
                : 'text-[#888] hover:text-white hover:bg-[#111]'
            }`}
          >
            <CheckSquare className="w-4 h-4 text-[#D4AF37]" />
            <span>Công Việc</span>
          </button>

          <button
            id="nav-tab-projects"
            onClick={() => onSelectTab('projects')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium tracking-wide transition-all ${
              currentTab === 'projects'
                ? 'bg-[#161616] text-[#D4AF37] border border-[#D4AF37]/30 shadow-sm'
                : 'text-[#888] hover:text-white hover:bg-[#111]'
            }`}
          >
            <FolderKanban className="w-4 h-4 text-[#D4AF37]" />
            <span>Dự Án ({projects.length})</span>
          </button>

          {currentUser.role === 'ADMIN' && (
            <button
              id="nav-tab-admin"
              onClick={() => onSelectTab('admin')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium tracking-wide transition-all ${
                currentTab === 'admin'
                  ? 'bg-[#161616] text-[#D4AF37] border border-[#D4AF37]/30 shadow-sm'
                  : 'text-[#888] hover:text-white hover:bg-[#111]'
              }`}
            >
              <Shield className="w-4 h-4 text-[#D4AF37]" />
              <span>Quản Trị Hệ Thống</span>
            </button>
          )}
        </div>

        {/* Projects / Entities Quick Filter */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[#555] mb-3 px-2 font-medium">
            <span>Dự Án Hoạt Động</span>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => {
                onSelectProject(undefined);
                onSelectTab('tasks');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition-colors ${
                !selectedProjectId
                  ? 'bg-[#141414] text-white font-medium border border-[#333]'
                  : 'text-[#777] hover:text-white hover:bg-[#111]'
              }`}
            >
              <span>Tất cả dự án</span>
              <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]"></div>
            </button>

            {projects.map((p) => {
              const isSelected = selectedProjectId === p.projectId;
              return (
                <button
                  key={p.projectId}
                  onClick={() => {
                    onSelectProject(p.projectId);
                    onSelectTab('tasks');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition-colors text-left ${
                    isSelected
                      ? 'bg-[#161616] text-white font-medium border border-[#D4AF37]/40'
                      : 'text-[#777] hover:text-white hover:bg-[#111]'
                  }`}
                >
                  <span className="truncate pr-2">{p.name}</span>
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isSelected ? 'bg-[#D4AF37]' : 'bg-transparent border border-[#444]'
                    }`}
                  ></div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Create Task Quick Action Button */}
        <div className="mt-auto mb-6">
          <button
            id="btn-sidebar-create-task"
            onClick={onOpenCreateTask}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black text-xs uppercase tracking-widest font-bold shadow-[0_2px_12px_rgba(212,175,55,0.2)] transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Tạo Công Việc</span>
          </button>
        </div>

        {/* System & Geography Card (Lock Status) */}
        <div className="p-3 border border-[#222] rounded bg-[#0D0D0D] text-[10px] space-y-2">
          <div className="flex items-center justify-between text-[#777] uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <Globe2 className="w-3 h-3 text-[#D4AF37]" /> Vùng Triển Khai
            </span>
            <span className="text-[#10b981] font-mono">LOCKED</span>
          </div>
          <div className="text-white font-mono text-xs font-semibold">{APP_REGION}</div>
          <div className="text-[#555] text-[9px] flex justify-between border-t border-[#1a1a1a] pt-1">
            <span>Múi giờ:</span>
            <span className="text-[#999] font-mono">{BUSINESS_TIMEZONE}</span>
          </div>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION (Section 39 Requirement: Trang chủ, Công việc, +, Thông báo, Tài khoản) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-[#0A0A0A]/95 backdrop-blur-lg border-t border-[#222] flex items-center justify-around px-2 pb-safe">
        {/* 1. Trang chủ */}
        <button
          id="mobile-nav-home"
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center justify-center w-14 h-full text-[10px] tracking-tight ${
            currentTab === 'home' ? 'text-[#D4AF37]' : 'text-[#777]'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span>Trang chủ</span>
        </button>

        {/* 2. Công việc */}
        <button
          id="mobile-nav-tasks"
          onClick={() => onSelectTab('tasks')}
          className={`flex flex-col items-center justify-center w-14 h-full text-[10px] tracking-tight ${
            currentTab === 'tasks' ? 'text-[#D4AF37]' : 'text-[#777]'
          }`}
        >
          <CheckSquare className="w-5 h-5 mb-0.5" />
          <span>Công việc</span>
        </button>

        {/* 3. Center PLUS button: TẠO CÔNG VIỆC */}
        <button
          id="mobile-nav-create"
          onClick={onOpenCreateTask}
          className="relative -top-3 w-12 h-12 rounded-full bg-[#D4AF37] text-black flex items-center justify-center shadow-[0_4px_16px_rgba(212,175,55,0.4)] border-2 border-[#0A0A0A] active:scale-95 transition-transform"
          aria-label="Tạo công việc"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>

        {/* 4. Thông báo */}
        <button
          id="mobile-nav-notifications"
          onClick={onOpenNotifications}
          className="relative flex flex-col items-center justify-center w-14 h-full text-[10px] tracking-tight text-[#777]"
        >
          <Bell className="w-5 h-5 mb-0.5" />
          <span>Thông báo</span>
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2.5 w-4 h-4 rounded-full bg-[#D4AF37] text-black text-[9px] font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        {/* 5. Tài khoản / Quản trị */}
        <button
          id="mobile-nav-account"
          onClick={() => onSelectTab('admin')}
          className={`flex flex-col items-center justify-center w-14 h-full text-[10px] tracking-tight ${
            currentTab === 'admin' ? 'text-[#D4AF37]' : 'text-[#777]'
          }`}
        >
          <Shield className="w-5 h-5 mb-0.5" />
          <span>{currentUser.role === 'ADMIN' ? 'Quản trị' : 'Tài khoản'}</span>
        </button>
      </nav>
    </>
  );
};
