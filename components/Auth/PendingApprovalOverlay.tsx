/**
 * PendingApprovalOverlay - Shows when user account is pending admin approval
 * Extracted from App.tsx Phase 6
 */

import React from 'react';
import { LogOut } from 'lucide-react';

interface PendingApprovalOverlayProps {
  logoUrl: string;
  onLogout: () => void;
}

export const PendingApprovalOverlay: React.FC<PendingApprovalOverlayProps> = ({
  logoUrl,
  onLogout,
}) => {
  return (
    <div className="fixed inset-0 bg-[#081429] z-50 flex flex-col items-center justify-center text-white p-8 text-center animate-in fade-in duration-300">
      <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center p-2 mb-6 shadow-lg shadow-[#fdb813]/20">
        <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
      </div>
      <h2 className="text-3xl font-black mb-4">관리자 승인 대기중</h2>
      <p className="text-gray-300 max-w-md mb-8 leading-relaxed">
        계정 생성이 완료되었으나, 관리자의 승인이 필요합니다.<br />
        승인이 완료되면 이메일로 알림이 발송되지 않으니,<br />
        잠시 후 다시 로그인해 확인해주세요.
      </p>
      <button
        onClick={onLogout}
        className="px-6 py-3 bg-white text-[#081429] font-bold rounded-xl hover:bg-gray-100 transition-colors flex items-center gap-2"
      >
        <LogOut size={20} /> 로그아웃
      </button>
    </div>
  );
};
