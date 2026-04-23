import React, { useState, useMemo, useCallback } from 'react';
import { useShuttle, BusRoute, BusStop } from '../../hooks/useShuttle';
import { useStudents } from '../../hooks/useStudents';
import { useClasses } from '../../hooks/useClasses';
import { MATH_PERIOD_INFO, ENGLISH_PERIOD_INFO, WEEKEND_PERIOD_INFO, PeriodInfo } from '../Timetable/constants';
import { Search, Bus, Users, ChevronDown, ChevronRight, RefreshCw, ArrowUp, ArrowDown, Loader2, X, ArrowLeftRight, ArrowRight } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function ShuttleTab() {
  const { busRoutes, isBusLoading } = useShuttle();
  const { students } = useStudents();
  const { data: allClasses = [] } = useClasses();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());
  const [expandedStops, setExpandedStops] = useState<Set<string>>(new Set());
  const [showTransitSection, setShowTransitSection] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 강의실 이름으로 BS 여부 판별 (bs로 시작 또는 프리미엄/바른2 포함)
  const isBsRoom = useCallback((room: string) =>
    room.toLowerCase().startsWith('bs') || room.includes('프리미엄') || room.includes('바른2')
  , []);

  const [transitFilter, setTransitFilter] = useState<'all' | '본원→BS' | 'BS→본원'>('all');
  const DAY_ORDER = ['월', '화', '수', '목', '금', '토', '일'];

  // BS반 이동: 요일 + 시간대 + 방향별 학생 묶음 (셔틀 탑승 학생만)
  const transitByDay = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    // day → hour → direction → Set<name>
    const map: Record<string, Record<string, Record<string, Set<string>>>> = {};

    students.forEach(student => {
      const isOnShuttle = busRoutes.some(route =>
        route.stops.some(stop =>
          stop.boardingStudents.some(s => s.name === student.name)
        )
      );
      if (!isOnShuttle) return;

      const active = (student.enrollments || []).filter(e => {
        const endDate = (e as any).endDate || (e as any).withdrawalDate;
        const startDate = (e as any).enrollmentDate || e.startDate;
        const hasEnded = endDate ? endDate < today : false;
        const hasStarted = !startDate || startDate <= today;
        return !hasEnded && hasStarted && !e.onHold;
      });

      const dayBlocks: Record<string, Array<{ className: string; room: string; startTime: string; endTime: string }>> = {};

      active.forEach(enrollment => {
        const actualClass = allClasses.find(c => c.className === enrollment.className && c.subject === enrollment.subject);
        if (!actualClass?.schedule) return;
        const room = actualClass.room || '';
        const studentDays = (enrollment as any).attendanceDays?.length > 0
          ? (enrollment as any).attendanceDays as string[] : null;

        actualClass.schedule.forEach(slot => {
          const parts = slot.split(' ');
          const day = parts[0], periodId = parts[1];
          if (!day || !periodId) return;
          if (studentDays && !studentDays.includes(day)) return;

          const isWeekend = day === '토' || day === '일';
          const periodInfo: Record<string, PeriodInfo> = isWeekend
            ? WEEKEND_PERIOD_INFO
            : enrollment.subject === 'english' ? ENGLISH_PERIOD_INFO : MATH_PERIOD_INFO;
          const period = periodInfo[periodId];
          if (!period) return;

          if (!dayBlocks[day]) dayBlocks[day] = [];
          dayBlocks[day].push({ className: enrollment.className, room, startTime: period.startTime, endTime: period.endTime });
        });
      });

      for (const [day, blocks] of Object.entries(dayBlocks)) {
        const sorted = [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
        const merged: typeof blocks = [];
        for (const block of sorted) {
          const last = merged[merged.length - 1];
          if (last && last.className === block.className && last.room === block.room) {
            if (block.endTime > last.endTime) last.endTime = block.endTime;
          } else {
            merged.push({ ...block });
          }
        }

        for (let i = 0; i < merged.length - 1; i++) {
          const curr = merged[i], next = merged[i + 1];
          if (!curr.room || !next.room) continue;
          const currIsBs = isBsRoom(curr.room), nextIsBs = isBsRoom(next.room);
          if (currIsBs === nextIsBs) continue;

          const direction = currIsBs ? 'BS→본원' : '본원→BS';
          const endHour = parseInt(curr.endTime.split(':')[0]);
          const hourKey = String(endHour);

          if (!map[day]) map[day] = {};
          if (!map[day][hourKey]) map[day][hourKey] = {};
          if (!map[day][hourKey][direction]) map[day][hourKey][direction] = new Set();
          map[day][hourKey][direction].add(student.name);
        }
      }
    });

    // 구조화
    return DAY_ORDER
      .filter(day => map[day])
      .map(day => {
        const hourGroups = Object.entries(map[day])
          .flatMap(([hourKey, dirs]) =>
            Object.entries(dirs).map(([direction, names]) => {
              const h = parseInt(hourKey);
              return {
                hour: h,
                hourLabel: `${h > 12 ? h - 12 : h}시 이동`,
                direction,
                students: [...names].sort((a, b) => a.localeCompare(b, 'ko')),
              };
            })
          )
          .sort((a, b) => a.hour - b.hour || a.direction.localeCompare(b.direction));
        return { day, groups: hourGroups };
      });
  }, [students, busRoutes, allClasses, isBsRoom]);

  const totalTransitStudents = useMemo(() => {
    const names = new Set<string>();
    transitByDay.forEach(d => d.groups.forEach(g => g.students.forEach(n => names.add(n))));
    return names.size;
  }, [transitByDay]);

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

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const scrapeFn = httpsCallable(functions, 'scrapeMakeEduBusData');
      const result = await scrapeFn({});
      const data = result.data as { success: boolean; count: number; routes: { busName: string; stopCount: number; totalBoardingCount: number }[] };
      setSyncMessage({
        type: 'success',
        text: `${data.count}개 노선 동기화 완료! (${data.routes.map(r => `${r.busName}: ${r.stopCount}개 정류장`).join(', ')})`
      });
      // 데이터 새로고침은 useShuttle의 react-query가 자동 처리
      window.location.reload();
    } catch (err: any) {
      const message = err?.message || err?.details || '동기화 실패';
      setSyncMessage({ type: 'error', text: message });
    }
    setSyncing(false);
  }, []);

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
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 text-xs text-gray-500 mr-2">
            <span className="flex items-center gap-1"><Bus size={12} /> {busRoutes.length}개 노선</span>
            <span className="flex items-center gap-1"><Users size={12} /> {totalStats.uniqueStudents}명</span>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {syncing ? '동기화 중...' : 'MakeEdu 동기화'}
          </button>
        </div>
      </div>

      {/* 동기화 메시지 */}
      {syncMessage && (
        <div className={`px-4 py-2 text-xs flex items-center justify-between ${syncMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          <span>{syncMessage.text}</span>
          <button onClick={() => setSyncMessage(null)} className="ml-2 opacity-60 hover:opacity-100">
            <X size={12} />
          </button>
        </div>
      )}

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
            <p className="text-xs text-gray-300 mb-4">
              {!searchQuery && '상단의 "MakeEdu 동기화" 버튼을 클릭하여 버스 데이터를 가져오세요'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {syncing ? '동기화 중...' : 'MakeEdu에서 버스 데이터 가져오기'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* BS반 이동 학생 섹션 */}
            {transitByDay.length > 0 && (
              <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-blue-50/50 transition-colors"
                  onClick={() => setShowTransitSection(!showTransitSection)}
                >
                  <div className="flex items-center gap-3">
                    {showTransitSection ? <ChevronDown size={16} className="text-blue-400" /> : <ChevronRight size={16} className="text-blue-400" />}
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <ArrowLeftRight size={16} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">BS반 이동 학생</h3>
                      <p className="text-[10px] text-gray-400">셔틀버스 탑승 학생 중 BS↔본원 이동</p>
                    </div>
                  </div>
                  <span className="text-blue-600 font-bold text-xs">{totalTransitStudents}명</span>
                </div>

                {showTransitSection && (
                  <div className="border-t">
                    {/* 방향 필터 탭 */}
                    <div className="flex border-b bg-gray-50 px-4 py-1.5 gap-1">
                      {(['all', '본원→BS', 'BS→본원'] as const).map(filter => (
                        <button
                          key={filter}
                          onClick={() => setTransitFilter(filter)}
                          className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                            transitFilter === filter
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          {filter === 'all' ? '전체' : filter === '본원→BS' ? '본원 → BS' : 'BS → 본원'}
                        </button>
                      ))}
                    </div>

                    {/* 요일별 그룹 */}
                    <div className="divide-y divide-gray-100">
                      {transitByDay.map(({ day, groups }) => {
                        const filtered = transitFilter === 'all'
                          ? groups
                          : groups.filter(g => g.direction === transitFilter);
                        if (filtered.length === 0) return null;

                        const dayStudentCount = new Set(filtered.flatMap(g => g.students)).size;
                        return (
                          <div key={day} className="px-4 py-2.5">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold">{day}</span>
                              <span className="text-[10px] text-gray-400">{dayStudentCount}명</span>
                            </div>
                            <div className="space-y-2 ml-2">
                              {filtered.map((group, gi) => (
                                <div key={gi}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[11px] font-bold text-blue-700">{group.hourLabel}</span>
                                    <span className="text-[10px] text-gray-300">·</span>
                                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
                                      group.direction === '본원→BS' ? 'text-indigo-600' : 'text-emerald-600'
                                    }`}>
                                      {group.direction === '본원→BS' ? '본원' : 'BS'}
                                      <ArrowRight size={10} />
                                      {group.direction === '본원→BS' ? 'BS' : '본원'}
                                    </span>
                                    <span className="text-[10px] text-gray-400 ml-auto">{group.students.length}명</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {group.students.map((name, ni) => (
                                      <span key={ni} className="px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded text-[10px]">
                                        {name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

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
  const stopsWithStudents = route.stops.filter(
    s => s.boardingStudents.length > 0 || s.alightingStudents.length > 0
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                      <StudentList students={stop.boardingStudents} type="boarding" expanded={isStopExpanded} searchQuery={searchQuery} />
                    </td>
                    <td className="px-3 py-2">
                      <StudentList students={stop.alightingStudents} type="alighting" expanded={isStopExpanded} searchQuery={searchQuery} />
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

  if (!expanded) {
    return (
      <span className={`${type === 'boarding' ? 'text-green-600' : 'text-orange-600'} font-medium`}>
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
            {s.days && <span className="text-[9px] opacity-70">({s.days})</span>}
          </span>
        );
      })}
    </div>
  );
}
