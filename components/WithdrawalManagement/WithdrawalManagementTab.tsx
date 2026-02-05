import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile } from '../../types';
import { useStudents } from '../../hooks/useStudents';
import { useStaff } from '../../hooks/useStaff';
import { usePermissions } from '../../hooks/usePermissions';
import { useWithdrawalFilters, WithdrawalEntry } from '../../hooks/useWithdrawalFilters';
import { WITHDRAWAL_REASONS, SUBJECT_OPTIONS, SORT_OPTIONS, ENTRY_TYPE_OPTIONS } from '../../constants/withdrawal';
import WithdrawalStudentList from './WithdrawalStudentList';
import WithdrawalStudentDetail from './WithdrawalStudentDetail';
import { Search, X, Filter, RefreshCw, ArrowLeft } from 'lucide-react';

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
  const [showFilters, setShowFilters] = useState(false);

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
      {/* 상단 필터 바 */}
      <div className="bg-white border-b px-3 py-2 space-y-2" style={{ borderColor: 'rgba(8, 20, 41, 0.15)' }}>
        {/* 검색 + 필터 토글 + 새로고침 */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              placeholder="이름 검색..."
              className="w-full pl-7 pr-7 py-1.5 text-xs border rounded-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              style={{ borderColor: 'rgba(8, 20, 41, 0.2)' }}
            />
            {filters.search && (
              <button
                onClick={() => updateFilter('search', '')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-sm border transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-primary border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>필터</span>
            {activeFilterCount > 0 && (
              <span className="bg-red-500 text-white text-micro w-4 h-4 rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-sm transition-colors disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 확장 필터 영역 */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
            {/* 유형 */}
            <select
              value={filters.entryType}
              onChange={(e) => updateFilter('entryType', e.target.value)}
              className="text-xs border rounded-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ borderColor: 'rgba(8, 20, 41, 0.2)' }}
            >
              {ENTRY_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* 과목 */}
            <select
              value={filters.subject}
              onChange={(e) => updateFilter('subject', e.target.value)}
              className="text-xs border rounded-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ borderColor: 'rgba(8, 20, 41, 0.2)' }}
            >
              {SUBJECT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* 강사 */}
            <select
              value={filters.staffId}
              onChange={(e) => updateFilter('staffId', e.target.value)}
              className="text-xs border rounded-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ borderColor: 'rgba(8, 20, 41, 0.2)' }}
            >
              <option value="">전체 강사</option>
              {teacherOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* 퇴원 사유 */}
            <select
              value={filters.reason}
              onChange={(e) => updateFilter('reason', e.target.value)}
              className="text-xs border rounded-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ borderColor: 'rgba(8, 20, 41, 0.2)' }}
            >
              {WITHDRAWAL_REASONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* 기간 필터 */}
            <div className="col-span-2 flex items-center gap-1">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter('dateFrom', e.target.value)}
                className="flex-1 text-xs border rounded-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                style={{ borderColor: 'rgba(8, 20, 41, 0.2)' }}
              />
              <span className="text-xs text-gray-400">~</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter('dateTo', e.target.value)}
                className="flex-1 text-xs border rounded-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                style={{ borderColor: 'rgba(8, 20, 41, 0.2)' }}
              />
            </div>

            {/* 정렬 */}
            <select
              value={filters.sortBy}
              onChange={(e) => updateFilter('sortBy', e.target.value as 'withdrawalDate' | 'name')}
              className="text-xs border rounded-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ borderColor: 'rgba(8, 20, 41, 0.2)' }}
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* 필터 초기화 */}
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 py-1 rounded-sm transition-colors"
              >
                필터 초기화
              </button>
            )}
          </div>
        )}

        {/* 요약 정보 */}
        <div className="flex items-center gap-2 text-micro text-gray-400">
          <span>전체: {counts.total}명</span>
          <span className="text-red-400">(퇴원 {counts.withdrawn}명</span>
          <span className="text-amber-500">/ 수강종료 {counts.subjectEnded}명)</span>
          {filteredEntries.length !== counts.total && (
            <span>| 필터 적용: {filteredEntries.length}명</span>
          )}
        </div>
      </div>

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
    </div>
  );
};

export default WithdrawalManagementTab;
