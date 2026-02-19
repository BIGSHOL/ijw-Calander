import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile } from '../../types';
import { useTextbooks } from '../../hooks/useTextbooks';
import { useStudents } from '../../hooks/useStudents';
import { Search, Plus, BookOpen, Package, AlertTriangle, FileSpreadsheet, UserCheck, UserX, ChevronLeft, ChevronRight } from 'lucide-react';
import { TextbookImportModal, TextbookImportRow } from './TextbookImportModal';

interface TextbooksTabProps {
  currentUser?: UserProfile | null;
}

export default function TextbooksTab({ currentUser }: TextbooksTabProps) {
  const { textbooks, distributions, billings, isLoading, billingsLoading, createTextbook, updateTextbook, deleteTextbook, importBillings } = useTextbooks();
  const { students } = useStudents();
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'distribution' | 'billing'>('list');
  const [showImportModal, setShowImportModal] = useState(false);
  const [billingMonthFilter, setBillingMonthFilter] = useState<string>('all');
  const [billingPage, setBillingPage] = useState(1);
  const PAGE_SIZE = 30;

  const studentIds = useMemo(() => new Set(students.map(s => s.id)), [students]);

  const filteredTextbooks = useMemo(() => {
    if (!textbooks) return [];
    return textbooks.filter(t => {
      if (subjectFilter !== 'all' && t.subject !== subjectFilter) return false;
      if (searchQuery) return t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.publisher.toLowerCase().includes(searchQuery.toLowerCase());
      return true;
    });
  }, [textbooks, subjectFilter, searchQuery]);

  const filteredBillings = useMemo(() => {
    let list = billings;
    if (billingMonthFilter !== 'all') list = list.filter(b => b.month === billingMonthFilter);
    if (searchQuery) list = list.filter(b =>
      b.studentName.includes(searchQuery) || b.textbookName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return list;
  }, [billings, billingMonthFilter, searchQuery]);

  // 필터 변경 시 페이지 리셋 (useMemo 내부에서 setState 호출하면 무한루프)
  useEffect(() => {
    setBillingPage(1);
  }, [billingMonthFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredBillings.length / PAGE_SIZE));
  const pagedBillings = filteredBillings.slice((billingPage - 1) * PAGE_SIZE, billingPage * PAGE_SIZE);

  const billingMonths = useMemo(() => {
    const months = [...new Set(billings.map(b => b.month))].sort().reverse();
    return months;
  }, [billings]);

  const lowStockCount = useMemo(() =>
    textbooks?.filter(t => t.stock <= t.minStock).length ?? 0
  , [textbooks]);

  const handleImport = async (rows: TextbookImportRow[]) => {
    return importBillings.mutateAsync(rows.map(({ studentName, grade, school, textbookName, amount, month, studentId, matched }) => ({
      studentId,
      studentName,
      grade,
      school,
      textbookName,
      amount,
      month,
      matched,
    })));
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900">교재 관리</h1>
          {lowStockCount > 0 && (
            <span className="flex items-center gap-1 text-xxs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
              <AlertTriangle size={10} /> 재고 부족 {lowStockCount}건
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 bg-gray-100 rounded p-0.5">
            <button onClick={() => setViewMode('list')} className={`px-2 py-1 text-xs rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}>교재 목록</button>
            <button onClick={() => setViewMode('distribution')} className={`px-2 py-1 text-xs rounded ${viewMode === 'distribution' ? 'bg-white shadow-sm' : ''}`}>배부 이력</button>
            <button onClick={() => setViewMode('billing')} className={`px-2 py-1 text-xs rounded ${viewMode === 'billing' ? 'bg-white shadow-sm' : ''}`}>
              수납 내역{billings.length > 0 && <span className="ml-1 text-xxs text-gray-400">{billings.length}</span>}
            </button>
          </div>
          <button onClick={() => setShowImportModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700">
            <FileSpreadsheet size={14} /> xlsx 가져오기
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700">
            <Plus size={14} /> 교재 추가
          </button>
        </div>
      </div>

      <div className="bg-white border-b px-4 py-2 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder={viewMode === 'billing' ? '학생명, 교재명 검색...' : '교재명, 출판사 검색...'} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
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
          <div className="flex gap-1">
            {['all', 'math', 'english', 'science', 'korean'].map(s => (
              <button key={s} onClick={() => setSubjectFilter(s)}
                className={`px-2.5 py-1 text-xs rounded ${subjectFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s === 'all' ? '전체' : s === 'math' ? '수학' : s === 'english' ? '영어' : s === 'science' ? '과학' : '국어'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center text-gray-400 text-sm py-8">로딩 중...</div>
        ) : viewMode === 'list' ? (
          filteredTextbooks.length === 0 ? (
            <div className="text-center text-gray-400 py-8"><BookOpen size={32} className="mx-auto mb-2" /><p className="text-sm">등록된 교재가 없습니다</p></div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {filteredTextbooks.map(tb => (
                <div key={tb.id} className={`bg-white rounded-lg border p-3 ${tb.stock <= tb.minStock ? 'border-amber-300' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-sm font-semibold text-gray-900">{tb.name}</h3>
                    <span className="text-xxs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                      {tb.subject === 'math' ? '수학' : tb.subject === 'english' ? '영어' : tb.subject}
                    </span>
                  </div>
                  <div className="text-xxs text-gray-500">{tb.publisher}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-medium">{tb.price.toLocaleString()}원</span>
                    <div className="flex items-center gap-1">
                      <Package size={12} className={tb.stock <= tb.minStock ? 'text-amber-500' : 'text-gray-400'} />
                      <span className={`text-xs font-bold ${tb.stock <= tb.minStock ? 'text-amber-600' : 'text-gray-700'}`}>
                        재고 {tb.stock}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : viewMode === 'billing' ? (
          billingsLoading ? (
            <div className="text-center text-gray-400 text-sm py-8">로딩 중...</div>
          ) : filteredBillings.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <FileSpreadsheet size={32} className="mx-auto mb-2" />
              <p className="text-sm">수납 내역이 없습니다</p>
              <button onClick={() => setShowImportModal(true)} className="mt-2 text-xs text-emerald-600 hover:underline">xlsx 파일로 가져오기</button>
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
              {/* 페이지네이션 */}
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
        ) : (
          <div className="text-center text-gray-400 py-8"><Package size={32} className="mx-auto mb-2" /><p className="text-sm">배부 이력이 없습니다</p></div>
        )}
      </div>

      <TextbookImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        studentIds={studentIds}
      />
    </div>
  );
}
