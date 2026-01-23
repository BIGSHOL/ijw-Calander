import React, { useState, useEffect } from 'react';
import { Department, UserProfile, CalendarEvent, Teacher } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { X, FolderKanban, CalendarClock, Archive, Database } from 'lucide-react';
import { storage, STORAGE_KEYS } from '../../utils/localStorage';
import { STANDARD_HOLIDAYS } from '../../constants_holidays';
import { db, auth } from '../../firebaseConfig';
import { setDoc, doc, deleteDoc, writeBatch, collection, onSnapshot, updateDoc, getDoc, getDocs, query, where } from 'firebase/firestore';

import { Holiday } from '../../types';
// MyEventsModal 제거됨 - 직원 관리로 통합
import { HolidaysTab } from './';
// DepartmentsTab, GanttCategoriesTab 제거됨 - 간트 차트 페이지(GanttSettingsModal)에서 관리
// HashtagsTab 제거됨 - 캘린더 페이지(CalendarSettingsModal)에서 관리
import { useTabPermissions } from '../../hooks/useTabPermissions';
// SalarySettingsTab 제거됨 - 출석부 페이지(AttendanceSettingsModal)에서 관리
// UserDetailModal 제거됨 - 직원 관리 페이지의 UsersManagement에서 처리
// DepartmentsManagementTab 제거됨 - 캘린더 페이지(CalendarSettingsModal)에서 관리
// UsersTab 제거됨 - 직원 관리 페이지의 "시스템 사용자" 탭(UsersManagement)으로 통합
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

// 탭 구조 제거됨 - 내용이 바로 표시됨 (2026-01-20)

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
  // canManageUsers, canViewTeachers, canViewClasses 제거됨 - 각 페이지에서 관리

  // Get accessible tabs for current user
  const { accessibleTabs } = useTabPermissions(currentUserProfile || null);

  // 탭 상태 제거됨 - 단일 뷰로 표시

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
  const [localHolidays, setLocalHolidays] = useState<Holiday[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync Props to Local State (Smart Merge)
  useEffect(() => {
    if (!isOpen) return;
    setLocalDepartments(prev => {
      const prevMap = new Map(prev.map(d => [d.id, d]));
      return departments.map(d => prevMap.get(d.id) || d);
    });
  }, [departments, isOpen]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setLocalDepartments(departments);
      setLocalHolidays(holidays);
      setHasChanges(false);
    }
  }, [isOpen, holidays, departments]);

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

  // Class Keyword Color State 제거됨 - 시간표 페이지(ClassSettingsModal)에서 관리

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

  // --- Teacher Management Handlers (Legacy - TeachersTab uses staff collection directly) ---
  // NOTE: 강사 관리 기능은 TeachersTab 컴포넌트로 분리되어 staff 컬렉션 사용
  const handleAddTeacher = async () => {
    if (!newTeacherName.trim()) return alert("강사 이름을 입력해주세요.");
    const name = newTeacherName.trim();
    try {
      const newDocRef = doc(collection(db, 'staff'));
      await setDoc(newDocRef, {
        name: name,
        role: 'teacher',
        subjects: newTeacherSubjects,
        isHiddenInTimetable: false,
        timetableOrder: teachers.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setNewTeacherName('');
      setNewTeacherSubjects(['math', 'english']);
    } catch (e) {
      console.error(e);
      alert("강사 추가 실패");
    }
  };

  const handleUpdateTeacher = async (id: string) => {
    if (!editTeacherName.trim()) return;
    try {
      await updateDoc(doc(db, 'staff', id), {
        name: editTeacherName.trim(),
        subjects: editTeacherSubjects,
        bgColor: editTeacherBgColor,
        textColor: editTeacherTextColor,
        defaultRoom: editTeacherDefaultRoom.trim(),
        updatedAt: new Date().toISOString(),
      });
      setEditingTeacherId(null);
    } catch (e) {
      console.error(e);
      alert("강사 수정 실패");
    }
  };

  const handleToggleVisibility = async (id: string, currentHidden: boolean) => {
    try {
      await updateDoc(doc(db, 'staff', id), {
        isHiddenInTimetable: !currentHidden,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error(e);
      alert("상태 변경 실패");
    }
  };

  const handleDeleteTeacher = async (id: string, name: string) => {
    if (!confirm(`'${name}' 강사를 삭제하시겠습니까?`)) return;
    try {
      await deleteDoc(doc(db, 'staff', id));
    } catch (e) {
      console.error(e);
      alert("강사 삭제 실패");
    }
  };

  // --- Teacher Drag and Drop Handlers ---
  const handleTeacherDragStart = (e: React.DragEvent, staffId: string) => {
    setDraggedTeacherId(staffId);
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

    // Update order values in Firebase (staff collection)
    try {
      const batch = writeBatch(db);
      newOrder.forEach((teacher, index) => {
        batch.update(doc(db, 'staff', teacher.id), { timetableOrder: index });
      });
      await batch.commit();
    } catch (e) {
      console.error('순서 저장 실패:', e);
      alert('순서 저장 실패');
    }

    setDraggedTeacherId(null);
  };

  // System Config logic...
  useEffect(() => {
    if (isMaster) {
      const unsubscribe = onSnapshot(doc(db, 'system', 'config'), (doc) => {
        if (doc.exists()) {
          setLookbackYears(doc.data().eventLookbackYears || 2);
        }
      });
      return () => unsubscribe();
    }
  }, [isMaster]);

  // Class Keywords subscription 제거됨 - 시간표 페이지(ClassSettingsModal)에서 관리

  // NOTE: Role permissions moved to RoleManagementPage

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

    // 2. Users - 사용자 관리는 직원 관리(StaffManager)로 이전됨
    // 이 코드는 더 이상 사용되지 않지만, 혹시 호출되면 staff 컬렉션에 저장
    // (실제로 사용자 관리 UI가 제거되어 호출되지 않음)

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

      // Apply default permission to all staff with accounts
      const batch = writeBatch(db);

      // Get all staff with uid (계정 연동된 직원)
      const staffSnapshot = await getDocs(query(
        collection(db, 'staff'),
        where('uid', '!=', null)
      ));

      staffSnapshot.docs.forEach(staffDoc => {
        const staff = staffDoc.data();
        const currentPerms = staff.departmentPermissions || {};

        // Master always gets edit permission
        const permissionToApply = staff.systemRole === 'master' ? 'edit' : newDepartmentForm.defaultPermission;

        // Skip none permission
        // @ts-ignore - 'block' is legacy value for backwards compatibility
        if (permissionToApply === 'none' || permissionToApply === 'block') {
          // Block: don't add to permissions
          batch.update(staffDoc.ref, {
            departmentPermissions: { ...currentPerms }
          });
        } else {
          // View or Edit: add to permissions
          batch.update(staffDoc.ref, {
            departmentPermissions: { ...currentPerms, [newDept.id]: permissionToApply }
          });
        }
      });

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
  // 사용자 관리 함수들 제거됨 - 직원 관리(StaffManager)로 이전

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
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FolderKanban size={20} className="text-[#fdb813]" />
              시스템 관리
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* Content Area */}
          <div className="p-6 overflow-y-auto flex-1 bg-gray-50 pb-20">
            {(isMaster || isAdmin || currentUserProfile?.role === 'manager' || hasPermission('settings.access')) && (
              <div className="max-w-2xl mx-auto space-y-8 pb-20">
                {/* Holidays Tab Component */}
                {(isMaster || hasPermission('settings.holidays')) && (
                  <HolidaysTab holidays={localHolidays} isMaster={isMaster} />
                )}

                {/* 1.5 Display Settings */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="font-bold mb-4 flex gap-2"><CalendarClock size={18} /> 화면 설정</h3>

                  {/* Dark Mode Toggle */}
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <span className="text-sm font-medium text-gray-700">다크 모드</span>
                      <p className="text-xs text-gray-400">어두운 테마 사용</p>
                    </div>
                    <button
                      onClick={() => {
                        const current = storage.getBoolean(STORAGE_KEYS.DARK_MODE, false);
                        storage.setBoolean(STORAGE_KEYS.DARK_MODE, !current);
                        if (!current) {
                          document.documentElement.classList.add('dark');
                        } else {
                          document.documentElement.classList.remove('dark');
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${storage.getBoolean(STORAGE_KEYS.DARK_MODE, false) ? 'bg-[#081429]' : 'bg-gray-200'
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${storage.getBoolean(STORAGE_KEYS.DARK_MODE, false) ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>
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


            {/* GANTT DEPARTMENTS/CATEGORIES TAB 제거됨 - 간트 차트 페이지(GanttSettingsModal)에서 관리 */}

            {/* ATTENDANCE SALARY SETTINGS TAB 제거됨 - 출석부 페이지에서 관리 */}

            {/* CALENDAR HASHTAGS TAB 제거됨 - 캘린더 페이지(CalendarSettingsModal)에서 관리 */}

            {/* MIGRATION TAB */}

          </div>

          {/* Footer (Save Button) 제거됨 - users 탭이 직원 관리로 이동되어 불필요 */}
        </div>

        {/* UserDetailModal 및 MyEventsModal 제거됨 - 직원 관리 페이지의 UsersManagement에서 처리 */}
      </div>
    </>
  );
};

export default SettingsModal;

