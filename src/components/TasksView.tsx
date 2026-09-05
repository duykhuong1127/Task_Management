import React, { useState, useMemo } from 'react';
import { Task, User } from '@shared/types/models';
import { isOverdue, isWithin72Hours, formatVietnamDateTime } from '../utils/date';
import { dataService } from '../services/dataService';
import { Search, Filter, ArrowUpDown, Plus, CheckCircle2, Clock, AlertTriangle, User as UserIcon, Trash2 } from 'lucide-react';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface TasksViewProps {
  tasks: Task[];
  currentUser: User;
  onSelectTask: (task: Task) => void;
  onOpenCreateTask: () => void;
  selectedProjectId?: string;
}

type TaskFilterType = 'ALL' | 'ASSIGNED_TO_ME' | 'ASSIGNED_BY_ME' | 'OVERDUE' | 'DUE_SOON' | 'COMPLETED';
type SortOption = 'DEADLINE' | 'PRIORITY' | 'UPDATED' | 'CREATED';

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  currentUser,
  onSelectTask,
  onOpenCreateTask,
  selectedProjectId,
}) => {
  const [filter, setFilter] = useState<TaskFilterType>('ALL');
  const [sort, setSort] = useState<SortOption>('DEADLINE');
  const [searchQuery, setSearchQuery] = useState('');
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirmDeleteTask = () => {
    if (!taskToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    const res = dataService.softDeleteTask(taskToDelete.taskId);
    setIsDeleting(false);
    if (!res.success) {
      setDeleteError(res.error || 'Có lỗi xảy ra khi xóa công việc.');
    } else {
      setTaskToDelete(null);
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (selectedProjectId && task.projectId !== selectedProjectId) return false;

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchDesc = task.description.toLowerCase().includes(q);
        const matchId = task.taskId.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchId) return false;
      }

      // Filter tabs
      switch (filter) {
        case 'ASSIGNED_TO_ME':
          return task.assigneeIds.includes(currentUser.uid);
        case 'ASSIGNED_BY_ME':
          return task.assignerId === currentUser.uid;
        case 'OVERDUE':
          return task.status !== 'COMPLETED' && isOverdue(task.deadline);
        case 'DUE_SOON':
          return task.status !== 'COMPLETED' && isWithin72Hours(task.deadline);
        case 'COMPLETED':
          return task.status === 'COMPLETED';
        case 'ALL':
        default:
          return true;
      }
    });
  }, [tasks, selectedProjectId, searchQuery, filter, currentUser.uid]);

  // Sort tasks
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      if (sort === 'DEADLINE') {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (sort === 'PRIORITY') {
        const pOrder: Record<string, number> = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
        return (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0);
      }
      if (sort === 'UPDATED') {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (sort === 'CREATED') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });
  }, [filteredTasks, sort]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#222]">
        <div>
          <h1 className="text-xl md:text-2xl font-serif italic text-white">Danh Sách Công Việc</h1>
          <p className="text-xs text-[#666]">
            {selectedProjectId ? `Lọc theo dự án đang chọn` : `Tổng cộng ${tasks.length} công việc trong hệ thống`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#666]" />
            <input
              id="input-task-search"
              type="text"
              placeholder="Tìm kiếm công việc..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded bg-[#111] border border-[#262626] text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <button
            id="btn-tasks-create"
            onClick={onOpenCreateTask}
            className="px-3.5 py-1.5 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black text-xs uppercase tracking-wider font-bold shadow flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Tạo Việc</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs (Section 41: Tất cả, Tôi được giao, Tôi giao, Quá hạn, Sắp đến hạn, Hoàn thành) */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full text-xs">
          {[
            { id: 'ALL', label: 'Tất cả' },
            { id: 'ASSIGNED_TO_ME', label: 'Tôi được giao' },
            { id: 'ASSIGNED_BY_ME', label: 'Tôi giao' },
            { id: 'OVERDUE', label: 'Quá hạn' },
            { id: 'DUE_SOON', label: 'Sắp đến hạn' },
            { id: 'COMPLETED', label: 'Hoàn thành' },
          ].map((tab) => {
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                id={`filter-tab-${tab.id.toLowerCase()}`}
                onClick={() => setFilter(tab.id as TaskFilterType)}
                className={`px-3 py-1.5 rounded-full text-xs tracking-wide transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[#D4AF37] text-black font-semibold shadow-[0_0_8px_rgba(212,175,55,0.25)]'
                    : 'bg-[#121212] text-[#888] hover:text-white border border-[#222] hover:border-[#333]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-2 text-xs text-[#777]">
          <ArrowUpDown className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span className="hidden sm:inline">Sắp xếp:</span>
          <select
            id="select-task-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="bg-[#121212] border border-[#222] text-xs text-[#D1D1D1] rounded px-2.5 py-1 focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="DEADLINE">Hạn chót (Deadline)</option>
            <option value="PRIORITY">Mức ưu tiên</option>
            <option value="UPDATED">Cập nhật gần nhất</option>
            <option value="CREATED">Tạo mới nhất</option>
          </select>
        </div>
      </div>

      {/* Task Cards List */}
      {sortedTasks.length === 0 ? (
        <div className="p-12 text-center rounded border border-[#222] bg-[#0A0A0A] space-y-2">
          <div className="text-[#555] text-sm">Không tìm thấy công việc nào phù hợp với bộ lọc.</div>
          <button
            onClick={() => {
              setFilter('ALL');
              setSearchQuery('');
            }}
            className="text-xs text-[#D4AF37] hover:underline"
          >
            Xóa bộ lọc tìm kiếm
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedTasks.map((task) => {
            const overdue = task.status !== 'COMPLETED' && isOverdue(task.deadline);
            const dueSoon = task.status !== 'COMPLETED' && isWithin72Hours(task.deadline);
            const project = dataService.getProjectById(task.projectId);
            const assigner = dataService.getUserById(task.assignerId);
            const isCompleted = task.status === 'COMPLETED';

            return (
              <div
                key={task.taskId}
                onClick={() => onSelectTask(task)}
                className="p-4 rounded border border-[#222] bg-[#0C0C0C] hover:bg-[#121212] hover:border-[#D4AF37]/50 transition-all cursor-pointer flex flex-col justify-between space-y-3 group shadow-lg relative overflow-hidden"
              >
                {/* Header Tags */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[10px] text-[#D4AF37] bg-[#D4AF37]/10 px-1.5 py-0.5 rounded border border-[#D4AF37]/20">
                      {task.taskId}
                    </span>
                    <span className="text-[10px] text-[#777] max-w-[120px] truncate">
                      {project?.name || 'Dự án chung'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isCompleted ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 uppercase font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Hoàn thành</span>
                      </span>
                    ) : overdue ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950/70 text-rose-300 border border-rose-800/40 uppercase font-semibold">
                        Quá hạn
                      </span>
                    ) : dueSoon ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40 uppercase font-semibold">
                        Sắp đến hạn
                      </span>
                    ) : null}

                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold ${
                        task.priority === 'URGENT'
                          ? 'bg-rose-900/40 text-rose-300 border border-rose-700/30'
                          : task.priority === 'HIGH'
                          ? 'bg-amber-900/40 text-amber-300 border border-amber-700/30'
                          : 'bg-[#1a1a1a] text-[#888]'
                      }`}
                    >
                      {task.priority === 'URGENT' ? 'Khẩn cấp' : task.priority === 'HIGH' ? 'Cao' : task.priority === 'NORMAL' ? 'Bình thường' : 'Thấp'}
                    </span>

                    {(currentUser.role === 'ADMIN' || currentUser.uid === task.assignerId || (project && project.ownerId === currentUser.uid)) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteError(null);
                          setTaskToDelete(task);
                        }}
                        className="p-1 rounded hover:bg-rose-950/60 text-[#555] hover:text-rose-400 transition-colors"
                        title="Xóa công việc"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-[#D4AF37] transition-colors line-clamp-1">
                    {task.title}
                  </h3>
                  <p className="text-xs text-[#777] line-clamp-2 mt-1">{task.description}</p>
                </div>

                {/* Progress Summary */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[#666]">Tiến độ tổng hợp</span>
                    <span className="font-mono text-white font-medium">{task.progressSummary}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isCompleted ? 'bg-emerald-500' : 'bg-[#D4AF37]'
                      }`}
                      style={{ width: `${task.progressSummary}%` }}
                    ></div>
                  </div>
                </div>

                {/* Footer: Assigner, Assignees, Deadline */}
                <div className="pt-2 border-t border-[#1a1a1a] flex items-center justify-between text-[11px] text-[#777]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#555]">Giao bởi:</span>
                    <span className="text-white truncate max-w-[80px]">{assigner?.displayName || 'Ẩn danh'}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[10px] text-[#666]">
                      <UserIcon className="w-3 h-3 text-[#D4AF37]" />
                      <span>{task.assigneeIds.length} người nhận</span>
                    </div>

                    <div className="font-mono text-[10px] text-right">
                      <span className={overdue ? 'text-rose-400 font-bold' : dueSoon ? 'text-[#D4AF37]' : 'text-[#888]'}>
                        {formatVietnamDateTime(task.deadline)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Delete Task Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(taskToDelete)}
        title="Xác Nhận Xóa Công Việc"
        itemName={taskToDelete?.title || ''}
        itemType="công việc"
        warningMessage="Công việc này sẽ được chuyển vào danh mục đã xóa (soft-delete) và lưu nhật ký kiểm toán."
        errorMessage={deleteError}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDeleteTask}
        onClose={() => {
          if (!isDeleting) {
            setTaskToDelete(null);
            setDeleteError(null);
          }
        }}
      />
    </div>
  );
};
