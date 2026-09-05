import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { dataService } from '../services/dataService';
import { PhongPhuLogo } from './PhongPhuLogo';
import { User } from '@shared/types/models';
import {
  ShieldCheck,
  Mail,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Clock,
  Shield,
  UserCheck,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  Lock,
} from 'lucide-react';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'member' | 'admin'>('member');
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pendingNotice, setPendingNotice] = useState<{
    user: User;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 1. Google OAuth Popup Sign In
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      if (auth && googleProvider) {
        const result = await signInWithPopup(auth, googleProvider);
        const fbUser = result.user;
        if (fbUser && fbUser.email) {
          processGmailLogin(
            fbUser.email,
            fbUser.displayName || undefined,
            fbUser.photoURL || undefined
          );
          return;
        }
      }
      // If auth not ready in sandbox iframe
      if (emailInput) {
        processGmailLogin(emailInput, nameInput);
      } else {
        setError('Vui lòng nhập địa chỉ Gmail bên dưới để tiếp tục.');
      }
    } catch (err: any) {
      console.warn('Google popup error, prompting direct Gmail entry:', err);
      setError(
        'Popup Google OAuth bị hạn chế bởi bảo mật trình duyệt hoặc môi trường iFrame. Vui lòng nhập địa chỉ Gmail bên dưới để tiếp tục.'
      );
    } finally {
      setLoading(false);
    }
  };

  // 2. Direct Gmail Login / Registration
  const processGmailLogin = (email: string, name?: string, photo?: string) => {
    if (!email || !email.includes('@')) {
      setError('Vui lòng nhập địa chỉ Gmail hợp lệ (có chứa ký tự @).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = dataService.loginWithGoogle(email, name, photo);

      if (res.success && !res.needsApproval) {
        // User already approved by admin
        onLoginSuccess(res.user);
      } else {
        // User needs admin approval (Chưa được duyệt)
        setPendingNotice({
          user: res.user,
          message: res.message || 'Vui lòng chờ admin xét duyệt tài khoản',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi xử lý đăng nhập Gmail.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Admin Direct Login (No approval required)
  const handleAdminLogin = () => {
    setLoading(true);
    setError(null);
    try {
      const res = dataService.loginAsAdmin();
      if (res.success) {
        onLoginSuccess(res.user);
      } else {
        setError('Không tìm thấy tài khoản Quản trị viên hệ thống.');
      }
    } catch (err: any) {
      setError('Lỗi đăng nhập Admin: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 4. Check Approval Status
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
    }, 600);
  };

  return (
    <div className="min-h-screen w-full bg-[#070707] text-[#D1D1D1] flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-[#D4AF37]/30 selection:text-white relative overflow-y-auto">
      {/* Background Accent Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-72 bg-[#D4AF37]/5 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 right-10 w-80 h-80 bg-red-950/10 blur-[100px] pointer-events-none rounded-full" />

      <div className="w-full max-w-xl my-auto z-10 animate-in fade-in duration-300">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <PhongPhuLogo size="lg" className="h-16" />
          </div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-[#D4AF37] font-semibold">
            CÔNG TY CỔ PHẦN DỆT GIA DỤNG PHONG PHÚ
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1 tracking-tight">
            Hệ Thống Quản Lý Công Việc & Tiến Độ
          </h1>
          <p className="text-xs text-[#888] mt-1.5 max-w-md mx-auto">
            Nền tảng giao việc, giám sát tiến độ dự án và lưu trữ tài liệu an toàn theo tiêu chuẩn bảo mật doanh nghiệp.
          </p>
        </div>

        {/* PENDING APPROVAL NOTIFICATION MODAL / SCREEN */}
        {pendingNotice ? (
          <div className="bg-[#0F0F0F] border-2 border-amber-600/70 rounded-xl p-6 sm:p-8 shadow-2xl relative text-center animate-in zoom-in-95 duration-200">
            {/* Pulsing Icon */}
            <div className="w-16 h-16 rounded-full bg-amber-950/60 border border-amber-500/60 flex items-center justify-center mx-auto mb-4 text-amber-400 shadow-lg">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>

            {/* Exact Required Phrase */}
            <div className="inline-block px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/60 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-3">
              Thông Báo Hệ Thống
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-amber-300 mb-2">
              {pendingNotice.message}
            </h2>

            <p className="text-xs text-[#aaa] max-w-md mx-auto leading-relaxed mb-6">
              Tài khoản của bạn đã được đăng ký thành công trên hệ thống. Theo quy định bảo mật,
              <strong> Quản trị viên (Admin) sẽ phải xét duyệt và phân quyền dự án</strong> thì bạn mới có thể đăng nhập vào không gian làm việc.
            </p>

            {/* Registrant User Information Card */}
            <div className="p-4 rounded-lg bg-[#151515] border border-[#2a2a2a] text-left text-xs space-y-2 mb-6 max-w-md mx-auto">
              <div className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-semibold">
                Thông tin tài khoản đăng ký:
              </div>
              <div className="flex items-center justify-between border-b border-[#222] pb-1.5">
                <span className="text-[#888]">Họ và tên:</span>
                <span className="font-semibold text-white">{pendingNotice.user.displayName}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#222] pb-1.5">
                <span className="text-[#888]">Tài khoản Gmail:</span>
                <span className="font-mono text-[#D4AF37]">{pendingNotice.user.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#888]">Trạng thái:</span>
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                  Chờ Admin duyệt
                </span>
              </div>
            </div>

            {/* Status Feedback */}
            {statusMessage && (
              <div className="mb-4 p-3 rounded bg-amber-950/40 border border-amber-700/50 text-amber-200 text-xs flex items-center justify-center gap-2 max-w-md mx-auto">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
              <button
                id="btn-auth-check-approval"
                onClick={handleCheckApproval}
                disabled={checking}
                className="flex-1 py-2.5 px-4 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow"
              >
                <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                <span>{checking ? 'Đang kiểm tra...' : 'Kiểm tra trạng thái duyệt'}</span>
              </button>

              <button
                id="btn-auth-switch-account"
                onClick={() => {
                  setPendingNotice(null);
                  setStatusMessage(null);
                }}
                className="py-2.5 px-4 rounded bg-[#1C1C1C] hover:bg-[#252525] border border-[#333] text-white font-medium text-xs transition-all"
              >
                Đăng nhập tài khoản khác
              </button>
            </div>

            {/* Testing Fast-Track */}
            <div className="mt-6 pt-4 border-t border-[#222] max-w-md mx-auto">
              <div className="text-[11px] text-[#777] mb-2">
                Dành cho người kiểm thử & đánh giá hệ thống:
              </div>
              <button
                id="btn-auth-switch-admin-demo"
                onClick={handleAdminLogin}
                className="w-full py-2 px-3 rounded bg-amber-950/30 hover:bg-amber-950/60 border border-amber-800/40 text-amber-200 hover:text-amber-100 text-xs font-medium transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                <span>Đăng nhập Admin để phê duyệt cho tài khoản này ngay</span>
              </button>
            </div>
          </div>
        ) : (
          /* REGULAR AUTHENTICATION / REGISTRATION CARD */
          <div className="bg-[#0F0F0F] border border-[#2a2a2a] rounded-xl p-6 sm:p-8 shadow-2xl relative">
            {/* Tabs for Member vs Admin */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#161616] border border-[#262626] rounded-lg mb-6 text-xs font-semibold">
              <button
                id="tab-auth-member"
                onClick={() => {
                  setActiveTab('member');
                  setError(null);
                }}
                className={`py-2 px-3 rounded transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'member'
                    ? 'bg-[#D4AF37] text-black shadow font-bold'
                    : 'text-[#888] hover:text-white'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Thành Viên (Gmail)</span>
              </button>

              <button
                id="tab-auth-admin"
                onClick={() => {
                  setActiveTab('admin');
                  setError(null);
                }}
                className={`py-2 px-3 rounded transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'admin'
                    ? 'bg-[#D4AF37] text-black shadow font-bold'
                    : 'text-[#888] hover:text-white'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Quản Trị Viên (Admin)</span>
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-5 p-3 rounded bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{error}</div>
              </div>
            )}

            {/* TAB 1: THÀNH VIÊN ĐĂNG KÝ / ĐĂNG NHẬP BẰNG GMAIL */}
            {activeTab === 'member' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Policy Banner */}
                <div className="p-3 rounded bg-[#141414] border border-[#262626] text-xs text-[#999] leading-relaxed">
                  <span className="font-semibold text-white">Yêu cầu truy cập: </span>
                  Bất kỳ thành viên nào khi muốn truy cập ứng dụng bắt buộc phải đăng ký / đăng nhập bằng tài khoản Gmail. Khi đăng ký, tài khoản sẽ được chuyển đến Admin xét duyệt trước khi có thể đăng nhập.
                </div>

                {/* 1. Google OAuth Popup Button */}
                <button
                  id="btn-auth-google-oauth"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded bg-white text-black hover:bg-neutral-200 font-semibold text-sm transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
                >
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
                  <span>{loading ? 'Đang xác thực...' : 'Đăng Ký / Đăng Nhập Với Google (Gmail)'}</span>
                </button>

                {/* 2. Direct Gmail Input Form */}
                <div className="pt-3 border-t border-[#222]">
                  <div className="text-[11px] font-medium text-[#777] uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Hoặc nhập thông tin Gmail trực tiếp:</span>
                    <Mail className="w-3.5 h-3.5 text-[#D4AF37]" />
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      processGmailLogin(emailInput, nameInput);
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <label className="block text-[11px] text-[#aaa] mb-1">
                        Địa chỉ Gmail <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="vidu@gmail.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#161616] border border-[#333] rounded text-white focus:border-[#D4AF37] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-[#aaa] mb-1">
                        Họ và tên của bạn
                      </label>
                      <input
                        type="text"
                        placeholder="Nguyễn Văn A"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#161616] border border-[#333] rounded text-white focus:border-[#D4AF37] focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !emailInput.trim()}
                      className="w-full py-2.5 px-4 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow"
                    >
                      {loading ? 'Đang xử lý...' : 'Xác Nhận Đăng Ký / Đăng Nhập Bằng Gmail'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* TAB 2: QUẢN TRỊ VIÊN (ADMIN PORTAL - TRỪ ADMIN KHÔNG CẦN DUYỆT) */}
            {activeTab === 'admin' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="p-4 rounded-lg bg-amber-950/20 border border-amber-700/40 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-amber-300">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>Cổng Quản Trị Hệ Thống (Admin Bypass)</span>
                  </div>
                  <p className="text-[#ccc] leading-relaxed">
                    Theo quy định, Quản trị viên (Admin) không phải chờ xét duyệt và có toàn quyền:
                  </p>
                  <ul className="text-[#aaa] list-disc list-inside space-y-1 text-[11px]">
                    <li>Duyệt tài khoản Gmail của các thành viên đăng ký</li>
                    <li>Phân quyền và chỉ định dự án tham gia</li>
                    <li>Giám sát tiến độ toàn bộ công việc và kiểm toán nhật ký</li>
                  </ul>
                </div>

                <button
                  id="btn-auth-admin-login"
                  onClick={handleAdminLogin}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow"
                >
                  <Lock className="w-4 h-4" />
                  <span>Đăng Nhập Với Tư Cách Quản Trị Viên (Admin)</span>
                </button>
              </div>
            )}

            {/* Quick Demo Test Buttons */}
            <div className="mt-6 pt-4 border-t border-[#222]">
              <div className="text-[10px] uppercase font-mono text-[#666] mb-2 flex items-center justify-between">
                <span>Tài khoản thử nghiệm nhanh:</span>
                <Sparkles className="w-3 h-3 text-[#D4AF37]" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <button
                  onClick={() => {
                    setActiveTab('admin');
                    handleAdminLogin();
                  }}
                  className="p-2 rounded bg-[#161616] hover:bg-[#202020] border border-amber-800/40 text-left text-amber-300 transition-all truncate"
                >
                  👑 Admin: admin@company.com
                </button>
                <button
                  onClick={() => {
                    setActiveTab('member');
                    processGmailLogin('duykhuong332@gmail.com', 'Duy Khương');
                  }}
                  className="p-2 rounded bg-[#161616] hover:bg-[#202020] border border-[#D4AF37]/50 text-left text-[#D4AF37] font-semibold transition-all truncate"
                >
                  ⭐ Gmail: duykhuong332@gmail.com
                </button>
                <button
                  onClick={() => {
                    setActiveTab('member');
                    processGmailLogin('a@gmail.com', 'Nguyễn Văn A (Lead)');
                  }}
                  className="p-2 rounded bg-[#161616] hover:bg-[#202020] border border-[#333] text-left text-[#bbb] transition-all truncate"
                >
                  👔 Lead đã duyệt: a@gmail.com
                </button>
                <button
                  onClick={() => {
                    setActiveTab('member');
                    const rand = Math.floor(Math.random() * 900) + 100;
                    processGmailLogin(`nhanvien${rand}@gmail.com`, `Nhân Viên Mới ${rand}`);
                  }}
                  className="p-2 rounded bg-[#161616] hover:bg-[#202020] border border-[#333] text-left text-amber-200/90 transition-all truncate"
                >
                  ➕ Đăng ký tài khoản mới thử nghiệm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Note */}
        <div className="text-center text-[11px] text-[#555] mt-6">
          CTY CP Dệt Gia Dụng Phong Phú • Asia/Ho_Chi_Minh • asia-southeast1
        </div>
      </div>
    </div>
  );
};
