import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { collection, query, where, orderBy, limit, getDocs, startAfter, DocumentSnapshot, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { TimetableLogAction, TimetableLogEntry } from '../../hooks/useTimetableLog';
import { ChevronDown, Search, RefreshCw, ArrowUp, ArrowDown } from 'lucide-react';

const SUBJECT_LABELS: Record<string, string> = {
  math: '수학',
  highmath: '고등수학',
  english: '영어',
  science: '과학',
  korean: '국어',
  room: '강의실',
  staff: '직원',
};

const SUBJECT_FILTER_KEYS = ['math', 'highmath', 'english', 'science', 'korean', 'room', 'staff'] as const;

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
  student_move: '학생 이동',
  room_create: '강의실 생성',
  room_update: '강의실 수정',
  room_delete: '강의실 삭제',
  room_category_create: '강의실 카테고리 생성',
  room_category_update: '강의실 카테고리 수정',
  room_category_delete: '강의실 카테고리 삭제',
  staff_create: '직원 생성',
  staff_update: '직원 수정',
  staff_delete: '직원 삭제',
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
  student_move: 'bg-cyan-100 text-cyan-800',
  room_create: 'bg-teal-100 text-teal-800',
  room_update: 'bg-teal-100 text-teal-700',
  room_delete: 'bg-rose-100 text-rose-800',
  room_category_create: 'bg-teal-50 text-teal-700',
  room_category_update: 'bg-teal-50 text-teal-700',
  room_category_delete: 'bg-rose-50 text-rose-700',
  staff_create: 'bg-sky-100 text-sky-800',
  staff_update: 'bg-sky-100 text-sky-700',
  staff_delete: 'bg-rose-100 text-rose-800',
};

const PAGE_SIZE = 50;

interface LogRow extends TimetableLogEntry {
  id: string;
}

interface LogPage {
  logs: LogRow[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

// 페이지 단위 fetch — startAfter 로 다음 페이지 이어받기
// 한 번에 PAGE_SIZE(50)건만 가져와 클라이언트 부담 + Firestore read 비용 최소화
const fetchLogsPage = async (
  startDateStr: string,
  endDateStr: string,
  pageParam?: QueryDocumentSnapshot,
): Promise<LogPage> => {
  const startOfRange = `${startDateStr}T00:00:00.000Z`;
  const endOfRange = `${endDateStr}T23:59:59.999Z`;

  const constraints: any[] = [
    where('timestamp', '>=', startOfRange),
    where('timestamp', '<=', endOfRange),
    orderBy('timestamp', 'desc'),  // 최신부터 — 사용자 관심 데이터 우선 도달
  ];
  if (pageParam) constraints.push(startAfter(pageParam));
  constraints.push(limit(PAGE_SIZE));

  const q = query(collection(db, 'timetable_logs'), ...constraints);
  const snapshot = await getDocs(q);

  const logs = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as LogRow[];

  return {
    logs,
    lastDoc: snapshot.docs.length === PAGE_SIZE ? snapshot.docs[snapshot.docs.length - 1] : null,
    hasMore: snapshot.docs.length === PAGE_SIZE,
  };
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

// 변경된 필드를 한 줄에 인라인으로 나열 — "key: 이전 → 이후" 형식, 여러 개는 " · " 구분
const InlineDiff: React.FC<{ before?: Record<string, any>; after?: Record<string, any> }> = ({ before, after }) => {
  if (!before && !after) return <span className="text-gray-300">-</span>;

  const allKeys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);

  // 불필요한 메타 필드 제외
  const skipKeys = new Set(['createdAt', 'updatedAt', 'timestamp']);

  const fmt = (v: any): string => {
    if (v === undefined || v === null) return '-';
    if (typeof v === 'object') {
      try { return JSON.stringify(v); } catch { return String(v); }
    }
    return String(v);
  };

  const changedKeys = [...allKeys].filter(k => {
    if (skipKeys.has(k)) return false;
    const bVal = JSON.stringify(before?.[k]);
    const aVal = JSON.stringify(after?.[k]);
    return bVal !== aVal;
  });

  if (changedKeys.length === 0) {
    return <span className="text-gray-300">변경 내역 없음</span>;
  }

  return (
    <span className="text-xxs whitespace-nowrap">
      {changedKeys.map((key, idx) => (
        <React.Fragment key={key}>
          {idx > 0 && <span className="text-gray-300 mx-1">·</span>}
          <span className="text-gray-500 font-medium">{key}</span>
          <span className="text-gray-300">: </span>
          <span className="text-red-600 bg-red-50 px-1 rounded">{fmt(before?.[key])}</span>
          <span className="text-gray-400 mx-0.5">→</span>
          <span className="text-green-700 bg-green-50 px-1 rounded">{fmt(after?.[key])}</span>
        </React.Fragment>
      ))}
    </span>
  );
};

const LogsTab: React.FC = () => {
  const today = new Date().toISOString().split('T')[0];
  // 기본값: 최근 일주일 (오늘 포함 7일)
  const sevenDaysAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  })();
  const [startDate, setStartDate] = useState(sevenDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [actionFilter, setActionFilter] = useState<Set<string>>(new Set(['all']));
  const [subjectFilter, setSubjectFilter] = useState<Set<string>>(new Set(['all']));
  const [actorFilter, setActorFilter] = useState<Set<string>>(new Set(['all']));
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
  const [isActorDropdownOpen, setIsActorDropdownOpen] = useState(false);
  // 정렬 상태 (기본: 시간 오름차순)
  type SortKey = 'timestamp' | 'action' | 'subject' | 'className' | 'studentName' | 'changedBy' | 'details';
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const subjectDropdownRef = useRef<HTMLDivElement>(null);
  const actorDropdownRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['timetableLogs', startDate, endDate],
    queryFn: ({ pageParam }) => fetchLogsPage(startDate, endDate, pageParam as QueryDocumentSnapshot | undefined),
    initialPageParam: undefined as QueryDocumentSnapshot | undefined,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.lastDoc ?? undefined : undefined,
    staleTime: 30_000,
  });

  // 모든 페이지의 로그를 평탄화 (filteredLogs / actorOptions 계산용)
  const logs = useMemo<LogRow[]>(() => {
    return data?.pages.flatMap(p => p.logs) ?? [];
  }, [data]);

  // 처리자 옵션 목록 — 현재 logs 에 등장한 모든 changedBy 의 유니크 셋
  const actorOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => { if (l.changedBy) set.add(l.changedBy); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [logs]);

  // 로그 행을 검색용 전문 텍스트로 평탄화 — before/after 까지 포함해 상세 영역의 내용도 검색에 잡힘
  const flattenForSearch = (log: LogRow): string => {
    const parts: string[] = [
      log.action,
      ACTION_LABELS[log.action] || '',
      log.subject || '',
      SUBJECT_LABELS[log.subject || ''] || '',
      log.className || '',
      log.studentName || '',
      log.changedBy || '',
      log.details || '',
    ];
    const stringifyVal = (v: any): string => {
      if (v == null) return '';
      if (typeof v === 'object') {
        try { return JSON.stringify(v); } catch { return ''; }
      }
      return String(v);
    };
    if (log.before) {
      Object.entries(log.before).forEach(([k, v]) => { parts.push(k); parts.push(stringifyVal(v)); });
    }
    if (log.after) {
      Object.entries(log.after).forEach(([k, v]) => { parts.push(k); parts.push(stringifyVal(v)); });
    }
    return parts.join(' ').toLowerCase();
  };

  const filteredLogs = useMemo(() => {
    let result = logs;

    // action 필터 (멀티선택)
    if (!actionFilter.has('all') && actionFilter.size > 0) {
      result = result.filter(l => actionFilter.has(l.action));
    }

    // 과목 필터 (멀티선택)
    if (!subjectFilter.has('all') && subjectFilter.size > 0) {
      result = result.filter(l => l.subject && subjectFilter.has(l.subject));
    }

    // 처리자 필터 (멀티선택)
    if (!actorFilter.has('all') && actorFilter.size > 0) {
      result = result.filter(l => l.changedBy && actorFilter.has(l.changedBy));
    }

    // 검색 — before/after 까지 포함한 전문 검색
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(l => flattenForSearch(l).includes(q));
    }

    // 정렬
    const dirMul = sortDir === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      const av = (a as any)[sortKey] ?? '';
      const bv = (b as any)[sortKey] ?? '';
      // 시간은 ISO 문자열이라 사전순 비교가 곧 시간순
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv, 'ko') * dirMul;
      }
      return (av > bv ? 1 : av < bv ? -1 : 0) * dirMul;
    });

    return result;
  }, [logs, actionFilter, subjectFilter, actorFilter, searchQuery, sortKey, sortDir]);

  // 헤더 클릭 시 정렬 토글
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };
  const SortIndicator = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <span className="inline-block w-3" />;
    return sortDir === 'asc'
      ? <ArrowUp size={10} className="inline-block ml-0.5 text-blue-500" />
      : <ArrowDown size={10} className="inline-block ml-0.5 text-blue-500" />;
  };

  // 자동 스크롤 — asc 일 때만 최신 기록(하단)으로 이동 + 초기 로드 시 한 번만
  // desc 정렬에서는 최신이 맨 위에 있으므로 강제 스크롤 안 함 (사용자 view 어색해지는 문제 차단)
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    if (didInitialScrollRef.current) return;
    if (scrollContainerRef.current && filteredLogs.length > 0 && sortDir === 'asc') {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      didInitialScrollRef.current = true;
    }
  }, [filteredLogs, sortDir]);

  // 페이징: 스크롤 끝 근처 도달 시 다음 페이지 자동 로드
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      if (isFetchingNextPage || !hasNextPage) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      // 스크롤이 끝에서 200px 이내면 다음 페이지 fetch
      if (scrollHeight - (scrollTop + clientHeight) < 200) {
        fetchNextPage();
      }
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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

  // 과목 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (subjectDropdownRef.current && !subjectDropdownRef.current.contains(event.target as Node)) {
        setIsSubjectDropdownOpen(false);
      }
    };

    if (isSubjectDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isSubjectDropdownOpen]);

  // 처리자 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actorDropdownRef.current && !actorDropdownRef.current.contains(event.target as Node)) {
        setIsActorDropdownOpen(false);
      }
    };
    if (isActorDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isActorDropdownOpen]);

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

  const toggleSubjectFilter = (subject: string) => {
    const newFilter = new Set(subjectFilter);

    if (subject === 'all') {
      setSubjectFilter(new Set(['all']));
    } else {
      newFilter.delete('all');
      if (newFilter.has(subject)) {
        newFilter.delete(subject);
      } else {
        newFilter.add(subject);
      }
      setSubjectFilter(newFilter.size > 0 ? newFilter : new Set(['all']));
    }
  };

  const toggleActorFilter = (actor: string) => {
    const newFilter = new Set(actorFilter);
    if (actor === 'all') {
      setActorFilter(new Set(['all']));
    } else {
      newFilter.delete('all');
      if (newFilter.has(actor)) newFilter.delete(actor);
      else newFilter.add(actor);
      setActorFilter(newFilter.size > 0 ? newFilter : new Set(['all']));
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 flex-wrap">
        <h2 className="text-sm font-bold text-gray-800 shrink-0">시간표 변경 로그</h2>

        {/* 날짜 기간 (시작 ~ 끝) — 기본 최근 일주일 */}
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400">~</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

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

        {/* 과목 필터 (체크박스 멀티선택) */}
        <div className="relative" ref={subjectDropdownRef}>
          <button
            onClick={() => setIsSubjectDropdownOpen(!isSubjectDropdownOpen)}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white hover:bg-gray-50 flex items-center gap-1 min-w-[100px]"
          >
            <span className="flex-1 text-left truncate">
              {subjectFilter.has('all') ? '전체 과목' : `과목 ${subjectFilter.size}개`}
            </span>
            <ChevronDown size={12} className={`text-gray-400 transition-transform ${isSubjectDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isSubjectDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-20 min-w-[140px] max-h-[300px] overflow-y-auto">
              <label
                className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 cursor-pointer border-b border-gray-200"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={subjectFilter.has('all')}
                  onChange={() => toggleSubjectFilter('all')}
                  className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-500"
                />
                <span className="font-medium">전체 과목</span>
              </label>

              {SUBJECT_FILTER_KEYS.map(key => (
                <label
                  key={key}
                  className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={subjectFilter.has(key)}
                    onChange={() => toggleSubjectFilter(key)}
                    className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-500"
                  />
                  <span>{SUBJECT_LABELS[key]}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 처리자 필터 (체크박스 멀티선택) */}
        <div className="relative" ref={actorDropdownRef}>
          <button
            onClick={() => setIsActorDropdownOpen(!isActorDropdownOpen)}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white hover:bg-gray-50 flex items-center gap-1 min-w-[100px]"
          >
            <span className="flex-1 text-left truncate">
              {actorFilter.has('all') ? '전체 처리자' : `처리자 ${actorFilter.size}명`}
            </span>
            <ChevronDown size={12} className={`text-gray-400 transition-transform ${isActorDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isActorDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-20 min-w-[180px] max-h-[300px] overflow-y-auto">
              <label
                className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 cursor-pointer border-b border-gray-200"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={actorFilter.has('all')}
                  onChange={() => toggleActorFilter('all')}
                  className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-500"
                />
                <span className="font-medium">전체 처리자</span>
              </label>
              {actorOptions.map(name => (
                <label
                  key={name}
                  className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={actorFilter.has(name)}
                    onChange={() => toggleActorFilter(name)}
                    className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="truncate" title={name}>{name}</span>
                </label>
              ))}
              {actorOptions.length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-400">처리자 없음</div>
              )}
            </div>
          )}
        </div>

        {/* 검색 */}
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="수업명, 학생, 처리자, 상세..."
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

      {/* Table — 가로 스크롤 허용 (필드 변경내역이 가로로 길어질 수 있음) */}
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
          <table className="text-xs" style={{ minWidth: '100%' }}>
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr className="border-b border-gray-200">
                <th
                  className="px-3 py-2 text-left font-medium text-gray-500 w-36 cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
                  onClick={() => handleSort('timestamp')}
                >시간<SortIndicator k="timestamp" /></th>
                <th
                  className="px-3 py-2 text-left font-medium text-gray-500 w-24 cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
                  onClick={() => handleSort('action')}
                >작업<SortIndicator k="action" /></th>
                <th
                  className="px-3 py-2 text-left font-medium text-gray-500 w-16 cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
                  onClick={() => handleSort('subject')}
                >과목<SortIndicator k="subject" /></th>
                <th
                  className="px-3 py-2 text-left font-medium text-gray-500 w-28 cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
                  onClick={() => handleSort('className')}
                >수업명<SortIndicator k="className" /></th>
                <th
                  className="px-3 py-2 text-left font-medium text-gray-500 w-24 cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
                  onClick={() => handleSort('studentName')}
                >학생<SortIndicator k="studentName" /></th>
                <th
                  className="px-3 py-2 text-left font-medium text-gray-500 w-28 cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
                  onClick={() => handleSort('changedBy')}
                >처리자<SortIndicator k="changedBy" /></th>
                <th
                  className="px-3 py-2 text-left font-medium text-gray-500 w-64 cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
                  onClick={() => handleSort('details')}
                >상세<SortIndicator k="details" /></th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">변경 필드</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr
                  key={log.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-3 py-2 text-gray-600 font-mono whitespace-nowrap">
                    {formatTime(log.timestamp)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{(log.subject && SUBJECT_LABELS[log.subject]) || log.subject || '-'}</td>
                  <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap" title={log.className}>
                    {log.className || '-'}
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap" title={log.studentName}>
                    {log.studentName || '-'}
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap" title={log.changedBy}>
                    {log.changedBy || '-'}
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap" title={log.details}>
                    {log.details}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    <InlineDiff before={log.before} after={log.after} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {/* 페이지 끝 인디케이터 — 추가 로드/완료 상태 표시 */}
        {!isLoading && filteredLogs.length > 0 && (
          <div className="px-4 py-3 text-center text-xs text-gray-400 border-t border-gray-100">
            {isFetchingNextPage ? (
              <span>다음 페이지 불러오는 중…</span>
            ) : hasNextPage ? (
              <button
                onClick={() => fetchNextPage()}
                className="px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded border border-blue-200"
              >
                더 보기 (현재 {logs.length}건 로드됨)
              </button>
            ) : (
              <span>모든 기록을 불러왔습니다 (총 {logs.length}건)</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LogsTab;
