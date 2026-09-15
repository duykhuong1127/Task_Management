import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { AuthLoadingScreen } from './AuthLoadingScreen';
import { PhongPhuLogo } from './PhongPhuLogo';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.7H.95v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.96 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.28-1.72V4.95H.95A9 9 0 0 0 0 9c0 1.45.35 2.82.95 4.05l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.45 1.35l2.58-2.58A8.64 8.64 0 0 0 9 0 9 9 0 0 0 .95 4.95l3.01 2.33c.71-2.12 2.7-3.7 5.04-3.7Z" />
    </svg>
  );
}

export function LoginPage() {
  const { status, error, signInWithGoogle, signInWithEmail } = useAuth();
  const [customEmail, setCustomEmail] = useState('');
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);

  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  if (status === 'loading' && !error) return <AuthLoadingScreen />;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) return;

    setIsSubmittingEmail(true);
    try {
      await signInWithEmail(customEmail.trim());
    } catch {
      // Error handled by AuthContext
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  return (
    <main className="auth-ui min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-5 font-sans">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-7 py-9 sm:px-10 sm:py-11 shadow-[0_20px_60px_rgba(15,23,42,0.10)] text-center">
        <PhongPhuLogo size="lg" className="h-14 mx-auto mb-7" />
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Quản lý Công việc</h1>
        <p className="mt-2 text-sm text-slate-600">Đăng nhập để quản lý công việc của bạn</p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-700 animate-in fade-in" role="alert">
            <div className="font-medium text-xs leading-relaxed">{error}</div>
          </div>
        )}

        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          disabled={status === 'loading'}
          className="mt-6 w-full min-h-12 rounded-xl border border-slate-300 bg-white px-5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 hover:shadow disabled:cursor-wait disabled:opacity-70 flex items-center justify-center gap-3 cursor-pointer"
        >
          {status === 'loading' ? <LoaderCircle className="w-[18px] h-[18px] animate-spin text-blue-600" /> : <GoogleIcon />}
          <span>{status === 'loading' ? 'Đang xác thực…' : 'Tiếp tục với Google'}</span>
        </button>

        {/* Direct Email Login Form */}
        <form onSubmit={handleEmailSubmit} className="mt-4 text-left">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-slate-700">Hoặc đăng nhập bằng Email:</span>
          </div>
          <div className="flex gap-2">
            <input
              type="email"
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              placeholder="nhap.email@phongphucorp.com"
              className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
              required
            />
            <button
              type="submit"
              disabled={isSubmittingEmail || !customEmail.trim()}
              className="rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-4 py-2.5 text-xs font-semibold transition cursor-pointer whitespace-nowrap shadow-sm"
            >
              {isSubmittingEmail ? 'Đang xử lý…' : 'Đăng nhập'}
            </button>
          </div>
        </form>

        <p className="mt-6 text-xs leading-5 text-slate-400">
          Tài khoản và mật khẩu của bạn luôn được nhập trực tiếp trên hệ thống bảo mật của Google.
        </p>
      </section>
    </main>
  );
}
