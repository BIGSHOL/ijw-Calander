import React from 'react';
import { Department, UserProfile, Teacher, UserRole, ROLE_LABELS } from '../../../types';
import { canAssignRole, getAssignableRoles } from '../../../hooks/usePermissions';
import { X, Trash2, Shield, ShieldCheck, Users, BookUser } from 'lucide-react';

interface UserDetailModalProps {
  user: UserProfile;
  departments: Department[];
  teachers: Teacher[];
  currentUserProfile: UserProfile | null;
  initialPermissions: Record<string, 'view' | 'edit'> | null;
  canApproveUser: boolean;
  canChangeRole: boolean;
  canChangePermissions: boolean;
  isMaster: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onUserUpdate: (uid: string, updates: Partial<UserProfile>) => void;
  onDeptPermissionChange: (uid: string, deptId: string, permission: 'view' | 'edit' | 'none') => void;
  onDeleteUser: (uid: string) => void;
}

const UserDetailModal: React.FC<UserDetailModalProps> = ({
  user,
  departments,
  teachers,
  currentUserProfile,
  initialPermissions,
  canApproveUser,
  canChangeRole,
  canChangePermissions,
  isMaster,
  isAdmin,
  onClose,
  onUserUpdate,
  onDeptPermissionChange,
  onDeleteUser,
}) => {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#f8f9fa] border-b border-gray-200 p-6 pb-4">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border-4 border-white shadow-lg ${user.role === 'master' ? 'bg-[#fdb813] text-[#081429]' : user.role === 'admin' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {user.role === 'master' ? <ShieldCheck /> : user.role === 'admin' ? <Shield /> : <Users />}
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#081429]">{user.email}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    value={user.jobTitle || ''}
                    onChange={(e) => onUserUpdate(user.uid, { jobTitle: e.target.value })}
                    placeholder="호칭 입력"
                    className="bg-white border border-gray-200 rounded px-2 py-1 text-sm font-medium w-32 focus:border-[#fdb813] outline-none"
                  />
                  {/* Role Dropdown */}
                  {canChangeRole && canAssignRole(currentUserProfile?.role as UserRole, user.role) && (
                    <select
                      value={user.role}
                      onChange={(e) => onUserUpdate(user.uid, { role: e.target.value as UserRole })}
                      className="px-2 py-1 rounded text-xs font-bold border outline-none bg-white cursor-pointer"
                    >
                      {getAssignableRoles(currentUserProfile?.role as UserRole).map(role => (
                        <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                      ))}
                    </select>
                  )}
                  <select
                    value={user.status}
                    disabled={!canApproveUser || !canAssignRole(currentUserProfile?.role as UserRole, user.role)}
                    onChange={(e) => onUserUpdate(user.uid, { status: e.target.value as any })}
                    className={`text-xs font-bold px-2 py-1 rounded border outline-none ${user.status === 'approved' ? 'text-green-600 bg-green-50 border-green-200' : user.status === 'pending' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' : 'text-red-600 bg-red-50 border-red-200'} ${(!canApproveUser || !canAssignRole(currentUserProfile?.role as UserRole, user.role)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <option value="approved">승인됨</option>
                    <option value="pending">대기중</option>
                    <option value="rejected">차단됨</option>
                  </select>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Body: Teacher Linking & Dept Permissions */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {/* Teacher Profile Linking Section */}
          <div className="mb-6 p-4 bg-teal-50/50 border border-teal-100 rounded-xl">
            <h4 className="text-sm font-bold text-teal-700 mb-3 flex items-center gap-2">
              <BookUser size={14} /> 강사 프로필 연동 (출석부용)
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              이 사용자가 실제 수업을 진행한다면, 강사 프로필을 연동해주세요. 출석부에서 '본인 수업'만 조회하는 기능에 사용됩니다.
            </p>
            <select
              value={user.teacherId || ''}
              onChange={(e) => onUserUpdate(user.uid, { teacherId: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-teal-200 rounded-lg text-sm focus:border-teal-400 focus:ring-1 focus:ring-teal-300 outline-none bg-white"
            >
              <option value="">연동 안함 (수업 미진행)</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.subjects?.join(', ') ? `(${t.subjects?.join(', ')})` : ''}
                </option>
              ))}
            </select>
            {user.teacherId && (
              <div className="mt-2 text-xs text-teal-600 font-medium">
                ✓ 연동됨: {teachers.find(t => t.id === user.teacherId)?.name || user.teacherId}
              </div>
            )}
          </div>

          {/* Department Permissions */}
          <h4 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider flex items-center justify-between">
            부서별 접근 권한
            {canChangePermissions && (
              <div className="flex gap-2 text-[10px]">
                <button
                  onClick={() => {
                    const newPerms: any = {};
                    departments.forEach(d => newPerms[d.id] = 'view');
                    onUserUpdate(user.uid, { departmentPermissions: newPerms });
                  }}
                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-blue-600 font-bold"
                >
                  전체 조회
                </button>
                <button
                  onClick={() => {
                    const newPerms: any = {};
                    departments.forEach(d => newPerms[d.id] = 'edit');
                    onUserUpdate(user.uid, { departmentPermissions: newPerms });
                  }}
                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-green-600 font-bold"
                >
                  전체 수정
                </button>
                <button
                  onClick={() => {
                    onUserUpdate(user.uid, { departmentPermissions: {} });
                  }}
                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-500 font-bold"
                >
                  전체 차단
                </button>
                <button
                  onClick={() => {
                    if (initialPermissions) {
                      onUserUpdate(user.uid, { departmentPermissions: initialPermissions });
                    }
                  }}
                  className="px-2 py-1 bg-red-50 hover:bg-red-100 rounded text-red-500 font-bold"
                >
                  초기화
                </button>
              </div>
            )}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {departments.map(dept => {
              const current = user.departmentPermissions?.[dept.id];
              return (
                <div key={dept.id} className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors bg-gray-50/50">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: dept.color }} />
                    <span className="font-bold text-gray-700 text-xs truncate" title={dept.name}>{dept.name}</span>
                  </div>
                  {/* Permission Toggle - Segmented Control */}
                  <div className="flex bg-white rounded-lg p-0.5 border border-gray-200 shrink-0">
                    <button
                      onClick={() => onDeptPermissionChange(user.uid, dept.id, 'none')}
                      className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${!current ? 'bg-gray-100 text-gray-400 shadow-inner' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'}`}
                    >
                      차단
                    </button>
                    <div className="w-px bg-gray-100 my-1" />
                    <button
                      onClick={() => onDeptPermissionChange(user.uid, dept.id, 'view')}
                      className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${current === 'view' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                    >
                      조회
                    </button>
                    <div className="w-px bg-gray-100 my-1" />
                    <button
                      onClick={() => onDeptPermissionChange(user.uid, dept.id, 'edit')}
                      className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${current === 'edit' ? 'bg-green-50 text-green-600 shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                    >
                      수정
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          {/* Delete Button */}
          <div>
            {(() => {
              const isTargetMaster = user.role === 'master';
              const isTargetAdmin = user.role === 'admin';

              // Self check
              if (currentUserProfile?.uid === user.uid) return null;

              // Permission Logic
              let canDelete = false;
              if (isMaster) {
                // Master can delete Admin and User (Not other Masters)
                if (!isTargetMaster) canDelete = true;
              } else if (isAdmin) {
                // Admin can delete everyone except Master (including other Admins)
                if (!isTargetMaster) canDelete = true;
              }

              if (!canDelete) return null;

              return (
                <button
                  onClick={() => onDeleteUser(user.uid)}
                  className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={16} /> 사용자 삭제
                </button>
              );
            })()}
          </div>

          <button onClick={onClose} className="px-6 py-2 bg-[#081429] text-white rounded-lg font-bold">확인</button>
        </div>
      </div>
    </div>
  );
};

export default UserDetailModal;
