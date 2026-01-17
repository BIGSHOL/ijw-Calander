import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface DailyConsultationStat {
  date: string;
  parentCount: number;
  studentCount: number;
  total: number;
}

interface CounselingOverviewProps {
  data: DailyConsultationStat[];
  loading?: boolean;
}

/**
 * 일별 상담 현황 차트 컴포넌트
 * - Recharts 기반 스택형 막대 차트
 * - 학부모/학생 상담 구분 표시
 */
const CounselingOverview: React.FC<CounselingOverviewProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
        <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-[#081429] mb-4">
        일별 상담 현황
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#6b7280', fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 12 }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
              formatter={(value: number, name: string) => [
                value,
                name === 'parentCount' ? '학부모 상담' : '학생 상담',
              ]}
              labelFormatter={(label) => {
                const date = new Date(label);
                return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
              }}
            />
            <Legend
              formatter={(value) =>
                value === 'parentCount' ? '학부모 상담' : '학생 상담'
              }
            />
            <Bar
              dataKey="parentCount"
              stackId="a"
              fill="#3b82f6"
              name="parentCount"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="studentCount"
              stackId="a"
              fill="#22c55e"
              name="studentCount"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CounselingOverview;
