/**
 * ProfileDropdown - User profile dropdown menu
 * Extracted from App.tsx Phase 6
 *
 * Accessibility improvements:
 * - Added role="menu" and role="menuitem"
 * - Added aria-label for screen readers
 * - Improved keyboard navigation
 */

import React, { useEffect, useRef } from 'react';
import { Eye, LogOut } from 'lucide-react';
import { UserProfile, ROLE_LABELS, StaffMember } from '../../types';

interface ProfileDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  currentStaffMember: StaffMember | undefined;
  onOpenPermissionView: () => void;
  onLogout: () => void;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  isOpen,
  onClose,
  userProfile,
  currentStaffMember,
  onOpenPermissionView,
  onLogout,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus first menu item when opened
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const firstButton = menuRef.current.querySelector('button');
      firstButton?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[10000]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={menuRef}
        className="fixed right-4 top-16 w-56 bg-white rounded-sm shadow-xl border border-gray-100 py-1 z-[10001] overflow-hidden text-sm"
        role="menu"
        aria-label="사용자 메뉴"
        style={{ display: isOpen ? 'block' : 'none' }}
      >
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
          <p className="font-bold text-gray-800">
            {currentStaffMember
              ? (currentStaffMember.englishName ? `${currentStaffMember.name}(${currentStaffMember.englishName})` : currentStaffMember.name)
              : (userProfile?.displayName || userProfile?.email?.split('@')[0])}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{userProfile?.jobTitle || '직급 미설정'}</p>
          <p className="text-xs text-blue-600 font-medium mt-1">{ROLE_LABELS[userProfile?.role || 'guest']}</p>
        </div>
        <button
          onClick={() => {
            onOpenPermissionView();
            onClose();
          }}
          className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-2 font-medium transition-colors border-b border-gray-100"
          role="menuitem"
          aria-label="내 권한 보기"
        >
          <Eye size={16} aria-hidden="true" /> 권한 보기
        </button>
        <button
          onClick={() => {
            onLogout();
            onClose();
          }}
          className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium transition-colors"
          role="menuitem"
          aria-label="로그아웃"
        >
          <LogOut size={16} aria-hidden="true" /> 로그아웃
        </button>
      </div>
    </>
  );
};
