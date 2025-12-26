import React, { useState, useEffect } from 'react';
import { Department, UserProfile, CalendarEvent, UserRole, ROLE_LABELS, ROLE_HIERARCHY, PermissionId, RolePermissions, DEFAULT_ROLE_PERMISSIONS, Teacher } from '../types';
import { usePermissions, canAssignRole, getAssignableRoles } from '../hooks/usePermissions';
import { X, Plus, Trash2, GripVertical, FolderKanban, Users, Check, XCircle, Shield, ShieldAlert, ShieldCheck, Database, CheckCircle2, Search, Save, Edit, ChevronRight, UserCog, RotateCcw, UserPlus, CalendarClock, Calendar, Lock, List, LayoutGrid, Eye, EyeOff } from 'lucide-react';
import { STANDARD_HOLIDAYS } from '../constants_holidays';
import { db, auth } from '../firebaseConfig';
import { setDoc, doc, deleteDoc, writeBatch, collection, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';

import { Holiday } from '../types';
import MyEventsModal from './MyEventsModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  currentUserProfile?: UserProfile | null;
  users: UserProfile[];
  holidays: Holiday[];
  events: CalendarEvent[];
  sysCategories: string[];
}

type TabMode = 'departments' | 'users' | 'teachers' | 'system' | 'calendar_manage' | 'role_permissions';

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  departments,
  currentUserProfile,
  users,
  holidays,
  events,
  sysCategories = [],
}) => {
  const { hasPermission } = usePermissions(currentUserProfile || null);

  const canViewDepartments = hasPermission('departments.view_all');
  const canViewUsers = hasPermission('users.view');

  const canCreateDept = hasPermission('departments.create');
  const canEditDept = hasPermission('departments.edit');
  const canManageCategories = hasPermission('settings.manage_categories');
  const canDeleteDept = hasPermission('departments.delete');

  const canApproveUser = hasPermission('users.approve');
  const canChangeRole = hasPermission('users.change_role');
  const canChangePermissions = hasPermission('users.change_permissions');

  const isMaster = currentUserProfile?.role === 'master';
  const isAdmin = currentUserProfile?.role === 'admin';
  // Legacy helpers mapped to permissions
  const canManageMenus = canViewDepartments;
  const canManageUsers = canViewUsers;

  const [activeTab, setActiveTab] = useState<TabMode>('departments');
  const [newDeptName, setNewDeptName] = useState('');
  // Default Colors for New Department
  const [newDeptCategory, setNewDeptCategory] = useState(''); // New Category State
  const [newDeptDefaultColor, setNewDeptDefaultColor] = useState('#ffffff');
  const [newDeptDefaultTextColor, setNewDeptDefaultTextColor] = useState('#000000');
  const [newDeptDefaultBorderColor, setNewDeptDefaultBorderColor] = useState('#fee2e2');

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [deptSearchTerm, setDeptSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState(''); // New User Search
  const [userTab, setUserTab] = useState<'approved' | 'pending'>('approved'); // New Sub-tab state

  // --- Local Buffered State ---
  const [localDepartments, setLocalDepartments] = useState<Department[]>([]);
  const [localUsers, setLocalUsers] = useState<UserProfile[]>([]);
  const [localHolidays, setLocalHolidays] = useState<Holiday[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // --- User Detail Modal State ---
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<string | null>(null); // UID
  const [targetUserForEvents, setTargetUserForEvents] = useState<UserProfile | null>(null); // Admin Event View
  const [initialPermissions, setInitialPermissions] = useState<Record<string, 'view' | 'edit'> | null>(null);

  // Sync Props to Local State (Smart Merge)
  useEffect(() => {
    if (!isOpen) return;
    setLocalDepartments(prev => {
      const prevMap = new Map(prev.map(d => [d.id, d]));
      return departments.map(d => prevMap.get(d.id) || d);
    });
  }, [departments, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setLocalUsers(prev => {
      const prevMap = new Map(prev.map(u => [u.uid, u]));
      return users.map(u => {
        // Migration Logic on load: Ensure departmentPermissions object exists if missing
        const local = prevMap.get(u.uid);
        const base = local || u;
        if (!base.departmentPermissions) {
          // Copy legacy allowedDepartments to view permissions
          const perms: Record<string, 'view' | 'edit'> = {};
          base.allowedDepartments?.forEach(deptId => {
            perms[deptId] = 'view';
          });
          return { ...base, departmentPermissions: perms };
        }
        return base;
      });
    });
  }, [users, isOpen]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setLocalDepartments(departments);
      // Initialize with basic migration for display
      setLocalUsers(users.map(u => ({
        ...u,
        departmentPermissions: u.departmentPermissions ||
          (u.allowedDepartments ? Object.fromEntries(u.allowedDepartments.map(id => [id, 'view'])) : {})
      })));
      setLocalHolidays(holidays); // Sync holidays
      setHasChanges(false);
      setSelectedUserForEdit(null);
    }
  }, [isOpen, holidays, departments, users]); // Added dependencies for completeness

  const [lookbackYears, setLookbackYears] = useState<number>(2);

  // --- Holiday Management State ---
  const [expandedYear, setExpandedYear] = useState<string>(new Date().getFullYear().toString());
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [editHolidayName, setEditHolidayName] = useState('');

  // --- Teacher Management State ---
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherSubjects, setNewTeacherSubjects] = useState<string[]>(['math', 'english']);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [editTeacherName, setEditTeacherName] = useState('');
  const [editTeacherSubjects, setEditTeacherSubjects] = useState<string[]>([]);
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');

  // --- Category Management State ---
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return alert('카테고리 이름을 입력해주세요.');
    const trimmed = newCategoryName.trim();
    if (sysCategories.includes(trimmed)) return alert('이미 존재하는 카테고리입니다.');

    try {
      const newCats = [...sysCategories, trimmed].sort();
      await setDoc(doc(db, 'system', 'config'), { categories: newCats }, { merge: true });
      setNewCategoryName('');
    } catch (e) {
      console.error(e);
      alert('카테고리 추가 실패');
    }
  };

  const handleDeleteCategory = async (cat: string) => {
    if (!confirm(`'${cat}' 카테고리를 삭제하시겠습니까?`)) return;
    try {
      const newCats = sysCategories.filter(c => c !== cat);
      await setDoc(doc(db, 'system', 'config'), { categories: newCats }, { merge: true });
    } catch (e) {
      console.error(e);
      alert('카테고리 삭제 실패');
    }
  };
  // --- Category Management State ---
  // ... (Category handlers remain here if any, but adding Teacher handlers below)

  // --- Teacher Management Handlers ---
  const handleAddTeacher = async () => {
    if (!newTeacherName.trim()) return alert("강사 이름을 입력해주세요.");
    try {
      const newRef = doc(collection(db, '강사목록'));
      await setDoc(newRef, { name: newTeacherName.trim(), subjects: newTeacherSubjects });
      setNewTeacherName('');
      setNewTeacherSubjects(['math', 'english']); // Reset to default
    } catch (e) {
      console.error(e);
      alert("강사 추가 실패");
    }
  };

  const handleUpdateTeacher = async (id: string) => {
    if (!editTeacherName.trim()) return;
    try {
      await updateDoc(doc(db, '강사목록', id), { name: editTeacherName.trim(), subjects: editTeacherSubjects });
      setEditingTeacherId(null);
    } catch (e) {
      console.error(e);
      alert("강사 수정 실패");
    }
  };

  const handleToggleVisibility = async (id: string, currentHidden: boolean) => {
    try {
      await updateDoc(doc(db, '강사목록', id), { isHidden: !currentHidden });
    } catch (e) {
      console.error(e);
      alert("상태 변경 실패");
    }
  };

  const handleDeleteTeacher = async (id: string, name: string) => {
    if (!confirm(`'${name}' 강사를 삭제하시겠습니까?`)) return;
    try {
      await deleteDoc(doc(db, '강사목록', id));
    } catch (e) {
      console.error(e);
      alert("강사 삭제 실패");
    }
  };

  // --- Creation State ---
  const [isCreating, setIsCreating] = useState(false);

  // --- Role Permissions State (MASTER only) ---
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);
  const [rolePermissionsLoaded, setRolePermissionsLoaded] = useState(false);

  // System Config logic...
  useEffect(() => {
    if (activeTab === 'system' && isMaster) {
      const unsubscribe = onSnapshot(doc(db, 'system', 'config'), (doc) => {
        if (doc.exists()) {
          setLookbackYears(doc.data().eventLookbackYears || 2);
        }
      });
      return () => unsubscribe();
    }
  }, [activeTab, isMaster]);

  // Role Permissions loading (MASTER, ADMIN, MANAGER can view)
  const canViewRolePermissions = isMaster || isAdmin || currentUserProfile?.role === 'manager';
  useEffect(() => {
    if (activeTab === 'role_permissions' && canViewRolePermissions) {
      const unsubscribe = onSnapshot(doc(db, 'settings', 'rolePermissions'), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as RolePermissions;
          // Merge with defaults
          const merged: RolePermissions = {};
          for (const role of ROLE_HIERARCHY.filter(r => r !== 'master') as (keyof RolePermissions)[]) {
            merged[role] = {
              ...DEFAULT_ROLE_PERMISSIONS[role],
              ...(data[role] || {})
            };
          }
          setRolePermissions(merged);
        } else {
          setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
        }
        setRolePermissionsLoaded(true);
      });
      return () => unsubscribe();
    }
  }, [activeTab, isMaster]);

  // --- Teacher List Subscription ---
  useEffect(() => {
    if (activeTab === 'teachers' && isMaster) {
      const unsubscribe = onSnapshot(collection(db, '강사목록'), (snapshot) => {
        const teacherList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Teacher)).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        setTeachers(teacherList);
      });
      return () => unsubscribe();
    }
  }, [activeTab, isMaster]);

  const handleUpdateLookback = async (years: number) => {
    try {
      await setDoc(doc(db, 'system', 'config'), { eventLookbackYears: years }, { merge: true });
      alert("시스템 설정이 저장되었습니다.");
    } catch (e) {
      console.error(e);
      alert("설정 저장 실패");
    }
  };

  if (!isOpen) return null;

  // --- Batch Save Logic ---
  const handleSaveChanges = async () => {
    const batch = writeBatch(db);
    let changesCount = 0;

    // 1. Departments
    const originalDeptMap = new Map(departments.map(d => [d.id, d]));
    localDepartments.forEach(dept => {
      const original = originalDeptMap.get(dept.id);
      if (JSON.stringify(original) !== JSON.stringify(dept)) {
        const ref = doc(db, "부서목록", dept.id);
        batch.update(ref, {
          부서명: dept.name,
          순서: dept.order,
          색상: dept.color,
          기본색상: dept.defaultColor || '#fee2e2',
          기본글자색: dept.defaultTextColor || '#000000',
          기본테두리색: dept.defaultBorderColor || '#fee2e2',
          카테고리: dept.category || '', // Save Category
          설명: ''
        });
        changesCount++;
      }
    });

    // 2. Users
    // Need to handle User Detail Edit merging back into localUsers first? 
    // Actually, localUsers IS the source of truth for the save. 
    // The User Detail Modal should update `localUsers`.
    const originalUserMap = new Map(users.map(u => [u.uid, u]));
    localUsers.forEach(user => {
      const original = originalUserMap.get(user.uid) as UserProfile | undefined;
      // We need to compare carefully including the new permission object
      // For simplicity, strict JSON stringify might be okay if order doesn't matter much or we normalize.
      // Better: check specific fields.

      const hasDiff =
        user.status !== original?.status ||
        user.jobTitle !== original?.jobTitle ||
        user.role !== original?.role ||
        user.canManageMenus !== original?.canManageMenus ||
        user.canManageEventAuthors !== original?.canManageEventAuthors ||
        JSON.stringify(user.departmentPermissions) !== JSON.stringify(original?.departmentPermissions);

      if (hasDiff) {
        const ref = doc(db, 'users', user.uid);
        // Save both legacy and new permissions for compatibility if needed? 
        // Let's rely on new. But maybe update legacy `allowedDepartments` derived from `departmentPermissions` for older clients?
        // Let's update `allowedDepartments` too just in case.
        const derivedAllowed = Object.keys(user.departmentPermissions || {});

        batch.update(ref, {
          status: user.status,
          jobTitle: user.jobTitle || '',
          role: user.role, // Admin role update
          canManageMenus: user.canManageMenus || false,
          canManageEventAuthors: user.canManageEventAuthors || false,
          departmentPermissions: user.departmentPermissions,
          allowedDepartments: derivedAllowed
        });
        changesCount++;
      }
    });

    if (changesCount === 0) {
      setHasChanges(false);
      return;
    }

    try {
      await batch.commit();
      setHasChanges(false);
      alert(`성공적으로 저장되었습니다. (${changesCount}건 수정)`);
    } catch (e) {
      console.error(e);
      alert("저장 중 오류가 발생했습니다.");
    }
  };

  // --- Handlers (Local Update) ---
  const markChanged = () => setHasChanges(true);

  const handleLocalDeptUpdate = (id: string, field: keyof Department, value: any) => {
    setLocalDepartments(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
    markChanged();
  };

  // --- Handlers (Immediate Action) ---
  // Department Create/Delete remains immediate
  const handleAdd = async () => {
    // ... (Existing implementation, kept same for brevity but using localDepartments state for logic where possible)
    // For simplicity of this Plan execution, let's keep the exact same Immediate logic for Add/Delete as before.
    // Copying previous handleAdd logic...
    if (hasChanges) {
      if (!confirm("저장되지 않은 변경사항이 있습니다. 부서를 생성하시겠습니까?")) return;
    }
    if (!newDeptName.trim()) return;
    const newDept: Department = {
      id: newDeptName.trim().replace(/\//g, '_'),
      name: newDeptName.trim(),
      order: departments.length + 1,
      category: newDeptCategory.trim(), // Save Category
      color: '#ffffff',
      defaultColor: newDeptDefaultColor,
      defaultTextColor: newDeptDefaultTextColor,
      defaultBorderColor: newDeptDefaultBorderColor,
    };
    try {
      await setDoc(doc(db, "부서목록", newDept.id), {
        부서명: newDept.name,
        순서: newDept.order,
        색상: newDept.color,
        기본색상: newDept.defaultColor,
        기본글자색: newDept.defaultTextColor,
        기본테두리색: newDept.defaultBorderColor,
        카테고리: newDept.category || '',
        설명: ''
      });
      // Grant to creator...
      const batch = writeBatch(db);
      if (!isMaster && currentUserProfile) {
        const userRef = doc(db, 'users', currentUserProfile.uid);
        // Update both legacy and new
        const currentAllowed = currentUserProfile.allowedDepartments || [];
        const currentPerms = currentUserProfile.departmentPermissions || {};
        batch.update(userRef, {
          allowedDepartments: [...currentAllowed, newDept.id],
          departmentPermissions: { ...currentPerms, [newDept.id]: 'edit' } // Creator gets edit?
        });
      }
      await batch.commit();      // Reset
      setNewDeptName('');
      setNewDeptCategory('');
      setNewDeptDefaultColor('#ffffff');
      setNewDeptDefaultTextColor('#000000');
      setNewDeptDefaultBorderColor('#fee2e2');
      setIsCreating(false);
    } catch (e) { console.error(e); alert("부서 생성 실패"); }
  };

  const handleDelete = async (id: string) => {
    if (confirm('삭제하시겠습니까? (즉시 반영)')) {
      try { await deleteDoc(doc(db, "부서목록", id)); } catch (e) { console.error(e); }
    }
  };

  // --- User Detail Modal Handlers ---
  const handleUserUpdate = (uid: string, updates: Partial<UserProfile>) => {
    setLocalUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...updates } : u));
    markChanged();
  };

  const handleDeptPermissionChange = (uid: string, deptId: string, level: 'none' | 'view' | 'edit') => {
    setLocalUsers(prev => prev.map(u => {
      if (u.uid !== uid) return u;
      const newPerms = { ...(u.departmentPermissions || {}) };
      if (level === 'none') {
        delete newPerms[deptId];
      } else {
        newPerms[deptId] = level;
      }
      return { ...u, departmentPermissions: newPerms };
    }));
    markChanged();
  };

  const handleDeleteUser = async (targetUid: string) => {
    if (!confirm("정말로 이 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    try {
      await deleteDoc(doc(db, "users", targetUid));
      setSelectedUserForEdit(null); // Close modal
      alert("사용자가 삭제되었습니다.");
      // Local state will update via onSnapshot in App.tsx -> props update -> useEffect
    } catch (e) {
      console.error("Failed to delete user:", e);
      alert("사용자 삭제 중 오류가 발생했습니다.");
    }
  };

  // Render User Detail Modal (Nested or Overlay)
  const renderUserDetail = () => {
    if (!selectedUserForEdit) return null;
    const user = localUsers.find(u => u.uid === selectedUserForEdit);
    if (!user) return null;

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="bg-[#f8f9fa] border-b border-gray-200 p-6 pb-4">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border-4 border-white shadow-lg ${user.role === 'master' ? 'bg-[#fdb813] text-[#081429]' : user.role === 'admin' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'} `}>
                  {user.role === 'master' ? <ShieldCheck /> : user.role === 'admin' ? <Shield /> : <Users />}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#081429]">{user.email}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      value={user.jobTitle || ''}
                      onChange={(e) => handleUserUpdate(user.uid, { jobTitle: e.target.value })}
                      placeholder="직급 입력"
                      className="bg-white border border-gray-200 rounded px-2 py-1 text-sm font-medium w-32 focus:border-[#fdb813] outline-none"
                    />
                    {/* Role Dropdown - 7-tier */}
                    {canChangeRole && canAssignRole(currentUserProfile?.role as UserRole, user.role) && (
                      <select
                        value={user.role}
                        onChange={(e) => handleUserUpdate(user.uid, { role: e.target.value as UserRole })}
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
                      onChange={(e) => handleUserUpdate(user.uid, { status: e.target.value as any })}
                      className={`text - xs font - bold px - 2 py - 1 rounded border outline - none ${user.status === 'approved' ? 'text-green-600 bg-green-50 border-green-200' : user.status === 'pending' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' : 'text-red-600 bg-red-50 border-red-200'} ${(!canApproveUser || !canAssignRole(currentUserProfile?.role as UserRole, user.role)) ? 'opacity-50 cursor-not-allowed' : ''} `}
                    >
                      <option value="approved">승인됨</option>
                      <option value="pending">대기중</option>
                      <option value="rejected">차단됨</option>
                    </select>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedUserForEdit(null)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            {/* Global Permissions Checkboxes */}
            {canChangePermissions && canAssignRole(currentUserProfile?.role as UserRole, user.role) && (
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-gray-300">
                  <input type="checkbox" checked={!!user.canManageMenus} onChange={() => handleUserUpdate(user.uid, { canManageMenus: !user.canManageMenus })} className="accent-[#081429]" />
                  <span className="text-xs font-bold text-gray-700">메뉴 관리 (부서 생성/삭제)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-gray-300">
                  <input type="checkbox" checked={!!user.canManageEventAuthors} onChange={() => handleUserUpdate(user.uid, { canManageEventAuthors: !user.canManageEventAuthors })} className="accent-[#081429]" />
                  <span className="text-xs font-bold text-gray-700">작성자 명의 수정</span>
                </label>
              </div>
            )}
          </div>

          {/* Body: Dept Permissions */}
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            <h4 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider flex items-center justify-between">
              부서별 접근 권한
              {canChangePermissions && canAssignRole(currentUserProfile?.role as UserRole, user.role) && (
                <div className="flex gap-2 text-[10px]">
                  <button onClick={() => {
                    const newPerms: any = {};
                    localDepartments.forEach(d => newPerms[d.id] = 'view');
                    handleUserUpdate(user.uid, { departmentPermissions: newPerms });
                  }} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-blue-600 font-bold">전체 조회</button>
                  <button onClick={() => {
                    const newPerms: any = {};
                    localDepartments.forEach(d => newPerms[d.id] = 'edit');
                    handleUserUpdate(user.uid, { departmentPermissions: newPerms });
                  }} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-green-600 font-bold">전체 수정</button>
                  <button onClick={() => {
                    handleUserUpdate(user.uid, { departmentPermissions: {} });
                  }} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-500 font-bold">전체 차단</button>
                  <button onClick={() => {
                    if (initialPermissions) {
                      handleUserUpdate(user.uid, { departmentPermissions: initialPermissions });
                    }
                  }} className="px-2 py-1 bg-red-50 hover:bg-red-100 rounded text-red-500 font-bold">초기화</button>
                </div>
              )}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {localDepartments.map(dept => {
                const current = user.departmentPermissions?.[dept.id]; // undefined, 'view', 'edit'
                return (
                  <div key={dept.id} className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors bg-gray-50/50">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: dept.color }} />
                      <span className="font-bold text-gray-700 text-xs truncate" title={dept.name}>{dept.name}</span>
                    </div>
                    {/* Permission Toggle - Segmented Control */}
                    <div className="flex bg-white rounded-lg p-0.5 border border-gray-200 shrink-0">
                      <button
                        onClick={() => handleDeptPermissionChange(user.uid, dept.id, 'none')}
                        className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${!current ? 'bg-gray-100 text-gray-400 shadow-inner' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'}`}
                      >
                        차단
                      </button>
                      <div className="w-px bg-gray-100 my-1" />
                      <button
                        onClick={() => handleDeptPermissionChange(user.uid, dept.id, 'view')}
                        className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${current === 'view' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                      >
                        조회
                      </button>
                      <div className="w-px bg-gray-100 my-1" />
                      <button
                        onClick={() => handleDeptPermissionChange(user.uid, dept.id, 'edit')}
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

          <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
            {/* Delete Button - Visibility Logic */}
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
                  // Admin can delete User only
                  if (!isTargetMaster && !isTargetAdmin) canDelete = true;
                }

                if (!canDelete) return null;

                return (
                  <button
                    onClick={() => handleDeleteUser(user.uid)}
                    className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                  >
                    <Trash2 size={16} /> 사용자 삭제
                  </button>
                );
              })()}
            </div>

            <button onClick={() => setSelectedUserForEdit(null)} className="px-6 py-2 bg-[#081429] text-white rounded-lg font-bold">확인</button>
          </div>
        </div>
      </div>
    );
  };


  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-0 relative h-[85vh] overflow-hidden border border-gray-200 flex flex-col">

          {/* Header */}
          <div className="bg-[#081429] p-4 flex justify-between items-center text-white shrink-0">
            <div className="flex items-center gap-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FolderKanban size={20} className="text-[#fdb813]" />
                시스템 관리
              </h2>
              <div className="flex bg-white/10 rounded-lg p-1 gap-1">
                {/* Always show Departments if allowed */}
                {canManageMenus && (
                  <button onClick={() => setActiveTab('departments')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'departments' ? 'bg-[#fdb813] text-[#081429]' : 'text-gray-300 hover:text-white'}`}>부서 관리</button>
                )}
                {/* Users Tab available to Master AND Admin */}
                {canManageUsers && (
                  <button onClick={() => setActiveTab('users')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'users' ? 'bg-[#fdb813] text-[#081429]' : 'text-gray-300 hover:text-white'}`}>사용자 관리</button>
                )}

                {/* Teachers Tab - MASTER only */}
                {isMaster && (
                  <button onClick={() => setActiveTab('teachers')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'teachers' ? 'bg-[#fdb813] text-[#081429]' : 'text-gray-300 hover:text-white'}`}>강사 관리</button>
                )}
                {/* System Tab Master OR Admin */}
                {(isMaster || isAdmin) && (
                  <button onClick={() => setActiveTab('system')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'system' ? 'bg-[#fdb813] text-[#081429]' : 'text-gray-300 hover:text-white'}`}>시스템 설정</button>
                )}
                {/* Role Permissions Tab - Visible to MASTER, ADMIN, MANAGER (Read-only for non-MASTER) */}
                {(isMaster || isAdmin || currentUserProfile?.role === 'manager') && (
                  <button onClick={() => setActiveTab('role_permissions')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${activeTab === 'role_permissions' ? 'bg-[#fdb813] text-[#081429]' : 'text-gray-300 hover:text-white'}`}>
                    <Lock size={12} /> 역할 권한
                  </button>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* Content Area */}
          <div className="p-6 overflow-y-auto flex-1 bg-gray-50 pb-20">

            {/* DEPARTMENT TAB */}
            {activeTab === 'departments' && canManageMenus && (
              // ... (Existing Dept Tab Content - Compact Refactor if needed, but keeping primarily User UI focus as requested)
              // Sticking to existing layout for brevity in this response, just wrapping properly.
              <div className="space-y-6 max-w-4xl mx-auto">

                {/* Category Management - Moved from System Tab */}
                {canManageCategories && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                      <h3 className="font-bold flex items-center gap-2 text-gray-800 text-sm">
                        <LayoutGrid size={16} /> 카테고리 관리
                      </h3>
                      <div className="flex gap-2">
                        <input
                          value={newCategoryName}
                          onChange={e => setNewCategoryName(e.target.value)}
                          placeholder="새 카테고리"
                          className="border border-gray-300 rounded-lg px-3 py-1 text-xs focus:border-[#fdb813] outline-none w-32"
                        />
                        <button onClick={handleAddCategory} className="bg-[#081429] text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-[#1e293b] transition-colors"><Plus size={14} /></button>
                      </div>
                    </div>
                    <div className="p-4 flex flex-wrap gap-2">
                      {sysCategories.length === 0 && <span className="text-gray-400 text-xs text-center w-full py-2">등록된 카테고리가 없습니다.</span>}
                      {sysCategories.map(cat => (
                        <div key={cat} className="bg-gray-50 rounded-lg pl-3 pr-1 py-1 text-xs font-bold border border-gray-200 flex items-center gap-2 text-gray-700 group">
                          <span>{cat}</span>
                          <button onClick={() => handleDeleteCategory(cat)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded p-0.5 transition-colors"><X size={12} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center mb-4">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="부서 검색"
                      value={deptSearchTerm}
                      onChange={(e) => setDeptSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-[#fdb813] outline-none"
                    />
                  </div>
                  {!isCreating && canCreateDept && (
                    <button onClick={() => setIsCreating(true)} className="px-4 py-2 bg-[#081429] text-white rounded-lg text-xs font-bold hover:bg-[#1e293b] flex items-center gap-1 transition-colors">
                      <Plus size={14} /> 새 부서 만들기
                    </button>
                  )}
                </div>
                {isCreating && (
                  <div className="bg-white p-4 rounded-xl border border-[#fdb813] space-y-3">
                    <div className="flex gap-2">
                      <input type="text" value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} placeholder="부서명" className="flex-1 border p-2 rounded" />

                      <select
                        value={newDeptCategory}
                        onChange={(e) => setNewDeptCategory(e.target.value)}
                        className="w-32 border p-2 rounded text-xs"
                      >
                        <option value="">카테고리 선택</option>
                        {sysCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                      {/* Custom Category Input removed - enforced selection */}
                    </div>

                    <datalist id="category-options">
                      {Array.from(new Set([...sysCategories, ...localDepartments.map(d => d.category).filter(Boolean)])).sort().map(cat => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>

                    {/* Default Colors for New Dept */}
                    <div className="flex gap-4 text-xs font-bold text-gray-500">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span>기본 배경</span>
                        <input type="color" value={newDeptDefaultColor} onChange={(e) => setNewDeptDefaultColor(e.target.value)} className="w-6 h-6 rounded overflow-hidden" />
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span>기본 글자</span>
                        <input type="color" value={newDeptDefaultTextColor} onChange={(e) => setNewDeptDefaultTextColor(e.target.value)} className="w-6 h-6 rounded overflow-hidden" />
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span>기본 테두리</span>
                        <input type="color" value={newDeptDefaultBorderColor} onChange={(e) => setNewDeptDefaultBorderColor(e.target.value)} className="w-6 h-6 rounded overflow-hidden" />
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => setIsCreating(false)} className="flex-1 bg-gray-100 py-2 rounded">취소</button>
                      <button onClick={handleAdd} className="flex-1 bg-[#081429] text-white py-2 rounded">생성</button>
                    </div>
                  </div>
                )}
                {/* Department Table */}
                <div>
                  {/* Department Table */}
                  <div className="bg-gray-100 rounded-t-xl border-x border-t border-gray-200 grid grid-cols-12 gap-4 p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <div className="col-span-4 pl-2">부서 정보</div>
                    <div className="col-span-2 text-center">카테고리</div>
                    <div className="col-span-4 text-center"> 색상 | 배경 | 글자 | 테두리</div>
                    <div className="col-span-2 text-center">관리</div>
                  </div>

                  <div className="bg-white border-x border-b border-gray-200 text-sm rounded-b-xl divide-y divide-gray-100 shadow-sm border-t-0">
                    {localDepartments
                      .filter(d => d.name.includes(deptSearchTerm))
                      .filter(d => canViewDepartments || currentUserProfile?.departmentPermissions?.[d.id])
                      .map((dept, index) => (
                        <div
                          key={dept.id}
                          draggable={canEditDept}
                          onDragStart={() => canEditDept && setDraggedIndex(index)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (canEditDept && draggedIndex !== null && draggedIndex !== index) {
                              // visual feedback handled by opacity
                            }
                          }}
                          onDrop={() => {
                            if (canEditDept && draggedIndex !== null && draggedIndex !== index) {
                              const newDepts = [...localDepartments];
                              const [removed] = newDepts.splice(draggedIndex, 1);
                              newDepts.splice(index, 0, removed);
                              const reordered = newDepts.map((d, i) => ({ ...d, order: i + 1 }));
                              setLocalDepartments(reordered);
                              markChanged();
                              setDraggedIndex(null);
                            }
                          }}
                          className={`grid grid-cols-12 gap-4 p-3 items-center hover:bg-yellow-50/30 transition-colors group ${draggedIndex === index ? 'opacity-50 bg-gray-50' : ''}`}
                        >
                          {/* Info */}
                          <div className="col-span-4 flex items-center gap-3 pl-2">
                            {canEditDept && <div className="cursor-grab text-gray-300 hover:text-gray-500"><List size={14} /></div>}
                            <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: dept.color }} />
                            <input
                              value={dept.name}
                              readOnly={!canEditDept}
                              onChange={(e) => handleLocalDeptUpdate(dept.id, 'name', e.target.value)}
                              className={`font-bold border-none outline-none w-full bg-transparent ${canEditDept ? 'hover:bg-gray-50 rounded px-1 focus:bg-white focus:ring-1 focus:ring-[#fdb813]' : ''}`}
                            />
                          </div>

                          {/* Category */}
                          <div className="col-span-2 flex justify-center">
                            {canEditDept ? (
                              <select
                                value={dept.category || ''}
                                onChange={(e) => handleLocalDeptUpdate(dept.id, 'category', e.target.value)}
                                className="w-full text-center text-xs border-b border-transparent hover:border-gray-200 focus:border-[#fdb813] outline-none bg-transparent transition-colors appearance-none cursor-pointer py-1"
                              >
                                <option value="">-</option>
                                {sysCategories.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                                {dept.category && !sysCategories.includes(dept.category) && (
                                  <option value={dept.category}>{dept.category} (미등록)</option>
                                )}
                              </select>
                            ) : (
                              <span className="text-xs text-gray-500">{dept.category || '-'}</span>
                            )}
                          </div>

                          {/* Styles */}
                          <div className="col-span-4 flex justify-center gap-4">
                            <input type="color" value={dept.color} onChange={(e) => handleLocalDeptUpdate(dept.id, 'color', e.target.value)} disabled={!canEditDept} className="w-5 h-5 rounded cursor-pointer disabled:opacity-50 border-0 p-0" title="색상" />
                            <input type="color" value={dept.defaultColor || '#fee2e2'} onChange={(e) => handleLocalDeptUpdate(dept.id, 'defaultColor', e.target.value)} disabled={!canEditDept} className="w-5 h-5 rounded cursor-pointer disabled:opacity-50 border-0 p-0" title="배경" />
                            <input type="color" value={dept.defaultTextColor || '#000000'} onChange={(e) => handleLocalDeptUpdate(dept.id, 'defaultTextColor', e.target.value)} disabled={!canEditDept} className="w-5 h-5 rounded cursor-pointer disabled:opacity-50 border-0 p-0" title="글자" />
                            <input type="color" value={dept.defaultBorderColor || '#fee2e2'} onChange={(e) => handleLocalDeptUpdate(dept.id, 'defaultBorderColor', e.target.value)} disabled={!canEditDept} className="w-5 h-5 rounded cursor-pointer disabled:opacity-50 border-0 p-0" title="테두리" />
                          </div>

                          {/* Actions */}
                          <div className="col-span-2 flex justify-center">
                            {canDeleteDept && (
                              <button onClick={() => handleDelete(dept.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* USERS TAB - NEW TABLE DESIGN */}
            {activeTab === 'users' && canManageUsers && (
              <div className="max-w-5xl mx-auto h-full flex flex-col">
                {/* Sub-Tabs for User Management */}
                <div className="flex gap-4 mb-4 border-b border-gray-200">
                  <button
                    onClick={() => setUserTab('approved')}
                    className={`pb-2 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${userTab === 'approved' ? 'border-[#081429] text-[#081429]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                  >
                    정회원 (Members)
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${userTab === 'approved' ? 'bg-[#081429] text-white' : 'bg-gray-100'}`}>
                      {localUsers.filter(u => u.status === 'approved').length}
                    </span>
                  </button>
                  <button
                    onClick={() => setUserTab('pending')}
                    className={`pb-2 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${userTab === 'pending' ? 'border-[#fdb813] text-[#081429]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                  >
                    승인 대기 (Requests)
                    {localUsers.filter(u => u.status === 'pending').length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${userTab === 'pending' ? 'bg-[#fdb813] text-[#081429]' : 'bg-gray-100'}`}>
                      {localUsers.filter(u => u.status === 'pending').length}
                    </span>
                  </button>
                </div>

                <div className="flex justify-between items-center mb-4">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="이름/이메일 검색..."
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-[#fdb813] outline-none"
                    />
                  </div>
                  <div className="text-xs text-gray-500 font-bold">
                    {userTab === 'approved' ? '승인된 사용자' : '승인 대기중인 사용자'}
                  </div>
                </div>

                {/* Table Header */}
                <div className="bg-gray-100 rounded-t-xl border-x border-t border-gray-200 grid grid-cols-12 gap-4 p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <div className="col-span-4 pl-2">사용자 정보</div>
                  <div className="col-span-2 text-center">직급</div>
                  <div className="col-span-2 text-center">권한(Role)</div>
                  <div className="col-span-2 text-center">상태</div>
                  <div className="col-span-2 text-center">관리</div>
                </div>

                {/* Table Body */}
                <div className="bg-white border text-sm flex-1 overflow-y-auto rounded-b-xl">
                  {localUsers
                    .filter(u => {
                      // 1. Text Search
                      const matchesSearch = u.email.includes(userSearchTerm) || u.jobTitle?.includes(userSearchTerm);
                      // 2. Tab Filter
                      const matchesTab = userTab === 'approved'
                        ? u.status === 'approved'
                        : (u.status === 'pending' || u.status === 'rejected'); // Show Pending and Rejected in separate tab
                      return matchesSearch && matchesTab;
                    })
                    .sort((a, b) => (a.role === 'master' ? -1 : 1)) // Master first
                    .map(user => (
                      <div key={user.uid} className={`grid grid-cols-12 gap-4 p-3 border-b border-gray-100 last:border-0 hover:bg-yellow-50/30 items-center transition-colors ${selectedUserForEdit === user.uid ? 'bg-yellow-50' : ''}`}>
                        {/* User Info */}
                        <div className="col-span-4 flex items-center gap-3 pl-2">
                          <div className={`w - 8 h - 8 rounded - full flex items - center justify - center shrink - 0 ${user.role === 'master' ? 'bg-[#fdb813] text-[#081429]' : user.role === 'admin' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'} `}>
                            {user.role === 'master' ? <ShieldCheck size={14} /> : user.role === 'admin' ? <Shield size={14} /> : <Users size={14} />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-[#081429] truncate">{user.email}</div>
                            <div className="text-[10px] text-gray-400 font-mono truncate">{user.uid.slice(0, 6)}...</div>
                          </div>
                        </div>

                        {/* Job Title */}
                        <div className="col-span-2 text-center">
                          <span className="text-gray-600 font-medium">{user.jobTitle || '-'}</span>
                        </div>

                        {/* Role */}
                        <div className="col-span-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${user.role === 'master' ? 'bg-red-100 text-red-700' :
                            user.role === 'admin' ? 'bg-indigo-100 text-indigo-700' :
                              user.role === 'manager' ? 'bg-purple-100 text-purple-700' :
                                user.role === 'editor' ? 'bg-blue-100 text-blue-700' :
                                  user.role === 'user' ? 'bg-gray-100 text-gray-600' :
                                    user.role === 'viewer' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-gray-50 text-gray-400'
                            }`}>
                            {ROLE_LABELS[user.role] || user.role.toUpperCase()}
                          </span>
                        </div>

                        {/* Status */}
                        <div className="col-span-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${user.status === 'approved' ? 'bg-green-100 text-green-700' :
                            user.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                            {user.status === 'approved' ? '승인됨' : user.status === 'pending' ? '대기중' : '차단됨'}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="col-span-2 flex justify-center">
                          <button
                            onClick={() => {
                              // Security Check: Only Master can edit other Admins or Master
                              if (!isMaster && (user.role === 'master' || user.role === 'admin')) {
                                alert("접근 권한이 없습니다. 관리자(Admin) 및 마스터 계정은 마스터만 관리할 수 있습니다.");
                                return;
                              }

                              const u = localUsers.find(lu => lu.uid === user.uid);
                              if (u) {
                                setInitialPermissions(JSON.parse(JSON.stringify(u.departmentPermissions || {})));
                                setSelectedUserForEdit(user.uid);
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-[#081429] hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                          >
                            <UserCog size={16} /> <span className="hidden xl:inline">설정</span>
                          </button>
                          {(isMaster || isAdmin) && (
                            <button
                              onClick={() => setTargetUserForEvents(user)}
                              className="p-2 text-gray-400 hover:text-[#081429] hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                            >
                              <Calendar size={16} /> <span className="hidden xl:inline">일정</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}



            {/* TEACHERS TAB */}
            {activeTab === 'teachers' && isMaster && (
              <div className="max-w-3xl mx-auto h-full flex flex-col pb-20">
                <div className="flex justify-between items-center mb-6">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="강사 검색..."
                      value={teacherSearchTerm}
                      onChange={(e) => setTeacherSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-[#fdb813] outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <div className="flex items-center gap-3 bg-gray-50 px-3 py-1 rounded-md border border-gray-200">
                      <span className="text-xs font-bold text-gray-500">표시할 시간표:</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newTeacherSubjects.includes('math')}
                          onChange={(e) => {
                            if (e.target.checked) setNewTeacherSubjects([...newTeacherSubjects, 'math']);
                            else setNewTeacherSubjects(newTeacherSubjects.filter(s => s !== 'math'));
                          }}
                          className="w-3.5 h-3.5 accent-[#081429]"
                        />
                        <span className="text-xs text-gray-700">수학</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newTeacherSubjects.includes('english')}
                          onChange={(e) => {
                            if (e.target.checked) setNewTeacherSubjects([...newTeacherSubjects, 'english']);
                            else setNewTeacherSubjects(newTeacherSubjects.filter(s => s !== 'english'));
                          }}
                          className="w-3.5 h-3.5 accent-[#081429]"
                        />
                        <span className="text-xs text-gray-700">영어</span>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={newTeacherName}
                        onChange={(e) => setNewTeacherName(e.target.value)}
                        placeholder="새 강사 이름"
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#fdb813] outline-none w-48"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTeacher()}
                      />
                      <button
                        onClick={handleAddTeacher}
                        className="bg-[#081429] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#1e293b] flex items-center gap-1"
                      >
                        <Plus size={16} /> 추가
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 overflow-y-auto">
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {teachers
                      .filter(t => t.name.toLowerCase().includes(teacherSearchTerm.toLowerCase()))
                      .map(teacher => (
                        <div key={teacher.id} className="p-3 border border-gray-100 rounded-lg flex justify-between items-start hover:bg-gray-50 group transition-all">
                          {editingTeacherId === teacher.id ? (
                            <div className="flex flex-col gap-2 w-full">
                              <div className="flex items-center gap-2 w-full">
                                <input
                                  value={editTeacherName}
                                  onChange={(e) => setEditTeacherName(e.target.value)}
                                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:border-[#fdb813] outline-none"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleUpdateTeacher(teacher.id);
                                    if (e.key === 'Escape') setEditingTeacherId(null);
                                  }}
                                />
                                <button onClick={() => handleUpdateTeacher(teacher.id)} className="text-green-600 p-1.5 hover:bg-green-50 rounded bg-white border border-gray-200"><Check size={14} /></button>
                                <button onClick={() => setEditingTeacherId(null)} className="text-red-500 p-1.5 hover:bg-red-50 rounded bg-white border border-gray-200"><X size={14} /></button>
                              </div>
                              <div className="flex items-center gap-3 px-1">
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editTeacherSubjects.includes('math')}
                                    onChange={(e) => {
                                      if (e.target.checked) setEditTeacherSubjects([...editTeacherSubjects, 'math']);
                                      else setEditTeacherSubjects(editTeacherSubjects.filter(s => s !== 'math'));
                                    }}
                                    className="w-3 h-3 accent-[#081429]"
                                  />
                                  <span className="text-[10px] text-gray-600">수학</span>
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editTeacherSubjects.includes('english')}
                                    onChange={(e) => {
                                      if (e.target.checked) setEditTeacherSubjects([...editTeacherSubjects, 'english']);
                                      else setEditTeacherSubjects(editTeacherSubjects.filter(s => s !== 'english'));
                                    }}
                                    className="w-3 h-3 accent-[#081429]"
                                  />
                                  <span className="text-[10px] text-gray-600">영어</span>
                                </label>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-col gap-1">
                                <span className="font-bold text-gray-700">{teacher.name}</span>
                                <div className="flex gap-1">
                                  {(!teacher.subjects || teacher.subjects.includes('math')) && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-medium">수학</span>}
                                  {(!teacher.subjects || teacher.subjects.includes('english')) && <span className="text-[10px] bg-[#fff8e1] text-[#b45309] px-1.5 py-0.5 rounded border border-[#fef3c7] font-medium">영어</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleToggleVisibility(teacher.id, !!teacher.isHidden)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                  title={teacher.isHidden ? "시간표에 표시하기" : "시간표에서 숨기기"}
                                >
                                  {teacher.isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingTeacherId(teacher.id);
                                    setEditTeacherName(teacher.name);
                                    setEditTeacherSubjects(teacher.subjects || ['math', 'english']);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteTeacher(teacher.id, teacher.name)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    {teachers.length === 0 && (
                      <div className="col-span-full py-10 text-center text-gray-400 text-sm">등록된 강사가 없습니다.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SYSTEM TAB */}
            {activeTab === 'system' && (isMaster || isAdmin) && (
              <div className="max-w-2xl mx-auto space-y-8 pb-20">


                {/* 1. Holiday Management (Accordion Style) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2 text-gray-800">
                      <CalendarClock size={16} /> 공휴일 관리
                    </h3>
                    <div className="text-xs text-gray-500">
                      {localHolidays.length}개의 휴일 등록됨
                    </div>
                  </div>

                  {/* Add New Holiday Form */}
                  <div className="p-4 bg-white border-b border-gray-100">
                    <div className="flex gap-2 items-center">
                      <input
                        type="date"
                        value={newHolidayDate}
                        onChange={(e) => setNewHolidayDate(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#fdb813] outline-none"
                      />
                      <input
                        type="text"
                        placeholder="공휴일 이름 (예: 창립기념일)"
                        value={newHolidayName}
                        onChange={(e) => setNewHolidayName(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#fdb813] outline-none"
                      />
                      <button
                        onClick={async () => {
                          if (!newHolidayDate || !newHolidayName) return alert('날짜와 이름을 입력해주세요.');
                          try {
                            await setDoc(doc(db, 'holidays', newHolidayDate), {
                              id: newHolidayDate,
                              date: newHolidayDate,
                              name: newHolidayName,
                              type: 'custom'
                            });
                            setNewHolidayDate('');
                            setNewHolidayName('');
                            // Assuming onSnapshot in App.tsx will update props -> useEffect syncs localHolidays
                          } catch (e) {
                            console.error(e);
                            alert('공휴일 추가 실패');
                          }
                        }}
                        className="bg-[#081429] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#1e293b] flex items-center gap-1"
                      >
                        <Plus size={14} /> 추가
                      </button>
                    </div>
                  </div>

                  {/* Holiday List Grouped by Year */}
                  <div className="max-h-[500px] overflow-y-auto">
                    {Array.from(new Set(localHolidays.map(h => h.date.split('-')[0]))).sort((a, b) => Number(b) - Number(a)).map(year => (
                      <div key={year} className="border-b border-gray-100 last:border-0">
                        <button
                          onClick={() => setExpandedYear(expandedYear === year ? '' : year)}
                          className="w-full flex justify-between items-center p-3 hover:bg-gray-50 transition-colors text-left"
                        >
                          <span className="font-bold text-sm text-gray-700">{year}년</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{localHolidays.filter(h => h.date.startsWith(year)).length}개</span>
                            <ChevronRight size={14} className={`transition-transform text-gray-400 ${expandedYear === year ? 'rotate-90' : ''}`} />
                          </div>
                        </button>

                        {expandedYear === year && (
                          <div className="bg-gray-50/50 p-2 space-y-1">
                            {localHolidays
                              .filter(h => h.date.startsWith(year))
                              .sort((a, b) => a.date.localeCompare(b.date))
                              .map(holiday => (
                                <div key={holiday.id} className="group flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100 text-sm hover:border-[#fdb813]/50 transition-colors">
                                  {editingHolidayId === holiday.id ? (
                                    <div className="flex items-center gap-2 w-full">
                                      <span className="text-gray-500 font-mono text-xs">{holiday.date}</span>
                                      <input
                                        type="text"
                                        value={editHolidayName}
                                        onChange={(e) => setEditHolidayName(e.target.value)}
                                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                                        autoFocus
                                      />
                                      <button
                                        onClick={async () => {
                                          try {
                                            await setDoc(doc(db, 'holidays', holiday.id), { ...holiday, name: editHolidayName }, { merge: true });
                                            setEditingHolidayId(null);
                                          } catch (e) { console.error(e); alert('수정 실패'); }
                                        }}
                                        className="text-green-600 p-1 hover:bg-green-50 rounded"
                                      >
                                        <Check size={14} />
                                      </button>
                                      <button onClick={() => setEditingHolidayId(null)} className="text-gray-400 p-1 hover:bg-gray-100 rounded">
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-3">
                                        <div className={`w-1.5 h-1.5 rounded-full ${holiday.type === 'public' ? 'bg-red-500' : 'bg-blue-500'}`} />
                                        <span className="font-mono text-gray-500 text-xs">{holiday.date}</span>
                                        <span className={`font-medium ${holiday.type === 'public' ? 'text-red-700' : 'text-gray-700'}`}>
                                          {holiday.name}
                                        </span>
                                      </div>
                                      <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                        <button
                                          onClick={() => {
                                            setEditingHolidayId(holiday.id);
                                            setEditHolidayName(holiday.name);
                                          }}
                                          className="p-1.5 text-gray-400 hover:text-[#081429] hover:bg-gray-100 rounded-md"
                                        >
                                          <Edit size={12} />
                                        </button>
                                        <button
                                          onClick={async () => {
                                            if (confirm(`'${holiday.name}' 삭제하시겠습니까?`)) {
                                              try {
                                                await deleteDoc(doc(db, 'holidays', holiday.id));
                                              } catch (e) { console.error(e); alert('삭제 실패'); }
                                            }
                                          }}
                                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {localHolidays.length === 0 && (
                      <div className="p-8 text-center text-gray-400 text-xs">
                        등록된 공휴일이 없습니다.
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. System Config (Data Retention) */}
                {isMaster && (
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="font-bold mb-4 flex gap-2"><Database size={18} /> 데이터 보존 기간 설정</h3>
                    <div className="flex gap-2 items-center">
                      <span className="text-sm text-gray-600">지난 데이터 보존:</span>
                      <input type="number" value={lookbackYears} onChange={(e) => setLookbackYears(Number(e.target.value))} className="border p-2 rounded w-20 text-center" />
                      <span className="text-sm text-gray-600">년</span>
                      <button onClick={() => handleUpdateLookback(lookbackYears)} className="ml-auto bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200">저장</button>
                    </div>
                  </div>
                )}

                {/* 3. Reset Holidays */}
                {isMaster && (
                  <div className="bg-red-50 p-6 rounded-xl shadow-sm border border-red-100">
                    <h3 className="font-bold mb-4 flex gap-2 text-red-900"><CalendarClock size={18} /> 시스템 초기화 (공휴일)</h3>
                    <p className="text-xs text-red-700 mb-4 break-keep">
                      대한민국 기본 공휴일(2024~2030) 데이터를 데이터베이스에 일괄 등록합니다.
                      이미 등록된 날짜는 건너뛰거나 업데이트되며, 기존 사용자 데이터는 삭제되지 않습니다.
                    </p>
                    <button
                      onClick={async () => {
                        if (confirm('기본 대한민국 공휴일(2024~2030)을 DB에 즉시 등록하시겠습니까?')) {
                          try {
                            const batch = writeBatch(db);
                            let count = 0;
                            for (const h of STANDARD_HOLIDAYS) {
                              const ref = doc(db, 'holidays', h.date);
                              batch.set(ref, {
                                id: h.date,
                                date: h.date,
                                name: h.name,
                                type: 'public'
                              }, { merge: true });
                              count++;
                            }
                            await batch.commit();
                            alert(`${count}개의 공휴일 데이터가 등록되었습니다.`);
                          } catch (e) {
                            console.error(e);
                            alert('오류가 발생했습니다.');
                          }
                        }
                      }}
                      className="w-full py-3 bg-white text-red-600 rounded-xl font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2 border border-red-200 shadow-sm"
                    >
                      🇰🇷 기본 공휴일 데이터 가져오기
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ROLE PERMISSIONS TAB - Viewable by MASTER, ADMIN, MANAGER */}
            {activeTab === 'role_permissions' && canViewRolePermissions && (
              <div className="max-w-6xl mx-auto">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-[#081429] to-[#1e3a5f] p-6 text-white">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Lock size={20} /> 역할별 권한 설정
                      {!isMaster && <span className="text-xs bg-yellow-500 text-[#081429] px-2 py-0.5 rounded font-bold ml-2">읽기 전용</span>}
                    </h3>
                    <p className="text-sm text-gray-300 mt-1">
                      {isMaster
                        ? '각 역할이 수행할 수 있는 기능을 세부적으로 설정합니다. MASTER는 항상 모든 권한을 가집니다.'
                        : '현재 설정된 역할별 권한을 확인할 수 있습니다. 수정은 MASTER만 가능합니다.'}
                    </p>
                  </div>

                  {!rolePermissionsLoaded ? (
                    <div className="p-8 text-center text-gray-500">권한 정보를 불러오는 중...</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left px-4 py-3 font-bold text-gray-700 sticky left-0 bg-gray-50 min-w-[200px]">권한</th>
                            {ROLE_HIERARCHY.filter(r => r !== 'master').map(role => (
                              <th key={role} className="text-center px-3 py-3 font-bold text-gray-700 min-w-[80px]">
                                <span className={`px-2 py-1 rounded text-[10px] font-black ${role === 'admin' ? 'bg-indigo-100 text-indigo-700' :
                                  role === 'manager' ? 'bg-purple-100 text-purple-700' :
                                    role === 'editor' ? 'bg-blue-100 text-blue-700' :
                                      role === 'user' ? 'bg-gray-100 text-gray-600' :
                                        role === 'viewer' ? 'bg-yellow-100 text-yellow-700' :
                                          'bg-gray-100 text-gray-400'
                                  }`}>
                                  {ROLE_LABELS[role]}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {/* 일정 관리 섹션 */}
                          <tr className="bg-blue-50/50">
                            <td colSpan={7} className="px-4 py-2 font-bold text-blue-700 text-xs uppercase tracking-wider">📅 일정 관리</td>
                          </tr>
                          {[
                            { id: 'events.create' as PermissionId, label: '일정 생성' },
                            { id: 'events.edit_own' as PermissionId, label: '본인 일정 수정' },
                            { id: 'events.edit_others' as PermissionId, label: '타인 일정 수정' },
                            { id: 'events.delete_own' as PermissionId, label: '본인 일정 삭제' },
                            { id: 'events.delete_others' as PermissionId, label: '타인 일정 삭제' },
                            { id: 'events.drag_move' as PermissionId, label: '일정 드래그 이동' },
                            { id: 'events.attendance' as PermissionId, label: '참가 현황 변경' },
                          ].map(perm => (
                            <tr key={perm.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                              <td className="px-4 py-2.5 text-gray-700 sticky left-0 bg-white">{perm.label}</td>
                              {ROLE_HIERARCHY.filter(r => r !== 'master').map(role => (
                                <td key={role} className="text-center px-3 py-2.5">
                                  <input
                                    type="checkbox"
                                    checked={rolePermissions[role as keyof RolePermissions]?.[perm.id] ?? false}
                                    disabled={!isMaster}
                                    onChange={(e) => {
                                      if (!isMaster) return;
                                      setRolePermissions(prev => ({
                                        ...prev,
                                        [role]: {
                                          ...prev[role as keyof RolePermissions],
                                          [perm.id]: e.target.checked
                                        }
                                      }));
                                    }}
                                    className={`w-4 h-4 accent-[#081429] ${!isMaster ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}

                          {/* 부서 관리 섹션 */}
                          <tr className="bg-indigo-50/50">
                            <td colSpan={7} className="px-4 py-2 font-bold text-indigo-700 text-xs uppercase tracking-wider">🏢 부서(메뉴) 관리</td>
                          </tr>
                          {[
                            { id: 'departments.view_all' as PermissionId, label: '모든 부서 조회' },
                            { id: 'departments.create' as PermissionId, label: '부서 생성' },
                            { id: 'departments.edit' as PermissionId, label: '부서 수정' },
                            { id: 'departments.delete' as PermissionId, label: '부서 삭제' },
                            { id: 'settings.manage_categories' as PermissionId, label: '카테고리 관리' },
                          ].map(perm => (
                            <tr key={perm.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                              <td className="px-4 py-2.5 text-gray-700 sticky left-0 bg-white">{perm.label}</td>
                              {ROLE_HIERARCHY.filter(r => r !== 'master').map(role => (
                                <td key={role} className="text-center px-3 py-2.5">
                                  <input
                                    type="checkbox"
                                    checked={rolePermissions[role as keyof RolePermissions]?.[perm.id] ?? false}
                                    disabled={!isMaster}
                                    onChange={(e) => {
                                      if (!isMaster) return;
                                      setRolePermissions(prev => ({
                                        ...prev,
                                        [role]: {
                                          ...prev[role as keyof RolePermissions],
                                          [perm.id]: e.target.checked
                                        }
                                      }));
                                    }}
                                    className={`w-4 h-4 accent-[#081429] ${!isMaster ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}

                          {/* 사용자 관리 섹션 */}
                          <tr className="bg-purple-50/50">
                            <td colSpan={7} className="px-4 py-2 font-bold text-purple-700 text-xs uppercase tracking-wider">👥 사용자 관리</td>
                          </tr>
                          {[
                            { id: 'users.view' as PermissionId, label: '사용자 목록 조회' },
                            { id: 'users.approve' as PermissionId, label: '가입 승인/거부' },
                            { id: 'users.change_role' as PermissionId, label: '역할 변경' },
                            { id: 'users.change_permissions' as PermissionId, label: '개별 권한 변경' },
                          ].map(perm => (
                            <tr key={perm.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                              <td className="px-4 py-2.5 text-gray-700 sticky left-0 bg-white">{perm.label}</td>
                              {ROLE_HIERARCHY.filter(r => r !== 'master').map(role => (
                                <td key={role} className="text-center px-3 py-2.5">
                                  <input
                                    type="checkbox"
                                    checked={rolePermissions[role as keyof RolePermissions]?.[perm.id] ?? false}
                                    disabled={!isMaster}
                                    onChange={(e) => {
                                      if (!isMaster) return;
                                      setRolePermissions(prev => ({
                                        ...prev,
                                        [role]: {
                                          ...prev[role as keyof RolePermissions],
                                          [perm.id]: e.target.checked
                                        }
                                      }));
                                    }}
                                    className={`w-4 h-4 accent-[#081429] ${!isMaster ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}

                          {/* 시스템 설정 섹션 */}
                          <tr className="bg-orange-50/50">
                            <td colSpan={7} className="px-4 py-2 font-bold text-orange-700 text-xs uppercase tracking-wider">⚙️ 시스템 설정</td>
                          </tr>
                          {[
                            { id: 'settings.access' as PermissionId, label: '설정 메뉴 접근' },
                            { id: 'settings.holidays' as PermissionId, label: '공휴일 관리' },
                            { id: 'settings.role_permissions' as PermissionId, label: '역할별 권한 설정', disabled: true },
                          ].map(perm => (
                            <tr key={perm.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                              <td className="px-4 py-2.5 text-gray-700 sticky left-0 bg-white">
                                {perm.label}
                                {perm.disabled && <span className="text-[10px] text-gray-400 ml-2">(MASTER 전용)</span>}
                              </td>
                              {ROLE_HIERARCHY.filter(r => r !== 'master').map(role => (
                                <td key={role} className="text-center px-3 py-2.5">
                                  <input
                                    type="checkbox"
                                    checked={perm.disabled ? false : (rolePermissions[role as keyof RolePermissions]?.[perm.id] ?? false)}
                                    disabled={!isMaster || perm.disabled}
                                    onChange={(e) => {
                                      if (isMaster && !perm.disabled) {
                                        setRolePermissions(prev => ({
                                          ...prev,
                                          [role]: {
                                            ...prev[role as keyof RolePermissions],
                                            [perm.id]: e.target.checked
                                          }
                                        }));
                                      }
                                    }}
                                    className={`w-4 h-4 accent-[#081429] ${(!isMaster || perm.disabled) ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Actions */}
                  {/* Actions (MASTER only) */}
                  {isMaster && (
                    <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                      <button
                        onClick={() => {
                          if (confirm('모든 권한을 기본값으로 초기화하시겠습니까?')) {
                            setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
                          }
                        }}
                        className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 flex items-center gap-2"
                      >
                        <RotateCcw size={14} /> 기본값으로 초기화
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await setDoc(doc(db, 'settings', 'rolePermissions'), rolePermissions);
                            alert('역할별 권한이 저장되었습니다.');
                          } catch (e) {
                            console.error(e);
                            alert('저장 중 오류가 발생했습니다.');
                          }
                        }}
                        className="px-6 py-2 bg-[#081429] text-white rounded-lg text-sm font-bold hover:bg-[#0a1a35] flex items-center gap-2"
                      >
                        <Save size={14} /> 저장
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer (Save Button) */}
          {(activeTab === 'departments' || activeTab === 'users') && (
            <div className="absolute bottom-0 left-0 w-full p-4 bg-white/95 border-t border-gray-200 backdrop-blur-sm flex justify-between items-center z-10">
              <div className="text-xs text-gray-500 font-medium">
                {hasChanges ? <span className="text-amber-600 flex items-center gap-1"><ShieldAlert size={14} /> 저장되지 않은 변경사항이 있습니다.</span> : <span>모든 변경사항이 저장되었습니다.</span>}
              </div>
              <button
                onClick={handleSaveChanges}
                disabled={!hasChanges}
                className={`px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all
                  ${hasChanges
                    ? 'bg-[#081429] text-white hover:brightness-110 active:scale-95'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                  }
                `}
              >
                <Save size={18} /> 변경사항 저장
              </button>
            </div>
          )}
        </div>

        {/* Render Nested User Detail Modal */}
        {renderUserDetail()}

        {/* Render MyEventsModal for selected user */}
        <MyEventsModal
          isOpen={!!targetUserForEvents}
          onClose={() => setTargetUserForEvents(null)}
          events={events}
          currentUser={targetUserForEvents} // Pass selected user as 'current' context
          onEventClick={() => { }} // Read-only view mainly, or let them click? Maybe just close modal?
          // Actually, if we want them to edit, we need to handle onEventClick properly.
          // But for now, let's keep it simple. If they click, it does nothing or closes.
          // User asked for "View", so maybe just viewing the list is enough.
          // Let's allow closing only for now unless we want to trigger the main EventModal which is outside SettingsModal.
          // Stacked modals? Yes.
          // But let's pass an empty function for now to prevent errors, effectively making it "List View Only".
          // Or better, let's allow it to be truly read-only list.
          readOnly={true}
          customTitle={`${targetUserForEvents?.email.split('@')[0]}님의 일정`}
        />
      </div>
    </>
  );
};

export default SettingsModal;

