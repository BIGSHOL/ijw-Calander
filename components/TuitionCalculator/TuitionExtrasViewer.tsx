import React, { useState } from 'react';
import { Eye, Edit3, Save, X, Loader2, Database, Plus, Trash2 } from 'lucide-react';
import { TUITION_EXTRA_CATEGORY_LABELS, catalogToExtraItem } from '../../constants/tuitionExtras';
import type { TextbookCatalogItem } from '../../data/textbookCatalog';
import type { TuitionExtraItem } from '../../types/tuition';

const EXTRA_CATEGORY_OPTIONS = [
  { value: 'test', label: '테스트' },
  { value: 'system', label: '시스템' },
  { value: 'bus', label: '차량' },
  { value: 'care', label: '케어' },
  { value: 'other', label: '기타' },
];

interface TuitionExtrasViewerProps {
  extras: TuitionExtraItem[];
  textbookCatalog?: TextbookCatalogItem[];
  canManage?: boolean;
  isEmpty?: boolean;
  onUpdateExtra?: (item: TuitionExtraItem) => Promise<void>;
  onAddExtra?: (item: TuitionExtraItem) => Promise<void>;
  onDeleteExtra?: (id: string) => Promise<void>;
  onSeed?: () => Promise<void>;
  isUpdating?: boolean;
  isSeeding?: boolean;
}

export const TuitionExtrasViewer: React.FC<TuitionExtrasViewerProps> = ({
  extras, textbookCatalog, canManage, isEmpty, onUpdateExtra, onAddExtra, onDeleteExtra, onSeed, isUpdating, isSeeding,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ category: string; name: string; defaultPrice: number }>({ category: 'test', name: '', defaultPrice: 0 });
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: 'test', defaultPrice: 0 });
  const [activeSection, setActiveSection] = useState<'textbook' | 'service'>('textbook');

  // 교재 카탈로그 데이터 (Firestore 교재 관리 연동)
  const textbookItems = (textbookCatalog || []).map(catalogToExtraItem);

  const startEdit = (item: TuitionExtraItem) => {
    setEditingId(item.id);
    setEditData({ category: item.category, name: item.name, defaultPrice: item.defaultPrice });
  };

  const handleSave = async (item: TuitionExtraItem) => {
    if (!onUpdateExtra || !editData.name.trim()) return;
    await onUpdateExtra({ ...item, category: editData.category as TuitionExtraItem['category'], name: editData.name, defaultPrice: editData.defaultPrice });
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (!onAddExtra || !newItem.name.trim()) return;
    const id = `extra_${Date.now()}`;
    await onAddExtra({ id, category: newItem.category as TuitionExtraItem['category'], name: newItem.name, defaultPrice: newItem.defaultPrice });
    setNewItem({ name: '', category: 'test', defaultPrice: 0 });
    setShowAdd(false);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-[#373d41]/20 flex flex-col" style={{ maxHeight: 'calc(100vh - 220px)' }}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-[#081429] flex items-center gap-2">
          <Eye className="w-6 h-6 text-[#fdb813]" />
          교재/기타 단가 {canManage ? '관리' : '조회'}
        </h2>
        <div className="flex gap-2">
          {canManage && isEmpty && activeSection === 'service' && onSeed && (
            <button onClick={onSeed} disabled={isSeeding}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#081429] text-white text-xs rounded-lg hover:bg-[#0c1e3d] disabled:opacity-50">
              {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              초기 데이터 등록
            </button>
          )}
          {canManage && activeSection === 'service' && !isEmpty && (
            <button onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#fdb813] text-[#081429] text-xs font-bold rounded-lg hover:bg-[#fdc943]">
              <Plus className="w-4 h-4" /> 항목 추가
            </button>
          )}
        </div>
      </div>

      {/* 2단 서브탭 */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveSection('textbook')}
          className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
            activeSection === 'textbook' ? 'bg-[#081429] text-white' : 'bg-gray-100 text-[#373d41] hover:bg-gray-200'
          }`}>
          교재 단가 ({textbookItems.length})
        </button>
        <button onClick={() => setActiveSection('service')}
          className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
            activeSection === 'service' ? 'bg-[#081429] text-white' : 'bg-gray-100 text-[#373d41] hover:bg-gray-200'
          }`}>
          기타 항목 ({extras.length})
        </button>
      </div>

      {/* 교재 섹션 (읽기전용 - 교재 관리 탭 연동) */}
      {activeSection === 'textbook' && (
        <>
          <p className="text-sm text-[#373d41] mb-3">* 교재 단가는 교재 관리 탭에서 관리됩니다.</p>
          <div className="flex-1 overflow-auto border border-[#373d41]/20 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-[#081429] sticky top-0 z-10">
                <tr>
                  <th className="p-3 w-[60%]">교재명</th>
                  <th className="p-3 w-[40%] text-right">단가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#373d41]/10">
                {textbookItems.map(item => (
                  <tr key={item.id} className="hover:bg-[#fdb813]/10 transition-colors">
                    <td className="p-3">{item.name}</td>
                    <td className="p-3 text-right font-medium">{item.defaultPrice.toLocaleString()}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-sm text-[#373d41]/60 text-right">총 {textbookItems.length}개 교재</div>
        </>
      )}

      {/* 기타 항목 섹션 (편집 가능) */}
      {activeSection === 'service' && (
        <>
          {showAdd && canManage && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border flex gap-2 items-end flex-wrap">
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs text-gray-500 block mb-1">항목명</label>
                <input type="text" value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-2 py-1.5 border rounded text-sm" placeholder="항목명 입력" />
              </div>
              <div className="w-24">
                <label className="text-xs text-gray-500 block mb-1">분류</label>
                <select value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}
                  className="w-full px-2 py-1.5 border rounded text-sm">
                  {EXTRA_CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="w-28">
                <label className="text-xs text-gray-500 block mb-1">단가</label>
                <input type="number" value={newItem.defaultPrice} onChange={e => setNewItem(p => ({ ...p, defaultPrice: Number(e.target.value) }))}
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
                  <th className="p-3 w-[15%]">분류</th>
                  <th className="p-3 w-[40%]">항목명</th>
                  <th className="p-3 w-[25%] text-right">기본 단가</th>
                  {canManage && <th className="p-3 w-[20%] text-center">관리</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#373d41]/10">
                {extras.map(item => (
                  <tr key={item.id} className="hover:bg-[#fdb813]/10 transition-colors">
                    <td className="p-3 text-[#373d41]">
                      {editingId === item.id ? (
                        <select value={editData.category} onChange={e => setEditData(p => ({ ...p, category: e.target.value }))}
                          className="w-full px-1 py-1 border border-[#fdb813] rounded text-sm">
                          {EXTRA_CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (TUITION_EXTRA_CATEGORY_LABELS[item.category] || item.category)}
                    </td>
                    <td className="p-3">
                      {editingId === item.id ? (
                        <input type="text" value={editData.name} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))}
                          className="w-full px-2 py-1 border border-[#fdb813] rounded text-sm" autoFocus />
                      ) : item.name}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {editingId === item.id ? (
                        <input type="number" value={editData.defaultPrice} onChange={e => setEditData(p => ({ ...p, defaultPrice: Number(e.target.value) }))}
                          className="w-full px-2 py-1 border border-[#fdb813] rounded text-right text-sm"
                          onKeyDown={e => e.key === 'Enter' && handleSave(item)} />
                      ) : (<>{item.defaultPrice.toLocaleString()}원</>)}
                    </td>
                    {canManage && (
                      <td className="p-3 text-center">
                        {editingId === item.id ? (
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => handleSave(item)} disabled={isUpdating} className="p-1 text-green-600 hover:bg-green-50 rounded">
                              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-50 rounded"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => startEdit(item)} className="p-1 text-[#081429] hover:bg-gray-100 rounded"><Edit3 className="w-4 h-4" /></button>
                            {onDeleteExtra && (
                              <button onClick={() => { if (confirm(`"${item.name}" 삭제?`)) onDeleteExtra(item.id); }}
                                className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
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
            총 {extras.length}개 항목{isEmpty && ' (하드코딩 폴백)'}
          </div>
        </>
      )}
    </div>
  );
};
