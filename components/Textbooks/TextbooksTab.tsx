import React, { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { UserProfile } from '../../types';
import { useTextbooks } from '../../hooks/useTextbooks';
import { useTextbookRequests } from '../../hooks/useTextbookRequests';
import { usePermissions } from '../../hooks/usePermissions';
import { TextbookCatalogItem } from '../../data/textbookCatalog';
import { Search, BookOpen, UserCheck, UserX, ChevronLeft, ChevronRight, FileText, FileSpreadsheet, Check, X, Plus, Trash2 } from 'lucide-react';

const TextbookRequestView = lazy(() => import('./TextbookRequestView'));

interface TextbooksTabProps {
  currentUser?: UserProfile | null;
}

export default function TextbooksTab({ currentUser }: TextbooksTabProps) {
  const { billings, billingsLoading } = useTextbooks();
  const { catalog, saveCatalog, requests } = useTextbookRequests();
  const { hasPermission } = usePermissions(currentUser ?? null);
  const isAdmin = hasPermission('textbooks.admin');
  const incompleteRequestCount = useMemo(
    () => requests.filter(r => !r.isCompleted || !r.isPaid || !r.isOrdered).length,
    [requests]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('수학');
  const [viewMode, setViewMode] = useState<'list' | 'billing' | 'request' | 'history'>('list');
  const [billingMonthFilter, setBillingMonthFilter] = useState<string>('all');
  const [billingPage, setBillingPage] = useState(1);
  const PAGE_SIZE = 30;

  // 인라인 편집 상태
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; price: number; subject: string }>({ name: '', price: 0, subject: '수학' });

  const subjects = useMemo(() => {
    const set = new Set(catalog.map(item => item.subject || '수학'));
    return ['all', ...Array.from(set).sort()];
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter(item => {
      const itemSubject = item.subject || '수학';
      if (subjectFilter !== 'all' && itemSubject !== subjectFilter) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.grade.toLowerCase().includes(q) || item.difficulty.toLowerCase().includes(q);
      }
      return true;
    });
  }, [catalog, categoryFilter, subjectFilter, searchQuery]);

  const filteredBillings = useMemo(() => {
    let list = billings;
    if (billingMonthFilter !== 'all') list = list.filter(b => b.month === billingMonthFilter);
    if (searchQuery) list = list.filter(b =>
      b.studentName.includes(searchQuery) || b.textbookName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return list;
  }, [billings, billingMonthFilter, searchQuery]);

  useEffect(() => {
    setBillingPage(1);
  }, [billingMonthFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredBillings.length / PAGE_SIZE));
  const pagedBillings = filteredBillings.slice((billingPage - 1) * PAGE_SIZE, billingPage * PAGE_SIZE);

  const billingMonths = useMemo(() => {
    const months = [...new Set(billings.map(b => b.month))].sort().reverse();
    return months;
  }, [billings]);

  const handleStartEdit = useCallback((item: TextbookCatalogItem, catalogIndex: number) => {
    setEditingIdx(catalogIndex);
    setEditForm({ name: item.name, price: item.price, subject: item.subject || '수학' });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (editingIdx === null) return;
    const updated = catalog.map((item, i) =>
      i === editingIdx ? { ...item, name: editForm.name, price: editForm.price, subject: editForm.subject } : item
    );
    try {
      await saveCatalog.mutateAsync(updated);
    } catch (err) {
      console.error('카탈로그 저장 실패:', err);
      alert('저장에 실패했습니다.');
    }
    setEditingIdx(null);
  }, [editingIdx, editForm, catalog, saveCatalog]);

  const handleCancelEdit = useCallback(() => {
    setEditingIdx(null);
    setAddingNew(false);
  }, []);

  // 교재 추가
  const [addingNew, setAddingNew] = useState(false);
  const [addForm, setAddForm] = useState({ subject: '수학', grade: '', difficulty: '기본', name: '', price: 0 });

  const handleAddStart = useCallback(() => {
    setAddingNew(true);
    setAddForm({ subject: subjectFilter === 'all' ? '수학' : subjectFilter, grade: '', difficulty: '기본', name: '', price: 0 });
    setEditingIdx(null);
  }, [subjectFilter]);

  const handleAddSave = useCallback(async () => {
    if (!addForm.name.trim() || !addForm.grade.trim()) {
      alert('교재명과 학년을 입력해주세요.');
      return;
    }
    const category: 'elementary' | 'middle' | 'high' =
      addForm.grade.startsWith('초') ? 'elementary' :
      addForm.grade.startsWith('중') ? 'middle' : 'high';
    const newItem: TextbookCatalogItem = {
      subject: addForm.subject,
      grade: addForm.grade,
      difficulty: addForm.difficulty,
      name: addForm.name.trim(),
      price: addForm.price,
      category,
    };
    try {
      await saveCatalog.mutateAsync([...catalog, newItem]);
      setAddingNew(false);
    } catch (err) {
      console.error('교재 추가 실패:', err);
      alert('저장에 실패했습니다.');
    }
  }, [addForm, catalog, saveCatalog]);

  // 교재 삭제
  const handleDelete = useCallback(async (catalogIndex: number) => {
    const item = catalog[catalogIndex];
    if (!confirm(`"${item.name}" 교재를 삭제하시겠습니까?`)) return;
    try {
      await saveCatalog.mutateAsync(catalog.filter((_, i) => i !== catalogIndex));
    } catch (err) {
      console.error('교재 삭제 실패:', err);
      alert('삭제에 실패했습니다.');
    }
  }, [catalog, saveCatalog]);

  // filteredCatalog → catalog 원본 인덱스 매핑
  const catalogIndexMap = useMemo(() => {
    const map: number[] = [];
    catalog.forEach((item, i) => {
      const itemSubject = item.subject || '수학';
      if (subjectFilter !== 'all' && itemSubject !== subjectFilter) return;
      const match = categoryFilter === 'all' || item.category === categoryFilter;
      if (!match) return;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!item.name.toLowerCase().includes(q) && !item.grade.toLowerCase().includes(q) && !item.difficulty.toLowerCase().includes(q)) return;
      }
      map.push(i);
    });
    return map;
  }, [catalog, categoryFilter, subjectFilter, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900">교재 관리</h1>
          <span className="text-xxs text-gray-400">{catalog.length}개 교재</span>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 bg-gray-100 rounded p-0.5">
            <button onClick={() => setViewMode('list')} className={`px-2 py-1 text-xs rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}>교재 목록</button>
            <button onClick={() => setViewMode('request')} className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${viewMode === 'request' ? 'bg-white shadow-sm' : ''}`}>
              <FileText size={12} /> 교재 요청
            </button>
            <button onClick={() => setViewMode('billing')} className={`px-2 py-1 text-xs rounded ${viewMode === 'billing' ? 'bg-white shadow-sm' : ''}`}>
              수납 내역{billings.length > 0 && <span className="ml-1 text-xxs text-gray-400">{billings.length}</span>}
            </button>
            <button onClick={() => setViewMode('history')} className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${viewMode === 'history' ? 'bg-white shadow-sm' : ''}`}>
              요청 내역
              {incompleteRequestCount > 0 && (
                <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">{incompleteRequestCount}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {(viewMode === 'list' || viewMode === 'billing') && <div className="bg-white border-b px-4 py-2 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder={viewMode === 'billing' ? '학생명, 교재명 검색...' : '교재명, 학년, 난이도 검색...'} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        {viewMode === 'billing' ? (
          <div className="flex gap-1">
            <button onClick={() => setBillingMonthFilter('all')}
              className={`px-2.5 py-1 text-xs rounded ${billingMonthFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              전체
            </button>
            {billingMonths.slice(0, 6).map(m => (
              <button key={m} onClick={() => setBillingMonthFilter(m)}
                className={`px-2.5 py-1 text-xs rounded ${billingMonthFilter === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {m.slice(0, 4)}.{m.slice(4)}
              </button>
            ))}
          </div>
        ) : (
          <>
          <div className="flex gap-1">
            {subjects.map(s => (
              <button key={s} onClick={() => setSubjectFilter(s)}
                className={`px-2.5 py-1 text-xs rounded ${subjectFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s === 'all' ? '전체과목' : s}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-gray-300" />
          <div className="flex gap-1">
            {(['all', 'elementary', 'middle', 'high'] as const).map(c => (
              <button key={c} onClick={() => setCategoryFilter(c)}
                className={`px-2.5 py-1 text-xs rounded ${categoryFilter === c ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {c === 'all' ? '전체' : c === 'elementary' ? '초등' : c === 'middle' ? '중등' : '고등'}
              </button>
            ))}
          </div>
          {isAdmin && (
            <>
              <div className="w-px h-5 bg-gray-300" />
              <button onClick={handleAddStart} className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap">
                <Plus size={13} /> 교재 추가
              </button>
            </>
          )}
          </>
        )}
      </div>}

      <div className={`flex-1 overflow-auto ${viewMode === 'request' || viewMode === 'history' ? '' : 'p-4'}`}>
        {viewMode === 'request' ? (
          <Suspense fallback={<div className="text-center text-gray-400 text-sm py-8">로딩 중...</div>}>
            <TextbookRequestView isAdmin={isAdmin} initialTab="create" onRequestCreated={() => setViewMode('history')} />
          </Suspense>
        ) : viewMode === 'history' ? (
          <Suspense fallback={<div className="text-center text-gray-400 text-sm py-8">로딩 중...</div>}>
            <TextbookRequestView isAdmin={isAdmin} initialTab="history" />
          </Suspense>
        ) : viewMode === 'list' ? (
          filteredCatalog.length === 0 ? (
            <div className="text-center text-gray-400 py-8"><BookOpen size={32} className="mx-auto mb-2" /><p className="text-sm">교재가 없습니다</p></div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">과목</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">학년</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-600">난이도</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">교재명</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">가격</th>
                    {isAdmin && <th className="px-3 py-2 text-center font-medium text-gray-600 w-20">관리</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* 교재 추가 입력 행 (최상단) */}
                  {addingNew && (
                    <tr className="bg-blue-50/50 border-b-2 border-blue-200">
                      <td className="px-3 py-2">
                        <input type="text" value={addForm.subject} onChange={e => setAddForm(f => ({ ...f, subject: e.target.value }))}
                          className="w-16 px-1.5 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="과목" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" value={addForm.grade} onChange={e => setAddForm(f => ({ ...f, grade: e.target.value }))}
                          className="w-16 px-1.5 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="예: 초4" autoFocus />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <select value={addForm.difficulty} onChange={e => setAddForm(f => ({ ...f, difficulty: e.target.value }))}
                          className="px-1.5 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500">
                          <option value="기본">기본</option>
                          <option value="발전">발전</option>
                          <option value="심화">심화</option>
                          <option value="최상위">최상위</option>
                          <option value="개념연산">개념연산</option>
                          <option value="정규반">정규반</option>
                          <option value="교재">교재</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full px-1.5 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="교재명 입력" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={addForm.price} onChange={e => setAddForm(f => ({ ...f, price: Number(e.target.value) }))}
                          className="w-24 px-1.5 py-0.5 text-xs border rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="가격" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={handleAddSave} className="p-0.5 rounded text-emerald-600 hover:bg-emerald-50" title="추가">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setAddingNew(false)} className="p-0.5 rounded text-gray-400 hover:bg-gray-100" title="취소">
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {filteredCatalog.map((item, i) => {
                    const origIdx = catalogIndexMap[i];
                    const isEditing = editingIdx === origIdx;
                    return (
                      <tr key={`${item.name}-${i}`} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.subject}
                              onChange={e => setEditForm(f => ({ ...f, subject: e.target.value }))}
                              className="w-16 px-1.5 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="text-xxs px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-medium">{item.subject || '수학'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xxs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">{item.grade}</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xxs px-1.5 py-0.5 rounded font-medium ${
                            item.difficulty === '심화' ? 'bg-red-100 text-red-700' :
                            item.difficulty === '발전' ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>{item.difficulty}</span>
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                              className="w-full px-1.5 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              autoFocus
                            />
                          ) : item.name}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.price}
                              onChange={e => setEditForm(f => ({ ...f, price: Number(e.target.value) }))}
                              className="w-24 px-1.5 py-0.5 text-xs border rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : `${item.price.toLocaleString()}원`}
                        </td>
                        {isAdmin && (
                          <td className="px-3 py-2 text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={handleSaveEdit} className="p-0.5 rounded text-emerald-600 hover:bg-emerald-50" title="저장">
                                  <Check size={14} />
                                </button>
                                <button onClick={handleCancelEdit} className="p-0.5 rounded text-gray-400 hover:bg-gray-100" title="취소">
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => handleStartEdit(item, origIdx)} className="text-xxs text-blue-600 hover:underline">수정</button>
                                <button onClick={() => handleDelete(origIdx)} className="p-0.5 rounded text-red-400 hover:bg-red-50 hover:text-red-600" title="삭제">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : viewMode === 'billing' ? (
          billingsLoading ? (
            <div className="text-center text-gray-400 text-sm py-8">로딩 중...</div>
          ) : filteredBillings.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <FileSpreadsheet size={32} className="mx-auto mb-2" />
              <p className="text-sm">수납 내역이 없습니다</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-center font-medium text-gray-600 w-8">매칭</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">이름</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">학년</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">학교</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">수납명</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">청구액</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-600">청구월</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedBillings.map(b => (
                    <tr key={b.id} className={`hover:bg-gray-50 ${!b.matched ? 'bg-amber-50/50' : ''}`}>
                      <td className="px-3 py-2 text-center">
                        {b.matched
                          ? <UserCheck className="w-3.5 h-3.5 text-emerald-500 inline" />
                          : <UserX className="w-3.5 h-3.5 text-amber-400 inline" />}
                      </td>
                      <td className="px-3 py-2 font-medium">{b.studentName}</td>
                      <td className="px-3 py-2">{b.grade}</td>
                      <td className="px-3 py-2">{b.school}</td>
                      <td className="px-3 py-2">{b.textbookName}</td>
                      <td className="px-3 py-2 text-right">{b.amount.toLocaleString()}원</td>
                      <td className="px-3 py-2 text-center">
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xxs">
                          {b.month.slice(0, 4)}.{b.month.slice(4)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50">
                  <span className="text-xxs text-gray-500">
                    총 {filteredBillings.length.toLocaleString()}건 중 {(billingPage - 1) * PAGE_SIZE + 1}-{Math.min(billingPage * PAGE_SIZE, filteredBillings.length)}건
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setBillingPage(p => Math.max(1, p - 1))}
                      disabled={billingPage === 1}
                      className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let page: number;
                      if (totalPages <= 7) {
                        page = i + 1;
                      } else if (billingPage <= 4) {
                        page = i + 1;
                      } else if (billingPage >= totalPages - 3) {
                        page = totalPages - 6 + i;
                      } else {
                        page = billingPage - 3 + i;
                      }
                      return (
                        <button
                          key={page}
                          onClick={() => setBillingPage(page)}
                          className={`min-w-[24px] h-6 text-xs rounded ${billingPage === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 text-gray-600'}`}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setBillingPage(p => Math.min(totalPages, p + 1))}
                      disabled={billingPage === totalPages}
                      className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        ) : null}
      </div>

    </div>
  );
}
