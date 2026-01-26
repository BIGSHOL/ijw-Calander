// Math Integration Class Card
// 영어 ClassCard와 동일한 디자인

import React, { useState, useEffect, useMemo } from 'react';
import { Eye, EyeOff, Users } from 'lucide-react';
import { MathClassInfo } from './hooks/useMathIntegrationClasses';
import { MathDisplayOptions } from './hooks/useMathSettings';
import { Teacher, TimetableStudent, ClassKeywordColor } from '../../../types';
import MathMiniGridRow from './MathMiniGridRow';
import { formatSchoolGrade } from '../../../utils/studentUtils';

interface ClassStudentData {
    studentList: TimetableStudent[];
    studentIds: string[];
}

// 학생 항목 컴포넌트
interface MathStudentItemProps {
    student: TimetableStudent;
    style: { className: string; textClass: string; subTextClass: string };
    mode: 'view' | 'edit';
    onStudentClick?: (studentId: string) => void;
}

const MathStudentItem: React.FC<MathStudentItemProps> = ({
    student,
    style,
    mode,
    onStudentClick
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const isClickable = !!onStudentClick;

    const hoverStyle: React.CSSProperties = isClickable && isHovered ? {
        backgroundColor: '#dbeafe',
        color: '#1e40af',
        fontWeight: 600
    } : {};

    return (
        <div
            onClick={(e) => {
                if (isClickable) {
                    e.stopPropagation();
                    onStudentClick(student.id);
                }
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`flex items-center justify-between text-[12px] py-0.5 px-1 transition-all duration-150 ${style.className} ${isClickable ? 'cursor-pointer' : ''}`}
            style={hoverStyle}
        >
            <span className={`font-medium truncate max-w-[90px] ${isHovered && isClickable ? '' : style.textClass}`}>
                {student.name}
            </span>
            <span className={`text-micro ml-1 shrink-0 text-right leading-none ${isHovered && isClickable ? '' : (style.subTextClass || 'text-gray-500')}`}>
                {formatSchoolGrade(student.school, student.grade)}
            </span>
        </div>
    );
};

interface MathIntegrationClassCardProps {
    classInfo: MathClassInfo;
    mode: 'view' | 'edit';
    displayOptions?: MathDisplayOptions;
    teachersData: Teacher[];
    classKeywords?: ClassKeywordColor[];
    currentUser: any;
    isSimulationMode?: boolean;
    classStudentData?: ClassStudentData;
    isTimeColumnOnly?: boolean;
    hideTime?: boolean;
    isHidden?: boolean;
    onToggleHidden?: () => void;
    onClassClick?: () => void;
    onStudentClick?: (studentId: string) => void;
}

const MathIntegrationClassCard: React.FC<MathIntegrationClassCardProps> = ({
    classInfo,
    mode,
    displayOptions = { showStudents: true, showRoom: true, showTeacher: true, showSchedule: true },
    teachersData,
    classKeywords = [],
    currentUser,
    isSimulationMode = false,
    classStudentData,
    isTimeColumnOnly = false,
    hideTime = false,
    isHidden = false,
    onToggleHidden,
    onClassClick,
    onStudentClick,
}) => {
    // Width: TimeColumn=49px, HideTime=160px, Normal=190px
    const cardWidthClass = isTimeColumnOnly ? 'w-[49px]' : (hideTime ? 'w-[160px]' : 'w-[190px]');

    const [students, setStudents] = useState<TimetableStudent[]>([]);
    const [studentCount, setStudentCount] = useState<number>(0);

    // 키워드 색상 찾기
    const keywordColor = useMemo(() => {
        for (const kw of classKeywords) {
            if (classInfo.name.includes(kw.keyword)) {
                return kw;
            }
        }
        return null;
    }, [classInfo.name, classKeywords]);

    // 학생 데이터 로드
    useEffect(() => {
        if (classStudentData) {
            setStudents(classStudentData.studentList || []);
        } else {
            setStudents([]);
        }
    }, [classStudentData]);

    // 학생 분류
    useEffect(() => {
        const activeCount = students.filter(s => !s.withdrawalDate && !s.onHold).length;
        setStudentCount(activeCount);
    }, [students]);

    const activeStudents = students.filter(s => !s.withdrawalDate && !s.onHold);
    const holdStudents = students.filter(s => s.onHold && !s.withdrawalDate);
    const withdrawnStudents = students.filter(s => s.withdrawalDate);

    // 학생 정렬
    const sortedActiveStudents = useMemo(() => {
        return [...activeStudents].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }, [activeStudents]);

    // 수업 상세 클릭 핸들러
    const handleClassDetailClick = (e: React.MouseEvent) => {
        if (mode === 'edit' && onClassClick && !isTimeColumnOnly) {
            e.stopPropagation();
            onClassClick();
        }
    };

    // 학생 스타일
    const getRowStyle = (student: TimetableStudent) => {
        if (student.underline) {
            return { className: 'bg-blue-50', textClass: 'underline decoration-blue-600 text-blue-600 underline-offset-2', subTextClass: 'text-blue-500' };
        }
        return { className: '', textClass: 'text-gray-800', subTextClass: 'text-gray-500' };
    };

    return (
        <div className={`${cardWidthClass} h-full flex flex-col border-r border-gray-300 shrink-0 bg-white`}>
            {/* 수업 상세 클릭 영역 */}
            <div
                onClick={handleClassDetailClick}
                className={mode === 'edit' && !isTimeColumnOnly ? 'cursor-pointer hover:brightness-95' : ''}
            >
                {/* Header - 수업명 */}
                {(() => {
                    if (isTimeColumnOnly) {
                        return (
                            <div className="p-2 text-center font-bold text-sm border-b border-orange-300 flex items-center justify-center h-[50px] bg-orange-200 text-orange-900 select-none">
                                수업
                            </div>
                        );
                    }

                    return (
                        <div
                            className={`p-2 text-center font-bold text-sm border-b border-gray-300 flex items-center justify-center h-[50px] break-keep leading-tight relative group ${mode === 'view' ? 'cursor-help' : ''}`}
                            style={keywordColor ? { backgroundColor: keywordColor.bgColor, color: keywordColor.textColor } : { backgroundColor: '#EFF6FF', color: '#1F2937' }}
                        >
                            {classInfo.name}

                            {/* Edit Controls */}
                            {mode === 'edit' && onToggleHidden && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onToggleHidden(); }}
                                    className="absolute top-1 right-1 p-1 rounded hover:bg-black/10 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title={isHidden ? "보이기" : "숨기기"}
                                >
                                    {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                            )}
                        </div>
                    );
                })()}

                {/* Info Summary (Teacher/Room) */}
                {(displayOptions?.showTeacher || displayOptions?.showRoom) && (
                    <div className="bg-orange-50 border-b border-gray-300 text-xs flex flex-col">
                        {displayOptions?.showTeacher && (
                            <div className={`flex border-b border-orange-200 h-[26px] ${isTimeColumnOnly ? 'bg-orange-100 justify-center items-center' : 'bg-orange-50'}`}>
                                {isTimeColumnOnly ? (
                                    <span className="font-bold text-orange-800">담임</span>
                                ) : (
                                    <div className="flex-1 p-0.5 text-center font-bold text-gray-900 flex items-center justify-center h-full">
                                        {classInfo.mainTeacher || '-'}
                                    </div>
                                )}
                            </div>
                        )}
                        {displayOptions?.showRoom && (
                            <div className={`flex h-[32px] ${isTimeColumnOnly ? 'bg-orange-100 justify-center items-center' : 'bg-orange-50'}`}>
                                {isTimeColumnOnly ? (
                                    <span className="font-bold text-orange-800">강의실</span>
                                ) : (
                                    <div className="flex-1 p-0.5 text-center font-bold text-navy flex items-center justify-center break-all h-full leading-tight text-xs">
                                        {classInfo.mainRoom || '-'}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Schedule Grid */}
                {displayOptions?.showSchedule !== false && (
                    <div className="border-b border-gray-300 flex-none">
                        {/* Grid Header */}
                        <div className="flex bg-gray-200 text-xxs font-bold border-b border-gray-400 h-[24px]">
                            {!hideTime && (
                                <div className="w-[48px] flex items-center justify-center border-r border-gray-400 text-gray-600">시간</div>
                            )}
                            {!isTimeColumnOnly && classInfo.finalDays.map((d) => (
                                <div key={d} className={`flex-1 flex items-center justify-center border-r border-gray-400 last:border-r-0 text-gray-700 ${d === '토' || d === '일' ? 'text-red-600' : ''}`}>
                                    {d}
                                </div>
                            ))}
                        </div>

                        {/* Grid Rows */}
                        <div className="bg-white">
                            {classInfo.visiblePeriods.map(p => (
                                <MathMiniGridRow
                                    key={p.id}
                                    period={p}
                                    scheduleMap={classInfo.scheduleMap}
                                    teachersData={teachersData}
                                    displayDays={classInfo.finalDays}
                                    hideTime={hideTime}
                                    onlyTime={isTimeColumnOnly}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Student List */}
            {displayOptions?.showStudents ? (
                isTimeColumnOnly ? (
                    // Sticky Column Labels
                    <div className="flex flex-col border-r border-gray-300">
                        <div className="h-[190px] flex flex-col items-center justify-center bg-indigo-50 text-indigo-900 font-bold text-sm leading-relaxed select-none border-b border-indigo-100">
                            <span>재</span>
                            <span>원</span>
                            <span>생</span>
                        </div>
                        <div className="flex items-center justify-center bg-violet-100 text-violet-700 font-bold text-xs h-[40px] border-b border-violet-200 select-none">
                            대기
                        </div>
                        <div className="flex items-center justify-center bg-gray-100 text-gray-600 font-bold text-xs h-[80px] select-none">
                            퇴원
                        </div>
                    </div>
                ) : (
                    // Data Column
                    <div className="flex flex-col bg-white border-r border-gray-300">
                        {/* 재원생 Section */}
                        <div className="h-[190px] flex flex-col border-b border-indigo-100">
                            <div className="border-b border-gray-300 flex items-center justify-center h-[30px] shrink-0 bg-white">
                                <div className="w-full h-full text-center text-[13px] font-bold bg-indigo-50 text-indigo-600 flex items-center justify-center gap-2">
                                    <Users size={14} />
                                    <span>{studentCount}명</span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto px-2 py-1.5 text-xxs flex flex-col custom-scrollbar">
                                {sortedActiveStudents.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-300">
                                        <span>학생이 없습니다</span>
                                    </div>
                                ) : (
                                    <>
                                        {sortedActiveStudents.slice(0, 12).map((student) => {
                                            const style = getRowStyle(student);
                                            return (
                                                <MathStudentItem
                                                    key={student.id}
                                                    student={student}
                                                    style={style}
                                                    mode={mode}
                                                    onStudentClick={onStudentClick}
                                                />
                                            );
                                        })}
                                        {sortedActiveStudents.length > 12 && (
                                            <div className="text-indigo-500 font-bold mt-0.5 text-xs">
                                                +{sortedActiveStudents.length - 12}명 더보기...
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* 대기 Section */}
                        <div className="h-[40px] flex items-center bg-violet-50 border-b border-violet-200 px-2 overflow-hidden">
                            {holdStudents.length === 0 ? (
                                <span className="text-xxs text-violet-300">-</span>
                            ) : (
                                <div className="flex flex-wrap gap-1 text-xxs">
                                    {holdStudents.slice(0, 3).map(s => (
                                        <span key={s.id} className="bg-violet-100 text-violet-800 px-1 rounded">{s.name}</span>
                                    ))}
                                    {holdStudents.length > 3 && <span className="text-violet-600">+{holdStudents.length - 3}</span>}
                                </div>
                            )}
                        </div>

                        {/* 퇴원생 Section */}
                        <div className="h-[80px] flex flex-col bg-gray-100 px-2 py-1 overflow-y-auto custom-scrollbar">
                            {withdrawnStudents.length === 0 ? (
                                <span className="text-xxs text-gray-500 flex items-center justify-center h-full">-</span>
                            ) : (
                                <>
                                    {withdrawnStudents.slice(0, 3).map((student) => (
                                        <div
                                            key={student.id}
                                            className="flex items-center justify-between text-[12px] py-0.5 px-1 bg-black rounded text-white mb-0.5"
                                            title={student.withdrawalDate ? `퇴원일: ${student.withdrawalDate}` : undefined}
                                        >
                                            <div className="flex items-center truncate max-w-[90px]">
                                                <span className="font-medium">{student.name}</span>
                                            </div>
                                            <span className="text-xxs ml-1 shrink-0 text-gray-300 text-right leading-none">
                                                {formatSchoolGrade(student.school, student.grade)}
                                            </span>
                                        </div>
                                    ))}
                                    {withdrawnStudents.length > 3 && (
                                        <span className="text-micro text-gray-400">+{withdrawnStudents.length - 3}명</span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )
            ) : null}
        </div>
    );
};

export default MathIntegrationClassCard;
