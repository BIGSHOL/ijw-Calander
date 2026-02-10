import React, { useState, useMemo } from 'react';
import { Department, UserProfile } from '../../../types';
import { Search, Users, Shield, ShieldCheck, ChevronDown, ChevronRight, Eye, Ban, FolderOpen, Folder } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useStaffWithAccounts } from '../../../hooks/useFirebaseQueries';
import { usePermissions } from '../../../hooks/usePermissions';
import { useQueryClient } from '@tanstack/react-query';

interface DepartmentPermissionsTabProps {
  departments: Department[];
  users?: UserProfile[]; // deprecated - staff 데이터로 대체됨
  currentUser: UserProfile | null;
}

// 권한 레이블 (부서 가시성만 제어)
const PERMISSION_LABELS = {
  none: '차단',
  view: '보기',
};

const DepartmentPermissionsTab: React.FC<DepartmentPermissionsTabProps> = ({
  departments,
  users,
  currentUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deptSearchTerm, setDeptSearchTerm] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Permission checks
  const { hasPermission } = usePermissions(currentUser);
  const canManageDepts = hasPermission('departments.manage');

  // staff 컬렉션에서 계정 연동된 직원 가져오기
  const { data: staffWithAccounts = [] } = useStaffWithAccounts(canManageDepts);

  // uid → staffId 매핑 생성
  const uidToStaffId = useMemo(() => {
    const map = new Map<string, string>();
    staffWithAccounts.forEach(s => {
      if (s.uid) map.set(s.uid, s.id);
    });
    return map;
  }, [staffWithAccounts]);

  // 승인된 사용자만 표시 (staff 데이터 기반)
  const approvedUsers = useMemo(() => {
    // staff 데이터를 UserProfile 형태로 변환하여 사용
    return staffWithAccounts
      .filter(s => s.approvalStatus === 'approved')
      .map(s => ({
        uid: s.uid || s.id,
        email: s.email || '',
        displayName: s.name,
        role: s.systemRole || 'user',
        status: s.approvalStatus || 'pending',
        departmentPermissions: s.departmentPermissions || {},
        jobTitle: s.jobTitle,
        staffId: s.id, // staff 컬렉션의 문서 ID
      }))
      .sort((a, b) => {
        const roleOrder = { master: 0, admin: 1, manager: 2, math_lead: 3, english_lead: 4, math_teacher: 5, english_teacher: 6, user: 7 };
        return (roleOrder[a.role as keyof typeof roleOrder] || 99) - (roleOrder[b.role as keyof typeof roleOrder] || 99);
      });
  }, [staffWithAccounts]);

  // 검색 필터
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return approvedUsers;
    const q = searchTerm.toLowerCase();
    return approvedUsers.filter(u =>
      u.email.toLowerCase().includes(q) ||
      u.displayName?.toLowerCase().includes(q) ||
      u.jobTitle?.toLowerCase().includes(q)
    );
  }, [approvedUsers, searchTerm]);

  // 부서 검색 필터
  const filteredDepartments = useMemo(() => {
    if (!deptSearchTerm) return departments;
    const q = deptSearchTerm.toLowerCase();
    return departments.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.category?.toLowerCase().includes(q)
    );
  }, [departments, deptSearchTerm]);

  // 카테고리별 부서 그룹화
  const departmentsByCategory = useMemo(() => {
    const grouped = new Map<string, Department[]>();
    filteredDepartments.forEach(dept => {
      const category = dept.category || '미분류';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(dept);
    });
    // 카테고리 이름 순으로 정렬, '미분류'는 마지막
    return Array.from(grouped.entries()).sort((a, b) => {
      if (a[0] === '미분류') return 1;
      if (b[0] === '미분류') return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [filteredDepartments]);

  // 카테고리 토글
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // 모든 카테고리 펼치기/접기
  const toggleAllCategories = (expand: boolean) => {
    if (expand) {
      setExpandedCategories(new Set(departmentsByCategory.map(([cat]) => cat)));
    } else {
      setExpandedCategories(new Set());
    }
  };

  // 권한 요약 계산 (가시성만)
  const getPermissionSummary = (user: UserProfile) => {
    if (user.role === 'master') return { view: departments.length, none: 0, label: '전체 보기' };

    const perms = user.departmentPermissions || {};
    let view = 0, none = 0;
    departments.forEach(d => {
      const p = perms[d.id];
      if (p === 'view') view++;
      else none++;
    });

    if (view === departments.length) return { view, none, label: '전체 보기' };
    if (none === departments.length) return { view, none, label: '전체 차단' };
    return { view, none, label: `보기 ${view}개 / 차단 ${none}개` };
  };

  // 권한 변경 핸들러 - staff 컬렉션에 저장 (가시성만)
  const handlePermissionChange = async (uid: string, deptId: string, level: 'none' | 'view') => {
    const user = approvedUsers.find(u => u.uid === uid);
    if (!user) return;

    const staffId = uidToStaffId.get(uid) || user.staffId;
    if (!staffId) {
      alert('직원 정보를 찾을 수 없습니다.');
      return;
    }

    setSaving(uid);

    // Optimistic update를 위한 이전 데이터 백업
    const previousData = queryClient.getQueryData(['staffWithAccounts']);

    try {
      const newPerms = { ...(user.departmentPermissions || {}) };
      if (level === 'none') {
        delete newPerms[deptId];
      } else {
        newPerms[deptId] = level;
      }

      // Optimistic update: UI 즉시 업데이트
      queryClient.setQueryData(['staffWithAccounts'], (old: any) => {
        if (!old) return old;
        return old.map((s: any) =>
          s.id === staffId
            ? { ...s, departmentPermissions: newPerms }
            : s
        );
      });

      // staff 컬렉션에 저장
      await updateDoc(doc(db, 'staff', staffId), {
        departmentPermissions: newPerms,
      });
    } catch (e) {
      console.error('권한 변경 실패:', e);
      alert('권한 변경에 실패했습니다.');
      // 실패 시 이전 데이터로 롤백
      queryClient.setQueryData(['staffWithAccounts'], previousData);
    } finally {
      setSaving(null);
    }
  };

  // 일괄 권한 변경 - staff 컬렉션에 저장 (가시성만)
  const handleBulkPermission = async (uid: string, level: 'none' | 'view') => {
    const user = approvedUsers.find(u => u.uid === uid);
    if (!user) return;

    const staffId = uidToStaffId.get(uid) || user.staffId;
    if (!staffId) {
      alert('직원 정보를 찾을 수 없습니다.');
      return;
    }

    setSaving(uid);

    // Optimistic update를 위한 이전 데이터 백업
    const previousData = queryClient.getQueryData(['staffWithAccounts']);

    try {
      const newPerms: Record<string, 'view'> = {};
      if (level !== 'none') {
        departments.forEach(d => {
          newPerms[d.id] = level;
        });
      }

      // Optimistic update: UI 즉시 업데이트
      queryClient.setQueryData(['staffWithAccounts'], (old: any) => {
        if (!old) return old;
        return old.map((s: any) =>
          s.id === staffId
            ? { ...s, departmentPermissions: newPerms }
            : s
        );
      });

      // staff 컬렉션에 저장
      await updateDoc(doc(db, 'staff', staffId), {
        departmentPermissions: newPerms,
      });
    } catch (e) {
      console.error('일괄 권한 변경 실패:', e);
      alert('권한 변경에 실패했습니다.');
      // 실패 시 이전 데이터로 롤백
      queryClient.setQueryData(['staffWithAccounts'], previousData);
    } finally {
      setSaving(null);
    }
  };

  const canEdit = canManageDepts;

  return (
    <div className="space-y-3">
      {/* 검색 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="사용자 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-sm text-xs focus:border-accent outline-none"
          />
        </div>
        <div className="text-xxs text-gray-400">
          {filteredUsers.length}명
        </div>
      </div>

      {/* 사용자 목록 - 아코디언 */}
      <div className="space-y-1">
        {filteredUsers.map(user => {
          const isCurrentUser = user.uid === currentUser?.uid;
          const isSaving = saving === user.uid;
          const isExpanded = expandedUser === user.uid;
          const summary = getPermissionSummary(user);
          const isUserMaster = user.role === 'master';

          return (
            <div
              key={user.uid}
              className={`bg-white rounded-sm border border-gray-200 overflow-hidden ${isSaving ? 'opacity-50' : ''}`}
            >
              {/* 헤더 - 클릭하면 펼침/접힘 */}
              <div
                onClick={() => !isUserMaster && setExpandedUser(isExpanded ? null : user.uid)}
                className={`flex items-center justify-between p-2 ${!isUserMaster ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* 펼침 아이콘 */}
                  {!isUserMaster ? (
                    isExpanded ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />
                  ) : (
                    <div className="w-3.5" />
                  )}

                  {/* 아이콘 */}
                  <div className={`w-6 h-6 rounded-sm flex items-center justify-center shrink-0 ${user.role === 'master' ? 'bg-accent text-primary' :
                      user.role === 'admin' ? 'bg-indigo-600 text-white' :
                        'bg-gray-100 text-gray-500'
                    }`}>
                    {user.role === 'master' ? <ShieldCheck size={10} /> :
                      user.role === 'admin' ? <Shield size={10} /> :
                        <Users size={10} />}
                  </div>

                  {/* 이름 */}
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-primary truncate block">
                      {user.displayName || user.email.split('@')[0]}
                      {user.jobTitle && <span className="text-gray-400 font-normal ml-1">({user.jobTitle})</span>}
                    </span>
                  </div>
                </div>

                {/* 권한 요약 뱃지 */}
                <div className="flex items-center gap-2 shrink-0">
                  {isUserMaster ? (
                    <span className="text-xxs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                      전체 권한
                    </span>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 text-xxs">
                        {summary.view > 0 && (
                          <span className="flex items-center gap-0.5 text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            <Eye size={8} /> {summary.view}
                          </span>
                        )}
                        {summary.none > 0 && (
                          <span className="flex items-center gap-0.5 text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            <Ban size={8} /> {summary.none}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 펼쳐진 내용 */}
              {isExpanded && !isUserMaster && (
                <div className="border-t border-gray-100 p-2 bg-gray-50/50">
                  {/* 상단 컨트롤: 일괄 설정 + 부서 검색 */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {/* 일괄 설정 버튼 - 차단 / 보기 */}
                    {canEdit && !isCurrentUser && (
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleBulkPermission(user.uid, 'none'); }}
                          disabled={isSaving}
                          className="px-2 py-1 text-xxs font-bold bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
                        >
                          전체 차단
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleBulkPermission(user.uid, 'view'); }}
                          disabled={isSaving}
                          className="px-2 py-1 text-xxs font-bold bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                        >
                          전체 보기
                        </button>
                      </div>
                    )}

                    {/* 부서 검색 */}
                    <div className="relative flex-1 min-w-[120px]">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={10} />
                      <input
                        type="text"
                        placeholder="부서 검색..."
                        value={deptSearchTerm}
                        onChange={(e) => { e.stopPropagation(); setDeptSearchTerm(e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full pl-6 pr-2 py-1 bg-white border border-gray-200 rounded text-xxs focus:border-accent outline-none"
                      />
                    </div>

                    {/* 전체 펼치기/접기 */}
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleAllCategories(true); }}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                        title="모두 펼치기"
                      >
                        <FolderOpen size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleAllCategories(false); }}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                        title="모두 접기"
                      >
                        <Folder size={12} />
                      </button>
                    </div>
                  </div>

                  {/* 카테고리별 부서 권한 */}
                  <div className="space-y-1">
                    {departmentsByCategory.map(([category, depts]) => {
                      const isCategoryExpanded = expandedCategories.has(category);
                      const categoryViewCount = depts.filter(d => user.departmentPermissions?.[d.id] === 'view').length;

                      return (
                        <div key={category} className="bg-white rounded border border-gray-100 overflow-hidden">
                          {/* 카테고리 헤더 */}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleCategory(category); }}
                            className="w-full flex items-center justify-between p-1.5 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-1.5">
                              {isCategoryExpanded ? (
                                <ChevronDown size={12} className="text-gray-400" />
                              ) : (
                                <ChevronRight size={12} className="text-gray-400" />
                              )}
                              <span className="text-xxs font-bold text-gray-700">{category}</span>
                              <span className="text-micro text-gray-400">({depts.length})</span>
                            </div>
                            <div className="flex items-center gap-1 text-micro">
                              <span className="text-blue-500">{categoryViewCount}</span>
                              <span className="text-gray-300">/</span>
                              <span className="text-gray-400">{depts.length}</span>
                            </div>
                          </button>

                          {/* 부서 목록 */}
                          {isCategoryExpanded && (
                            <div className="border-t border-gray-50 p-1.5 bg-gray-50/30">
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                                {depts.map(dept => {
                                  const current = user.departmentPermissions?.[dept.id];

                                  return (
                                    <div
                                      key={dept.id}
                                      className="flex items-center justify-between p-1.5 rounded bg-white border border-gray-100"
                                    >
                                      <div className="flex items-center gap-1 min-w-0 flex-1">
                                        <div
                                          className="w-2 h-2 rounded-sm shrink-0"
                                          style={{ backgroundColor: dept.color }}
                                        />
                                        <span className="text-xxs font-medium text-gray-600 truncate">
                                          {dept.name}
                                        </span>
                                      </div>

                                      <div className="flex bg-gray-50 rounded p-0.5 shrink-0">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handlePermissionChange(user.uid, dept.id, 'none'); }}
                                          disabled={!canEdit || isCurrentUser || isSaving}
                                          className={`w-5 h-5 flex items-center justify-center rounded transition-all ${!current
                                              ? 'bg-gray-300 text-white'
                                              : 'text-gray-300 hover:bg-gray-200'
                                            } ${(!canEdit || isCurrentUser) ? 'cursor-not-allowed' : ''}`}
                                          title={PERMISSION_LABELS.none}
                                        >
                                          <Ban size={10} />
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handlePermissionChange(user.uid, dept.id, 'view'); }}
                                          disabled={!canEdit || isCurrentUser || isSaving}
                                          className={`w-5 h-5 flex items-center justify-center rounded transition-all ${current === 'view'
                                              ? 'bg-blue-500 text-white'
                                              : 'text-gray-300 hover:bg-gray-200'
                                            } ${(!canEdit || isCurrentUser) ? 'cursor-not-allowed' : ''}`}
                                          title={PERMISSION_LABELS.view}
                                        >
                                          <Eye size={10} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {departmentsByCategory.length === 0 && deptSearchTerm && (
                      <div className="text-center py-2 text-gray-400 text-xxs">
                        검색 결과가 없습니다.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredUsers.length === 0 && (
          <div className="text-center py-6 text-gray-400 text-xs">
            {searchTerm ? '검색 결과가 없습니다.' : '승인된 사용자가 없습니다.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default DepartmentPermissionsTab;
