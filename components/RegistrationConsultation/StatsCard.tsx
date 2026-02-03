import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface StatsCardProps {
    title: string;
    value: string | number;
    trend?: number; // percentage change
    trendValue?: number; // actual count change (e.g., +5 or -3)
    trendLabel?: string;
    icon: React.ReactNode;
    colorClass: string;
    noDataLabel?: string; // Label to show when no previous data
}

export const StatsCard: React.FC<StatsCardProps> = ({
    title,
    value,
    trend,
    trendValue,
    trendLabel,
    icon,
    colorClass,
    noDataLabel = '-데이터 없음-'
}) => {
    const hasTrendData = trend !== undefined;

    return (
        <div className="bg-white rounded-sm shadow-sm p-1.5 border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-0.5">
                <div>
                    <h3 className="text-xxs font-medium text-slate-500 mb-0.5">{title}</h3>
                    <div className="text-base font-bold text-slate-900">{value}</div>
                </div>
                <div className={`p-1 rounded-sm ${colorClass} bg-opacity-10 text-opacity-100`}>
                    {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-3.5 h-3.5' })}
                </div>
            </div>

            <div className="flex items-center text-xxs">
                {hasTrendData ? (
                    <>
                        <span className={`flex items-center font-medium ${trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                            {trend > 0 ? <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" /> : trend < 0 ? <ArrowDownRight className="w-2.5 h-2.5 mr-0.5" /> : <Minus className="w-2.5 h-2.5 mr-0.5" />}
                            {trendValue !== undefined && (
                                <span className="mr-0.5">
                                    {trendValue > 0 ? `+${trendValue}` : trendValue}건
                                </span>
                            )}
                            ({Math.abs(trend).toFixed(1)}%)
                        </span>
                        {trendLabel && <span className="text-slate-400 ml-1.5">{trendLabel}</span>}
                    </>
                ) : (
                    <span className="text-slate-400">{noDataLabel}</span>
                )}
            </div>
        </div>
    );
};
