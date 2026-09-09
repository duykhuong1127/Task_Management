import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ExternalLink, LoaderCircle, ShieldCheck, UserCheck } from 'lucide-react';
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

const DEMO_ACCOUNTS = [
  {
    name: 'Duy Khương',
    email: 'duykhuong332@gmail.com',
    role: 'Quản trị viên (ADMIN)',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    name: 'Nguyễn Văn A',
    email: 'a@gmail.com',
    role: 'Trưởng nhóm (LEAD)',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    name: 'Trần Thị B',
    email: 'b@gmail.com',
    role: 'Nhân viên (MEMBER)',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
  },
];

export function LoginPage() {
  const { status, error, signInWithGoogle, signInAsDemoUser } = useAuth();
  const [showDemoOptions, setShowDemoOptions] = useState(false);
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  if (status === 'loading' && !error) return <AuthLoadingScreen />;

  const handleOpenNewTab = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <main className="auth-ui min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-5 font-sans">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-7 py-9 sm:px-10 sm:py-11 shadow-[0_20px_60px_rgba(15,23,42,0.10)] text-center">
        <PhongPhuLogo size="lg" className="h-14 mx-auto mb-7" />
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Quản lý Công việc</h1>
        <p className="mt-2 text-sm text-slate-600">Đăng nhập để quản lý công việc của bạn</p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-700" role="alert">
            <div className="font-medium">{error}</div>
            {isInIframe && (
              <div className="mt-2 pt-2 border-t border-red-200 text-xs text-red-600">
                Gợi ý: Mở ứng dụng trong tab mới hoặc chọn tài khoản đăng nhập nhanh bên dưới để bỏ qua hạn chế khung nhúng.
              </div>
            )}
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

        {isInIframe && (
          <button
            type="button"
            onClick={handleOpenNewTab}
            className="mt-3 w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            <span>Mở ứng dụng trong tab mới (cho phép đăng nhập Google)</span>
          </button>
        )}

        {/* Quick login for preview & testing */}
        <div className="mt-7 pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowDemoOptions(!showDemoOptions)}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            <span>{showDemoOptions ? 'Thu gọn đăng nhập nhanh' : 'Đăng nhập nhanh cho bản xem trước (Demo)'}</span>
          </button>

          {(showDemoOptions || Boolean(error)) && (
            <div className="mt-4 space-y-2 text-left animate-in fade-in duration-200">
              <p className="text-xs text-slate-500 mb-2 text-center">
                Chọn tài khoản để đăng nhập trực tiếp mà không cần cấu hình popup:
              </p>
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => signInAsDemoUser(acc.email)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-blue-50/60 hover:border-blue-200 transition flex items-center justify-between group cursor-pointer text-left"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-semibold text-slate-900 group-hover:text-blue-900 flex items-center gap-1.5">
                      {acc.name}
                      {acc.role.includes('ADMIN') && <ShieldCheck className="w-3.5 h-3.5 text-amber-600 inline" />}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{acc.email}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${acc.badgeColor}`}>
                    {acc.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="mt-6 text-xs leading-5 text-slate-400">
          Tài khoản và mật khẩu của bạn luôn được nhập trực tiếp trên hệ thống bảo mật của Google.
        </p>
      </section>
    </main>
  );
}
