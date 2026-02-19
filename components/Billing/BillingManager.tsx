import React, { useState, useMemo, lazy, Suspense } from 'react';
import { DollarSign, Plus, Filter, Download, Search, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { BillingTable } from './BillingTable';
import { VideoLoading } from '../Common/VideoLoading';
import { BillingForm } from './BillingForm';
import { BillingStats } from './BillingStats';
// bundle-defer-third-party: xlsx 라이브러리 포함 모달을 lazy loading (-60KB gzip)
const BillingImportModal = lazy(() => import('./BillingImportModal').then(m => ({ default: m.BillingImportModal })));
import { useBilling } from '../../hooks/useBilling';
import { useStudents } from '../../hooks/useStudents';
import { BillingRecord, UnifiedStudent } from '../../types';
import StudentDetailModal from '../StudentManagement/StudentDetailModal';

interface BillingManagerProps {
  userProfile?: any;
  onNavigateToTextbooks?: () => void;
}

const BillingManager: React.FC<BillingManagerProps> = ({ userProfile, onNavigateToTextbooks }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [editingRecord, setEditingRecord] = useState<BillingRecord | null>(null);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<UnifiedStudent | null>(null);

  const { records, isLoading, createRecord, updateRecord, deleteRecord, importRecords } =
    useBilling(selectedMonth);

  const { students } = useStudents(false); // 재원생만 조회

  // 필터링된 레코드
  const filteredRecords = useMemo(() => records.filter((record) => {
    const matchesSearch =
      record.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.billingName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [records, searchQuery, statusFilter]);

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRecords = filteredRecords.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleEdit = (record: BillingRecord) => {
    setEditingRecord(record);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingRecord(null);
  };

  const handleFormSubmit = async (data: Partial<BillingRecord>) => {
    if (editingRecord) {
      await updateRecord.mutateAsync({ id: editingRecord.id, updates: data });
    } else {
      await createRecord.mutateAsync(data as Omit<BillingRecord, 'id'>);
    }
    handleFormClose();
  };

  const handleImport = async (
    parsedRecords: Omit<BillingRecord, 'id'>[],
    month: string,
  ) => {
    const result = await importRecords.mutateAsync({ records: parsedRecords, month });
    // import된 데이터의 월로 자동 전환하여 결과가 바로 보이게
    if (month && month !== selectedMonth) {
      setSelectedMonth(month);
    }
    return result;
  };

  const handleStudentClick = (studentName: string) => {
    const student = students.find(s => s.name === studentName);
    if (student) {
      setSelectedStudent(student);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-sm flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">수납 관리</h1>
              <p className="text-sm text-gray-500">학원비 청구 및 수납 현황</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsImportOpen(true)}
              className="flex items-center gap-2 px-4 py-2 border border-emerald-600 text-emerald-600 rounded-sm hover:bg-emerald-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              xlsx 가져오기
            </button>
            <button
              onClick={() => setIsFormOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-sm hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              수납 추가
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">월:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 border rounded-sm text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="학생/수납명 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 border rounded-sm text-sm w-48"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 border rounded-sm text-sm"
            >
              <option value="all">전체 상태</option>
              <option value="pending">미납</option>
              <option value="paid">납부완료</option>
            </select>
          </div>

          <button className="flex items-center gap-2 px-3 py-1.5 border rounded-sm text-sm hover:bg-gray-50">
            <Download className="w-4 h-4" />
            내보내기
          </button>
        </div>
      </div>

      {/* Stats */}
      <BillingStats records={records} selectedMonth={selectedMonth} />

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <BillingTable
          records={paginatedRecords}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={(id) => deleteRecord.mutate(id)}
          onStudentClick={handleStudentClick}
        />

        {/* Pagination */}
        {filteredRecords.length > 0 && (
          <div className="p-3 rounded-sm shadow-sm border flex items-center justify-between mt-4" style={{ backgroundColor: 'white', borderColor: 'rgba(8, 20, 41, 0.15)' }}>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>페이지당</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="px-2 py-1 text-xs rounded-sm border transition-all"
                style={{ borderColor: 'rgba(8, 20, 41, 0.2)', color: 'rgb(8, 20, 41)' /* primary */, backgroundColor: 'white' }}
              >
                <option value={10}>10개</option>
                <option value={20}>20개</option>
                <option value={50}>50개</option>
                <option value={100}>100개</option>
              </select>
              <span className="text-xs hidden sm:inline" style={{ color: 'rgb(51, 78, 104)' /* primary-700 */ }}>
                {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredRecords.length)} / 총 {filteredRecords.length}개
              </span>
            </div>
            <nav className="flex items-center gap-1" aria-label="Pagination">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-2 py-1 rounded text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
                style={{ color: 'rgb(8, 20, 41)' /* primary */ }}
              >
                이전
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (safePage <= 3) pageNum = i + 1;
                  else if (safePage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = safePage - 2 + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-6 h-6 rounded-full text-xs font-bold transition-colors ${
                        safePage === pageNum ? 'text-primary' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      style={{ backgroundColor: safePage === pageNum ? '#fdb813' : 'transparent' }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-2 py-1 rounded text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
                style={{ color: 'rgb(8, 20, 41)' /* primary */ }}
              >
                다음
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <BillingForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          initialData={editingRecord}
          selectedMonth={selectedMonth}
        />
      )}

      {/* Import Modal */}
      {isImportOpen && (
        <Suspense fallback={<div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50"><VideoLoading className="h-screen" /></div>}>
          <BillingImportModal
            isOpen={isImportOpen}
            onClose={() => setIsImportOpen(false)}
            onImport={handleImport}
            onNavigateToTextbooks={onNavigateToTextbooks ? () => { setIsImportOpen(false); onNavigateToTextbooks(); } : undefined}
          />
        </Suspense>
      )}

      {/* Student Detail Modal */}
      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          currentUser={userProfile}
        />
      )}
    </div>
  );
};

export default BillingManager;
