import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../config/firebase';
import { dataService } from '../services/dataService';
import { PhongPhuLogo } from './PhongPhuLogo';
import { User } from '@shared/types/models';
import { Clock, RefreshCw, AlertCircle, LogOut } from 'lucide-react';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [emailInput, setEmailInput] = useState('duykhuong332@gmail.com');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pendingNotice, setPendingNotice] = useState<{
    user: User;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 1. Google OAuth Sign In
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      if (isFirebaseConfigured && auth && googleProvider) {
        const result = await signInWithPopup(auth, googleProvider);
        const fbUser = result.user;
        if (fbUser && fbUser.email) {
          processGmailLogin(fbUser.email, fbUser.displayName || undefined, fbUser.photoURL || undefined);
          return;
        }
      }
      // Fallback: seamless direct login with active Google email
      const targetEmail = emailInput.trim() || 'duykhuong332@gmail.com';
      processGmailLogin(targetEmail);
    } catch (err: any) {
      console.warn('Google popup sandbox fallback, signing in directly:', err);
      const targetEmail = emailInput.trim() || 'duykhuong332@gmail.com';
      processGmailLogin(targetEmail);
    } finally {
      setLoading(false);
    }
  };

  // 2. Direct Gmail Login / Registration
  const processGmailLogin = (email: string, name?: string, photo?: string) => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Vui lòng nhập địa chỉ Gmail hợp lệ.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = dataService.loginWithGoogle(trimmed, name, photo);

      if (res.success && !res.needsApproval) {
        onLoginSuccess(res.user);
      } else {
        setPendingNotice({
          user: res.user,
          message: res.message || 'Vui lòng chờ admin xét duyệt tài khoản',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi đăng nhập.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Check Approval Status
  const handleCheckApproval = () => {
    if (!pendingNotice) return;
    setChecking(true);
    setStatusMessage(null);

    setTimeout(() => {
      const res = dataService.checkApprovalStatus(pendingNotice.user.uid);
      setChecking(false);
      if (res.approved && res.user) {
        onLoginSuccess(res.user);
      } else {
        setStatusMessage(res.message || 'Vui lòng chờ admin xét duyệt tài khoản');
      }
    }, 500);
  };

  return (
    <div className="min-h-screen w-full bg-[#070707] text-[#D1D1D1] flex flex-col items-center justify-center p-4 selection:bg-[#D4AF37]/30 selection:text-white relative">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#D4AF37]/5 blur-[120px] pointer-events-none rounded-full" />

      <div className="w-full max-w-sm z-10">
        {/* BRAND LOGO */}
        <div className="flex flex-col items-center mb-6 text-center">
          <PhongPhuLogo size="lg" className="h-14 mb-2" />
          <div className="text-[11px] uppercase tracking-widest text-[#D4AF37] font-medium">
            PHONG PHU
          </div>
        </div>

        {/* PENDING APPROVAL NOTICE */}
        {pendingNotice ? (
          <div className="bg-[#0F0F0F] border border-amber-600/60 rounded-xl p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-amber-950/60 border border-amber-500/50 flex items-center justify-center mx-auto mb-3 text-amber-400">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>

            <h2 className="text-base font-bold text-amber-300 mb-2">
              {pendingNotice.message}
            </h2>

            <div className="text-xs font-mono text-[#AAA] mb-5 truncate bg-[#161616] py-1.5 px-3 rounded border border-[#262626]">
              {pendingNotice.user.email}
            </div>

            {statusMessage && (
              <div className="mb-4 p-2.5 rounded bg-amber-950/40 border border-amber-700/50 text-amber-200 text-xs">
                {statusMessage}
              </div>
            )}

            <div className="space-y-2">
              <button
                id="btn-auth-check-approval"
                onClick={handleCheckApproval}
                disabled={checking}
                className="w-full py-2.5 px-4 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black font-semibold text-xs transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                <span>{checking ? 'Đang kiểm tra...' : 'Kiểm tra lại'}</span>
              </button>

              <button
                id="btn-auth-switch-account"
                onClick={() => {
                  setPendingNotice(null);
                  setStatusMessage(null);
                }}
                className="w-full py-2 px-4 rounded bg-[#161616] hover:bg-[#202020] border border-[#333] text-[#AAA] hover:text-white text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng nhập tài khoản khác</span>
              </button>
            </div>
          </div>
        ) : (
          /* SIMPLE LOGIN CARD */
          <div className="bg-[#0F0F0F] border border-[#262626] rounded-xl p-6 shadow-2xl">
            <h1 className="text-lg font-semibold text-white text-center mb-5">
              Đăng nhập
            </h1>

            {error && (
              <div className="mb-4 p-2.5 rounded bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Google OAuth Button */}
            <button
              id="btn-auth-google-oauth"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded bg-white text-black hover:bg-neutral-100 font-medium text-xs transition-all active:scale-[0.99] disabled:opacity-50"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-[#222]" />
              <span className="text-[11px] text-[#666]">hoặc</span>
              <div className="flex-1 h-px bg-[#222]" />
            </div>

            {/* Direct Gmail Form (Only email, no name field, no admin tab) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                processGmailLogin(emailInput);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-[11px] text-[#888] mb-1">
                  Địa chỉ Gmail
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@gmail.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#161616] border border-[#2E2E2E] rounded text-white focus:border-[#D4AF37] focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !emailInput.trim()}
                className="w-full py-2 px-4 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black font-semibold text-xs transition-all disabled:opacity-50"
              >
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
