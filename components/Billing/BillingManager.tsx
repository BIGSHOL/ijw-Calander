import React, { useState } from 'react';
import { DollarSign, Plus, Filter, Download, Search } from 'lucide-react';
import { BillingTable } from './BillingTable';
import { BillingForm } from './BillingForm';
import { BillingStats } from './BillingStats';
import { useBilling } from '../../hooks/useBilling';

interface BillingManagerProps {
  userProfile?: any;
}

const BillingManager: React.FC<BillingManagerProps> = ({ userProfile }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [editingRecord, setEditingRecord] = useState<any>(null);

  const { records, isLoading, createRecord, updateRecord, deleteRecord } = useBilling(selectedMonth);

  // 필터링된 레코드
  const filteredRecords = records.filter(record => {
    const matchesSearch = record.studentName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleEdit = (record: any) => {
    setEditingRecord(record);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingRecord(null);
  };

  const handleFormSubmit = async (data: any) => {
    if (editingRecord) {
      await updateRecord.mutateAsync({ id: editingRecord.id, updates: data });
    } else {
      await createRecord.mutateAsync(data);
    }
    handleFormClose();
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
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            청구서 생성
          </button>
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
              placeholder="학생 검색..."
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
              <option value="paid">완납</option>
              <option value="partial">부분납</option>
              <option value="overdue">연체</option>
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
    </div>
  );
};

export default BillingManager;
