import React, { useState, useMemo } from 'react';
import { UserProfile } from '../../types';
import { useTextbooks } from '../../hooks/useTextbooks';
import { Search, Plus, BookOpen, Package, AlertTriangle } from 'lucide-react';

interface TextbooksTabProps {
  currentUser?: UserProfile | null;
}

export default function TextbooksTab({ currentUser }: TextbooksTabProps) {
  const { textbooks, distributions, isLoading, createTextbook, updateTextbook, deleteTextbook } = useTextbooks();
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'distribution'>('list');

  const filteredTextbooks = useMemo(() => {
    if (!textbooks) return [];
    return textbooks.filter(t => {
      if (subjectFilter !== 'all' && t.subject !== subjectFilter) return false;
      if (searchQuery) return t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.publisher.toLowerCase().includes(searchQuery.toLowerCase());
      return true;
    });
  }, [textbooks, subjectFilter, searchQuery]);

  const lowStockCount = useMemo(() =>
    textbooks?.filter(t => t.stock <= t.minStock).length ?? 0
  , [textbooks]);

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
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700">
            <Plus size={14} /> 교재 추가
          </button>
        </div>
      </div>

      <div className="bg-white border-b px-4 py-2 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="교재명, 출판사 검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div className="flex gap-1">
          {['all', 'math', 'english', 'science', 'korean'].map(s => (
            <button key={s} onClick={() => setSubjectFilter(s)}
              className={`px-2.5 py-1 text-xs rounded ${subjectFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s === 'all' ? '전체' : s === 'math' ? '수학' : s === 'english' ? '영어' : s === 'science' ? '과학' : '국어'}
            </button>
          ))}
        </div>
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
        ) : (
          <div className="text-center text-gray-400 py-8"><Package size={32} className="mx-auto mb-2" /><p className="text-sm">배부 이력이 없습니다</p></div>
        )}
      </div>
    </div>
  );
}
