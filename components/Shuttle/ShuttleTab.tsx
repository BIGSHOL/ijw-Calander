import React, { useState, useMemo } from 'react';
import { UserProfile } from '../../types';
import { useShuttle } from '../../hooks/useShuttle';
import { Search, Plus, Bus, MapPin, Users, Clock } from 'lucide-react';

interface ShuttleTabProps {
  currentUser?: UserProfile | null;
}

export default function ShuttleTab({ currentUser }: ShuttleTabProps) {
  const { routes, assignments, isLoading } = useShuttle();
  const [viewMode, setViewMode] = useState<'routes' | 'assignments'>('routes');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRoutes = useMemo(() => {
    if (!routes) return [];
    if (!searchQuery) return routes;
    return routes.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [routes, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">셔틀 관리</h1>
        <div className="flex gap-2">
          <div className="flex gap-1 bg-gray-100 rounded p-0.5">
            <button onClick={() => setViewMode('routes')} className={`px-2 py-1 text-xs rounded ${viewMode === 'routes' ? 'bg-white shadow-sm' : ''}`}>노선</button>
            <button onClick={() => setViewMode('assignments')} className={`px-2 py-1 text-xs rounded ${viewMode === 'assignments' ? 'bg-white shadow-sm' : ''}`}>배정</button>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700">
            <Plus size={14} /> {viewMode === 'routes' ? '노선 추가' : '학생 배정'}
          </button>
        </div>
      </div>

      <div className="bg-white border-b px-4 py-2">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="노선명, 학생명 검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center text-gray-400 text-sm py-8">로딩 중...</div>
        ) : viewMode === 'routes' ? (
          filteredRoutes.length === 0 ? (
            <div className="text-center text-gray-400 py-8"><Bus size={32} className="mx-auto mb-2" /><p className="text-sm">등록된 셔틀 노선이 없습니다</p></div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredRoutes.map(route => (
                <div key={route.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-gray-900">{route.name}</h3>
                    <span className={`text-xxs px-1.5 py-0.5 rounded ${route.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {route.isActive ? '운행 중' : '미운행'}
                    </span>
                  </div>
                  <div className="space-y-1 text-xxs text-gray-500">
                    <div className="flex items-center gap-1"><MapPin size={10} /> 정류장 {route.stops.length}개</div>
                    <div className="flex items-center gap-1"><Users size={10} /> 탑승 {route.studentCount}명</div>
                    <div className="flex items-center gap-1"><Clock size={10} /> {route.departureTime} 출발</div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="text-center text-gray-400 py-8"><Users size={32} className="mx-auto mb-2" /><p className="text-sm">학생 배정 내역이 없습니다</p></div>
        )}
      </div>
    </div>
  );
}
