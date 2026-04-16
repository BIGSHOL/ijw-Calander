/**
 * ShuttleTimetable - 셔틀버스 시간표 컴포넌트
 *
 * 등원(첫 수업 시작) / 하원(마지막 수업 종료) / 이동(강의실 전환) 구분 표시
 * 강의실 기준 바른학습관/본원 분류
 * 필터: 등원, 하원, 본원(영어), 본원(수학), 바른학습관, 강의실이동 (멀티 선택)
 */

import React, { useState } from 'react';
import type { TimetableSubjectType } from '../../../types';
import SubjectControls from '../shared/SubjectControls';
import { SUBJECT_COLORS } from '../../../utils/styleUtils';
import { useShuttleStudents, TIME_SLOTS } from '../../../hooks/useShuttleStudents';
import type { TimeSlot, ShuttleStudentSlot, TransferStudent, ShuttleScheduleMap } from '../../../hooks/useShuttleStudents';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, ArrowRight } from 'lucide-react';
import { getKoreanErrorMessage } from '../../../utils/errorMessages';

const WEEKDAYS = ['월', '화', '수', '목', '금'];
const colors = SUBJECT_COLORS.shuttle;

// TIME_SLOT_LABELS removed - 시간 표시 제거됨

/** 회차 번호 매핑 */
const SESSION_LABELS: Record<TimeSlot, string> = {
    14: '1회차',
    16: '2회차',
    18: '3회차',
    20: '4회차',
    22: '5회차',
};


/** 회차별 색상 */
const SESSION_COLORS: Record<TimeSlot, { bg: string; text: string }> = {
    14: { bg: 'bg-sky-100', text: 'text-sky-800' },
    16: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
    18: { bg: 'bg-orange-100', text: 'text-orange-800' },
    20: { bg: 'bg-violet-100', text: 'text-violet-800' },
    22: { bg: 'bg-pink-100', text: 'text-pink-800' },
};

type ShuttleFilter = 'boarding' | 'alighting' | 'bonwon-english' | 'bonwon-math' | 'bareun' | 'transfer';

const FILTER_CONFIG: { key: ShuttleFilter; label: string; color: string; activeColor: string }[] = [
    { key: 'boarding', label: '등원', color: 'border-gray-300 text-gray-600', activeColor: 'border-green-400 bg-green-50 text-green-700' },
    { key: 'alighting', label: '하원', color: 'border-gray-300 text-gray-600', activeColor: 'border-red-400 bg-red-50 text-red-700' },
    { key: 'bonwon-math', label: '본원(수학)', color: 'border-gray-300 text-gray-600', activeColor: 'border-indigo-400 bg-indigo-50 text-indigo-700' },
    { key: 'bonwon-english', label: '본원(영어)', color: 'border-gray-300 text-gray-600', activeColor: 'border-purple-400 bg-purple-50 text-purple-700' },
    { key: 'bareun', label: '바른학습관', color: 'border-gray-300 text-gray-600', activeColor: 'border-blue-400 bg-blue-50 text-blue-700' },
    { key: 'transfer', label: '강의실이동', color: 'border-gray-300 text-gray-600', activeColor: 'border-orange-400 bg-orange-50 text-orange-700' },
];

interface ShuttleTimetableProps {
    currentUser: any;
    timetableSubject: TimetableSubjectType;
    setTimetableSubject: (value: TimetableSubjectType) => void;
    setTimetableViewType?: React.Dispatch<React.SetStateAction<'teacher' | 'room' | 'class' | 'excel'>>;
    hasPermissionFn: (perm: string) => boolean;
    setIsTimetableSettingsOpen?: (value: boolean) => void;
    userDepartments?: ('math' | 'highmath' | 'english')[];
    onMakeEduSyncOpen?: () => void;
}

function ShuttleTimetable({
    timetableSubject,
    setTimetableSubject,
    setTimetableViewType,
    hasPermissionFn,
    setIsTimetableSettingsOpen,
    userDepartments,
    onMakeEduSyncOpen,
}: ShuttleTimetableProps) {
    const [isSyncing, setIsSyncing] = useState(false);
    const [activeFilters, setActiveFilters] = useState<Set<ShuttleFilter>>(new Set());
    const queryClient = useQueryClient();

    const { data: shuttleData, isLoading, refetch: refetchShuttle } = useShuttleStudents(true);

    const toggleFilter = (filter: ShuttleFilter) => {
        setActiveFilters(prev => {
            const next = new Set(prev);
            if (next.has(filter)) next.delete(filter);
            else next.add(filter);
            return next;
        });
    };

    const handleSync = async () => {
        if (isSyncing) return;
        if (!confirm('MakeEdu에서 셔틀 학생 정보를 동기화합니다.\n계속하시겠습니까?')) return;

        setIsSyncing(true);
        try {
            const functions = getFunctions(undefined, 'asia-northeast3');
            const scrapeFn = httpsCallable(functions, 'scrapeMakeEduShuttleStudents');
            const result = await scrapeFn();
            const data = result.data as any;
            alert(`동기화 완료!\n전체 학생: ${data.totalStudents}명\n셔틀 학생: ${data.shuttleStudents}명`);
            queryClient.invalidateQueries({ queryKey: ['shuttleStudents'] });
            await refetchShuttle();
        } catch (error: any) {
            console.error('Shuttle sync failed:', error);
            alert(getKoreanErrorMessage(error, '동기화에 실패했습니다.'));
        } finally {
            setIsSyncing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col h-full">
                <div className="bg-gray-50 min-h-[2.5rem] flex items-center gap-3 pl-4 border-b border-gray-200 flex-shrink-0 text-xs">
                    <SubjectControls
                        timetableSubject={timetableSubject}
                        setTimetableSubject={setTimetableSubject}
                        viewType="class"
                        setTimetableViewType={setTimetableViewType}
                        hasPermission={hasPermissionFn}
                        setIsTimetableSettingsOpen={setIsTimetableSettingsOpen}
                        userDepartments={userDepartments}
                        onMakeEduSyncOpen={onMakeEduSyncOpen}
                    />
                </div>
                <div className="flex items-center justify-center flex-1">
                    <div className="text-gray-500">
                        <div className="animate-spin rounded-sm h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                        <div>셔틀버스 시간표 로딩 중...</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* 헤더 */}
            <div className="bg-gray-50 min-h-[2.5rem] flex items-center gap-3 pl-4 pr-4 border-b border-gray-200 flex-shrink-0 text-xs">
                <SubjectControls
                    timetableSubject={timetableSubject}
                    setTimetableSubject={setTimetableSubject}
                    viewType="class"
                    setTimetableViewType={setTimetableViewType}
                    hasPermission={hasPermissionFn}
                    setIsTimetableSettingsOpen={setIsTimetableSettingsOpen}
                    userDepartments={userDepartments}
                />

                <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="px-2 py-1 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-1 disabled:opacity-50"
                    title="MakeEdu에서 셔틀 학생 동기화"
                >
                    <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                    MakeEdu 동기화
                </button>

                {/* 필터 버튼 */}
                <div className="flex items-center gap-1 ml-2">
                    {FILTER_CONFIG.map(f => (
                        <button
                            key={f.key}
                            onClick={() => toggleFilter(f.key)}
                            className={`px-1.5 py-0.5 rounded border text-[10px] font-medium transition-colors ${
                                activeFilters.has(f.key) ? f.activeColor : f.color
                            } hover:opacity-80`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                <span className="text-gray-500 ml-auto">
                    셔틀 학생 {shuttleData?.shuttleNames.length || 0}명
                </span>

                {shuttleData?.syncedAt && (
                    <span className="text-gray-400 text-[10px]">
                        동기화: {new Date(shuttleData.syncedAt).toLocaleString('ko-KR', {
                            month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                            hour12: false,
                        })}
                    </span>
                )}
            </div>

            {/* 시간표 본문 */}
            <div className="flex-1 overflow-auto p-4 space-y-6">
                <TimeSlotView
                    scheduleMap={shuttleData?.scheduleMap}
                    transferStudents={shuttleData?.transferStudents || []}
                    activeFilters={activeFilters}
                />
            </div>
        </div>
    );
}

/** 학생이 필터 조건에 맞는지 검사
 * - 타입 필터 (등원/하원/이동) 와 위치 필터 (본원수학/본원영어/바른학습관) 그룹 간 AND
 * - 같은 그룹 내에서는 OR
 * - 예: 등원 + 바른학습관 → 등원 학생 중 바른학습관만 표시
 */
function matchesFilter(
    student: ShuttleStudentSlot,
    activeFilters: Set<ShuttleFilter>,
): boolean {
    if (activeFilters.size === 0) return true;

    // 타입 필터 그룹
    const hasTypeFilter = activeFilters.has('boarding') || activeFilters.has('alighting') || activeFilters.has('transfer');
    // 위치 필터 그룹
    const hasLocationFilter = activeFilters.has('bonwon-english') || activeFilters.has('bonwon-math') || activeFilters.has('bareun');

    // 타입 매칭 (OR within group)
    let typeMatch = true;
    if (hasTypeFilter) {
        typeMatch = false;
        if (activeFilters.has('boarding') && student.type === '등원') typeMatch = true;
        if (activeFilters.has('alighting') && student.type === '하원') typeMatch = true;
        if (activeFilters.has('transfer') && student.type === '이동') typeMatch = true;
    }

    // 위치 매칭 (OR within group, 이동 타입은 위치 필터 적용하지 않음)
    let locationMatch = true;
    if (hasLocationFilter && student.type !== '이동') {
        locationMatch = false;
        if (activeFilters.has('bonwon-english') && student.location === '본원' && student.subject === 'english') locationMatch = true;
        if (activeFilters.has('bonwon-math') && student.location === '본원' && student.subject !== 'english') locationMatch = true;
        if (activeFilters.has('bareun') && student.location === '바른학습관') locationMatch = true;
    }

    // 그룹 간 AND
    return typeMatch && locationMatch;
}

/** 시간대별 뷰 */
function TimeSlotView({
    scheduleMap,
    transferStudents,
    activeFilters,
}: {
    scheduleMap?: ShuttleScheduleMap;
    transferStudents: TransferStudent[];
    activeFilters: Set<ShuttleFilter>;
}) {
    if (!scheduleMap) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                셔틀 학생 데이터가 없습니다. "MakeEdu 동기화" 버튼을 눌러 동기화하세요.
            </div>
        );
    }

    let totalEntries = 0;
    WEEKDAYS.forEach(day => {
        TIME_SLOTS.forEach(slot => {
            totalEntries += scheduleMap[day]?.[slot]?.length || 0;
        });
    });

    if (totalEntries === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                셔틀 학생이 없거나 수업 스케줄이 배정되지 않았습니다.<br />
                "MakeEdu 동기화"로 학생을 불러오고, 학생의 수업이 등록되어 있는지 확인하세요.
            </div>
        );
    }

    const showTransferSection = transferStudents.length > 0 &&
        (activeFilters.size === 0 || activeFilters.has('transfer'));

    return (
        <>
            {/* 범례 */}
            <div className="flex items-center gap-4 text-[10px] px-1">
                <span className="inline-flex items-center gap-1">
                    <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700 border border-green-300">등원</span>
                    첫 수업 시작 기준
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 border border-red-300">하원</span>
                    마지막 수업 종료 기준
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-orange-100 text-orange-700 border border-orange-300">이동</span>
                    강의실 이동 (바른↔본원)
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                    바른학습관
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                    본원
                </span>
            </div>

            {/* 시간대별 시간표 */}
            <div className="border border-gray-800 rounded-lg overflow-hidden">
                <div
                    className="px-4 py-2 flex items-center gap-3"
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                >
                    <span className="font-bold text-sm">셔틀버스 시간대별 배차</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                        <tbody>
                            {TIME_SLOTS.map(slot => {
                                const sc = SESSION_COLORS[slot];
                                return (
                                    <React.Fragment key={slot}>
                                        {/* 회차 헤더 행: 요일 + 회차를 큼지막하게 표시 */}
                                        <tr>
                                            <td className={`border border-gray-800 px-2 py-2 text-center font-bold whitespace-nowrap ${sc.bg}`}>
                                                <div className={`font-bold ${sc.text} text-sm`}>{SESSION_LABELS[slot]}</div>
                                            </td>
                                            {WEEKDAYS.map(day => {
                                                return (
                                                    <td
                                                        key={`${day}-${slot}-header`}
                                                        className={`border border-gray-800 px-2 py-2 text-center font-bold text-sm ${sc.bg} ${sc.text}`}
                                                    >
                                                        {day}요일 {SESSION_LABELS[slot]}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                        {/* 데이터 행 */}
                                        <tr className="hover:bg-emerald-50/50">
                                            <td className="border border-gray-800"></td>
                                            {WEEKDAYS.map(day => {
                                                const allStudents = scheduleMap[day]?.[slot] || [];
                                                const cellStudents = allStudents.filter(s =>
                                                    matchesFilter(s, activeFilters)
                                                );
                                                const boarding = cellStudents.filter(s => s.type === '등원');
                                                const transfer = cellStudents.filter(s => s.type === '이동');
                                                const alighting = cellStudents.filter(s => s.type === '하원');
                                                return (
                                                    <td
                                                        key={`${day}-${slot}`}
                                                        className="border border-gray-800 px-1.5 py-1 align-top bg-white"
                                                    >
                                                        {cellStudents.length > 0 ? (
                                                            <div className="space-y-1">
                                                                {boarding.length > 0 && (
                                                                    <CellGroup type="등원" students={boarding} />
                                                                )}
                                                                {boarding.length > 0 && (transfer.length > 0 || alighting.length > 0) && (
                                                                    <hr className="border-gray-200" />
                                                                )}
                                                                {transfer.length > 0 && (
                                                                    <CellGroup type="이동" students={transfer} />
                                                                )}
                                                                {transfer.length > 0 && alighting.length > 0 && (
                                                                    <hr className="border-gray-200" />
                                                                )}
                                                                {alighting.length > 0 && (
                                                                    <CellGroup type="하원" students={alighting} />
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="text-gray-300 text-center">-</div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 이동 필요 학생 상세 */}
            {showTransferSection && (
                <TransferSection transferStudents={transferStudents} />
            )}
        </>
    );
}

const GROUP_STYLES = {
    '등원': { badge: 'bg-green-100 text-green-700 border-green-300' },
    '하원': { badge: 'bg-red-100 text-red-700 border-red-300' },
    '이동': { badge: 'bg-orange-100 text-orange-700 border-orange-300' },
} as const;

/** 셀 내 그룹 (등원/이동/하원) */
function CellGroup({ type, students }: { type: '등원' | '하원' | '이동'; students: ShuttleStudentSlot[] }) {
    const style = GROUP_STYLES[type];
    return (
        <div>
            <div className="flex items-center gap-1 mb-0.5">
                <span className={`px-1 py-0 rounded text-[8px] font-bold border ${style.badge}`}>
                    {type} {students.length}
                </span>
            </div>
            <div className="grid grid-cols-2 gap-x-1 gap-y-0.5">
                {students.map((s, idx) => (
                    <StudentCell key={`${s.studentName}-${idx}`} student={s} />
                ))}
            </div>
        </div>
    );
}

/** 학생 셀 */
function StudentCell({ student }: { student: ShuttleStudentSlot }) {
    if (student.type === '이동') {
        // time 형식: "18:20 바른→본원"
        const [, direction] = student.time.split(' ');
        const isToBonwon = direction?.includes('바른→');
        return (
            <div
                className="text-xs leading-tight flex items-center gap-0.5 bg-orange-50 rounded px-0.5 -mx-0.5"
                title={`${student.studentName} | 강의실이동 ${student.time} | ${student.className} | ${student.room}`}
            >
                <ArrowRight size={8} className="text-orange-500 flex-shrink-0" />
                <span className="font-medium">{student.studentName}</span>
                <span className={`text-[9px] font-bold ${isToBonwon ? 'text-gray-600' : 'text-blue-600'}`}>
                    {direction || ''}
                </span>
            </div>
        );
    }

    const isBareun = student.location === '바른학습관';
    return (
        <div
            className="text-xs leading-tight flex items-center gap-0.5"
            title={`${student.studentName} | ${student.type} ${student.time} | ${student.teacher || '담당미정'} | ${student.className} | ${student.room || '강의실 미배정'}`}
        >
            <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isBareun ? 'bg-blue-500' : 'bg-gray-300'}`}
            />
            <span className="font-medium">{student.studentName}</span>
            {student.teacher && (
                <span className="text-emerald-600 text-[10px]">{student.teacher}</span>
            )}
            {isBareun && (
                <span className="text-[9px] text-blue-600 font-medium ml-0.5">[바른]</span>
            )}
        </div>
    );
}

/** 이동 필요 학생 상세 섹션 */
function TransferSection({ transferStudents }: { transferStudents: TransferStudent[] }) {
    const byDay = new Map<string, TransferStudent[]>();
    for (const t of transferStudents) {
        if (!byDay.has(t.day)) byDay.set(t.day, []);
        byDay.get(t.day)!.push(t);
    }

    const sortedDays = WEEKDAYS.filter(d => byDay.has(d));

    return (
        <div className="border border-orange-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-orange-50 flex items-center gap-2">
                <ArrowRight size={14} className="text-orange-600" />
                <span className="font-bold text-sm text-orange-800">
                    강의실 이동 상세 (바른학습관 ↔ 본원)
                </span>
                <span className="text-xs text-orange-500 ml-auto">
                    {transferStudents.length}건
                </span>
            </div>

            <div className="p-3 space-y-3">
                {sortedDays.map(day => {
                    const students = byDay.get(day)!;
                    return (
                        <div key={day}>
                            <div className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                                <span className="bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded text-[10px]">
                                    {day}요일
                                </span>
                                <span className="text-gray-400 text-[10px]">{students.length}명</span>
                            </div>
                            <div className="space-y-1.5 ml-2">
                                {students.map((t, idx) => (
                                    <div
                                        key={`${t.studentName}-${idx}`}
                                        className="text-xs bg-orange-50/50 px-2 py-1.5 rounded"
                                    >
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <span className="font-bold text-gray-800">{t.studentName}</span>
                                            <span className="text-blue-600 text-[10px]">
                                                {t.bareunClasses.map(c =>
                                                    `${c.className}${c.teacher ? `(${c.teacher})` : ''} ${c.startTime}~${c.endTime}`
                                                ).join(', ')}
                                            </span>
                                            <ArrowRight size={10} className="text-orange-500 flex-shrink-0" />
                                            <span className="text-gray-600 text-[10px]">
                                                {t.bonwonClasses.map(c =>
                                                    `${c.className}${c.teacher ? `(${c.teacher})` : ''} ${c.startTime}~${c.endTime}`
                                                ).join(', ')}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ShuttleTimetable;
