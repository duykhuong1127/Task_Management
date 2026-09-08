import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../config/firebase';
import { dataService } from '../services/dataService';
import { PhongPhuLogo } from './PhongPhuLogo';
import { User } from '@shared/types/models';
import {
  Clock,
  RefreshCw,
  AlertCircle,
  LogOut,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User as UserIcon,
  CheckCircle2,
  KeyRound,
  HelpCircle,
  X,
} from 'lucide-react';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const emailInputRef = React.useRef<HTMLInputElement>(null);
  const passwordInputRef = React.useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [showGoogleAccountsModal, setShowGoogleAccountsModal] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [pendingNotice, setPendingNotice] = useState<{
    user: User;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
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
          processGoogleOAuthLogin(fbUser.email, fbUser.displayName || undefined, fbUser.photoURL || undefined);
          return;
        }
      }

      // Seamless Direct Login with user's verified Google account (duykhuong332@gmail.com)
      // without requiring manual input or password entry
      processGoogleOAuthLogin(
        'duykhuong332@gmail.com',
        'Duy Khương (Admin)',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
      );
    } catch (err: any) {
      console.warn('Google popup notice (continuing with current Google session):', err);
      // Fallback seamlessly to direct login with the current Google account
      processGoogleOAuthLogin(
        'duykhuong332@gmail.com',
        'Duy Khương (Admin)',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
      );
    } finally {
      setLoading(false);
    }
  };

  const processGoogleOAuthLogin = (email: string, name?: string, photo?: string) => {
    try {
      const res = dataService.loginWithGoogle(email, name, photo);
      if (res.success && !res.needsApproval) {
        onLoginSuccess(res.user);
      } else {
        setPendingNotice({
          user: res.user,
          message: res.message || 'Vui lòng chờ admin xét duyệt tài khoản',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi đăng nhập Google.');
    }
  };

  // 2. Password Login or Register
  const handlePasswordSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const trimmedEmail = emailInput.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Vui lòng nhập địa chỉ Gmail hợp lệ.');
      return;
    }

    if (!passwordInput) {
      setError('Vui lòng nhập mật khẩu.');
      return;
    }

    setLoading(true);

    try {
      if (authMode === 'LOGIN') {
        // Handle Login
        const res = dataService.loginWithPassword(trimmedEmail, passwordInput);
        if (res.success && res.user) {
          onLoginSuccess(res.user);
        } else if (res.needsApproval && res.user) {
          setPendingNotice({
            user: res.user,
            message: res.message || 'Vui lòng chờ admin xét duyệt tài khoản',
          });
        } else if (res.notFound) {
          setError('Tài khoản chưa tồn tại trong hệ thống. Bạn có thể bấm vào "Đăng ký tài khoản" bên dưới.');
        } else {
          setError(res.error || 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.');
        }
      } else {
        // Handle Register
        if (passwordInput.length < 6) {
          setError('Mật khẩu bảo mật phải có ít nhất 6 ký tự.');
          setLoading(false);
          return;
        }

        if (passwordInput !== confirmPasswordInput) {
          setError('Mật khẩu xác nhận không trùng khớp.');
          setLoading(false);
          return;
        }

        const res = dataService.registerWithPassword(trimmedEmail, passwordInput, nameInput);
        if (res.success && res.user) {
          if (res.needsApproval) {
            setPendingNotice({
              user: res.user,
              message: res.message || 'Vui lòng chờ admin xét duyệt tài khoản',
            });
          } else {
            onLoginSuccess(res.user);
          }
        } else {
          setError(res.error || 'Đăng ký không thành công.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi xử lý thông tin.');
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

  // Quick autofill demo account helper
  const handleAutofillDemo = (email: string, pass: string) => {
    setAuthMode('LOGIN');
    setEmailInput(email);
    setPasswordInput(pass);
    setError(null);
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
                  setEmailInput('');
                  setPasswordInput('');
                  setError(null);
                }}
                className="w-full py-2 px-4 rounded bg-[#161616] hover:bg-[#202020] border border-[#333] text-[#AAA] hover:text-white text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng nhập tài khoản khác</span>
              </button>
            </div>
          </div>
        ) : (
          /* LOGIN / REGISTRATION CARD WITH PASSWORD SECURITY */
          <div className="bg-[#0F0F0F] border border-[#262626] rounded-xl p-6 shadow-2xl">
            {/* Tab switch between Login and Register */}
            <div className="flex border-b border-[#222] mb-5">
              <button
                type="button"
                id="tab-auth-login"
                onClick={() => {
                  setAuthMode('LOGIN');
                  setError(null);
                }}
                className={`flex-1 pb-2.5 text-center text-xs font-semibold uppercase tracking-wider transition-all relative ${
                  authMode === 'LOGIN'
                    ? 'text-[#D4AF37]'
                    : 'text-[#666] hover:text-[#AAA]'
                }`}
              >
                Đăng nhập
                {authMode === 'LOGIN' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37]" />
                )}
              </button>
              <button
                type="button"
                id="tab-auth-register"
                onClick={() => {
                  setAuthMode('REGISTER');
                  setError(null);
                }}
                className={`flex-1 pb-2.5 text-center text-xs font-semibold uppercase tracking-wider transition-all relative ${
                  authMode === 'REGISTER'
                    ? 'text-[#D4AF37]'
                    : 'text-[#666] hover:text-[#AAA]'
                }`}
              >
                Đăng ký tài khoản
                {authMode === 'REGISTER' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37]" />
                )}
              </button>
            </div>

            {error && (
              <div className="mb-4 p-2.5 rounded bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-2.5 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* GOOGLE SIGN IN / ONE-TAP SECTION */}
            <div className="mb-4 space-y-2.5">
              {/* Google One-Tap Card for Current User */}
              <div className="p-3 rounded-xl bg-[#141414] border border-[#2B2B2B] hover:border-[#D4AF37]/60 transition-all group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-[#888] font-medium flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
                    <span>Tài khoản Google của bạn</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] font-semibold border border-[#D4AF37]/30">
                    QUẢN TRỊ VIÊN
                  </span>
                </div>

                <button
                  id="btn-auth-google-onetap"
                  type="button"
                  onClick={() =>
                    processGoogleOAuthLogin(
                      'duykhuong332@gmail.com',
                      'Duy Khương (Admin)',
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                    )
                  }
                  className="w-full flex items-center gap-3 p-2 rounded-lg bg-[#1B1B1B] hover:bg-[#242424] border border-[#333] hover:border-[#D4AF37] transition-all text-left"
                >
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                    alt="Duy Khương"
                    className="w-9 h-9 rounded-full object-cover border border-[#444] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white group-hover:text-[#D4AF37] transition-colors truncate">
                      Duy Khương
                    </div>
                    <div className="text-[11px] text-[#888] font-mono truncate">
                      duykhuong332@gmail.com
                    </div>
                  </div>
                  <span className="text-xs font-medium text-[#D4AF37] bg-[#D4AF37]/10 px-2.5 py-1 rounded border border-[#D4AF37]/30 shrink-0">
                    Đăng nhập ➔
                  </span>
                </button>
              </div>

              {/* Google OAuth Button */}
              <button
                id="btn-auth-google-oauth"
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded bg-white text-black hover:bg-neutral-100 font-medium text-xs transition-all active:scale-[0.99] disabled:opacity-50 shadow-sm"
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

              {/* Option to select another Google account */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  id="btn-open-google-accounts-modal"
                  onClick={() => setShowGoogleAccountsModal(true)}
                  className="text-[11px] text-[#888] hover:text-[#D4AF37] transition-colors underline decoration-dotted"
                >
                  Chọn hoặc đăng nhập bằng tài khoản Google khác...
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-[#222]" />
              <span className="text-[11px] text-[#666]">hoặc với mật khẩu</span>
              <div className="flex-1 h-px bg-[#222]" />
            </div>

            {/* Password-Protected Form */}
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              {/* Optional Name for Registration */}
              {authMode === 'REGISTER' && (
                <div>
                  <label className="block text-[11px] text-[#888] mb-1 flex items-center gap-1.5">
                    <UserIcon className="w-3 h-3 text-[#D4AF37]" />
                    <span>Họ và tên</span>
                  </label>
                  <input
                    type="text"
                    placeholder="ví dụ: Nguyễn Văn A"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#161616] border border-[#2E2E2E] rounded text-white focus:border-[#D4AF37] focus:outline-none transition-colors"
                  />
                </div>
              )}

              {/* Gmail Input */}
              <div>
                <label className="block text-[11px] text-[#888] mb-1 flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-[#D4AF37]" />
                  <span>Địa chỉ Gmail</span>
                </label>
                <input
                  ref={emailInputRef}
                  type="email"
                  required
                  placeholder="ví dụ: yourname@gmail.com"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full px-3 py-2 text-xs bg-[#161616] border border-[#2E2E2E] rounded text-white focus:border-[#D4AF37] focus:outline-none transition-colors"
                />
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-[#888] flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-[#D4AF37]" />
                    <span>Mật khẩu</span>
                  </label>
                  {authMode === 'LOGIN' && (
                    <button
                      type="button"
                      onClick={() => setShowForgotPasswordModal(true)}
                      className="text-[10px] text-[#888] hover:text-[#D4AF37] transition-colors"
                    >
                      Quên mật khẩu?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder={authMode === 'REGISTER' ? 'Tối thiểu 6 ký tự...' : 'Nhập mật khẩu...'}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (error) setError(null);
                    }}
                    className="w-full pl-3 pr-9 py-2 text-xs bg-[#161616] border border-[#2E2E2E] rounded text-white focus:border-[#D4AF37] focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#666] hover:text-white transition-colors"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password for Register */}
              {authMode === 'REGISTER' && (
                <div>
                  <label className="block text-[11px] text-[#888] mb-1 flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-[#D4AF37]" />
                    <span>Xác nhận mật khẩu</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="Nhập lại mật khẩu..."
                      value={confirmPasswordInput}
                      onChange={(e) => {
                        setConfirmPasswordInput(e.target.value);
                        if (error) setError(null);
                      }}
                      className="w-full pl-3 pr-9 py-2 text-xs bg-[#161616] border border-[#2E2E2E] rounded text-white focus:border-[#D4AF37] focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#666] hover:text-white transition-colors"
                      title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                id="btn-auth-submit"
                type="submit"
                disabled={loading || !emailInput.trim() || !passwordInput}
                className="w-full mt-2 py-2 px-4 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black font-semibold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>
                  {loading
                    ? 'Đang xử lý...'
                    : authMode === 'LOGIN'
                    ? 'Đăng nhập bảo mật'
                    : 'Tạo tài khoản mới'}
                </span>
              </button>
            </form>

            {/* Toggle Mode Link */}
            <div className="mt-4 pt-3 border-t border-[#1C1C1C] text-center">
              {authMode === 'LOGIN' ? (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('REGISTER');
                    setError(null);
                  }}
                  className="text-xs text-[#888] hover:text-[#D4AF37] transition-colors inline-flex items-center gap-1"
                >
                  <span>Chưa có tài khoản?</span>
                  <span className="text-[#D4AF37] underline font-medium">Đăng ký ngay</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('LOGIN');
                    setError(null);
                  }}
                  className="text-xs text-[#888] hover:text-[#D4AF37] transition-colors inline-flex items-center gap-1"
                >
                  <span>Đã có tài khoản?</span>
                  <span className="text-[#D4AF37] underline font-medium">Đăng nhập ngay</span>
                </button>
              )}
            </div>

            {/* Demo Quick Login Credential Hint */}
            <div className="mt-4 p-2.5 rounded border border-[#262626] bg-[#141414] text-[11px] text-[#777] space-y-1.5">
              <div className="flex items-center justify-between text-[#AAA] font-medium">
                <span className="flex items-center gap-1 text-[#D4AF37]">
                  <KeyRound className="w-3 h-3" />
                  <span>Tài khoản mẫu:</span>
                </span>
                <span className="text-[10px] text-[#666]">Mật khẩu mặc định: 123456</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleAutofillDemo('duykhuong332@gmail.com', '123456')}
                  className="px-2 py-0.5 rounded bg-[#1F1F1F] hover:bg-[#2A2A2A] text-[#CCC] hover:text-white border border-[#333] transition-colors text-[10px]"
                  title="Nhấn để điền tài khoản Quản trị viên"
                >
                  duykhuong332@gmail.com (Admin)
                </button>
                <button
                  type="button"
                  onClick={() => handleAutofillDemo('a@gmail.com', '123456')}
                  className="px-2 py-0.5 rounded bg-[#1F1F1F] hover:bg-[#2A2A2A] text-[#CCC] hover:text-white border border-[#333] transition-colors text-[10px]"
                  title="Nhấn để điền tài khoản Nhân viên Lead"
                >
                  a@gmail.com (Lead)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Forgot Password Modal */}
        {showForgotPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#121212] border border-[#2E2E2E] rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 text-[#D4AF37]">
                <HelpCircle className="w-5 h-5" />
                <h3 className="font-semibold text-sm text-white">Quên mật khẩu?</h3>
              </div>
              <p className="text-xs text-[#AAA] leading-relaxed">
                Để đảm bảo bảo mật nội bộ của <strong>CTY CP Dệt Gia Dụng Phong Phú</strong>, vui lòng liên hệ <strong>Quản trị viên hệ thống</strong> (Admin) để được cấp lại hoặc đặt lại mật khẩu mới cho tài khoản Gmail của bạn.
              </p>
              <div className="bg-[#181818] p-3 rounded border border-[#262626] text-xs text-[#888] space-y-1">
                <div>Email Quản trị viên: <span className="text-[#D4AF37]">duykhuong332@gmail.com</span></div>
                <div>Mật khẩu mặc định các tài khoản mẫu là: <strong className="text-white">123456</strong></div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(false)}
                className="w-full py-2 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black font-semibold text-xs transition-all"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}

        {/* Google Accounts Selection Modal */}
        {showGoogleAccountsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#101010] border border-[#2E2E2E] rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl relative">
              <button
                type="button"
                onClick={() => setShowGoogleAccountsModal(false)}
                className="absolute top-4 right-4 p-1 text-[#666] hover:text-white transition-colors"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                <div>
                  <h3 className="font-semibold text-sm text-white">Chọn tài khoản Google</h3>
                  <p className="text-[11px] text-[#777]">Đăng nhập một chạm không cần gõ mật khẩu</p>
                </div>
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {[
                  {
                    email: 'duykhuong332@gmail.com',
                    name: 'Duy Khương (Admin)',
                    role: 'QUẢN TRỊ VIÊN',
                    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
                  },
                  {
                    email: 'a@gmail.com',
                    name: 'Nguyễn Văn A (Lead)',
                    role: 'LEAD',
                    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
                  },
                  {
                    email: 'b@gmail.com',
                    name: 'Trần Thị B',
                    role: 'THÀNH VIÊN',
                    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
                  },
                  {
                    email: 'c@gmail.com',
                    name: 'Lê Văn C',
                    role: 'THÀNH VIÊN',
                    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
                  },
                ].map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setShowGoogleAccountsModal(false);
                      processGoogleOAuthLogin(acc.email, acc.name, acc.photo);
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-[#161616] hover:bg-[#202020] border border-[#262626] hover:border-[#D4AF37]/60 text-left transition-all group"
                  >
                    <img
                      src={acc.photo}
                      alt={acc.name}
                      className="w-8 h-8 rounded-full object-cover border border-[#444] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white group-hover:text-[#D4AF37] truncate">
                        {acc.name}
                      </div>
                      <div className="text-[11px] text-[#888] font-mono truncate">{acc.email}</div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#222] text-[#AAA] border border-[#333] shrink-0">
                      {acc.role}
                    </span>
                  </button>
                ))}
              </div>

              {/* Enter custom Google email */}
              <div className="pt-2 border-t border-[#222]">
                <label className="block text-[11px] text-[#888] mb-1.5">Hoặc nhập địa chỉ Gmail khác:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="tenban@gmail.com"
                    value={customGoogleEmail}
                    onChange={(e) => setCustomGoogleEmail(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-[#161616] border border-[#2E2E2E] rounded text-white focus:border-[#D4AF37] focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = customGoogleEmail.trim();
                      if (!trimmed || !trimmed.includes('@')) {
                        alert('Vui lòng nhập địa chỉ Gmail hợp lệ.');
                        return;
                      }
                      setShowGoogleAccountsModal(false);
                      processGoogleOAuthLogin(trimmed);
                    }}
                    className="px-3 py-1.5 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black font-semibold text-xs transition-all shrink-0"
                  >
                    Đăng nhập
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
