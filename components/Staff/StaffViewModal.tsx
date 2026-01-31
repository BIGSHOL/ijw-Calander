import React, { useState } from 'react';
import { X, Edit, Trash2, Phone, Mail, Calendar, Shield, ShieldCheck, ShieldAlert, Building, User, CheckCircle, XCircle, Clock, Briefcase, Eye, EyeOff, Globe, AlertTriangle, KeyRound, Send, Loader2, Lock } from 'lucide-react';
import { StaffMember, STAFF_ROLE_LABELS, STAFF_STATUS_LABELS, ROLE_LABELS, UserRole } from '../../types';
import { sendPasswordResetEmail } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from '../../firebaseConfig';

interface StaffViewModalProps {
  staff: StaffMember;
  onClose: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  currentUserUid?: string;
}

// 시스템 권한 레이블 및 색상
const SYSTEM_ROLE_STYLES: Record<UserRole, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  master: { label: 'MASTER', bg: 'bg-amber-100', text: 'text-amber-800', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  admin: { label: 'ADMIN', bg: 'bg-purple-100', text: 'text-purple-800', icon: <Shield className="w-3.5 h-3.5" /> },
  manager: { label: 'MANAGER', bg: 'bg-blue-100', text: 'text-blue-800', icon: <Shield className="w-3.5 h-3.5" /> },
  math_lead: { label: '수학 리드', bg: 'bg-blue-100', text: 'text-blue-800', icon: <User className="w-3.5 h-3.5" /> },
  english_lead: { label: '영어 리드', bg: 'bg-pink-100', text: 'text-pink-800', icon: <User className="w-3.5 h-3.5" /> },
  math_teacher: { label: '수학 강사', bg: 'bg-blue-50', text: 'text-blue-700', icon: <User className="w-3.5 h-3.5" /> },
  english_teacher: { label: '영어 강사', bg: 'bg-pink-50', text: 'text-pink-700', icon: <User className="w-3.5 h-3.5" /> },
  user: { label: 'USER', bg: 'bg-gray-100', text: 'text-gray-800', icon: <User className="w-3.5 h-3.5" /> },
  teacher: { label: '강사', bg: 'bg-green-100', text: 'text-green-800', icon: <User className="w-3.5 h-3.5" /> },
  staff: { label: '직원', bg: 'bg-gray-100', text: 'text-gray-700', icon: <User className="w-3.5 h-3.5" /> },
  editor: { label: 'EDITOR', bg: 'bg-blue-100', text: 'text-blue-800', icon: <User className="w-3.5 h-3.5" /> },
  senior_staff: { label: '시니어', bg: 'bg-indigo-100', text: 'text-indigo-800', icon: <User className="w-3.5 h-3.5" /> },
  viewer: { label: '뷰어', bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <User className="w-3.5 h-3.5" /> },
};

// 승인 상태 스타일
const APPROVAL_STYLES: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  approved: { label: '승인됨', bg: 'bg-emerald-100', text: 'text-emerald-800', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  pending: { label: '대기중', bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock className="w-3.5 h-3.5" /> },
  rejected: { label: '거부됨', bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle className="w-3.5 h-3.5" /> },
};

const StaffViewModal: React.FC<StaffViewModalProps> = ({ staff, onClose, onEdit, onDelete, canEdit = true, canDelete = true, currentUserUid }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // 비밀번호 재설정 관련 상태
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [passwordResetMode, setPasswordResetMode] = useState<'email' | 'direct'>('email');
  const [newPassword, setNewPassword] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string } | null>(null);

  const systemRoleStyle = staff.systemRole ? SYSTEM_ROLE_STYLES[staff.systemRole] : null;
  const approvalStyle = staff.approvalStatus ? APPROVAL_STYLES[staff.approvalStatus] : null;

  // 자기 자신인지 확인
  const isSelf = currentUserUid && staff.uid === currentUserUid;

  // 수정 불가 시 툴팁 메시지
  const getEditTooltip = () => {
    if (canEdit) return '수정';
    if (isSelf) return '수정 (본인 계정)';
    return '자신보다 높거나 같은 권한의 직원은 수정할 수 없습니다';
  };

  // 삭제 불가 시 툴팁 메시지
  const getDeleteTooltip = () => {
    if (canDelete) return '삭제';
    if (isSelf) return '본인 계정은 삭제할 수 없습니다';
    return '자신보다 높거나 같은 권한의 직원은 삭제할 수 없습니다';
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(staff.id);
      onClose();
    } catch (error) {
      console.error('Delete error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 비밀번호 재설정 이메일 발송
  const handleSendPasswordResetEmail = async () => {
    if (!staff.email) {
      setResetResult({ success: false, message: '이메일 주소가 없습니다.' });
      return;
    }

    setIsSendingReset(true);
    setResetResult(null);

    try {
      await sendPasswordResetEmail(auth, staff.email);
      setResetResult({ success: true, message: `${staff.email}로 비밀번호 재설정 이메일을 발송했습니다.` });
    } catch (error: any) {
      console.error('Password reset email error:', error);
      let message = '이메일 발송에 실패했습니다.';
      if (error.code === 'auth/user-not-found') {
        message = '해당 이메일로 등록된 계정이 없습니다.';
      } else if (error.code === 'auth/invalid-email') {
        message = '유효하지 않은 이메일 주소입니다.';
      }
      setResetResult({ success: false, message });
    } finally {
      setIsSendingReset(false);
    }
  };

  // 임시 비밀번호 직접 설정 (Cloud Function 호출)
  const handleSetTempPassword = async () => {
    if (!staff.uid) {
      setResetResult({ success: false, message: '연동된 계정이 없습니다.' });
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setResetResult({ success: false, message: '비밀번호는 최소 6자 이상이어야 합니다.' });
      return;
    }

    setIsSendingReset(true);
    setResetResult(null);

    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const setUserPassword = httpsCallable(functions, 'setUserPassword');
      await setUserPassword({ uid: staff.uid, password: newPassword });
      setResetResult({ success: true, message: '비밀번호가 변경되었습니다. 임시 비밀번호를 직원에게 전달해주세요.' });
      setNewPassword('');
    } catch (error: any) {
      console.error('Set password error:', error);
      setResetResult({ success: false, message: error.message || '비밀번호 변경에 실패했습니다.' });
    } finally {
      setIsSendingReset(false);
    }
  };

  // 비밀번호 재설정 모달 초기화
  const openPasswordResetModal = () => {
    setShowPasswordResetModal(true);
    setPasswordResetMode('email');
    setNewPassword('');
    setResetResult(null);
  };

  // 직책 뱃지 스타일
  const getRoleBadge = (role: StaffMember['role']) => {
    const styles = {
      teacher: 'bg-blue-100 text-blue-800',
      admin: 'bg-purple-100 text-purple-800',
      staff: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[role]}`}>
        {STAFF_ROLE_LABELS[role]}
      </span>
    );
  };

  // 상태 뱃지 스타일
  const getStatusBadge = (status: StaffMember['status']) => {
    const styles = {
      active: 'bg-emerald-100 text-emerald-800',
      inactive: 'bg-yellow-100 text-yellow-800',
      resigned: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[status]}`}>
        {STAFF_STATUS_LABELS[status]}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gradient-to-r from-[#081429] to-[#0a1a35]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-md"
              style={{
                backgroundColor: staff.role === 'teacher' && staff.bgColor ? staff.bgColor : '#fdb813',
                color: staff.role === 'teacher' && staff.textColor ? staff.textColor : '#081429',
              }}
            >
              {staff.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {staff.name}
                {staff.englishName && (
                  <span className="text-sm font-normal text-gray-300">({staff.englishName})</span>
                )}
              </h2>
              {staff.jobTitle && (
                <p className="text-xs text-[#fdb813]">{staff.jobTitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 기본 정보 섹션 */}
          <section>
            <h3 className="text-sm font-bold text-[#081429] mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              기본 정보
            </h3>
            <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
              <div>
                <label className="text-xs text-gray-500">직책</label>
                <div className="mt-1">{getRoleBadge(staff.role)}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500">상태</label>
                <div className="mt-1">{getStatusBadge(staff.status)}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> 이메일
                </label>
                <p className="text-sm text-[#081429] mt-1">{staff.email || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> 전화번호
                </label>
                <p className="text-sm text-[#081429] mt-1">{staff.phone || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> 입사일
                </label>
                <p className="text-sm text-[#081429] mt-1">{staff.hireDate || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 flex items-center gap-1">
                  <Briefcase className="w-3 h-3" /> 호칭
                </label>
                <p className="text-sm text-[#081429] mt-1">{staff.jobTitle || '-'}</p>
              </div>
            </div>
          </section>

          {/* 시스템 계정 정보 섹션 */}
          <section>
            <h3 className="text-sm font-bold text-[#081429] mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              시스템 계정 정보
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              {/* 계정 연동 상태 */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">계정 연동</span>
                {staff.uid ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                    <CheckCircle className="w-3.5 h-3.5" />
                    연동됨
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    <XCircle className="w-3.5 h-3.5" />
                    미연동
                  </span>
                )}
              </div>

              {/* 시스템 역할 */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">시스템 역할</span>
                {systemRoleStyle ? (
                  <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded ${systemRoleStyle.bg} ${systemRoleStyle.text}`}>
                    {systemRoleStyle.icon}
                    {systemRoleStyle.label}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">-</span>
                )}
              </div>

              {/* 승인 상태 */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">승인 상태</span>
                {approvalStyle ? (
                  <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded ${approvalStyle.bg} ${approvalStyle.text}`}>
                    {approvalStyle.icon}
                    {approvalStyle.label}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">-</span>
                )}
              </div>

              {/* 비밀번호 재설정 (연동된 계정만) */}
              {staff.uid && canEdit && (
                <div className="pt-3 border-t border-gray-200">
                  <button
                    onClick={openPasswordResetModal}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                  >
                    <KeyRound className="w-4 h-4" />
                    비밀번호 재설정
                  </button>
                </div>
              )}

            </div>
          </section>

          {/* 강사 전용 정보 (role === 'teacher') */}
          {staff.role === 'teacher' && (
            <section>
              <h3 className="text-sm font-bold text-[#081429] mb-3 flex items-center gap-2">
                <Building className="w-4 h-4" />
                강사 정보
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                {/* 담당 과목 */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">담당 과목</span>
                  <div className="flex gap-1.5">
                    {staff.subjects?.map((subject) => (
                      <span
                        key={subject}
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          subject === 'math' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                        }`}
                      >
                        {subject === 'math' ? '수학' : '영어'}
                      </span>
                    )) || <span className="text-xs text-gray-400">-</span>}
                  </div>
                </div>

                {/* 기본 강의실 */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">기본 강의실</span>
                  <span className="text-sm text-[#081429]">{staff.defaultRoom || '-'}</span>
                </div>

                {/* 시간표 색상 */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">시간표 색상</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded border border-gray-300 flex items-center justify-center text-xs font-bold"
                      style={{
                        backgroundColor: staff.bgColor || '#3b82f6',
                        color: staff.textColor || '#ffffff',
                      }}
                    >
                      A
                    </div>
                    <span className="text-xs text-gray-500">{staff.bgColor || '#3b82f6'}</span>
                  </div>
                </div>

                {/* 원어민 / 숨김 여부 */}
                <div className="flex gap-3">
                  {staff.isNative && (
                    <span className="flex items-center gap-1 text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                      <Globe className="w-3 h-3" />
                      원어민
                    </span>
                  )}
                  {staff.isHiddenInTimetable && (
                    <span className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                      <EyeOff className="w-3 h-3" />
                      시간표 숨김
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* 메모 */}
          {staff.memo && (
            <section>
              <h3 className="text-sm font-bold text-[#081429] mb-3">메모</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{staff.memo}</p>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-between">
          <div>
            <button
              onClick={canDelete ? () => setShowDeleteConfirm(true) : undefined}
              disabled={!canDelete}
              title={getDeleteTooltip()}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg transition-colors ${
                canDelete
                  ? 'text-red-600 hover:bg-red-50 cursor-pointer'
                  : 'text-gray-400 bg-gray-100 cursor-not-allowed'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              삭제
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              닫기
            </button>
            <button
              onClick={canEdit ? onEdit : undefined}
              disabled={!canEdit}
              title={getEditTooltip()}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg transition-colors ${
                canEdit
                  ? 'bg-[#081429] text-white hover:bg-[#0a1a35] cursor-pointer'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Edit className="w-4 h-4" />
              수정
            </button>
          </div>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">직원 삭제</h3>
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-bold text-[#081429]">{staff.name}</span> 님을 정말 삭제하시겠습니까?
                </p>
                <p className="text-xs text-gray-500">
                  삭제된 직원 정보는 복구할 수 없습니다.
                  {staff.uid && (
                    <span className="block mt-1 text-amber-600">
                      이 직원은 시스템 계정이 연동되어 있습니다. 삭제해도 로그인 계정은 유지됩니다.
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    삭제 중...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    삭제
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 재설정 모달 */}
      {showPasswordResetModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <KeyRound className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">비밀번호 재설정</h3>
                    <p className="text-xs text-amber-100">{staff.name} ({staff.email})</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPasswordResetModal(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 컨텐츠 */}
            <div className="p-5 space-y-4">
              {/* 모드 선택 탭 */}
              <div className="flex rounded-lg bg-gray-100 p-1">
                <button
                  onClick={() => { setPasswordResetMode('email'); setResetResult(null); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-colors ${
                    passwordResetMode === 'email'
                      ? 'bg-white text-[#081429] shadow'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  이메일 발송
                </button>
                <button
                  onClick={() => { setPasswordResetMode('direct'); setResetResult(null); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-colors ${
                    passwordResetMode === 'direct'
                      ? 'bg-white text-[#081429] shadow'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  직접 설정
                </button>
              </div>

              {/* 이메일 발송 모드 */}
              {passwordResetMode === 'email' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>{staff.email}</strong>로 비밀번호 재설정 링크가 포함된 이메일을 발송합니다.
                    </p>
                    <p className="text-xs text-blue-600 mt-2">
                      직원이 이메일의 링크를 클릭하여 새 비밀번호를 설정할 수 있습니다.
                    </p>
                  </div>

                  <button
                    onClick={handleSendPasswordResetEmail}
                    disabled={isSendingReset || !staff.email}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSendingReset ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        발송 중...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        재설정 이메일 발송
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* 직접 설정 모드 */}
              {passwordResetMode === 'direct' && (
                <div className="space-y-4">
                  <div className="bg-amber-50 rounded-lg p-4">
                    <p className="text-sm text-amber-800">
                      관리자가 직접 임시 비밀번호를 설정합니다.
                    </p>
                    <p className="text-xs text-amber-600 mt-2">
                      설정된 비밀번호를 직원에게 안전하게 전달해주세요.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      새 비밀번호 (최소 6자)
                    </label>
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="임시 비밀번호 입력"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>

                  <button
                    onClick={handleSetTempPassword}
                    disabled={isSendingReset || !newPassword || newPassword.length < 6}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSendingReset ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        설정 중...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        비밀번호 설정
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* 결과 메시지 */}
              {resetResult && (
                <div className={`rounded-lg p-4 ${resetResult.success ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <div className="flex items-start gap-3">
                    {resetResult.success ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <p className={`text-sm ${resetResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                      {resetResult.message}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 푸터 */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => setShowPasswordResetModal(false)}
                className="w-full py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffViewModal;
