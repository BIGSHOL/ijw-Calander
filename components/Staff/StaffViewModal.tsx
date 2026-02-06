import React, { useState } from 'react';
import { X, Edit, Trash2, Phone, Mail, Calendar, Shield, ShieldCheck, ShieldAlert, Building, User, CheckCircle, XCircle, Clock, Briefcase, Eye, EyeOff, Globe, AlertTriangle, KeyRound, Send, Loader2, Lock, AlignLeft } from 'lucide-react';
import { StaffMember, STAFF_ROLE_LABELS, STAFF_STATUS_LABELS, ROLE_LABELS, UserRole } from '../../types';
import { sendPasswordResetEmail } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from '../../firebaseConfig';
import { SUBJECT_COLORS, SubjectType } from '../../utils/styleUtils';

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
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100] p-4" onClick={onClose}>
      <div className="bg-white rounded-sm shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-sm flex items-center justify-center text-lg font-bold shadow-md"
              style={{
                backgroundColor: staff.role === 'teacher' && staff.bgColor ? staff.bgColor : '#fdb813',
                color: staff.role === 'teacher' && staff.textColor ? staff.textColor : '#081429',
              }}
            >
              {staff.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-sm font-bold text-primary flex items-center gap-2">
                {staff.name}
                {staff.englishName && (
                  <span className="text-xs font-normal text-gray-500">({staff.englishName})</span>
                )}
              </h2>
              {staff.jobTitle && (
                <p className="text-xs text-gray-500">{staff.jobTitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {/* Section 1: 기본 정보 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <User className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">기본 정보</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {/* Name Row */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="w-20 shrink-0 text-xs font-medium text-primary-700">이름</span>
                <span className="text-sm text-primary font-medium">{staff.name}</span>
                {staff.englishName && (
                  <span className="text-xs text-gray-500">({staff.englishName})</span>
                )}
              </div>

              {/* Role Row */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="w-20 shrink-0 text-xs font-medium text-primary-700">직책</span>
                <div>{getRoleBadge(staff.role)}</div>
              </div>

              {/* Job Title Row */}
              {staff.jobTitle && (
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <span className="w-20 shrink-0 text-xs font-medium text-primary-700">호칭</span>
                  <span className="text-sm text-primary">{staff.jobTitle}</span>
                </div>
              )}

              {/* Status Row */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="w-20 shrink-0 text-xs font-medium text-primary-700">상태</span>
                <div>{getStatusBadge(staff.status)}</div>
              </div>
            </div>
          </div>

          {/* Section 2: 시스템 권한 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <Shield className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">시스템 권한</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {/* Account Link Row */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="w-20 shrink-0 text-xs font-medium text-primary-700">계정 연동</span>
                {staff.uid ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    <CheckCircle className="w-3.5 h-3.5" />
                    연동됨
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    <XCircle className="w-3.5 h-3.5" />
                    미연동
                  </span>
                )}
              </div>

              {/* System Role Row */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="w-20 shrink-0 text-xs font-medium text-primary-700">시스템 역할</span>
                {systemRoleStyle ? (
                  <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded ${systemRoleStyle.bg} ${systemRoleStyle.text}`}>
                    {systemRoleStyle.icon}
                    {systemRoleStyle.label}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">-</span>
                )}
              </div>

              {/* Approval Status Row */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="w-20 shrink-0 text-xs font-medium text-primary-700">승인 상태</span>
                {approvalStyle ? (
                  <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded ${approvalStyle.bg} ${approvalStyle.text}`}>
                    {approvalStyle.icon}
                    {approvalStyle.label}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">-</span>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: 연락처 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <Phone className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">연락처</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {/* Email Row */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="w-16 shrink-0 text-xs font-medium text-primary-700">이메일</span>
                <span className="text-sm text-primary">{staff.email || '-'}</span>
              </div>

              {/* Phone Row */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="w-16 shrink-0 text-xs font-medium text-primary-700">전화번호</span>
                <span className="text-sm text-primary">{staff.phone || '-'}</span>
              </div>
            </div>
          </div>

          {/* Section 4: 근무 정보 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <Briefcase className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">근무 정보</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {/* Hire Date Row */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="w-16 shrink-0 text-xs font-medium text-primary-700">입사일</span>
                <span className="text-sm text-primary">{staff.hireDate || '-'}</span>
              </div>

              {/* Department/Subject Row (Teacher Only) */}
              {staff.role === 'teacher' && staff.subjects && staff.subjects.length > 0 && (
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <Building className="w-3 h-3 text-gray-400 shrink-0" />
                  <span className="w-16 shrink-0 text-xs font-medium text-primary-700">담당 과목</span>
                  <div className="flex gap-1.5">
                    {staff.subjects.map((subject) => (
                      <span
                        key={subject}
                        className={`text-xs px-2 py-0.5 rounded-sm font-medium ${
                          SUBJECT_COLORS[subject as SubjectType]?.badge || SUBJECT_COLORS.other.badge
                        }`}
                      >
                        {subject === 'math' ? '수학' : '영어'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Default Room Row (Teacher Only) */}
              {staff.role === 'teacher' && staff.defaultRoom && (
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <Building className="w-3 h-3 text-gray-400 shrink-0" />
                  <span className="w-16 shrink-0 text-xs font-medium text-primary-700">기본 강의실</span>
                  <span className="text-sm text-primary">{staff.defaultRoom}</span>
                </div>
              )}

              {/* Color Settings (Teacher Only) */}
              {staff.role === 'teacher' && (
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <span className="w-16 shrink-0 text-xs font-medium text-primary-700 ml-5">시간표 색상</span>
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
              )}

              {/* Attributes (Teacher Only) */}
              {staff.role === 'teacher' && (staff.isNative || staff.isHiddenInTimetable || staff.isHiddenInAttendance) && (
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <span className="w-16 shrink-0 text-xs font-medium text-primary-700 ml-5">속성</span>
                  <div className="flex gap-2 flex-wrap">
                    {staff.isNative && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                        <Globe className="w-3 h-3" />
                        원어민
                      </span>
                    )}
                    {staff.isHiddenInTimetable && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        <EyeOff className="w-3 h-3" />
                        시간표 숨김
                      </span>
                    )}
                    {staff.isHiddenInAttendance && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded">
                        <EyeOff className="w-3 h-3" />
                        출석부 숨김
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 5: 계정 관리 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <KeyRound className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">계정 관리</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {/* Password Reset Button (Only if account is linked and user can edit) */}
              {staff.uid && canEdit && (
                <div className="px-2 py-2">
                  <button
                    onClick={openPasswordResetModal}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-sm transition-colors"
                  >
                    <Lock className="w-4 h-4" />
                    비밀번호 재설정
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="px-2 py-2 flex gap-2">
                <button
                  onClick={canEdit ? onEdit : undefined}
                  disabled={!canEdit}
                  title={getEditTooltip()}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-sm transition-colors ${
                    canEdit
                      ? 'bg-primary text-white hover:bg-primary-800 cursor-pointer'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Edit className="w-3.5 h-3.5" />
                  수정
                </button>
                <button
                  onClick={canDelete ? () => setShowDeleteConfirm(true) : undefined}
                  disabled={!canDelete}
                  title={getDeleteTooltip()}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-sm transition-colors ${
                    canDelete
                      ? 'text-red-600 bg-red-50 hover:bg-red-100 cursor-pointer'
                      : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  삭제
                </button>
              </div>
            </div>
          </div>

          {/* Memo Section (if exists) */}
          {staff.memo && (
            <div className="bg-white border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                <AlignLeft className="w-3 h-3 text-primary" />
                <h3 className="text-primary font-bold text-xs">메모</h3>
              </div>
              <div className="px-2 py-2">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{staff.memo}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-sm transition-colors"
          >
            닫기
          </button>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center pt-[8vh] z-[60]" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-sm bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">직원 삭제</h3>
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-bold text-primary">{staff.name}</span> 님을 정말 삭제하시겠습니까?
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
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-sm transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-sm hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-sm animate-spin" />
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
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center pt-[8vh] z-[60]" onClick={() => setShowPasswordResetModal(false)}>
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-sm bg-white/20 flex items-center justify-center">
                    <KeyRound className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">비밀번호 재설정</h3>
                    <p className="text-xs text-amber-100">{staff.name} ({staff.email})</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPasswordResetModal(false)}
                  className="p-1 hover:bg-white/20 rounded-sm transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 컨텐츠 */}
            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              {/* 모드 선택 탭 */}
              <div className="flex rounded-sm bg-gray-100 p-1">
                <button
                  onClick={() => { setPasswordResetMode('email'); setResetResult(null); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-sm transition-colors ${
                    passwordResetMode === 'email'
                      ? 'bg-white text-primary shadow'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  이메일 발송
                </button>
                <button
                  onClick={() => { setPasswordResetMode('direct'); setResetResult(null); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-sm transition-colors ${
                    passwordResetMode === 'direct'
                      ? 'bg-white text-primary shadow'
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
                  <div className="bg-blue-50 rounded-sm p-4">
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
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <div className="bg-amber-50 rounded-sm p-4">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>

                  <button
                    onClick={handleSetTempPassword}
                    disabled={isSendingReset || !newPassword || newPassword.length < 6}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 text-white rounded-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className={`rounded-sm p-4 ${resetResult.success ? 'bg-emerald-50' : 'bg-red-50'}`}>
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
                className="w-full py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-sm transition-colors"
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
