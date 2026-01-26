// Shared Integration Class Card
// 영어/수학 통합뷰 공용 수업 카드

import React, { useState, useEffect, useMemo } from 'react';
import { Eye, EyeOff, Users, MoreVertical, TrendingUp, ArrowUpCircle, Clock } from 'lucide-react';
import { Teacher, TimetableStudent, ClassKeywordColor, EnglishLevel } from '../../../types';
import IntegrationMiniGridRow, { PeriodInfo, ScheduleCell } from './IntegrationMiniGridRow';
import { formatSchoolGrade } from '../../../utils/studentUtils';
import LevelUpConfirmModal from '../English/LevelUpConfirmModal';
import { isValidLevel, numberLevelUp, classLevelUp, isMaxLevel, EN_PERIODS, INJAE_PERIODS } from '../English/englishUtils';

// 공용 클래스 정보 타입
export interface IntegrationClassInfo {
    name: string;
    classId: string;
    mainTeacher: string;
    mainRoom: string;
    startPeriod: number;
    scheduleMap: Record<string, Record<string, ScheduleCell>>;
    visiblePeriods: PeriodInfo[];
    finalDays: string[];
    formattedRoomStr?: string;
    weekendShift?: number;  // 영어용
}

export interface DisplayOptions {
    showStudents: boolean;
    showRoom: boolean;
    showTeacher: boolean;
    showSchedule: boolean;
}

export interface ClassStudentData {
    studentList: TimetableStudent[];
    studentIds: string[];
}

// 학생 항목 컴포넌트
interface StudentItemProps {
    student: TimetableStudent & { isTempMoved?: boolean };
    style: { className: string; textClass: string; subTextClass: string; englishTextClass?: string };
    mode: 'view' | 'edit';
    showEnglishName?: boolean;
    onStudentClick?: (studentId: string) => void;
    onDragStart?: (e: React.DragEvent, student: TimetableStudent) => void;
    classDays?: string[];  // 수업의 모든 요일 (수학 부분등원 뱃지용)
}

const StudentItem: React.FC<StudentItemProps> = ({
    student,
    style,
    mode,
    showEnglishName = false,
    onStudentClick,
    onDragStart,
    classDays = []
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const isClickable = !!onStudentClick;
    const isDraggable = mode === 'edit' && onDragStart && !student.isTempMoved;

    const hoverStyle: React.CSSProperties = isClickable && isHovered ? {
        backgroundColor: '#dbeafe',
        color: '#1e40af',
        fontWeight: 600
    } : {};

    // 부분등원 뱃지 계산 (수학용)
    // - classDays: 수업의 모든 요일 (예: ['월', '목'])
    // - student.attendanceDays: 학생이 등원하는 요일 (예: ['월'])
    // - 모든 요일에 등원하면 뱃지 없음, 부분만 등원하면 해당 요일 뱃지 표시
    const partialDaysBadge = useMemo(() => {
        if (!classDays || classDays.length <= 1) return null;
        const attendanceDays = student.attendanceDays;
        if (!attendanceDays || attendanceDays.length === 0) return null;  // 설정 없으면 전체 등원

        // 수업 요일 중 학생이 등원하는 요일
        const studentDays = classDays.filter(d => attendanceDays.includes(d));

        // 모든 수업 요일에 등원하면 뱃지 없음
        if (studentDays.length === classDays.length) return null;

        // 부분 등원: 등원하는 요일만 표시
        return studentDays;
    }, [classDays, student.attendanceDays]);

    return (
        <div
            draggable={isDraggable}
            onDragStart={(e) => isDraggable && onDragStart?.(e, student)}
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
            <span className={`font-medium truncate flex items-center gap-0.5 ${isHovered && isClickable ? '' : style.textClass}`}>
                <span className="truncate max-w-[70px]">{student.name}</span>
                {showEnglishName && student.englishName && (
                    <span className={`font-normal ${isHovered && isClickable ? '' : (style.englishTextClass || 'text-gray-500')}`}>
                        ({student.englishName})
                    </span>
                )}
                {partialDaysBadge && (
                    <span className="text-[9px] font-bold text-orange-600 bg-orange-100 px-0.5 rounded shrink-0">
                        {partialDaysBadge.join('')}
                    </span>
                )}
            </span>
            <span className={`text-micro ml-1 shrink-0 text-right leading-none ${isHovered && isClickable ? '' : (style.subTextClass || 'text-gray-500')}`}>
                {formatSchoolGrade(student.school, student.grade)}
            </span>
        </div>
    );
};

interface IntegrationClassCardProps {
    classInfo: IntegrationClassInfo;
    mode: 'view' | 'edit';
    subject: 'english' | 'math';
    displayOptions?: DisplayOptions;
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
    // 영어 전용 props
    englishLevels?: EnglishLevel[];
    onSimulationLevelUp?: (oldName: string, newName: string) => void;
    moveChanges?: Map<string, any>;
    onMoveStudent?: (student: TimetableStudent, fromClass: string, toClass: string) => void;
    hiddenTeacherList?: string[];
    useInjaePeriod?: boolean;
}

// 주말 실제 시간대 (영어용)
const WEEKEND_PERIOD_TIMES: Record<string, string> = {
    '1': '09:00~10:00',
    '2': '10:00~11:00',
    '3': '11:00~12:00',
    '4': '12:00~13:00',
    '5': '13:00~14:00',
    '6': '14:00~15:00',
    '7': '15:00~16:00',
    '8': '16:00~17:00',
};

const IntegrationClassCard: React.FC<IntegrationClassCardProps> = ({
    classInfo,
    mode,
    subject,
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
    englishLevels = [],
    onSimulationLevelUp,
    moveChanges,
    onMoveStudent,
    hiddenTeacherList = [],
    useInjaePeriod = false,
}) => {
    const cardWidthClass = isTimeColumnOnly ? 'w-[49px]' : (hideTime ? 'w-[160px]' : 'w-[190px]');
    const isEnglish = subject === 'english';

    const [students, setStudents] = useState<TimetableStudent[]>([]);
    const [displayStudents, setDisplayStudents] = useState<TimetableStudent[]>([]);
    const [studentCount, setStudentCount] = useState<number>(0);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [levelUpModal, setLevelUpModal] = useState<{ isOpen: boolean; type: 'number' | 'class'; newName: string }>({ isOpen: false, type: 'number', newName: '' });
    const [showScheduleTooltip, setShowScheduleTooltip] = useState(false);

    // 키워드 색상 찾기
    const keywordColor = useMemo(() => {
        for (const kw of classKeywords) {
            if (classInfo.name.includes(kw.keyword)) {
                return kw;
            }
        }
        return null;
    }, [classInfo.name, classKeywords]);

    // 수업 스케줄 정보 생성 (영어 마우스 오버 툴팁용)
    const scheduleInfo = useMemo(() => {
        if (!isEnglish) return [];

        const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];
        const scheduleByDay: Record<string, { periods: string[]; times: string[] }> = {};
        const periodsToUse = useInjaePeriod ? INJAE_PERIODS : EN_PERIODS;

        Object.entries(classInfo.scheduleMap).forEach(([periodId, dayMap]) => {
            Object.keys(dayMap).forEach(day => {
                if (!scheduleByDay[day]) {
                    scheduleByDay[day] = { periods: [], times: [] };
                }

                const isWeekend = day === '토' || day === '일';
                const period = periodsToUse.find(p => p.id === periodId);
                let timeStr: string = isWeekend
                    ? (WEEKEND_PERIOD_TIMES[periodId] || period?.time || '')
                    : (period?.time || '');

                if (!timeStr) return;
                if (!scheduleByDay[day].periods.includes(periodId)) {
                    scheduleByDay[day].periods.push(periodId);
                    scheduleByDay[day].times.push(timeStr);
                }
            });
        });

        const sortedDays = Object.keys(scheduleByDay).sort(
            (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)
        );

        return sortedDays.map(day => {
            const info = scheduleByDay[day];
            const validTimes = info.times.filter(t => t && t.includes('~'));
            if (validTimes.length === 0) return { day, timeRange: '시간 미정' };

            const sortedIndices = info.periods
                .map((p, i) => ({ period: parseInt(p), index: i }))
                .filter(item => info.times[item.index] && info.times[item.index].includes('~'))
                .sort((a, b) => a.period - b.period);

            if (sortedIndices.length === 0) return { day, timeRange: '시간 미정' };

            const sortedTimes = sortedIndices.map(item => info.times[item.index]);
            const firstTime = sortedTimes[0];
            const lastTime = sortedTimes[sortedTimes.length - 1];
            const startTime = firstTime.split('~')[0];
            const endTime = lastTime.split('~')[1];
            const timeRange = sortedTimes.length > 1 ? `${startTime}~${endTime}` : firstTime;

            return { day, timeRange };
        }).filter(item => item.timeRange !== '시간 미정');
    }, [classInfo.scheduleMap, useInjaePeriod, isEnglish]);

    // 학생 데이터 로드
    useEffect(() => {
        if (classStudentData) {
            setStudents(classStudentData.studentList || []);
        } else {
            setStudents([]);
        }
    }, [classStudentData]);

    // 학생 목록 업데이트 (moveChanges 반영)
    useEffect(() => {
        let currentList = [...students];

        // 입학일 필터링
        const today = new Date().toISOString().split('T')[0];
        currentList = currentList.filter(s => {
            if (!s.enrollmentDate) return true;
            return s.enrollmentDate <= today;
        });

        if (moveChanges) {
            // 이동 나간 학생 제거
            currentList = currentList.filter(s => {
                const change = moveChanges.get(s.id);
                return !(change && change.fromClass === classInfo.name);
            });
            // 이동 들어온 학생 추가
            moveChanges.forEach(change => {
                if (change.toClass === classInfo.name) {
                    if (!currentList.find(s => s.id === change.student.id)) {
                        currentList.push({ ...change.student, isTempMoved: true });
                    }
                }
            });
        }

        const activeCount = currentList.filter(s => !s.withdrawalDate && !s.onHold).length;
        setStudentCount(activeCount);
        setDisplayStudents(currentList);
    }, [students, moveChanges, classInfo.name]);

    const activeStudents = displayStudents.filter(s => !s.withdrawalDate && !s.onHold);
    const holdStudents = displayStudents.filter(s => s.onHold && !s.withdrawalDate);
    const withdrawnStudents = displayStudents.filter(s => s.withdrawalDate);

    // 신입생 판별 (영어용)
    const isNewStudent = (enrollmentDate: string): number => {
        const days = Math.ceil((Date.now() - new Date(enrollmentDate).getTime()) / (1000 * 60 * 60 * 24));
        if (days <= 30) return 1;
        if (days <= 60) return 2;
        return 0;
    };

    // 학생 정렬 및 스타일
    const sortedActiveStudents = useMemo(() => {
        const classDays = classInfo.finalDays || [];
        const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];

        return [...activeStudents].sort((a, b) => {
            if (isEnglish) {
                // 영어: 기존 정렬 (underline → 일반 → 신입생)
                const getWeight = (s: TimetableStudent) => {
                    if (s.underline) return 0;
                    if (s.enrollmentDate) {
                        const newStatus = isNewStudent(s.enrollmentDate);
                        if (newStatus === 1) return 3;
                        if (newStatus === 2) return 2;
                    }
                    return 1;
                };
                const wA = getWeight(a), wB = getWeight(b);
                return wA !== wB ? wA - wB : a.name.localeCompare(b.name, 'ko');
            }

            // 수학: 전체등원 → 부분등원 (요일별 그룹화)
            const getAttendanceWeight = (s: TimetableStudent): number => {
                if (!s.attendanceDays || s.attendanceDays.length === 0 || classDays.length <= 1) {
                    return 0; // 전체 등원 (설정 없거나 단일 요일 수업)
                }
                const studentDays = classDays.filter(d => s.attendanceDays!.includes(d));
                if (studentDays.length === classDays.length) {
                    return 0; // 모든 수업 요일 등원
                }
                // 부분 등원: 첫 번째 등원 요일 기준으로 정렬
                const firstDay = studentDays.sort((x, y) => dayOrder.indexOf(x) - dayOrder.indexOf(y))[0];
                return 10 + dayOrder.indexOf(firstDay); // 10+ 로 전체등원보다 뒤로
            };

            const wA = getAttendanceWeight(a), wB = getAttendanceWeight(b);
            return wA !== wB ? wA - wB : a.name.localeCompare(b.name, 'ko');
        });
    }, [activeStudents, isEnglish, classInfo.finalDays]);

    const getRowStyle = (student: TimetableStudent & { isTempMoved?: boolean; isMoved?: boolean }) => {
        if (student.isTempMoved) return { className: 'bg-green-100 ring-1 ring-green-300', textClass: 'text-green-800 font-bold', subTextClass: 'text-green-600', englishTextClass: 'text-green-700' };
        if (student.isMoved && student.underline) return { className: 'bg-green-50 ring-1 ring-green-300', textClass: 'underline decoration-blue-600 text-green-800 font-bold underline-offset-2', subTextClass: 'text-green-600', englishTextClass: 'text-green-700' };
        if (student.isMoved) return { className: 'bg-green-100 ring-1 ring-green-300', textClass: 'text-green-800 font-bold', subTextClass: 'text-green-600', englishTextClass: 'text-green-700' };
        if (student.underline) return { className: 'bg-blue-50', textClass: 'underline decoration-blue-600 text-blue-600 underline-offset-2', subTextClass: 'text-blue-500', englishTextClass: 'text-blue-600' };
        if (isEnglish && student.enrollmentDate) {
            const newStatus = isNewStudent(student.enrollmentDate);
            if (newStatus === 1) return { className: 'bg-red-500', textClass: 'text-white font-bold', subTextClass: 'text-white', englishTextClass: 'text-white/80' };
            if (newStatus === 2) return { className: 'bg-pink-100', textClass: 'text-black font-bold', subTextClass: 'text-black', englishTextClass: 'text-gray-600' };
        }
        return { className: '', textClass: 'text-gray-800', subTextClass: 'text-gray-500', englishTextClass: 'text-gray-500' };
    };

    // 드래그 핸들러
    const handleDragOver = (e: React.DragEvent) => {
        if (mode === 'edit' && onMoveStudent) {
            e.preventDefault();
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        if (mode !== 'edit' || !onMoveStudent) return;
        e.preventDefault();
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data && data.student) {
                if (data.fromClass === classInfo.name) return;
                if (data.isNewStudent && !confirm(`${data.student.name}은(는) 신입생입니다.\n반 이동하시겠습니까?`)) {
                    return;
                }
                onMoveStudent(data.student, data.fromClass, classInfo.name);
            }
        } catch (err) {
            console.error('Drop parse error', err);
        }
    };

    const handleDragStart = (e: React.DragEvent, student: TimetableStudent) => {
        if (mode !== 'edit' || student.withdrawalDate) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('text/plain', JSON.stringify({
            student,
            fromClass: classInfo.name,
            isNewStudent: isEnglish && student.enrollmentDate ? isNewStudent(student.enrollmentDate) > 0 : false
        }));
    };

    const handleClassDetailClick = (e: React.MouseEvent) => {
        if (mode === 'edit' && onClassClick && !isTimeColumnOnly) {
            e.stopPropagation();
            onClassClick();
        }
    };

    return (
        <>
        <div
            onDragOver={isTimeColumnOnly ? undefined : handleDragOver}
            onDrop={isTimeColumnOnly ? undefined : handleDrop}
            className={`${cardWidthClass} h-full flex flex-col border-r border-gray-300 shrink-0 bg-white`}
        >
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
                            onMouseEnter={() => isEnglish && mode !== 'edit' && setShowScheduleTooltip(true)}
                            onMouseLeave={() => setShowScheduleTooltip(false)}
                        >
                            {classInfo.name}

                            {/* Schedule Tooltip (영어 조회 모드에서만 마우스 오버 시 실제 스케줄 표시) */}
                            {isEnglish && mode !== 'edit' && showScheduleTooltip && scheduleInfo.length > 0 && (
                                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50 p-2 min-w-[140px] whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
                                    <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-gray-700">
                                        <Clock size={12} className="text-yellow-400" />
                                        <span className="font-bold">수업 시간</span>
                                    </div>
                                    <div className="space-y-1">
                                        {scheduleInfo.map(({ day, timeRange }) => (
                                            <div key={day} className="flex justify-between gap-3">
                                                <span className={`font-bold ${day === '토' || day === '일' ? 'text-red-400' : 'text-blue-300'}`}>
                                                    {day}
                                                </span>
                                                <span className="text-gray-200">{timeRange}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                                </div>
                            )}

                            {/* Edit Controls */}
                            {mode === 'edit' && (
                                <>
                                    {onToggleHidden && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onToggleHidden(); }}
                                            className="absolute top-1 right-7 p-1 rounded hover:bg-black/10 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title={isHidden ? "보이기" : "숨기기"}
                                        >
                                            {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                                        </button>
                                    )}
                                    {isEnglish && englishLevels.length > 0 && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                                            className="absolute top-1 right-1 p-1 rounded hover:bg-black/10 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <MoreVertical size={14} />
                                        </button>
                                    )}

                                    {/* Level Up Dropdown (영어 전용) */}
                                    {isEnglish && isMenuOpen && (
                                        <div className="absolute top-8 right-1 bg-white shadow-lg rounded-lg border border-gray-200 z-20 py-1 min-w-[140px]" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={() => {
                                                    if (!isValidLevel(classInfo.name, englishLevels)) {
                                                        alert(`'${classInfo.name}' 수업은 레벨 설정에 등록되지 않았습니다.\n\n영어 레벨 설정에서 해당 레벨을 추가해주세요.`);
                                                        setIsMenuOpen(false);
                                                        return;
                                                    }
                                                    const newName = numberLevelUp(classInfo.name);
                                                    if (newName) {
                                                        setLevelUpModal({ isOpen: true, type: 'number', newName });
                                                    }
                                                    setIsMenuOpen(false);
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-indigo-50 text-gray-700"
                                            >
                                                <TrendingUp size={14} className="text-indigo-500" />
                                                숫자 레벨업
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (!isValidLevel(classInfo.name, englishLevels)) {
                                                        alert(`'${classInfo.name}' 수업은 레벨 설정에 등록되지 않았습니다.\n\n영어 레벨 설정에서 해당 레벨을 추가해주세요.`);
                                                        setIsMenuOpen(false);
                                                        return;
                                                    }
                                                    const newName = classLevelUp(classInfo.name, englishLevels);
                                                    if (newName) {
                                                        setLevelUpModal({ isOpen: true, type: 'class', newName });
                                                    }
                                                    setIsMenuOpen(false);
                                                }}
                                                disabled={isMaxLevel(classInfo.name, englishLevels)}
                                                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${isMaxLevel(classInfo.name, englishLevels) ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-orange-50 text-gray-700'}`}
                                            >
                                                <ArrowUpCircle size={14} className={isMaxLevel(classInfo.name, englishLevels) ? 'text-gray-300' : 'text-orange-500'} />
                                                클래스 레벨업
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })()}

                {/* Info Summary (Teacher/Room) */}
                {(displayOptions?.showTeacher || displayOptions?.showRoom) && (
                    <div className="bg-orange-50 border-b border-gray-300 text-xs flex flex-col">
                        {displayOptions?.showTeacher && (() => {
                            const mainTeacherData = teachersData.find(t => t.name === classInfo.mainTeacher || t.englishName === classInfo.mainTeacher);
                            const displayTeacherName = isEnglish ? (mainTeacherData?.englishName || classInfo.mainTeacher) : classInfo.mainTeacher;

                            return (
                                <div className={`flex border-b border-orange-200 h-[26px] ${isTimeColumnOnly ? 'bg-orange-100 justify-center items-center' : 'bg-orange-50'}`}>
                                    {isTimeColumnOnly ? (
                                        <span className="font-bold text-orange-800">담임</span>
                                    ) : (
                                        <div className="flex-1 p-0.5 text-center font-bold text-gray-900 flex items-center justify-center h-full">
                                            {displayTeacherName || '-'}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                        {displayOptions?.showRoom && (
                            <div className={`flex h-[32px] ${isTimeColumnOnly ? 'bg-orange-100 justify-center items-center' : 'bg-orange-50'}`}>
                                {isTimeColumnOnly ? (
                                    <span className="font-bold text-orange-800">강의실</span>
                                ) : (
                                    <div className="flex-1 p-0.5 text-center font-bold text-navy flex items-center justify-center break-all h-full leading-tight text-xs">
                                        {classInfo.formattedRoomStr || classInfo.mainRoom || '-'}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Schedule Grid */}
                {displayOptions?.showSchedule !== false && (
                    <div className="border-b border-gray-300 flex-none">
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
                        <div className="bg-white">
                            {classInfo.visiblePeriods.map(p => (
                                <IntegrationMiniGridRow
                                    key={p.id}
                                    period={p}
                                    scheduleMap={classInfo.scheduleMap}
                                    teachersData={teachersData}
                                    displayDays={classInfo.finalDays}
                                    hiddenTeachers={hiddenTeacherList}
                                    hideTime={hideTime}
                                    onlyTime={isTimeColumnOnly}
                                    weekendShift={classInfo.weekendShift || 0}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Student List */}
            {displayOptions?.showStudents ? (
                isTimeColumnOnly ? (
                    <div className="flex flex-col border-r border-gray-300">
                        <div className="h-[190px] flex flex-col items-center justify-center bg-indigo-50 text-indigo-900 font-bold text-sm leading-relaxed select-none border-b border-indigo-100">
                            <span>재</span><span>원</span><span>생</span>
                        </div>
                        <div className="flex items-center justify-center bg-violet-100 text-violet-700 font-bold text-xs h-[40px] border-b border-violet-200 select-none">
                            대기
                        </div>
                        <div className="flex items-center justify-center bg-gray-100 text-gray-600 font-bold text-xs h-[80px] select-none">
                            퇴원
                        </div>
                    </div>
                ) : (
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
                                        {sortedActiveStudents.slice(0, 12).map((student) => (
                                            <StudentItem
                                                key={student.id}
                                                student={student}
                                                style={getRowStyle(student)}
                                                mode={mode}
                                                showEnglishName={isEnglish}
                                                onStudentClick={onStudentClick}
                                                onDragStart={onMoveStudent ? handleDragStart : undefined}
                                                classDays={!isEnglish ? classInfo.finalDays : undefined}
                                            />
                                        ))}
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
                                                {isEnglish && student.englishName && <span className="ml-1 text-gray-400">({student.englishName})</span>}
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

        {/* Level Up Confirm Modal (영어 전용) */}
        {isEnglish && (
            <LevelUpConfirmModal
                isOpen={levelUpModal.isOpen}
                onClose={() => setLevelUpModal({ ...levelUpModal, isOpen: false })}
                onSuccess={() => {
                    console.log('[IntegrationClassCard] Level-up succeeded for', classInfo.name, '→', levelUpModal.newName);
                }}
                oldClassName={classInfo.name}
                newClassName={levelUpModal.newName}
                type={levelUpModal.type}
                isSimulationMode={isSimulationMode}
                onSimulationLevelUp={onSimulationLevelUp}
            />
        )}
        </>
    );
};

export default IntegrationClassCard;
