/**
 * ShuttleTimetable - 셔틀버스 시간표 컴포넌트
 *
 * 두 가지 뷰 모드:
 * 1. 호차별 뷰: 기존 차량별 테이블 (회차 × 요일)
 * 2. 시간대별 뷰: MakeEdu 기타수납 기반 셔틀 학생을 수업 종료 시간대별로 표시
 */

import React, { useMemo, useState } from 'react';
import type { SubjectType } from '../../../types';
import { SHUTTLE_PERIOD_INFO, SHUTTLE_UNIFIED_PERIODS } from '../constants';
import { useTimetableClasses } from '../Generic/hooks/useTimetableClasses';
import { useClassStudents } from '../Generic/hooks/useClassStudents';
import SubjectControls from '../shared/SubjectControls';
import { SUBJECT_COLORS } from '../../../utils/styleUtils';
import { useShuttleStudents, TIME_SLOTS, WEEKDAYS as SHUTTLE_WEEKDAYS } from '../../../hooks/useShuttleStudents';
import type { TimeSlot } from '../../../hooks/useShuttleStudents';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Bus, List } from 'lucide-react';

const WEEKDAYS = ['월', '화', '수', '목', '금'];
const colors = SUBJECT_COLORS.shuttle;

const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
    14: '14시 (2시)',
    16: '16시 (4시)',
    18: '18시 (6시)',
    20: '20시 (8시)',
    22: '22시 (10시)',
};

type ViewMode = 'vehicle' | 'timeslot';

interface ShuttleTimetableProps {
    currentUser: any;
    timetableSubject: SubjectType;
    setTimetableSubject: (value: SubjectType) => void;
    setTimetableViewType?: React.Dispatch<React.SetStateAction<'teacher' | 'room' | 'class' | 'excel'>>;
    hasPermissionFn: (perm: string) => boolean;
    setIsTimetableSettingsOpen?: (value: boolean) => void;
}

function ShuttleTimetable({
    currentUser,
    timetableSubject,
    setTimetableSubject,
    setTimetableViewType,
    hasPermissionFn,
    setIsTimetableSettingsOpen,
}: ShuttleTimetableProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('timeslot');
    const [isSyncing, setIsSyncing] = useState(false);
    const queryClient = useQueryClient();

    // 호차별 뷰 데이터
    const { classes, loading: classesLoading } = useTimetableClasses('shuttle');
    const classNames = useMemo(() => classes.map(c => c.className), [classes]);
    const { classDataMap, isLoading: studentsLoading } = useClassStudents('shuttle', classNames, {});

    // 시간대별 뷰 데이터 (시간대별 뷰일 때 자동 활성화)
    const { data: shuttleData, isLoading: shuttleLoading, refetch: refetchShuttle } = useShuttleStudents(viewMode === 'timeslot');


    const vehicleData = useMemo(() => {
        return classes.map(cls => {
            const students = classDataMap[cls.className]?.studentList || [];
            const scheduleSlots = new Set(cls.schedule || []);
            const studentsByDayAndPeriod: Record<string, Record<string, typeof students>> = {};

            WEEKDAYS.forEach(day => {
                studentsByDayAndPeriod[day] = {};
                SHUTTLE_UNIFIED_PERIODS.forEach(periodId => {
                    studentsByDayAndPeriod[day][periodId] = [];
                });
            });

            students.forEach(student => {
                const days = student.attendanceDays?.length ? student.attendanceDays : WEEKDAYS;
                days.forEach(day => {
                    if (!WEEKDAYS.includes(day)) return;
                    SHUTTLE_UNIFIED_PERIODS.forEach(periodId => {
                        const slotKey = `${day} ${periodId}`;
                        if (scheduleSlots.has(slotKey) || scheduleSlots.size === 0) {
                            studentsByDayAndPeriod[day][periodId].push(student);
                        }
                    });
                });
            });

            return { cls, students, studentsByDayAndPeriod, totalStudents: students.length };
        });
    }, [classes, classDataMap]);

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
            alert('동기화 실패: ' + (error.message || '알 수 없는 오류'));
        } finally {
            setIsSyncing(false);
        }
    };

    const isLoading = viewMode === 'vehicle'
        ? classesLoading || studentsLoading
        : shuttleLoading;

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
                />

                {/* 뷰 전환 토글 */}
                <button
                    onClick={() => setViewMode(prev => prev === 'vehicle' ? 'timeslot' : 'vehicle')}
                    className="px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1"
                    title="뷰 전환"
                >
                    {viewMode === 'vehicle'
                        ? <><Bus size={12} /> 시간대별</>
                        : <><List size={12} /> 호차별</>
                    }
                </button>

                {/* MakeEdu 동기화 버튼 (시간대별 뷰에서만) */}
                {viewMode === 'timeslot' && (
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="px-2 py-1 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-1 disabled:opacity-50"
                        title="MakeEdu에서 셔틀 학생 동기화"
                    >
                        <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                        MakeEdu 동기화
                    </button>
                )}

                <span className="text-gray-500 ml-auto">
                    {viewMode === 'vehicle'
                        ? `총 ${classes.length}대 차량`
                        : `셔틀 학생 ${shuttleData?.shuttleNames.length || 0}명 `
                    }
                </span>

                {/* 동기화 시각 */}
                {viewMode === 'timeslot' && shuttleData?.syncedAt && (
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
                {viewMode === 'timeslot' ? (
                    <TimeSlotView scheduleMap={shuttleData?.scheduleMap} />
                ) : (
                    <VehicleView vehicleData={vehicleData} />
                )}
            </div>
        </div>
    );
}

/** 시간대별 뷰 */
function TimeSlotView({ scheduleMap }: { scheduleMap?: ReturnType<typeof useShuttleStudents>['data'] extends infer T ? T extends { scheduleMap: infer S } ? S : never : never }) {
    if (!scheduleMap) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                셔틀 학생 데이터가 없습니다. "MakeEdu 동기화" 버튼을 눌러 동기화하세요.
            </div>
        );
    }

    // 전체 학생 수 계산
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

    return (
        <div className="border border-emerald-200 rounded-lg overflow-hidden">
            <div
                className="px-4 py-2 flex items-center gap-3"
                style={{ backgroundColor: colors.bg, color: colors.text }}
            >
                <span className="font-bold text-sm">셔틀버스 시간대별 배차</span>
                <span className="text-xs opacity-80 ml-auto">
                    수업 종료 시간 기준 배정
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                    <thead>
                        <tr className="bg-emerald-50">
                            <th className="border border-emerald-200 px-2 py-1.5 text-center font-bold w-24">
                                시간대
                            </th>
                            {WEEKDAYS.map(day => (
                                <th
                                    key={day}
                                    className="border border-emerald-200 px-2 py-1.5 text-center font-bold"
                                >
                                    {day}요일
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {TIME_SLOTS.map(slot => (
                            <tr key={slot} className="hover:bg-emerald-50/50">
                                <td className="border border-emerald-200 px-2 py-1.5 text-center font-semibold bg-emerald-50/50 whitespace-nowrap">
                                    {TIME_SLOT_LABELS[slot]}
                                </td>
                                {WEEKDAYS.map(day => {
                                    const cellStudents = scheduleMap[day]?.[slot] || [];
                                    return (
                                        <td
                                            key={`${day}-${slot}`}
                                            className="border border-emerald-200 px-1.5 py-1 align-top"
                                        >
                                            {cellStudents.length > 0 ? (
                                                <div className="space-y-0.5">
                                                    {cellStudents.map((s, idx) => (
                                                        <div
                                                            key={`${s.studentName}-${s.className}-${idx}`}
                                                            className="text-xs leading-tight"
                                                            title={`${s.studentName} (${s.className}) ~${s.endTime}`}
                                                        >
                                                            <span className="font-medium">{s.studentName}</span>
                                                            <span className="text-gray-400 ml-0.5 text-[10px]">
                                                                ({s.className})
                                                            </span>
                                                        </div>
                                                    ))}
                                                    <div className="text-[9px] text-gray-400 text-right mt-0.5">
                                                        {cellStudents.length}명
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-gray-300 text-center">-</div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/** 호차별 뷰 (기존) */
function VehicleView({ vehicleData }: { vehicleData: any[] }) {
    if (vehicleData.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                등록된 셔틀 차량이 없습니다. "반 추가"에서 과목을 "셔틀버스"로 선택하여 호차를 추가하세요.
            </div>
        );
    }

    return (
        <>
            {vehicleData.map(({ cls, studentsByDayAndPeriod, totalStudents }: any) => (
                <div key={cls.id} className="border border-emerald-200 rounded-lg overflow-hidden">
                    <div
                        className="px-4 py-2 flex items-center gap-3"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                    >
                        <span className="font-bold text-sm">{cls.className}</span>
                        {cls.teacher && (
                            <span className="text-xs opacity-80">({cls.teacher})</span>
                        )}
                        <span className="text-xs opacity-80 ml-auto">
                            {totalStudents}명
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-xs">
                            <thead>
                                <tr className="bg-emerald-50">
                                    <th className="border border-emerald-200 px-2 py-1.5 text-center font-bold w-16">
                                        회차
                                    </th>
                                    <th className="border border-emerald-200 px-2 py-1.5 text-center font-bold w-32">
                                        시간
                                    </th>
                                    {WEEKDAYS.map(day => (
                                        <th
                                            key={day}
                                            className="border border-emerald-200 px-2 py-1.5 text-center font-bold"
                                        >
                                            {day}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {SHUTTLE_UNIFIED_PERIODS.map(periodId => {
                                    const info = SHUTTLE_PERIOD_INFO[periodId];
                                    return (
                                        <tr key={periodId} className="hover:bg-emerald-50/50">
                                            <td className="border border-emerald-200 px-2 py-1.5 text-center font-semibold bg-emerald-50/50">
                                                {info.label}
                                            </td>
                                            <td className="border border-emerald-200 px-1.5 py-1.5 text-center text-gray-600 bg-emerald-50/30 whitespace-nowrap">
                                                {info.time}
                                            </td>
                                            {WEEKDAYS.map(day => {
                                                const cellStudents = studentsByDayAndPeriod[day]?.[periodId] || [];
                                                return (
                                                    <td
                                                        key={`${day}-${periodId}`}
                                                        className="border border-emerald-200 px-1.5 py-1 align-top"
                                                    >
                                                        {cellStudents.length > 0 ? (
                                                            <div className="space-y-0.5">
                                                                {cellStudents.map((s: any) => (
                                                                    <div
                                                                        key={s.id}
                                                                        className="text-xs leading-tight"
                                                                        title={`${s.name}${s.school ? ` (${s.school})` : ''}`}
                                                                    >
                                                                        <span className="font-medium">{s.name}</span>
                                                                        {s.school && (
                                                                            <span className="text-gray-400 ml-0.5">
                                                                                {s.school}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-gray-300 text-center">-</div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {cls.memo && (
                        <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 border-t border-emerald-200">
                            {cls.memo}
                        </div>
                    )}
                </div>
            ))}
        </>
    );
}

export default ShuttleTimetable;
