import React, { useState } from 'react';
import { formatDateKey, getTodayKST, getFirstClassDayOfWeek } from '../../../../utils/dateUtils';
import { addDays, format } from 'date-fns';
import { useEscapeClose } from '../../../../hooks/useEscapeClose';

interface ScheduledDateModalProps {
    studentName: string;
    fromClassName: string;
    toClassName: string;
    onConfirm: (scheduledDate?: string) => void;
    onClose: () => void;
    // 미래 주차 자동 날짜 설정용
    weekStart?: Date;
    targetClassSchedule?: string[];
    // 일반화 props (퇴원/스케줄변경 등 다양한 모드 지원)
    title?: string;
    description?: React.ReactNode;
    customImmediateLabel?: string;
    actionVerb?: string; // 기본 '이동', '삽입' 등으로 변경 가능
}

const ScheduledDateModal: React.FC<ScheduledDateModalProps> = ({
    studentName,
    fromClassName,
    toClassName,
    onConfirm,
    onClose,
    weekStart,
    targetClassSchedule,
    title,
    description,
    customImmediateLabel,
    actionVerb,
}) => {
    const [mode, setMode] = useState<'immediate' | 'scheduled'>('immediate');
    const [selectedDate, setSelectedDate] = useState('');

    useEscapeClose(onClose);

    const todayStr = getTodayKST();
    const tomorrow = formatDateKey(addDays(new Date(), 1));

    // 미래 주차 판별 및 첫 수업일 계산
    const isFutureWeek = weekStart ? formatDateKey(weekStart) > todayStr : false;
    const futureFirstClassDay = (isFutureWeek && weekStart && targetClassSchedule?.length)
        ? getFirstClassDayOfWeek(weekStart, targetClassSchedule)
        : null;

    // "즉시이동" 시 사용할 날짜
    const immediateDate = futureFirstClassDay || undefined;

    // "즉시이동/삽입" 라벨
    const verb = actionVerb || '이동';
    const defaultImmediateLabel = futureFirstClassDay
        ? `즉시 ${verb} (${format(new Date(futureFirstClassDay), 'M/d')})`
        : `즉시 ${verb} (오늘)`;
    const immediateLabel = customImmediateLabel || defaultImmediateLabel;

    const handleConfirm = () => {
        if (mode === 'scheduled' && selectedDate) {
            onConfirm(selectedDate);
        } else {
            onConfirm(immediateDate);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 z-[110] flex items-start justify-center pt-[8vh] p-4"
        >
            <div
                className="bg-white rounded-sm shadow-2xl w-[320px] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="bg-primary text-white p-3 font-bold text-sm flex justify-between items-center">
                    <span>{title || '반 이동 날짜 설정'}</span>
                    <button onClick={onClose} className="text-white hover:text-gray-200">&times;</button>
                </div>

                {/* Content */}
                <div className="p-4 bg-gray-50">
                    {description ? (
                        <div className="text-xs text-gray-600 mb-3 text-center">{description}</div>
                    ) : (
                        <p className="text-xs text-gray-600 mb-3 text-center">
                            <span className="font-bold text-gray-800">{studentName}</span>
                            <br />
                            <span className="text-gray-400">{fromClassName}</span>
                            <span className="mx-1">&rarr;</span>
                            <span className="font-bold text-primary">{toClassName}</span>
                        </p>
                    )}

                    <div className="space-y-2">
                        {/* 즉시 이동 */}
                        <label
                            className={`flex items-center gap-2 p-2.5 rounded-sm border cursor-pointer transition-all ${
                                mode === 'immediate'
                                    ? 'border-primary bg-white shadow-sm'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                        >
                            <input
                                type="radio"
                                name="moveMode"
                                checked={mode === 'immediate'}
                                onChange={() => setMode('immediate')}
                                className="accent-primary"
                            />
                            <span className="text-sm font-bold text-gray-700">{immediateLabel}</span>
                        </label>

                        {/* 예정일 지정 */}
                        <label
                            className={`flex flex-col gap-2 p-2.5 rounded-sm border cursor-pointer transition-all ${
                                mode === 'scheduled'
                                    ? 'border-blue-400 bg-white shadow-sm'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="moveMode"
                                    checked={mode === 'scheduled'}
                                    onChange={() => setMode('scheduled')}
                                    className="accent-blue-500"
                                />
                                <span className="text-sm font-bold text-gray-700">예정일 지정</span>
                            </div>
                            {mode === 'scheduled' && (
                                <input
                                    type="date"
                                    min={tomorrow}
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="ml-5 px-2 py-1 border border-gray-300 rounded-sm text-sm focus:border-blue-400 focus:outline-none"
                                    autoFocus
                                />
                            )}
                        </label>
                    </div>

                    {/* Footer */}
                    <div className="mt-4 pt-3 border-t flex justify-end gap-2">
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 rounded-sm border bg-white text-gray-500 text-xs font-bold hover:bg-gray-100 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={mode === 'scheduled' && !selectedDate}
                            className="px-4 py-1.5 rounded-sm bg-primary text-white text-xs font-bold hover:bg-primary/90 shadow-md transition-colors disabled:opacity-50"
                        >
                            확인
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScheduledDateModal;
