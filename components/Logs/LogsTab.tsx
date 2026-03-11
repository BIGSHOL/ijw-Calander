import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, orderBy, limit, getDocs, startAfter, DocumentSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { TimetableLogAction, TimetableLogEntry } from '../../hooks/useTimetableLog';
import { ChevronDown, ChevronRight, Search, RefreshCw } from 'lucide-react';

const ACTION_LABELS: Record<TimetableLogAction, string> = {
  class_create: '수업 생성',
  class_update: '수업 수정',
  class_delete: '수업 삭제',
  student_enroll: '학생 등록',
  student_unenroll: '학생 제거',
  student_transfer: '반이동',
  student_withdraw: '퇴원 처리',
  enrollment_update: '등록정보 수정',
  english_move: '영어 반이동',
};

const ACTION_COLORS: Record<TimetableLogAction, string> = {
  class_create: 'bg-green-100 text-green-800',
  class_update: 'bg-blue-100 text-blue-800',
  class_delete: 'bg-red-100 text-red-800',
  student_enroll: 'bg-emerald-100 text-emerald-800',
  student_unenroll: 'bg-orange-100 text-orange-800',
  student_transfer: 'bg-purple-100 text-purple-800',
  student_withdraw: 'bg-red-100 text-red-700',
  enrollment_update: 'bg-yellow-100 text-yellow-800',
  english_move: 'bg-indigo-100 text-indigo-800',
};

const PAGE_SIZE = 50;

interface LogRow extends TimetableLogEntry {
  id: string;
}

const fetchLogs = async (dateStr: string, actionFilter: string): Promise<LogRow[]> => {
  const startOfDay = `${dateStr}T00:00:00.000Z`;
  const endOfDay = `${dateStr}T23:59:59.999Z`;

  const constraints: any[] = [
    where('timestamp', '>=', startOfDay),
    where('timestamp', '<=', endOfDay),
    orderBy('timestamp', 'asc'),
    limit(PAGE_SIZE),
  ];

  const q = query(collection(db, 'timetable_logs'), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as LogRow[];
};

const formatTime = (timestamp: string) => {
  try {
    const d = new Date(timestamp);
    return d.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return timestamp;
  }
};

const DiffView: React.FC<{ before?: Record<string, any>; after?: Record<string, any> }> = ({ before, after }) => {
  if (!before && !after) return <span className="text-gray-400 text-xs">상세 정보 없음</span>;

  const allKeys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);

  // 불필요한 메타 필드 제외
  const skipKeys = new Set(['createdAt', 'updatedAt', 'timestamp']);

  const changedKeys = [...allKeys].filter(k => {
    if (skipKeys.has(k)) return false;
    const bVal = JSON.stringify(before?.[k]);
    const aVal = JSON.stringify(after?.[k]);
    return bVal !== aVal;
  });

  if (changedKeys.length === 0) {
    return <span className="text-gray-400 text-xs">변경 내역 없음</span>;
  }

  return (
    <div className="grid grid-cols-[120px_1fr_1fr] gap-x-2 gap-y-1 text-xs">
      <div className="font-semibold text-gray-500">필드</div>
      <div className="font-semibold text-red-500">이전</div>
      <div className="font-semibold text-green-600">이후</div>
      {changedKeys.map(key => (
        <React.Fragment key={key}>
          <div className="text-gray-600 font-medium truncate" title={key}>{key}</div>
          <div className="text-red-600 bg-red-50 px-1 rounded break-all">
            {before?.[key] !== undefined ? (
              typeof before[key] === 'object' ? JSON.stringify(before[key], null, 1) : String(before[key])
            ) : <span className="text-gray-300">-</span>}
          </div>
          <div className="text-green-700 bg-green-50 px-1 rounded break-all">
            {after?.[key] !== undefined ? (
              typeof after[key] === 'object' ? JSON.stringify(after[key], null, 1) : String(after[key])
            ) : <span className="text-gray-300">-</span>}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

const LogsTab: React.FC = () => {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [actionFilter, setActionFilter] = useState<Set<string>>(new Set(['all']));
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['timetableLogs', selectedDate],
    queryFn: () => fetchLogs(selectedDate, actionFilter),
    staleTime: 30_000,
  });

  const filteredLogs = useMemo(() => {
    let result = logs;

    // action 필터 (멀티선택)
    if (!actionFilter.has('all') && actionFilter.size > 0) {
      result = result.filter(l => actionFilter.has(l.action));
    }

    // 검색
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(l =>
        l.className?.toLowerCase().includes(q) ||
        l.studentName?.toLowerCase().includes(q) ||
        l.changedBy?.toLowerCase().includes(q) ||
        l.details?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [logs, actionFilter, searchQuery]);

  // 최신 기록(하단)으로 자동 스크롤
  useEffect(() => {
    if (scrollContainerRef.current && filteredLogs.length > 0) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [filteredLogs]);

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleActionFilter = (action: string) => {
    const newFilter = new Set(actionFilter);

    if (action === 'all') {
      setActionFilter(new Set(['all']));
    } else {
      newFilter.delete('all');
      if (newFilter.has(action)) {
        newFilter.delete(action);
      } else {
        newFilter.add(action);
      }
      setActionFilter(newFilter.size > 0 ? newFilter : new Set(['all']));
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 flex-wrap">
        <h2 className="text-sm font-bold text-gray-800 shrink-0">시간표 변경 로그</h2>

        {/* 날짜 */}
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        {/* 작업유형 (체크박스 멀티선택) */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white hover:bg-gray-50 flex items-center gap-1 min-w-[120px]"
          >
            <span className="flex-1 text-left truncate">
              {actionFilter.has('all') ? '전체 작업' : `작업 ${actionFilter.size}개`}
            </span>
            <ChevronDown size={12} className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-20 min-w-[180px] max-h-[300px] overflow-y-auto">
              <label
                className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 cursor-pointer border-b border-gray-200"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={actionFilter.has('all')}
                  onChange={() => toggleActionFilter('all')}
                  className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-500"
                />
                <span className="font-medium">전체 작업</span>
              </label>

              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={actionFilter.has(key)}
                    onChange={() => toggleActionFilter(key)}
                    className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-500"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 검색 */}
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="수업명, 학생, 변경자..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-6 pr-2 py-1 text-xs border border-gray-300 rounded w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* 새로고침 */}
        <button
          onClick={() => refetch()}
          className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title="새로고침"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>

        <span className="text-xs text-gray-400 ml-auto">
          {filteredLogs.length}건
        </span>
      </div>

      {/* Table */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            로그 불러오는 중...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            {logs.length === 0 ? '해당 날짜에 로그가 없습니다.' : '검색 결과가 없습니다.'}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left font-medium text-gray-500 w-8"></th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 w-36">시간</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 w-24">작업</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 w-16">과목</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 w-28">수업명</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 w-24">학생</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 w-28">변경자</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">상세</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => {
                const isExpanded = expandedIds.has(log.id);
                return (
                  <React.Fragment key={log.id}>
                    <tr
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => toggleExpand(log.id)}
                    >
                      <td className="px-3 py-2 text-gray-400">
                        {isExpanded
                          ? <ChevronDown size={12} />
                          : <ChevronRight size={12} />}
                      </td>
                      <td className="px-3 py-2 text-gray-600 font-mono">
                        {formatTime(log.timestamp)}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{log.subject || '-'}</td>
                      <td className="px-3 py-2 text-gray-800 font-medium truncate max-w-[120px]" title={log.className}>
                        {log.className || '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-600 truncate max-w-[100px]" title={log.studentName}>
                        {log.studentName || '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-500 truncate max-w-[120px]" title={log.changedBy}>
                        {log.changedBy || '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-500 truncate max-w-[200px]" title={log.details}>
                        {log.details}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={8} className="px-6 py-3">
                          <DiffView before={log.before} after={log.after} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default LogsTab;
