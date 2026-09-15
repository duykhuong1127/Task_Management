/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Download, WifiOff, X } from 'lucide-react';
import { useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { dataService } from './services/dataService';
import { productionSyncService } from './services/productionSyncService';
import { storageAclService } from './services/storageAclService';
import { Task, Project, User } from '@shared/types/models';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { HomeDashboard } from './components/HomeDashboard';
import { MultiViewTasks } from './components/MultiViewTasks';
import { CalendarTasksView } from './components/CalendarTasksView';
import { ProjectsView } from './components/ProjectsView';
import { AdminView } from './components/AdminView';
import { TaskDetailsModalV2 } from './components/TaskDetailsModalV2';
import { CreateTaskModal } from './components/CreateTaskModal';
import { NotificationsModal } from './components/NotificationsModal';
import { LoginPage } from './components/LoginPage';
import { PendingApprovalScreen } from './components/PendingApprovalScreen';

type MainTab = 'home' | 'tasks' | 'projects' | 'admin';

function tabForPath(pathname: string): MainTab {
  if (pathname.startsWith('/tasks') || pathname === '/calendar') return 'tasks';
  if (pathname.startsWith('/projects')) return 'projects';
  if (pathname.startsWith('/admin')) return 'admin';
  return 'home';
}

const paths: Record<MainTab, string> = {
  home: '/dashboard',
  tasks: '/tasks',
  projects: '/projects',
  admin: '/admin',
};

function AccountPage({ user }: { user: User }) {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl text-white">Thông tin tài khoản</h1>
        <p className="text-sm text-[#888] mt-1">Hồ sơ được đồng bộ từ tài khoản Google đã xác thực.</p>
      </div>
      <div className="rounded-xl border border-[#292929] bg-[#101010] p-6 flex items-center gap-4">
        {user.photoURL ? (
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="h-16 w-16 rounded-full bg-[#D4AF37] text-black grid place-items-center text-xl font-bold">
            {user.displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-lg font-semibold text-white truncate">{user.displayName}</div>
          <div className="text-sm text-[#999] truncate">{user.email}</div>
          <div className="mt-2 text-[11px] uppercase tracking-wider text-[#D4AF37]">Google · {user.role}</div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<User>(() => user || dataService.getCurrentUser());
  const [tasks, setTasks] = useState<Task[]>(() => dataService.getTasks());
  const [projects, setProjects] = useState<Project[]>(() => dataService.getProjects());
  const [selectedProjectId, setSelectedProjectId] = useState<string>();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const currentTab = tabForPath(location.pathname);

  useEffect(() => {
    if (user) setCurrentUser(user);
  }, [user]);

  // Firestore is the production source of truth. The adapter hydrates the
  // existing synchronous DataService cache and writes local business actions
  // back to Firestore so all signed-in users observe changes in real time.
  useEffect(() => {
    if (currentUser.status !== 'ACTIVE') return undefined;
    return productionSyncService.connect(currentUser);
  }, [currentUser.uid, currentUser.role, currentUser.status]);

  // The app data is stored in a named Firestore DB. Firebase Storage Rules can
  // read only (default), so keep a minimal role/project-membership ACL mirror
  // there. No task content is duplicated into the ACL database.
  useEffect(() => {
    if (currentUser.status !== 'ACTIVE') return undefined;
    return storageAclService.connect(currentUser);
  }, [currentUser.uid, currentUser.role, currentUser.status]);

  useEffect(() =>
    dataService.subscribe(() => {
      const nextUser = dataService.getSessionUser();
      if (nextUser) setCurrentUser(nextUser);
      setTasks([...dataService.getTasks()]);
      setProjects([...dataService.getProjects()]);
      setSelectedTask((openTask) => (openTask ? dataService.getTaskById(openTask.taskId) || null : null));
    }),
  []);

  useEffect(() => {
    if (selectedProjectId && !dataService.isUserInProject(selectedProjectId, currentUser.uid)) {
      setSelectedProjectId(undefined);
    }
  }, [currentUser.uid, selectedProjectId, projects]);

  useEffect(() => {
    const handleInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setShowInstallBanner(true);
    };
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('beforeinstallprompt', handleInstall);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstall);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowInstallBanner(false);
    setDeferredPrompt(null);
  };

  const disconnectCloud = () => {
    productionSyncService.disconnect();
    storageAclService.disconnect();
  };

  if (location.pathname === '/admin' && currentUser.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  if (currentUser.status !== 'ACTIVE') {
    return (
      <PendingApprovalScreen
        currentUser={currentUser}
        onLogout={async () => {
          disconnectCloud();
          await logout();
          navigate('/login', { replace: true });
        }}
      />
    );
  }

  const taskViewProps = {
    tasks,
    currentUser,
    onSelectTask: setSelectedTask,
    onOpenCreateTask: () => setShowCreateTask(true),
    selectedProjectId,
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070707] text-[#D1D1D1] overflow-hidden selection:bg-[#D4AF37]/30 selection:text-white">
      {!isOnline && (
        <div className="bg-amber-950/80 border-b border-amber-700/50 text-amber-200 px-4 py-1.5 text-xs flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Bạn đang ngoại tuyến. Firestore sẽ xếp hàng thay đổi cục bộ và đồng bộ lại khi có mạng.</span>
        </div>
      )}

      {showInstallBanner && (
        <div className="bg-[#111] border-b border-[#D4AF37]/40 px-4 py-2 flex items-center justify-between text-xs text-white z-50">
          <span>Cài ứng dụng Quản lý Công việc vào màn hình chính.</span>
          <div className="flex items-center gap-2">
            <button onClick={() => void handleInstallPWA()} className="px-3 py-1 rounded bg-[#D4AF37] text-black font-bold flex items-center gap-1">
              <Download className="w-3 h-3" /> Cài đặt
            </button>
            <button onClick={() => setShowInstallBanner(false)} aria-label="Đóng"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <Header
        currentUser={currentUser}
        unreadCount={dataService.getUnreadNotificationCount()}
        onOpenNotifications={() => setShowNotifications(true)}
        onOpenAdmin={() => navigate('/admin')}
        onOpenSettings={() => navigate('/settings')}
        onLogout={async () => {
          disconnectCloud();
          await logout();
          navigate('/login', { replace: true });
        }}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <Navigation
          currentTab={currentTab}
          onSelectTab={(tab) => navigate(paths[tab])}
          onOpenCreateTask={() => setShowCreateTask(true)}
          onOpenNotifications={() => setShowNotifications(true)}
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={(projectId) => {
            setSelectedProjectId(projectId);
            navigate('/tasks');
          }}
          currentUser={currentUser}
          unreadCount={dataService.getUnreadNotificationCount()}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8 max-w-[1600px] mx-auto w-full">
          {location.pathname === '/dashboard' && (
            <HomeDashboard
              currentUser={currentUser}
              tasks={tasks}
              onSelectTask={setSelectedTask}
              onOpenCreateTask={() => setShowCreateTask(true)}
              onViewAllTasks={() => {
                setSelectedProjectId(undefined);
                navigate('/tasks');
              }}
            />
          )}

          {location.pathname.startsWith('/tasks') && <MultiViewTasks {...taskViewProps} />}
          {location.pathname === '/calendar' && <CalendarTasksView {...taskViewProps} />}

          {location.pathname.startsWith('/projects') && (
            <ProjectsView
              projects={projects}
              tasks={tasks}
              currentUser={currentUser}
              onSelectProject={(projectId) => {
                setSelectedProjectId(projectId);
                navigate('/tasks');
              }}
              onRefresh={() => setProjects([...dataService.getProjects()])}
            />
          )}

          {location.pathname === '/settings' && <AccountPage user={currentUser} />}
          {location.pathname === '/admin' && <AdminView currentUser={currentUser} />}
        </main>
      </div>

      {selectedTask && <TaskDetailsModalV2 task={selectedTask} currentUser={currentUser} onClose={() => setSelectedTask(null)} />}

      {showCreateTask && (
        <CreateTaskModal
          currentUser={currentUser}
          projects={projects}
          onClose={() => setShowCreateTask(false)}
          onSuccess={() => {
            setTasks([...dataService.getTasks()]);
            setShowCreateTask(false);
            navigate('/tasks');
          }}
        />
      )}

      {showNotifications && (
        <NotificationsModal
          currentUser={currentUser}
          onClose={() => setShowNotifications(false)}
          onSelectTaskById={(taskId) => {
            const task = dataService.getTaskById(taskId);
            if (task) setSelectedTask(task);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<WorkspaceApp />} />
        <Route path="/tasks/*" element={<WorkspaceApp />} />
        <Route path="/projects/*" element={<WorkspaceApp />} />
        <Route path="/calendar" element={<WorkspaceApp />} />
        <Route path="/settings" element={<WorkspaceApp />} />
        <Route path="/admin" element={<WorkspaceApp />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
