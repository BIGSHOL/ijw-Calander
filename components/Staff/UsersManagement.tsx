import React, { useState, useMemo } from 'react';
import { UserProfile, StaffMember, ROLE_LABELS } from '../../types';
import { Shield, ShieldCheck, Users as UsersIcon, UserCog, Mail, AlertCircle, CheckCircle, XCircle, Link as LinkIcon, Settings, RefreshCw } from 'lucide-react';
import UserDetailModal from '../Settings/modals/UserDetailModal';
import UserStaffMigrationModal from './UserStaffMigrationModal';
import { useDepartments, useTeachers } from '../../hooks/useFirebaseQueries';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

interface UsersManagementProps {
  users: UserProfile[];
  staff: StaffMember[];
  currentUserProfile: UserProfile | null;
  isMaster: boolean;
}

type UserStaffMatch = {
  user: UserProfile;
  staffMember?: StaffMember;
  matchType: 'exact' | 'none';
};

const UsersManagement: React.FC<UsersManagementProps> = ({
  users,
  staff,
  currentUserProfile,
  isMaster,
}) => {
  const [activeTab, setActiveTab] = useState<'approved' | 'pending'>('approved');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserProfile | null>(null);
  const [initialPermissions, setInitialPermissions] = useState<any>(null);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);

  // Fetch departments and teachers for UserDetailModal
  const { data: departments = [] } = useDepartments(true);
  const { data: teachers = [] } = useTeachers(true);

  // 이메일 기반 매칭
  const matchedData = useMemo(() => {
    const staffByEmail = new Map<string, StaffMember>();
    staff.forEach(s => {
      if (s.email) {
        staffByEmail.set(s.email.toLowerCase(), s);
      }
    });

    return users.map(user => {
      const email = user.email.toLowerCase();
      const staffMember = staffByEmail.get(email);

      return {
        user,
        staffMember,
        matchType: staffMember ? 'exact' : 'none'
      } as UserStaffMatch;
    });
  }, [users, staff]);

  // 필터링
  const filteredMatches = useMemo(() => {
    let result = matchedData;

    // 승인 상태 필터
    if (activeTab === 'approved') {
      result = result.filter(m => m.user.status === 'approved');
    } else {
      result = result.filter(m => m.user.status === 'pending' || m.user.status === 'rejected');
    }

    // 검색 필터
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.user.email.toLowerCase().includes(q) ||
        m.user.jobTitle?.toLowerCase().includes(q) ||
        m.staffMember?.name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [matchedData, activeTab, searchQuery]);

  // 통계
  const stats = useMemo(() => {
    const approved = users.filter(u => u.status === 'approved');
    const pending = users.filter(u => u.status === 'pending');
    const matched = matchedData.filter(m => m.matchType === 'exact' && m.user.status === 'approved');
    const unmatched = matchedData.filter(m => m.matchType === 'none' && m.user.status === 'approved');

    return {
      totalUsers: users.length,
      approved: approved.length,
      pending: pending.length,
      matched: matched.length,
      unmatched: unmatched.length,
    };
  }, [users, matchedData]);

  const getRoleBadge = (role: string) => {
    const styles = {
      master: 'bg-amber-100 text-amber-800',
      admin: 'bg-purple-100 text-purple-800',
      user: 'bg-blue-100 text-blue-800',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[role as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      approved: 'bg-emerald-100 text-emerald-800',
      pending: 'bg-yellow-100 text-yellow-800',
      rejected: 'bg-red-100 text-red-800',
    };
    const labels = {
      approved: '승인됨',
      pending: '대기중',
      rejected: '거부됨',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const handlePermissionClick = (user: UserProfile) => {
    setSelectedUserForEdit(user);
    setInitialPermissions(user.departmentPermissions || {});
  };

  const handleUserUpdate = async (uid: string, updates: Partial<UserProfile>) => {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, updates);
    } catch (error) {
      console.error('Failed to update user:', error);
      alert('사용자 업데이트 실패');
    }
  };

  const handleDeptPermissionChange = async (uid: string, deptId: string, permission: 'view' | 'edit' | 'none') => {
    try {
      const user = users.find(u => u.uid === uid);
      if (!user) return;

      const currentPermissions = user.departmentPermissions || {};
      const updatedPermissions = { ...currentPermissions };

      if (permission === 'none') {
        delete updatedPermissions[deptId];
      } else {
        updatedPermissions[deptId] = permission;
      }

      await handleUserUpdate(uid, { departmentPermissions: updatedPermissions });
    } catch (error) {
      console.error('Failed to update department permission:', error);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!window.confirm('정말 이 사용자를 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'users', uid));
      alert('사용자가 삭제되었습니다.');
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('사용자 삭제 실패');
    }
  };

  return (
    <div className="space-y-4">
      {/* 통계 카드 */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-2xl font-bold text-[#081429]">{stats.totalUsers}</div>
          <div className="text-xs text-gray-500">전체 사용자</div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
          <div className="text-2xl font-bold text-emerald-600">{stats.approved}</div>
          <div className="text-xs text-gray-500">승인됨</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-xs text-gray-500">승인 대기</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-2xl font-bold text-blue-600">{stats.matched}</div>
          <div className="text-xs text-gray-500">직원 연결됨</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <div className="text-2xl font-bold text-orange-600">{stats.unmatched}</div>
          <div className="text-xs text-gray-500">미연결</div>
        </div>
      </div>

      {/* 안내 메시지 및 마이그레이션 버튼 */}
      {stats.unmatched > 0 && activeTab === 'approved' && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-orange-900 text-sm mb-1">직원 정보 미연결</h4>
              <p className="text-xs text-orange-800 mb-2">
                {stats.unmatched}명의 사용자가 직원 정보와 연결되지 않았습니다.
                직원 관리에서 동일한 이메일로 직원을 등록하면 자동으로 연결됩니다.
              </p>
              {isMaster && (
                <button
                  onClick={() => setIsMigrationModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors text-xs font-medium"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>자동 마이그레이션 실행</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 모두 연결된 경우 성공 메시지 */}
      {stats.unmatched === 0 && stats.matched > 0 && activeTab === 'approved' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-emerald-900 text-sm mb-1">완벽한 통합!</h4>
              <p className="text-xs text-emerald-800">
                모든 사용자({stats.matched}명)가 직원 정보와 성공적으로 연결되었습니다.
                앞으로 신규 회원가입 시 자동으로 직원 관리에 등록됩니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('approved')}
          className={`pb-2 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'approved'
              ? 'border-[#081429] text-[#081429]'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          정회원 (Members)
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            activeTab === 'approved' ? 'bg-[#081429] text-white' : 'bg-gray-100'
          }`}>
            {stats.approved}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-2 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'pending'
              ? 'border-[#fdb813] text-[#081429]'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          승인 대기 (Requests)
          {stats.pending > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            activeTab === 'pending' ? 'bg-[#fdb813] text-[#081429]' : 'bg-gray-100'
          }`}>
            {stats.pending}
          </span>
        </button>
      </div>

      {/* 검색 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이메일, 이름 검색..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#fdb813] focus:border-transparent"
          />
        </div>
        <div className="text-sm text-gray-500">
          {filteredMatches.length}명 표시
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                이메일 / 사용자
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                직원 정보
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                역할
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                상태
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                연결
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                작업
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredMatches.map(({ user, staffMember, matchType }) => (
              <tr key={user.uid} className="hover:bg-gray-50 transition-colors">
                {/* 이메일 / 사용자 */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      user.role === 'master'
                        ? 'bg-amber-100 text-amber-800'
                        : user.role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {user.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[#081429]">{user.email}</div>
                      {user.jobTitle && (
                        <div className="text-xs text-gray-500">{user.jobTitle}</div>
                      )}
                    </div>
                  </div>
                </td>

                {/* 직원 정보 */}
                <td className="px-4 py-3">
                  {staffMember ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                        style={{
                          backgroundColor: staffMember.role === 'teacher' && staffMember.bgColor ? staffMember.bgColor : '#081429',
                          color: staffMember.role === 'teacher' && staffMember.textColor ? staffMember.textColor : '#ffffff'
                        }}
                      >
                        {staffMember.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#081429]">{staffMember.name}</div>
                        {staffMember.englishName && (
                          <div className="text-xs text-gray-500">{staffMember.englishName}</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">미연결</span>
                  )}
                </td>

                {/* 역할 */}
                <td className="px-4 py-3 text-center">
                  {getRoleBadge(user.role)}
                </td>

                {/* 상태 */}
                <td className="px-4 py-3 text-center">
                  {getStatusBadge(user.status)}
                </td>

                {/* 연결 */}
                <td className="px-4 py-3 text-center">
                  {matchType === 'exact' ? (
                    <div className="flex items-center justify-center gap-1">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs text-emerald-600 font-medium">연결됨</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <XCircle className="w-4 h-4 text-orange-600" />
                      <span className="text-xs text-orange-600 font-medium">미연결</span>
                    </div>
                  )}
                </td>

                {/* 작업 */}
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handlePermissionClick(user)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium hover:bg-blue-50 px-2 py-1 rounded transition-colors ml-auto"
                  >
                    <Settings className="w-3 h-3" />
                    <span>권한 설정</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredMatches.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <UsersIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">표시할 사용자가 없습니다</p>
          </div>
        )}
      </div>

      {/* 권한 설정 모달 */}
      {selectedUserForEdit && (
        <UserDetailModal
          user={selectedUserForEdit}
          departments={departments}
          teachers={teachers}
          currentUserProfile={currentUserProfile}
          initialPermissions={initialPermissions}
          canApproveUser={isMaster}
          canChangeRole={isMaster}
          canChangePermissions={isMaster || currentUserProfile?.role === 'admin'}
          isMaster={isMaster}
          isAdmin={currentUserProfile?.role === 'admin'}
          onClose={() => {
            setSelectedUserForEdit(null);
            setInitialPermissions(null);
          }}
          onUserUpdate={handleUserUpdate}
          onDeptPermissionChange={handleDeptPermissionChange}
          onDeleteUser={handleDeleteUser}
        />
      )}

      {/* 마이그레이션 모달 */}
      {isMigrationModalOpen && (
        <UserStaffMigrationModal
          onClose={() => setIsMigrationModalOpen(false)}
        />
      )}
    </div>
  );
};

export default UsersManagement;
