import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { TuitionEntry } from '../../types';

interface EntryFormProps {
    initialData?: TuitionEntry | null;
    existingAcademies: string[];
    onSave: (entry: Omit<TuitionEntry, 'id'> | TuitionEntry) => void;
    onCancel: () => void;
}

export const EntryForm: React.FC<EntryFormProps> = ({ initialData, existingAcademies, onSave, onCancel }) => {
    const [academyName, setAcademyName] = useState('');
    const [projectedFee, setProjectedFee] = useState<string>('');
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (initialData) {
            setAcademyName(initialData.academyName);
            setProjectedFee(initialData.projectedFee.toString());
            setReason(initialData.reason);
        }
    }, [initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const feeNumber = parseInt(projectedFee.replace(/,/g, ''), 10) || 0;

        let category: 'increase' | 'decrease' | 'steady' = 'steady';
        if (reason.includes('증가') || reason.includes('인상') || reason.includes('신규')) category = 'increase';
        else if (reason.includes('감소') || reason.includes('환불') || reason.includes('종강')) category = 'decrease';

        onSave({
            ...(initialData && { id: initialData.id }),
            academyName,
            projectedFee: feeNumber,
            reason,
            category
        });
    };

    const handleFeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        setProjectedFee(value);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-sm shadow-xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-primary-700/10 flex justify-between items-center bg-primary">
                    <h3 className="text-lg font-semibold text-white">
                        {initialData ? '수강료 정보 수정' : '수강료 등록'}
                    </h3>
                    <button onClick={onCancel} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-primary-700 mb-1">
                            사업장 (학원명)
                        </label>
                        <div className="relative">
                            <input
                                list="academy-suggestions"
                                type="text"
                                required
                                value={academyName}
                                onChange={(e) => setAcademyName(e.target.value)}
                                className="w-full px-4 py-2 rounded-sm border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                                placeholder="사업장명을 직접 입력하세요"
                                autoFocus={!initialData}
                            />
                            {existingAcademies.length > 0 && (
                                <datalist id="academy-suggestions">
                                    {existingAcademies.map(name => (
                                        <option key={name} value={name} />
                                    ))}
                                </datalist>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-primary-700 mb-1">
                            예상 수강료 (원)
                        </label>
                        <input
                            type="text"
                            required
                            value={projectedFee ? parseInt(projectedFee).toLocaleString() : ''}
                            onChange={handleFeeChange}
                            className="w-full px-4 py-2 rounded-sm border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all font-mono"
                            placeholder="0"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-primary-700 mb-1">
                            증감 및 특이 사유 <span className="text-gray-400 font-normal text-xs ml-1">(선택)</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2 rounded-sm border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all resize-none"
                            placeholder="특이사항이 있는 경우 입력하세요"
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 px-4 py-2.5 rounded-sm border border-gray-200 text-primary-700 font-medium hover:bg-gray-50 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2.5 rounded-sm bg-accent text-primary font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2"
                        >
                            <Save size={18} />
                            저장하기
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
