import React from 'react';
import { SalaryConfig, SalarySettingItem } from '../types';
import { X, Save, Calculator, HelpCircle, Plus, Trash2, Palette, Gift } from 'lucide-react';
import { calculateClassRate, resolveColor } from '../utils';

// 12가지 색상 팔레트 (새 항목 추가시 순환 사용)
const COLOR_PALETTE = [
    '#FACC15', // Yellow (초등)
    '#C084FC', // Purple (중등)
    '#3B82F6', // Blue (고등)
    '#F97316', // Orange
    '#22C55E', // Green
    '#EC4899', // Pink
    '#14B8A6', // Teal
    '#EF4444', // Red
    '#8B5CF6', // Violet
    '#06B6D4', // Cyan
    '#F59E0B', // Amber
    '#84CC16', // Lime
];

interface Props {
    isOpen: boolean;
    onClose: () => void;
    config: SalaryConfig;
    onSave: (newConfig: SalaryConfig) => void;
    readOnly?: boolean;
}


const SalarySettings: React.FC<Props> = ({ isOpen, onClose, config, onSave, readOnly = false }) => {

    const [localConfig, setLocalConfig] = React.useState<SalaryConfig>(config);

    React.useEffect(() => {
        setLocalConfig(config);
    }, [config, isOpen]);

    if (!isOpen) return null;

    const handleGlobalChange = (field: keyof SalaryConfig, value: string) => {
        const numValue = parseFloat(value) || 0;
        setLocalConfig(prev => ({ ...prev, [field]: numValue }));
    };

    const handleIncentiveChange = (field: keyof SalaryConfig['incentives'], value: number | string) => {
        setLocalConfig(prev => ({
            ...prev,
            incentives: {
                ...prev.incentives,
                [field]: value
            }
        }));
    };

    const handleAddItem = () => {
        // 기존 항목에서 사용하지 않은 색상 찾기
        const usedColors = localConfig.items.map(item => item.color);
        const availableColor = COLOR_PALETTE.find(c => !usedColors.includes(c))
            || COLOR_PALETTE[localConfig.items.length % COLOR_PALETTE.length];

        const newItem: SalarySettingItem = {
            id: crypto.randomUUID(),
            name: '새 과정',
            color: availableColor,
            type: 'fixed',
            fixedRate: 30000,
            baseTuition: 0,
            ratio: 45
        };
        setLocalConfig(prev => ({ ...prev, items: [...prev.items, newItem] }));
    };

    const handleRemoveItem = (id: string) => {
        if (confirm('이 설정을 삭제하시겠습니까? 해당 설정이 적용된 학생들의 급여 계산에 문제가 생길 수 있습니다.')) {
            setLocalConfig(prev => ({ ...prev, items: prev.items.filter(item => item.id !== id) }));
        }
    };

    const handleItemChange = (id: string, field: keyof SalarySettingItem, value: any) => {
        setLocalConfig(prev => ({
            ...prev,
            items: prev.items.map(item => {
                if (item.id !== id) return item;
                return { ...item, [field]: value };
            })
        }));
    };

    const handleSave = () => {
        onSave(localConfig);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="bg-white rounded-sm shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-5 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-sm">
                            <Calculator size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">
                            급여 및 인센티브 설정
                            {readOnly && <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-sm font-normal">조회 전용</span>}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-sm transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>


                <div className="overflow-y-auto custom-scrollbar p-6 space-y-8 flex-1">

                    {/* Global Settings */}
                    <div className="bg-slate-50 p-4 rounded-sm border border-slate-200 space-y-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Calculator size={16} className="text-gray-500" /> 기본 정산 설정
                        </h3>
                        <div className={`flex items-center justify-between bg-white p-3 rounded-sm border border-gray-200 ${readOnly ? 'bg-gray-50' : ''}`}>
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-700">카드/행정 수수료 (%)</label>
                                <div className="group relative">
                                    <HelpCircle size={14} className="text-slate-400 cursor-help" />
                                    <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg hidden group-hover:block z-10">
                                        비율제 정산 시, 전체 수강료에서 이 수수료율을 먼저 공제한 후 비율을 곱합니다.
                                    </div>
                                </div>
                            </div>
                            <div className="relative w-32">
                                <input
                                    type="number"
                                    step="0.1"
                                    value={localConfig.academyFee}
                                    onChange={(e) => handleGlobalChange('academyFee', e.target.value)}
                                    disabled={readOnly}
                                    className="w-full pl-3 pr-8 py-2 text-right border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                            </div>
                        </div>
                    </div>

                    {/* Incentive Settings */}
                    <div className="bg-yellow-50 p-4 rounded-sm border border-yellow-200 space-y-4">
                        <h3 className="font-bold text-yellow-800 flex items-center gap-2">
                            <Gift size={16} className="text-yellow-600" /> 인센티브 기준 설정
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* 블로그 포스팅 인센티브 - 고정금/비율 선택 */}
                            <div className="bg-white p-3 rounded-sm border border-yellow-100 md:col-span-2">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-bold text-gray-500">블로그 포스팅 인센티브</label>
                                    <div className="flex bg-gray-100 p-0.5 rounded-sm">
                                        <button
                                            onClick={() => handleIncentiveChange('blogType', 'fixed')}
                                            disabled={readOnly}
                                            className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-all ${
                                                localConfig.incentives?.blogType === 'fixed'
                                                    ? 'bg-white text-yellow-700 shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-700'
                                            } ${readOnly ? 'cursor-not-allowed' : ''}`}
                                        >
                                            고정금
                                        </button>
                                        <button
                                            onClick={() => handleIncentiveChange('blogType', 'percentage')}
                                            disabled={readOnly}
                                            className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-all ${
                                                localConfig.incentives?.blogType === 'percentage'
                                                    ? 'bg-white text-yellow-700 shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-700'
                                            } ${readOnly ? 'cursor-not-allowed' : ''}`}
                                        >
                                            비율 가산
                                        </button>
                                    </div>
                                </div>
                                {localConfig.incentives?.blogType === 'percentage' ? (
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={localConfig.incentives?.blogRate ?? 2}
                                            onChange={(e) => handleIncentiveChange('blogRate', parseFloat(e.target.value) || 0)}
                                            disabled={readOnly}
                                            className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-sm focus:ring-2 focus:ring-yellow-500 disabled:bg-gray-100 disabled:text-gray-500"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                                        <p className="text-xxs text-gray-400 mt-1">기본 수업료의 {localConfig.incentives?.blogRate ?? 2}%가 추가 지급됩니다.</p>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₩</span>
                                        <input
                                            type="text"
                                            value={localConfig.incentives?.blogAmount?.toLocaleString() ?? 0}
                                            onChange={(e) => handleIncentiveChange('blogAmount', parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0)}
                                            disabled={readOnly}
                                            className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-sm focus:ring-2 focus:ring-yellow-500 disabled:bg-gray-100 disabled:text-gray-500"
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="bg-white p-3 rounded-sm border border-yellow-100">
                                <label className="block text-xs font-bold text-gray-500 mb-1">퇴원율 달성 수당 (월)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₩</span>
                                    <input
                                        type="text"
                                        value={localConfig.incentives?.retentionAmount?.toLocaleString() ?? 0}
                                        onChange={(e) => handleIncentiveChange('retentionAmount', parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0)}
                                        disabled={readOnly}
                                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-sm focus:ring-2 focus:ring-yellow-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    />
                                </div>
                            </div>
                            <div className="bg-white p-3 rounded-sm border border-yellow-100">
                                <label className="block text-xs font-bold text-gray-500 mb-1">목표 퇴원율 기준 (%)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={localConfig.incentives?.retentionTargetRate ?? 0}
                                        onChange={(e) => handleIncentiveChange('retentionTargetRate', parseFloat(e.target.value) || 0)}
                                        disabled={readOnly}
                                        className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-sm focus:ring-2 focus:ring-yellow-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">이하</span>
                                </div>
                                <p className="text-xxs text-gray-400 mt-1">이 비율 이하로 퇴원생이 발생하면 인센티브가 적용됩니다.</p>
                            </div>
                        </div>
                    </div>

                    {/* Dynamic Items */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">과정별 정산 설정</h3>
                            {!readOnly && (
                                <button
                                    onClick={handleAddItem}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-sm text-sm font-medium hover:bg-blue-100 transition-colors"
                                >
                                    <Plus size={16} /> 항목 추가
                                </button>
                            )}
                        </div>

                        {localConfig.items.map((item) => {
                            const calculatedRate = calculateClassRate(item, localConfig.academyFee);

                            return (
                                <div key={item.id} className="border border-gray-200 rounded-sm p-5 hover:border-blue-200 transition-colors relative group">
                                    {!readOnly && (
                                        <button
                                            onClick={() => handleRemoveItem(item.id)}
                                            className="absolute right-4 top-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="삭제"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}

                                    <div className="flex flex-wrap gap-4 items-center mb-4 pr-8">
                                        {/* Name Input */}
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={item.name}
                                                onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                                                disabled={readOnly}
                                                className="font-bold text-lg text-gray-800 border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent w-32 disabled:border-transparent"
                                                placeholder="과정명"
                                            />
                                        </div>

                                        {/* Color Picker */}
                                        <div className="flex items-center gap-2">
                                            <div className="relative w-8 h-8 rounded-sm overflow-hidden border border-gray-200 cursor-pointer shadow-sm hover:scale-110 transition-transform">
                                                <input
                                                    type="color"
                                                    value={resolveColor(item.color)}
                                                    onChange={(e) => handleItemChange(item.id, 'color', e.target.value)}
                                                    disabled={readOnly}
                                                    className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] cursor-pointer p-0 border-0 disabled:cursor-not-allowed"
                                                    title="색상 변경"
                                                />
                                            </div>
                                        </div>

                                        {/* Type Toggle */}
                                        <div className="flex bg-gray-100 p-1 rounded-sm ml-auto">
                                            <button
                                                onClick={() => handleItemChange(item.id, 'type', 'fixed')}
                                                disabled={readOnly}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${item.type === 'fixed' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'} ${readOnly ? 'cursor-not-allowed' : ''}
                                                    `}
                                            >
                                                고정급
                                            </button>
                                            <button
                                                onClick={() => handleItemChange(item.id, 'type', 'percentage')}
                                                disabled={readOnly}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${item.type === 'percentage' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'} ${readOnly ? 'cursor-not-allowed' : ''}
                                                    `}
                                            >
                                                비율제
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 p-4 rounded-sm">
                                        {item.type === 'fixed' ? (
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-medium text-gray-500 mb-1">1회 지급액 (선생님 수령)</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₩</span>
                                                    <input
                                                        type="text"
                                                        value={item.fixedRate.toLocaleString()}
                                                        onChange={(e) => handleItemChange(item.id, 'fixedRate', parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0)}
                                                        disabled={readOnly}
                                                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-500 mb-1">1회 수강료 (학생 납부)</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₩</span>
                                                        <input
                                                            type="text"
                                                            value={item.baseTuition.toLocaleString()}
                                                            onChange={(e) => handleItemChange(item.id, 'baseTuition', parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0)}
                                                            disabled={readOnly}
                                                            className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-500 mb-1">선생님 정산 비율 (%)</label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            value={item.ratio}
                                                            onChange={(e) => handleItemChange(item.id, 'ratio', parseFloat(e.target.value) || 0)}
                                                            disabled={readOnly}
                                                            className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                                                            placeholder="예: 45"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Preview Calculation */}
                                    <div className="mt-3 flex justify-end items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-400">1회당 정산액:</span>
                                            <span className="text-sm font-bold text-blue-600 font-mono">{calculatedRate.toLocaleString()}원</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {localConfig.items.length === 0 && (
                            <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-sm border border-dashed border-gray-200">
                                등록된 급여 설정이 없습니다.<br />상단의 '항목 추가' 버튼을 눌러주세요.
                            </div>
                        )}
                    </div>
                </div>

                {!readOnly && (
                    <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-sm hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium shadow-sm"
                        >
                            <Save size={18} />
                            설정 저장
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SalarySettings;