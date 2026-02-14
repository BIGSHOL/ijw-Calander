import React, { useState, useMemo } from 'react';
import { UserProfile } from '../../types';
import { useExams } from '../../hooks/useExams';
import { Search, Plus, ClipboardList, Calendar, BarChart3 } from 'lucide-react';

interface ExamsTabProps {
  currentUser?: UserProfile | null;
}

type ViewMode = 'list' | 'calendar' | 'analysis';

export default function ExamsTab({ currentUser }: ExamsTabProps) {
  const { data: exams, isLoading } = useExams();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');

  const filteredExams = useMemo(() => {
    if (!exams) return [];
    return exams.filter(e => {
      if (subjectFilter !== 'all' && e.subject !== subjectFilter) return false;
      if (searchQuery) return e.title.toLowerCase().includes(searchQuery.toLowerCase());
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [exams, subjectFilter, searchQuery]);

  const tabs: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'list', label: '시험 목록', icon: <ClipboardList size={14} /> },
    { id: 'calendar', label: '시험 일정', icon: <Calendar size={14} /> },
    { id: 'analysis', label: '성적 분석', icon: <BarChart3 size={14} /> },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-gray-900">시험 관리</h1>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700">
            <Plus size={14} /> 시험 등록
          </button>
        </div>
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setViewMode(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border-b px-4 py-2 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="시험명 검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
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
          filteredExams.length === 0 ? (
            <div className="text-center text-gray-400 py-8"><ClipboardList size={32} className="mx-auto mb-2" /><p className="text-sm">등록된 시험이 없습니다</p></div>
          ) : (
            <div className="space-y-2">
              {filteredExams.map(exam => (
                <div key={exam.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xxs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">{exam.subject}</span>
                        <span className="text-xxs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{exam.type}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900">{exam.title}</h3>
                      <div className="text-xxs text-gray-500 mt-1">{new Date(exam.date).toLocaleDateString('ko-KR')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">만점: {exam.maxScore}점</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : viewMode === 'calendar' ? (
          <div className="text-center text-gray-400 py-8"><Calendar size={32} className="mx-auto mb-2" /><p className="text-sm">시험 캘린더 뷰</p></div>
        ) : (
          <div className="text-center text-gray-400 py-8"><BarChart3 size={32} className="mx-auto mb-2" /><p className="text-sm">성적 분석 영역</p></div>
        )}
      </div>
    </div>
  );
}
