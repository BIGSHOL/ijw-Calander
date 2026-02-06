// Shared Integration Class Card
// 영어/수학 통합뷰 공용 수업 카드

import React, { useState, useEffect, useMemo } from 'react';
import { Eye, EyeOff, Users, MoreVertical, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, Clock, Settings } from 'lucide-react';
import { Teacher, TimetableStudent, ClassKeywordColor, EnglishLevel } from '../../../types';
import IntegrationMiniGridRow, { PeriodInfo, ScheduleCell } from './IntegrationMiniGridRow';
import { formatSchoolGrade } from '../../../utils/studentUtils';
import { formatDateKey } from '../../../utils/dateUtils';
import LevelUpConfirmModal from '../English/LevelUpConfirmModal';
import { isValidLevel, numberLevelUp, classLevelUp, isMaxLevel, numberLevelDown, classLevelDown, isMinLevel, canNumberLevelDown, canNumberLevelUp, EN_PERIODS, INJAE_PERIODS } from '../English/englishUtils';
import { collection, getDocs, writeBatch, doc, query, where, collectionGroup } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { CLASS_COLLECTION } from '../English/englishUtils';
import { useQueryClient } from '@tanstack/react-query';

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
    // 학생 정보 옵션
    showSchool?: boolean;
    showGrade?: boolean;
    showHoldStudents?: boolean;
    showWithdrawnStudents?: boolean;
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
    showSchool?: boolean;  // 학교 표시 여부
    showGrade?: boolean;   // 학년 표시 여부
}

const StudentItem: React.FC<StudentItemProps> = ({
    student,
    style,
    mode,
    showEnglishName = false,
    onStudentClick,
    onDragStart,
    classDays = [],
    showSchool = true,
    showGrade = true
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

    // 신입생 판별 (60일 이내)
    const isNewStudent = useMemo(() => {
        if (student.isTransferredIn) return false; // 반이동은 별도 처리
        if (student.enrollmentDate) {
            const days = Math.ceil((Date.now() - new Date(student.enrollmentDate).getTime()) / (1000 * 60 * 60 * 24));
            return days <= 60;
        }
        return false;
    }, [student.enrollmentDate, student.isTransferredIn]);

    // 툴팁 메시지 (수학 시간표와 통일)
    const tooltipMessage = useMemo(() => {
        const parts: string[] = [];

        // 반이동/신입생 정보
        if (student.isTransferredIn) {
            parts.push('반이동 학생');
        } else if (isNewStudent && student.enrollmentDate) {
            parts.push(`입학일: ${student.enrollmentDate}`);
        }

        // 영어이름 (화면에서 잘릴 수 있으므로 항상 표시)
        if (student.englishName) {
            parts.push(student.englishName);
        }

        // 클릭 안내 메시지 (클릭 가능할 때만)
        if (isClickable) {
            parts.push('(클릭하여 상세정보 보기)');
        }

        return parts.length > 0 ? parts.join('\n') : undefined;
    }, [student.isTransferredIn, isNewStudent, student.enrollmentDate, student.englishName, isClickable]);

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
            className={`flex items-center justify-between text-[12px] py-0.5 px-1 transition-all duration-200 animate-in fade-in ${style.className} ${isClickable ? 'cursor-pointer' : ''}`}
            style={hoverStyle}
            title={tooltipMessage}
        >
            <span className={`font-medium truncate flex items-center gap-0.5 ${isHovered && isClickable ? '' : style.textClass}`}>
                <span className="shrink-0">{student.name}</span>
                {showEnglishName && student.englishName && (
                    <span
                        className={`font-normal truncate max-w-[60px] ${isHovered && isClickable ? '' : (style.englishTextClass || 'text-gray-500')}`}
                    >
                        ({student.englishName})
                    </span>
                )}
                {partialDaysBadge && (
                    <span className="text-micro font-bold text-orange-600 bg-orange-100 px-0.5 rounded-sm shrink-0">
                        {partialDaysBadge.join('')}
                    </span>
                )}
            </span>
            {(showSchool || showGrade) && (
                <span className={`text-micro ml-1 shrink-0 text-right leading-none ${isHovered && isClickable ? '' : (style.subTextClass || 'text-gray-500')}`}>
                    {formatSchoolGrade(showSchool ? student.school : undefined, showGrade ? student.grade : undefined)}
                </span>
            )}
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
    onSimulationLevelUp?: (oldName: string, newName: string) => boolean;
    moveChanges?: Map<string, any>;
    onMoveStudent?: (student: TimetableStudent, fromClass: string, toClass: string) => void;
    hiddenTeacherList?: string[];
    useInjaePeriod?: boolean;
    onRestoreEnrollment?: (studentId: string, className: string) => void;  // 수업 종료 취소
    onEditClass?: (classId: string) => void;  // 시뮬레이션 모드 수업 편집
    // 주차 이동 시 배정 예정/퇴원 예정 미리보기용
    currentWeekStart?: Date;  // 현재 보고 있는 주의 시작일 (월요일)
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
    onRestoreEnrollment,
    onEditClass,
    currentWeekStart,
}) => {
    const cardWidthClass = isTimeColumnOnly ? 'w-[49px]' : (hideTime ? 'w-[160px]' : 'w-[190px]');
    const isEnglish = subject === 'english';

    const queryClient = useQueryClient();
    const [students, setStudents] = useState<TimetableStudent[]>([]);
    const [displayStudents, setDisplayStudents] = useState<TimetableStudent[]>([]);
    const [studentCount, setStudentCount] = useState<number>(0);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [levelUpModal, setLevelUpModal] = useState<{ isOpen: boolean; type: 'number' | 'class'; newName: string; direction: 'up' | 'down' }>({ isOpen: false, type: 'number', newName: '', direction: 'up' });
    const [showScheduleTooltip, setShowScheduleTooltip] = useState(false);

    // 레벨업/다운 실행 함수 (충돌 체크 후 바로 실행 또는 경고)
    const handleLevelChange = async (oldClassName: string, newClassName: string, type: 'number' | 'class', direction: 'up' | 'down') => {
        try {
            // 시뮬레이션 모드는 기존 로직 사용
            if (isSimulationMode && onSimulationLevelUp) {
                const success = onSimulationLevelUp(oldClassName, newClassName);
                if (!success) {
                    return;
                }
                return;
            }

            // 1. 충돌 체크: newClassName이 이미 존재하는지 확인
            const classesRef = collection(db, CLASS_COLLECTION);
            const classesSnapshot = await getDocs(classesRef);
            const existingClass = classesSnapshot.docs.find(docSnap => {
                const data = docSnap.data();
                return data.className === newClassName && data.subject === 'english';
            });

            if (existingClass) {
                alert(`⚠️ 수업명 충돌\n\n'${newClassName}' 수업이 이미 존재합니다.\n레벨업을 실행할 수 없습니다.`);
                return;
            }

            // 2. 충돌 없음 → 바로 실행
            const batch = writeBatch(db);

            // Classes 컬렉션 업데이트
            let classesCount = 0;
            classesSnapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                if (data.className === oldClassName && data.subject === 'english') {
                    batch.update(doc(db, CLASS_COLLECTION, docSnap.id), { className: newClassName });
                    classesCount++;
                }
            });

            // Enrollments 컬렉션 업데이트
            const enrollmentsQuery = query(
                collectionGroup(db, 'enrollments'),
                where('className', '==', oldClassName),
                where('subject', '==', 'english')
            );
            const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
            let enrollmentsCount = 0;

            enrollmentsSnapshot.docs.forEach(docSnap => {
                batch.update(docSnap.ref, { className: newClassName });
                enrollmentsCount++;
            });

            const totalUpdates = classesCount + enrollmentsCount;

            if (totalUpdates === 0) {
                alert('업데이트할 데이터가 없습니다.');
                return;
            }

            await batch.commit();

            // React Query 캐시 무효화
            queryClient.invalidateQueries({ queryKey: ['englishClassStudents'] });
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['classes'] });

            // 성공 메시지 (간단하게)
            const directionText = direction === 'up' ? '레벨업' : '레벨다운';
            const typeText = type === 'number' ? '숫자' : '클래스';
            alert(`✅ ${typeText} ${directionText} 완료!\n\n${oldClassName} → ${newClassName}\n(${totalUpdates}개 항목 업데이트)`);

        } catch (err) {
            console.error('Level change failed:', err);
            alert('레벨 변경 중 오류가 발생했습니다.');
        }
    };

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
                const timeStr: string = isWeekend
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
    // currentWeekStart가 있으면 해당 주의 시작일 기준, 없으면 오늘 기준 (KST)
    const referenceDate = useMemo(() => {
        if (currentWeekStart) {
            return formatDateKey(currentWeekStart);
        }
        return formatDateKey(new Date());
    }, [currentWeekStart]);

    useEffect(() => {
        let currentList = [...students];

        // 배정 예정 학생 마킹 (enrollmentDate > referenceDate)
        // 퇴원 예정 학생 마킹 (withdrawalDate가 있고 referenceDate보다 이후)
        currentList = currentList.map(s => ({
            ...s,
            isScheduled: s.enrollmentDate ? s.enrollmentDate > referenceDate : false,
            isWithdrawalScheduled: s.withdrawalDate ? s.withdrawalDate > referenceDate : false
        }));

        if (moveChanges) {
            // 이동 나간 학생 제거
            currentList = currentList.filter(s => {
                const change = moveChanges.get(s.id);
                return !(change && change.fromClass === classInfo.name);
            });
            // 이동 들어온 학생 추가 (연보라색 표시)
            moveChanges.forEach(change => {
                if (change.toClass === classInfo.name) {
                    if (!currentList.find(s => s.id === change.student.id)) {
                        currentList.push({ ...change.student, isTempMoved: true });
                    }
                }
            });
        }

        // 활성 학생 수 계산 (배정 예정 제외, 퇴원 예정 학생은 아직 활성으로 표시)
        const activeCount = currentList.filter(s =>
            (!s.withdrawalDate || (s as any).isWithdrawalScheduled) &&
            !s.onHold &&
            !(s as any).isScheduled
        ).length;
        setStudentCount(activeCount);
        setDisplayStudents(currentList);
    }, [students, moveChanges, classInfo.name, referenceDate]);

    // 배정 예정 학생 (미래 enrollmentDate)
    const scheduledStudents = displayStudents.filter(s => (s as any).isScheduled && !s.withdrawalDate);
    // 퇴원 예정 학생 (withdrawalDate가 있지만 아직 미래인 경우)
    const withdrawalScheduledStudents = displayStudents.filter(s => (s as any).isWithdrawalScheduled && !s.isTransferred);
    // 활성 학생 (배정 예정 제외, 퇴원 예정은 활성에 포함하되 마킹)
    const activeStudents = displayStudents.filter(s =>
        (!s.withdrawalDate || (s as any).isWithdrawalScheduled) &&
        !s.onHold &&
        !(s as any).isScheduled
    );
    // 대기 학생 (onHold)
    const holdStudents = displayStudents.filter(s => s.onHold && !s.withdrawalDate && !(s as any).isScheduled);
    // 퇴원 학생 (이미 퇴원한 학생만, 퇴원 예정 제외, 반이동은 제외)
    const withdrawnStudents = displayStudents.filter(s =>
        s.withdrawalDate &&
        !(s as any).isWithdrawalScheduled &&
        !s.isTransferred
    );

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
                // 영어: 반이동 학생 → underline → 일반 → 신입생
                const getWeight = (s: TimetableStudent) => {
                    // 반이동 학생 (다른 반에서 이동해 온 학생)이 가장 상단
                    if (s.isTransferredIn) return -1;
                    if (s.underline) return 0;
                    if (s.enrollmentDate) {
                        const newStatus = isNewStudent(s.enrollmentDate);
                        if (newStatus === 1) return 3;
                        if (newStatus === 2) return 2;
                    }
                    return 1;
                };
                const wA = getWeight(a), wB = getWeight(b);
                return wA !== wB ? wA - wB : (a.name || '').localeCompare(b.name || '', 'ko');
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
            return wA !== wB ? wA - wB : (a.name || '').localeCompare(b.name || '', 'ko');
        });
    }, [activeStudents, isEnglish, classInfo.finalDays]);

    const getRowStyle = (student: TimetableStudent & { isTempMoved?: boolean; isMoved?: boolean; isWithdrawalScheduled?: boolean }) => {
        if (student.isTempMoved) return { className: 'bg-purple-400 ring-1 ring-purple-500', textClass: 'text-white font-bold', subTextClass: 'text-white/80', englishTextClass: 'text-white/80' };
        if (student.isMoved && student.underline) return { className: 'bg-green-50 ring-1 ring-green-300', textClass: 'underline decoration-blue-600 text-green-800 font-bold underline-offset-2', subTextClass: 'text-green-600', englishTextClass: 'text-green-700' };
        if (student.isMoved) return { className: 'bg-green-100 ring-1 ring-green-300', textClass: 'text-green-800 font-bold', subTextClass: 'text-green-600', englishTextClass: 'text-green-700' };
        // 퇴원 예정 학생 - 주황색 배경에 취소선
        if ((student as any).isWithdrawalScheduled) return { className: 'bg-orange-100 ring-1 ring-orange-300', textClass: 'text-orange-800 line-through', subTextClass: 'text-orange-600', englishTextClass: 'text-orange-600' };
        // 반이동 학생 (다른 반에서 이동해 온 학생) - 초록 배경에 검은 글씨
        if (student.isTransferredIn) return { className: 'bg-green-200', textClass: 'text-gray-900 font-bold', subTextClass: 'text-gray-700', englishTextClass: 'text-gray-700' };
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
                data-class-name={classInfo.name}
                onDragOver={isTimeColumnOnly ? undefined : handleDragOver}
                onDrop={isTimeColumnOnly ? undefined : handleDrop}
                className={`${cardWidthClass} h-full flex flex-col border-r border-gray-300 shrink-0 bg-white transition-all`}
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
                                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 bg-gray-900 text-white text-xs rounded-sm shadow-xl z-50 p-2 min-w-[140px] whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
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
                                                className="absolute top-1 right-7 p-1 rounded-sm hover:bg-black/10 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title={isHidden ? "보이기" : "숨기기"}
                                            >
                                                {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                                            </button>
                                        )}
                                        {isEnglish && (englishLevels.length > 0 || (isSimulationMode && onEditClass)) && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                                                className="absolute top-1 right-1 p-1 rounded-sm hover:bg-black/10 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <MoreVertical size={14} />
                                            </button>
                                        )}

                                        {/* Level Up/Down Dropdown (영어 전용) */}
                                        {isEnglish && isMenuOpen && (
                                            <div className="absolute top-8 right-1 bg-white shadow-lg rounded-sm border border-gray-200 z-20 py-1 min-w-[140px]" onClick={(e) => e.stopPropagation()}>
                                                {/* 시뮬레이션 모드: 수업 편집 버튼 */}
                                                {isSimulationMode && onEditClass && (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                setIsMenuOpen(false);
                                                                onEditClass(classInfo.classId);
                                                            }}
                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-purple-50 text-gray-700"
                                                        >
                                                            <Settings size={14} className="text-purple-500" />
                                                            수업 편집
                                                        </button>
                                                        <div className="border-b border-gray-100 my-1" />
                                                    </>
                                                )}
                                                {/* 레벨업 섹션 */}
                                                <div className="px-2 py-1 text-xxs text-gray-400 font-medium border-b border-gray-100">레벨업</div>
                                                <button
                                                    onClick={async () => {
                                                        if (!isValidLevel(classInfo.name, englishLevels)) {
                                                            alert(`'${classInfo.name}' 수업은 레벨 설정에 등록되지 않았습니다.\n\n영어 레벨 설정에서 해당 레벨을 추가해주세요.`);
                                                            setIsMenuOpen(false);
                                                            return;
                                                        }
                                                        const newName = numberLevelUp(classInfo.name);
                                                        if (newName) {
                                                            setIsMenuOpen(false);
                                                            await handleLevelChange(classInfo.name, newName, 'number', 'up');
                                                        }
                                                    }}
                                                    disabled={!canNumberLevelUp(classInfo.name)}
                                                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${!canNumberLevelUp(classInfo.name) ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-indigo-50 text-gray-700'}`}
                                                >
                                                    <TrendingUp size={14} className={!canNumberLevelUp(classInfo.name) ? 'text-gray-300' : 'text-indigo-500'} />
                                                    숫자 레벨업
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        if (!isValidLevel(classInfo.name, englishLevels)) {
                                                            alert(`'${classInfo.name}' 수업은 레벨 설정에 등록되지 않았습니다.\n\n영어 레벨 설정에서 해당 레벨을 추가해주세요.`);
                                                            setIsMenuOpen(false);
                                                            return;
                                                        }
                                                        const newName = classLevelUp(classInfo.name, englishLevels);
                                                        if (newName) {
                                                            setIsMenuOpen(false);
                                                            await handleLevelChange(classInfo.name, newName, 'class', 'up');
                                                        }
                                                    }}
                                                    disabled={isMaxLevel(classInfo.name, englishLevels)}
                                                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${isMaxLevel(classInfo.name, englishLevels) ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-orange-50 text-gray-700'}`}
                                                >
                                                    <ArrowUpCircle size={14} className={isMaxLevel(classInfo.name, englishLevels) ? 'text-gray-300' : 'text-orange-500'} />
                                                    클래스 레벨업
                                                </button>

                                                {/* 레벨다운 섹션 */}
                                                <div className="px-2 py-1 text-xxs text-gray-400 font-medium border-t border-b border-gray-100 mt-1">레벨다운</div>
                                                <button
                                                    onClick={async () => {
                                                        if (!isValidLevel(classInfo.name, englishLevels)) {
                                                            alert(`'${classInfo.name}' 수업은 레벨 설정에 등록되지 않았습니다.\n\n영어 레벨 설정에서 해당 레벨을 추가해주세요.`);
                                                            setIsMenuOpen(false);
                                                            return;
                                                        }
                                                        const newName = numberLevelDown(classInfo.name);
                                                        if (newName) {
                                                            setIsMenuOpen(false);
                                                            await handleLevelChange(classInfo.name, newName, 'number', 'down');
                                                        } else {
                                                            alert('숫자가 1이면 더 이상 레벨다운할 수 없습니다.');
                                                            setIsMenuOpen(false);
                                                        }
                                                    }}
                                                    disabled={!canNumberLevelDown(classInfo.name)}
                                                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${!canNumberLevelDown(classInfo.name) ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-blue-50 text-gray-700'}`}
                                                >
                                                    <TrendingDown size={14} className={!canNumberLevelDown(classInfo.name) ? 'text-gray-300' : 'text-blue-500'} />
                                                    숫자 레벨다운
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        if (!isValidLevel(classInfo.name, englishLevels)) {
                                                            alert(`'${classInfo.name}' 수업은 레벨 설정에 등록되지 않았습니다.\n\n영어 레벨 설정에서 해당 레벨을 추가해주세요.`);
                                                            setIsMenuOpen(false);
                                                            return;
                                                        }
                                                        const newName = classLevelDown(classInfo.name, englishLevels);
                                                        if (newName) {
                                                            setIsMenuOpen(false);
                                                            await handleLevelChange(classInfo.name, newName, 'class', 'down');
                                                        }
                                                    }}
                                                    disabled={isMinLevel(classInfo.name, englishLevels)}
                                                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${isMinLevel(classInfo.name, englishLevels) ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-red-50 text-gray-700'}`}
                                                >
                                                    <ArrowDownCircle size={14} className={isMinLevel(classInfo.name, englishLevels) ? 'text-gray-300' : 'text-red-500'} />
                                                    클래스 레벨다운
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
                            <div className="h-[230px] flex flex-col items-center justify-center bg-indigo-50 text-indigo-900 font-bold text-sm leading-relaxed select-none border-b border-indigo-100">
                                <span>재</span><span>원</span><span>생</span>
                            </div>
                            {displayOptions?.showHoldStudents !== false && (
                                <div className="flex items-center justify-center bg-pink-100 text-pink-700 font-bold text-xs h-[80px] border-b border-pink-200 select-none">
                                    대기
                                </div>
                            )}
                            {displayOptions?.showWithdrawnStudents !== false && (
                                <div className="flex items-center justify-center bg-gray-100 text-gray-600 font-bold text-xs h-[80px] select-none">
                                    퇴원
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col bg-white border-r border-gray-300">
                            {/* 재원생 Section */}
                            <div className="h-[230px] flex flex-col border-b border-indigo-100">
                                <div className="border-b border-gray-300 flex items-center justify-center h-[30px] shrink-0 bg-white">
                                    <div className="w-full h-full text-center text-[13px] font-bold bg-indigo-50 text-indigo-600 flex items-center justify-center gap-2">
                                        <Users size={14} />
                                        <span>
                                            {studentCount}
                                            {(holdStudents.length + scheduledStudents.length) > 0 && (
                                                <span className="text-violet-500">+{holdStudents.length + scheduledStudents.length}</span>
                                            )}
                                            명
                                        </span>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto px-2 py-1.5 text-xxs flex flex-col custom-scrollbar transition-opacity duration-300">
                                    {sortedActiveStudents.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-300">
                                            <span>학생이 없습니다</span>
                                        </div>
                                    ) : (
                                        sortedActiveStudents.map((student) => (
                                            <StudentItem
                                                key={student.id}
                                                student={student}
                                                style={getRowStyle(student)}
                                                mode={mode}
                                                showEnglishName={isEnglish}
                                                onStudentClick={onStudentClick}
                                                onDragStart={onMoveStudent ? handleDragStart : undefined}
                                                classDays={!isEnglish ? classInfo.finalDays : undefined}
                                                showSchool={displayOptions?.showSchool !== false}
                                                showGrade={displayOptions?.showGrade !== false}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* 대기 Section (배정 예정 + 휴원) - showHoldStudents 옵션 적용 */}
                            {displayOptions?.showHoldStudents !== false && (
                                <div className="h-[80px] flex flex-col bg-pink-50 border-b border-pink-200 px-2 py-1 overflow-y-auto custom-scrollbar">
                                    {holdStudents.length === 0 && scheduledStudents.length === 0 ? (
                                        <span className="text-xxs text-pink-300 flex items-center justify-center h-full">-</span>
                                    ) : (
                                        <>
                                            {/* 배정 예정 학생 */}
                                            {scheduledStudents.slice(0, 3).map((student) => (
                                                <div
                                                    key={student.id}
                                                    className="flex items-center text-[12px] py-0.5 px-1 bg-amber-50 text-amber-800 mb-0.5 cursor-pointer hover:bg-amber-100"
                                                    title={student.enrollmentDate ? `수업시작: ${student.enrollmentDate}` : '배정 예정'}
                                                    onClick={() => onStudentClick?.(student.id)}
                                                >
                                                    <div className="flex items-center flex-1 min-w-0">
                                                        <span className="font-medium shrink-0">{student.name}</span>
                                                        {isEnglish && student.englishName && <span className="ml-1 text-amber-600 truncate max-w-[60px]" title={student.englishName}>({student.englishName})</span>}
                                                    </div>
                                                    {(displayOptions?.showSchool !== false || displayOptions?.showGrade !== false) && (
                                                        <span className="text-xxs shrink-0 text-amber-600 text-right leading-none ml-1">
                                                            {formatSchoolGrade(displayOptions?.showSchool !== false ? student.school : undefined, displayOptions?.showGrade !== false ? student.grade : undefined)}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                            {scheduledStudents.length > 3 && (
                                                <span className="text-micro text-amber-500">+{scheduledStudents.length - 3}명 예정</span>
                                            )}
                                            {/* 휴원 학생 */}
                                            {holdStudents.slice(0, 3).map((student) => (
                                                <div
                                                    key={student.id}
                                                    className="flex items-center text-[12px] py-0.5 px-1 bg-amber-50 text-amber-800 mb-0.5 cursor-pointer hover:bg-amber-100"
                                                    title={student.enrollmentDate ? `수업시작: ${student.enrollmentDate}` : '휴원'}
                                                    onClick={() => onStudentClick?.(student.id)}
                                                >
                                                    <div className="flex items-center flex-1 min-w-0">
                                                        <span className="font-medium shrink-0">{student.name}</span>
                                                        {isEnglish && student.englishName && <span className="ml-1 text-amber-600 truncate max-w-[60px]" title={student.englishName}>({student.englishName})</span>}
                                                    </div>
                                                    {(displayOptions?.showSchool !== false || displayOptions?.showGrade !== false) && (
                                                        <span className="text-xxs shrink-0 text-amber-600 text-right leading-none ml-1">
                                                            {formatSchoolGrade(displayOptions?.showSchool !== false ? student.school : undefined, displayOptions?.showGrade !== false ? student.grade : undefined)}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                            {holdStudents.length > 3 && (
                                                <span className="text-micro text-amber-500">+{holdStudents.length - 3}명 휴원</span>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* 퇴원생 Section - showWithdrawnStudents 옵션 적용 */}
                            {displayOptions?.showWithdrawnStudents !== false && (
                                <div className="h-[80px] flex flex-col bg-gray-100 px-2 py-1 overflow-y-auto custom-scrollbar">
                                    {withdrawnStudents.length === 0 ? (
                                        <span className="text-xxs text-gray-500 flex items-center justify-center h-full">-</span>
                                    ) : (
                                        <>
                                            {withdrawnStudents.slice(0, 3).map((student) => (
                                                <div
                                                    key={student.id}
                                                    className="flex items-center text-[12px] py-0.5 px-1 bg-black text-white mb-0.5 cursor-pointer hover:bg-gray-800 group relative"
                                                    title={student.withdrawalDate ? `퇴원일: ${student.withdrawalDate}` : undefined}
                                                    onClick={() => onStudentClick?.(student.id)}
                                                >
                                                    <div className="flex items-center flex-1 min-w-0">
                                                        <span className="font-medium shrink-0">{student.name}</span>
                                                        {isEnglish && student.englishName && <span className="ml-1 text-gray-400 truncate max-w-[60px]" title={student.englishName}>({student.englishName})</span>}
                                                    </div>
                                                    {(displayOptions?.showSchool !== false || displayOptions?.showGrade !== false) && (
                                                        <span className="text-xxs shrink-0 text-gray-300 text-right leading-none ml-1">
                                                            {formatSchoolGrade(displayOptions?.showSchool !== false ? student.school : undefined, displayOptions?.showGrade !== false ? student.grade : undefined)}
                                                        </span>
                                                    )}
                                                    {mode === 'edit' && onRestoreEnrollment && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (window.confirm(`${student.name} 학생의 수업 종료를 취소하시겠습니까?`)) {
                                                                    onRestoreEnrollment(student.id, classInfo.name);
                                                                }
                                                            }}
                                                            className="absolute right-1 text-xxs text-yellow-400 hover:text-yellow-300 opacity-0 group-hover:opacity-100 transition-opacity bg-black px-0.5"
                                                            title="수업 종료 취소"
                                                        >
                                                            복구
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            {withdrawnStudents.length > 3 && (
                                                <span className="text-micro text-gray-400">+{withdrawnStudents.length - 3}명</span>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                ) : null}
            </div>

            {/* Level Up/Down Confirm Modal (영어 전용) */}
            {isEnglish && (
                <LevelUpConfirmModal
                    isOpen={levelUpModal.isOpen}
                    onClose={() => setLevelUpModal({ ...levelUpModal, isOpen: false })}
                    onSuccess={() => {}}
                    oldClassName={classInfo.name}
                    newClassName={levelUpModal.newName}
                    type={levelUpModal.type}
                    direction={levelUpModal.direction}
                    isSimulationMode={isSimulationMode}
                    onSimulationLevelUp={onSimulationLevelUp}
                />
            )}
        </>
    );
};

export default IntegrationClassCard;
