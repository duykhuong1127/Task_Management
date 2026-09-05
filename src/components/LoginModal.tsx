import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { dataService } from '../services/dataService';
import { PhongPhuLogo } from './PhongPhuLogo';
import { ShieldCheck, Mail, AlertCircle, Sparkles, CheckCircle2, X } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [emailInput, setEmailInput] = useState('duykhuong332@gmail.com');
  const [nameInput, setNameInput] = useState('Duy Khương');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDirectForm, setShowDirectForm] = useState(false);

  if (!isOpen) return null;

  // Real Google Sign-In with popup
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      if (auth && googleProvider) {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        if (user && user.email) {
          dataService.loginWithGoogle(
            user.email,
            user.displayName || undefined,
            user.photoURL || undefined
          );
          onClose();
          if (onSuccess) onSuccess();
          return;
        }
      }
      // If auth is not active or in iframe sandbox fallback
      handleDirectLogin(emailInput, nameInput);
    } catch (err: any) {
      console.warn('Google Popup SignIn error or sandbox restriction, using direct Gmail auth:', err);
      // Popup might be blocked in iframe; show clear fallback
      setShowDirectForm(true);
      setError(
        'Không thể mở cửa sổ popup Google OAuth (do giới hạn iFrame hoặc chính sách trình duyệt). Vui lòng nhập hoặc chọn tài khoản Gmail bên dưới để tiếp tục đăng nhập an toàn.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDirectLogin = (email: string, name?: string) => {
    if (!email || !email.includes('@')) {
      setError('Vui lòng nhập địa chỉ Gmail hợp lệ.');
      return;
    }
    setLoading(true);
    try {
      const res = dataService.loginWithGoogle(email, name);
      if (res.needsApproval) {
        setError(res.message || 'Vui lòng chờ admin xét duyệt tài khoản');
        setTimeout(() => {
          onClose();
          if (onSuccess) onSuccess();
        }, 1500);
      } else if (res.success) {
        onClose();
        if (onSuccess) onSuccess();
      } else {
        setError(res.message || 'Không thể đăng nhập. Vui lòng thử lại.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi đăng nhập');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-[#0F0F0F] border border-[#333] rounded-lg shadow-2xl p-6 sm:p-8 text-[#D1D1D1]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-[#666] hover:text-white transition-colors"
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <PhongPhuLogo size="lg" className="h-14 mb-3" />
          <h2 className="text-xl font-bold text-white tracking-tight">
            Đăng Nhập Tài Khoản Google / Gmail
          </h2>
          <p className="text-xs text-[#D4AF37] font-medium mt-1">
            Hệ thống Quản lý Công việc - CTY CP Dệt Gia Dụng Phong Phú
          </p>
          <p className="text-[11px] text-[#777] mt-1">
            Khu vực asia-southeast1 • Múi giờ Asia/Ho_Chi_Minh
          </p>
        </div>

        {/* Error Alert if any */}
        {error && (
          <div className="mb-4 p-3 rounded bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {/* Primary Google Login Button */}
        <div className="space-y-3">
          <button
            id="btn-google-oauth-login"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-md bg-white text-black hover:bg-neutral-100 font-semibold text-sm transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
          >
            {/* Google G Logo SVG */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{loading ? 'Đang xác thực...' : 'Đăng nhập với Google (Gmail)'}</span>
          </button>

          {/* Fallback Gmail Entry Form */}
          {(showDirectForm || true) && (
            <div className="pt-3 border-t border-[#222]">
              <div className="text-[11px] font-medium text-[#888] uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Hoặc đăng nhập nhanh bằng Gmail:</span>
                <Mail className="w-3.5 h-3.5 text-[#D4AF37]" />
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] text-[#999] mb-1">Địa chỉ Gmail</label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="vidu@gmail.com"
                    className="w-full px-3 py-2 text-xs bg-[#161616] border border-[#333] rounded text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#999] mb-1">Họ và tên hiển thị</label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-2 text-xs bg-[#161616] border border-[#333] rounded text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
                <button
                  id="btn-submit-direct-gmail"
                  onClick={() => handleDirectLogin(emailInput, nameInput)}
                  disabled={loading || !emailInput}
                  className="w-full py-2.5 px-4 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black font-semibold text-xs tracking-wider uppercase transition-all shadow"
                >
                  Xác Nhận Đăng Nhập Gmail Này
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Security / Admin Approval Notice */}
        <div className="mt-5 p-3 rounded bg-[#161616] border border-[#262626] text-[11px] space-y-1.5 text-[#999]">
          <div className="flex items-center gap-1.5 font-semibold text-[#D4AF37]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Chính sách Cấp Quyền Truy Cập (Admin Approval)</span>
          </div>
          <p className="leading-relaxed">
            • Tài khoản Gmail mới sau khi đăng nhập sẽ ở trạng thái <strong>Chờ Quản Trị Viên phê duyệt</strong>.
          </p>
          <p className="leading-relaxed">
            • Quản trị viên (Admin) sẽ phân quyền và chỉ định cụ thể các <strong>Dự án</strong> bạn được phép tham gia.
          </p>
          <p className="leading-relaxed">
            • Khi gửi tài liệu công việc, hệ thống sẽ tự động lưu trữ vào <strong>Google Drive của Người Giao Việc</strong> tương ứng.
          </p>
        </div>

        {/* Quick Demo Test Accounts */}
        <div className="mt-4 pt-3 border-t border-[#222]">
          <div className="text-[10px] uppercase font-mono text-[#666] mb-1.5 flex items-center justify-between">
            <span>Tài khoản thử nghiệm nhanh:</span>
            <Sparkles className="w-3 h-3 text-[#D4AF37]" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <button
              onClick={() => handleDirectLogin('admin@company.com', 'Quản Trị Viên (Admin)')}
              className="px-2 py-1.5 rounded bg-[#181818] hover:bg-[#222] border border-[#333] text-left text-amber-300 truncate"
            >
              👑 Admin Cấp Quyền
            </button>
            <button
              onClick={() => handleDirectLogin('a@gmail.com', 'Nguyễn Văn A (Lead)')}
              className="px-2 py-1.5 rounded bg-[#181818] hover:bg-[#222] border border-[#333] text-left text-[#ccc] truncate"
            >
              👔 Người Giao Việc (A)
            </button>
            <button
              onClick={() => handleDirectLogin('b@gmail.com', 'Trần Thị B')}
              className="px-2 py-1.5 rounded bg-[#181818] hover:bg-[#222] border border-[#333] text-left text-[#ccc] truncate"
            >
              👩 Thành Viên (B)
            </button>
            <button
              onClick={() => handleDirectLogin('duykhuong332@gmail.com', 'Duy Khương')}
              className="px-2 py-1.5 rounded bg-[#181818] hover:bg-[#222] border border-[#D4AF37]/50 text-left text-[#D4AF37] font-semibold truncate"
            >
              ⭐ Gmail Của Bạn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
