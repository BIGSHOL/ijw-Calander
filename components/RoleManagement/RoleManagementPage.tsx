import React, { useState, useEffect } from 'react';
import {
  RolePermissions,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_HIERARCHY,
  ROLE_LABELS,
  PermissionId,
  TabPermissionConfig,
  DEFAULT_TAB_PERMISSIONS,
  APP_TABS,
  AppTab,
  UserRole,
  UserProfile
} from '../../types';
import { db } from '../../firebaseConfig';
import { setDoc, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { listenerRegistry } from '../../utils/firebaseCleanup';
import { RotateCcw, Save, Shield, Layout, ChevronDown, ChevronRight, Check, X } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { storage, STORAGE_KEYS } from '../../utils/localStorage';

interface RoleManagementPageProps {
  currentUser: UserProfile | null;
}

// Permission categories for compact display
const PERMISSION_CATEGORIES = [
  {
    id: 'events',
    label: '일정',
    icon: '📅',
    permissions: [
      { id: 'events.create' as PermissionId, label: '생성' },
      { id: 'events.manage_own' as PermissionId, label: '본인관리' },
      { id: 'events.manage_others' as PermissionId, label: '타인관리' },
      { id: 'events.drag_move' as PermissionId, label: '드래그' },
      { id: 'events.attendance' as PermissionId, label: '참가현황' },
      { id: 'events.bucket' as PermissionId, label: '버킷' },
    ]
  },
  {
    id: 'timetable',
    label: '시간표',
    icon: '📋',
    permissions: [
      { id: 'timetable.math.view' as PermissionId, label: '수학조회' },
      { id: 'timetable.math.edit' as PermissionId, label: '수학편집' },
      { id: 'timetable.english.view' as PermissionId, label: '영어조회' },
      { id: 'timetable.english.edit' as PermissionId, label: '영어편집' },
      { id: 'timetable.english.simulation' as PermissionId, label: '시뮬레이션' },
      { id: 'timetable.english.backup.view' as PermissionId, label: '백업조회' },
      { id: 'timetable.english.backup.restore' as PermissionId, label: '백업복원' },
      { id: 'timetable.integrated.view' as PermissionId, label: '통합뷰' },
    ]
  },
  {
    id: 'attendance',
    label: '출석부',
    icon: '📝',
    permissions: [
      { id: 'attendance.manage_own' as PermissionId, label: '본인관리' },
      { id: 'attendance.edit_all' as PermissionId, label: '전체수정' },
      { id: 'attendance.manage_math' as PermissionId, label: '수학관리' },
      { id: 'attendance.manage_english' as PermissionId, label: '영어관리' },
      { id: 'attendance.edit_student_info' as PermissionId, label: '학생정보' },
      { id: 'attendance.manage_sessions' as PermissionId, label: '세션설정' },
    ]
  },
  {
    id: 'students',
    label: '학생',
    icon: '👥',
    permissions: [
      { id: 'students.view' as PermissionId, label: '조회' },
      { id: 'students.edit' as PermissionId, label: '수정' },
      { id: 'students.delete' as PermissionId, label: '삭제' },
      // 수강배정은 수업 관리(classes.edit) 권한으로 통합됨
    ]
  },
  {
    id: 'classes',
    label: '수업',
    icon: '📚',
    permissions: [
      { id: 'classes.view' as PermissionId, label: '조회' },
      { id: 'classes.create' as PermissionId, label: '생성' },
      { id: 'classes.edit' as PermissionId, label: '수정' },
      { id: 'classes.delete' as PermissionId, label: '삭제' },
    ]
  },
  {
    id: 'consultation',
    label: '상담',
    icon: '📞',
    permissions: [
      { id: 'consultation.view' as PermissionId, label: '조회' },
      { id: 'consultation.create' as PermissionId, label: '생성' },
      { id: 'consultation.edit' as PermissionId, label: '수정' },
      { id: 'consultation.convert' as PermissionId, label: '전환' },
      { id: 'consultation.manage' as PermissionId, label: '관리' },
    ]
  },
  {
    id: 'grades',
    label: '성적',
    icon: '📊',
    permissions: [
      { id: 'grades.view' as PermissionId, label: '조회' },
      { id: 'grades.edit' as PermissionId, label: '수정' },
      { id: 'grades.manage_exams' as PermissionId, label: '시험관리' },
    ]
  },
  {
    id: 'billing',
    label: '수납',
    icon: '💰',
    permissions: [
      { id: 'billing.view' as PermissionId, label: '조회' },
      { id: 'billing.edit' as PermissionId, label: '수정' },
    ]
  },
  {
    id: 'system',
    label: '시스템',
    icon: '⚙️',
    permissions: [
      { id: 'departments.view_all' as PermissionId, label: '부서조회' },
      { id: 'departments.manage' as PermissionId, label: '부서관리' },
      { id: 'system.teachers.view' as PermissionId, label: '강사조회' },
      { id: 'system.teachers.edit' as PermissionId, label: '강사편집' },
      { id: 'system.classes.view' as PermissionId, label: '수업키워드' },
      { id: 'system.classes.edit' as PermissionId, label: '수업키워드편집' },
    ]
  },
  {
    id: 'users',
    label: '사용자',
    icon: '👤',
    permissions: [
      { id: 'users.view' as PermissionId, label: '조회' },
      { id: 'users.approve' as PermissionId, label: '승인' },
      { id: 'users.change_role' as PermissionId, label: '역할변경' },
      { id: 'users.change_permissions' as PermissionId, label: '권한변경' },
    ]
  },
  {
    id: 'settings',
    label: '설정',
    icon: '🔧',
    permissions: [
      { id: 'settings.access' as PermissionId, label: '접근' },
      { id: 'settings.holidays' as PermissionId, label: '공휴일' },
      { id: 'settings.role_permissions' as PermissionId, label: '역할권한' },
      { id: 'settings.manage_categories' as PermissionId, label: '카테고리' },
    ]
  },
  {
    id: 'gantt',
    label: '간트',
    icon: '📊',
    permissions: [
      { id: 'gantt.view' as PermissionId, label: '조회' },
      { id: 'gantt.create' as PermissionId, label: '생성' },
      { id: 'gantt.edit' as PermissionId, label: '수정' },
      { id: 'gantt.delete' as PermissionId, label: '삭제' },
    ]
  },
];

const ROLES_TO_SHOW = ROLE_HIERARCHY.filter(r => r !== 'master') as UserRole[];

const RoleManagementPage: React.FC<RoleManagementPageProps> = ({
  currentUser
}) => {
  // Permissions
  const { hasPermission } = usePermissions(currentUser);
  const isMaster = currentUser?.role === 'master';

  // 권한 체크: settings.role_permissions 권한이 있거나 MASTER인 경우
  const canView = isMaster || hasPermission('settings.access');
  const canEdit = isMaster || hasPermission('settings.role_permissions');

  // State
  const [activeSection, setActiveSection] = useState<'permissions' | 'tabs'>('permissions');
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);
  const [tabPermissions, setTabPermissions] = useState<TabPermissionConfig>(DEFAULT_TAB_PERMISSIONS);
  const [loaded, setLoaded] = useState(false);
  // 로컬 스토리지에서 열린 카테고리 로드 (기본값: 모두 접힘)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    try {
      const saved = storage.getString(STORAGE_KEYS.ROLE_MANAGEMENT_EXPANDED);
      if (saved) return new Set(JSON.parse(saved));
      // Migration from old key
      const old = localStorage.getItem('roleManagement_expandedCategories');
      if (old) {
        storage.setString(STORAGE_KEYS.ROLE_MANAGEMENT_EXPANDED, old);
        localStorage.removeItem('roleManagement_expandedCategories');
        return new Set(JSON.parse(old));
      }
    } catch (e) {
      console.error('Failed to load expanded categories:', e);
    }
    return new Set();
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Load data
  useEffect(() => {
    if (!canView) return;

    // Load role permissions
    const unsubRole = onSnapshot(doc(db, 'settings', 'rolePermissions'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as RolePermissions;
        const merged: RolePermissions = {};
        for (const role of ROLES_TO_SHOW) {
          merged[role] = {
            ...DEFAULT_ROLE_PERMISSIONS[role],
            ...(data[role] || {})
          };
        }
        setRolePermissions(merged);
      } else {
        setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
      }
    });

    // Load tab permissions
    const unsubTab = onSnapshot(doc(db, 'system', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const fetchedPerms = data.tabPermissions as TabPermissionConfig | undefined;
        if (fetchedPerms) {
          const merged: TabPermissionConfig = {};
          for (const role of ROLES_TO_SHOW) {
            merged[role] = fetchedPerms[role] || DEFAULT_TAB_PERMISSIONS[role] || [];
          }
          setTabPermissions(merged);
        } else {
          setTabPermissions(DEFAULT_TAB_PERMISSIONS);
        }
      } else {
        setTabPermissions(DEFAULT_TAB_PERMISSIONS);
      }
      setLoaded(true);
    });

    return () => {
      unsubRole();
      unsubTab();
    };
  }, [canView]);

  // Handlers
  const handlePermissionChange = (role: UserRole, permId: PermissionId, checked: boolean) => {
    if (!canEdit) return;
    setHasChanges(true);

    setRolePermissions(prev => {
      const rolePerms = { ...prev[role] };
      rolePerms[permId] = checked;

      // Linked pairs logic
      const linkedPairs: { manage: PermissionId; view: PermissionId }[] = [
        { manage: 'timetable.math.edit', view: 'timetable.math.view' },
        { manage: 'timetable.english.edit', view: 'timetable.english.view' },
        { manage: 'system.teachers.edit', view: 'system.teachers.view' },
        { manage: 'system.classes.edit', view: 'system.classes.view' },
      ];

      const pairForManage = linkedPairs.find(p => p.manage === permId);
      if (checked && pairForManage) {
        rolePerms[pairForManage.view] = true;
      }

      const pairForView = linkedPairs.find(p => p.view === permId);
      if (!checked && pairForView) {
        rolePerms[pairForView.manage] = false;
      }

      return { ...prev, [role]: rolePerms };
    });
  };

  const handleTabToggle = (role: UserRole, tabId: AppTab, checked: boolean) => {
    if (!canEdit) return;
    setHasChanges(true);

    setTabPermissions(prev => {
      const currentTabs = prev[role] || [];
      let newTabs: AppTab[];

      if (checked) {
        newTabs = currentTabs.includes(tabId) ? currentTabs : [...currentTabs, tabId];
      } else {
        newTabs = currentTabs.filter(t => t !== tabId);
      }

      return { ...prev, [role]: newTabs };
    });
  };

  const handleSave = async () => {
    // 권한 체크 (개발자 도구 우회 방지)
    if (!canEdit) {
      alert('권한이 없습니다. MASTER만 수정할 수 있습니다.');
      return;
    }

    try {
      await Promise.all([
        setDoc(doc(db, 'settings', 'rolePermissions'), rolePermissions, { merge: true }),
        setDoc(doc(db, 'system', 'config'), { tabPermissions }, { merge: true })
      ]);
      setHasChanges(false);
      alert('저장되었습니다.');
    } catch (e) {
      console.error(e);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleReset = () => {
    // 권한 체크 (개발자 도구 우회 방지)
    if (!canEdit) {
      alert('권한이 없습니다. MASTER만 수정할 수 있습니다.');
      return;
    }

    if (confirm('모든 설정을 기본값으로 초기화하시겠습니까?')) {
      setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
      setTabPermissions(DEFAULT_TAB_PERMISSIONS);
      setHasChanges(true);
    }
  };

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      storage.setJSON(STORAGE_KEYS.ROLE_MANAGEMENT_EXPANDED, [...next]);
      return next;
    });
  };

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-indigo-100 text-indigo-700';
      case 'manager': return 'bg-purple-100 text-purple-700';
      case 'math_lead': return 'bg-green-100 text-green-700 border border-green-300';
      case 'english_lead': return 'bg-orange-100 text-orange-700 border border-orange-300';
      case 'math_teacher': return 'bg-green-50 text-green-600 border border-green-200';
      case 'english_teacher': return 'bg-orange-50 text-orange-600 border border-orange-200';
      case 'user': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <Shield size={48} className="mx-auto mb-4 opacity-30" />
          <p>접근 권한이 없습니다.</p>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-none">
            <Shield size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">역할 관리</h1>
            <p className="text-xs text-gray-500">역할별 권한과 탭 접근을 관리합니다</p>
            <p className="text-xs text-orange-600 font-medium mt-0.5">
              ⚠️ 권한 변경 후 최대 30분 소요 (즉시 적용: 재로그인 필요)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Section Toggle */}
          <div className="flex bg-gray-100 rounded-none p-0.5">
            <button
              onClick={() => setActiveSection('permissions')}
              className={`px-3 py-1.5 text-xs font-bold rounded-none transition-colors ${activeSection === 'permissions' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Shield size={14} className="inline mr-1" />
              권한
            </button>
            <button
              onClick={() => setActiveSection('tabs')}
              className={`px-3 py-1.5 text-xs font-bold rounded-none transition-colors ${activeSection === 'tabs' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Layout size={14} className="inline mr-1" />
              탭 접근
            </button>
          </div>

          {!canEdit && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-none font-bold">읽기 전용</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="bg-white min-h-full">
          {/* Role Headers */}
          <div className="sticky top-0 z-20 bg-gray-50 border-b">
            <div className="flex">
              <div className="w-48 shrink-0 px-3 py-2 font-bold text-xs text-gray-500 border-r bg-gray-50">
                {activeSection === 'permissions' ? '권한' : '메뉴'}
              </div>
              {ROLES_TO_SHOW.map(role => (
                <div key={role} className="flex-1 min-w-[80px] px-2 py-2 text-center border-r last:border-r-0">
                  <span className={`inline-block px-2 py-0.5 rounded-none text-[10px] font-black ${getRoleBadgeStyle(role)}`}>
                    {ROLE_LABELS[role]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Permissions Section */}
          {activeSection === 'permissions' && (
            <div className="divide-y divide-gray-100">
              {PERMISSION_CATEGORIES.map(category => (
                <div key={category.id}>
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center px-3 py-2 bg-gray-50/50 hover:bg-gray-100/50 transition-colors"
                  >
                    <div className="w-48 shrink-0 flex items-center gap-2 text-left">
                      {expandedCategories.has(category.id) ? (
                        <ChevronDown size={14} className="text-gray-400" />
                      ) : (
                        <ChevronRight size={14} className="text-gray-400" />
                      )}
                      <span className="text-sm">{category.icon}</span>
                      <span className="text-xs font-bold text-gray-700">{category.label}</span>
                      <span className="text-[10px] text-gray-400">({category.permissions.length})</span>
                    </div>
                    {/* Quick summary when collapsed */}
                    {!expandedCategories.has(category.id) && (
                      <div className="flex-1 flex">
                        {ROLES_TO_SHOW.map(role => {
                          const enabledCount = category.permissions.filter(
                            p => rolePermissions[role]?.[p.id]
                          ).length;
                          return (
                            <div key={role} className="flex-1 min-w-[80px] text-center">
                              <span className={`text-[10px] font-bold ${enabledCount === category.permissions.length ? 'text-green-600' : enabledCount > 0 ? 'text-yellow-600' : 'text-gray-300'}`}>
                                {enabledCount}/{category.permissions.length}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </button>

                  {/* Permission Rows */}
                  {expandedCategories.has(category.id) && (
                    <div className="divide-y divide-gray-50">
                      {category.permissions.map(perm => (
                        <div key={perm.id} className="flex hover:bg-gray-50/30">
                          <div className="w-48 shrink-0 px-3 py-1.5 pl-8 border-r">
                            <span className="text-xs text-gray-600">{perm.label}</span>
                          </div>
                          {ROLES_TO_SHOW.map(role => (
                            <div key={role} className="flex-1 min-w-[80px] flex items-center justify-center border-r last:border-r-0 py-1">
                              <button
                                onClick={() => handlePermissionChange(role, perm.id, !rolePermissions[role]?.[perm.id])}
                                disabled={!canEdit}
                                className={`w-5 h-5 rounded-none flex items-center justify-center transition-colors ${rolePermissions[role]?.[perm.id]
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                                  } ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                {rolePermissions[role]?.[perm.id] ? <Check size={12} /> : null}
                              </button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Tabs Section */}
          {activeSection === 'tabs' && (
            <div className="divide-y divide-gray-100">
              {APP_TABS.filter(tab => tab.id !== 'role-management').map(tab => (
                <div key={tab.id} className="flex hover:bg-gray-50/30">
                  <div className="w-48 shrink-0 px-3 py-2 border-r">
                    <span className="text-xs font-medium text-gray-700">{tab.label}</span>
                    <span className="text-[10px] text-gray-400 ml-1 font-mono">({tab.id})</span>
                  </div>
                  {ROLES_TO_SHOW.map(role => (
                    <div key={role} className="flex-1 min-w-[80px] flex items-center justify-center border-r last:border-r-0 py-2">
                      <button
                        onClick={() => handleTabToggle(role, tab.id, !tabPermissions[role]?.includes(tab.id))}
                        disabled={!canEdit}
                        className={`w-5 h-5 rounded-none flex items-center justify-center transition-colors ${tabPermissions[role]?.includes(tab.id)
                          ? 'bg-indigo-500 text-white'
                          : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                          } ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {tabPermissions[role]?.includes(tab.id) ? <Check size={12} /> : null}
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      {canEdit && (
        <div className="bg-white border-t px-4 py-3 flex justify-between items-center shrink-0">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-none flex items-center gap-1 transition-colors"
          >
            <RotateCcw size={12} /> 기본값 초기화
          </button>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-xs text-orange-600 font-medium">저장되지 않은 변경사항</span>
            )}
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`px-4 py-1.5 text-xs font-bold rounded-none flex items-center gap-1 transition-colors ${hasChanges
                ? 'bg-[#081429] text-white hover:bg-[#0a1a35]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
            >
              <Save size={12} /> 저장
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagementPage;
