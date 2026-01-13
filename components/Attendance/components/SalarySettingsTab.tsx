import React, { useEffect, useState } from 'react';
import { SalaryConfig, SalarySettingItem } from '../types';
import { Teacher } from '../../../types';
import { Calculator, HelpCircle, Plus, Trash2, Gift, Save, ShieldAlert, User, Users, RotateCcw } from 'lucide-react';
import { calculateClassRate, resolveColor } from '../utils';
import { useAttendanceConfig, useSaveAttendanceConfig, useDeleteAttendanceConfig } from '../../../hooks/useAttendance';

interface Props {
    teachers?: Teacher[];
}

const SalarySettingsTab: React.FC<Props> = ({ teachers = [] }) => {
    const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
    const configId = selectedTeacherId ? `salary_${selectedTeacherId}` : 'salary';

    const { data: config, isLoading } = useAttendanceConfig(configId);
    // Also fetch global config for fallback reference
    const { data: globalConfig } = useAttendanceConfig('salary', !!selectedTeacherId);

    const { mutate: saveConfig, isPending: isSaving } = useSaveAttendanceConfig();
    const { mutate: deleteConfig, isPending: isDeleting } = useDeleteAttendanceConfig();

    const [localConfig, setLocalConfig] = useState<SalaryConfig | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    // Effect: Load config when data is fetched or configId changes
    useEffect(() => {
        if (config) {
            setLocalConfig(config);
        } else if (selectedTeacherId && globalConfig) {
            // If teacher selected but no specific config exists, load global config as starting point
            // But we don't save it yet, just show it as initial state
            // Or better: show it as is, but mark as "using default" until changed?
            // For editing, it's easier to just copy it.
            setLocalConfig(globalConfig);
        } else {
            // No config and no global fallback (shouldn't happen for global salary)
            setLocalConfig(null);
        }
        setHasChanges(false);
    }, [config, configId, globalConfig, selectedTeacherId]);

    const handleGlobalChange = (field: keyof SalaryConfig, value: string) => {
        if (!localConfig) return;
        const numValue = parseFloat(value) || 0;
        setLocalConfig(prev => prev ? ({ ...prev, [field]: numValue }) : null);
        setHasChanges(true);
    };

    const handleIncentiveChange = (field: keyof SalaryConfig['incentives'], value: number) => {
        if (!localConfig) return;
        setLocalConfig(prev => prev ? ({
            ...prev,
            incentives: {
                ...prev.incentives,
                [field]: value
            }
        }) : null);
        setHasChanges(true);
    };

    const handleAddItem = () => {
        if (!localConfig) return;
        const newItem: SalarySettingItem = {
            id: crypto.randomUUID(),
            name: '새 과정',
            color: '#3B82F6', // Default Blue
            type: 'fixed',
            fixedRate: 30000,
            baseTuition: 0,
            ratio: 45
        };
        setLocalConfig(prev => prev ? ({ ...prev, items: [...prev.items, newItem] }) : null);
        setHasChanges(true);
    };

    const handleRemoveItem = (id: string) => {
        if (!localConfig) return;
        if (confirm('이 설정을 삭제하시겠습니까? 해당 설정이 적용된 학생들의 급여 계산에 문제가 생길 수 있습니다.')) {
            setLocalConfig(prev => prev ? ({ ...prev, items: prev.items.filter(item => item.id !== id) }) : null);
            setHasChanges(true);
        }
    };

    const handleItemChange = (id: string, field: keyof SalarySettingItem, value: any) => {
        if (!localConfig) return;
        setLocalConfig(prev => prev ? ({
            ...prev,
            items: prev.items.map(item => {
                if (item.id !== id) return item;
                return { ...item, [field]: value };
            })
        }) : null);
        setHasChanges(true);
    };

    const handleSave = () => {
        if (localConfig) {
            saveConfig({ config: localConfig, configId });
            setHasChanges(false);
        }
    };

    const handleReset = () => {
        if (!selectedTeacherId) return;
        if (confirm('이 선생님의 개별 설정을 삭제하고 전체 기본 설정을 따르도록 하시겠습니까?')) {
            deleteConfig(configId);
            setHasChanges(false);
            // After delete, the effect will re-run. 
            // Since config is null, it should fallback to globalConfig.
        }
    }

    if (isLoading) return <div className="p-8 text-center text-gray-500">로딩 중...</div>;

    // Helper: Is this a custom config?
    // If we are on teacher tab, and we have a config doc in Firestore (config is not null/undefined from useQuery)
    const isCustomConfig = selectedTeacherId && !!config;

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20">
            {/* Context Selector Bar */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-20">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className={`p-2 rounded-lg ${selectedTeacherId ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                        {selectedTeacherId ? <User size={20} /> : <Users size={20} />}
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 mb-1">설정 적용 대상</label>
                        <select
                            value={selectedTeacherId || ''}
                            onChange={(e) => setSelectedTeacherId(e.target.value || null)}
                            className="w-full md:w-64 font-bold text-gray-800 bg-transparent border-none focus:ring-0 p-0 cursor-pointer text-lg"
                        >
                            <option value="">🌐 전체 기본 설정</option>
                            <option disabled>────── 선생님 선택 ──────</option>

                            {/* Math Teachers */}
                            <optgroup label="수학 선생님">
                                {teachers
                                    .filter(t => t.subjects?.some(s => s.includes('수학') || s.toLowerCase().includes('math')))
                                    .map(t => (
                                        <option key={t.id} value={t.id}>{t.name} 선생님</option>
                                    ))}
                            </optgroup>

                            {/* English Teachers */}
                            <optgroup label="영어 선생님">
                                {teachers
                                    .filter(t => t.subjects?.some(s => s.includes('영어') || s.toLowerCase().includes('english')))
                                    .map(t => (
                                        <option key={t.id} value={t.id}>{t.name} 선생님</option>
                                    ))}
                            </optgroup>

                            {/* Other Teachers */}
                            <optgroup label="기타 / 미분류">
                                {teachers
                                    .filter(t => !t.subjects?.some(s =>
                                        s.includes('수학') || s.toLowerCase().includes('math') ||
                                        s.includes('영어') || s.toLowerCase().includes('english')
                                    ))
                                    .map(t => (
                                        <option key={t.id} value={t.id}>{t.name} 선생님</option>
                                    ))}
                            </optgroup>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    {selectedTeacherId && (
                        <div className="mr-2">
                            {isCustomConfig ? (
                                <span className="text-xs font-bold px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full">개별 설정 사용 중</span>
                            ) : (
                                <span className="text-xs font-medium text-gray-400 px-2">기본 설정 따르는 중</span>
                            )}
                        </div>
                    )}

                    {selectedTeacherId && isCustomConfig && (
                        <button
                            onClick={handleReset}
                            disabled={isDeleting}
                            className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1.5 transition-colors"
                            title="개별 설정 삭제 (기본값 복귀)"
                        >
                            <RotateCcw size={14} /> 초기화
                        </button>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || isSaving}
                        className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all shadow-sm ${hasChanges
                            ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        <Save size={18} />
                        {isSaving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>

            {!localConfig ? (
                <div className="p-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                    기본 설정 데이터를 불러올 수 없습니다.
                </div>
            ) : (
                <>
                    {/* Global Settings */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                            <Calculator size={20} className="text-gray-500" /> 기본 정산 설정
                        </h3>
                        <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-bold text-slate-700">카드/행정 수수료 (%)</label>
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
                                    className="w-full pl-3 pr-8 py-2 text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                            </div>
                        </div>
                    </div>

                    {/* Incentive Settings */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                            <Gift size={20} className="text-yellow-600" /> 인센티브 기준 설정
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                                <label className="block text-xs font-bold text-gray-600 mb-2">블로그 포스팅 수당 (월)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₩</span>
                                    <input
                                        type="text"
                                        value={localConfig.incentives?.blogAmount?.toLocaleString() ?? 0}
                                        onChange={(e) => handleIncentiveChange('blogAmount', parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0)}
                                        className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                                <label className="block text-xs font-bold text-gray-600 mb-2">퇴원율 달성 수당 (월)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₩</span>
                                    <input
                                        type="text"
                                        value={localConfig.incentives?.retentionAmount?.toLocaleString() ?? 0}
                                        onChange={(e) => handleIncentiveChange('retentionAmount', parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0)}
                                        className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                                <label className="block text-xs font-bold text-gray-600 mb-2">목표 퇴원율 기준 (%)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={localConfig.incentives?.retentionTargetRate ?? 0}
                                        onChange={(e) => handleIncentiveChange('retentionTargetRate', parseFloat(e.target.value) || 0)}
                                        className="w-full pl-3 pr-10 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">이하</span>
                                </div>
                                <p className="text-xxs text-gray-400 mt-1">이 비율 이하로 퇴원생 발생 시 인센티브 적용</p>
                            </div>
                        </div>
                    </div>

                    {/* Dynamic Items */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <h3 className="font-bold text-gray-800 text-lg">과정별 정산 설정</h3>
                            <button
                                onClick={handleAddItem}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors"
                            >
                                <Plus size={16} /> 항목 추가
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {localConfig.items.map((item) => {
                                const calculatedRate = calculateClassRate(item, localConfig.academyFee);

                                return (
                                    <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow relative group">
                                        <button
                                            onClick={() => handleRemoveItem(item.id)}
                                            className="absolute right-4 top-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 rounded-full"
                                            title="삭제"
                                        >
                                            <Trash2 size={18} />
                                        </button>

                                        <div className="flex flex-wrap gap-6 items-center mb-6 pr-10">
                                            {/* Name Input */}
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm cursor-pointer hover:scale-105 transition-transform" style={{ backgroundColor: resolveColor(item.color) }}>
                                                    <input
                                                        type="color"
                                                        value={resolveColor(item.color)}
                                                        onChange={(e) => handleItemChange(item.id, 'color', e.target.value)}
                                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                        title="색상 변경"
                                                    />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                                                    className="font-bold text-xl text-gray-800 border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 focus:outline-none bg-transparent w-48 px-1 py-0.5 transition-colors"
                                                    placeholder="과정명"
                                                />
                                            </div>

                                            {/* Type Toggle */}
                                            <div className="flex bg-gray-100 p-1 rounded-lg ml-auto">
                                                <button
                                                    onClick={() => handleItemChange(item.id, 'type', 'fixed')}
                                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${item.type === 'fixed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                                        }`}
                                                >
                                                    고정급
                                                </button>
                                                <button
                                                    onClick={() => handleItemChange(item.id, 'type', 'percentage')}
                                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${item.type === 'percentage' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                                        }`}
                                                >
                                                    비율제
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-100">
                                            {item.type === 'fixed' ? (
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">1회 지급액 (선생님 수령)</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₩</span>
                                                        <input
                                                            type="text"
                                                            value={item.fixedRate.toLocaleString()}
                                                            onChange={(e) => handleItemChange(item.id, 'fixedRate', parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0)}
                                                            className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white outline-none font-medium"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-1.5">1회 수강료 (학생 납부)</label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₩</span>
                                                            <input
                                                                type="text"
                                                                value={item.baseTuition.toLocaleString()}
                                                                onChange={(e) => handleItemChange(item.id, 'baseTuition', parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0)}
                                                                className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white outline-none font-medium"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-1.5">선생님 정산 비율 (%)</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                value={item.ratio}
                                                                onChange={(e) => handleItemChange(item.id, 'ratio', parseFloat(e.target.value) || 0)}
                                                                className="w-full pl-3 pr-8 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white outline-none font-medium"
                                                                placeholder="예: 45"
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Preview Calculation */}
                                        <div className="mt-4 flex justify-end items-center border-t border-gray-100 pt-3">
                                            <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                                                <span className="text-xs text-blue-400 font-bold">1회당 정산액</span>
                                                <span className="text-sm font-bold text-blue-600 font-mono">{calculatedRate.toLocaleString()}원</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {localConfig && localConfig.items.length === 0 && (
                            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                                <Calculator size={48} className="mx-auto mb-3 opacity-20" />
                                <p className="font-medium">등록된 급여 설정이 없습니다.</p>
                                <p className="text-sm mt-1">상단의 '항목 추가' 버튼을 눌러주세요.</p>
                            </div>
                        )}
                    </div>

                    <div className="h-10"></div> {/* Bottom Spacer */}

                    {/* Floating Save Button (if changes, duplicate of bottom bar but specific to this tab context if needed) */}
                    {/* Note: SettingsModal has a global save bar at the bottom, but it's conditioned on activeTab 'departments' or 'users'. 
                 We might want to rely on the SAVE button inside this component itself or reuse the global footer. 
                 Currently SettingsModal footer logic is specific. 
                 For this tab, I've added a global 'Save' button in the header if changed, and there is also one in the standard component.
                 I'll stick to the in-component save button or auto-save approach if preferred, 
                 but explicit save is safer.
                 I've added a save warning/button at the top.
             */}
                </>
            )}
        </div>
    );
};

export default SalarySettingsTab;
