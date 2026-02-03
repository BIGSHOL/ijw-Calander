import React, { useEffect, useState } from 'react';
import { IncentiveConfig, MonthlySettlement, SalaryConfig } from '../types';
import { formatCurrency } from '../utils';
import { X, Gift, CheckCircle2, Circle, DollarSign, Calendar, FileText, Clock, Lock, Unlock, AlertTriangle, Calculator, CreditCard, MessageSquare } from 'lucide-react';

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
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center pt-[8vh] p-4" onClick={onClose}>
            <div
                className="bg-white rounded-sm shadow-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                    <h2 className="text-sm font-bold text-[#081429] flex items-center gap-2">
                        <DollarSign size={16} className="text-[#fdb813]" />
                        {monthStr} 정산
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-3 space-y-2 overflow-y-auto">

                    {/* Section 1: 정산 정보 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <Calculator className="w-3 h-3 text-[#081429]" />
                            <h3 className="text-[#081429] font-bold text-xs">정산 정보</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {/* Period Row */}
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                                <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">정산 월</span>
                                <span className="flex-1 text-xs text-gray-800 font-bold">{monthStr}</span>
                            </div>

                            {/* Base Salary Row */}
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <DollarSign className="w-3 h-3 text-gray-400 shrink-0" />
                                <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">기본 수업료</span>
                                <span className="flex-1 text-right text-sm font-bold text-gray-800">{formatCurrency(baseSalary)}</span>
                            </div>

                            {/* Total Amount Row */}
                            <div className="flex items-center gap-2 px-2 py-2 bg-blue-50">
                                <DollarSign className="w-3 h-3 text-blue-600 shrink-0" />
                                <span className="w-16 shrink-0 text-xs font-bold text-blue-700">총 지급액</span>
                                <span className="flex-1 text-right text-xl font-extrabold text-blue-700">
                                    {formatCurrency(finalTotal)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: 지급 내역 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <Gift className="w-3 h-3 text-[#081429]" />
                            <h3 className="text-[#081429] font-bold text-xs">지급 내역</h3>
                        </div>
                        <div className="divide-y divide-gray-100">

                            {/* Blog Incentive */}
                            <div
                                onClick={() => handleToggle('hasBlog')}
                                className={`flex justify-between items-center px-2 py-2 cursor-pointer transition-all ${localData.hasBlog ? 'bg-blue-50' : 'hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    {localData.hasBlog ?
                                        <CheckCircle2 className="text-blue-600" size={16} /> :
                                        <Circle className="text-gray-300" size={16} />
                                    }
                                    <div>
                                        <p className={`text-xs font-bold ${localData.hasBlog ? 'text-blue-700' : 'text-gray-600'}`}>블로그 포스팅</p>
                                        <p className="text-xxs text-gray-400">
                                            월 1회 이상
                                            {incentiveConfig.blogType === 'percentage' && (
                                                <span className="ml-1 text-blue-500">(비율 가산)</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <span className={`font-mono font-bold text-xs ${localData.hasBlog ? 'text-blue-600' : 'text-gray-300'}`}>
                                    {blogBonusDisplay}
                                </span>
                            </div>

                            {/* Retention Incentive */}
                            <div
                                onClick={() => handleToggle('hasRetention')}
                                className={`flex justify-between items-center px-2 py-2 cursor-pointer transition-all ${localData.hasRetention ? 'bg-green-50' : 'hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    {localData.hasRetention ?
                                        <CheckCircle2 className="text-green-600" size={16} /> :
                                        <Circle className="text-gray-300" size={16} />
                                    }
                                    <div>
                                        <p className={`text-xs font-bold ${localData.hasRetention ? 'text-green-700' : 'text-gray-600'}`}>퇴원율 달성</p>
                                        <div className="flex items-center gap-1 text-xxs">
                                            <span className="text-gray-400">목표 {incentiveConfig.retentionTargetRate}% 이하</span>
                                            {isRetentionEligible ?
                                                <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded font-bold text-xxs">
                                                    달성 ({droppedStudentRate}%)
                                                </span> :
                                                <span className="px-1 py-0.5 bg-red-100 text-red-600 rounded font-bold text-xxs">
                                                    미달 ({droppedStudentRate}%)
                                                </span>
                                            }
                                        </div>
                                    </div>
                                </div>
                                <span className={`font-mono font-bold text-xs ${localData.hasRetention ? 'text-green-600' : 'text-gray-300'}`}>
                                    +{formatCurrency(incentiveConfig.retentionAmount)}
                                </span>
                            </div>

                            {/* Other Incentive */}
                            <div className="px-2 py-2">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <CreditCard className="w-3 h-3 text-gray-400 shrink-0" />
                                    <span className="text-xs font-bold text-gray-700">기타 인센티브</span>
                                    <input
                                        type="text"
                                        className="ml-auto bg-white border border-gray-300 rounded px-2 py-1 text-right w-28 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        placeholder="0"
                                        value={localData.otherAmount || ''}
                                        onChange={(e) => handleChange('otherAmount', parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0)}
                                    />
                                </div>
                                <div className="flex items-start gap-2">
                                    <MessageSquare className="w-3 h-3 text-gray-400 shrink-0 mt-1" />
                                    <input
                                        type="text"
                                        className="flex-1 bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-600 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                                        placeholder="메모 (예: 명절 상여금, 교재비 환급 등)"
                                        value={localData.note || ''}
                                        onChange={(e) => handleChange('note', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: 이력 (정산 확정 상태 및 적용된 설정) */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <Clock className="w-3 h-3 text-[#081429]" />
                            <h3 className="text-[#081429] font-bold text-xs">이력</h3>
                        </div>
                        <div className="p-2">
                            {isFinalized ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded-sm border border-green-200">
                                        <Lock className="text-green-600" size={16} />
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-green-700">정산 확정됨</p>
                                            <p className="text-xxs text-green-600">
                                                {localData.finalizedAt && new Date(localData.finalizedAt).toLocaleDateString('ko-KR', {
                                                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                    {localData.salaryConfig && (
                                        <div className="text-xxs text-gray-500 bg-gray-50 p-2 rounded-sm border border-gray-200">
                                            <p className="font-bold mb-1 text-gray-700">적용된 급여 설정:</p>
                                            <div className="space-y-0.5">
                                                <p>수수료: {localData.salaryConfig.academyFee}%</p>
                                                <p>과정: {localData.salaryConfig.items.map(i => `${i.name} ${formatCurrency(i.fixedRate)}`).join(', ')}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-sm border border-amber-200">
                                    <AlertTriangle className="text-amber-600" size={16} />
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-amber-700">미확정</p>
                                        <p className="text-xxs text-amber-600">급여 설정 변경 시 이 달의 계산도 변경됩니다.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Section 4: 작업 (확정/해제 버튼) */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <FileText className="w-3 h-3 text-[#081429]" />
                            <h3 className="text-[#081429] font-bold text-xs">작업</h3>
                        </div>
                        <div className="p-2">
                            {isFinalized ? (
                                <button
                                    onClick={handleUnfinalize}
                                    className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-sm font-medium text-xs flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Unlock size={16} />
                                    확정 해제
                                </button>
                            ) : (
                                <div>
                                    {showFinalizeConfirm ? (
                                        <div className="bg-blue-50 p-2 rounded-sm border border-blue-200 space-y-2">
                                            <p className="text-xs text-blue-800">
                                                <strong>정산을 확정하시겠습니까?</strong><br />
                                                <span className="text-xxs">현재 급여 설정이 이 달에 고정되어, 이후 설정 변경에 영향받지 않습니다.</span>
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleFinalize}
                                                    className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-sm font-medium text-xs transition-colors"
                                                >
                                                    확정하기
                                                </button>
                                                <button
                                                    onClick={() => setShowFinalizeConfirm(false)}
                                                    className="flex-1 py-1.5 px-2 bg-white hover:bg-gray-50 text-gray-700 rounded-sm font-medium text-xs border border-gray-300 transition-colors"
                                                >
                                                    취소
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowFinalizeConfirm(true)}
                                            className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-sm font-medium text-xs flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <Lock size={16} />
                                            정산 확정하기
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettlementModal;
