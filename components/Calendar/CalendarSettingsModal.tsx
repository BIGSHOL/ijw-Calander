import React, { useState, useEffect } from 'react';
import { X, Building2, Hash } from 'lucide-react';
import { Department, UserProfile } from '../../types';
import { NewDepartmentForm, CategoryManagementState, DepartmentFilterState, INITIAL_DEPARTMENT_FORM } from '../../types/departmentForm';
import DepartmentsManagementTab from '../Settings/tabs/DepartmentsManagementTab';
import HashtagsTab from '../Settings/HashtagsTab';
import { usePermissions } from '../../hooks/usePermissions';
import { useDepartments, useSystemConfig } from '../../hooks/useFirebaseQueries';
import { db } from '../../firebaseConfig';
import { setDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';

interface CalendarSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
}

type TabType = 'departments' | 'hashtags';

const CalendarSettingsModal: React.FC<CalendarSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('departments');

  // Permissions
  const { hasPermission } = usePermissions(currentUser);
  const canManageDept = hasPermission('departments.manage');
  const canCreateDept = canManageDept;
  const canEditDept = canManageDept;
  const canDeleteDept = canManageDept;
  const canManageCategories = hasPermission('settings.manage_categories');
  const isMaster = currentUser?.role === 'master';
  const isAdmin = currentUser?.role === 'admin';

  // Firebase Data
  const { data: departments = [] } = useDepartments(!!currentUser);
  const { data: systemConfig } = useSystemConfig(!!currentUser);
  const sysCategories = systemConfig?.categories || [];

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
        category: newDepartmentForm.category || undefined,
        order: localDepartments.length + 1,
        defaultColor: newDepartmentForm.defaultColor,
        defaultTextColor: newDepartmentForm.defaultTextColor,
        defaultBorderColor: newDepartmentForm.defaultBorderColor,
        defaultPermission: newDepartmentForm.defaultPermission,
      };

      await setDoc(doc(db, 'departments', id), newDept);
      setNewDepartmentForm(INITIAL_DEPARTMENT_FORM);
      setDepartmentFilterState({ ...departmentFilterState, isCreating: false });
    } catch (e) {
      console.error(e);
      alert('부서 추가 실패');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('이 부서를 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'departments', id));
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
        batch.set(doc(db, 'departments', dept.id), dept);
      });
      await batch.commit();
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
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#081429] p-5 flex justify-between items-center text-white shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2">
            ⚙️ 연간 일정 설정
          </h2>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <button
                onClick={handleSaveChanges}
                className="flex items-center gap-2 px-4 py-2 bg-[#fdb813] text-[#081429] rounded-lg font-bold text-sm hover:bg-[#e5a610] transition-colors"
              >
                변경사항 저장
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-5 shrink-0">
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
              activeTab === 'departments'
                ? 'border-[#fdb813] text-[#081429]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <Building2 size={16} />
              부서 관리
            </div>
          </button>
          <button
            onClick={() => setActiveTab('hashtags')}
            className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
              activeTab === 'hashtags'
                ? 'border-[#fdb813] text-[#081429]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <Hash size={16} />
              해시태그 관리
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'departments' && (
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
          {activeTab === 'hashtags' && (
            <HashtagsTab isMaster={isMaster} />
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarSettingsModal;
