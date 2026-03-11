// Shared Integration Class Card
// 영어/수학 통합뷰 공용 수업 카드

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, Users, MoreVertical, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, Clock, Settings } from 'lucide-react';
import { Teacher, TimetableStudent, ClassKeywordColor, EnglishLevel } from '../../../types';
import IntegrationMiniGridRow, { PeriodInfo, ScheduleCell } from './IntegrationMiniGridRow';
import { formatSchoolGrade } from '../../../utils/studentUtils';
import { formatDateKey, getWeekReferenceDate } from '../../../utils/dateUtils';
import LevelUpConfirmModal from '../English/LevelUpConfirmModal';
import { isValidLevel, numberLevelUp, classLevelUp, isMaxLevel, numberLevelDown, classLevelDown, isMinLevel, canNumberLevelDown, canNumberLevelUp, EN_PERIODS, INJAE_PERIODS } from '../English/englishUtils';
import { collection, getDocs, writeBatch, doc, query, where, collectionGroup } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { CLASS_COLLECTION } from '../English/englishUtils';
import { useQueryClient } from '@tanstack/react-query';
import { useStudents } from '../../../hooks/useStudents';
import { useStudentReports } from '../../../hooks/useStudentReports';

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
    // 엑셀뷰 props
    isExcelMode?: boolean;
    isExcelSelected?: boolean;
    isExcelCopied?: boolean;
    isExcelCut?: boolean;
    isExcelAcHighlighted?: boolean;
    isPendingExcelDelete?: boolean;
    onExcelSelect?: (e: React.MouseEvent) => void;
    excelClassName?: string;  // 드래그 선택용 반 이름
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
    showGrade = true,
    isExcelMode = false,
    isExcelSelected = false,
    isExcelCopied = false,
    isExcelCut = false,
    isExcelAcHighlighted = false,
    isPendingExcelDelete = false,
    onExcelSelect,
    excelClassName,
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

    // 반이동예정 여부 (isTransferred + isWithdrawalScheduled)
    const isTransferScheduled = !!(student.isTransferred && (student as any).isWithdrawalScheduled);

    // 최근 보고서 데이터 조회
    const { data: studentReports } = useStudentReports(student.name, 1, true);
    const latestReport = studentReports && studentReports.length > 0 ? studentReports[0] : null;

    // 툴팁 메시지 (강사뷰와 통일 - 구분선으로 섹션 분리)
    const tooltipMessage = useMemo(() => {
        const sections: string[] = [];

        // 1섹션: 이름 (영어이름 포함)
        let nameSection = student.name;
        if (student.englishName) nameSection += ` (${student.englishName})`;
        sections.push(nameSection);

        // 2섹션: 상태 정보
        if (isTransferScheduled) {
            let statusInfo = `반이동예정: ${student.withdrawalDate || '미정'}`;
            if (student.transferTo) statusInfo += `\n${student.transferTo}`;
            sections.push(statusInfo);
        } else if (student.isTransferredIn) {
            sections.push(student.enrollmentDate ? `반이동: ${student.enrollmentDate}` : '반이동 학생');
        } else if (isNewStudent && student.enrollmentDate) {
            sections.push(`입학일: ${student.enrollmentDate}`);
        }

        // 3섹션: 최근 진도 정보 (Edutrix 보고서)
        if (latestReport) {
            const progressSection: string[] = [];

            // 날짜 포맷팅 (년도 제외)
            const dateObj = new Date(latestReport.date);
            const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

            progressSection.push(`[최근 진도 - ${formattedDate}]`);

            // 선생님
            if (latestReport.teacher_name) {
                progressSection.push(`선생님: ${latestReport.teacher_name}`);
            }

            // 진도 (notes 필드)
            if (latestReport.notes) {
                // 진도 내용이 길면 처음 50자만 표시
                const progressText = latestReport.notes.length > 50
                    ? latestReport.notes.substring(0, 50) + '...'
                    : latestReport.notes;
                progressSection.push(`진도: ${progressText}`);
            }

            // 시험 성적
            if (latestReport.exam_info) {
                progressSection.push(`시험: ${latestReport.exam_info}`);
            }

            // 숙제 여부
            if (latestReport.assignment_score !== null && latestReport.assignment_score !== undefined) {
                const score = parseInt(latestReport.assignment_score, 10);
                const homeworkStatus = isNaN(score) || score > 0 ? '○' : '✕';
                progressSection.push(`숙제: ${homeworkStatus}`);
            }

            sections.push(progressSection.join('\n'));
        }

        return sections.length > 1 ? sections.join('\n────────\n') : (sections[0] || undefined);
    }, [student.name, student.isTransferredIn, isTransferScheduled, isNewStudent, student.enrollmentDate, student.englishName, student.withdrawalDate, student.transferTo, latestReport]);

    // 엑셀 모드 스타일 오버라이드
    const excelStyle: React.CSSProperties = isPendingExcelDelete
        ? { opacity: 0.5, textDecoration: 'line-through', textDecorationColor: 'red' }
        : isExcelCut
            ? { backgroundColor: '#fef3c7', outline: '2px dashed #f59e0b', opacity: 0.7 }
            : isExcelCopied
                ? { backgroundColor: '#dcfce7', outline: '2px solid #4ade80' }
                : isExcelSelected
                    ? { backgroundColor: '#bfdbfe', outline: '2px solid #60a5fa' }
                    : isExcelAcHighlighted
                        ? { backgroundColor: '#fecaca', outline: '2px solid #f87171', fontWeight: 700 }
                        : {};

    return (
        <div
            draggable={isExcelMode ? false : isDraggable}
            onDragStart={(e) => !isExcelMode && isDraggable && onDragStart?.(e, student)}
            onClick={(e) => {
                if (isExcelMode && onExcelSelect) {
                    e.stopPropagation();
                    onExcelSelect(e);
                    return;
                }
                if (isClickable) {
                    e.stopPropagation();
                    onStudentClick(student.id);
                }
            }}
            onDoubleClick={(e) => {
                // 엑셀 모드에서 더블클릭 시 학생 상세 모달
                if (isExcelMode && onStudentClick) {
                    e.stopPropagation();
                    onStudentClick(student.id);
                }
            }}
            onMouseDown={(e) => {
                if (isExcelMode && e.button === 0 && !e.ctrlKey && !e.metaKey) {
                    (e.currentTarget.closest('[data-excel-card]') as HTMLElement)?.dispatchEvent(
                        new CustomEvent('excel-drag-start', { detail: { studentId: student.id, className: excelClassName } })
                    );
                }
            }}
            onMouseEnter={(e) => {
                setIsHovered(true);
                if (isExcelMode && e.buttons === 1) {
                    (e.currentTarget.closest('[data-excel-card]') as HTMLElement)?.dispatchEvent(
                        new CustomEvent('excel-drag-extend', { detail: { studentId: student.id } })
                    );
                }
            }}
            onMouseLeave={() => setIsHovered(false)}
            className={`flex items-center justify-between text-[12px] py-0.5 px-1 transition-all duration-200 animate-in fade-in ${style.className} ${isClickable || isExcelMode ? 'cursor-pointer' : ''}`}
            style={isExcelMode ? { ...hoverStyle, ...excelStyle } : hoverStyle}
            title={tooltipMessage}
        >
            <span className={`font-normal truncate flex items-center gap-0.5 opacity-80 ${isHovered && isClickable ? '' : style.textClass}`}>
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
    onDeleteEnrollment?: (studentId: string, className: string) => void;  // 수강 기록 삭제
    onCancelScheduledEnrollment?: (studentId: string, className: string) => void;  // 배정 예정 취소
    onEditClass?: (classId: string) => void;  // 시뮬레이션 모드 수업 편집
    // 주차 이동 시 배정 예정/퇴원 예정 미리보기용
    currentWeekStart?: Date;  // 현재 보고 있는 주의 시작일 (월요일)
    // 엑셀뷰 props
    isExcelMode?: boolean;
    isSelected?: boolean;
    onCellSelect?: () => void;
    selectedStudentId?: string | null;       // 하위호환
    copiedStudentId?: string | null;         // 하위호환
    selectedStudentIds?: Set<string>;
    copiedStudentIds?: string[] | null;
    selectedStudentClassName?: string | null;
    copiedStudentClassName?: string | null;
    cutStudentIds?: string[] | null;
    cutStudentClassName?: string | null;
    onStudentSelect?: (studentId: string, className: string) => void;
    onStudentMultiSelect?: (studentIds: Set<string>, className: string) => void;
    onEnrollStudent?: (studentId: string, className: string) => void;
    onMultiMoveStudent?: (studentIds: string[], fromClassName: string, toClassName: string) => void;
    pendingExcelDeleteIds?: Set<string>;     // composite key "studentId_className"
    pendingExcelEnrollments?: Array<{ studentId: string; className: string; enrollmentDate?: string }>;
    acHighlightStudentId?: string | null;
    onAcHighlightChange?: (studentId: string | null) => void;
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
    onDeleteEnrollment,
    onCancelScheduledEnrollment,
    onEditClass,
    currentWeekStart,
    isExcelMode = false,
    isSelected = false,
    onCellSelect,
    selectedStudentId: excelSelectedStudentId,
    copiedStudentId: excelCopiedStudentId,
    selectedStudentIds: excelSelectedStudentIds,
    copiedStudentIds: excelCopiedStudentIds,
    selectedStudentClassName: excelSelectedStudentClassName,
    copiedStudentClassName: excelCopiedStudentClassName,
    cutStudentIds: excelCutStudentIds,
    cutStudentClassName: excelCutStudentClassName,
    onStudentSelect: excelOnStudentSelect,
    onStudentMultiSelect: excelOnStudentMultiSelect,
    onEnrollStudent: excelOnEnrollStudent,
    onMultiMoveStudent: excelOnMultiMoveStudent,
    pendingExcelDeleteIds: excelPendingExcelDeleteIds,
    pendingExcelEnrollments: excelPendingExcelEnrollments,
    acHighlightStudentId: excelAcHighlightStudentId,
    onAcHighlightChange: excelOnAcHighlightChange,
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
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const headerRef = useRef<HTMLDivElement>(null);

    // 엑셀뷰 드래그 선택 (수학 ClassCard 패턴)
    const dragSelectStartId = useRef<string | null>(null);
    const dragSelectIds = useRef<Set<string>>(new Set());
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isExcelMode || !cardRef.current) return;
        const el = cardRef.current;

        const handleDragStart = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            dragSelectStartId.current = detail.studentId;
            dragSelectIds.current = new Set([detail.studentId]);
            excelOnStudentSelect?.(detail.studentId, detail.className || classInfo.name);
            onCellSelect?.();
        };
        const handleDragExtend = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (!dragSelectStartId.current) return;
            dragSelectIds.current.add(detail.studentId);
            excelOnStudentMultiSelect?.(new Set(dragSelectIds.current), classInfo.name);
        };
        const handleMouseUp = () => {
            if (dragSelectStartId.current && dragSelectIds.current.size > 0) {
                excelOnStudentMultiSelect?.(new Set(dragSelectIds.current), classInfo.name);
            }
            dragSelectStartId.current = null;
        };

        el.addEventListener('excel-drag-start', handleDragStart);
        el.addEventListener('excel-drag-extend', handleDragExtend);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            el.removeEventListener('excel-drag-start', handleDragStart);
            el.removeEventListener('excel-drag-extend', handleDragExtend);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isExcelMode, classInfo.name, excelOnStudentSelect, excelOnStudentMultiSelect, onCellSelect]);

    // 이 카드에 선택된 학생이 있는지
    const hasSelectedInThisCard = isExcelMode && excelSelectedStudentIds && excelSelectedStudentIds.size > 0
        && excelSelectedStudentClassName === classInfo.name;

    // 퇴원생 복구/삭제 다이얼로그 상태
    const [withdrawnActionModal, setWithdrawnActionModal] = useState<{ studentId: string; studentName: string } | null>(null);

    // 엑셀뷰 자동완성 상태
    const [autoCompleteQuery, setAutoCompleteQuery] = useState('');
    const [showAutoComplete, setShowAutoComplete] = useState(false);
    const [acHighlightIndex, setAcHighlightIndex] = useState(-1);
    const autoCompleteRef = useRef<HTMLDivElement>(null);

    // 보류등록 가상 학생 목록 (엑셀뷰)
    const { students: allStudentsForPending } = useStudents();
    const pendingEnrollmentStudents = useMemo(() => {
        if (!excelPendingExcelEnrollments || excelPendingExcelEnrollments.length === 0) return [];
        return excelPendingExcelEnrollments
            .filter(e => e.className === classInfo.name)
            .map(e => {
                const s = allStudentsForPending.find(st => st.id === e.studentId);
                return s ? { id: e.studentId, name: s.name } : null;
            })
            .filter((x): x is { id: string; name: string } => x !== null);
    }, [excelPendingExcelEnrollments, classInfo.name, allStudentsForPending]);

    // 툴팁 위치 업데이트
    useEffect(() => {
        if (showScheduleTooltip && headerRef.current) {
            const rect = headerRef.current.getBoundingClientRect();
            const tooltipWidth = 160;
            const viewportWidth = window.innerWidth;

            let x = rect.left + rect.width / 2 - tooltipWidth / 2;
            const y = rect.bottom + 4;

            if (x < 8) x = 8;
            if (x + tooltipWidth > viewportWidth - 8) {
                x = viewportWidth - tooltipWidth - 8;
            }

            setTooltipPosition({ x, y });
        }
    }, [showScheduleTooltip]);

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

    // 주차 기준일: 미래 주 → weekStart, 이번 주 → today, 과거 주 → weekEnd(일요일)
    const referenceDate = useMemo(() => {
        if (currentWeekStart) {
            return getWeekReferenceDate(currentWeekStart);
        }
        return formatDateKey(new Date());
    }, [currentWeekStart]);

    useEffect(() => {
        let currentList = [...students];

        // 주차 기준일(referenceDate) 기준으로 isScheduled/isWithdrawalScheduled/onHold 재계산
        // 훅에서는 실제 오늘 기준으로 설정하지만, 미래 주 미리보기 시 기준일이 다름
        currentList = currentList.map(s => {
            const recalcIsScheduled = s.enrollmentDate ? s.enrollmentDate > referenceDate : false;
            const isWithdrawalScheduled = s.withdrawalDate ? s.withdrawalDate > referenceDate : false;
            // isScheduled(배정 예정)로 인한 onHold는 기준일 기준으로 재계산, 명시적 onHold는 유지
            const recalcOnHold = (s as any).isScheduled ? recalcIsScheduled : s.onHold;
            return {
                ...s,
                isScheduled: recalcIsScheduled,
                isWithdrawalScheduled,
                onHold: recalcOnHold,
            };
        });

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
        // 반이동 예정 학생 (다른 반으로 이동 예정) - 연보라색 배경
        if ((student as any).isWithdrawalScheduled && student.isTransferred) return { className: 'bg-purple-200 ring-1 ring-purple-300', textClass: 'text-purple-800 font-bold', subTextClass: 'text-purple-600', englishTextClass: 'text-purple-600' };
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
        if (mode === 'edit' && (onMoveStudent || excelOnMultiMoveStudent)) {
            e.preventDefault();
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        if (mode !== 'edit') return;
        e.preventDefault();

        // 멀티 학생 드롭 처리
        const multiData = e.dataTransfer.getData('multiStudentIds');
        if (multiData && excelOnMultiMoveStudent) {
            try {
                const studentIds: string[] = JSON.parse(multiData);
                const fromClassName = e.dataTransfer.getData('fromClassName');
                if (fromClassName && fromClassName !== classInfo.name && studentIds.length > 0) {
                    excelOnMultiMoveStudent(studentIds, fromClassName, classInfo.name);
                }
            } catch { /* ignore */ }
            return;
        }

        // 싱글 학생 드롭 처리
        if (!onMoveStudent) return;
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
                ref={cardRef}
                data-class-name={classInfo.name}
                data-excel-card=""
                onDragOver={isTimeColumnOnly ? undefined : handleDragOver}
                onDrop={isTimeColumnOnly ? undefined : handleDrop}
                onClick={isExcelMode && !isTimeColumnOnly ? (e) => { e.stopPropagation(); onCellSelect?.(); } : undefined}
                className={`${cardWidthClass} h-full flex flex-col border-r border-gray-300 shrink-0 bg-white transition-all overflow-hidden relative ${isExcelMode && !isTimeColumnOnly ? 'cursor-pointer' : ''} ${isSelected ? 'ring-2 ring-blue-500 shadow-lg z-10' : ''}`}
            >
                {/* 엑셀 모드: 선택된 학생이 있을 때 테두리 드래그 오버레이 */}
                {hasSelectedInThisCard && (() => {
                    const handleBorderDrag = (e: React.DragEvent) => {
                        e.dataTransfer.effectAllowed = 'move';
                        const ids = [...excelSelectedStudentIds!];
                        e.dataTransfer.setData('multiStudentIds', JSON.stringify(ids));
                        e.dataTransfer.setData('fromClassName', classInfo.name);
                        e.dataTransfer.setData('studentId', ids[0]);

                        const ghost = document.createElement('div');
                        ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;background:#3b82f6;color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.3);white-space:nowrap;z-index:99999;pointer-events:none;max-width:220px;';
                        const names = ids.map(id => {
                            const s = sortedActiveStudents.find(st => st.id === id) || allStudentsForPending.find(st => st.id === id);
                            return s?.name || '';
                        }).filter(Boolean);
                        if (names.length <= 3) {
                            ghost.textContent = `${names.join(', ')} 이동`;
                        } else {
                            ghost.textContent = `${names.slice(0, 2).join(', ')} 외 ${names.length - 2}명 이동`;
                        }
                        document.body.appendChild(ghost);
                        e.dataTransfer.setDragImage(ghost, 10, 10);
                        requestAnimationFrame(() => document.body.removeChild(ghost));
                    };
                    return (
                        <div
                            className="absolute inset-0 pointer-events-none z-20"
                            style={{ outline: '3px solid #3b82f6', outlineOffset: '-1px', borderRadius: '2px' }}
                        >
                            {/* 위 핸들 */}
                            <div className="absolute top-0 left-0 right-0 h-[20px] pointer-events-auto cursor-move" draggable onDragStart={handleBorderDrag} />
                            {/* 아래 핸들 */}
                            <div className="absolute bottom-0 left-0 right-0 h-[20px] pointer-events-auto cursor-move" draggable onDragStart={handleBorderDrag} />
                            {/* 왼쪽 핸들 */}
                            <div className="absolute top-0 left-0 bottom-0 w-[20px] pointer-events-auto cursor-move" draggable onDragStart={handleBorderDrag} />
                            {/* 오른쪽 핸들 - 스크롤바 너비 포함 */}
                            <div className="absolute top-0 right-0 bottom-0 w-[28px] pointer-events-auto cursor-move" draggable onDragStart={handleBorderDrag} />
                        </div>
                    );
                })()}

                {/* 수업 상세 클릭 영역 */}
                <div
                    onClick={handleClassDetailClick}
                    className={mode === 'edit' && !isTimeColumnOnly ? 'cursor-pointer hover:brightness-95' : ''}
                >
                    {/* Header - 수업명 */}
                    {(() => {
                        if (isTimeColumnOnly) {
                            return (
                                <div className="text-center font-bold text-xs border-b border-orange-300 flex items-center justify-center h-[32px] bg-orange-100 text-orange-800 select-none shrink-0 overflow-hidden">
                                    수업명
                                </div>
                            );
                        }

                        return (
                            <div
                                ref={headerRef}
                                className={`text-center font-bold text-xs border-b border-gray-300 flex items-center justify-center h-[32px] leading-tight relative group shrink-0 overflow-hidden ${mode === 'view' ? 'cursor-help' : ''}`}
                                title={classInfo.name}
                                style={keywordColor ? { backgroundColor: keywordColor.bgColor, color: keywordColor.textColor } : { backgroundColor: '#EFF6FF', color: '#111827' }}
                                onMouseEnter={() => isEnglish && mode !== 'edit' && setShowScheduleTooltip(true)}
                                onMouseLeave={() => setShowScheduleTooltip(false)}
                            >
                                {classInfo.name}

                                {/* Schedule Tooltip - Portal로 DOM 최상위에 렌더링 (overflow-hidden 회피) */}
                                {isEnglish && mode !== 'edit' && showScheduleTooltip && scheduleInfo.length > 0 && createPortal(
                                    <div
                                        className="fixed bg-gray-900 text-white text-xs rounded-sm shadow-xl p-2 min-w-[140px] whitespace-nowrap pointer-events-none"
                                        style={{
                                            left: tooltipPosition.x,
                                            top: tooltipPosition.y,
                                            zIndex: 9999
                                        }}
                                    >
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
                                    </div>,
                                    document.body
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
                                                isExcelMode={isExcelMode}
                                                isExcelSelected={isExcelMode && (
                                                    (excelSelectedStudentIds?.has(student.id) && excelSelectedStudentClassName === classInfo.name)
                                                    || (!excelSelectedStudentIds && excelSelectedStudentId === student.id)
                                                )}
                                                isExcelCopied={isExcelMode && (
                                                    (excelCopiedStudentIds?.includes(student.id) && excelCopiedStudentClassName === classInfo.name)
                                                    || (!excelCopiedStudentIds && excelCopiedStudentId === student.id)
                                                )}
                                                isExcelCut={isExcelMode && !!(excelCutStudentIds?.includes(student.id) && excelCutStudentClassName === classInfo.name)}
                                                isExcelAcHighlighted={isExcelMode && excelAcHighlightStudentId === student.id}
                                                isPendingExcelDelete={isExcelMode && !!excelPendingExcelDeleteIds?.has(`${student.id}_${classInfo.name}`)}
                                                excelClassName={classInfo.name}
                                                onExcelSelect={isExcelMode ? (e: React.MouseEvent) => {
                                                    if ((e.ctrlKey || e.metaKey) && excelOnStudentMultiSelect) {
                                                        const newSet = new Set(
                                                            excelSelectedStudentClassName === classInfo.name
                                                                ? excelSelectedStudentIds || []
                                                                : []
                                                        );
                                                        if (newSet.has(student.id)) newSet.delete(student.id);
                                                        else newSet.add(student.id);
                                                        excelOnStudentMultiSelect(newSet, classInfo.name);
                                                    } else {
                                                        excelOnStudentSelect?.(student.id, classInfo.name);
                                                    }
                                                    onCellSelect?.();
                                                } : undefined}
                                            />
                                        ))
                                    )}
                                </div>

                                {/* 보류등록 가상 학생 표시 */}
                                {isExcelMode && pendingEnrollmentStudents.length > 0 && (
                                    <div className="border-t border-dashed border-green-400">
                                        {pendingEnrollmentStudents.map(s => (
                                            <div
                                                key={`pending-${s.id}`}
                                                className="py-0.5 px-1 text-[11px] bg-green-100 text-green-700 font-medium"
                                                title="저장 대기 중 (Ctrl+Z로 취소)"
                                            >
                                                + {s.name}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 엑셀뷰 자동완성 학생 추가 - 선택된 반에서만 표시 */}
                                {isExcelMode && isSelected && excelOnEnrollStudent && (
                                    <div ref={autoCompleteRef} className="px-2 py-1 border-t border-blue-200 bg-blue-50 relative">
                                        <input
                                            type="text"
                                            placeholder="학생 검색..."
                                            value={autoCompleteQuery}
                                            onChange={(e) => {
                                                setAutoCompleteQuery(e.target.value);
                                                setShowAutoComplete(e.target.value.trim().length > 0);
                                                setAcHighlightIndex(-1);
                                            }}
                                            onFocus={() => {
                                                if (autoCompleteQuery.trim()) setShowAutoComplete(true);
                                                onCellSelect?.();
                                            }}
                                            onKeyDown={(e) => {
                                                if (!showAutoComplete) return;
                                                if (e.key === 'ArrowDown') {
                                                    e.preventDefault();
                                                    setAcHighlightIndex(prev => prev + 1);
                                                } else if (e.key === 'ArrowUp') {
                                                    e.preventDefault();
                                                    setAcHighlightIndex(prev => Math.max(-1, prev - 1));
                                                }
                                            }}
                                            className="w-full px-2 py-1 text-[11px] border border-blue-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        {showAutoComplete && autoCompleteQuery.trim() && (
                                            <AutoCompleteDropdown
                                                query={autoCompleteQuery}
                                                existingStudentIds={new Set(classStudentData?.studentIds || [])}
                                                highlightedIndex={acHighlightIndex}
                                                setHighlightedIndex={setAcHighlightIndex}
                                                onSelect={(studentId) => {
                                                    excelOnEnrollStudent(studentId, classInfo.name);
                                                    setAutoCompleteQuery('');
                                                    setShowAutoComplete(false);
                                                    setAcHighlightIndex(-1);
                                                    excelOnAcHighlightChange?.(null);
                                                }}
                                                onClose={() => { setShowAutoComplete(false); excelOnAcHighlightChange?.(null); }}
                                                onAcHighlightChange={excelOnAcHighlightChange}
                                            />
                                        )}
                                    </div>
                                )}
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
                                                    className="flex items-center text-[12px] py-0.5 px-1 bg-amber-50 text-amber-800 mb-0.5 cursor-pointer hover:bg-amber-100 group"
                                                    title={student.enrollmentDate ? `수업시작: ${student.enrollmentDate}` : '배정 예정'}
                                                    onClick={() => onStudentClick?.(student.id)}
                                                >
                                                    <div className="flex items-center flex-1 min-w-0">
                                                        <span className="font-normal shrink-0">{student.name}</span>
                                                        {isEnglish && student.englishName && <span className="ml-1 text-amber-600 truncate max-w-[60px]" title={student.englishName}>({student.englishName})</span>}
                                                    </div>
                                                    {(displayOptions?.showSchool !== false || displayOptions?.showGrade !== false) && (
                                                        <span className="text-xxs shrink-0 text-amber-600 text-right leading-none ml-1">
                                                            {formatSchoolGrade(displayOptions?.showSchool !== false ? student.school : undefined, displayOptions?.showGrade !== false ? student.grade : undefined)}
                                                        </span>
                                                    )}
                                                    {mode === 'edit' && onCancelScheduledEnrollment && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (window.confirm(`${student.name} 학생의 배정 예정을 취소하시겠습니까?\n\n수업: ${classInfo.name}\n시작 예정일: ${student.enrollmentDate || '미정'}`)) {
                                                                    onCancelScheduledEnrollment(student.id, classInfo.name);
                                                                }
                                                            }}
                                                            className="ml-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-xs leading-none"
                                                            title="배정 예정 취소"
                                                        >
                                                            &times;
                                                        </button>
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
                                                        <span className="font-normal shrink-0">{student.name}</span>
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
                                                        <span className="font-normal shrink-0">{student.name}</span>
                                                        {isEnglish && student.englishName && <span className="ml-1 text-gray-400 truncate max-w-[60px]" title={student.englishName}>({student.englishName})</span>}
                                                    </div>
                                                    {(displayOptions?.showSchool !== false || displayOptions?.showGrade !== false) && (
                                                        <span className="text-xxs shrink-0 text-gray-300 text-right leading-none ml-1">
                                                            {formatSchoolGrade(displayOptions?.showSchool !== false ? student.school : undefined, displayOptions?.showGrade !== false ? student.grade : undefined)}
                                                        </span>
                                                    )}
                                                    {mode === 'edit' && (onRestoreEnrollment || onDeleteEnrollment) && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setWithdrawnActionModal({ studentId: student.id, studentName: student.name });
                                                            }}
                                                            className="absolute right-0.5 text-[11px] text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all bg-black w-[18px] h-[18px] flex items-center justify-center rounded-sm"
                                                            title="복구 또는 삭제"
                                                        >
                                                            &times;
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

            {/* 퇴원생 복구/삭제 선택 다이얼로그 */}
            {withdrawnActionModal && createPortal(
                <div className="fixed inset-0 bg-black/50 z-[110] flex items-start justify-center pt-[12vh] p-4">
                    <div className="bg-white rounded-sm shadow-2xl w-[280px] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="bg-gray-800 text-white p-3 font-bold text-sm flex justify-between items-center">
                            <span>퇴원생 처리</span>
                            <button onClick={() => setWithdrawnActionModal(null)} className="text-white hover:text-gray-300 text-lg leading-none">&times;</button>
                        </div>

                        {/* Content */}
                        <div className="p-4 bg-gray-50">
                            <p className="text-xs text-gray-600 mb-4 text-center">
                                <span className="font-bold text-gray-800 text-sm">{withdrawnActionModal.studentName}</span>
                                <br />
                                <span className="text-gray-400">{classInfo.name}</span>
                            </p>

                            <div className="space-y-2">
                                {onRestoreEnrollment && (
                                    <button
                                        onClick={() => {
                                            onRestoreEnrollment(withdrawnActionModal.studentId, classInfo.name);
                                            setWithdrawnActionModal(null);
                                        }}
                                        className="w-full flex items-center gap-3 p-3 rounded-sm border border-yellow-300 bg-white hover:bg-yellow-50 transition-all text-left"
                                    >
                                        <span className="text-xl">&#x21A9;</span>
                                        <div>
                                            <div className="text-sm font-bold text-gray-800">복구</div>
                                            <div className="text-[11px] text-gray-500">수업 종료를 취소하고 재원생으로 복구</div>
                                        </div>
                                    </button>
                                )}
                                {onDeleteEnrollment && (
                                    <button
                                        onClick={() => {
                                            if (window.confirm(`정말 "${withdrawnActionModal.studentName}" 학생의 수강 기록을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
                                                onDeleteEnrollment(withdrawnActionModal.studentId, classInfo.name);
                                                setWithdrawnActionModal(null);
                                            }
                                        }}
                                        className="w-full flex items-center gap-3 p-3 rounded-sm border border-red-300 bg-white hover:bg-red-50 transition-all text-left"
                                    >
                                        <span className="text-xl">&#x1F5D1;</span>
                                        <div>
                                            <div className="text-sm font-bold text-red-600">삭제</div>
                                            <div className="text-[11px] text-gray-500">수강 기록을 완전히 삭제 (복구 불가)</div>
                                        </div>
                                    </button>
                                )}
                            </div>

                            <div className="mt-3 pt-2 border-t flex justify-end">
                                <button
                                    onClick={() => setWithdrawnActionModal(null)}
                                    className="px-3 py-1.5 rounded-sm border bg-white text-gray-500 text-xs font-bold hover:bg-gray-100 transition-colors"
                                >
                                    취소
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

// 엑셀뷰 자동완성 드롭다운
const AutoCompleteDropdown: React.FC<{
    query: string;
    existingStudentIds: Set<string>;
    highlightedIndex: number;
    setHighlightedIndex: (index: number | ((prev: number) => number)) => void;
    onSelect: (studentId: string) => void;
    onClose: () => void;
    onAcHighlightChange?: (studentId: string | null) => void;
}> = ({ query, existingStudentIds, highlightedIndex, setHighlightedIndex, onSelect, onClose, onAcHighlightChange }) => {
    const { students } = useStudents();
    const dropdownRef = useRef<HTMLDivElement>(null);

    const results = useMemo(() => {
        if (!query.trim()) return [];
        const q = query.trim().toLowerCase();
        return students
            .filter(s =>
                s.name?.toLowerCase().includes(q) &&
                !existingStudentIds.has(s.id) &&
                s.status !== 'withdrawn'
            )
            .slice(0, 8);
    }, [query, students, existingStudentIds]);

    // highlightedIndex 범위 클램핑
    const clampedIndex = results.length > 0
        ? Math.min(highlightedIndex, results.length - 1)
        : -1;

    // 키보드 탐색 시 하이라이트 변경 콜백
    useEffect(() => {
        if (clampedIndex >= 0 && results[clampedIndex]) {
            onAcHighlightChange?.(results[clampedIndex].id);
        } else {
            onAcHighlightChange?.(null);
        }
    }, [clampedIndex, results, onAcHighlightChange]);

    // Enter 키 선택 처리 (부모 input에서 호출)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter' && clampedIndex >= 0 && results[clampedIndex]) {
                e.preventDefault();
                onSelect(results[clampedIndex].id);
                onAcHighlightChange?.(null);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [clampedIndex, results, onSelect, onAcHighlightChange]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    if (results.length === 0) return null;

    return (
        <div ref={dropdownRef} className="absolute left-2 right-2 top-full mt-0.5 bg-white border border-gray-200 rounded shadow-lg z-50 max-h-[200px] overflow-y-auto">
            {results.map((s, idx) => {
                const activeEnrollments = (s as any).enrollments?.filter(
                    (e: any) => !e.endDate && !e.withdrawalDate
                ) || [];
                const classNames = activeEnrollments.map((e: any) => e.className).filter(Boolean);
                return (
                    <div
                        key={s.id}
                        className={`px-2 py-1.5 text-[11px] cursor-pointer ${idx === clampedIndex ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
                        onClick={(e) => { e.stopPropagation(); onSelect(s.id); onAcHighlightChange?.(null); }}
                        onMouseEnter={() => { setHighlightedIndex(idx); onAcHighlightChange?.(s.id); }}
                        onMouseLeave={() => onAcHighlightChange?.(null)}
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-800">{s.name}</span>
                            <span className="text-[10px] text-gray-400">
                                {formatSchoolGrade(s.school, s.grade)}
                            </span>
                        </div>
                        {classNames.length > 0 && (
                            <div className="text-[9px] text-blue-500 truncate mt-0.5">
                                {classNames.join(', ')}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default IntegrationClassCard;
