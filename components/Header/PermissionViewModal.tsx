/**
 * PermissionViewModal - Shows current user's permissions
 * Extracted from App.tsx Phase 6
 */

import React from 'react';
import { Eye, X, ClipboardList, Check } from 'lucide-react';
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
    'departments.view_all': '모든 부서 조회',
    'departments.manage': '부서 관리',
    'users.view': '사용자 목록 조회',
    'users.approve': '사용자 승인',
    'users.change_role': '역할 변경',
    'users.change_permissions': '세부 권한 변경',
    'settings.access': '설정 접근',
    'settings.holidays': '공휴일 관리',
    'settings.role_permissions': '역할 권한 설정',
    'settings.manage_categories': '카테고리 관리',
    'system.teachers.view': '강사 목록 조회',
    'system.teachers.edit': '강사 수정',
    'system.classes.view': '수업 목록 조회',
    'system.classes.edit': '수업 수정',
    'timetable.math.view': '수학 시간표 조회',
    'timetable.math.edit': '수학 시간표 수정',
    'timetable.english.view': '영어 시간표 조회',
    'timetable.english.edit': '영어 시간표 수정',
    'timetable.english.simulation': '영어 시뮬레이션',
    'timetable.english.backup.view': '백업 조회',
    'timetable.english.backup.restore': '백업 복원',
    'timetable.integrated.view': '통합 시간표 조회',
    'gantt.view': '간트 조회',
    'gantt.create': '간트 생성',
    'gantt.edit': '간트 수정',
    'gantt.delete': '간트 삭제',
    'attendance.manage_own': '본인 출석부 관리',
    'attendance.edit_all': '전체 출석 수정',
    'attendance.manage_math': '수학 출석부 관리',
    'attendance.manage_english': '영어 출석부 관리',
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-[99998]"
        onClick={onClose}
      />
      <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[500px] md:max-h-[80vh] bg-white rounded-2xl shadow-2xl z-[99999] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Eye size={18} /> 내 권한
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 text-sm">
          {/* Role Info */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-blue-800 font-bold">역할: {ROLE_LABELS[userProfile?.role || 'guest']}</p>
            {userProfile?.role === 'master' && (
              <p className="text-blue-600 text-xs mt-1">Master는 모든 권한을 보유합니다.</p>
            )}
          </div>

          {/* Tab Permissions */}
          <div className="mb-4">
            <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
              <ClipboardList size={14} className="inline mr-1" />허용된 탭
            </h4>
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

          {/* Role Permissions */}
          {userProfile?.role !== 'master' && (
            <div>
              <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                ✅ 허용된 권한
              </h4>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {(() => {
                  const userPerms = rolePermissions[userProfile?.role as keyof typeof rolePermissions] || {};
                  const enabledPerms = Object.entries(userPerms).filter(([, v]) => v);
                  if (enabledPerms.length === 0) {
                    return <p className="text-gray-400 text-xs">설정된 권한이 없습니다.</p>;
                  }
                  return enabledPerms.map(([permId]) => (
                    <div key={permId} className="flex items-center gap-2 text-xs text-gray-600 py-1">
                      <span className="w-4 h-4 bg-green-500 text-white rounded flex items-center justify-center"><Check size={10} /></span>
                      {permLabels[permId] || permId}
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
