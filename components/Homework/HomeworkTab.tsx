import React, { useState, useMemo } from 'react';
import { UserProfile } from '../../types';
import { useHomework } from '../../hooks/useHomework';
import { Search, Plus, BookOpen, CheckSquare, Clock, AlertCircle } from 'lucide-react';

interface HomeworkTabProps {
  currentUser?: UserProfile | null;
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700',
  closed: 'bg-gray-100 text-gray-600',
};

export default function HomeworkTab({ currentUser }: HomeworkTabProps) {
  const { homeworkList, isLoading, createHomework, updateHomework, deleteHomework } = useHomework();

  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const filteredList = useMemo(() => {
    if (!homeworkList) return [];
    return homeworkList
      .filter(hw => {
        if (subjectFilter !== 'all' && hw.subject !== subjectFilter) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return hw.title.toLowerCase().includes(q) || hw.className.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => new Date(b.assignedDate).getTime() - new Date(a.assignedDate).getTime());
  }, [homeworkList, subjectFilter, searchQuery]);

  const isDueSoon = (dueDate: string) => {
    const diff = new Date(dueDate).getTime() - Date.now();
    return diff > 0 && diff < 2 * 24 * 60 * 60 * 1000;
  };

  const isOverdue = (dueDate: string) => new Date(dueDate).getTime() < Date.now();

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">숙제 관리</h1>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
        >
          <Plus size={14} />
          숙제 출제
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="숙제명, 수업명 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1">
          {['all', 'math', 'english', 'science', 'korean'].map(s => (
            <button
              key={s}
              onClick={() => setSubjectFilter(s)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                subjectFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? '전체' : s === 'math' ? '수학' : s === 'english' ? '영어' : s === 'science' ? '과학' : '국어'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center text-gray-400 text-sm py-8">로딩 중...</div>
        ) : filteredList.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <BookOpen size={32} className="mx-auto mb-2" />
            <p className="text-sm">출제된 숙제가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredList.map(hw => (
              <div key={hw.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xxs px-1.5 py-0.5 rounded ${STATUS_STYLES[hw.status]}`}>
                        {hw.status === 'active' ? '진행 중' : '마감'}
                      </span>
                      <span className="text-xxs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                        {hw.subject === 'math' ? '수학' : hw.subject === 'english' ? '영어' : hw.subject}
                      </span>
                      {hw.status === 'active' && isOverdue(hw.dueDate) && (
                        <span className="flex items-center gap-0.5 text-xxs text-red-600">
                          <AlertCircle size={10} /> 마감 초과
                        </span>
                      )}
                      {hw.status === 'active' && isDueSoon(hw.dueDate) && !isOverdue(hw.dueDate) && (
                        <span className="flex items-center gap-0.5 text-xxs text-amber-600">
                          <Clock size={10} /> 마감 임박
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">{hw.title}</h3>
                    <div className="text-xxs text-gray-500 mt-1">
                      {hw.className} | {hw.assignedByName} | 마감: {new Date(hw.dueDate).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xxs text-gray-400">
                    <CheckSquare size={12} />
                    제출 현황
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
