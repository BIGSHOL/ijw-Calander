import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { TuitionEntry } from '../../types';

interface TuitionChartProps {
    data: TuitionEntry[];
}

export const TuitionChart: React.FC<TuitionChartProps> = ({ data }) => {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('ko-KR', { notation: "compact", maximumFractionDigits: 1 }).format(value);
    };

    return (
        <div className="h-[300px] w-full bg-white p-4 rounded-sm shadow-sm border border-gray-200" style={{ minHeight: '300px' }}>
            <h3 className="text-lg font-semibold text-[#081429] mb-4">사업장별 수강료 현황</h3>
            <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                <BarChart
                    data={data}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                        dataKey="academyName"
                        tick={{ fontSize: 12, fill: '#373d41' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tickFormatter={formatCurrency}
                        tick={{ fontSize: 12, fill: '#373d41' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        formatter={(value: number) => [`${value.toLocaleString()}원`, '수강료']}
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="projectedFee" radius={[4, 4, 0, 0]}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill="#fdb813" />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
