import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { UserProfile } from '../../types';
import { useStudents } from '../../hooks/useStudents';
import { useStaff } from '../../hooks/useStaff';
import { usePermissions } from '../../hooks/usePermissions';
import { useWithdrawalFilters, WithdrawalEntry } from '../../hooks/useWithdrawalFilters';
import { WITHDRAWAL_REASONS, SUBJECT_OPTIONS, SORT_OPTIONS, ENTRY_TYPE_OPTIONS } from '../../constants/withdrawal';
import WithdrawalStudentList from './WithdrawalStudentList';
import WithdrawalStudentDetail from './WithdrawalStudentDetail';
import { Search, X, RefreshCw, ArrowLeft, List, BarChart3, SlidersHorizontal } from 'lucide-react';
import { TabSubNavigation } from '../Common/TabSubNavigation';
import { TabButton } from '../Common/TabButton';

// Lazy load Dashboard
const WithdrawalDashboard = lazy(() => import('../Dashboard/WithdrawalDashboard'));

type SubTab = 'list' | 'stats';

interface WithdrawalManagementTabProps {
  currentUser?: UserProfile | null;
}

const WithdrawalManagementTab: React.FC<WithdrawalManagementTabProps> = ({ currentUser }) => {
  const { hasPermission } = usePermissions(currentUser);
  const isMaster = currentUser?.role === 'master';
  const canEdit = isMaster || hasPermission('withdrawal.edit');
  const canReactivate = isMaster || hasPermission('withdrawal.reactivate');

  const { students, loading, refreshStudents } = useStudents(true);
  const { staff } = useStaff();
  const {
    filters,
    filteredEntries,
    counts,
    updateFilter,
    resetFilters,
  } = useWithdrawalFilters(students);

  const [selectedEntry, setSelectedEntry] = useState<WithdrawalEntry | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>('stats'); // 기본값: 통계
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 선택된 항목 자동 업데이트
  useEffect(() => {
    if (selectedEntry) {
      // 현재 filteredEntries에서 동일 학생+유형 찾기
      const updated = filteredEntries.find(
        e => e.student.id === selectedEntry.student.id && e.type === selectedEntry.type
      );
      if (updated) {
        setSelectedEntry(updated);
      } else {
        // 더 이상 목록에 없음 (복구됨/변경됨)
        setSelectedEntry(null);
      }
    }
  }, [filteredEntries, selectedEntry]);

  // 강사 목록 (퇴원생+수강종료 학생의 enrollments에서 사용되는 staffId)
  const teacherOptions = useMemo(() => {
    const staffIds = new Set<string>();
    for (const entry of filteredEntries) {
      for (const e of entry.endedEnrollments) {
        if (e.staffId) staffIds.add(e.staffId);
      }
    }
    return staff
      .filter(s => staffIds.has(s.id))
      .map(s => ({ value: s.id, label: s.name }));
  }, [filteredEntries, staff]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshStudents();
    } finally {
      setIsRefreshing(false);
    }
  };

  // 활성 필터 개수
  const activeFilterCount = [
    filters.entryType,
    filters.subject,
    filters.staffId,
    filters.reason,
    filters.dateFrom,
    filters.dateTo,
  ].filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-[#081429] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 통합 헤더 - Light Theme (수학 시간표 스타일) */}
      <TabSubNavigation
        variant="compact"
        theme="light"
        showBorder={true}
        className="justify-between px-4 relative"
      >
        {/* Left: Sub Tabs */}
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-200 rounded-sm p-0.5">
            <TabButton
              active={subTab === 'stats'}
              onClick={() => setSubTab('stats')}
              theme="light"
              icon={<BarChart3 size={12} />}
            >
              통계
            </TabButton>
            <TabButton
              active={subTab === 'list'}
              onClick={() => setSubTab('list')}
              theme="light"
              icon={<List size={12} />}
            >
              목록
            </TabButton>
          </div>

          {/* 목록 탭일 때만 통계 표시 */}
          {subTab === 'list' && (
            <>
              <div className="w-px h-4 bg-gray-300"></div>
              <span className="text-xs text-gray-500">
                전체 <span className="font-bold text-gray-700">{counts.total}</span>명
                <span className="text-red-500 ml-1">(퇴원 {counts.withdrawn}명</span>
                <span className="text-amber-600"> / 수강종료 {counts.subjectEnded}명)</span>
              </span>
            </>
          )}
        </div>

        {/* Center: Title */}
        <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-black text-gray-800 tracking-tight">
          퇴원 관리
        </h1>

        {/* Right: Search + Filter (목록 탭만) */}
        {subTab === 'list' && (
          <div className="flex items-center gap-2">
            {/* 검색 */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                placeholder="이름 검색..."
                className="w-32 pl-7 pr-6 py-1 text-xs bg-white border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
              {filters.search && (
                <button
                  onClick={() => updateFilter('search', '')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="w-px h-4 bg-gray-300"></div>

            {/* 통합 필터 드롭다운 */}
            <div className="relative" ref={filterDropdownRef}>
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border text-xs font-medium transition-colors ${
                  activeFilterCount > 0
                    ? 'bg-accent border-accent text-primary'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <SlidersHorizontal size={12} />
                <span>필터</span>
                {activeFilterCount > 0 && (
                  <span className="bg-primary text-white text-micro w-4 h-4 rounded-full flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {showFilterDropdown && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-sm shadow-lg z-50 w-[300px] max-h-[450px] overflow-y-auto">
                  {/* 유형 */}
                  <div className="px-3 py-2 border-b border-gray-100">
                    <div className="text-xxs font-bold text-gray-600 mb-2">유형</div>
                    <select
                      value={filters.entryType}
                      onChange={(e) => updateFilter('entryType', e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-sm px-2 py-1.5 text-xs text-gray-700 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                    >
                      {ENTRY_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* 과목 */}
                  <div className="px-3 py-2 border-b border-gray-100">
                    <div className="text-xxs font-bold text-gray-600 mb-2">과목</div>
                    <select
                      value={filters.subject}
                      onChange={(e) => updateFilter('subject', e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-sm px-2 py-1.5 text-xs text-gray-700 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                    >
                      {SUBJECT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* 강사 */}
                  <div className="px-3 py-2 border-b border-gray-100">
                    <div className="text-xxs font-bold text-gray-600 mb-2">강사</div>
                    <select
                      value={filters.staffId}
                      onChange={(e) => updateFilter('staffId', e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-sm px-2 py-1.5 text-xs text-gray-700 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                    >
                      <option value="">전체 강사</option>
                      {teacherOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* 퇴원 사유 */}
                  <div className="px-3 py-2 border-b border-gray-100">
                    <div className="text-xxs font-bold text-gray-600 mb-2">퇴원 사유</div>
                    <select
                      value={filters.reason}
                      onChange={(e) => updateFilter('reason', e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-sm px-2 py-1.5 text-xs text-gray-700 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                    >
                      {WITHDRAWAL_REASONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* 기간 */}
                  <div className="px-3 py-2 border-b border-gray-100">
                    <div className="text-xxs font-bold text-gray-600 mb-2">기간</div>
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => updateFilter('dateFrom', e.target.value)}
                        className="flex-1 bg-white border border-gray-300 rounded-sm px-2 py-1.5 text-xs text-gray-700 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                      />
                      <span className="text-xs text-gray-400">~</span>
                      <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => updateFilter('dateTo', e.target.value)}
                        className="flex-1 bg-white border border-gray-300 rounded-sm px-2 py-1.5 text-xs text-gray-700 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                      />
                    </div>
                  </div>

                  {/* 정렬 */}
                  <div className="px-3 py-2 border-b border-gray-100">
                    <div className="text-xxs font-bold text-gray-600 mb-2">정렬</div>
                    <select
                      value={filters.sortBy}
                      onChange={(e) => updateFilter('sortBy', e.target.value as 'withdrawalDate' | 'name')}
                      className="w-full bg-white border border-gray-300 rounded-sm px-2 py-1.5 text-xs text-gray-700 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                    >
                      {SORT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* 초기화 버튼 */}
                  {activeFilterCount > 0 && (
                    <div className="px-3 py-2">
                      <button
                        onClick={resetFilters}
                        className="w-full px-3 py-1.5 rounded-sm text-xs text-red-500 hover:bg-red-50 flex items-center justify-center gap-1 border border-red-200"
                      >
                        <X size={12} />
                        필터 초기화
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 새로고침 */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-sm transition-colors disabled:opacity-50 border border-gray-300"
              title="새로고침"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}

        {/* 통계 탭일 때는 우측 비움 */}
        {subTab === 'stats' && <div />}
      </TabSubNavigation>

      {/* 통계 탭 */}
      {subTab === 'stats' ? (
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
          </div>
        }>
          <div className="flex-1 overflow-auto">
            <WithdrawalDashboard currentUser={currentUser} />
          </div>
        </Suspense>
      ) : (
      <>

      {/* 메인 콘텐츠: 좌측 목록 + 우측 상세 */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* 좌측 목록 */}
        <div className={`${selectedEntry ? 'hidden md:flex' : 'flex'} md:w-[30%] flex-col border-r overflow-hidden`} style={{ borderColor: 'rgba(8, 20, 41, 0.1)' }}>
          <WithdrawalStudentList
            entries={filteredEntries}
            selectedEntry={selectedEntry}
            onSelectEntry={setSelectedEntry}
          />
        </div>

        {/* 우측 상세 */}
        <div className={`${selectedEntry ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden`}>
          {selectedEntry ? (
            <>
              {/* 모바일 뒤로가기 */}
              <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b bg-white" style={{ borderColor: 'rgba(8, 20, 41, 0.15)' }}>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="p-1 hover:bg-gray-100 rounded-sm transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" style={{ color: 'rgb(8, 20, 41)' /* primary */ }} />
                </button>
                <span className="text-xs font-medium" style={{ color: 'rgb(8, 20, 41)' /* primary */ }}>{selectedEntry.student.name}</span>
              </div>
              <WithdrawalStudentDetail
                entry={selectedEntry}
                canEdit={canEdit}
                canReactivate={canReactivate}
                onReactivated={() => setSelectedEntry(null)}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-white">
              <div className="text-center text-gray-400">
                <div className="text-2xl mb-2">🚪</div>
                <p className="text-xs">좌측에서 학생을 선택하세요</p>
              </div>
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
};

export default WithdrawalManagementTab;
