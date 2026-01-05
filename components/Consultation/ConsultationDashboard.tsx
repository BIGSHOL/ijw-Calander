import React, { useMemo, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { ConsultationRecord, ConsultationStatus, CONSULTATION_CHART_COLORS } from '../../types';
import { StatsCard } from './StatsCard';
import { Users, UserCheck, Percent, CreditCard } from 'lucide-react';

interface DashboardProps {
    data: ConsultationRecord[];
    month: 'all' | string;
    year?: number;
}

// Status options for chart
const STATUS_OPTIONS = Object.values(ConsultationStatus);

// Helper component for the new Donut Chart design with interactive legend
const DonutChartSection = ({ title, data, totalValue, totalLabel = "Total" }: { title: string, data: { name: string, value: number }[], totalValue: string | number, totalLabel?: string }) => {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const onPieEnter = (_: any, index: number) => {
        setActiveIndex(index);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col h-full">
            <h3 className="text-lg font-bold text-slate-800 mb-6">{title}</h3>
            <div className="flex flex-col sm:flex-row items-center justify-between h-auto sm:h-auto flex-1 gap-6">
                {/* Chart Side */}
                <div className="relative w-40 h-40 sm:w-56 sm:h-56 flex-shrink-0 mx-auto sm:mx-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                innerRadius={40}
                                outerRadius={60}
                                paddingAngle={2}
                                dataKey="value"
                                stroke="none"
                                onMouseEnter={onPieEnter}
                                onMouseLeave={() => setActiveIndex(null)}
                            >
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={CONSULTATION_CHART_COLORS[index % CONSULTATION_CHART_COLORS.length]}
                                        stroke={activeIndex === index ? '#fff' : 'none'}
                                        strokeWidth={2}
                                        style={{
                                            filter: activeIndex !== null && activeIndex !== index ? 'opacity(0.3)' : 'opacity(1)',
                                            transition: 'filter 0.3s ease',
                                            outline: 'none'
                                        }}
                                    />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>

                    {/* Center Text */}
                    <div
                        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-300"
                        style={{ opacity: activeIndex !== null ? 0.3 : 1 }}
                    >
                        <span className="text-slate-400 text-xs sm:text-sm font-medium">{totalLabel}</span>
                        <span className="text-xl sm:text-2xl font-bold text-slate-800">{totalValue}</span>
                    </div>
                </div>

                {/* Legend Side */}
                <div className="w-full sm:flex-1 flex flex-col justify-center space-y-2">
                    {data.map((entry, index) => (
                        <div
                            key={index}
                            onMouseEnter={() => setActiveIndex(index)}
                            onMouseLeave={() => setActiveIndex(null)}
                            className={`flex items-center justify-between text-sm p-2 sm:p-3 rounded-xl transition-all duration-300 cursor-pointer border ${activeIndex === index
                                ? 'bg-white border-indigo-200 shadow-md transform scale-[1.02] z-10'
                                : 'bg-transparent border-transparent hover:bg-slate-50'
                                }`}
                        >
                            <div className="flex items-center">
                                <div
                                    className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full mr-3 shadow-sm transition-all duration-300 ${activeIndex === index ? 'ring-2 ring-offset-2 ring-indigo-200' : ''}`}
                                    style={{ backgroundColor: CONSULTATION_CHART_COLORS[index % CONSULTATION_CHART_COLORS.length] }}
                                ></div>
                                <span className={`font-medium transition-colors text-xs sm:text-sm ${activeIndex === index ? 'text-slate-900' : 'text-slate-600'}`}>
                                    {entry.name}
                                </span>
                            </div>
                            <span className={`font-bold px-2 py-0.5 rounded-lg text-xs transition-colors ${activeIndex === index
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600'
                                }`}>
                                {entry.value}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export const ConsultationDashboard: React.FC<DashboardProps> = ({ data, month, year = new Date().getFullYear() }) => {
    // Constants for grouping
    const registeredStatuses = useMemo(() => [
        ConsultationStatus.EngMathRegistered,
        ConsultationStatus.MathRegistered,
        ConsultationStatus.EngRegistered
    ], []);

    const pendingStatuses = useMemo(() => [
        ConsultationStatus.PendingThisMonth,
        ConsultationStatus.PendingFuture
    ], []);

    // Filter data based on selected month
    const filteredData = useMemo(() => {
        if (month === 'all') return data;
        const monthNum = parseInt(month, 10);
        return data.filter(r => {
            const date = new Date(r.consultationDate);
            return date.getMonth() + 1 === monthNum && date.getFullYear() === year;
        });
    }, [data, month, year]);

    // Helper to calculate stats for a dataset
    const getStats = (dataset: ConsultationRecord[]) => {
        const total = dataset.length;
        const registered = dataset.filter(r => registeredStatuses.includes(r.status)).length;
        const pending = dataset.filter(r => pendingStatuses.includes(r.status)).length;
        const conversion = total > 0 ? (registered / total) * 100 : 0;

        const revenue = dataset.reduce((acc, r) => {
            if (!r.paymentAmount) return acc;
            // Handle both string and number types
            const amtStr = typeof r.paymentAmount === 'string' ? r.paymentAmount : String(r.paymentAmount);
            const amt = parseInt(amtStr.replace(/,/g, ''), 10);
            return acc + (isNaN(amt) ? 0 : amt);
        }, 0);

        return { total, registered, pending, conversion, revenue };
    };

    const currentStats = useMemo(() => getStats(filteredData), [filteredData]);

    // Previous Month Stats for Trends
    const prevMonthStats = useMemo(() => {
        if (month === 'all') return null;
        const monthNum = parseInt(month, 10);
        const prevMonthNum = monthNum === 1 ? 12 : monthNum - 1;
        const prevYear = monthNum === 1 ? year - 1 : year;

        const prevData = data.filter(r => {
            const date = new Date(r.consultationDate);
            return date.getMonth() + 1 === prevMonthNum && date.getFullYear() === prevYear;
        });

        if (prevData.length === 0) return null;
        return getStats(prevData);
    }, [data, month, year]);

    // Calculate Trends
    const trends = useMemo(() => {
        if (!prevMonthStats) return { total: undefined, registered: undefined, conversion: undefined, revenue: undefined };

        const calcTrend = (curr: number, prev: number) => prev === 0 ? 0 : ((curr - prev) / prev) * 100;

        return {
            total: calcTrend(currentStats.total, prevMonthStats.total),
            registered: calcTrend(currentStats.registered, prevMonthStats.registered),
            conversion: calcTrend(currentStats.conversion, prevMonthStats.conversion),
            revenue: calcTrend(currentStats.revenue, prevMonthStats.revenue)
        };
    }, [currentStats, prevMonthStats]);


    // Chart Data: Status Distribution
    const statusData = useMemo(() => {
        return STATUS_OPTIONS.map(status => ({
            name: status,
            value: filteredData.filter(r => r.status === status).length
        })).filter(d => d.value > 0);
    }, [filteredData]);

    // Chart Data: Subject Distribution
    const subjectData = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredData.forEach(r => {
            counts[r.subject] = (counts[r.subject] || 0) + 1;
        });
        return Object.keys(counts).map(key => ({ name: key, value: counts[key] })).sort((a, b) => b.value - a.value);
    }, [filteredData]);

    // Chart Data: Daily Trend
    const dailyData = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredData.forEach(r => {
            const day = new Date(r.consultationDate).getDate();
            const label = `${day}일`;
            counts[label] = (counts[label] || 0) + 1;
        });
        return Object.keys(counts)
            .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
            .map(key => ({ name: key, consultations: counts[key] }));
    }, [filteredData]);

    const monthDisplay = month === 'all' ? '전체 기간' : `${month}월`;

    return (
        <div className="space-y-6 animate-fade-in pb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-3">
                <h2 className="text-xl font-bold text-slate-800 hidden md:block">
                    {monthDisplay} 운영 대시보드
                </h2>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatsCard
                    title="총 상담"
                    value={`${currentStats.total}`}
                    trend={trends.total}
                    trendLabel="전월"
                    icon={<Users className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />}
                    colorClass="bg-indigo-500"
                />
                <StatsCard
                    title="등록 완료"
                    value={`${currentStats.registered}`}
                    trend={trends.registered}
                    trendLabel="전월"
                    icon={<UserCheck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />}
                    colorClass="bg-emerald-500"
                />
                <StatsCard
                    title="등록 전환율"
                    value={`${currentStats.conversion.toFixed(1)}%`}
                    trend={trends.conversion}
                    trendLabel="전월"
                    icon={<Percent className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />}
                    colorClass="bg-amber-500"
                />
                <StatsCard
                    title="예상 매출"
                    value={`₩${(currentStats.revenue / 10000).toLocaleString()}만`}
                    trend={trends.revenue}
                    trendLabel="전월"
                    icon={<CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />}
                    colorClass="bg-blue-500"
                />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <DonutChartSection
                    title="등록 현황 상세"
                    data={statusData}
                    totalValue={`${currentStats.total}건`}
                    totalLabel="총 상담"
                />
                <DonutChartSection
                    title="과목별 상담 분포"
                    data={subjectData}
                    totalValue={`${currentStats.total}건`}
                    totalLabel="총 상담"
                />
            </div>

            {/* Charts Row 2 */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-4">일별 상담 추이</h3>
                <div className="h-56 sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number) => [`${value}회`, '상담횟수']}
                            />
                            <Line type="monotone" dataKey="consultations" stroke="#4f46e5" strokeWidth={3} dot={{ fill: '#4f46e5', r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
