import React from 'react';
import { Department, UserProfile } from '../../../types';
import { LayoutGrid, Plus, X, Search, List, Trash2 } from 'lucide-react';

interface DepartmentsManagementTabProps {
  // State props
  localDepartments: Department[];
  sysCategories: string[];
  newCategoryName: string;
  deptSearchTerm: string;
  isCreating: boolean;
  newDeptName: string;
  newDeptCategory: string;
  newDeptDefaultColor: string;
  newDeptDefaultTextColor: string;
  newDeptDefaultBorderColor: string;
  newDeptDefaultPermission: 'view' | 'block' | 'edit';
  draggedIndex: number | null;
  currentUserProfile: UserProfile | null;

  // Permission flags
  canManageCategories: boolean;
  canCreateDept: boolean;
  canEditDept: boolean;
  canDeleteDept: boolean;
  isMaster: boolean;
  isAdmin: boolean;

  // State setters
  setNewCategoryName: (value: string) => void;
  setDeptSearchTerm: (value: string) => void;
  setIsCreating: (value: boolean) => void;
  setNewDeptName: (value: string) => void;
  setNewDeptCategory: (value: string) => void;
  setNewDeptDefaultColor: (value: string) => void;
  setNewDeptDefaultTextColor: (value: string) => void;
  setNewDeptDefaultBorderColor: (value: string) => void;
  setNewDeptDefaultPermission: (value: 'view' | 'block' | 'edit') => void;
  setDraggedIndex: (value: number | null) => void;
  setLocalDepartments: (value: Department[] | ((prev: Department[]) => Department[])) => void;

  // Handlers
  handleAddCategory: () => void;
  handleDeleteCategory: (cat: string) => void;
  handleAdd: () => void;
  handleDelete: (id: string) => void;
  handleLocalDeptUpdate: (id: string, field: keyof Department, value: any) => void;
  markChanged: () => void;
}

const DepartmentsManagementTab: React.FC<DepartmentsManagementTabProps> = ({
  localDepartments,
  sysCategories,
  newCategoryName,
  deptSearchTerm,
  isCreating,
  newDeptName,
  newDeptCategory,
  newDeptDefaultColor,
  newDeptDefaultTextColor,
  newDeptDefaultBorderColor,
  newDeptDefaultPermission,
  draggedIndex,
  currentUserProfile,
  canManageCategories,
  canCreateDept,
  canEditDept,
  canDeleteDept,
  isMaster,
  isAdmin,
  setNewCategoryName,
  setDeptSearchTerm,
  setIsCreating,
  setNewDeptName,
  setNewDeptCategory,
  setNewDeptDefaultColor,
  setNewDeptDefaultTextColor,
  setNewDeptDefaultBorderColor,
  setNewDeptDefaultPermission,
  setDraggedIndex,
  setLocalDepartments,
  handleAddCategory,
  handleDeleteCategory,
  handleAdd,
  handleDelete,
  handleLocalDeptUpdate,
  markChanged,
}) => {
  return (
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
            <label className="flex items-center gap-2 cursor-pointer ml-4">
              <span>기본 권한</span>
              <select
                value={newDeptDefaultPermission}
                onChange={(e) => setNewDeptDefaultPermission(e.target.value as 'view' | 'block' | 'edit')}
                className="border rounded px-2 py-1 text-xs font-bold"
              >
                <option value="view">👁️ 조회</option>
                <option value="block">🚫 차단</option>
                <option value="edit">✏️ 수정</option>
              </select>
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
        <div className="bg-gray-100 rounded-t-xl border-x border-t border-gray-200 grid grid-cols-12 gap-4 p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
          <div className="col-span-4 pl-2">부서 정보</div>
          <div className="col-span-2 text-center">카테고리</div>
          <div className="col-span-4 text-center"> 색상 | 배경 | 글자 | 테두리</div>
          <div className="col-span-2 text-center">관리</div>
        </div>

        <div className="bg-white border-x border-b border-gray-200 text-sm rounded-b-xl divide-y divide-gray-100 shadow-sm border-t-0">
          {localDepartments
            .filter(d => d.name.includes(deptSearchTerm))
            .filter(d => isMaster || isAdmin || currentUserProfile?.departmentPermissions?.[d.id] === 'edit')
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
  );
};

export default DepartmentsManagementTab;
