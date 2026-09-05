import React from 'react';
import { Task, User } from '@shared/types/models';
import { isOverdue, isWithin72Hours, formatVietnamDateTime } from '../utils/date';
import { AlertCircle, Clock, CheckCircle2, PlayCircle, ArrowUpRight, Flame, ShieldAlert, Sparkles } from 'lucide-react';
import { dataService } from '../services/dataService';

interface HomeDashboardProps {
  currentUser: User;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onOpenCreateTask: () => void;
  onViewAllTasks: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  currentUser,
  tasks,
  onSelectTask,
  onOpenCreateTask,
  onViewAllTasks,
}) => {
  // Compute metrics
  const myTasks = tasks.filter(
    (t) => t.assigneeIds.includes(currentUser.uid) || t.assignerId === currentUser.uid || currentUser.role === 'ADMIN'
  );

  const overdueTasks = myTasks.filter((t) => t.status !== 'COMPLETED' && isOverdue(t.deadline));
  const dueSoonTasks = myTasks.filter((t) => t.status !== 'COMPLETED' && isWithin72Hours(t.deadline));
  const inProgressTasks = myTasks.filter((t) => t.status === 'IN_PROGRESS' && !isOverdue(t.deadline) && !isWithin72Hours(t.deadline));
  const completedTasks = myTasks.filter((t) => t.status === 'COMPLETED');

  // "Công việc cần chú ý": sort urgent first, then overdue, then due soon
  const urgentAttentionTasks = [...myTasks]
    .filter((t) => t.status !== 'COMPLETED')
    .sort((a, b) => {
      // Overdue first
      const aOverdue = isOverdue(a.deadline) ? 1 : 0;
      const bOverdue = isOverdue(b.deadline) ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;

      // Priority next
      const priorityOrder = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
      const aP = priorityOrder[a.priority] || 1;
      const bP = priorityOrder[b.priority] || 1;
      if (aP !== bP) return bP - aP;

      // Deadline earliest
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    })
    .slice(0, 5);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Executive Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between pb-6 border-b border-[#222] gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#D4AF37] font-semibold mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]"></span>
            Trung Tâm Điều Hành Tổng Thể
          </div>
          <h1 className="text-2xl md:text-3xl font-serif italic text-white">
            Chào {currentUser.displayName},
          </h1>
          <p className="text-[#777] text-xs md:text-sm mt-1">
            Bạn có <span className="text-[#D4AF37] font-semibold">{urgentAttentionTasks.length} công việc</span> cần chú ý giải quyết hôm nay.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-home-create-task"
            onClick={onOpenCreateTask}
            className="px-4 py-2 bg-[#D4AF37] hover:bg-[#c49f2e] text-black text-xs uppercase tracking-wider font-bold rounded shadow transition-all"
          >
            + Giao Việc Mới
          </button>
          <button
            id="btn-home-test-reminders"
            onClick={() => {
              const res = dataService.triggerScheduledReminders('0800');
              alert(`Hệ thống giả lập Scheduler 08:00 (Asia/Ho_Chi_Minh) thành công!\nSố thông báo nhắc nhở đã kích hoạt: ${res.dispatchedCount}`);
            }}
            className="px-3 py-2 border border-[#333] hover:border-[#D4AF37]/50 text-[#bbb] hover:text-white text-xs uppercase tracking-wider rounded bg-[#111] transition-all flex items-center gap-1.5"
            title="Kích hoạt kiểm tra lịch nhắc việc 08:00"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Kích hoạt 08:00</span>
          </button>
        </div>
      </div>

      {/* 4 Dashboard Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Quá hạn */}
        <div className="p-4 md:p-5 rounded bg-[#0E0E0E] border border-rose-950/60 shadow-lg relative overflow-hidden group hover:border-rose-700/50 transition-all">
          <div className="flex items-center justify-between text-[#888] mb-2">
            <span className="text-[10px] uppercase tracking-widest text-rose-400 font-medium">Quá Hạn</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl md:text-3xl font-serif text-white mb-1">{overdueTasks.length}</div>
          <div className="text-[10px] text-[#666] flex items-center gap-1">
            <span className="text-rose-400">Yêu cầu xử lý gấp</span>
          </div>
        </div>

        {/* 2. Sắp đến hạn (<72h) */}
        <div className="p-4 md:p-5 rounded bg-[#0E0E0E] border border-[#D4AF37]/30 shadow-lg relative overflow-hidden group hover:border-[#D4AF37]/70 transition-all">
          <div className="flex items-center justify-between text-[#888] mb-2">
            <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-medium">Sắp Đến Hạn</span>
            <Clock className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="text-2xl md:text-3xl font-serif text-[#D4AF37] mb-1">{dueSoonTasks.length}</div>
          <div className="text-[10px] text-[#666] flex items-center gap-1">
            <span className="text-[#D4AF37]">Trong vòng 72 giờ</span>
          </div>
        </div>

        {/* 3. Đang thực hiện */}
        <div className="p-4 md:p-5 rounded bg-[#0E0E0E] border border-[#222] shadow-lg relative overflow-hidden group hover:border-sky-700/40 transition-all">
          <div className="flex items-center justify-between text-[#888] mb-2">
            <span className="text-[10px] uppercase tracking-widest text-sky-400 font-medium">Đang Thực Hiện</span>
            <PlayCircle className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl md:text-3xl font-serif text-white mb-1">{inProgressTasks.length}</div>
          <div className="text-[10px] text-[#666] flex items-center gap-1">
            <span className="text-sky-400">Tiến độ bình thường</span>
          </div>
        </div>

        {/* 4. Đã hoàn thành */}
        <div className="p-4 md:p-5 rounded bg-[#0E0E0E] border border-[#222] shadow-lg relative overflow-hidden group hover:border-emerald-700/40 transition-all">
          <div className="flex items-center justify-between text-[#888] mb-2">
            <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-medium">Đã Hoàn Thành</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl md:text-3xl font-serif text-white mb-1">{completedTasks.length}</div>
          <div className="text-[10px] text-[#666] flex items-center gap-1">
            <span className="text-emerald-400">T+15 lưu trữ chat</span>
          </div>
        </div>
      </div>

      {/* Công việc cần chú ý Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#D4AF37]" />
            <h2 className="text-lg font-serif italic text-white">Công Việc Cần Chú Ý</h2>
          </div>
          <button
            onClick={onViewAllTasks}
            className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1 tracking-wider uppercase font-medium"
          >
            <span>Xem tất cả ({myTasks.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {urgentAttentionTasks.length === 0 ? (
          <div className="p-8 text-center border border-[#222] rounded bg-[#0A0A0A] text-[#666] text-xs">
            Hiện không có công việc khẩn cấp cần giải quyết. Tuyệt vời!
          </div>
        ) : (
          <div className="space-y-3">
            {urgentAttentionTasks.map((task) => {
              const overdue = isOverdue(task.deadline);
              const dueSoon = isWithin72Hours(task.deadline);
              const assigner = dataService.getUserById(task.assignerId);

              return (
                <div
                  key={task.taskId}
                  onClick={() => onSelectTask(task)}
                  className="p-4 rounded border border-[#222] bg-[#0C0C0C] hover:bg-[#121212] hover:border-[#D4AF37]/40 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] text-[#D4AF37] bg-[#D4AF37]/10 px-1.5 py-0.5 rounded border border-[#D4AF37]/20">
                        {task.taskId}
                      </span>
                      {overdue ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950/70 text-rose-300 border border-rose-800/40 uppercase font-semibold">
                          Quá hạn
                        </span>
                      ) : dueSoon ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40 uppercase font-semibold">
                          Sắp đến hạn
                        </span>
                      ) : null}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
                          task.priority === 'URGENT'
                            ? 'bg-rose-900/40 text-rose-300 border border-rose-700/30'
                            : task.priority === 'HIGH'
                            ? 'bg-amber-900/40 text-amber-300 border border-amber-700/30'
                            : 'bg-[#222] text-[#aaa]'
                        }`}
                      >
                        {task.priority === 'URGENT' ? 'Khẩn cấp' : task.priority === 'HIGH' ? 'Cao' : task.priority === 'NORMAL' ? 'Bình thường' : 'Thấp'}
                      </span>
                    </div>

                    <h3 className="text-sm md:text-base font-medium text-white group-hover:text-[#D4AF37] transition-colors">
                      {task.title}
                    </h3>
                    <p className="text-xs text-[#777] line-clamp-1">{task.description}</p>
                  </div>

                  <div className="flex items-center gap-6 text-xs text-[#888] shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-[#1a1a1a]">
                    <div className="text-left md:text-right">
                      <div className="text-[10px] text-[#555] uppercase">Hạn chót (VN)</div>
                      <div className={`font-mono ${overdue ? 'text-rose-400 font-bold' : dueSoon ? 'text-[#D4AF37]' : 'text-[#bbb]'}`}>
                        {formatVietnamDateTime(task.deadline)}
                      </div>
                    </div>

                    <div className="w-24">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-[#555]">Tiến độ</span>
                        <span className="font-mono text-white">{task.progressSummary}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#222] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#D4AF37] rounded-full transition-all"
                          style={{ width: `${task.progressSummary}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
