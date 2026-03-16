/**
 * ProfileDropdown - User profile dropdown menu
 * Extracted from App.tsx Phase 6
 *
 * Accessibility improvements:
 * - Added role="menu" and role="menuitem"
 * - Added aria-label for screen readers
 * - Improved keyboard navigation
 */

import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, LogOut, KeyRound, X } from 'lucide-react';
import { getAuth, reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth';
import { UserProfile, ROLE_LABELS, StaffMember } from '../../types';
import { getKoreanErrorMessage } from '../../utils/errorMessages';

interface ProfileDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  currentStaffMember: StaffMember | undefined;
  onOpenPermissionView: () => void;
  onLogout: () => void;
}

/** 비밀번호 변경 모달 */
const ChangePasswordModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (!currentPassword) {
      setResult({ type: 'error', msg: '현재 비밀번호를 입력해주세요.' });
      return;
    }
    if (newPassword.length < 6) {
      setResult({ type: 'error', msg: '새 비밀번호는 6자 이상이어야 합니다.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setResult({ type: 'error', msg: '새 비밀번호가 일치하지 않습니다.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user || !user.email) {
        setResult({ type: 'error', msg: '로그인 정보를 찾을 수 없습니다.' });
        return;
      }

      // 현재 비밀번호로 재인증
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // 새 비밀번호로 변경
      await updatePassword(user, newPassword);

      setResult({ type: 'success', msg: '비밀번호가 변경되었습니다.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setResult({ type: 'error', msg: getKoreanErrorMessage(err, '비밀번호 변경에 실패했습니다.') });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10100] p-4" onClick={onClose}>
      <div className="bg-white rounded-sm shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-bold text-primary">비밀번호 변경</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-sm transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">현재 비밀번호</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setResult(null); }}
                placeholder="현재 비밀번호 입력"
                className="w-full px-3 py-1.5 pr-9 text-sm border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                autoFocus
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">새 비밀번호</label>
            <div className="relative">
              <input
                type={showNewPw ? "text" : "password"}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setResult(null); }}
                placeholder="6자 이상"
                minLength={6}
                className="w-full px-3 py-1.5 pr-9 text-sm border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
              <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">새 비밀번호 확인</label>
            <div className="relative">
              <input
                type={showConfirmPw ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setResult(null); }}
                placeholder="새 비밀번호 재입력"
                className={`w-full px-3 py-1.5 pr-9 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent ${
                  confirmPassword && newPassword !== confirmPassword ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
              />
              <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xxs text-red-500 mt-0.5">비밀번호가 일치하지 않습니다.</p>
            )}
          </div>

          {result && (
            <p className={`text-xs font-medium ${result.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {result.msg}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-sm transition-colors"
              disabled={isSubmitting}
            >
              {result?.type === 'success' ? '닫기' : '취소'}
            </button>
            {result?.type !== 'success' && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-sm hover:bg-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <KeyRound className="w-3.5 h-3.5" />
                )}
                <span>변경</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  isOpen,
  onClose,
  userProfile,
  currentStaffMember,
  onOpenPermissionView,
  onLogout,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

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

  if (!isOpen && !showPasswordModal) return null;

  return (
    <>
      {isOpen && (
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
                setShowPasswordModal(true);
                onClose();
              }}
              className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-2 font-medium transition-colors border-b border-gray-100"
              role="menuitem"
              aria-label="비밀번호 변경"
            >
              <KeyRound size={16} aria-hidden="true" /> 비밀번호 변경
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
      )}

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </>
  );
};
