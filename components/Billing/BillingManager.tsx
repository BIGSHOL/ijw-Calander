import React, { useState, lazy, Suspense } from 'react';
import { DollarSign, Plus, Filter, Download, Search, Upload } from 'lucide-react';
import { BillingTable } from './BillingTable';
import { BillingForm } from './BillingForm';
import { BillingStats } from './BillingStats';
// bundle-defer-third-party: xlsx 라이브러리 포함 모달을 lazy loading (-60KB gzip)
const BillingImportModal = lazy(() => import('./BillingImportModal').then(m => ({ default: m.BillingImportModal })));
import { useBilling } from '../../hooks/useBilling';
import { BillingRecord } from '../../types';

interface BillingManagerProps {
  userProfile?: any;
}

const BillingManager: React.FC<BillingManagerProps> = ({ userProfile }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [editingRecord, setEditingRecord] = useState<BillingRecord | null>(null);

  const { records, isLoading, createRecord, updateRecord, deleteRecord, deleteByMonth, importRecords } =
    useBilling(selectedMonth);

  // 필터링된 레코드
  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      record.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.billingName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
    overwrite: boolean
  ) => {
    if (overwrite && month) {
      await deleteByMonth.mutateAsync(month);
    }
    await importRecords.mutateAsync(parsedRecords);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
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
              className="flex items-center gap-2 px-4 py-2 border border-emerald-600 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              xlsx 가져오기
            </button>
            <button
              onClick={() => setIsFormOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
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
              className="px-3 py-1.5 border rounded-lg text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="학생/수납명 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm w-48"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 border rounded-lg text-sm"
            >
              <option value="all">전체 상태</option>
              <option value="pending">미납</option>
              <option value="paid">납부완료</option>
            </select>
          </div>

          <button className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">
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
          records={filteredRecords}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={(id) => deleteRecord.mutate(id)}
        />
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
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white p-6 rounded-lg">로딩 중...</div></div>}>
          <BillingImportModal
            isOpen={isImportOpen}
            onClose={() => setIsImportOpen(false)}
            onImport={handleImport}
          />
        </Suspense>
      )}
    </div>
  );
};

export default BillingManager;
