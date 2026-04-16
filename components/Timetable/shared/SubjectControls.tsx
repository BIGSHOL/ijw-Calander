import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    ClipboardList, User as UserIcon, Building,
    Calendar as CalendarIcon, Table2, Settings, ChevronDown, Users
} from 'lucide-react';
import { TimetableSubjectType } from '../../../types';

interface ViewOption {
    key: string;          // viewType + optional mathViewMode
    label: string;
    icon: React.ReactNode;
    category: 'default' | 'dev';
}

// 과목별 뷰 옵션 정의
function getViewOptions(subject: TimetableSubjectType, hasIntegratedPermission: boolean): ViewOption[] {
    if (subject === 'math') {
        return [
            { key: 'excel|excel-teacher', label: '기본뷰', icon: <Table2 size={12} />, category: 'default' },
            { key: 'excel|excel-day', label: '엑셀(요일)', icon: <Table2 size={12} />, category: 'dev' },
            { key: 'room', label: '강의실', icon: <Building size={12} />, category: 'dev' },
            { key: 'class', label: '통합뷰', icon: <ClipboardList size={12} />, category: 'dev' },
            { key: 'excel|excel-teacher-test', label: '테스트 뷰', icon: <Table2 size={12} />, category: 'dev' },
        ];
    }
    if (subject === 'highmath') {
        return [
            { key: 'excel|excel-day', label: '기본뷰', icon: <Table2 size={12} />, category: 'default' },
            { key: 'excel|excel-teacher', label: '엑셀(강사)', icon: <Table2 size={12} />, category: 'dev' },
            { key: 'room', label: '강의실', icon: <Building size={12} />, category: 'dev' },
            { key: 'class', label: '통합뷰', icon: <ClipboardList size={12} />, category: 'dev' },
        ];
    }
    if (subject === 'english') {
        return [
            { key: 'excel', label: '기본뷰', icon: <Table2 size={12} />, category: 'default' },
            { key: 'excel|excel-test', label: '테스트 뷰', icon: <Table2 size={12} />, category: 'dev' },
            { key: 'class', label: '통합뷰', icon: <ClipboardList size={12} />, category: 'dev' },
            { key: 'teacher', label: '강사', icon: <UserIcon size={12} />, category: 'dev' },
            { key: 'room', label: '강의실', icon: <Building size={12} />, category: 'dev' },
        ];
    }
    return [];
}

function getCurrentKey(viewType: string, mathViewMode?: string, _subject?: TimetableSubjectType): string {
    // excel 서브모드가 있으면 pipe key 반환
    if (viewType === 'excel' && mathViewMode) {
        return `excel|${mathViewMode}`;
    }
    return viewType;
}

function getCurrentLabel(options: ViewOption[], currentKey: string): { label: string; icon: React.ReactNode } {
    const found = options.find(o => o.key === currentKey);
    if (found) return { label: found.label, icon: found.icon };
    // 매칭 안 되면 default 카테고리의 첫 옵션(기본뷰) 표시
    const defaultOption = options.find(o => o.category === 'default');
    if (defaultOption) return { label: defaultOption.label, icon: defaultOption.icon };
    return { label: '기본뷰', icon: <Table2 size={12} /> };
}

interface SubjectControlsProps {
    timetableSubject: TimetableSubjectType;
    setTimetableSubject: (value: TimetableSubjectType) => void;
    viewType: 'teacher' | 'room' | 'class' | 'excel';
    setTimetableViewType?: React.Dispatch<React.SetStateAction<'teacher' | 'room' | 'class' | 'excel'>>;
    mathViewMode?: string;
    setMathViewMode?: (value: string) => void;
    hasPermission: (perm: string) => boolean;
    setIsTimetableSettingsOpen?: (value: boolean) => void;
    userDepartments?: ('math' | 'highmath' | 'english')[];
    isMaster?: boolean;
    onMakeEduSyncOpen?: () => void;
}

export default function SubjectControls({
    timetableSubject,
    setTimetableSubject,
    viewType,
    setTimetableViewType,
    mathViewMode,
    setMathViewMode,
    hasPermission,
    setIsTimetableSettingsOpen,
    userDepartments = ['math', 'highmath', 'english', 'science', 'korean'],
    isMaster,
    onMakeEduSyncOpen,
}: SubjectControlsProps) {
    const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 외부 클릭 닫기
    useEffect(() => {
        if (!isViewDropdownOpen) return;
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
                setIsViewDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isViewDropdownOpen]);

    const handleToggleDropdown = () => {
        if (!isViewDropdownOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPos({ top: rect.bottom + 4, left: rect.left });
        }
        setIsViewDropdownOpen(!isViewDropdownOpen);
    };

    const hasMathOrEnglish = timetableSubject === 'math' || timetableSubject === 'highmath' || timetableSubject === 'english';
    const canViewIntegrated = hasPermission('timetable.integrated.view') || hasPermission('timetable.english.view');
    const viewOptions = getViewOptions(timetableSubject, canViewIntegrated);
    const currentKey = getCurrentKey(viewType, mathViewMode, timetableSubject);
    const current = getCurrentLabel(viewOptions, currentKey);

    const handleSelectView = (option: ViewOption) => {
        if (!setTimetableViewType) return;
        const parts = option.key.split('|');
        const newViewType = parts[0] as 'teacher' | 'room' | 'class' | 'excel';
        const newMathViewMode = parts[1];

        setTimetableViewType(newViewType);
        if (setMathViewMode) {
            setMathViewMode(newMathViewMode || '');
        }
        setIsViewDropdownOpen(false);
    };

    const defaultOptions = viewOptions.filter(o => o.category === 'default');
    const devOptions = viewOptions.filter(o => o.category === 'dev');

    return (
        <div className="flex items-center gap-1.5">
            <select
                value={timetableSubject}
                onChange={(e) => setTimetableSubject(e.target.value as TimetableSubjectType)}
                className="px-2 py-0.5 rounded-sm bg-accent text-primary font-bold text-xs hover:brightness-110 transition-all cursor-pointer border-none outline-none"
                title="과목 선택"
            >
                {hasPermission('timetable.math.view') && userDepartments.includes('math') && <option value="math">수학</option>}
                {hasPermission('timetable.math.view') && userDepartments.includes('highmath') && <option value="highmath">고등수학</option>}
                {hasPermission('timetable.english.view') && userDepartments.includes('english') && <option value="english">영어</option>}
                {hasPermission('timetable.science.view') && <option value="science">과학</option>}
                {hasPermission('timetable.korean.view') && <option value="korean">국어</option>}
                {hasPermission('shuttle.view') && <option value="shuttle">셔틀버스</option>}
                <option value="all">전체</option>
            </select>

            {/* 뷰 선택 드롭다운 */}
            {hasMathOrEnglish && setTimetableViewType && viewOptions.length > 0 && (
                <>
                    <button
                        ref={buttonRef}
                        onClick={handleToggleDropdown}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-sm bg-white/10 border border-white/10 text-gray-300 font-bold text-xs hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
                        title="보기방식 선택"
                    >
                        {current.icon}
                        <span>{current.label}</span>
                        <ChevronDown size={10} className={`transition-transform ${isViewDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isViewDropdownOpen && createPortal(
                        <div
                            ref={dropdownRef}
                            className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl min-w-[140px] py-1"
                            style={{ top: dropdownPos.top, left: dropdownPos.left, zIndex: 99999 }}
                        >
                            {/* 기본 뷰 */}
                            {defaultOptions.map(option => (
                                <button
                                    key={option.key}
                                    onClick={() => handleSelectView(option)}
                                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                                        currentKey === option.key
                                            ? 'bg-blue-600 text-white font-bold'
                                            : 'text-gray-200 hover:bg-gray-700'
                                    }`}
                                >
                                    {option.icon}
                                    {option.label}
                                </button>
                            ))}

                            {/* 구분선 + 개발중 카테고리 */}
                            {devOptions.length > 0 && (
                                <>
                                    <div className="my-1 border-t border-gray-600" />
                                    <div className="px-3 py-0.5 text-[11px] text-orange-400 font-semibold">개발중</div>
                                    {devOptions.map(option => (
                                        <button
                                            key={option.key}
                                            onClick={() => handleSelectView(option)}
                                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                                                currentKey === option.key
                                                    ? 'bg-blue-600 text-white font-bold'
                                                    : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                                            }`}
                                        >
                                            {option.icon}
                                            {option.label}
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>,
                        document.body
                    )}
                </>
            )}

            {/* 수업 설정 버튼 */}
            {setIsTimetableSettingsOpen && (
                <button
                    onClick={() => setIsTimetableSettingsOpen(true)}
                    className="p-1 rounded-sm text-gray-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                    title="수업 설정"
                >
                    <Settings size={14} />
                </button>
            )}

            {/* 메이크 에듀 연결하기 */}
            {onMakeEduSyncOpen && (
                <button
                    onClick={onMakeEduSyncOpen}
                    className="flex items-center gap-1 px-2 py-0.5 bg-green-600/80 border border-green-500 text-white rounded-sm hover:bg-green-500 text-xs font-bold transition-colors"
                    title="메이크 에듀 원생 동기화"
                >
                    <Users size={12} />
                    메이크 에듀 연결하기
                </button>
            )}

            <div className="w-px h-4 bg-white/20 mx-0.5"></div>
        </div>
    );
}
