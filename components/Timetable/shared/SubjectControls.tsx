import React from 'react';
import {
    ClipboardList, User as UserIcon, Building,
    Calendar as CalendarIcon, Table2, Settings
} from 'lucide-react';
import { SubjectType } from '../../../types';

interface SubjectControlsProps {
    timetableSubject: SubjectType;
    setTimetableSubject: (value: SubjectType) => void;
    viewType: 'teacher' | 'room' | 'class' | 'excel';
    setTimetableViewType?: React.Dispatch<React.SetStateAction<'teacher' | 'room' | 'class' | 'excel'>>;
    mathViewMode?: 'day-based' | 'teacher-based';
    setMathViewMode?: (value: string) => void;
    hasPermission: (perm: string) => boolean;
    setIsTimetableSettingsOpen?: (value: boolean) => void;
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
}: SubjectControlsProps) {
    return (
        <div className="flex items-center gap-1.5">
            <select
                value={timetableSubject}
                onChange={(e) => setTimetableSubject(e.target.value as SubjectType)}
                className="px-2 py-0.5 rounded-sm bg-white text-gray-700 font-bold text-xs border border-gray-300 hover:bg-gray-100 transition-all cursor-pointer outline-none"
                title="과목 선택"
            >
                {hasPermission('timetable.math.view') && <option value="math">수학</option>}
                {hasPermission('timetable.english.view') && <option value="english">영어</option>}
                {hasPermission('timetable.science.view') && <option value="science">과학</option>}
                {hasPermission('timetable.korean.view') && <option value="korean">국어</option>}
                {hasPermission('shuttle.view') && <option value="shuttle">셔틀버스</option>}
            </select>

            {/* 영어 뷰 전환 */}
            {timetableSubject === 'english' && setTimetableViewType && (
                <button
                    onClick={() => {
                        const canViewIntegrated = hasPermission('timetable.integrated.view') || hasPermission('timetable.english.view');
                        setTimetableViewType(prev => {
                            if (prev === 'class') return 'teacher';
                            if (prev === 'teacher') return 'room';
                            if (prev === 'room') return canViewIntegrated ? 'excel' : 'teacher';
                            return canViewIntegrated ? 'class' : 'teacher';
                        });
                    }}
                    className="px-2 py-0.5 rounded-sm bg-white border border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
                    title="보기방식 전환"
                >
                    {viewType === 'class' ? <><ClipboardList size={12} className="inline" /> 통합뷰</>
                        : viewType === 'excel' ? <><Table2 size={12} className="inline" /> 엑셀</>
                        : viewType === 'teacher' ? <><UserIcon size={12} className="inline" /> 강사</>
                        : <><Building size={12} className="inline" /> 강의실</>}
                </button>
            )}

            {/* 수학 뷰 전환 - 개별 버튼 */}
            {timetableSubject === 'math' && setTimetableViewType && setMathViewMode && (
                <div className="flex items-center bg-gray-200 rounded-sm p-0.5 gap-0.5">
                    <button
                        onClick={() => { setTimetableViewType('teacher'); setMathViewMode('teacher-based'); }}
                        className={`px-1.5 py-0.5 rounded-sm text-xs font-bold transition-all flex items-center gap-0.5 ${viewType === 'teacher' && mathViewMode === 'teacher-based' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                        title="강사별 보기"
                    >
                        <UserIcon size={11} /> 강사별
                    </button>
                    <button
                        onClick={() => { setTimetableViewType('teacher'); setMathViewMode('day-based'); }}
                        className={`px-1.5 py-0.5 rounded-sm text-xs font-bold transition-all flex items-center gap-0.5 ${viewType === 'teacher' && mathViewMode === 'day-based' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                        title="요일별 보기"
                    >
                        <CalendarIcon size={11} /> 요일별
                    </button>
                    <button
                        onClick={() => { setTimetableViewType('room'); }}
                        className={`px-1.5 py-0.5 rounded-sm text-xs font-bold transition-all flex items-center gap-0.5 ${viewType === 'room' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                        title="강의실별 보기"
                    >
                        <Building size={11} /> 강의실별
                    </button>
                    <button
                        onClick={() => { setTimetableViewType('class'); }}
                        className={`px-1.5 py-0.5 rounded-sm text-xs font-bold transition-all flex items-center gap-0.5 ${viewType === 'class' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                        title="통합뷰"
                    >
                        <ClipboardList size={11} /> 통합
                    </button>
                    <button
                        onClick={() => { setTimetableViewType('excel'); }}
                        className={`px-1.5 py-0.5 rounded-sm text-xs font-bold transition-all flex items-center gap-0.5 ${viewType === 'excel' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                        title="엑셀 보기"
                    >
                        <Table2 size={11} /> 엑셀
                    </button>
                </div>
            )}

            {/* 수업 설정 버튼 */}
            {setIsTimetableSettingsOpen && (
                <button
                    onClick={() => setIsTimetableSettingsOpen(true)}
                    className="p-1 rounded-sm bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
                    title="수업 설정"
                >
                    <Settings size={14} />
                </button>
            )}

            <div className="w-px h-4 bg-gray-300 mx-0.5"></div>
        </div>
    );
}
