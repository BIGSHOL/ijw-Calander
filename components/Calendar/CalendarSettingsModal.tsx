import React, { useState, useEffect, useMemo } from 'react';
import { X, Building2, Hash, Shield, Calendar } from 'lucide-react';
import { Department, UserProfile, StaffMember } from '../../types';
import { NewDepartmentForm, CategoryManagementState, DepartmentFilterState, INITIAL_DEPARTMENT_FORM } from '../../types/departmentForm';
import DepartmentsManagementTab from '../settings/tabs/DepartmentsManagementTab';
import DepartmentPermissionsTab from '../settings/tabs/DepartmentPermissionsTab';
import HashtagsTab from '../settings/HashtagsTab';
import GoogleCalendarSyncTab from './GoogleCalendarSyncTab';
import { usePermissions } from '../../hooks/usePermissions';
import { useDepartments, useSystemConfig, useStaffWithAccounts } from '../../hooks/useFirebaseQueries';
import { db } from '../../firebaseConfig';
import { setDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { useDraggable } from '../../hooks/useDraggable';

// StaffMember를 UserProfile처럼 사용하기 위한 변환 헬퍼
const staffToUserLike = (staff: StaffMember): UserProfile => ({
  uid: staff.uid || staff.id,
  email: staff.email || '',
  displayName: staff.name,
  role: staff.systemRole || 'user',
  status: staff.approvalStatus || 'pending',
  departmentPermissions: staff.departmentPermissions || {},
  favoriteDepartments: staff.favoriteDepartments || [],
  jobTitle: staff.jobTitle,
  staffId: staff.id, // 시뮬레이션 시 출석부 등에서 선생님 필터링용
});

interface CalendarSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
}

type TabType = 'departments' | 'permissions' | 'hashtags' | 'gcal-sync';

const CalendarSettingsModal: React.FC<CalendarSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('departments');
  const queryClient = useQueryClient();
  const { handleMouseDown: handleDragMouseDown, dragStyle } = useDraggable();

  useEscapeClose(onClose);

  // Permissions
  const { hasPermission } = usePermissions(currentUser);
  const canManageDept = hasPermission('departments.manage');
  const canCreateDept = canManageDept;
  const canEditDept = canManageDept;
  const canDeleteDept = canManageDept;
  const canManageCategories = hasPermission('settings.manage_categories');
  const canManageAllDepts = canManageDept;

  // Firebase Data
  const { data: departments = [] } = useDepartments(!!currentUser);
  const { data: systemConfig } = useSystemConfig(!!currentUser);
  const { data: staffWithAccounts = [] } = useStaffWithAccounts(canManageAllDepts);
  const sysCategories = systemConfig?.categories || [];

  // staff 데이터를 UserProfile 형태로 변환
  const users = useMemo(() =>
    staffWithAccounts.map(staffToUserLike),
    [staffWithAccounts]
  );

  // Local State
  const [localDepartments, setLocalDepartments] = useState<Department[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Form States
  const [newDepartmentForm, setNewDepartmentForm] = useState<NewDepartmentForm>(INITIAL_DEPARTMENT_FORM);
  const [categoryManagement, setCategoryManagement] = useState<CategoryManagementState>({
    newCategoryName: '',
  });
  const [departmentFilterState, setDepartmentFilterState] = useState<DepartmentFilterState>({
    searchTerm: '',
    isCreating: false,
    draggedIndex: null,
  });

  // Sync Props to Local State
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
      setHasChanges(false);
    }
  }, [isOpen, departments]);

  // Handlers
  const markChanged = () => setHasChanges(true);

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
    if (!window.confirm(`'${cat}' 카테고리를 삭제하시겠습니까?`)) return;
    try {
      const newCats = sysCategories.filter(c => c !== cat);
      await setDoc(doc(db, 'system', 'config'), { categories: newCats }, { merge: true });
    } catch (e) {
      console.error(e);
      alert('카테고리 삭제 실패');
    }
  };

  const handleAdd = async () => {
    if (!newDepartmentForm.name.trim()) return alert('부서명을 입력하세요');

    try {
      const id = `dept_${Date.now()}`;
      const newDept: Department = {
        id,
        name: newDepartmentForm.name.trim(),
        color: newDepartmentForm.defaultColor,
        order: localDepartments.length + 1,
        defaultColor: newDepartmentForm.defaultColor,
        defaultTextColor: newDepartmentForm.defaultTextColor,
        defaultBorderColor: newDepartmentForm.defaultBorderColor,
        defaultPermission: newDepartmentForm.defaultPermission,
        category: newDepartmentForm.category || undefined,
      };

      // departments 컬렉션에 영문 필드명으로 저장
      // undefined 필드 제거 (Firestore에서 에러 발생)
      const firestoreData: Record<string, any> = { ...newDept };
      Object.keys(firestoreData).forEach(key => {
        if (firestoreData[key] === undefined) delete firestoreData[key];
      });
      await setDoc(doc(db, 'departments', id), firestoreData);

      // 로컬 상태 즉시 업데이트
      setLocalDepartments(prev => [...prev, newDept]);
      // React Query 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['departments'] });

      setNewDepartmentForm(INITIAL_DEPARTMENT_FORM);
      setDepartmentFilterState({ ...departmentFilterState, isCreating: false });
    } catch (e: any) {
      console.error('부서 추가 에러:', e);
      alert(`부서 추가 실패: ${e?.message || e?.code || '알 수 없는 오류'}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('이 부서를 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'departments', id));
      // 로컬 상태 업데이트
      setLocalDepartments(prev => prev.filter(d => d.id !== id));
      // React Query 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    } catch (e) {
      console.error(e);
      alert('부서 삭제 실패');
    }
  };

  const handleLocalDeptUpdate = (id: string, field: keyof Department, value: any) => {
    setLocalDepartments(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
    markChanged();
  };

  const handleSaveChanges = async () => {
    try {
      const batch = writeBatch(db);
      localDepartments.forEach(dept => {
        // undefined 필드 제거
        const firestoreData: Record<string, any> = { ...dept };
        Object.keys(firestoreData).forEach(key => {
          if (firestoreData[key] === undefined) delete firestoreData[key];
        });
        batch.set(doc(db, 'departments', dept.id), firestoreData);
      });
      await batch.commit();
      // React Query 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setHasChanges(false);
      alert('변경사항이 저장되었습니다.');
    } catch (e) {
      console.error(e);
      alert('저장 실패');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]"
    >
      <div
        className="bg-white rounded-sm shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200"
      >
        {/* Header */}
        <div onMouseDown={handleDragMouseDown} className="flex items-center justify-between px-3 py-2 border-b border-gray-200 cursor-move select-none">
          <h2 className="text-sm font-bold text-primary flex items-center gap-1.5">
            <span className="text-accent">📅</span>
            연간 일정 설정
          </h2>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <button
                onClick={handleSaveChanges}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-primary rounded-sm font-bold text-xs hover:bg-accent-600 transition-colors"
              >
                저장
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-3 shrink-0">
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-4 py-2 font-bold text-xs transition-all border-b-2 ${
              activeTab === 'departments'
                ? 'border-accent text-primary'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Building2 size={14} />
              부서 관리
            </div>
          </button>
          {canManageAllDepts && (
            <button
              onClick={() => setActiveTab('permissions')}
              className={`px-4 py-2 font-bold text-xs transition-all border-b-2 ${
                activeTab === 'permissions'
                  ? 'border-accent text-primary'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Shield size={14} />
                부서 권한
              </div>
            </button>
          )}
          <button
            onClick={() => setActiveTab('hashtags')}
            className={`px-4 py-2 font-bold text-xs transition-all border-b-2 ${
              activeTab === 'hashtags'
                ? 'border-accent text-primary'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Hash size={14} />
              해시태그 관리
            </div>
          </button>
          {canManageAllDepts && (
            <button
              onClick={() => setActiveTab('gcal-sync')}
              className={`px-4 py-2 font-bold text-xs transition-all border-b-2 ${
                activeTab === 'gcal-sync'
                  ? 'border-accent text-primary'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Calendar size={14} />
                구글 캘린더
              </div>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === 'departments' && (
            <div className="bg-white border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                <Building2 className="w-3 h-3 text-primary" />
                <h3 className="text-primary font-bold text-xs">부서 관리</h3>
              </div>
              <div className="p-2">
                <DepartmentsManagementTab
                  localDepartments={localDepartments}
                  sysCategories={sysCategories}
                  currentUserProfile={currentUser}
                  newDepartmentForm={newDepartmentForm}
                  categoryManagement={categoryManagement}
                  departmentFilterState={departmentFilterState}
                  canManageCategories={canManageCategories}
                  canCreateDept={canCreateDept}
                  canEditDept={canEditDept}
                  canDeleteDept={canDeleteDept}
                  canManageAllDepts={canManageAllDepts}
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
              </div>
            </div>
          )}
          {activeTab === 'permissions' && canManageAllDepts && (
            <div className="bg-white border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                <Shield className="w-3 h-3 text-primary" />
                <h3 className="text-primary font-bold text-xs">부서 권한</h3>
              </div>
              <div className="p-2">
                <DepartmentPermissionsTab
                  departments={departments}
                  users={users}
                  currentUser={currentUser}
                />
              </div>
            </div>
          )}
          {activeTab === 'hashtags' && (
            <div className="bg-white border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                <Hash className="w-3 h-3 text-primary" />
                <h3 className="text-primary font-bold text-xs">해시태그 관리</h3>
              </div>
              <div className="p-2">
                <HashtagsTab />
              </div>
            </div>
          )}
          {activeTab === 'gcal-sync' && canManageAllDepts && (
            <div className="bg-white border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                <Calendar className="w-3 h-3 text-primary" />
                <h3 className="text-primary font-bold text-xs">구글 캘린더 연동</h3>
              </div>
              <div className="p-2">
                <GoogleCalendarSyncTab />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarSettingsModal;
