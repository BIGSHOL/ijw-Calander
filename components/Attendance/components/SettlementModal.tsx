import React, { useEffect, useState } from 'react';
import { IncentiveConfig, MonthlySettlement, SalaryConfig } from '../types';
import { formatCurrency } from '../utils';
import { X, Gift, CheckCircle2, Circle, Calculator, Coins, Lock, Unlock, AlertTriangle } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    monthStr: string; // YYYY-MM
    baseSalary: number;
    droppedStudentRate: number;
    incentiveConfig: IncentiveConfig;
    salaryConfig: SalaryConfig;  // 현재 전역 급여 설정 (스냅샷용)
    data: MonthlySettlement;
    onUpdate: (data: MonthlySettlement) => void;
}

const SettlementModal: React.FC<Props> = ({
    isOpen, onClose, monthStr, baseSalary, droppedStudentRate, incentiveConfig, salaryConfig, data, onUpdate
}) => {
    const [localData, setLocalData] = useState<MonthlySettlement>(data);
    const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);

    useEffect(() => {
        setLocalData(data);
    }, [data, isOpen]);

    if (!isOpen) return null;

    const isFinalized = localData.isFinalized === true;

    const handleToggle = (field: 'hasBlog' | 'hasRetention') => {
        // 인센티브 토글은 확정 후에도 수정 가능 (급여 단가/비율만 잠금)
        setLocalData(prev => {
            const newData = { ...prev, [field]: !prev[field] };
            onUpdate(newData);
            return newData;
        });
    };

    const handleChange = (field: keyof MonthlySettlement, value: any) => {
        // 기타 인센티브/메모는 확정 후에도 수정 가능 (급여 단가/비율만 잠금)
        setLocalData(prev => {
            const newData = { ...prev, [field]: value };
            onUpdate(newData);
            return newData;
        });
    };

    // 정산 확정하기
    const handleFinalize = () => {
        const finalizedData: MonthlySettlement = {
            ...localData,
            isFinalized: true,
            finalizedAt: new Date().toISOString(),
            salaryConfig: salaryConfig, // 현재 전역 설정 스냅샷 저장
        };
        onUpdate(finalizedData);
        setLocalData(finalizedData);
        setShowFinalizeConfirm(false);
    };

    // 확정 해제하기
    const handleUnfinalize = () => {
        if (!confirm('정산 확정을 해제하시겠습니까?\n\n해제하면 현재 전역 급여 설정으로 다시 계산됩니다.')) return;
        const unfinalizedData: MonthlySettlement = {
            ...localData,
            isFinalized: false,
            finalizedAt: undefined,
            salaryConfig: undefined,
        };
        onUpdate(unfinalizedData);
        setLocalData(unfinalizedData);
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

                    {/* Finalization Status & Actions */}
                    <div className="pt-4 border-t border-gray-200 mt-4">
                        {isFinalized ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                                    <Lock className="text-green-600" size={20} />
                                    <div className="flex-1">
                                        <p className="font-bold text-green-700">정산 확정됨</p>
                                        <p className="text-xs text-green-600">
                                            {localData.finalizedAt && new Date(localData.finalizedAt).toLocaleDateString('ko-KR', {
                                                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                </div>
                                {localData.salaryConfig && (
                                    <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                                        <p className="font-medium mb-1">적용된 급여 설정:</p>
                                        <p>수수료: {localData.salaryConfig.academyFee}%</p>
                                        <p>과정: {localData.salaryConfig.items.map(i => `${i.name} ${formatCurrency(i.fixedRate)}`).join(', ')}</p>
                                    </div>
                                )}
                                <button
                                    onClick={handleUnfinalize}
                                    className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Unlock size={18} />
                                    확정 해제
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                    <AlertTriangle className="text-amber-600" size={20} />
                                    <div className="flex-1">
                                        <p className="font-bold text-amber-700">미확정</p>
                                        <p className="text-xs text-amber-600">급여 설정 변경 시 이 달의 계산도 변경됩니다.</p>
                                    </div>
                                </div>
                                {showFinalizeConfirm ? (
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-2">
                                        <p className="text-sm text-blue-800">
                                            <strong>정산을 확정하시겠습니까?</strong><br />
                                            현재 급여 설정이 이 달에 고정되어, 이후 설정 변경에 영향받지 않습니다.
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleFinalize}
                                                className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
                                            >
                                                확정하기
                                            </button>
                                            <button
                                                onClick={() => setShowFinalizeConfirm(false)}
                                                className="flex-1 py-2 px-3 bg-white hover:bg-gray-50 text-gray-700 rounded-lg font-medium text-sm border border-gray-300 transition-colors"
                                            >
                                                취소
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowFinalizeConfirm(true)}
                                        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Lock size={18} />
                                        정산 확정하기
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettlementModal;