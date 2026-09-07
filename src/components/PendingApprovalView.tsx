import React, { useState } from 'react';
import { User } from '@shared/types/models';
import { dataService } from '../services/dataService';
import { PhongPhuLogo } from './PhongPhuLogo';
import { Clock, RefreshCw, LogOut } from 'lucide-react';

interface PendingApprovalViewProps {
  currentUser: User;
  onOpenLoginModal: () => void;
  onRefresh: () => void;
}

export const PendingApprovalView: React.FC<PendingApprovalViewProps> = ({
  currentUser,
  onOpenLoginModal,
  onRefresh,
}) => {
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  const handleCheckStatus = () => {
    setChecking(true);
    setCheckMessage(null);
    setTimeout(() => {
      const refreshed = dataService.getUserById(currentUser.uid);
      if (refreshed && refreshed.status === 'ACTIVE') {
        onRefresh();
      } else {
        setCheckMessage('Vui lòng chờ admin xét duyệt tài khoản');
      }
      setChecking(false);
    }, 400);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center max-w-sm mx-auto animate-in fade-in">
      <div className="w-full bg-[#0F0F0F] border border-[#2E2E2E] rounded-xl p-6 shadow-2xl">
        <div className="flex justify-center mb-4">
          <PhongPhuLogo size="lg" className="h-12" />
        </div>

        <div className="w-12 h-12 rounded-full bg-amber-950/60 border border-amber-500/50 flex items-center justify-center mx-auto mb-3 text-amber-400">
          <Clock className="w-6 h-6 animate-pulse" />
        </div>

        <h2 className="text-base font-bold text-amber-300 mb-2">
          Vui lòng chờ admin xét duyệt tài khoản
        </h2>

        <div className="text-xs font-mono text-[#AAA] mb-5 truncate bg-[#161616] py-1.5 px-3 rounded border border-[#262626]">
          {currentUser.email}
        </div>

        {checkMessage && (
          <div className="mb-4 p-2.5 rounded bg-amber-950/40 border border-amber-700/50 text-amber-200 text-xs">
            {checkMessage}
          </div>
        )}

        <div className="space-y-2">
          <button
            id="btn-refresh-approval-status"
            onClick={handleCheckStatus}
            disabled={checking}
            className="w-full py-2.5 px-4 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black font-semibold text-xs transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Đang kiểm tra...' : 'Kiểm tra lại'}</span>
          </button>

          <button
            id="btn-switch-account-pending"
            onClick={onOpenLoginModal}
            className="w-full py-2 px-4 rounded bg-[#161616] hover:bg-[#202020] border border-[#333] text-[#AAA] hover:text-white text-xs transition-all flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng nhập tài khoản khác</span>
          </button>
        </div>
      </div>
    </div>
  );
};
