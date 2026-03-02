import React, { useState, useMemo } from 'react';
import { useShuttle, BusRoute, BusStop } from '../../hooks/useShuttle';
import { Search, Bus, MapPin, Users, Clock, ChevronDown, ChevronRight, RefreshCw, ArrowUp, ArrowDown } from 'lucide-react';

export default function ShuttleTab() {
  const { busRoutes, isBusLoading } = useShuttle();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());
  const [expandedStops, setExpandedStops] = useState<Set<string>>(new Set());

  const filteredRoutes = useMemo(() => {
    if (!busRoutes || busRoutes.length === 0) return [];
    if (!searchQuery) return busRoutes;
    const q = searchQuery.toLowerCase();
    return busRoutes.filter(r => {
      if (r.busName.toLowerCase().includes(q)) return true;
      return r.stops.some(s =>
        s.destination.toLowerCase().includes(q) ||
        s.boardingStudents.some(st => st.name.toLowerCase().includes(q)) ||
        s.alightingStudents.some(st => st.name.toLowerCase().includes(q))
      );
    });
  }, [busRoutes, searchQuery]);

  const toggleRoute = (id: string) => {
    setExpandedRoutes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleStop = (key: string) => {
    setExpandedStops(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // 전체 통계
  const totalStats = useMemo(() => {
    const allStudentNames = new Set<string>();
    let totalBoarding = 0;
    let totalAlighting = 0;
    busRoutes.forEach(r => {
      totalBoarding += r.totalBoardingCount;
      totalAlighting += r.totalAlightingCount;
      r.stops.forEach(s => {
        s.boardingStudents.forEach(st => allStudentNames.add(st.name));
        s.alightingStudents.forEach(st => allStudentNames.add(st.name));
      });
    });
    return { uniqueStudents: allStudentNames.size, totalBoarding, totalAlighting };
  }, [busRoutes]);

  const syncedAt = busRoutes.length > 0 ? busRoutes[0].syncedAt : null;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bus size={20} className="text-blue-600" />
          <h1 className="text-lg font-bold text-gray-900">셔틀 버스 관리</h1>
          {syncedAt && (
            <span className="text-[10px] text-gray-400 ml-2">
              마지막 동기화: {new Date(syncedAt).toLocaleString('ko-KR')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Bus size={12} /> {busRoutes.length}개 노선</span>
          <span className="flex items-center gap-1"><Users size={12} /> {totalStats.uniqueStudents}명</span>
        </div>
      </div>

      {/* 검색 */}
      <div className="bg-white border-b px-4 py-2">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="노선명, 정류장, 학생명 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-auto p-4">
        {isBusLoading ? (
          <div className="text-center text-gray-400 text-sm py-8">
            <RefreshCw size={24} className="mx-auto mb-2 animate-spin" />
            로딩 중...
          </div>
        ) : filteredRoutes.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <Bus size={40} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium mb-1">
              {searchQuery ? '검색 결과가 없습니다' : '등록된 버스 노선이 없습니다'}
            </p>
            <p className="text-xs text-gray-300">
              {!searchQuery && '메이크에듀 버스 페이지에서 크롬 확장프로그램을 통해 동기화하세요'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRoutes.map(route => (
              <BusRouteCard
                key={route.id}
                route={route}
                isExpanded={expandedRoutes.has(route.id)}
                expandedStops={expandedStops}
                searchQuery={searchQuery}
                onToggle={() => toggleRoute(route.id)}
                onToggleStop={toggleStop}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BusRouteCard({
  route,
  isExpanded,
  expandedStops,
  searchQuery,
  onToggle,
  onToggleStop,
}: {
  route: BusRoute;
  isExpanded: boolean;
  expandedStops: Set<string>;
  searchQuery: string;
  onToggle: () => void;
  onToggleStop: (key: string) => void;
}) {
  // 정류장별 학생 있는 곳만 표시 (확장 시 전체)
  const stopsWithStudents = route.stops.filter(
    s => s.boardingStudents.length > 0 || s.alightingStudents.length > 0
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* 노선 헤더 */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <Bus size={16} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">{route.busName}</h3>
            <p className="text-[10px] text-gray-400">
              정류장 {route.stops.length}개 · 학생 정류장 {stopsWithStudents.length}개
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <ArrowUp size={12} className="text-green-500" /> 승차 {route.totalBoardingCount}명
          </span>
          <span className="flex items-center gap-1">
            <ArrowDown size={12} className="text-orange-500" /> 하차 {route.totalAlightingCount}명
          </span>
        </div>
      </div>

      {/* 정류장 목록 */}
      {isExpanded && (
        <div className="border-t">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="px-3 py-2 text-left w-10">순서</th>
                <th className="px-3 py-2 text-left">행선지</th>
                <th className="px-3 py-2 text-center w-14">시간</th>
                <th className="px-3 py-2 text-left">승차</th>
                <th className="px-3 py-2 text-left">하차</th>
              </tr>
            </thead>
            <tbody>
              {route.stops.map((stop, idx) => {
                const stopKey = `${route.id}-${idx}`;
                const hasStudents = stop.boardingStudents.length > 0 || stop.alightingStudents.length > 0;
                const isStopExpanded = expandedStops.has(stopKey);

                return (
                  <tr
                    key={idx}
                    className={`border-t border-gray-100 ${hasStudents ? 'hover:bg-blue-50/50 cursor-pointer' : ''} ${highlightRow(stop, searchQuery) ? 'bg-yellow-50' : ''}`}
                    onClick={() => hasStudents && onToggleStop(stopKey)}
                  >
                    <td className="px-3 py-2 text-gray-400 text-center">{stop.order}</td>
                    <td className="px-3 py-2 text-gray-700 font-medium">{stop.destination}</td>
                    <td className="px-3 py-2 text-center text-gray-600">{stop.time}</td>
                    <td className="px-3 py-2">
                      <StudentList
                        students={stop.boardingStudents}
                        type="boarding"
                        expanded={isStopExpanded}
                        searchQuery={searchQuery}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <StudentList
                        students={stop.alightingStudents}
                        type="alighting"
                        expanded={isStopExpanded}
                        searchQuery={searchQuery}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function highlightRow(stop: BusStop, query: string): boolean {
  if (!query) return false;
  const q = query.toLowerCase();
  return (
    stop.destination.toLowerCase().includes(q) ||
    stop.boardingStudents.some(s => s.name.toLowerCase().includes(q)) ||
    stop.alightingStudents.some(s => s.name.toLowerCase().includes(q))
  );
}

function StudentList({
  students,
  type,
  expanded,
  searchQuery,
}: {
  students: { name: string; days: string }[];
  type: 'boarding' | 'alighting';
  expanded: boolean;
  searchQuery: string;
}) {
  if (students.length === 0) return <span className="text-gray-300">-</span>;

  const color = type === 'boarding' ? 'green' : 'orange';

  if (!expanded) {
    return (
      <span className={`text-${color}-600 font-medium`}>
        {students.length}명
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1 py-0.5">
      {students.map((s, i) => {
        const isHighlighted = searchQuery && s.name.toLowerCase().includes(searchQuery.toLowerCase());
        return (
          <span
            key={i}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] ${
              isHighlighted
                ? 'bg-yellow-200 text-yellow-900 font-bold'
                : type === 'boarding'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-orange-50 text-orange-700'
            }`}
          >
            {s.name}
            {s.days && (
              <span className="text-[9px] opacity-70">({s.days})</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
