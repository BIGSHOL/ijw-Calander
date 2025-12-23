import React, { useState } from 'react';
import { Department } from '../types';
import { X, Plus, Trash2, GripVertical, Check, FolderKanban } from 'lucide-react';
import { db } from '../firebaseConfig';
import { setDoc, doc, deleteDoc } from 'firebase/firestore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  onAddDepartment: (name: string) => Promise<void>;
  onDeleteDepartment: (id: string) => Promise<void>;
  onUpdateDepartments: (departments: Department[]) => Promise<void>;
}

const DEPT_COLOR_OPTIONS = [
  { label: '빨강', class: 'bg-red-50', hex: '#fef2f2', border: 'border-red-200', text: 'text-red-800' },
  { label: '주황', class: 'bg-orange-50', hex: '#fff7ed', border: 'border-orange-200', text: 'text-orange-800' },
  { label: '노랑', class: 'bg-yellow-50', hex: '#fefce8', border: 'border-yellow-200', text: 'text-yellow-800' },
  { label: '초록', class: 'bg-green-50', hex: '#f0fdf4', border: 'border-green-200', text: 'text-green-800' },
  { label: '파랑', class: 'bg-blue-50', hex: '#eff6ff', border: 'border-blue-200', text: 'text-blue-800' },
  { label: '보라', class: 'bg-purple-50', hex: '#faf5ff', border: 'border-purple-200', text: 'text-purple-800' },
  { label: '분홍', class: 'bg-pink-50', hex: '#fdf2f8', border: 'border-pink-200', text: 'text-pink-800' },
  { label: '회색', class: 'bg-gray-50', hex: '#f9fafb', border: 'border-gray-200', text: 'text-gray-800' },
];

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  departments,
}) => {
  const [newDeptName, setNewDeptName] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // State for popover active department id to show color picker
  const [activeColorPickerId, setActiveColorPickerId] = useState<string | null>(null);

  if (!isOpen) return null;

  // New Department Logic
  const handleAdd = async () => {
    if (!newDeptName.trim()) return;
    const newDept: Department = {
      id: newDeptName.trim(), // Use name as ID
      name: newDeptName.trim(),
      order: departments.length + 1,
      color: '#ffffff', // Default to Hex
    };
    try {
      await setDoc(doc(db, "부서목록", newDept.id), {
        부서명: newDept.name,
        순서: newDept.order,
        색상: newDept.color,
        설명: ''
      });
      setNewDeptName('');
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (confirm('이 부서와 관련된 일정이 표시되지 않을 수 있습니다. 정말 삭제하시겠습니까?')) {
      try {
        await deleteDoc(doc(db, "부서목록", id));
      } catch (e) { console.error(e); }
    }
  };

  const handleUpdate = async (id: string, field: keyof Department, value: string) => {
    const fieldMap: Record<string, string> = {
      name: '부서명',
      order: '순서',
      color: '색상',
      description: '설명'
    };
    const dbField = fieldMap[field];
    if (!dbField) return;

    try {
      await setDoc(doc(db, "부서목록", id), {
        [dbField]: value
      }, { merge: true });
    } catch (e) { console.error(e); }
  };

  // Simplified DnD for now (no reorder persistence in this snippet request, keeping it visual mostly)
  const onDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
  };
  const onDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-0 relative max-h-[90vh] overflow-hidden border border-gray-200">

        {/* Header - Matching EventModal */}
        <div className="bg-[#081429] p-4 flex justify-between items-center text-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FolderKanban size={20} className="text-[#fdb813]" />
            부서 및 라인 관리
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-64px)]">
          {/* Add Section */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              placeholder="새 부서 이름"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#fdb813]/50 focus:border-[#fdb813] transition-all font-bold text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              disabled={!newDeptName.trim()}
              className="px-4 py-2 bg-[#081429] text-[#fdb813] rounded-lg hover:brightness-110 flex items-center gap-1 font-bold shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <Plus size={16} /> 추가
            </button>
          </div>

          <div className="h-px bg-gray-100 my-2" />

          {/* Department List */}
          <div className="space-y-3 pb-20"> {/* Padding for color picker popover space */}
            {departments.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                등록된 부서가 없습니다.
              </div>
            ) : (
              departments.map((dept, index) => (
                <div
                  key={dept.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, index)}
                  onDragEnd={onDragEnd}
                  className={`
                     relative group p-3 bg-white border border-gray-200 rounded-xl shadow-sm transition-all hover:shadow-md
                     ${draggedIndex === index ? 'opacity-40 border-dashed border-[#fdb813]' : 'hover:border-[#fdb813]/30'}
                   `}
                >
                  <div className="flex items-start gap-3">
                    {/* Drag Handle */}
                    <div className="mt-2 text-gray-300 cursor-grab hover:text-gray-500">
                      <GripVertical size={16} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-2">
                      {/* Row 1: Name and Color */}
                      <div className="flex items-center gap-2">
                        {/* Color Picker Input */}
                        <div className="relative flex items-center justify-center">
                          <div
                            className={`
                                ${!dept.color.startsWith('#') ? dept.color : 'bg-white'} 
                                w-8 h-8 rounded-full border shadow-sm overflow-hidden flex items-center justify-center transition-transform hover:scale-105
                                border-2 border-gray-100
                              `}
                            style={{
                              backgroundColor: dept.color.startsWith('#') ? dept.color : undefined
                            }}
                          >
                            <input
                              type="color"
                              value={dept.color.startsWith('#') ? dept.color : '#ffffff'}
                              onChange={(e) => handleUpdate(dept.id, 'color', e.target.value)}
                              className="opacity-0 w-[200%] h-[200%] cursor-pointer absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                              title="색상 변경"
                            />
                          </div>
                        </div>

                        {/* Name Input */}
                        <input
                          type="text"
                          value={dept.name}
                          onChange={(e) => handleUpdate(dept.id, 'name', e.target.value)}
                          className="flex-1 px-2 py-1.5 font-bold text-[#081429] border-b border-transparent hover:border-gray-200 focus:border-[#fdb813] outline-none transition-colors bg-transparent"
                        />

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(dept.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Row 2: Description */}
                      <input
                        type="text"
                        value={dept.description || ''}
                        onChange={(e) => handleUpdate(dept.id, 'description', e.target.value)}
                        className="w-full px-2 py-1 text-xs text-gray-500 bg-gray-50 rounded border border-transparent focus:bg-white focus:border-[#fdb813] outline-none transition-all placeholder:text-gray-300"
                        placeholder="부서 설명"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Backdrop click to close color picker */}
      {activeColorPickerId && (
        <div className="fixed inset-0 z-10" onClick={() => setActiveColorPickerId(null)} />
      )}
    </div>
  );
};

export default SettingsModal;
