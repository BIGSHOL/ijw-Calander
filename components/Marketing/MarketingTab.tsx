import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { useMarketing } from '../../hooks/useMarketing';
import { Search, Plus, Megaphone, Target, TrendingUp, Calendar } from 'lucide-react';

interface MarketingTabProps {
  currentUser?: UserProfile | null;
}

type ViewMode = 'leads' | 'trials' | 'promotions';

export default function MarketingTab({ currentUser }: MarketingTabProps) {
  const { leads, trialClasses, promotions, isLoading } = useMarketing();
  const [viewMode, setViewMode] = useState<ViewMode>('leads');

  const tabs: { id: ViewMode; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'leads', label: '유입 경로', icon: <Target size={14} />, count: leads?.length },
    { id: 'trials', label: '체험 수업', icon: <Calendar size={14} />, count: trialClasses?.length },
    { id: 'promotions', label: '프로모션', icon: <Megaphone size={14} />, count: promotions?.length },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-gray-900">마케팅</h1>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700">
            <Plus size={14} />
            {viewMode === 'leads' ? '유입 경로 추가' : viewMode === 'trials' ? '체험 수업 등록' : '프로모션 생성'}
          </button>
        </div>
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setViewMode(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {tab.icon} {tab.label}
              {tab.count !== undefined && <span className="ml-1 text-xxs opacity-75">({tab.count})</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center text-gray-400 text-sm py-8">로딩 중...</div>
        ) : (
          <>
            {viewMode === 'leads' && (
              !leads || leads.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <Target size={32} className="mx-auto mb-2" />
                  <p className="text-sm">유입 경로 데이터가 없습니다</p>
                  <p className="text-xs mt-1">학생 등록 시 유입 경로를 기록하면 여기에 통계가 표시됩니다</p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {leads.map(lead => (
                    <div key={lead.id} className="bg-white rounded-lg border border-gray-200 p-4">
                      <h3 className="text-sm font-bold text-gray-900 mb-1">{lead.source}</h3>
                      <div className="flex items-center justify-between">
                        <span className="text-xxs text-gray-500">{lead.count}건</span>
                        <span className="text-xs font-bold text-blue-600">{lead.conversionRate}% 전환</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {viewMode === 'trials' && (
              <div className="text-center text-gray-400 py-8">
                <Calendar size={32} className="mx-auto mb-2" />
                <p className="text-sm">체험 수업 일정이 없습니다</p>
              </div>
            )}

            {viewMode === 'promotions' && (
              <div className="text-center text-gray-400 py-8">
                <Megaphone size={32} className="mx-auto mb-2" />
                <p className="text-sm">진행 중인 프로모션이 없습니다</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
