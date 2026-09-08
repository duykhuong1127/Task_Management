import React, { useState } from 'react';
import { User } from '@shared/types/models';
import { dataService } from '../services/dataService';
import { driveService } from '../services/driveService';
import {
  ShieldAlert,
  FolderLock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Lock,
  FileText,
  X,
  HardDrive,
} from 'lucide-react';

interface GoogleDriveConsentModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onDecisionComplete?: (granted: boolean) => void;
}

export const GoogleDriveConsentModal: React.FC<GoogleDriveConsentModalProps> = ({
  user,
  isOpen,
  onClose,
  onDecisionComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'PROMPT' | 'CONFIRM_DENY'>('PROMPT');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle ALLOW (Grant permission)
  const handleAllow = async () => {
    setLoading(true);
    setError(null);
    try {
      // Request actual Google Drive OAuth token via GSI or authorized session
      const tokenRes = await driveService.requestOAuthDriveToken(user.email);
      dataService.updateDrivePermission(user.uid, true, tokenRes.token);
      if (onDecisionComplete) onDecisionComplete(true);
      onClose();
    } catch (err: any) {
      console.error('Drive consent error:', err);
      setError('Đã có lỗi xảy ra khi yêu cầu quyền Google Drive. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Handle DENY (Refuse permission)
  const handleDeny = () => {
    setLoading(true);
    try {
      // User chose to deny: lock their task assignment privilege and alert Admin
      dataService.updateDrivePermission(user.uid, false);
      if (onDecisionComplete) onDecisionComplete(false);
      onClose();
    } catch (err: any) {
      console.error('Drive deny error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div
        id="modal-google-drive-consent"
        className="bg-[#111111] border border-[#2B2B2B] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative text-[#E5E5E5]"
      >
        {/* Top Decorative Google & Phong Phu Banner */}
        <div className="bg-[#161616] px-6 py-4 border-b border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Google Drive Logo */}
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-2 shadow-sm shrink-0">
              <svg className="w-full h-full" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 10.15z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <span>Google Drive</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  Workspace
                </span>
              </h2>
              <p className="text-[11px] text-[#888]">Hệ thống Quản lý Công việc • Phong Phú</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-[#AAA] font-mono">{user.email}</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {step === 'PROMPT' ? (
            <>
              {/* Main Headline */}
              <div>
                <h3 className="text-base font-semibold text-white leading-snug">
                  Yêu cầu quyền truy cập Google Drive của bạn
                </h3>
                <p className="text-xs text-[#999] mt-1 leading-relaxed">
                  Ứng dụng muốn truy cập Tài khoản Google <strong className="text-white">({user.email})</strong> của bạn để tự động lưu trữ và đồng bộ hóa dữ liệu công việc.
                </p>
              </div>

              {/* Specific Scopes Requested */}
              <div className="p-3.5 rounded-xl bg-[#171717] border border-[#282828] space-y-2.5">
                <div className="text-[11px] font-medium text-[#AAA] uppercase tracking-wider flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Quyền hạn được yêu cầu:</span>
                </div>
                <div className="flex items-start gap-3 text-xs text-[#CCC]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Lưu trữ dữ liệu nhiệm vụ vào Google Drive của bạn</strong>
                    <p className="text-[11px] text-[#888] mt-0.5">
                      Xem, tạo và quản lý các thư mục và tệp tài liệu do bạn giao cho các thành viên trong thư mục <code>[Phong Phú] Quản lý Công việc & Dự án</code>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Mandatory Policy Warning Box */}
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-200/90 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-amber-300 text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Quy định bắt buộc về quyền Giao việc</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-200/80">
                  Để bảo đảm tính minh bạch và an toàn tài liệu của công ty, người giao việc <strong>bắt buộc phải chấp nhận</strong> kết nối Google Drive.
                </p>
                <p className="text-[11px] leading-relaxed text-rose-300 font-medium">
                  ⛔ Nếu bạn <strong>Từ chối</strong>: Hệ thống sẽ <strong>khóa hoàn toàn quyền Giao việc</strong> của tài khoản bạn và gửi thông báo cảnh báo trực tiếp đến Quản trị viên (Admin).
                </p>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  id="btn-drive-deny-step"
                  onClick={() => setStep('CONFIRM_DENY')}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl bg-[#202020] hover:bg-[#2A2A2A] text-[#BBB] hover:text-white text-xs font-medium transition-colors border border-[#333]"
                >
                  Từ chối
                </button>

                <button
                  type="button"
                  id="btn-drive-allow"
                  onClick={handleAllow}
                  disabled={loading}
                  className="flex-1 py-2.5 px-5 rounded-xl bg-[#1A73E8] hover:bg-[#1557b0] text-white text-xs font-semibold shadow-lg shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span>Đang kết nối Google Drive...</span>
                  ) : (
                    <>
                      <span>Cho phép truy cập</span>
                      <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">OAuth 2.0</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* Confirmation step when user clicks Deny */
            <div className="space-y-4 animate-in fade-in">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
                <FolderLock className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="text-sm font-semibold text-white">
                  Xác nhận TỪ CHỐI cấp quyền Google Drive?
                </h3>
                <p className="text-xs text-[#AAA] max-w-sm mx-auto leading-relaxed">
                  Nếu bạn từ chối, hệ thống sẽ:
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#181818] border border-[#292929] space-y-2 text-xs text-[#BBB]">
                <div className="flex items-center gap-2 text-rose-400">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span><strong>Khóa quyền giao việc:</strong> Bạn sẽ không thể tạo bất kỳ công việc hoặc dự án mới nào.</span>
                </div>
                <div className="flex items-center gap-2 text-amber-400">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span><strong>Báo cáo Quản trị viên:</strong> Hệ thống sẽ gửi thông báo khẩn cấp đến Quản trị viên về việc từ chối này.</span>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  id="btn-drive-back-to-allow"
                  onClick={() => setStep('PROMPT')}
                  className="flex-1 py-2.5 rounded-xl bg-[#1A73E8] hover:bg-[#1557b0] text-white text-xs font-semibold transition-all shadow-md"
                >
                  Quay lại để Cho phép
                </button>
                <button
                  type="button"
                  id="btn-drive-confirm-deny"
                  onClick={handleDeny}
                  disabled={loading}
                  className="py-2.5 px-4 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs font-medium transition-colors"
                >
                  {loading ? 'Đang ghi nhận...' : 'Vẫn từ chối'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
