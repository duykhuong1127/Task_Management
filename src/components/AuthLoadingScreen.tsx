import { LoaderCircle } from 'lucide-react';
import { PhongPhuLogo } from './PhongPhuLogo';

export function AuthLoadingScreen() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6" aria-live="polite">
      <div className="text-center space-y-5">
        <PhongPhuLogo size="lg" className="h-14 mx-auto" />
        <LoaderCircle className="w-7 h-7 text-blue-600 animate-spin mx-auto" />
        <p className="text-sm text-slate-600">Đang kiểm tra phiên đăng nhập…</p>
      </div>
    </main>
  );
}
