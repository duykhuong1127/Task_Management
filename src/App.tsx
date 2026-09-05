/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './config/firebase';
import { dataService } from './services/dataService';
import { User, Task, Project } from '@shared/types/models';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { HomeDashboard } from './components/HomeDashboard';
import { TasksView } from './components/TasksView';
import { ProjectsView } from './components/ProjectsView';
import { AdminView } from './components/AdminView';
import { TaskDetailsModal } from './components/TaskDetailsModal';
import { CreateTaskModal } from './components/CreateTaskModal';
import { NotificationsModal } from './components/NotificationsModal';
import { LoginModal } from './components/LoginModal';
import { PendingApprovalView } from './components/PendingApprovalView';
import { AuthScreen } from './components/AuthScreen';
import { Download, WifiOff, RefreshCw, X } from 'lucide-react';

export default function App() {
  const [sessionUser, setSessionUser] = useState<User | null>(dataService.getSessionUser());
  const [currentUser, setCurrentUser] = useState<User>(dataService.getCurrentUser());
  const [tasks, setTasks] = useState<Task[]>(dataService.getTasks());
  const [projects, setProjects] = useState<Project[]>(dataService.getProjects());
  
  // Navigation & Modals state
  const [currentTab, setCurrentTab] = useState<'home' | 'tasks' | 'projects' | 'admin'>('home');
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // PWA & Network status
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Subscribe to DataService updates & Firebase Auth
  useEffect(() => {
    const unsubscribe = dataService.subscribe(() => {
      setSessionUser(dataService.getSessionUser());
      setCurrentUser(dataService.getCurrentUser());
      setTasks([...dataService.getTasks()]);
      setProjects([...dataService.getProjects()]);

      // If active task is open, refresh it
      if (selectedTask) {
        const updated = dataService.getTaskById(selectedTask.taskId);
        setSelectedTask(updated || null);
      }
    });

    // Listen to Firebase Auth state
    let unsubAuth: (() => void) | undefined;
    try {
      if (auth) {
        unsubAuth = onAuthStateChanged(auth, (fbUser) => {
          if (fbUser && fbUser.email) {
            dataService.loginWithGoogle(
              fbUser.email,
              fbUser.displayName || fbUser.email.split('@')[0],
              fbUser.photoURL || undefined
            );
          }
        });
      }
    } catch (err) {
      console.warn('Firebase Auth listener error:', err);
    }

    // PWA Install Prompt Listener
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    // Network status listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      if (unsubAuth) unsubAuth();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [selectedTask]);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  const unreadCount = dataService.getUnreadNotificationCount();

  // If user is not authenticated, display the mandatory Authentication Gate
  if (!sessionUser) {
    return (
      <AuthScreen
        onLoginSuccess={(u) => {
          setSessionUser(u);
          setCurrentUser(u);
          setTasks([...dataService.getTasks()]);
          setProjects([...dataService.getProjects()]);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070707] text-[#D1D1D1] overflow-hidden selection:bg-[#D4AF37]/30 selection:text-white">
      {/* Offline Status Banner */}
      {!isOnline && (
        <div className="bg-amber-950/80 border-b border-amber-700/50 text-amber-200 px-4 py-1.5 text-xs flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Bạn đang ở chế độ ngoại tuyến. Dữ liệu sẽ được lưu cục bộ và đồng bộ khi có kết nối trở lại.</span>
        </div>
      )}

      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div className="bg-[#111] border-b border-[#D4AF37]/40 px-4 py-2 flex items-center justify-between text-xs text-white z-50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#ED1C24] text-white font-bold flex items-center justify-center text-[10px] shadow-sm">
              PP
            </div>
            <span>Cài đặt ứng dụng <strong>Quản lý Công việc - Phong Phú</strong> vào màn hình chính để nhận thông báo nhanh và làm việc ngoại tuyến.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallPWA}
              className="px-3 py-1 rounded bg-[#D4AF37] text-black font-bold uppercase tracking-wider text-[10px] hover:bg-[#c49f2e] transition-all flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>Cài đặt PWA</span>
            </button>
            <button
              onClick={() => setShowInstallBanner(false)}
              className="p-1 text-[#888] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <Header
        currentUser={currentUser}
        unreadCount={unreadCount}
        onOpenNotifications={() => setShowNotifications(true)}
        onOpenAdmin={() => setCurrentTab('admin')}
        onOpenLoginModal={() => setShowLoginModal(true)}
      />

      {/* Main Body Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* If user is waiting for admin approval or disabled */}
        {currentUser.status !== 'ACTIVE' ? (
          <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto w-full flex items-center justify-center">
            <PendingApprovalView
              currentUser={currentUser}
              onOpenLoginModal={() => setShowLoginModal(true)}
              onRefresh={() => {
                setSessionUser(dataService.getSessionUser());
                setCurrentUser(dataService.getCurrentUser());
                setTasks([...dataService.getTasks()]);
                setProjects([...dataService.getProjects()]);
              }}
            />
          </main>
        ) : (
          <>
            {/* Navigation (Sidebar Desktop / Bottom Bar Mobile) */}
            <Navigation
              currentTab={currentTab}
              onSelectTab={setCurrentTab}
              onOpenCreateTask={() => setShowCreateTask(true)}
              onOpenNotifications={() => setShowNotifications(true)}
              projects={projects}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              currentUser={currentUser}
              unreadCount={unreadCount}
            />

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8 max-w-7xl mx-auto w-full">
              {currentTab === 'home' && (
                <HomeDashboard
                  currentUser={currentUser}
                  tasks={tasks}
                  onSelectTask={setSelectedTask}
                  onOpenCreateTask={() => setShowCreateTask(true)}
                  onViewAllTasks={() => {
                    setSelectedProjectId(undefined);
                    setCurrentTab('tasks');
                  }}
                />
              )}

              {currentTab === 'tasks' && (
                <TasksView
                  tasks={tasks}
                  currentUser={currentUser}
                  onSelectTask={setSelectedTask}
                  onOpenCreateTask={() => setShowCreateTask(true)}
                  selectedProjectId={selectedProjectId}
                />
              )}

              {currentTab === 'projects' && (
                <ProjectsView
                  projects={projects}
                  tasks={tasks}
                  currentUser={currentUser}
                  onSelectProject={(pId) => {
                    setSelectedProjectId(pId);
                    setCurrentTab('tasks');
                  }}
                  onRefresh={() => setProjects([...dataService.getProjects()])}
                />
              )}

              {currentTab === 'admin' && (
                <AdminView currentUser={currentUser} />
              )}
            </main>
          </>
        )}
      </div>

      {/* MODALS */}

      {/* 1. Task Details Modal */}
      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          currentUser={currentUser}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* 2. Create Task Modal */}
      {showCreateTask && (
        <CreateTaskModal
          currentUser={currentUser}
          projects={projects}
          onClose={() => setShowCreateTask(false)}
          onSuccess={() => {
            setTasks([...dataService.getTasks()]);
            setCurrentTab('tasks');
          }}
        />
      )}

      {/* 3. Notifications Modal */}
      {showNotifications && (
        <NotificationsModal
          currentUser={currentUser}
          onClose={() => setShowNotifications(false)}
          onSelectTaskById={(tId) => {
            const t = dataService.getTaskById(tId);
            if (t) setSelectedTask(t);
          }}
        />
      )}

      {/* 4. Google / Gmail Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={() => {
          setSessionUser(dataService.getSessionUser());
          setCurrentUser(dataService.getCurrentUser());
          setTasks([...dataService.getTasks()]);
          setProjects([...dataService.getProjects()]);
        }}
      />
    </div>
  );
}
