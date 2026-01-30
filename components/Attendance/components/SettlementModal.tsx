import React, { useEffect, useState } from 'react';
import { IncentiveConfig, MonthlySettlement } from '../types';
import { formatCurrency } from '../utils';
import { X, Gift, CheckCircle2, Circle, Calculator, Coins } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    monthStr: string; // YYYY-MM
    baseSalary: number;
    droppedStudentRate: number;
    incentiveConfig: IncentiveConfig;
    data: MonthlySettlement;
    onUpdate: (data: MonthlySettlement) => void;
}

const SettlementModal: React.FC<Props> = ({
    isOpen, onClose, monthStr, baseSalary, droppedStudentRate, incentiveConfig, data, onUpdate
}) => {
    const [localData, setLocalData] = useState<MonthlySettlement>(data);

    useEffect(() => {
        setLocalData(data);
    }, [data, isOpen]);

    if (!isOpen) return null;

    const handleToggle = (field: 'hasBlog' | 'hasRetention') => {
        setLocalData(prev => {
            const newData = { ...prev, [field]: !prev[field] };
            onUpdate(newData);
            return newData;
        });
    };

    const handleChange = (field: keyof MonthlySettlement, value: any) => {
        setLocalData(prev => {
            const newData = { ...prev, [field]: value };
            onUpdate(newData);
            return newData;
        });
    }

    // Calculate Totals
    // 블로그 인센티브: 고정금 또는 비율 가산 (blogType 없으면 기본 fixed)
    const blogBonusAmount = incentiveConfig.blogType === 'percentage'
        ? Math.round(baseSalary * (incentiveConfig.blogRate ?? 2) / 100)
        : (incentiveConfig.blogAmount ?? 0);
    const blogBonus = localData.hasBlog ? blogBonusAmount : 0;
    const retentionBonus = localData.hasRetention ? incentiveConfig.retentionAmount : 0;
    const otherBonus = localData.otherAmount || 0;
    const finalTotal = baseSalary + blogBonus + retentionBonus + otherBonus;

    const isRetentionEligible = droppedStudentRate <= incentiveConfig.retentionTargetRate;

    // 블로그 인센티브 표시 텍스트
    const blogBonusDisplay = incentiveConfig.blogType === 'percentage'
        ? `+${incentiveConfig.blogRate ?? 2}% (${formatCurrency(blogBonusAmount)})`
        : `+${formatCurrency(incentiveConfig.blogAmount ?? 0)}`;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-[#081429] text-white p-6 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Coins className="text-[#fdb813]" /> {monthStr} 정산
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">이번 달 급여 및 인센티브 내역을 확정합니다.</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-gray-300 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">

                    {/* Base Salary */}
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600 font-medium">기본 수업료 (출석 기반)</span>
                        <span className="text-lg font-bold text-gray-800">{formatCurrency(baseSalary)}</span>
                    </div>

                    {/* Incentives Section */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">인센티브 적용</h3>

                        {/* Blog Incentive */}
                        <div
                            onClick={() => handleToggle('hasBlog')}
                            className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer transition-all ${localData.hasBlog ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                {localData.hasBlog ?
                                    <CheckCircle2 className="text-blue-600" size={20} /> :
                                    <Circle className="text-gray-300" size={20} />
                                }
                                <div>
                                    <p className={`font-bold ${localData.hasBlog ? 'text-blue-700' : 'text-gray-600'}`}>블로그 포스팅</p>
                                    <p className="text-xs text-gray-400">
                                        기준: 월 1회 이상 작성
                                        {incentiveConfig.blogType === 'percentage' && (
                                            <span className="ml-1 text-blue-500">(비율 가산)</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <span className={`font-mono font-bold text-sm ${localData.hasBlog ? 'text-blue-600' : 'text-gray-300'}`}>
                                {blogBonusDisplay}
                            </span>
                        </div>

                        {/* Retention Incentive */}
                        <div
                            onClick={() => handleToggle('hasRetention')}
                            className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer transition-all ${localData.hasRetention ? 'bg-green-50 border-green-200 shadow-sm' : 'bg-white border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                {localData.hasRetention ?
                                    <CheckCircle2 className="text-green-600" size={20} /> :
                                    <Circle className="text-gray-300" size={20} />
                                }
                                <div>
                                    <p className={`font-bold ${localData.hasRetention ? 'text-green-700' : 'text-gray-600'}`}>퇴원율 달성</p>
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <span className="text-gray-400">목표 {incentiveConfig.retentionTargetRate}% 이하</span>
                                        {isRetentionEligible ?
                                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-bold">달성 (현재 {droppedStudentRate}%)</span> :
                                            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-bold">미달 (현재 {droppedStudentRate}%)</span>
                                        }
                                    </div>
                                </div>
                            </div>
                            <span className={`font-mono font-bold ${localData.hasRetention ? 'text-green-600' : 'text-gray-300'}`}>
                                +{formatCurrency(incentiveConfig.retentionAmount)}
                            </span>
                        </div>

                        {/* Other Incentive */}
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-gray-700 text-sm">기타 인센티브</span>
                                <input
                                    type="text"
                                    className="bg-white border border-gray-300 rounded px-2 py-1 text-right w-32 font-mono text-sm focus:ring-2 focus:ring-blue-500"
                                    placeholder="0"
                                    value={localData.otherAmount || ''}
                                    onChange={(e) => handleChange('otherAmount', parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0)}
                                />
                            </div>
                            <input
                                type="text"
                                className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-blue-400"
                                placeholder="메모 (예: 명절 상여금, 교재비 환급 등)"
                                value={localData.note || ''}
                                onChange={(e) => handleChange('note', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Total Footer */}
                    <div className="pt-4 border-t border-gray-200 mt-2">
                        <div className="flex justify-between items-end">
                            <span className="text-gray-500 font-bold pb-1">총 지급 예상액</span>
                            <span className="text-3xl font-extrabold text-[#081429] bg-gradient-to-r from-[#081429] to-blue-800 bg-clip-text text-transparent">
                                {formatCurrency(finalTotal)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettlementModal;