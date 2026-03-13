import React, { useState } from 'react';
import { Eye, Edit3, Save, X, Loader2, Database, Plus, Trash2 } from 'lucide-react';
import type { TuitionDiscountItem } from '../../types/tuition';

interface TuitionDiscountViewerProps {
  discounts: TuitionDiscountItem[];
  canManage?: boolean;
  isEmpty?: boolean;
  onUpdateDiscount?: (item: TuitionDiscountItem) => Promise<void>;
  onAddDiscount?: (item: TuitionDiscountItem) => Promise<void>;
  onDeleteDiscount?: (id: string) => Promise<void>;
  onSeed?: () => Promise<void>;
  isUpdating?: boolean;
  isSeeding?: boolean;
}

export const TuitionDiscountViewer: React.FC<TuitionDiscountViewerProps> = ({
  discounts, canManage, isEmpty, onUpdateDiscount, onAddDiscount, onDeleteDiscount, onSeed, isUpdating, isSeeding,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ name: string; amount: number }>({ name: '', amount: 0 });
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', amount: 0 });

  const startEdit = (item: TuitionDiscountItem) => {
    setEditingId(item.id);
    setEditData({ name: item.name, amount: item.amount });
  };

  const handleSave = async (item: TuitionDiscountItem) => {
    if (!onUpdateDiscount || !editData.name.trim()) return;
    await onUpdateDiscount({ ...item, name: editData.name, amount: editData.amount });
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (!onAddDiscount || !newItem.name.trim()) return;
    const id = `disc_${Date.now()}`;
    await onAddDiscount({ id, name: newItem.name, amount: newItem.amount });
    setNewItem({ name: '', amount: 0 });
    setShowAdd(false);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-[#373d41]/20 flex flex-col" style={{ maxHeight: 'calc(100vh - 220px)' }}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-[#081429] flex items-center gap-2">
          <Eye className="w-6 h-6 text-[#fdb813]" />
          할인 항목 {canManage ? '관리' : '조회'}
        </h2>
        <div className="flex gap-2">
          {canManage && isEmpty && onSeed && (
            <button onClick={onSeed} disabled={isSeeding}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#081429] text-white text-xs rounded-lg hover:bg-[#0c1e3d] disabled:opacity-50">
              {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              초기 데이터 등록
            </button>
          )}
          {canManage && !isEmpty && (
            <button onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#fdb813] text-[#081429] text-xs font-bold rounded-lg hover:bg-[#fdc943]">
              <Plus className="w-4 h-4" /> 할인 추가
            </button>
          )}
        </div>
      </div>

      {isEmpty && (
        <div className="text-center py-8 text-gray-500">
          <Database className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">DB에 할인 데이터가 없습니다.</p>
          <p className="text-xs text-gray-400 mt-1">
            {canManage ? '"초기 데이터 등록" 버튼을 클릭하여 기본 할인 항목을 등록하세요.' : '관리자에게 초기 데이터 등록을 요청하세요.'}
          </p>
        </div>
      )}

      {/* 추가 폼 */}
      {showAdd && canManage && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 block mb-1">할인명</label>
            <input type="text" value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
              className="w-full px-2 py-1.5 border rounded text-sm" placeholder="할인명 입력" />
          </div>
          <div className="w-32">
            <label className="text-xs text-gray-500 block mb-1">금액</label>
            <input type="number" value={newItem.amount} onChange={e => setNewItem(p => ({ ...p, amount: Number(e.target.value) }))}
              className="w-full px-2 py-1.5 border rounded text-sm text-right" />
          </div>
          <button onClick={handleAdd} className="px-3 py-1.5 bg-[#081429] text-white text-xs rounded-lg hover:bg-[#0c1e3d]">추가</button>
          <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300">취소</button>
        </div>
      )}

      <div className="flex-1 overflow-auto border border-[#373d41]/20 rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 text-[#081429] sticky top-0 z-10">
            <tr>
              <th className="p-3 w-[50%]">할인명</th>
              <th className="p-3 w-[30%] text-right">금액</th>
              {canManage && <th className="p-3 w-[20%] text-center">관리</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#373d41]/10">
            {discounts.map(item => (
              <tr key={item.id} className="hover:bg-[#fdb813]/10 transition-colors">
                <td className="p-3">
                  {editingId === item.id ? (
                    <input type="text" value={editData.name} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-2 py-1 border border-[#fdb813] rounded text-sm" autoFocus />
                  ) : item.name}
                </td>
                <td className="p-3 text-right font-medium text-[#081429]">
                  {editingId === item.id ? (
                    <input type="number" value={editData.amount} onChange={e => setEditData(p => ({ ...p, amount: Number(e.target.value) }))}
                      className="w-full px-2 py-1 border border-[#fdb813] rounded text-right text-sm"
                      onKeyDown={e => e.key === 'Enter' && handleSave(item)} />
                  ) : (
                    <>-{item.amount.toLocaleString()}원</>
                  )}
                </td>
                {canManage && (
                  <td className="p-3 text-center">
                    {editingId === item.id ? (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => handleSave(item)} disabled={isUpdating} className="p-1 text-green-600 hover:bg-green-50 rounded">
                          {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-50 rounded">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => startEdit(item)} className="p-1 text-[#081429] hover:bg-gray-100 rounded">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {onDeleteDiscount && (
                          <button onClick={() => { if (confirm(`"${item.name}" 삭제?`)) onDeleteDiscount(item.id); }}
                            className="p-1 text-red-400 hover:bg-red-50 rounded">
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
        총 {discounts.length}개 할인 항목
        {isEmpty && ' (하드코딩 폴백)'}
      </div>
    </div>
  );
};
