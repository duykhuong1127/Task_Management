import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Columns3,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  TimerReset,
} from 'lucide-react';
import { Task, TaskStatus, User } from '@shared/types/models';
import { dataService } from '../services/dataService';
import { taskViewService } from '../services/taskViewService';
import { formatVietnamDateTime, isOverdue, isWithin72Hours } from '../utils/date';

interface MultiViewTasksProps {
  tasks: Task[];
  currentUser: User;
  onSelectTask: (task: Task) => void;
  onOpenCreateTask: () => void;
  selectedProjectId?: string;
}

type ViewMode = 'LIST' | 'BOARD' | 'CALENDAR' | 'TIMELINE';
type FilterMode = 'ALL' | 'ASSIGNED_TO_ME' | 'ASSIGNED_BY_ME' | 'OVERDUE' | 'DUE_SOON' | 'COMPLETED';
type SortMode = 'DEADLINE' | 'PRIORITY' | 'UPDATED' | 'CREATED';

const priorityRank: Record<string, number> = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 };

const statusLabel: Record<TaskStatus, string> = {
  NEW: 'Mới',
  IN_PROGRESS: 'Đang thực hiện',
  WAITING: 'Chờ xử lý',
  COMPLETED: 'Hoàn thành',
  OVERDUE: 'Quá hạn',
  ARCHIVED: 'Lưu trữ',
};

function localDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function effectiveStatus(task: Task): TaskStatus {
  if (task.status === 'COMPLETED') return 'COMPLETED';
  if (isOverdue(task.deadline)) return 'OVERDUE';
  return task.status === 'ARCHIVED' ? 'WAITING' : task.status;
}

function priorityClasses(priority: Task['priority']): string {
  if (priority === 'URGENT') return 'border-rose-700/50 text-rose-300 bg-rose-950/40';
  if (priority === 'HIGH') return 'border-amber-700/40 text-amber-300 bg-amber-950/30';
  if (priority === 'LOW') return 'border-slate-700 text-slate-400 bg-slate-950/30';
  return 'border-[#333] text-[#aaa] bg-[#171717]';
}

function StatusBadge({ task }: { task: Task }) {
  const status = effectiveStatus(task);
  const cls =
    status === 'COMPLETED'
      ? 'text-emerald-300 bg-emerald-950/50 border-emerald-800/50'
      : status === 'OVERDUE'
        ? 'text-rose-300 bg-rose-950/50 border-rose-800/50'
        : status === 'WAITING'
          ? 'text-violet-300 bg-violet-950/40 border-violet-800/40'
          : status === 'NEW'
            ? 'text-sky-300 bg-sky-950/40 border-sky-800/40'
            : 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/30';
  return (
    <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border ${cls}`}>
      {statusLabel[status]}
    </span>
  );
}

function TaskCard({ task, onOpen, draggable = false }: { task: Task; onOpen: () => void; draggable?: boolean }) {
  const assignees = task.assigneeIds
    .map((uid) => dataService.getUserById(uid)?.displayName)
    .filter(Boolean)
    .slice(0, 2);

  return (
    <article
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) return;
        event.dataTransfer.setData('text/task-id', task.taskId);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onOpen}
      className={`rounded-lg border border-[#262626] bg-[#0E0E0E] p-3 hover:border-[#D4AF37]/45 hover:bg-[#121212] transition-all cursor-pointer ${draggable ? 'active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className="font-mono text-[9px] text-[#D4AF37]">{task.taskId}</span>
            <StatusBadge task={task} />
            <span className={`text-[9px] border px-1.5 py-0.5 rounded ${priorityClasses(task.priority)}`}>
              {task.priority}
            </span>
          </div>
          <h3 className="text-sm text-white font-medium leading-snug line-clamp-2">{task.title}</h3>
        </div>
        <span className="text-[10px] font-mono text-[#bbb] shrink-0">{task.progressSummary}%</span>
      </div>

      <div className="mt-3 h-1.5 bg-[#222] rounded-full overflow-hidden">
        <div className="h-full bg-[#D4AF37] rounded-full" style={{ width: `${Math.max(0, Math.min(100, task.progressSummary))}%` }} />
      </div>

      <div className="mt-3 flex items-end justify-between gap-2 text-[10px] text-[#777]">
        <div className="truncate">{assignees.join(', ') || 'Chưa có người nhận'}</div>
        <div className={`${isOverdue(task.deadline) && task.status !== 'COMPLETED' ? 'text-rose-400' : isWithin72Hours(task.deadline) ? 'text-amber-300' : 'text-[#888]'} shrink-0`}>
          {formatVietnamDateTime(task.deadline)}
        </div>
      </div>
    </article>
  );
}

export const MultiViewTasks: React.FC<MultiViewTasksProps> = ({
  tasks,
  currentUser,
  onSelectTask,
  onOpenCreateTask,
  selectedProjectId,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('task_view_mode_v2') : null;
    return saved === 'BOARD' || saved === 'CALENDAR' || saved === 'TIMELINE' ? saved : 'LIST';
  });
  const [filter, setFilter] = useState<FilterMode>('ALL');
  const [sort, setSort] = useState<SortMode>('DEADLINE');
  const [queryText, setQueryText] = useState('');
  const [calendarCursor, setCalendarCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);

  const isAdmin = currentUser.role === 'ADMIN';

  const isRelated = (task: Task) =>
    task.assigneeIds.includes(currentUser.uid) ||
    task.assignerId === currentUser.uid ||
    task.createdBy === currentUser.uid;

  const scoped = useMemo(() => {
    return tasks.filter((task) => {
      if (task.deleted) return false;
      if (selectedProjectId && task.projectId !== selectedProjectId) return false;
      if (!isAdmin && !isRelated(task)) return false;
      return true;
    });
  }, [tasks, selectedProjectId, currentUser.uid, isAdmin]);

  const counts = useMemo(() => ({
    ALL: scoped.length,
    ASSIGNED_TO_ME: scoped.filter((t) => t.assigneeIds.includes(currentUser.uid)).length,
    ASSIGNED_BY_ME: scoped.filter((t) => t.assignerId === currentUser.uid || t.createdBy === currentUser.uid).length,
    OVERDUE: scoped.filter((t) => t.status !== 'COMPLETED' && isOverdue(t.deadline)).length,
    DUE_SOON: scoped.filter((t) => t.status !== 'COMPLETED' && isWithin72Hours(t.deadline)).length,
    COMPLETED: scoped.filter((t) => t.status === 'COMPLETED').length,
  }), [scoped, currentUser.uid]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    const rows = scoped.filter((task) => {
      if (q && !`${task.taskId} ${task.title} ${task.description}`.toLowerCase().includes(q)) return false;
      if (filter === 'ASSIGNED_TO_ME') return task.assigneeIds.includes(currentUser.uid);
      if (filter === 'ASSIGNED_BY_ME') return task.assignerId === currentUser.uid || task.createdBy === currentUser.uid;
      if (filter === 'OVERDUE') return task.status !== 'COMPLETED' && isOverdue(task.deadline);
      if (filter === 'DUE_SOON') return task.status !== 'COMPLETED' && isWithin72Hours(task.deadline);
      if (filter === 'COMPLETED') return task.status === 'COMPLETED';
      return true;
    });

    return [...rows].sort((a, b) => {
      if (sort === 'PRIORITY') return priorityRank[b.priority] - priorityRank[a.priority];
      if (sort === 'UPDATED') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      if (sort === 'CREATED') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }, [scoped, queryText, filter, sort, currentUser.uid]);

  const setAndPersistView = (mode: ViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem('task_view_mode_v2', mode);
  };

  const boardColumns: Array<{ status: TaskStatus; title: string; editable: boolean }> = [
    { status: 'NEW', title: 'Mới', editable: true },
    { status: 'IN_PROGRESS', title: 'Đang thực hiện', editable: true },
    { status: 'WAITING', title: 'Chờ xử lý', editable: true },
    { status: 'OVERDUE', title: 'Quá hạn', editable: false },
    { status: 'COMPLETED', title: 'Hoàn thành', editable: false },
  ];

  const calendarDays = useMemo(() => {
    const first = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
    const mondayIndex = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - mondayIndex);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [calendarCursor]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    filtered.forEach((task) => {
      const key = localDateKey(task.deadline);
      const rows = map.get(key) || [];
      rows.push(task);
      map.set(key, rows);
    });
    return map;
  }, [filtered]);

  const timelineMonthStart = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
  const timelineMonthEnd = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 0, 23, 59, 59, 999);
  const timelineSpanMs = Math.max(1, timelineMonthEnd.getTime() - timelineMonthStart.getTime());

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pb-4 border-b border-[#222]">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#D4AF37] font-semibold">Không gian công việc đa góc nhìn</div>
          <h1 className="text-2xl font-serif italic text-white mt-1">Công Việc</h1>
          <p className="text-xs text-[#777] mt-1">Một nguồn dữ liệu, bốn cách quan sát: danh sách, Kanban, lịch và timeline.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-lg border border-[#282828] bg-[#0E0E0E] p-1">
            {[
              { id: 'LIST', icon: List, label: 'List' },
              { id: 'BOARD', icon: Columns3, label: 'Board' },
              { id: 'CALENDAR', icon: CalendarDays, label: 'Calendar' },
              { id: 'TIMELINE', icon: TimerReset, label: 'Timeline' },
            ].map((item) => {
              const Icon = item.icon;
              const active = viewMode === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setAndPersistView(item.id as ViewMode)}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors ${active ? 'bg-[#D4AF37] text-black font-semibold' : 'text-[#888] hover:text-white'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </div>

          <button onClick={onOpenCreateTask} className="px-3.5 py-2 rounded bg-[#D4AF37] text-black text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Tạo Việc
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {([
            ['ALL', 'Tất cả'],
            ['ASSIGNED_TO_ME', 'Tôi được giao'],
            ['ASSIGNED_BY_ME', 'Tôi giao'],
            ['OVERDUE', 'Quá hạn'],
            ['DUE_SOON', 'Sắp đến hạn'],
            ['COMPLETED', 'Hoàn thành'],
          ] as Array<[FilterMode, string]>).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`px-3 py-1.5 rounded-full text-[11px] whitespace-nowrap border transition-all ${filter === id ? 'bg-[#D4AF37] border-[#D4AF37] text-black font-semibold' : 'bg-[#111] border-[#252525] text-[#888] hover:text-white'}`}
            >
              {label} <span className="ml-1 opacity-70">{counts[id]}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#666]" />
            <input
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="Tìm theo ID, tiêu đề, mô tả..."
              className="w-full pl-9 pr-3 py-2 rounded bg-[#111] border border-[#252525] text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
          <div className="flex items-center gap-1.5 text-[#777]">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="bg-[#111] border border-[#252525] rounded px-2 py-2 text-xs text-[#bbb] focus:outline-none">
              <option value="DEADLINE">Deadline</option>
              <option value="PRIORITY">Ưu tiên</option>
              <option value="UPDATED">Cập nhật</option>
              <option value="CREATED">Mới tạo</option>
            </select>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#333] bg-[#0A0A0A] p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-[#D4AF37] mx-auto mb-3" />
          <div className="text-white font-medium">Không có công việc phù hợp</div>
          <div className="text-xs text-[#666] mt-1">Thử đổi bộ lọc hoặc tạo công việc mới.</div>
        </div>
      ) : viewMode === 'LIST' ? (
        <div className="space-y-2.5">
          {filtered.map((task) => <TaskCard key={task.taskId} task={task} onOpen={() => onSelectTask(task)} />)}
        </div>
      ) : viewMode === 'BOARD' ? (
        <div className="overflow-x-auto pb-3">
          <div className="grid grid-cols-5 gap-3 min-w-[1200px]">
            {boardColumns.map((column) => {
              const columnTasks = filtered.filter((task) => effectiveStatus(task) === column.status);
              const highlighted = dragOverStatus === column.status;
              return (
                <section
                  key={column.status}
                  onDragOver={(event) => {
                    if (!column.editable) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setDragOverStatus(column.status);
                  }}
                  onDragLeave={() => setDragOverStatus(null)}
                  onDrop={(event) => {
                    if (!column.editable) return;
                    event.preventDefault();
                    setDragOverStatus(null);
                    const taskId = event.dataTransfer.getData('text/task-id');
                    if (!taskId) return;
                    const result = taskViewService.moveTask(taskId, column.status, currentUser);
                    if (!result.success) window.alert(result.error);
                  }}
                  className={`rounded-xl border p-2.5 min-h-[520px] transition-colors ${highlighted ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-[#242424] bg-[#0A0A0A]'}`}
                >
                  <div className="flex items-center justify-between px-1 pb-2.5">
                    <h2 className="text-xs uppercase tracking-wider text-[#bbb] font-semibold">{column.title}</h2>
                    <span className="text-[10px] bg-[#1A1A1A] text-[#777] rounded-full px-2 py-0.5">{columnTasks.length}</span>
                  </div>
                  {!column.editable && column.status === 'COMPLETED' && (
                    <div className="text-[9px] text-[#666] px-1 pb-2">Hoàn thành chỉ qua quy trình nghiệm thu.</div>
                  )}
                  <div className="space-y-2.5">
                    {columnTasks.map((task) => (
                      <TaskCard key={task.taskId} task={task} draggable={task.status !== 'COMPLETED'} onOpen={() => onSelectTask(task)} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'CALENDAR' ? (
        <div className="rounded-xl border border-[#252525] bg-[#0A0A0A] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#252525]">
            <button onClick={() => setCalendarCursor(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1))} className="p-1.5 rounded hover:bg-[#1A1A1A] text-[#aaa]"><ArrowLeft className="w-4 h-4" /></button>
            <div className="text-sm font-semibold text-white">Tháng {calendarCursor.getMonth() + 1}/{calendarCursor.getFullYear()}</div>
            <button onClick={() => setCalendarCursor(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1))} className="p-1.5 rounded hover:bg-[#1A1A1A] text-[#aaa]"><ArrowRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-7 border-b border-[#252525] bg-[#0E0E0E]">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <div key={day} className="p-2 text-center text-[10px] uppercase tracking-wider text-[#666]">{day}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((date) => {
              const rows = tasksByDay.get(localDateKey(date)) || [];
              const inMonth = date.getMonth() === calendarCursor.getMonth();
              const today = localDateKey(date) === localDateKey(new Date());
              return (
                <div key={date.toISOString()} className={`min-h-[120px] border-r border-b border-[#1E1E1E] p-1.5 ${inMonth ? 'bg-[#0A0A0A]' : 'bg-[#080808] opacity-50'}`}>
                  <div className={`text-[10px] w-6 h-6 grid place-items-center rounded-full mb-1 ${today ? 'bg-[#D4AF37] text-black font-bold' : 'text-[#777]'}`}>{date.getDate()}</div>
                  <div className="space-y-1">
                    {rows.slice(0, 3).map((task) => (
                      <button key={task.taskId} onClick={() => onSelectTask(task)} className={`w-full text-left rounded px-1.5 py-1 text-[9px] truncate border ${effectiveStatus(task) === 'OVERDUE' ? 'border-rose-900/50 bg-rose-950/30 text-rose-300' : effectiveStatus(task) === 'COMPLETED' ? 'border-emerald-900/40 bg-emerald-950/20 text-emerald-300' : 'border-[#2D2D2D] bg-[#151515] text-[#bbb]'}`} title={task.title}>
                        {task.title}
                      </button>
                    ))}
                    {rows.length > 3 && <div className="text-[9px] text-[#666] px-1">+{rows.length - 3} việc khác</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[#252525] bg-[#0A0A0A] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#252525]">
            <button onClick={() => setCalendarCursor(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1))} className="p-1.5 rounded hover:bg-[#1A1A1A] text-[#aaa]"><ArrowLeft className="w-4 h-4" /></button>
            <div>
              <div className="text-sm font-semibold text-white text-center">Timeline tháng {calendarCursor.getMonth() + 1}/{calendarCursor.getFullYear()}</div>
              <div className="text-[10px] text-[#666] text-center">Thanh thời gian từ ngày tạo đến deadline</div>
            </div>
            <button onClick={() => setCalendarCursor(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1))} className="p-1.5 rounded hover:bg-[#1A1A1A] text-[#aaa]"><ArrowRight className="w-4 h-4" /></button>
          </div>
          <div className="divide-y divide-[#1E1E1E]">
            {filtered.filter((task) => new Date(task.deadline) >= timelineMonthStart && new Date(task.createdAt) <= timelineMonthEnd).map((task) => {
              const start = Math.max(new Date(task.createdAt).getTime(), timelineMonthStart.getTime());
              const end = Math.min(new Date(task.deadline).getTime(), timelineMonthEnd.getTime());
              const left = Math.max(0, ((start - timelineMonthStart.getTime()) / timelineSpanMs) * 100);
              const width = Math.max(2, ((Math.max(end, start) - start) / timelineSpanMs) * 100);
              return (
                <button key={task.taskId} onClick={() => onSelectTask(task)} className="w-full grid grid-cols-[220px_1fr] gap-4 p-3 hover:bg-[#101010] text-left">
                  <div className="min-w-0">
                    <div className="text-xs text-white truncate">{task.title}</div>
                    <div className="text-[9px] text-[#666] mt-1">{task.taskId} · {task.progressSummary}%</div>
                  </div>
                  <div className="relative h-8 rounded bg-[#111] border border-[#1F1F1F] overflow-hidden">
                    <div className="absolute inset-y-0 left-1/4 border-l border-[#222]" />
                    <div className="absolute inset-y-0 left-1/2 border-l border-[#222]" />
                    <div className="absolute inset-y-0 left-3/4 border-l border-[#222]" />
                    <div className={`absolute top-2 h-4 rounded ${effectiveStatus(task) === 'OVERDUE' ? 'bg-rose-700/70' : effectiveStatus(task) === 'COMPLETED' ? 'bg-emerald-700/60' : 'bg-[#D4AF37]/70'}`} style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
          {filtered.every((task) => new Date(task.deadline) < timelineMonthStart || new Date(task.createdAt) > timelineMonthEnd) && (
            <div className="p-10 text-center text-xs text-[#666] flex items-center justify-center gap-2"><AlertTriangle className="w-4 h-4" /> Không có công việc giao với tháng này.</div>
          )}
        </div>
      )}
    </div>
  );
};
