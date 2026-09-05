import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  itemName: string;
  itemType?: 'công việc' | 'dự án';
  warningMessage?: string;
  errorMessage?: string | null;
  isDeleting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  itemName,
  itemType = 'công việc',
  warningMessage,
  errorMessage,
  isDeleting = false,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-[#0D0D0D] border border-rose-900/50 rounded-lg shadow-[0_10px_35px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222] bg-[#121212]">
          <div className="flex items-center gap-2.5 text-rose-400">
            <div className="w-8 h-8 rounded-full bg-rose-950/60 border border-rose-800/40 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4 text-rose-400" />
            </div>
            <h3 className="text-sm font-semibold text-white tracking-wide">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#777] hover:text-white hover:bg-[#222] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs">
          <p className="text-[#AAA] leading-relaxed">
            Bạn có chắc chắn muốn xóa {itemType}:{' '}
            <span className="font-semibold text-white bg-[#1A1A1A] px-2 py-0.5 rounded border border-[#333]">
              {itemName}
            </span>
            ?
          </p>

          {warningMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded bg-amber-950/30 border border-amber-800/40 text-amber-200/90">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-snug">{warningMessage}</div>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2 p-3 rounded bg-rose-950/40 border border-rose-800/60 text-rose-200 text-[11px]">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="px-5 py-3.5 bg-[#0A0A0A] border-t border-[#1F1F1F] flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-4 py-2 rounded bg-[#1A1A1A] hover:bg-[#262626] text-[#CCC] hover:text-white border border-[#333] text-xs font-medium transition-all"
          >
            Hủy Bỏ
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_2px_10px_rgba(225,29,72,0.3)] disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Đang xóa...' : 'Xác Nhận Xóa'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
