import React, { useState, useEffect } from 'react';
import { Clock, ShieldAlert, RefreshCw, LogOut, CheckCircle, Mail, User as UserIcon } from 'lucide-react';
import { User } from '@shared/types/models';
import { useAuth } from '../auth/AuthContext';
import { PhongPhuLogo } from './PhongPhuLogo';

interface PendingApprovalScreenProps {
  currentUser: User;
  onLogout: () => void;
}

export const PendingApprovalScreen: React.FC<PendingApprovalScreenProps> = ({ currentUser, onLogout }) => {
  const { refreshUser } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Auto poll every 5 seconds in case admin approves this user from another window/tab
  useEffect(() => {
    const interval = setInterval(async () => {
      const updated = await refreshUser();
      if (updated && updated.status === 'ACTIVE') {
        setFeedback('Tài khoản của bạn đã được phê duyệt thành công! Đang chuyển hướng…');
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [refreshUser]);

  const handleManualCheck = async () => {
    setIsChecking(true);
    setFeedback(null);
    try {
      const updated = await refreshUser();
      if (updated && updated.status === 'ACTIVE') {
        setFeedback('Tài khoản của bạn đã được kích hoạt thành công!');
      } else {
        setFeedback('Tài khoản vẫn đang ở trạng thái chờ duyệt. Vui lòng đợi Quản trị viên xử lý.');
      }
    } catch {
      setFeedback('Không thể kiểm tra trạng thái lúc này. Vui lòng thử lại sau.');
    } finally {
      setIsChecking(false);
    }
  };

  const isPending = currentUser.status === 'PENDING_APPROVAL' || currentUser.status === 'INVITED';
  const isDisabled = currentUser.status === 'DISABLED';

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/40 flex items-center justify-center p-5 font-sans">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 sm:p-9 shadow-[0_20px_60px_rgba(15,23,42,0.08)] text-center animate-in fade-in zoom-in-95 duration-200">
        <PhongPhuLogo size="md" className="h-10 mx-auto mb-5" />

        {/* Icon & Badge */}
        <div className="flex justify-center mb-4">
          {isDisabled ? (
            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shadow-sm">
              <ShieldAlert className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-sm">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
          )}
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {isDisabled ? 'Tài khoản đã bị tạm khóa' : 'Tài khoản đang chờ phê duyệt'}
        </h1>

        <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
          {isDisabled
            ? 'Tài khoản này đã bị Quản trị viên vô hiệu hóa quyền truy cập. Vui lòng liên hệ hỗ trợ kỹ thuật nếu bạn cho rằng đây là nhầm lẫn.'
            : 'Tài khoản của bạn đã được tạo và ghi nhận thành công trên hệ thống. Để bảo mật dữ liệu công việc, Quản trị viên cần phân công dự án và phê duyệt quyền truy cập trước khi bạn có thể sử dụng.'}
        </p>

        {/* Profile Details Card */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-left">
          <div className="flex items-center gap-3">
            {currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName}
                className="w-11 h-11 rounded-full object-cover border border-slate-200"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center font-bold text-sm">
                {(currentUser.displayName || currentUser.email).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <span className="truncate">{currentUser.displayName || 'Thành viên mới'}</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                    isDisabled
                      ? 'bg-red-100 text-red-800 border-red-200'
                      : 'bg-amber-100 text-amber-800 border-amber-200'
                  }`}
                >
                  {isDisabled ? 'VÔ HIỆU HÓA' : 'CHỜ DUYỆT'}
                </span>
              </div>
              <div className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                <Mail className="w-3.5 h-3.5 text-slate-400 inline shrink-0" />
                <span className="truncate">{currentUser.email}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200/70 text-xs text-slate-500 flex items-center justify-between">
            <span>Mã định danh:</span>
            <span className="font-mono text-slate-700 truncate max-w-[180px]">{currentUser.uid}</span>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-medium text-blue-800 text-left animate-in fade-in"
            role="alert"
          >
            {feedback}
          </div>
        )}

        {/* Action Controls */}
        <div className="mt-6 flex flex-col gap-2.5">
          {isPending && (
            <button
              type="button"
              onClick={handleManualCheck}
              disabled={isChecking}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Đang kiểm tra trạng thái…' : 'Kiểm tra lại trạng thái duyệt'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium text-xs transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400" />
            <span>Đăng xuất & quay lại trang đăng nhập</span>
          </button>
        </div>

        <p className="mt-5 text-[11px] text-slate-400">
          Hệ thống tự động kiểm tra trạng thái mỗi 5 giây. Ngay khi Quản trị viên bấm duyệt, ứng dụng sẽ tự động mở bảng điều khiển công việc.
        </p>
      </section>
    </main>
  );
};
