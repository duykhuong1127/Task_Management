import React from 'react';
import { Notification, User, Task } from '@shared/types/models';
import { dataService } from '../services/dataService';
import { formatVietnamDateTime } from '../utils/date';
import { X, Bell, CheckCheck, Clock, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

interface NotificationsModalProps {
  currentUser: User;
  onClose: () => void;
  onSelectTaskById: (taskId: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  currentUser,
  onClose,
  onSelectTaskById,
}) => {
  const notifications = dataService.getNotifications();

  const handleMarkAllRead = () => {
    dataService.markAllNotificationsAsRead();
  };

  const handleNotificationClick = (notif: Notification) => {
    dataService.markNotificationAsRead(notif.notificationId);
    if (notif.taskId) {
      onSelectTaskById(notif.taskId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-[#0D0D0D] border border-[#333] rounded-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222] bg-[#111]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#D4AF37]" />
            <h2 className="text-white font-serif text-base font-semibold">Thông Báo Hệ Thống</h2>
            <span className="text-[10px] font-mono text-[#888] bg-[#1a1a1a] px-2 py-0.5 rounded">
              {notifications.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {notifications.some((n) => !n.read) && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1 font-medium"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Đã đọc tất cả</span>
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-[#222] text-[#888] hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#666]">
              Bạn chưa có thông báo nào vào thời điểm hiện tại.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.notificationId}
                onClick={() => handleNotificationClick(n)}
                className={`p-3.5 rounded border transition-all cursor-pointer flex items-start gap-3 group ${
                  n.read
                    ? 'border-[#222] bg-[#0A0A0A] hover:bg-[#121212]'
                    : 'border-[#D4AF37]/40 bg-[#141414] hover:border-[#D4AF37] shadow-sm'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {n.type === 'TASK_DEADLINE_SOON' ? (
                    <Clock className="w-4 h-4 text-[#D4AF37]" />
                  ) : n.type === 'TASK_OVERDUE' ? (
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  ) : n.type === 'TASK_COMPLETED' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Bell className="w-4 h-4 text-sky-400" />
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white group-hover:text-[#D4AF37] transition-colors">
                      {n.title}
                    </span>
                    <span className="font-mono text-[10px] text-[#666]">
                      {formatVietnamDateTime(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-[#888] leading-relaxed">{n.body}</p>

                  {n.deduplicationKey && (
                    <div className="text-[9px] font-mono text-[#555] truncate pt-0.5">
                      Idempotency Key: {n.deduplicationKey}
                    </div>
                  )}
                </div>

                {n.taskId && (
                  <ArrowRight className="w-4 h-4 text-[#444] group-hover:text-[#D4AF37] shrink-0 self-center transition-colors" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
