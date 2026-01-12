import React from 'react';
import { Edit2, Trash2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { BillingRecord, BILLING_STATUS_LABELS } from '../../types';

interface BillingTableProps {
  records: BillingRecord[];
  isLoading: boolean;
  onEdit: (record: BillingRecord) => void;
  onDelete: (id: string) => void;
}

const statusConfig = {
  pending: { icon: Clock, color: 'text-yellow-600 bg-yellow-50', label: '미납' },
  partial: { icon: AlertCircle, color: 'text-orange-600 bg-orange-50', label: '부분납' },
  paid: { icon: CheckCircle, color: 'text-green-600 bg-green-50', label: '완납' },
  overdue: { icon: AlertCircle, color: 'text-red-600 bg-red-50', label: '연체' },
};

export const BillingTable: React.FC<BillingTableProps> = ({
  records,
  isLoading,
  onEdit,
  onDelete,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
        <p>청구 내역이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">학생</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">항목</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">청구액</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">납부액</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">상태</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">납부일</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">관리</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {records.map((record) => {
            const status = statusConfig[record.status];
            const StatusIcon = status.icon;

            return (
              <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{record.studentName}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {record.items.map((item, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                        {item.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {record.amount.toLocaleString()}원
                </td>
                <td className="px-4 py-3 text-right">
                  {record.paidAmount.toLocaleString()}원
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-sm text-gray-600">
                  {record.paidDate || '-'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onEdit(record)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(record.id)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
