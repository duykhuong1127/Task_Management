import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { dataService } from '../services/dataService';
import { PhongPhuLogo } from './PhongPhuLogo';
import { AlertCircle, X } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

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
      if (emailInput) {
        handleDirectLogin(emailInput);
      } else {
        setError('Vui lòng nhập địa chỉ Gmail bên dưới.');
      }
    } catch (err: any) {
      console.warn('Google Popup SignIn error or sandbox restriction:', err);
      if (emailInput) {
        handleDirectLogin(emailInput);
      } else {
        setError('Không thể mở popup Google. Vui lòng nhập địa chỉ Gmail bên dưới.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDirectLogin = (email: string) => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Vui lòng nhập địa chỉ Gmail hợp lệ.');
      return;
    }
    setLoading(true);
    try {
      const res = dataService.loginWithGoogle(trimmed);
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
      <div className="relative w-full max-w-sm bg-[#0F0F0F] border border-[#2E2E2E] rounded-xl shadow-2xl p-6 text-[#D1D1D1]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-[#666] hover:text-white transition-colors"
          title="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-5">
          <PhongPhuLogo size="lg" className="h-12 mb-2" />
          <h2 className="text-base font-semibold text-white">
            Đăng nhập
          </h2>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-2.5 rounded bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Google Login Button */}
        <div className="space-y-3">
          <button
            id="btn-modal-google-login"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded bg-white text-black hover:bg-neutral-100 font-medium text-xs transition-all active:scale-[0.99] disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
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
            <span>{loading ? 'Đang xử lý...' : 'Tiếp tục với Google'}</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-[#222]" />
            <span className="text-[11px] text-[#666]">hoặc</span>
            <div className="flex-1 h-px bg-[#222]" />
          </div>

          {/* Direct Gmail Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleDirectLogin(emailInput);
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-[11px] text-[#888] mb-1">Địa chỉ Gmail</label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="name@gmail.com"
                className="w-full px-3 py-2 text-xs bg-[#161616] border border-[#2E2E2E] rounded text-white focus:border-[#D4AF37] focus:outline-none transition-colors"
              />
            </div>
            <button
              id="btn-submit-modal-gmail"
              type="submit"
              disabled={loading || !emailInput.trim()}
              className="w-full py-2 px-4 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black font-semibold text-xs transition-all disabled:opacity-50"
            >
              Đăng nhập
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
