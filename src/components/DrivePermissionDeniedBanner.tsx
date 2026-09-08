import React, { useState } from 'react';
import { User } from '@shared/types/models';
import { GoogleDriveConsentModal } from './GoogleDriveConsentModal';
import { ShieldAlert, HardDrive, ArrowRight, Lock } from 'lucide-react';

interface DrivePermissionDeniedBannerProps {
  user: User;
  onPermissionChanged?: () => void;
}

export const DrivePermissionDeniedBanner: React.FC<DrivePermissionDeniedBannerProps> = ({
  user,
  onPermissionChanged,
}) => {
  const [showConsentModal, setShowConsentModal] = useState(false);

  // If user has granted permission, no banner needed
  if (user.driveAccessStatus === 'GRANTED') {
    return null;
  }

  // If user denied permission, show persistent high-visibility warning banner
  if (user.driveAccessStatus === 'DENIED') {
    return (
      <>
        <div
          id="banner-drive-denied-warning"
          className="bg-gradient-to-r from-rose-950/90 via-[#250b10] to-[#1a080c] border-b border-rose-800/60 px-4 py-2.5 text-rose-200"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-white">Quyền Giao việc đang bị KHÓA</span>
                <span className="text-rose-300 ml-1.5 hidden md:inline">
                  — Bạn đã từ chối cấp quyền Google Drive. Quản trị viên (Admin) đã nhận được báo cáo vi phạm quy định lưu trữ dữ liệu.
                </span>
              </div>
            </div>

            <button
              type="button"
              id="btn-re-grant-drive-permission"
              onClick={() => setShowConsentModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-medium text-xs shadow-md shadow-blue-500/20 flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Cấp quyền Google Drive ngay</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {showConsentModal && (
          <GoogleDriveConsentModal
            user={user}
            isOpen={showConsentModal}
            onClose={() => setShowConsentModal(false)}
            onDecisionComplete={() => {
              if (onPermissionChanged) onPermissionChanged();
            }}
          />
        )}
      </>
    );
  }

  return null;
};
