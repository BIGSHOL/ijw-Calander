import React from 'react';
import { Edit2, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { BillingRecord } from '../../types';

interface BillingTableProps {
  records: BillingRecord[];
  isLoading: boolean;
  onEdit: (record: BillingRecord) => void;
  onDelete: (id: string) => void;
}

const statusConfig = {
  pending: { icon: Clock, color: 'text-yellow-600 bg-yellow-50', label: '미납' },
  paid: { icon: CheckCircle, color: 'text-green-600 bg-green-50', label: '납부완료' },
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
        <p>수납 내역이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">이름</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">학년</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">수납명</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">청구액</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">할인</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">납부액</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">미납액</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">상태</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">결제수단</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">수납일</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {records.map((record) => {
              const status = statusConfig[record.status] || statusConfig.pending;
              const StatusIcon = status.icon;

              return (
                <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{record.studentName}</div>
                    <div className="text-xs text-gray-400">{record.school}</div>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {record.grade}
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm text-gray-900 max-w-[250px] truncate" title={record.billingName}>
                      {record.billingName}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-medium whitespace-nowrap">
                    {record.billedAmount.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-gray-500 whitespace-nowrap">
                    {record.discountAmount > 0 ? `-${record.discountAmount.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-medium text-emerald-600 whitespace-nowrap">
                    {record.paidAmount > 0 ? record.paidAmount.toLocaleString() : '-'}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-medium whitespace-nowrap">
                    {record.unpaidAmount > 0 ? (
                      <span className="text-orange-600">{record.unpaidAmount.toLocaleString()}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {record.paymentMethod || '-'}
                    {record.cardCompany && (
                      <span className="text-xs text-gray-400 ml-1">({record.cardCompany})</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-sm text-gray-600 whitespace-nowrap">
                    {record.paidDate || '-'}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
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
    </div>
  );
};
