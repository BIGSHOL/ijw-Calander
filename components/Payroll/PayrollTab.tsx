import React, { useState, useMemo } from 'react';
import { UserProfile } from '../../types';
import { usePayroll } from '../../hooks/usePayroll';
import { Search, Plus, Download, CheckCircle, Clock, DollarSign } from 'lucide-react';

interface PayrollTabProps {
  currentUser?: UserProfile | null;
}

const STATUS_LABELS: Record<string, { label: string; style: string }> = {
  draft: { label: '작성 중', style: 'bg-gray-100 text-gray-600' },
  confirmed: { label: '확정', style: 'bg-blue-100 text-blue-700' },
  paid: { label: '지급 완료', style: 'bg-green-100 text-green-700' },
};

export default function PayrollTab({ currentUser }: PayrollTabProps) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { records, isLoading, createRecord, updateRecord } = usePayroll(selectedMonth);

  const filteredRecords = useMemo(() => {
    if (!records) return [];
    return records.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchQuery) {
        return r.staffName.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [records, statusFilter, searchQuery]);

  const summary = useMemo(() => {
    if (!filteredRecords.length) return { totalNet: 0, totalBase: 0, count: 0 };
    return {
      totalNet: filteredRecords.reduce((sum, r) => sum + r.netPay, 0),
      totalBase: filteredRecords.reduce((sum, r) => sum + r.baseSalary, 0),
      count: filteredRecords.length,
    };
  }, [filteredRecords]);

  const formatCurrency = (n: number) => n.toLocaleString('ko-KR') + '원';

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900">급여 관리</h1>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 transition-colors">
            <Download size={14} />
            엑셀 내보내기
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors">
            <Plus size={14} />
            급여 등록
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white border-b px-4 py-2 grid grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <DollarSign size={14} className="text-gray-400" />
          <div>
            <div className="text-xxs text-gray-500">총 기본급</div>
            <div className="text-sm font-bold">{formatCurrency(summary.totalBase)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle size={14} className="text-green-500" />
          <div>
            <div className="text-xxs text-gray-500">총 실수령액</div>
            <div className="text-sm font-bold text-green-700">{formatCurrency(summary.totalNet)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-gray-400" />
          <div>
            <div className="text-xxs text-gray-500">대상 인원</div>
            <div className="text-sm font-bold">{summary.count}명</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="직원명 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1">
          {['all', 'draft', 'confirmed', 'paid'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? '전체' : STATUS_LABELS[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center text-gray-400 text-sm py-8">로딩 중...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <DollarSign size={32} className="mx-auto mb-2" />
            <p className="text-sm">급여 내역이 없습니다</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">직원명</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500">기본급</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500">수당</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500">공제</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500">실수령액</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-500">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRecords.map(record => (
                  <tr key={record.id} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-3 py-2 font-medium text-gray-900">{record.staffName}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(record.baseSalary)}</td>
                    <td className="px-3 py-2 text-right text-blue-600">{formatCurrency(record.totalAllowance)}</td>
                    <td className="px-3 py-2 text-right text-red-600">-{formatCurrency(record.totalDeduction)}</td>
                    <td className="px-3 py-2 text-right font-bold">{formatCurrency(record.netPay)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xxs px-1.5 py-0.5 rounded ${STATUS_LABELS[record.status]?.style}`}>
                        {STATUS_LABELS[record.status]?.label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
