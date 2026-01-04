import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface StatsCardProps {
    title: string;
    value: string | number;
    trend?: number; // percentage change
    trendLabel?: string;
    icon: React.ReactNode;
    colorClass: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, trend, trendLabel, icon, colorClass }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2 sm:mb-4">
                <div>
                    <h3 className="text-xs sm:text-sm font-medium text-slate-500 mb-1">{title}</h3>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">{value}</div>
                </div>
                <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10 text-opacity-100`}>
                    {icon}
                </div>
            </div>

            {(trend !== undefined || trendLabel) && (
                <div className="flex items-center text-xs sm:text-sm">
                    {trend !== undefined && (
                        <span className={`flex items-center font-medium ${trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                            {trend > 0 ? <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> : trend < 0 ? <ArrowDownRight className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> : <Minus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />}
                            {Math.abs(trend).toFixed(1)}%
                        </span>
                    )}
                    <span className="text-slate-400 ml-2">{trendLabel}</span>
                </div>
            )}
        </div>
    );
};
