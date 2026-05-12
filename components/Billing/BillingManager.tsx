import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import {
  DollarSign, Plus, Upload, ArrowLeft, Loader2, AlertCircle, Link2, Cloud, CheckSquare,
} from 'lucide-react';
import { collection, getCountFromServer } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { ColumnFilter } from '../Common/ColumnFilter';
import { Pagination } from '../Common/Pagination';
import { BillingForm } from './BillingForm';
import { useBilling, useBillingMonthSummaries } from '../../hooks/useBilling';
import { useStudents } from '../../hooks/useStudents';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { BillingRecord, UnifiedStudent } from '../../types';
import StudentDetailModal from '../StudentManagement/StudentDetailModal';

// xlsx 라이브러리 포함 모달은 lazy loading (-60KB gzip)
const BillingImportModal = lazy(() =>
  import('./BillingImportModal').then(m => ({ default: m.BillingImportModal })),
);
const MakeEduBillingSyncModal = lazy(() =>
  import('./MakeEduBillingSyncModal').then(m => ({ default: m.MakeEduBillingSyncModal })),
);
const MakeEduBillingReviewModal = lazy(() =>
  import('./MakeEduBillingReviewModal').then(m => ({ default: m.MakeEduBillingReviewModal })),
);

interface BillingManagerProps {
  userProfile?: any;
  onNavigateToTextbooks?: () => void;
}

const PAGE_SIZE = 30;

type SortKey =
  | 'studentName' | 'school' | 'grade' | 'billingName'
  | 'billedAmount' | 'discountAmount' | 'paidAmount' | 'unpaidAmount'
  | 'teacher' | 'status';
type SortDir = 'asc' | 'desc';

/** "2026-01" → "2026년 1월" */
function formatMonth(m: string): string {
  if (!m) return '';
  const [year, month] = m.split('-');
  return `${year}년 ${parseInt(month, 10)}월`;
}

const BillingManager: React.FC<BillingManagerProps> = ({ userProfile, onNavigateToTextbooks }) => {
  // ─── Persistent state (localStorage) ───
  const [selectedMonth, setSelectedMonth] = useLocalStorage<string | null>(
    'billing.selectedMonth', null,
  );
  const [search, setSearch] = useLocalStorage<string>('billing.search', '');
  const [columnFiltersArr, setColumnFiltersArr] = useLocalStorage<Record<string, string[]>>(
    'billing.columnFilters', {},
  );
  const [sortKey, setSortKey] = useLocalStorage<SortKey>('billing.sortKey', 'studentName');
  const [sortDir, setSortDir] = useLocalStorage<SortDir>('billing.sortDir', 'asc');

  // ─── Local state ───
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<BillingRecord>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isMakeEduSyncOpen, setIsMakeEduSyncOpen] = useState(false);
  const [isMakeEduReviewOpen, setIsMakeEduReviewOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState<UnifiedStudent | null>(null);

  const refreshPendingCount = async () => {
    try {
      const snap = await getCountFromServer(collection(db, 'billing_makeedu_pending'));
      setPendingCount(snap.data().count);
    } catch {
      // count() 미지원 환경 대비 — 무시
    }
  };
  useEffect(() => { refreshPendingCount(); }, []);

  // 컬럼 필터 (Set으로 변환)
  const columnFilters = useMemo(() => {
    const result: Record<string, Set<string>> = {};
    for (const [k, v] of Object.entries(columnFiltersArr)) result[k] = new Set(v);
    return result;
  }, [columnFiltersArr]);

  const setColumnFilter = (key: string, sel: Set<string>) => {
    setColumnFiltersArr({ ...columnFiltersArr, [key]: Array.from(sel) });
    setPage(1);
  };

  const handleSort = (key: SortKey, dir: SortDir) => {
    setSortKey(key); setSortDir(dir); setPage(1);
  };

  // ─── 데이터 ───
  // 메인 화면: 월별 요약
  const { data: monthSummaries = [] } = useBillingMonthSummaries();

  // 상세 화면: 선택된 월 records (selectedMonth가 있을 때만 활성)
  const { records, isLoading, createRecord, updateRecord, deleteRecord, importRecords } =
    useBilling(selectedMonth || undefined, !!selectedMonth);

  const { students } = useStudents(false); // 재원생만

  // 컬럼 고유값 (필터 드롭다운용)
  const columnValues = useMemo(() => {
    const cols: Record<string, string[]> = {};
    const keys: SortKey[] = ['studentName', 'school', 'grade', 'billingName', 'teacher', 'status'];
    for (const key of keys) {
      const set = new Set<string>();
      records.forEach(r => {
        const v = String((r as any)[key] ?? '');
        if (v) set.add(v);
      });
      cols[key] = Array.from(set);
    }
    return cols;
  }, [records]);

  // 필터 + 정렬
  const filtered = useMemo(() => {
    let list = records;

    // 검색
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        (r.studentName || '').toLowerCase().includes(q) ||
        (r.billingName || '').toLowerCase().includes(q),
      );
    }

    // 컬럼별 체크박스 필터
    const NONE_SENTINEL = '\0__NONE__\0';
    for (const [key, sel] of Object.entries(columnFilters)) {
      if (sel.size === 0) continue;
      // 전체 해제 (NONE_SENTINEL만 있음) → 결과 0
      if (sel.size === 1 && sel.has(NONE_SENTINEL)) {
        list = [];
        break;
      }
      list = list.filter(r => sel.has(String((r as any)[key] ?? '')));
    }

    // 정렬
    const sorted = [...list].sort((a, b) => {
      const va = (a as any)[sortKey];
      const vb = (b as any)[sortKey];
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va ?? '').localeCompare(String(vb ?? ''), 'ko');
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [records, search, columnFilters, sortKey, sortDir]);

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  useEffect(() => { if (page !== safePage) setPage(safePage); }, [page, safePage]);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  // 합계 (필터된 결과 기준)
  const totals = useMemo(() => filtered.reduce((acc, r) => ({
    charge: acc.charge + (r.billedAmount || 0),
    discount: acc.discount + (r.discountAmount || 0),
    paid: acc.paid + (r.paidAmount || 0),
    unpaid: acc.unpaid + (r.unpaidAmount || 0),
  }), { charge: 0, discount: 0, paid: 0, unpaid: 0 }), [filtered]);

  // ─── 인라인 편집 ───
  const startEdit = (r: BillingRecord) => {
    setEditingId(r.id);
    setEditValues({
      school: r.school,
      billingName: r.billingName,
      billedAmount: r.billedAmount,
      discountAmount: r.discountAmount,
      paidAmount: r.paidAmount,
      teacher: r.teacher,
      memo: r.memo,
      status: r.status,
    });
  };
  const saveEdit = async () => {
    if (!editingId) return;
    // 미납액 자동 계산
    const billed = editValues.billedAmount ?? 0;
    const discount = editValues.discountAmount ?? 0;
    const paid = editValues.paidAmount ?? 0;
    const unpaid = Math.max(0, billed - discount - paid);
    const status = paid >= billed - discount ? 'paid' : 'pending';
    await updateRecord.mutateAsync({
      id: editingId,
      updates: { ...editValues, unpaidAmount: unpaid, status },
    });
    setEditingId(null);
    setEditValues({});
  };
  const cancelEdit = () => { setEditingId(null); setEditValues({}); };

  const handleDelete = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await deleteRecord.mutateAsync(id);
  };

  // ─── Import / Form ───
  const handleImport = async (parsedRecords: Omit<BillingRecord, 'id'>[], month: string) => {
    const result = await importRecords.mutateAsync({ records: parsedRecords, month });
    if (month) setSelectedMonth(month);
    return result;
  };

  const handleFormSubmit = async (data: Partial<BillingRecord>) => {
    await createRecord.mutateAsync({
      ...data,
      month: data.month || selectedMonth || '',
    } as Omit<BillingRecord, 'id'>);
    setIsFormOpen(false);
  };

  const handleStudentClick = (studentName: string) => {
    const student = students.find(s => s.name === studentName);
    if (student) setSelectedStudent(student);
  };

  // ═══════════════════════════════════════
  // 메인 화면: 월 카드 그리드
  // ═══════════════════════════════════════
  if (!selectedMonth) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <header className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-sm flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">수납 관리</h1>
                <p className="text-sm text-gray-500">월별 수납 내역 — 카드 클릭 시 상세 보기</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMakeEduSyncOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-sm border border-blue-600 text-blue-600 text-sm hover:bg-blue-50 transition-colors"
                title="메이크에듀 상세수납 페이지에서 직접 가져옴"
              >
                <Cloud className="w-4 h-4" />
                MakeEdu 동기화
              </button>
              <button
                onClick={() => setIsMakeEduReviewOpen(true)}
                className="relative inline-flex items-center gap-2 px-3 py-2 rounded-sm border border-amber-600 text-amber-700 text-sm hover:bg-amber-50 transition-colors"
                title="동기화된 데이터를 검토 후 실 수납에 반영"
              >
                <CheckSquare className="w-4 h-4" />
                검토 후 반영
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setIsImportOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Excel 업로드
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {monthSummaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-500">
              <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
              <p>등록된 수납 데이터가 없습니다.</p>
              <p className="text-sm mt-1">Excel 업로드 버튼을 눌러 데이터를 등록하세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-6xl mx-auto">
              {monthSummaries.map(s => (
                <button
                  key={s.month}
                  onClick={() => { setSelectedMonth(s.month); setPage(1); }}
                  className="text-left rounded-sm border border-gray-200 bg-white p-4 hover:border-emerald-400 hover:shadow-sm transition-all"
                >
                  <div className="text-lg font-bold text-gray-900">{formatMonth(s.month)}</div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">{s.count}건</span>
                    <div className="text-right">
                      <div className="text-emerald-600 font-medium">
                        납부 {s.totalPaid.toLocaleString()}원
                      </div>
                      {s.totalUnpaid > 0 && (
                        <div className="text-orange-600 text-xs">
                          미납 {s.totalUnpaid.toLocaleString()}원
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>

        {/* Modals */}
        {isImportOpen && (
          <Suspense fallback={null}>
            <BillingImportModal
              isOpen={isImportOpen}
              onClose={() => setIsImportOpen(false)}
              onImport={handleImport}
              onNavigateToTextbooks={onNavigateToTextbooks ? (file: File) => {
                setIsImportOpen(false);
                onNavigateToTextbooks();
                void file;
              } : undefined}
            />
          </Suspense>
        )}
        {isMakeEduSyncOpen && (
          <Suspense fallback={null}>
            <MakeEduBillingSyncModal
              isOpen={isMakeEduSyncOpen}
              onClose={() => { setIsMakeEduSyncOpen(false); refreshPendingCount(); }}
              onSyncComplete={() => { refreshPendingCount(); }}
            />
          </Suspense>
        )}
        {isMakeEduReviewOpen && (
          <Suspense fallback={null}>
            <MakeEduBillingReviewModal
              isOpen={isMakeEduReviewOpen}
              onClose={() => { setIsMakeEduReviewOpen(false); refreshPendingCount(); }}
            />
          </Suspense>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════
  // 상세 화면: 선택된 월의 수납 테이블
  // ═══════════════════════════════════════
  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelectedMonth(null); setPage(1); }}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title="목록으로"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 bg-emerald-100 rounded-sm flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {formatMonth(selectedMonth)} 수납
              </h1>
              <p className="text-sm text-gray-500">총 {records.length}건</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMakeEduSyncOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-sm border border-blue-600 text-blue-600 text-sm hover:bg-blue-50 transition-colors"
              title="메이크에듀 상세수납 페이지에서 직접 가져옴"
            >
              <Cloud className="w-4 h-4" /> MakeEdu 동기화
            </button>
            <button
              onClick={() => setIsMakeEduReviewOpen(true)}
              className="relative inline-flex items-center gap-2 px-3 py-2 rounded-sm border border-amber-600 text-amber-700 text-sm hover:bg-amber-50 transition-colors"
              title="동기화된 데이터를 검토 후 실 수납에 반영"
            >
              <CheckSquare className="w-4 h-4" /> 검토 후 반영
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsImportOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-sm border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-4 h-4" /> Excel 업로드
            </button>
            <button
              onClick={() => setIsFormOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-sm bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> 신규 등록
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        {/* 요약 카드 (필터된 결과 기준) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <SummaryCard label="청구액" value={totals.charge} />
          <SummaryCard label="할인" value={totals.discount} color="text-orange-600" prefix={totals.discount > 0 ? '-' : ''} />
          <SummaryCard label="납부액" value={totals.paid} color="text-emerald-600" />
          <SummaryCard label="미납액" value={totals.unpaid} color="text-red-600" />
        </div>

        {/* 검색 + 필터 초기화 */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="학생 / 청구명 검색"
            className="rounded-sm border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
          {Object.values(columnFilters).some(s => s.size > 0) && (
            <button
              onClick={() => { setColumnFiltersArr({}); setPage(1); }}
              className="text-xs text-red-500 hover:text-red-700"
            >
              필터 초기화
            </button>
          )}
          <span className="ml-auto text-sm text-gray-500">{filtered.length}건</span>
        </div>

        {/* 테이블 */}
        <div className="rounded-sm border border-gray-200 bg-white overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : paged.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
              <p>{records.length === 0 ? '수납 내역이 없습니다.' : '검색 결과가 없습니다.'}</p>
            </div>
          ) : (
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 w-10">#</th>
                  <th className="text-left">
                    <ColumnFilter
                      values={columnValues.studentName || []}
                      selected={columnFilters.studentName || new Set()}
                      onChange={s => setColumnFilter('studentName', s)}
                      sortKey={sortKey === 'studentName' ? sortKey : null}
                      sortDir={sortDir}
                      onSort={d => handleSort('studentName', d)}
                    >이름</ColumnFilter>
                  </th>
                  <th className="text-left">
                    <ColumnFilter
                      values={columnValues.school || []}
                      selected={columnFilters.school || new Set()}
                      onChange={s => setColumnFilter('school', s)}
                      sortKey={sortKey === 'school' ? sortKey : null}
                      sortDir={sortDir}
                      onSort={d => handleSort('school', d)}
                    >학교</ColumnFilter>
                  </th>
                  <th className="text-left">
                    <ColumnFilter
                      values={columnValues.grade || []}
                      selected={columnFilters.grade || new Set()}
                      onChange={s => setColumnFilter('grade', s)}
                      sortKey={sortKey === 'grade' ? sortKey : null}
                      sortDir={sortDir}
                      onSort={d => handleSort('grade', d)}
                    >학년</ColumnFilter>
                  </th>
                  <th className="text-left">
                    <ColumnFilter
                      values={columnValues.billingName || []}
                      selected={columnFilters.billingName || new Set()}
                      onChange={s => setColumnFilter('billingName', s)}
                      sortKey={sortKey === 'billingName' ? sortKey : null}
                      sortDir={sortDir}
                      onSort={d => handleSort('billingName', d)}
                    >수납명</ColumnFilter>
                  </th>
                  <th className="text-right">
                    <ColumnFilter
                      values={[]}
                      selected={new Set()}
                      onChange={() => { /* 정렬 전용 */ }}
                      sortKey={sortKey === 'billedAmount' ? sortKey : null}
                      sortDir={sortDir}
                      onSort={d => handleSort('billedAmount', d)}
                      align="right"
                    >청구액</ColumnFilter>
                  </th>
                  <th className="text-right">
                    <ColumnFilter
                      values={[]}
                      selected={new Set()}
                      onChange={() => {}}
                      sortKey={sortKey === 'discountAmount' ? sortKey : null}
                      sortDir={sortDir}
                      onSort={d => handleSort('discountAmount', d)}
                      align="right"
                    >할인</ColumnFilter>
                  </th>
                  <th className="text-right">
                    <ColumnFilter
                      values={[]}
                      selected={new Set()}
                      onChange={() => {}}
                      sortKey={sortKey === 'paidAmount' ? sortKey : null}
                      sortDir={sortDir}
                      onSort={d => handleSort('paidAmount', d)}
                      align="right"
                    >납부액</ColumnFilter>
                  </th>
                  <th className="text-right">
                    <ColumnFilter
                      values={[]}
                      selected={new Set()}
                      onChange={() => {}}
                      sortKey={sortKey === 'unpaidAmount' ? sortKey : null}
                      sortDir={sortDir}
                      onSort={d => handleSort('unpaidAmount', d)}
                      align="right"
                    >미납액</ColumnFilter>
                  </th>
                  <th className="text-center">
                    <ColumnFilter
                      values={columnValues.status || []}
                      selected={columnFilters.status || new Set()}
                      onChange={s => setColumnFilter('status', s)}
                      sortKey={sortKey === 'status' ? sortKey : null}
                      sortDir={sortDir}
                      onSort={d => handleSort('status', d)}
                      align="center"
                    >상태</ColumnFilter>
                  </th>
                  <th className="text-left">
                    <ColumnFilter
                      values={columnValues.teacher || []}
                      selected={columnFilters.teacher || new Set()}
                      onChange={s => setColumnFilter('teacher', s)}
                      sortKey={sortKey === 'teacher' ? sortKey : null}
                      sortDir={sortDir}
                      onSort={d => handleSort('teacher', d)}
                    >담임강사</ColumnFilter>
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">메모</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-500">편집</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r, idx) => {
                  const isEditing = editingId === r.id;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-3 py-2 text-gray-400">
                        {(safePage - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{r.studentName}</span>
                          <button
                            onClick={() => handleStudentClick(r.studentName)}
                            className="p-0.5 text-gray-400 hover:text-emerald-600 rounded"
                            title="학생 정보 보기"
                          >
                            <Link2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      {/* 학교 */}
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            value={editValues.school || ''}
                            onChange={e => setEditValues({ ...editValues, school: e.target.value })}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                          />
                        ) : (r.school || '-')}
                      </td>
                      {/* 학년 */}
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.grade}</td>
                      {/* 수납명 */}
                      <td className="px-3 py-2 text-gray-700">
                        {isEditing ? (
                          <input
                            value={editValues.billingName || ''}
                            onChange={e => setEditValues({ ...editValues, billingName: e.target.value })}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                          />
                        ) : (
                          <div className="max-w-[200px] truncate" title={r.billingName}>
                            {r.billingName}
                          </div>
                        )}
                      </td>
                      {/* 청구액 */}
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editValues.billedAmount ?? 0}
                            onChange={e => setEditValues({ ...editValues, billedAmount: Number(e.target.value) })}
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-xs text-right"
                          />
                        ) : (
                          <span className="font-medium">{r.billedAmount.toLocaleString()}</span>
                        )}
                      </td>
                      {/* 할인 */}
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editValues.discountAmount ?? 0}
                            onChange={e => setEditValues({ ...editValues, discountAmount: Number(e.target.value) })}
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-xs text-right"
                          />
                        ) : (
                          <span className="text-orange-600">
                            {r.discountAmount > 0 ? `-${r.discountAmount.toLocaleString()}` : '-'}
                          </span>
                        )}
                      </td>
                      {/* 납부액 */}
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editValues.paidAmount ?? 0}
                            onChange={e => setEditValues({ ...editValues, paidAmount: Number(e.target.value) })}
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-xs text-right"
                          />
                        ) : (
                          <span className="text-emerald-600 font-medium">
                            {r.paidAmount > 0 ? r.paidAmount.toLocaleString() : '-'}
                          </span>
                        )}
                      </td>
                      {/* 미납액 */}
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {r.unpaidAmount > 0 ? (
                          <span className="text-red-600 font-medium">{r.unpaidAmount.toLocaleString()}</span>
                        ) : '-'}
                      </td>
                      {/* 상태 */}
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <span className={`inline-flex px-1.5 py-0.5 rounded-sm text-[10px] font-medium ${
                          r.status === 'paid'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-yellow-50 text-yellow-700'
                        }`}>
                          {r.status === 'paid' ? '납부완료' : '미납'}
                        </span>
                      </td>
                      {/* 담임강사 */}
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            value={editValues.teacher || ''}
                            onChange={e => setEditValues({ ...editValues, teacher: e.target.value })}
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
                          />
                        ) : (r.teacher || '-')}
                      </td>
                      {/* 메모 */}
                      <td className="px-3 py-2 text-gray-500">
                        {isEditing ? (
                          <input
                            value={editValues.memo || ''}
                            onChange={e => setEditValues({ ...editValues, memo: e.target.value })}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                          />
                        ) : (
                          <div className="max-w-[120px] truncate" title={r.memo}>
                            {r.memo || '-'}
                          </div>
                        )}
                      </td>
                      {/* 편집 버튼 */}
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {isEditing ? (
                          <>
                            <button
                              onClick={saveEdit}
                              className="text-xs text-blue-600 hover:text-blue-800 mr-2"
                            >저장</button>
                            <button
                              onClick={cancelEdit}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >취소</button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(r)}
                              className="text-xs text-blue-600 hover:text-blue-800 mr-2"
                            >수정</button>
                            <button
                              onClick={() => handleDelete(r.id)}
                              className="text-xs text-red-500 hover:text-red-700"
                            >삭제</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 페이지네이션 */}
        <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
      </main>

      {/* Modals */}
      {isFormOpen && (
        <BillingForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleFormSubmit}
          initialData={null}
          selectedMonth={selectedMonth || ''}
        />
      )}
      {isImportOpen && (
        <Suspense fallback={null}>
          <BillingImportModal
            isOpen={isImportOpen}
            onClose={() => setIsImportOpen(false)}
            onImport={handleImport}
            onNavigateToTextbooks={onNavigateToTextbooks ? (file: File) => {
              setIsImportOpen(false);
              onNavigateToTextbooks();
              void file;
            } : undefined}
          />
        </Suspense>
      )}
      {isMakeEduSyncOpen && (
        <Suspense fallback={null}>
          <MakeEduBillingSyncModal
            isOpen={isMakeEduSyncOpen}
            onClose={() => { setIsMakeEduSyncOpen(false); refreshPendingCount(); }}
            onSyncComplete={() => { refreshPendingCount(); }}
          />
        </Suspense>
      )}
      {isMakeEduReviewOpen && (
        <Suspense fallback={null}>
          <MakeEduBillingReviewModal
            isOpen={isMakeEduReviewOpen}
            onClose={() => { setIsMakeEduReviewOpen(false); refreshPendingCount(); }}
          />
        </Suspense>
      )}
      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
};

// ─── 작은 헬퍼 컴포넌트 ───
const SummaryCard: React.FC<{ label: string; value: number; color?: string; prefix?: string }> = ({
  label, value, color = 'text-gray-900', prefix = '',
}) => (
  <div className="rounded-sm border border-gray-200 bg-white p-3">
    <div className="text-xs text-gray-500">{label}</div>
    <div className={`text-base font-bold ${color}`}>
      {prefix}{value.toLocaleString()}원
    </div>
  </div>
);

export default BillingManager;
