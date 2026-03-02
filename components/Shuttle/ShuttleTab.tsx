import React, { useState, useMemo, useCallback } from 'react';
import { useShuttle, BusRoute, BusStop } from '../../hooks/useShuttle';
import { Search, Bus, Users, ChevronDown, ChevronRight, RefreshCw, ArrowUp, ArrowDown, Settings, Loader2, X } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function ShuttleTab() {
  const { busRoutes, isBusLoading } = useShuttle();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());
  const [expandedStops, setExpandedStops] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
            onClick={() => setShowSettings(true)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            title="MakeEdu 설정"
          >
            <Settings size={16} />
          </button>
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

      {/* MakeEdu 설정 모달 */}
      {showSettings && <MakeEduSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

/** MakeEdu 로그인 설정 모달 */
function MakeEduSettingsModal({ onClose }: { onClose: () => void }) {
  const [userId, setUserId] = useState('');
  const [userPwd, setUserPwd] = useState('');
  const [schoolUrl, setSchoolUrl] = useState('https://school.makeedu.co.kr');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 기존 설정 로드
  React.useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'makeedu'));
        if (snap.exists()) {
          const data = snap.data();
          setUserId(data.userId || '');
          setUserPwd(data.userPwd || '');
          setSchoolUrl(data.schoolUrl || 'https://school.makeedu.co.kr');
        }
      } catch (e) {
        console.error('Failed to load MakeEdu settings:', e);
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'makeedu'), {
        userId,
        userPwd,
        schoolUrl,
        updatedAt: new Date().toISOString(),
      });
      onClose();
    } catch (e: any) {
      alert('저장 실패: ' + (e.message || e));
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-sm font-bold text-gray-900">MakeEdu 로그인 설정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {loading ? (
            <div className="text-center py-4"><Loader2 size={20} className="mx-auto animate-spin text-gray-400" /></div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">아이디</label>
                <input
                  type="text"
                  value={userId}
                  onChange={e => setUserId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="MakeEdu 아이디"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">비밀번호</label>
                <input
                  type="password"
                  value={userPwd}
                  onChange={e => setUserPwd(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="MakeEdu 비밀번호"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">학원 URL</label>
                <input
                  type="text"
                  value={schoolUrl}
                  onChange={e => setSchoolUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="https://school.makeedu.co.kr"
                />
              </div>
              <p className="text-[10px] text-gray-400">
                * 입력한 정보는 Firestore settings/makeedu에 저장되며, Cloud Function에서 자동 로그인에 사용됩니다.
              </p>
            </>
          )}
        </div>
        <div className="flex gap-2 px-5 py-3 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="flex-1 py-2 text-xs text-gray-600 border rounded hover:bg-gray-100">취소</button>
          <button
            onClick={handleSave}
            disabled={saving || !userId || !userPwd}
            className="flex-1 py-2 text-xs text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
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
