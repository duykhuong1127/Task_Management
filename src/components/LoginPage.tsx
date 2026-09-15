import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ExternalLink, LoaderCircle, Copy, Check, Globe } from 'lucide-react';
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
  const { status, error, signInWithGoogle } = useAuth();
  const [copied, setCopied] = useState(false);

  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  if (status === 'loading' && !error) return <AuthLoadingScreen />;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;

  const openStandalone = () => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  const copyOrigin = () => {
    if (navigator?.clipboard && currentOrigin) {
      navigator.clipboard.writeText(currentOrigin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <main className="auth-ui min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-5 font-sans">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-7 py-9 sm:px-10 sm:py-11 shadow-[0_20px_60px_rgba(15,23,42,0.10)] text-center">
        <PhongPhuLogo size="lg" className="h-14 mx-auto mb-7" />
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Quản lý Công việc</h1>
        <p className="mt-2 text-sm text-slate-600">Đăng nhập bằng tài khoản Google đã được cấp quyền</p>

        {isIframe && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-900 flex items-center justify-between gap-2">
            <span>Đang mở trong khung xem trước. Hãy mở tab mới để đăng nhập ổn định.</span>
            <button
              type="button"
              onClick={openStandalone}
              className="shrink-0 inline-flex items-center gap-1 font-semibold text-amber-900 hover:text-amber-950 underline cursor-pointer"
            >
              <ExternalLink className="h-3 w-3" />
              Mở tab mới
            </button>
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-700 animate-in fade-in" role="alert">
            <div className="font-medium text-xs leading-relaxed">{error}</div>
            <div className="mt-3 pt-3 border-t border-red-200/60 flex items-center justify-between gap-3 text-[11px]">
              <span className="text-red-600">Nếu đang mở trong cửa sổ Preview, hãy thử tab độc lập.</span>
              <button
                type="button"
                onClick={openStandalone}
                className="shrink-0 inline-flex items-center gap-1 font-medium text-red-800 hover:text-red-950 underline cursor-pointer"
              >
                <ExternalLink className="h-3 w-3" />
                Mở tab mới
              </button>
            </div>
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

        <p className="mt-5 text-xs leading-5 text-slate-400">
          Ứng dụng chỉ sử dụng Google Sign-In. Mật khẩu Google không được nhập hoặc lưu trong hệ thống này.
        </p>

        {currentOrigin && (
          <div className="mt-6 pt-5 border-t border-slate-100 text-left">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                <Globe className="h-3.5 w-3.5 text-slate-400" />
                Origin đang chạy:
              </span>
              <button
                type="button"
                onClick={copyOrigin}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
              </button>
            </div>
            <div className="mt-1.5 font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 select-all break-all">
              {currentOrigin}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
