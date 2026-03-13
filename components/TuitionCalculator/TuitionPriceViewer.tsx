import React, { useState } from 'react';
import { Eye, Edit3, Save, X, Loader2, Database, Plus, Trash2 } from 'lucide-react';
import { TuitionSubjectType } from '../../types/tuition';
import type { TuitionCourse } from '../../types/tuition';

interface TuitionPriceViewerProps {
  courses: TuitionCourse[];
  canManage?: boolean;
  isEmpty?: boolean;
  onUpdatePrice?: (course: TuitionCourse) => Promise<void>;
  onAddCourse?: (course: TuitionCourse) => Promise<void>;
  onDeleteCourse?: (id: string) => Promise<void>;
  onSeed?: () => Promise<void>;
  isUpdating?: boolean;
  isSeeding?: boolean;
}

const CATEGORY_OPTIONS = [
  { value: TuitionSubjectType.MATH, label: '수학' },
  { value: TuitionSubjectType.ENGLISH, label: 'EIE' },
  { value: TuitionSubjectType.KOREAN, label: '국어' },
  { value: TuitionSubjectType.ENGLISH_SUB, label: '영어' },
  { value: TuitionSubjectType.OTHER, label: '기타' },
];

export const TuitionPriceViewer: React.FC<TuitionPriceViewerProps> = ({
  courses, canManage, isEmpty, onUpdatePrice, onAddCourse, onDeleteCourse, onSeed, isUpdating, isSeeding,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ category: TuitionSubjectType; name: string; defaultPrice: number }>({ category: TuitionSubjectType.MATH, name: '', defaultPrice: 0 });
  const [showAdd, setShowAdd] = useState(false);
  const [newCourse, setNewCourse] = useState({ name: '', category: TuitionSubjectType.MATH as TuitionSubjectType, defaultPrice: 0 });

  const startEdit = (course: TuitionCourse) => {
    setEditingId(course.id);
    setEditData({ category: course.category, name: course.name, defaultPrice: course.defaultPrice });
  };

  const handleSave = async (course: TuitionCourse) => {
    if (!onUpdatePrice || !editData.name.trim()) return;
    await onUpdatePrice({ ...course, category: editData.category, name: editData.name, defaultPrice: editData.defaultPrice });
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (!onAddCourse || !newCourse.name.trim()) return;
    const id = `custom_${Date.now()}`;
    await onAddCourse({ id, category: newCourse.category, name: newCourse.name, days: '', defaultPrice: newCourse.defaultPrice });
    setNewCourse({ name: '', category: TuitionSubjectType.MATH, defaultPrice: 0 });
    setShowAdd(false);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-[#373d41]/20 flex flex-col" style={{ maxHeight: 'calc(100vh - 220px)' }}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-[#081429] flex items-center gap-2">
          <Eye className="w-6 h-6 text-[#fdb813]" />
          수강료 단가 {canManage ? '관리' : '조회'}
        </h2>
        <div className="flex gap-2">
          {canManage && isEmpty && onSeed && (
            <button
              onClick={onSeed}
              disabled={isSeeding}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#081429] text-white text-xs rounded-lg hover:bg-[#0c1e3d] disabled:opacity-50"
            >
              {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              초기 데이터 등록
            </button>
          )}
          {canManage && !isEmpty && (
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#fdb813] text-[#081429] text-xs font-bold rounded-lg hover:bg-[#fdc943]"
            >
              <Plus className="w-4 h-4" />
              과목 추가
            </button>
          )}
        </div>
      </div>

      {isEmpty && (
        <div className="text-center py-8 text-gray-500">
          <Database className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">DB에 과목 데이터가 없습니다.</p>
          <p className="text-xs text-gray-400 mt-1">
            {canManage ? '"초기 데이터 등록" 버튼을 클릭하여 기본 54개 과목을 등록하세요.' : '관리자에게 초기 데이터 등록을 요청하세요.'}
          </p>
        </div>
      )}

      {/* 과목 추가 폼 */}
      {showAdd && canManage && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[150px]">
            <label className="text-xs text-gray-500 block mb-1">과목명</label>
            <input
              type="text"
              value={newCourse.name}
              onChange={e => setNewCourse(p => ({ ...p, name: e.target.value }))}
              className="w-full px-2 py-1.5 border rounded text-sm"
              placeholder="과목명 입력"
            />
          </div>
          <div className="w-24">
            <label className="text-xs text-gray-500 block mb-1">분류</label>
            <select
              value={newCourse.category}
              onChange={e => setNewCourse(p => ({ ...p, category: e.target.value as TuitionSubjectType }))}
              className="w-full px-2 py-1.5 border rounded text-sm"
            >
              {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="w-28">
            <label className="text-xs text-gray-500 block mb-1">단가</label>
            <input
              type="number"
              value={newCourse.defaultPrice}
              onChange={e => setNewCourse(p => ({ ...p, defaultPrice: Number(e.target.value) }))}
              className="w-full px-2 py-1.5 border rounded text-sm text-right"
            />
          </div>
          <button onClick={handleAdd} className="px-3 py-1.5 bg-[#081429] text-white text-xs rounded-lg hover:bg-[#0c1e3d]">추가</button>
          <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300">취소</button>
        </div>
      )}

      <div className="flex-1 overflow-auto border border-[#373d41]/20 rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 text-[#081429] sticky top-0 z-10">
            <tr>
              <th className="p-3 w-[15%]">분류</th>
              <th className="p-3 w-[45%]">과목명</th>
              <th className="p-3 w-[20%] text-right">기본 단가</th>
              {canManage && <th className="p-3 w-[20%] text-center">관리</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#373d41]/10">
            {courses.map(course => (
              <tr key={course.id} className="hover:bg-[#fdb813]/10 transition-colors">
                <td className="p-3 text-[#373d41]">
                  {editingId === course.id ? (
                    <select
                      value={editData.category}
                      onChange={e => setEditData(p => ({ ...p, category: e.target.value as TuitionSubjectType }))}
                      className="w-full px-1 py-1 border border-[#fdb813] rounded text-sm"
                    >
                      {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    CATEGORY_OPTIONS.find(o => o.value === course.category)?.label || course.category
                  )}
                </td>
                <td className="p-3">
                  {editingId === course.id ? (
                    <input
                      type="text"
                      value={editData.name}
                      onChange={e => setEditData(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-2 py-1 border border-[#fdb813] rounded text-sm"
                      autoFocus
                    />
                  ) : (
                    course.name
                  )}
                </td>
                <td className="p-3 text-right font-medium">
                  {editingId === course.id ? (
                    <input
                      type="number"
                      value={editData.defaultPrice}
                      onChange={e => setEditData(p => ({ ...p, defaultPrice: Number(e.target.value) }))}
                      className="w-full px-2 py-1 border border-[#fdb813] rounded text-right text-sm"
                      onKeyDown={e => e.key === 'Enter' && handleSave(course)}
                    />
                  ) : (
                    <>{course.defaultPrice.toLocaleString()}원</>
                  )}
                </td>
                {canManage && (
                  <td className="p-3 text-center">
                    {editingId === course.id ? (
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => handleSave(course)}
                          disabled={isUpdating}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-50 rounded">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => startEdit(course)} className="p-1 text-[#081429] hover:bg-gray-100 rounded">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {onDeleteCourse && course.id.startsWith('custom_') && (
                          <button
                            onClick={() => { if (confirm(`"${course.name}" 삭제?`)) onDeleteCourse(course.id); }}
                            className="p-1 text-red-400 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-sm text-[#373d41]/60 text-right">
        총 {courses.length}개 과목
        {isEmpty && ' (하드코딩 폴백)'}
      </div>
    </div>
  );
};
