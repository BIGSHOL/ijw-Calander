import React from 'react';
import {
    ClipboardList, User as UserIcon, Building,
    Calendar as CalendarIcon, Table2, Settings
} from 'lucide-react';
import { TimetableSubjectType } from '../../../types';

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
    userDepartments = ['math', 'highmath', 'english'],
}: SubjectControlsProps) {
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
                    className="px-2 py-0.5 rounded-sm bg-white/10 border border-white/10 text-gray-300 font-bold text-xs hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
                    title="보기방식 전환"
                >
                    {viewType === 'class' ? <><ClipboardList size={12} className="inline" /> 통합뷰</>
                        : viewType === 'excel' ? <><Table2 size={12} className="inline" /> 엑셀</>
                        : viewType === 'teacher' ? <><UserIcon size={12} className="inline" /> 강사</>
                        : <><Building size={12} className="inline" /> 강의실</>}
                </button>
            )}

            {/* 수학/고등수학 뷰 전환 - 강사별뷰 숨김, 엑셀뷰 2종 */}
            {(timetableSubject === 'math' || timetableSubject === 'highmath') && setTimetableViewType && setMathViewMode && (
                <button
                    onClick={() => {
                        setTimetableViewType(prev => {
                            // 강의실 → 통합뷰 → 엑셀(강사) → 엑셀(강사)테스트 → 엑셀(요일) → 강의실
                            if (prev === 'teacher') return 'room';
                            if (prev === 'room') return 'class';
                            if (prev === 'class') {
                                setMathViewMode('excel-teacher');
                                return 'excel';
                            }
                            if (prev === 'excel' && mathViewMode === 'excel-teacher') {
                                setMathViewMode('excel-teacher-test');
                                return 'excel';
                            }
                            if (prev === 'excel' && mathViewMode === 'excel-teacher-test') {
                                setMathViewMode('excel-day');
                                return 'excel';
                            }
                            // excel-day → 강의실
                            return 'room';
                        });
                    }}
                    className="px-2 py-0.5 rounded-sm bg-white/10 border border-white/10 text-gray-300 font-bold text-xs hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
                    title="보기방식 전환"
                >
                    {viewType === 'room' ? <><Building size={12} className="inline" /> 강의실</>
                        : viewType === 'class' ? <><ClipboardList size={12} className="inline" /> 통합뷰</>
                        : viewType === 'excel' && mathViewMode === 'excel-day' ? <><Table2 size={12} className="inline" /> 엑셀(요일)</>
                        : viewType === 'excel' && mathViewMode === 'excel-teacher-test' ? <><Table2 size={12} className="inline" /> 엑셀(강사)테스트</>
                        : viewType === 'excel' ? <><Table2 size={12} className="inline" /> 엑셀(강사)</>
                        : <><Building size={12} className="inline" /> 강의실</>}
                </button>
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

            <div className="w-px h-4 bg-white/20 mx-0.5"></div>
        </div>
    );
}
