/**
 * PermissionViewModal - Shows current user's permissions
 * Extracted from App.tsx Phase 6
 */

import React from 'react';
import { Eye, X, ClipboardList, Check, Shield } from 'lucide-react';
import { UserProfile, ROLE_LABELS, AppTab, TAB_META } from '../../types';

interface PermissionViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  accessibleTabs: AppTab[];
  rolePermissions: Record<string, Record<string, boolean>>;
}

export const PermissionViewModal: React.FC<PermissionViewModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  accessibleTabs,
  rolePermissions,
}) => {
  if (!isOpen) return null;

  const permLabels: Record<string, string> = {
    'events.create': '일정 생성',
    'events.manage_own': '본인 일정 관리',
    'events.manage_others': '타인 일정 관리',
    'events.drag_move': '일정 드래그 이동',
    'events.attendance': '참가 현황 변경',
    'events.bucket': '버킷리스트',
    'timetable.math.view': '수학 시간표 조회',
    'timetable.math.edit': '수학 시간표 수정',
    'timetable.english.view': '영어 시간표 조회',
    'timetable.english.edit': '영어 시간표 수정',
    'timetable.english.simulation': '영어 시뮬레이션',
    'timetable.english.backup.view': '백업 조회',
    'timetable.english.backup.restore': '백업 복원',
    'timetable.integrated.view': '통합 시간표 조회',
    'attendance.manage_own': '본인 출석부 관리',
    'attendance.edit_all': '전체 출석 수정',
    'attendance.manage_math': '수학 출석부 관리',
    'attendance.manage_english': '영어 출석부 관리',
    'attendance.edit_student_info': '학생정보 수정',
    'attendance.manage_sessions': '세션 설정',
    'students.view': '학생 조회',
    'students.edit': '학생 수정',
    'students.delete': '학생 삭제',
    'classes.view': '수업 조회',
    'classes.create': '수업 생성',
    'classes.edit': '수업 수정',
    'classes.delete': '수업 삭제',
    'consultation.view': '상담 조회',
    'consultation.create': '상담 생성',
    'consultation.edit': '상담 수정',
    'consultation.convert': '상담 전환',
    'consultation.manage': '상담 관리',
    'grades.view': '성적 조회',
    'grades.edit': '성적 수정',
    'grades.manage_exams': '시험 관리',
    'billing.view': '수납 조회',
    'billing.edit': '수납 수정',
    'withdrawal.view': '퇴원 조회',
    'withdrawal.edit': '퇴원 수정',
    'withdrawal.reactivate': '재원 복구',
    'departments.view_all': '모든 부서 조회',
    'departments.manage': '부서 관리',
    'system.teachers.view': '강사 목록 조회',
    'system.teachers.edit': '강사 수정',
    'system.classes.view': '수업 키워드 조회',
    'system.classes.edit': '수업 키워드 수정',
    'users.view': '사용자 목록 조회',
    'users.approve': '사용자 승인',
    'users.change_role': '역할 변경',
    'users.change_permissions': '세부 권한 변경',
    'settings.access': '설정 접근',
    'settings.holidays': '공휴일 관리',
    'settings.role_permissions': '역할 권한 설정',
    'settings.manage_categories': '카테고리 관리',
    'gantt.view': '간트 조회',
    'gantt.create': '간트 생성',
    'gantt.edit': '간트 수정',
    'gantt.delete': '간트 삭제',
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-[8vh] -translate-x-1/2 w-[500px] max-h-[85vh] bg-white rounded-sm shadow-xl z-[110] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <h3 className="text-sm font-bold text-primary flex items-center gap-2">
            <Eye size={18} /> 내 권한
          </h3>
          <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {/* Section 1: 역할 정보 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <Shield className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">역할 정보</h3>
            </div>
            <div className="px-2 py-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-blue-50 text-blue-800 rounded text-xs font-bold">
                  {ROLE_LABELS[userProfile?.role || 'guest']}
                </span>
                {userProfile?.role === 'master' && (
                  <span className="text-xxs text-blue-600">
                    Master는 모든 권한을 보유합니다.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: 접근 가능한 탭 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <Eye className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">접근 가능한 탭</h3>
            </div>
            <div className="px-2 py-2">
              <div className="flex flex-wrap gap-2">
                {accessibleTabs.map(tab => {
                  const meta = TAB_META[tab];
                  if (!meta) return null;
                  return (
                    <span key={tab} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                      {meta.icon} {meta.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 3: 상세 권한 */}
          {userProfile?.role !== 'master' && (
            <div className="bg-white border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                <ClipboardList className="w-3 h-3 text-primary" />
                <h3 className="text-primary font-bold text-xs">상세 권한</h3>
              </div>
              <div className="px-2 py-2">
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {(() => {
                    const userPerms = rolePermissions[userProfile?.role as keyof typeof rolePermissions] || {};
                    const enabledPerms = Object.entries(userPerms).filter(([, v]) => v);
                    if (enabledPerms.length === 0) {
                      return <p className="text-gray-400 text-xs">설정된 권한이 없습니다.</p>;
                    }
                    return enabledPerms.map(([permId]) => (
                      <div key={permId} className="flex items-center gap-2 text-xs text-gray-600 py-1">
                        <span className="w-4 h-4 bg-green-500 text-white rounded flex items-center justify-center shrink-0">
                          <Check size={10} />
                        </span>
                        <span>{permLabels[permId] || permId}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
