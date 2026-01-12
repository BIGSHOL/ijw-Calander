import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle } from 'lucide-react';
import { BillingRecord } from '../../types';

interface BillingStatsProps {
  records: BillingRecord[];
  selectedMonth: string;
}

export const BillingStats: React.FC<BillingStatsProps> = ({ records, selectedMonth }) => {
  const stats = useMemo(() => {
    const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
    const paidAmount = records.reduce((sum, r) => sum + r.paidAmount, 0);
    const pendingCount = records.filter(r => r.status === 'pending' || r.status === 'partial').length;
    const overdueCount = records.filter(r => r.status === 'overdue').length;
    const collectionRate = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

    return {
      totalAmount,
      paidAmount,
      unpaidAmount: totalAmount - paidAmount,
      totalStudents: records.length,
      pendingCount,
      overdueCount,
      collectionRate,
    };
  }, [records]);

  const statCards = [
    {
      label: '총 청구액',
      value: `${stats.totalAmount.toLocaleString()}원`,
      icon: DollarSign,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      label: '수납액',
      value: `${stats.paidAmount.toLocaleString()}원`,
      icon: TrendingUp,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50',
      subValue: `${stats.collectionRate.toFixed(1)}%`,
    },
    {
      label: '미수금',
      value: `${stats.unpaidAmount.toLocaleString()}원`,
      icon: TrendingDown,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
    },
    {
      label: '대상 학생',
      value: `${stats.totalStudents}명`,
      icon: Users,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      subValue: stats.pendingCount > 0 ? `미납 ${stats.pendingCount}명` : undefined,
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

      {stats.overdueCount > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-700">
            연체 중인 학생이 {stats.overdueCount}명 있습니다.
          </span>
        </div>
      )}
    </div>
  );
};
