import React from 'react';
import { X, SlidersHorizontal } from 'lucide-react';

interface SimpleViewSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    viewType?: 'date-teacher' | 'integration'; // 뷰 타입 구분
    // 크기 설정 (날짜/강사뷰만)
    cellSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    setCellSize?: (size: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => void;
    fontSize?: 'small' | 'normal' | 'large';
    setFontSize?: (size: 'small' | 'normal' | 'large') => void;
    // 요일 표시 (날짜/강사뷰만)
    selectedDays?: string[];
    setSelectedDays?: (days: string[]) => void;
    // 표시 옵션 - 공통
    showStudents?: boolean;
    setShowStudents?: (show: boolean) => void;
    // 표시 옵션 - 날짜/강사뷰
    showClassName?: boolean;
    setShowClassName?: (show: boolean) => void;
    showSchool?: boolean;
    setShowSchool?: (show: boolean) => void;
    showGrade?: boolean;
    setShowGrade?: (show: boolean) => void;
    showHoldStudents?: boolean;
    setShowHoldStudents?: (show: boolean) => void;
    showWithdrawnStudents?: boolean;
    setShowWithdrawnStudents?: (show: boolean) => void;
    // 표시 옵션 - 통합뷰
    showRoom?: boolean;
    setShowRoom?: (show: boolean) => void;
    showTeacher?: boolean;
    setShowTeacher?: (show: boolean) => void;
    showSchedule?: boolean;
    setShowSchedule?: (show: boolean) => void;
}

const SimpleViewSettingsModal: React.FC<SimpleViewSettingsModalProps> = ({
    isOpen,
    onClose,
    viewType = 'date-teacher',
    cellSize,
    setCellSize,
    fontSize,
    setFontSize,
    selectedDays,
    setSelectedDays,
    showStudents,
    setShowStudents,
    showClassName,
    setShowClassName,
    showSchool,
    setShowSchool,
    showGrade,
    setShowGrade,
    showHoldStudents,
    setShowHoldStudents,
    showWithdrawnStudents,
    setShowWithdrawnStudents,
    showRoom,
    setShowRoom,
    showTeacher,
    setShowTeacher,
    showSchedule,
    setShowSchedule,
}) => {
    if (!isOpen) return null;

    const weekdayDays = ['월', '화', '수', '목', '금'];
    const weekendDays = ['토', '일'];

    const hasWeekdays = selectedDays ? weekdayDays.some(day => selectedDays.includes(day)) : false;
    const hasWeekends = selectedDays ? weekendDays.some(day => selectedDays.includes(day)) : false;

    const toggleWeekdays = () => {
        if (!selectedDays || !setSelectedDays) return;
        if (hasWeekdays) {
            // 평일 숨기기
            setSelectedDays(selectedDays.filter(d => !weekdayDays.includes(d)));
        } else {
            // 평일 보이기
            setSelectedDays([...new Set([...selectedDays, ...weekdayDays])]);
        }
    };

    const toggleWeekends = () => {
        if (!selectedDays || !setSelectedDays) return;
        if (hasWeekends) {
            // 주말 숨기기
            setSelectedDays(selectedDays.filter(d => !weekendDays.includes(d)));
        } else {
            // 주말 보이기
            setSelectedDays([...new Set([...selectedDays, ...weekendDays])]);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center pt-[8vh]"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-sm shadow-xl w-[400px] max-h-[85vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                        <SlidersHorizontal size={18} className="text-accent" />
                        <h3 className="text-sm font-bold text-primary">보기 설정</h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 pb-3 space-y-4">
                    {/* 요일 표시 설정 - 날짜/강사뷰만 */}
                    {viewType === 'date-teacher' && selectedDays && setSelectedDays && (
                        <>
                            <div className="space-y-3">
                                <div className="text-xs font-bold text-accent">요일 표시</div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={toggleWeekdays}
                                        className={`flex-1 py-2 px-3 rounded-sm text-xs font-bold transition-all border ${
                                            hasWeekdays
                                                ? 'bg-accent text-primary border-accent'
                                                : 'bg-gray-100 text-gray-400 border-gray-200'
                                        }`}
                                    >
                                        평일 (월~금)
                                    </button>
                                    <button
                                        onClick={toggleWeekends}
                                        className={`flex-1 py-2 px-3 rounded-sm text-xs font-bold transition-all border ${
                                            hasWeekends
                                                ? 'bg-accent text-primary border-accent'
                                                : 'bg-gray-100 text-gray-400 border-gray-200'
                                        }`}
                                    >
                                        주말 (토~일)
                                    </button>
                                </div>
                            </div>

                            <div className="w-full h-px bg-gray-200"></div>
                        </>
                    )}

                    {/* 표시 옵션 - 공통 */}
                    <div className="space-y-3">
                        <div className="text-xs font-bold text-accent">표시 옵션</div>
                        <div className="grid grid-cols-2 gap-2">
                            {/* 공통: 학생목록 */}
                            {showStudents !== undefined && setShowStudents && (
                                <button
                                    onClick={() => setShowStudents(!showStudents)}
                                    className={`py-2 px-3 rounded-sm text-xs font-bold transition-all border ${
                                        showStudents
                                            ? 'bg-accent text-primary border-accent'
                                            : 'bg-gray-100 text-gray-400 border-gray-200'
                                    }`}
                                >
                                    학생목록
                                </button>
                            )}

                            {/* 공통: 수업명, 학교, 학년, 대기, 퇴원 */}
                            {showClassName !== undefined && setShowClassName && (
                                <button
                                    onClick={() => setShowClassName(!showClassName)}
                                    className={`py-2 px-3 rounded-sm text-xs font-bold transition-all border ${
                                        showClassName
                                            ? 'bg-accent text-primary border-accent'
                                            : 'bg-gray-100 text-gray-400 border-gray-200'
                                    }`}
                                >
                                    수업명
                                </button>
                            )}
                            {showSchool !== undefined && setShowSchool && (
                                <button
                                    onClick={() => setShowSchool(!showSchool)}
                                    className={`py-2 px-3 rounded-sm text-xs font-bold transition-all border ${
                                        showSchool
                                            ? 'bg-accent text-primary border-accent'
                                            : 'bg-gray-100 text-gray-400 border-gray-200'
                                    }`}
                                >
                                    학교
                                </button>
                            )}
                            {showGrade !== undefined && setShowGrade && (
                                <button
                                    onClick={() => setShowGrade(!showGrade)}
                                    className={`py-2 px-3 rounded-sm text-xs font-bold transition-all border ${
                                        showGrade
                                            ? 'bg-accent text-primary border-accent'
                                            : 'bg-gray-100 text-gray-400 border-gray-200'
                                    }`}
                                >
                                    학년
                                </button>
                            )}
                            {showHoldStudents !== undefined && setShowHoldStudents && (
                                <button
                                    onClick={() => setShowHoldStudents(!showHoldStudents)}
                                    className={`py-2 px-3 rounded-sm text-xs font-bold transition-all border ${
                                        showHoldStudents
                                            ? 'bg-accent text-primary border-accent'
                                            : 'bg-gray-100 text-gray-400 border-gray-200'
                                    }`}
                                >
                                    대기
                                </button>
                            )}
                            {showWithdrawnStudents !== undefined && setShowWithdrawnStudents && (
                                <button
                                    onClick={() => setShowWithdrawnStudents(!showWithdrawnStudents)}
                                    className={`py-2 px-3 rounded-sm text-xs font-bold transition-all border ${
                                        showWithdrawnStudents
                                            ? 'bg-accent text-primary border-accent'
                                            : 'bg-gray-100 text-gray-400 border-gray-200'
                                    }`}
                                >
                                    퇴원
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 통합뷰 전용 옵션 */}
                    {viewType === 'integration' && (
                        <>
                            <div className="w-full h-px bg-gray-200"></div>

                            <div className="space-y-3">
                                <div className="text-xs font-bold text-accent">통합뷰 전용 옵션</div>
                                <div className="grid grid-cols-2 gap-2">
                                    {showRoom !== undefined && setShowRoom && (
                                        <button
                                            onClick={() => setShowRoom(!showRoom)}
                                            className={`py-2 px-3 rounded-sm text-xs font-bold transition-all border ${
                                                showRoom
                                                    ? 'bg-accent text-primary border-accent'
                                                    : 'bg-gray-100 text-gray-400 border-gray-200'
                                            }`}
                                        >
                                            강의실
                                        </button>
                                    )}
                                    {showTeacher !== undefined && setShowTeacher && (
                                        <button
                                            onClick={() => setShowTeacher(!showTeacher)}
                                            className={`py-2 px-3 rounded-sm text-xs font-bold transition-all border ${
                                                showTeacher
                                                    ? 'bg-accent text-primary border-accent'
                                                    : 'bg-gray-100 text-gray-400 border-gray-200'
                                            }`}
                                        >
                                            담임 정보
                                        </button>
                                    )}
                                    {showSchedule !== undefined && setShowSchedule && (
                                        <button
                                            onClick={() => setShowSchedule(!showSchedule)}
                                            className={`py-2 px-3 rounded-sm text-xs font-bold transition-all border ${
                                                showSchedule
                                                    ? 'bg-accent text-primary border-accent'
                                                    : 'bg-gray-100 text-gray-400 border-gray-200'
                                            }`}
                                        >
                                            스케줄
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {viewType === 'date-teacher' && <div className="w-full h-px bg-gray-200"></div>}

                    {/* 크기 설정 섹션 - 날짜/강사뷰만 */}
                    {viewType === 'date-teacher' && cellSize && setCellSize && fontSize && setFontSize && (
                        <div className="space-y-3">
                            <div className="text-xs font-bold text-accent">크기 설정</div>

                            {/* 사이즈 */}
                            <div>
                                <div className="text-xs font-bold text-gray-500 mb-2">사이즈</div>
                                <div className="flex gap-1">
                                    {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setCellSize(s)}
                                            className={`flex-1 py-1.5 text-xxs rounded-sm border ${
                                                cellSize === s
                                                    ? 'bg-accent text-primary border-accent font-bold'
                                                    : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                                            }`}
                                        >
                                            {s === 'xs' ? '가장작음' : s === 'sm' ? '작음' : s === 'md' ? '보통' : s === 'lg' ? '큼' : '매우큼'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 글자 크기 */}
                            <div>
                                <div className="text-xs font-bold text-gray-500 mb-2">글자 크기</div>
                                <div className="flex gap-2">
                                    {(['small', 'normal', 'large'] as const).map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setFontSize(f)}
                                            className={`flex-1 py-2 text-xs rounded-sm border ${
                                                fontSize === f
                                                    ? 'bg-accent text-primary border-accent font-bold'
                                                    : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                                            }`}
                                        >
                                            {f === 'small' ? '작게' : f === 'normal' ? '보통' : '크게'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SimpleViewSettingsModal;
