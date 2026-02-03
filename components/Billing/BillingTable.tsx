import React from 'react';
import { Edit2, Trash2, CheckCircle, Clock, AlertCircle, Link2 } from 'lucide-react';
import { BillingRecord } from '../../types';

interface BillingTableProps {
  records: BillingRecord[];
  isLoading: boolean;
  onEdit: (record: BillingRecord) => void;
  onDelete: (id: string) => void;
  onStudentClick?: (studentName: string) => void;
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
  onStudentClick,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-sm animate-spin" />
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
    <div className="rounded-sm shadow-sm border overflow-hidden" style={{ backgroundColor: 'white', borderColor: '#08142915' }}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-2 py-1.5 text-left text-xxs font-medium" style={{ color: '#373d41' }}>원생번호</th>
              <th className="px-2 py-1.5 text-left text-xxs font-medium" style={{ color: '#373d41' }}>이름</th>
              <th className="px-2 py-1.5 text-left text-xxs font-medium" style={{ color: '#373d41' }}>학년</th>
              <th className="px-2 py-1.5 text-left text-xxs font-medium" style={{ color: '#373d41' }}>학교</th>
              <th className="px-2 py-1.5 text-left text-xxs font-medium" style={{ color: '#373d41' }}>수납명</th>
              <th className="px-2 py-1.5 text-right text-xxs font-medium" style={{ color: '#373d41' }}>청구액</th>
              <th className="px-2 py-1.5 text-right text-xxs font-medium" style={{ color: '#373d41' }}>할인</th>
              <th className="px-2 py-1.5 text-right text-xxs font-medium" style={{ color: '#373d41' }}>적립금</th>
              <th className="px-2 py-1.5 text-right text-xxs font-medium" style={{ color: '#373d41' }}>납부액</th>
              <th className="px-2 py-1.5 text-right text-xxs font-medium" style={{ color: '#373d41' }}>미납액</th>
              <th className="px-2 py-1.5 text-center text-xxs font-medium" style={{ color: '#373d41' }}>상태</th>
              <th className="px-2 py-1.5 text-left text-xxs font-medium" style={{ color: '#373d41' }}>결제수단</th>
              <th className="px-2 py-1.5 text-center text-xxs font-medium" style={{ color: '#373d41' }}>수납일</th>
              <th className="px-2 py-1.5 text-left text-xxs font-medium" style={{ color: '#373d41' }}>담임강사</th>
              <th className="px-2 py-1.5 text-center text-xxs font-medium" style={{ color: '#373d41' }}>관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {records.length > 0 ? (
              records.map((record, idx) => {
                const status = statusConfig[record.status] || statusConfig.pending;
                const StatusIcon = status.icon;

                return (
                  <tr
                    key={record.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                    style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}
                  >
                    <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                      {record.externalStudentId || '-'}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="text-xs font-medium text-gray-900">{record.studentName}</div>
                        {onStudentClick && (
                          <button
                            onClick={() => onStudentClick(record.studentName)}
                            className="p-0.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            title="학생 정보 보기"
                          >
                            <Link2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap">
                      {record.grade}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap">
                      {record.school || '-'}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="text-xs text-gray-900 max-w-[200px] truncate" title={record.billingName}>
                        {record.billingName}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs font-medium whitespace-nowrap">
                      {record.billedAmount.toLocaleString()}
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs text-gray-500 whitespace-nowrap">
                      {record.discountAmount > 0 ? `-${record.discountAmount.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs text-gray-500 whitespace-nowrap">
                      {record.pointsUsed > 0 ? `-${record.pointsUsed.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs font-medium text-emerald-600 whitespace-nowrap">
                      {record.paidAmount > 0 ? record.paidAmount.toLocaleString() : '-'}
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs font-medium whitespace-nowrap">
                      {record.unpaidAmount > 0 ? (
                        <span className="text-orange-600">{record.unpaidAmount.toLocaleString()}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-xxs font-medium ${status.color}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap">
                      {record.paymentMethod || '-'}
                      {record.cardCompany && (
                        <div className="text-xxs text-gray-400">{record.cardCompany}</div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center text-xs text-gray-600 whitespace-nowrap">
                      {record.paidDate || '-'}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap">
                      {record.teacher || '-'}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onEdit(record)}
                          className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(record.id)}
                          className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={15} className="px-6 py-12 text-center" style={{ color: '#373d41' }}>
                  검색 결과가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
