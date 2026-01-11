import React, { useState, useEffect } from 'react';
import { Department, UserProfile, CalendarEvent, ROLE_LABELS, ROLE_HIERARCHY, PermissionId, RolePermissions, DEFAULT_ROLE_PERMISSIONS, Teacher, ClassKeywordColor } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { X, FolderKanban, Users, Shield, ShieldAlert, ShieldCheck, Database, Search, Save, UserCog, CalendarClock, Calendar, Archive } from 'lucide-react';
import { STANDARD_HOLIDAYS } from '../../constants_holidays';
import { db, auth } from '../../firebaseConfig';
import { setDoc, doc, deleteDoc, writeBatch, collection, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';

import { Holiday } from '../../types';
import MyEventsModal from '../Calendar/MyEventsModal';
import { TeachersTab, ClassesTab, HolidaysTab, RolePermissionsTab, TabAccessTab, DepartmentsTab, GanttCategoriesTab, MigrationTab } from './';
import HashtagsTab from './HashtagsTab';
import { useTabPermissions } from '../../hooks/useTabPermissions';
import SalarySettingsTab from '../Attendance/components/SalarySettingsTab';
import { useAttendanceConfig, useSaveAttendanceConfig } from '../../hooks/useAttendance';
import UserDetailModal from './modals/UserDetailModal';
import DepartmentsManagementTab from './tabs/DepartmentsManagementTab';
import UsersTab from './tabs/UsersTab';
import { NewDepartmentForm, CategoryManagementState, DepartmentFilterState, INITIAL_DEPARTMENT_FORM } from '../../types/departmentForm';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  currentUserProfile?: UserProfile | null;
  users: UserProfile[];
  holidays: Holiday[];
  events: CalendarEvent[];
  sysCategories: string[];
  teachers: Teacher[];  // Centralized from App.tsx
  showArchived?: boolean;
  onToggleArchived?: () => void;
}

type MainTabMode = 'calendar' | 'timetable' | 'permissions' | 'gantt' | 'attendance';
type TabMode = 'departments' | 'users' | 'teachers' | 'classes' | 'system' | 'calendar_manage' | 'role_permissions' | 'tab_access' | 'migration' | 'gantt_departments' | 'gantt_categories' | 'salary_settings' | 'calendar_hashtags';

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  departments,
  currentUserProfile,
  users,
  holidays,
  events,
  sysCategories = [],
  teachers = [],
  showArchived,
  onToggleArchived,
}) => {
  const { hasPermission } = usePermissions(currentUserProfile || null);

  const canViewDepartments = hasPermission('departments.view_all');
  const canViewUsers = hasPermission('users.view');

  // Consolidated: departments.manage covers create/edit/delete
  const canManageDept = hasPermission('departments.manage');
  const canCreateDept = canManageDept;
  const canEditDept = canManageDept;
  const canDeleteDept = canManageDept;
  const canManageCategories = hasPermission('settings.manage_categories');

  const canApproveUser = hasPermission('users.approve');
  const canChangeRole = hasPermission('users.change_role');
  const canChangePermissions = hasPermission('users.change_permissions');

  const isMaster = currentUserProfile?.role === 'master';
  const isAdmin = currentUserProfile?.role === 'admin';
  // Legacy helpers mapped to permissions
  const canManageMenus = canViewDepartments;
  const canManageUsers = canViewUsers;
  const canViewTeachers = hasPermission('system.teachers.view');
  const canViewClasses = hasPermission('system.classes.view');
  const canManageRolePermissions = hasPermission('settings.role_permissions');

  // Get accessible tabs for current user
  const { accessibleTabs } = useTabPermissions(currentUserProfile || null);

  const [mainTab, setMainTab] = useState<MainTabMode>('permissions');
  const [activeTab, setActiveTab] = useState<TabMode>('system');

  // Grouped department form state
  const [newDepartmentForm, setNewDepartmentForm] = useState<NewDepartmentForm>(INITIAL_DEPARTMENT_FORM);

  // Category management state
  const [categoryManagement, setCategoryManagement] = useState<CategoryManagementState>({
    newCategoryName: '',
  });

  // Department filter state
  const [departmentFilterState, setDepartmentFilterState] = useState<DepartmentFilterState>({
    searchTerm: '',
    isCreating: false,
    draggedIndex: null,
  });



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

  // --- Teacher Management State (teachers는 props로 받음) ---
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherSubjects, setNewTeacherSubjects] = useState<string[]>([]); // 기본 체크 해제
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [editTeacherName, setEditTeacherName] = useState('');
  const [editTeacherSubjects, setEditTeacherSubjects] = useState<string[]>([]);
  const [editTeacherBgColor, setEditTeacherBgColor] = useState('#3b82f6'); // 기본 파란색
  const [editTeacherTextColor, setEditTeacherTextColor] = useState('#ffffff'); // 기본 흰색
  const [editTeacherDefaultRoom, setEditTeacherDefaultRoom] = useState(''); // 고정 강의실
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
  const [teacherSubjectFilter, setTeacherSubjectFilter] = useState<'all' | 'math' | 'english'>('all'); // 과목 필터
  const [draggedTeacherId, setDraggedTeacherId] = useState<string | null>(null); // 드래그 대상
  const [selectedTeacherForRoom, setSelectedTeacherForRoom] = useState<string>(''); // 강의실 설정용 강사 선택
  const [teacherDefaultRoom, setTeacherDefaultRoom] = useState<string>(''); // 강의실 입력값

  // --- Class Keyword Color State ---
  const [classKeywords, setClassKeywords] = useState<ClassKeywordColor[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newKeywordBgColor, setNewKeywordBgColor] = useState('#fee2e2');
  const [newKeywordTextColor, setNewKeywordTextColor] = useState('#dc2626');

  const handleAddCategory = async () => {
    if (!categoryManagement.newCategoryName.trim()) return alert('카테고리 이름을 입력해주세요.');
    const trimmed = categoryManagement.newCategoryName.trim();
    if (sysCategories.includes(trimmed)) return alert('이미 존재하는 카테고리입니다.');

    try {
      const newCats = [...sysCategories, trimmed].sort();
      await setDoc(doc(db, 'system', 'config'), { categories: newCats }, { merge: true });
      setCategoryManagement({ newCategoryName: '' });
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
    const name = newTeacherName.trim();
    try {
      const docRef = doc(db, '강사목록', name);
      // Check for duplicates
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return alert("이미 존재하는 강사 이름입니다.");
      }

      await setDoc(docRef, { name: name, subjects: newTeacherSubjects, isHidden: false });
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
      await updateDoc(doc(db, '강사목록', id), {
        name: editTeacherName.trim(),
        subjects: editTeacherSubjects,
        bgColor: editTeacherBgColor,
        textColor: editTeacherTextColor,
        defaultRoom: editTeacherDefaultRoom.trim()
      });
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

  // --- Teacher Drag and Drop Handlers ---
  const handleTeacherDragStart = (e: React.DragEvent, teacherId: string) => {
    setDraggedTeacherId(teacherId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTeacherDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleTeacherDrop = async (e: React.DragEvent, targetTeacherId: string) => {
    e.preventDefault();
    if (!draggedTeacherId || draggedTeacherId === targetTeacherId) {
      setDraggedTeacherId(null);
      return;
    }

    const sortedTeachers = [...teachers].sort((a, b) => (a.order || 0) - (b.order || 0));
    const draggedIndex = sortedTeachers.findIndex(t => t.id === draggedTeacherId);
    const targetIndex = sortedTeachers.findIndex(t => t.id === targetTeacherId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedTeacherId(null);
      return;
    }

    // Reorder list
    const newOrder = [...sortedTeachers];
    const [draggedItem] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);

    // Update order values in Firebase
    try {
      const batch = writeBatch(db);
      newOrder.forEach((teacher, index) => {
        batch.update(doc(db, '강사목록', teacher.id), { order: index });
      });
      await batch.commit();
    } catch (e) {
      console.error('순서 저장 실패:', e);
      alert('순서 저장 실패');
    }

    setDraggedTeacherId(null);
  };

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

  // Class Keywords subscription
  const canEditClassKeywords = hasPermission('system.classes.edit');
  const canViewClassKeywords = hasPermission('system.classes.view') || canEditClassKeywords;

  useEffect(() => {
    if (activeTab === 'classes' && canViewClassKeywords) {
      const unsubscribe = onSnapshot(collection(db, 'classKeywords'), (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ClassKeywordColor));
        setClassKeywords(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
      });
      return () => unsubscribe();
    }
  }, [activeTab, canViewClassKeywords]);

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

  // NOTE: Teacher list is now passed as props from App.tsx (centralized subscription)

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
        user.teacherId !== original?.teacherId ||  // NEW: Teacher Linking
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
          teacherId: user.teacherId || null, // NEW: Teacher Linking
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
    if (hasChanges) {
      if (!confirm("저장되지 않은 변경사항이 있습니다. 부서를 생성하시겠습니까?")) return;
    }
    if (!newDepartmentForm.name.trim()) return;
    const newDept: Department = {
      id: newDepartmentForm.name.trim().replace(/\//g, '_'),
      name: newDepartmentForm.name.trim(),
      order: departments.length + 1,
      category: newDepartmentForm.category.trim(),
      color: '#ffffff',
      defaultColor: newDepartmentForm.defaultColor,
      defaultTextColor: newDepartmentForm.defaultTextColor,
      defaultBorderColor: newDepartmentForm.defaultBorderColor,
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

      // Apply default permission to all users
      const batch = writeBatch(db);

      // Get all users and apply default permission
      for (const user of users) {
        const userRef = doc(db, 'users', user.uid);
        const currentPerms = user.departmentPermissions || {};
        const currentAllowed = user.allowedDepartments || [];

        // Master always gets edit permission
        const permissionToApply = user.role === 'master' ? 'edit' : newDepartmentForm.defaultPermission;

        // Skip none permission (don't add to departmentPermissions, and don't add to allowedDepartments)
        // @ts-ignore - 'block' is legacy value for backwards compatibility
        if (permissionToApply === 'none' || permissionToApply === 'block') {
          // Block: remove from allowedDepartments if exists, don't add to permissions
          batch.update(userRef, {
            allowedDepartments: currentAllowed.filter((id: string) => id !== newDept.id),
            departmentPermissions: { ...currentPerms } // No change for block (or explicitly no access)
          });
        } else {
          // View or Edit: add to permissions
          batch.update(userRef, {
            allowedDepartments: currentAllowed.includes(newDept.id) ? currentAllowed : [...currentAllowed, newDept.id],
            departmentPermissions: { ...currentPerms, [newDept.id]: permissionToApply }
          });
        }
      }

      await batch.commit();

      // Reset form
      setNewDepartmentForm(INITIAL_DEPARTMENT_FORM);
      setDepartmentFilterState({ ...departmentFilterState, isCreating: false });
    } catch (e) { console.error(e); alert("부서 생성 실패"); }
  };

  /* Department Delete Handler - Modified to update local state immediately */
  const handleDelete = async (id: string) => {
    if (confirm('삭제하시겠습니까? (즉시 반영)')) {
      try {
        await deleteDoc(doc(db, "부서목록", id));
        // Remove from local state immediately to prevents 'Save Changes' from trying to update a deleted doc
        setLocalDepartments(prev => prev.filter(d => d.id !== id));
      } catch (e) { console.error(e); }
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
  // UserDetailModal is now extracted to a separate component


  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100]"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-0 relative h-[85vh] overflow-hidden border border-gray-200 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >

          {/* Header */}
          <div className="bg-[#081429] p-4 flex justify-between items-center text-white shrink-0">
            <div className="flex items-center gap-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FolderKanban size={20} className="text-[#fdb813]" />
                시스템 관리
              </h2>
              <div className="flex flex-col gap-2">
                {/* Main Tab Selector */}
                <div className="flex bg-white/10 rounded-lg p-1 gap-1">
                  {canManageMenus && (
                    <button
                      onClick={() => { setMainTab('calendar'); setActiveTab('departments'); }}
                      className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${mainTab === 'calendar' ? 'bg-[#fdb813] text-[#081429]' : 'text-gray-300 hover:text-white'}`}
                    >
                      📅 연간 일정
                    </button>
                  )}
                  {(isMaster || canViewTeachers || canViewClassKeywords) && (
                    <button
                      onClick={() => { setMainTab('timetable'); setActiveTab('teachers'); }}
                      className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${mainTab === 'timetable' ? 'bg-[#fdb813] text-[#081429]' : 'text-gray-300 hover:text-white'}`}
                    >
                      🕐 시간표
                    </button>
                  )}
                  {(isMaster || hasPermission('gantt.view')) && (
                    <button
                      onClick={() => { setMainTab('gantt'); setActiveTab('gantt_departments'); }}
                      className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${mainTab === 'gantt' ? 'bg-[#fdb813] text-[#081429]' : 'text-gray-300 hover:text-white'}`}
                    >
                      📊 간트 차트
                    </button>
                  )}
                  {(isMaster || isAdmin) && (
                    <button
                      onClick={() => { setMainTab('attendance'); setActiveTab('salary_settings'); }}
                      className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${mainTab === 'attendance' ? 'bg-[#fdb813] text-[#081429]' : 'text-gray-300 hover:text-white'}`}
                    >
                      📝 출석부
                    </button>
                  )}
                  {/* 시스템 설정 is always visible for all users */}
                  <button
                    onClick={() => { setMainTab('permissions'); setActiveTab('system'); }}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${mainTab === 'permissions' ? 'bg-[#fdb813] text-[#081429]' : 'text-gray-300 hover:text-white'}`}
                  >
                    ⚙️ 시스템 설정
                  </button>
                </div>
                {/* Sub Tab Selector */}
                <div className="flex gap-1 pl-2">
                  {mainTab === 'calendar' && (
                    <>
                      {canManageMenus && (
                        <button onClick={() => setActiveTab('departments')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'departments' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                          부서 관리
                        </button>
                      )}
                      {(isMaster || isAdmin) && (
                        <button onClick={() => setActiveTab('calendar_hashtags')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'calendar_hashtags' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                          # 해시태그
                        </button>
                      )}
                    </>
                  )}
                  {mainTab === 'timetable' && (
                    <>
                      {(isMaster || canViewTeachers) && (
                        <button onClick={() => setActiveTab('teachers')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'teachers' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                          강사 관리
                        </button>
                      )}
                      {(isMaster || canViewClasses) && (
                        <button onClick={() => setActiveTab('classes')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'classes' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                          수업 관리
                        </button>
                      )}
                    </>
                  )}
                  {mainTab === 'permissions' && (
                    <>
                      {(isMaster || canManageRolePermissions) && (
                        <button onClick={() => setActiveTab('role_permissions')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'role_permissions' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                          역할 권한
                        </button>
                      )}

                      {isMaster && (
                        <button onClick={() => setActiveTab('tab_access')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'tab_access' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                          탭 관리
                        </button>
                      )}

                      {isMaster && (
                        <button onClick={() => setActiveTab('migration')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'migration' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                          데이터 마이그레이션
                        </button>
                      )}

                      {canManageUsers && (
                        <button onClick={() => setActiveTab('users')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'users' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                          사용자 관리
                        </button>
                      )}
                      {/* 기타 설정 is always visible */}
                      <button onClick={() => setActiveTab('system')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'system' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                        기타 설정
                      </button>
                    </>
                  )}
                  {mainTab === 'gantt' && (
                    <>
                      {(isMaster || hasPermission('gantt.view')) && (
                        <button onClick={() => setActiveTab('gantt_departments')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'gantt_departments' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                          부서 관리
                        </button>
                      )}
                      {(isMaster || hasPermission('settings.manage_categories')) && (
                        <button onClick={() => setActiveTab('gantt_categories')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'gantt_categories' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                          카테고리 관리
                        </button>
                      )}
                    </>
                  )}
                  {mainTab === 'attendance' && (
                    <>
                      <button onClick={() => setActiveTab('salary_settings')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'salary_settings' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                        급여 설정
                      </button>
                    </>
                  )}
                </div>
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
              <DepartmentsManagementTab
                localDepartments={localDepartments}
                sysCategories={sysCategories}
                currentUserProfile={currentUserProfile}
                newDepartmentForm={newDepartmentForm}
                categoryManagement={categoryManagement}
                departmentFilterState={departmentFilterState}
                canManageCategories={canManageCategories}
                canCreateDept={canCreateDept}
                canEditDept={canEditDept}
                canDeleteDept={canDeleteDept}
                isMaster={isMaster}
                isAdmin={isAdmin}
                setNewDepartmentForm={setNewDepartmentForm}
                setCategoryManagement={setCategoryManagement}
                setDepartmentFilterState={setDepartmentFilterState}
                setLocalDepartments={setLocalDepartments}
                handleAddCategory={handleAddCategory}
                handleDeleteCategory={handleDeleteCategory}
                handleAdd={handleAdd}
                handleDelete={handleDelete}
                handleLocalDeptUpdate={handleLocalDeptUpdate}
                markChanged={markChanged}
              />
            )}

            {/* USERS TAB - NEW CONFIGURATION */}
            {activeTab === 'users' && canManageUsers && (
              <UsersTab
                localUsers={localUsers}
                currentUserProfile={currentUserProfile}
                isMaster={isMaster}
                isAdmin={isAdmin}
                canManageUsers={canManageUsers}
                setSelectedUserForEdit={setSelectedUserForEdit}
                setTargetUserForEvents={setTargetUserForEvents}
                setInitialPermissions={setInitialPermissions}
              />
            )}



            {/* TEACHERS TAB */}
            {activeTab === 'teachers' && (isMaster || canViewTeachers) && (
              <TeachersTab
                teachers={teachers}
                isMaster={isMaster}
                canEdit={isMaster || hasPermission('system.teachers.edit')}
                canViewMath={isMaster || hasPermission('timetable.math.view')}
                canViewEnglish={isMaster || hasPermission('timetable.english.view')}
              />
            )}

            {/* CLASSES MANAGEMENT TAB - 수업 키워드 색상 관리 */}
            {activeTab === 'classes' && (isMaster || canViewClasses) && (
              <ClassesTab isMaster={isMaster} canEdit={isMaster || hasPermission('system.classes.edit')} />
            )}

            {/* TAB ACCESS TAB */}
            {activeTab === 'tab_access' && (
              <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#f8f9fa] p-4 md:p-8">
                <TabAccessTab
                  isMaster={isMaster}
                  isAdmin={isAdmin}
                  currentUserRole={currentUserProfile?.role}
                />
              </div>
            )}

            {/* MIGRATION TAB */}
            {activeTab === 'migration' && isMaster && (
              <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#f8f9fa] p-4 md:p-8">
                <MigrationTab />
              </div>
            )}

            {activeTab === 'system' && (isMaster || isAdmin || currentUserProfile?.role === 'manager' || hasPermission('settings.access')) && (
              <div className="max-w-2xl mx-auto space-y-8 pb-20">
                {/* Holidays Tab Component */}
                {(isMaster || hasPermission('settings.holidays')) && (
                  <HolidaysTab holidays={localHolidays} isMaster={isMaster} />
                )}

                {/* 1.5 Display Settings */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="font-bold mb-4 flex gap-2"><CalendarClock size={18} /> 화면 설정</h3>

                  {/* Default View Mode - Only if Calendar is accessible */}
                  {canManageMenus && (
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <div>
                        <span className="text-sm font-medium text-gray-700">기본 뷰 모드</span>
                        <p className="text-xs text-gray-400">앱 시작 시 기본으로 표시할 뷰</p>
                      </div>
                      <select
                        value={localStorage.getItem('default_view_mode') || 'monthly'}
                        onChange={(e) => {
                          localStorage.setItem('default_view_mode', e.target.value);
                          setHasChanges(true); // Hint update
                        }}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#fdb813] outline-none"
                      >
                        <option value="daily">일간</option>
                        <option value="weekly">주간</option>
                        <option value="monthly">월간</option>
                        <option value="yearly">연간</option>
                      </select>
                    </div>
                  )}

                  {/* Dark Mode Toggle */}
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <span className="text-sm font-medium text-gray-700">다크 모드</span>
                      <p className="text-xs text-gray-400">어두운 테마 사용</p>
                    </div>
                    <button
                      onClick={() => {
                        const current = localStorage.getItem('dark_mode') === 'true';
                        localStorage.setItem('dark_mode', String(!current));
                        if (!current) {
                          document.documentElement.classList.add('dark');
                        } else {
                          document.documentElement.classList.remove('dark');
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localStorage.getItem('dark_mode') === 'true' ? 'bg-[#081429]' : 'bg-gray-200'
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localStorage.getItem('dark_mode') === 'true' ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>

                  {/* Default Main Tab - Only show if user has access to 2+ tabs */}
                  {accessibleTabs.length >= 2 && (
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <span className="text-sm font-medium text-gray-700">기본 메인 탭</span>
                        <p className="text-xs text-gray-400">로그인 시 먼저 표시될 탭</p>
                      </div>
                      <select
                        value={localStorage.getItem('default_main_tab') || 'auto'}
                        onChange={(e) => {
                          localStorage.setItem('default_main_tab', e.target.value);
                          setHasChanges(true);
                        }}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#fdb813] outline-none"
                      >
                        <option value="auto">자동 (첫 번째 탭)</option>
                        {accessibleTabs.includes('calendar') && <option value="calendar">📅 연간 일정</option>}
                        {accessibleTabs.includes('timetable') && <option value="timetable">📊 시간표</option>}
                        {accessibleTabs.includes('payment') && <option value="payment">💰 전자 결재</option>}
                        {accessibleTabs.includes('gantt') && <option value="gantt">📈 간트 차트</option>}
                        {accessibleTabs.includes('consultation') && <option value="consultation">💬 상담</option>}
                      </select>
                    </div>
                  )}
                </div>

                {/* 2. System Config (Data Retention) */}
                {isMaster && (
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="font-bold mb-4 flex gap-2"><Database size={18} /> 데이터 보존 및 아카이브</h3>
                    <div className="space-y-4">
                      {/* Lookback Years Config */}
                      <div className="flex gap-2 items-center justify-between border-b border-gray-100 pb-4">
                        <span className="text-sm text-gray-600">지난 데이터 보존:</span>
                        <div className="flex items-center gap-2">
                          <input type="number" value={lookbackYears} onChange={(e) => setLookbackYears(Number(e.target.value))} className="border p-2 rounded w-20 text-center" />
                          <span className="text-sm text-gray-600">년</span>
                          <button onClick={() => handleUpdateLookback(lookbackYears)} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200">저장</button>
                        </div>
                      </div>

                      {/* Archive Toggle (Moved here from Calendar Header) */}
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <Archive size={16} /> 아카이브된 일정 보기
                          </span>
                          <p className="text-xs text-gray-400 mt-0.5">보존 기간이 지난 오래된 데이터를 캘린더에 표시합니다.</p>
                        </div>
                        <button
                          onClick={onToggleArchived}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showArchived ? 'bg-[#fdb813]' : 'bg-gray-200'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showArchived ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ROLE PERMISSIONS TAB - Viewable by MASTER, ADMIN, MANAGER */}
            {activeTab === 'role_permissions' && canViewRolePermissions && (
              <RolePermissionsTab
                isMaster={isMaster}
                isAdmin={isAdmin}
                currentUserRole={currentUserProfile?.role}
              />
            )}

            {/* GANTT DEPARTMENTS TAB */}
            {activeTab === 'gantt_departments' && isMaster && (
              <DepartmentsTab isMaster={isMaster} />
            )}

            {/* GANTT CATEGORIES TAB */}
            {activeTab === 'gantt_categories' && isMaster && (
              <GanttCategoriesTab isMaster={isMaster} />
            )}

            {/* ATTENDANCE SALARY SETTINGS TAB */}
            {activeTab === 'salary_settings' && (isMaster || isAdmin) && (
              <SalarySettingsTab teachers={teachers} />
            )}

            {/* CALENDAR HASHTAGS TAB */}
            {activeTab === 'calendar_hashtags' && (isMaster || isAdmin) && (
              <HashtagsTab isMaster={isMaster} />
            )}

            {/* MIGRATION TAB */}

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
        {selectedUserForEdit && (() => {
          const user = localUsers.find(u => u.uid === selectedUserForEdit);
          if (!user) return null;
          return (
            <UserDetailModal
              user={user}
              departments={localDepartments}
              teachers={teachers}
              currentUserProfile={currentUserProfile}
              initialPermissions={initialPermissions}
              canApproveUser={canApproveUser}
              canChangeRole={canChangeRole}
              canChangePermissions={canChangePermissions}
              isMaster={isMaster}
              isAdmin={isAdmin}
              onClose={() => setSelectedUserForEdit(null)}
              onUserUpdate={handleUserUpdate}
              onDeptPermissionChange={handleDeptPermissionChange}
              onDeleteUser={handleDeleteUser}
            />
          );
        })()}

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

