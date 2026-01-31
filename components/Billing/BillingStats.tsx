import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle } from 'lucide-react';
import { BillingRecord } from '../../types';

interface BillingStatsProps {
  records: BillingRecord[];
  selectedMonth: string;
}

export const BillingStats: React.FC<BillingStatsProps> = ({ records, selectedMonth }) => {
  const stats = useMemo(() => {
    const totalBilled = records.reduce((sum, r) => sum + r.billedAmount, 0);
    const totalDiscount = records.reduce((sum, r) => sum + r.discountAmount, 0);
    const totalPaid = records.reduce((sum, r) => sum + r.paidAmount, 0);
    const totalUnpaid = records.reduce((sum, r) => sum + r.unpaidAmount, 0);
    const pendingCount = records.filter((r) => r.status === 'pending').length;
    const paidCount = records.filter((r) => r.status === 'paid').length;
    const uniqueStudents = new Set(records.map((r) => r.externalStudentId || r.studentName)).size;
    const collectionRate = totalBilled > 0 ? (totalPaid / (totalBilled - totalDiscount)) * 100 : 0;

    return {
      totalBilled,
      totalDiscount,
      totalPaid,
      totalUnpaid,
      pendingCount,
      paidCount,
      uniqueStudents,
      collectionRate: Math.min(collectionRate, 100),
    };
  }, [records]);

  const statCards = [
    {
      label: '총 청구액',
      value: `${stats.totalBilled.toLocaleString()}원`,
      icon: DollarSign,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      subValue: stats.totalDiscount > 0 ? `할인 ${stats.totalDiscount.toLocaleString()}원` : undefined,
    },
    {
      label: '수납액',
      value: `${stats.totalPaid.toLocaleString()}원`,
      icon: TrendingUp,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50',
      subValue: `수납률 ${stats.collectionRate.toFixed(1)}%`,
    },
    {
      label: '미수금',
      value: `${stats.totalUnpaid.toLocaleString()}원`,
      icon: TrendingDown,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      subValue: stats.pendingCount > 0 ? `${stats.pendingCount}건 미납` : undefined,
    },
    {
      label: '대상 학생',
      value: `${stats.uniqueStudents}명`,
      icon: Users,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      subValue: `총 ${records.length}건`,
    },
  ];

  return (
    <div className="px-6 py-4 bg-white border-b">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className={`p-4 rounded-xl ${stat.bgColor}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                  {stat.subValue && (
                    <p className="text-xs text-gray-600">{stat.subValue}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {stats.pendingCount > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-600" />
          <span className="text-sm text-yellow-700">
            미납 건이 {stats.pendingCount}건 ({stats.totalUnpaid.toLocaleString()}원) 있습니다.
          </span>
        </div>
      )}
    </div>
  );
};
