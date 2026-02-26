// Math Class Integration Tab
// 수학 통합 시간표 탭 - 수업별 컬럼 뷰 (영어 통합뷰와 동일한 디자인)

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Settings } from 'lucide-react';
import { doc, collection, query, where, getDocs, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { Teacher, TimetableStudent, ClassKeywordColor, TimetableClass } from '../../../types';
import { usePermissions } from '../../../hooks/usePermissions';
import { getWeekReferenceDate } from '../../../utils/dateUtils';

// Hooks
import { useMathSettings, MathIntegrationSettings } from './hooks/useMathSettings';
import { useMathIntegrationClasses, MathClassInfo } from './hooks/useMathIntegrationClasses';
import { useMathClassStudents } from './hooks/useMathClassStudents';

// Components
import IntegrationClassCard from '../shared/IntegrationClassCard';
import MathIntegrationViewSettings, { MathClassEntry } from './MathIntegrationViewSettings';
import SimpleViewSettingsModal from './components/Modals/SimpleViewSettingsModal';
import ClassDetailModal from '../../ClassManagement/ClassDetailModal';
import StudentDetailModal from '../../StudentManagement/StudentDetailModal';
import EmbedTokenManager from '../../Embed/EmbedTokenManager';
import { ClassInfo as ClassInfoFromHook } from '../../../hooks/useClasses';
import { UnifiedStudent } from '../../../types';

// 그룹 정보 인터페이스 (이미지 내보내기용)
export interface ExportGroupInfo {
    id: number;
    label: string;
}

interface MathClassTabProps {
    classes: TimetableClass[];
    teachers: string[];
    teachersData?: Teacher[];
    classKeywords?: ClassKeywordColor[];
    currentUser: any;
    studentMap: Record<string, any>;
    classesData?: ClassInfoFromHook[];
    isSimulationMode?: boolean;
    // 주차 이동 시 배정 예정/퇴원 예정 미리보기용
    currentWeekStart?: Date;
    // 보기 설정 모달 제어 (TimetableHeader 버튼 연동)
    isViewSettingsOpen?: boolean;
    setIsViewSettingsOpen?: (isOpen: boolean) => void;
    // 검색어 (TimetableHeader 검색 필드와 통합)
    searchQuery?: string;
    // 조회/수정 모드 (TimetableHeader 버튼 연동)
    mode?: 'view' | 'edit';
    setMode?: (mode: 'view' | 'edit') => void;
    // 이미지 내보내기용: 그룹 정보 콜백
    onGroupsReady?: (groups: ExportGroupInfo[]) => void;
    // 이미지 내보내기용: 표시할 그룹 ID 목록 (undefined면 모두 표시)
    exportVisibleGroups?: number[];
}

interface GroupedClass {
    periodIndex: number;
    label: string;
    classes: MathClassInfo[];
    isWeekend?: boolean;  // 주말 전용 그룹 여부
}

// 강사 색상 가져오기 - bgColor 사용
const getTeacherColor = (teacherName: string, teachersData: Teacher[]): { bg: string; text: string } => {
    const teacher = teachersData.find(t => t.name === teacherName || t.englishName === teacherName);
    if (teacher?.bgColor) {
        return { bg: teacher.bgColor, text: teacher.textColor || '#fff' };
    }
    return { bg: '#e5e7eb', text: '#374151' };
};

const MathClassTab: React.FC<MathClassTabProps> = ({
    classes,
    teachers,
    teachersData = [],
    classKeywords = [],
    currentUser,
    studentMap,
    classesData = [],
    isSimulationMode = false,
    currentWeekStart,
    isViewSettingsOpen: isViewSettingsOpenProp,
    setIsViewSettingsOpen: setIsViewSettingsOpenProp,
    searchQuery = '',
    mode: modeProp,
    setMode: setModeProp,
    onGroupsReady,
    exportVisibleGroups,
}) => {
    const { hasPermission } = usePermissions(currentUser);
    const canEditMath = hasPermission('timetable.math.edit');
    const canManageStudents = hasPermission('students.edit');

    const [modeLocal, setModeLocal] = useState<'view' | 'edit'>(isSimulationMode ? 'edit' : 'view');
    const mode = modeProp ?? modeLocal;
    const setMode = setModeProp ?? setModeLocal;
    const [hiddenClasses, setHiddenClasses] = useState<Set<string>>(new Set());

    // UI States
    const [isViewSettingsOpenLocal, setIsViewSettingsOpenLocal] = useState(false);
    const isViewSettingsOpen = isViewSettingsOpenProp ?? isViewSettingsOpenLocal;
    const setIsViewSettingsOpen = setIsViewSettingsOpenProp ?? setIsViewSettingsOpenLocal;
    const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);
    const [isEmbedManagerOpen, setIsEmbedManagerOpen] = useState(false);
    const [selectedClassDetail, setSelectedClassDetail] = useState<ClassInfoFromHook | null>(null);
    const [selectedStudent, setSelectedStudent] = useState<UnifiedStudent | null>(null);

    // 시뮬레이션 모드에서는 항상 수정모드
    useEffect(() => {
        if (isSimulationMode) setMode('edit');
    }, [isSimulationMode]); // setMode 제거 - 매 렌더링마다 새로 생성되어 불필요한 재실행 방지

    // --- Hook Integration ---
    const { settings, settingsLoading, updateSettings } = useMathSettings();
    const mathClasses = useMathIntegrationClasses(classes, settings, teachersData);
    const classNames = useMemo(() => mathClasses.map(c => c.name), [mathClasses]);

    // 주차 기준일: 미래 주 → weekStart, 이번 주 → today, 과거 주 → weekEnd(일요일)
    const referenceDate = useMemo(() => {
        if (!currentWeekStart) return undefined;
        return getWeekReferenceDate(currentWeekStart);
    }, [currentWeekStart]);

    const { classDataMap, isLoading: studentsLoading, refetch: refetchClassStudents } = useMathClassStudents(classNames, studentMap, referenceDate);

    // Filter by search term (통합 검색: TimetableHeader의 searchQuery 사용)
    const filteredClasses = useMemo(() => {
        return mathClasses
            .filter(c => !searchQuery || (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => a.startPeriod - b.startPeriod || (a.name || '').localeCompare(b.name || '', 'ko'));
    }, [mathClasses, searchQuery]);

    // Group classes by start period OR Custom Groups
    const groupedClasses = useMemo(() => {
        const groups: GroupedClass[] = [];

        if (settings.viewMode === 'CUSTOM_GROUP') {
            const assignedClasses = new Set<string>();

            settings.customGroups.forEach((g, idx) => {
                const groupClasses: MathClassInfo[] = [];
                g.classes.forEach(classRef => {
                    const cls = filteredClasses.find(c => c.classId === classRef) ||
                        filteredClasses.find(c => c.name === classRef);
                    if (cls) {
                        if (hiddenClasses.has(cls.name) && mode === 'view') return;
                        groupClasses.push(cls);
                        assignedClasses.add(cls.name);
                    }
                });

                if (groupClasses.length > 0 || mode === 'edit') {
                    groups.push({
                        periodIndex: idx,
                        label: g.title,
                        classes: groupClasses,
                    });
                }
            });

            if (settings.showOthersGroup) {
                const otherClasses = filteredClasses.filter(c => !assignedClasses.has(c.name));
                const visibleOthers = otherClasses.filter(c => !(hiddenClasses.has(c.name) && mode === 'view'));

                if (visibleOthers.length > 0) {
                    groups.push({
                        periodIndex: 999,
                        label: settings.othersGroupTitle || '기타 수업',
                        classes: visibleOthers,
                    });
                }
            }
        } else {
            // 평일 수업과 주말 전용 수업 분리
            const weekdayClasses = filteredClasses.filter(c => !c.isWeekendOnly);
            const weekendClasses = filteredClasses.filter(c => c.isWeekendOnly);

            // 평일 수업: 시작 교시별 그룹화
            const periodMap = new Map<number, MathClassInfo[]>();

            weekdayClasses.forEach(cls => {
                if (hiddenClasses.has(cls.name) && mode === 'view') return;
                const period = cls.startPeriod;
                if (!periodMap.has(period)) {
                    periodMap.set(period, []);
                }
                periodMap.get(period)!.push(cls);
            });

            Array.from(periodMap.entries())
                .sort((a, b) => a[0] - b[0])
                .forEach(([period, classes]) => {
                    groups.push({
                        periodIndex: period,
                        label: `${period}교시 시작`,
                        classes,
                    });
                });

            // 주말 전용 수업: 별도 그룹
            const visibleWeekendClasses = weekendClasses.filter(c => !(hiddenClasses.has(c.name) && mode === 'view'));
            if (visibleWeekendClasses.length > 0) {
                // 주말 수업도 시작 교시별로 그룹화
                const weekendPeriodMap = new Map<number, MathClassInfo[]>();

                visibleWeekendClasses.forEach(cls => {
                    const period = cls.startPeriod;
                    if (!weekendPeriodMap.has(period)) {
                        weekendPeriodMap.set(period, []);
                    }
                    weekendPeriodMap.get(period)!.push(cls);
                });

                Array.from(weekendPeriodMap.entries())
                    .sort((a, b) => a[0] - b[0])
                    .forEach(([period, classes]) => {
                        groups.push({
                            periodIndex: 100 + period,  // 주말은 100+로 구분
                            label: `🗓️ 주말 ${period}교시 시작`,
                            classes,
                            isWeekend: true,
                        });
                    });
            }
        }

        return groups;
    }, [filteredClasses, settings, hiddenClasses, mode]);

    // 그룹 정보를 부모에게 전달 (이미지 내보내기용)
    // 이전 그룹 ID를 추적하여 실제 변경 시에만 콜백 호출 (무한 루프 방지)
    const prevGroupIdsRef = useRef<string>('');
    useEffect(() => {
        if (onGroupsReady && groupedClasses.length > 0) {
            const groupIds = groupedClasses.map(g => g.periodIndex).join(',');
            if (groupIds !== prevGroupIdsRef.current) {
                prevGroupIdsRef.current = groupIds;
                onGroupsReady(groupedClasses.map(g => ({
                    id: g.periodIndex,
                    label: g.label,
                })));
            }
        }
    }, [groupedClasses, onGroupsReady]);

    const allClassesForSettings: MathClassEntry[] = useMemo(() => {
        return mathClasses.map(c => ({
            classId: c.classId,
            className: c.name,
        }));
    }, [mathClasses]);

    const toggleHidden = (className: string) => {
        setHiddenClasses(prev => {
            const newSet = new Set(prev);
            if (newSet.has(className)) newSet.delete(className);
            else newSet.add(className);
            return newSet;
        });
    };

    const handleClassClick = (classInfo: MathClassInfo) => {
        const classDetail = classesData.find(c => c.className === classInfo.name);
        if (classDetail) {
            setSelectedClassDetail(classDetail);
        }
    };

    const handleStudentClick = (studentId: string) => {
        const student = studentMap[studentId];
        if (student) {
            setSelectedStudent(student);
        }
    };

    // 수업 종료 취소 (퇴원생 복구)
    const handleRestoreEnrollment = async (studentId: string, className: string) => {
        try {
            // Find the enrollment document
            const enrollmentsQuery = query(
                collection(db, 'students', studentId, 'enrollments'),
                where('subject', '==', 'math'),
                where('className', '==', className)
            );
            const snapshot = await getDocs(enrollmentsQuery);

            if (snapshot.empty) {
                alert('해당 수강 정보를 찾을 수 없습니다.');
                return;
            }

            // Remove endDate and withdrawalDate from the enrollment
            for (const docSnap of snapshot.docs) {
                await updateDoc(docSnap.ref, {
                    endDate: deleteField(),
                    withdrawalDate: deleteField(),
                });
            }

            // Refresh class students data
            await refetchClassStudents();
            alert('수업 종료가 취소되었습니다.');
        } catch (error) {
            console.error('수업 종료 취소 오류:', error);
            alert('수업 종료 취소에 실패했습니다.');
        }
    };

    if (settingsLoading) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-100">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-sm animate-spin"></div>
                    <span className="text-sm text-gray-500 font-medium">설정 로딩중...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white select-none">
            {/* 시뮬레이션 액션 바는 TimetableHeader로 통합됨 */}

            {/* Teacher Legend + Controls */}
            <div className="px-4 py-2 bg-white border-b flex items-center justify-between flex-shrink-0">
                {/* Left: 강사 목록 */}
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs font-bold text-gray-400 mr-1">강사 목록:</span>
                    {teachers.filter(t => {
                        const td = teachersData.find(td => td.name === t);
                        if (td?.isHidden) return false;
                        return true;
                    }).map(teacher => {
                        const colors = getTeacherColor(teacher, teachersData);
                        return (
                            <div
                                key={teacher}
                                className="px-2 py-0.5 rounded-sm text-xs font-bold shadow-sm border border-black/5"
                                style={{ backgroundColor: colors.bg, color: colors.text }}
                            >
                                {teacher}
                            </div>
                        );
                    })}
                </div>

                {/* Right: 통합뷰 고유 버튼들 */}
                <div className="flex items-center gap-2 ml-4">
                    {/* Hidden Count */}
                    {hiddenClasses.size > 0 && (
                        <span className="text-xs text-gray-400 font-medium px-2">
                            {hiddenClasses.size}개 숨김
                        </span>
                    )}

                    {/* 그룹 설정 (수정 모드에서만) */}
                    {mode === 'edit' && canEditMath && (
                        <button
                            onClick={() => setIsGroupSettingsOpen(true)}
                            className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 text-gray-700 rounded-sm hover:bg-gray-50 text-xs font-bold"
                        >
                            <Settings size={12} />
                            그룹 설정
                        </button>
                    )}
                </div>
            </div>

            {/* Classes Grid */}
            <div className="flex-1 overflow-auto p-4 bg-gray-100 custom-scrollbar">
                {groupedClasses.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        데이터가 없습니다.
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {groupedClasses
                            .filter(group => !exportVisibleGroups || exportVisibleGroups.includes(group.periodIndex))
                            .map(group => (
                            <div key={group.periodIndex} data-group-id={group.periodIndex} className="bg-white shadow border border-gray-300 overflow-hidden w-max max-w-full">
                                {/* Group Header */}
                                <div className="bg-gray-800 text-white px-4 py-2 font-bold text-sm flex items-center gap-2">
                                    <span>🕒 {group.label}</span>
                                    <span className="text-xs bg-gray-600 px-2 py-0.5 rounded-sm text-gray-200 font-normal">
                                        {group.classes.length}개 수업
                                    </span>
                                </div>

                                {/* Classes Row (Horizontal Scroll) */}
                                <div className="overflow-x-auto custom-scrollbar">
                                    <div className="flex items-stretch w-max border-b border-gray-200">
                                        {/* Sticky Time Column */}
                                        {group.classes.length > 0 && (
                                            <div className="sticky left-0 z-20 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.1)] self-stretch">
                                                <IntegrationClassCard
                                                    classInfo={group.classes[0]}
                                                    mode={'view'}
                                                    subject="math"
                                                    displayOptions={settings.displayOptions}
                                                    teachersData={teachersData}
                                                    classKeywords={[]}
                                                    currentUser={currentUser}
                                                    isSimulationMode={isSimulationMode}
                                                    classStudentData={classDataMap[group.classes[0].name]}
                                                    isTimeColumnOnly={true}
                                                    currentWeekStart={currentWeekStart}
                                                />
                                            </div>
                                        )}

                                        {group.classes.map(cls => (
                                            <IntegrationClassCard
                                                key={cls.name}
                                                classInfo={cls}
                                                mode={mode}
                                                subject="math"
                                                isHidden={hiddenClasses.has(cls.name)}
                                                onToggleHidden={() => toggleHidden(cls.name)}
                                                displayOptions={settings.displayOptions}
                                                teachersData={teachersData}
                                                classKeywords={classKeywords}
                                                currentUser={currentUser}
                                                isSimulationMode={isSimulationMode}
                                                classStudentData={classDataMap[cls.name]}
                                                hideTime={true}
                                                onClassClick={mode === 'edit' && !isSimulationMode ? () => handleClassClick(cls) : undefined}
                                                onStudentClick={handleStudentClick}
                                                onRestoreEnrollment={!isSimulationMode ? handleRestoreEnrollment : undefined}
                                                currentWeekStart={currentWeekStart}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 보기 설정 Modal (통합) */}
            <SimpleViewSettingsModal
                isOpen={isViewSettingsOpen}
                onClose={() => setIsViewSettingsOpen(false)}
                viewType="integration"
                showStudents={settings.displayOptions?.showStudents}
                setShowStudents={(show) => updateSettings({
                    ...settings,
                    displayOptions: { ...settings.displayOptions!, showStudents: show }
                })}
                showClassName={settings.displayOptions?.showClassName}
                setShowClassName={(show) => updateSettings({
                    ...settings,
                    displayOptions: { ...settings.displayOptions!, showClassName: show }
                })}
                showSchool={settings.displayOptions?.showSchool}
                setShowSchool={(show) => updateSettings({
                    ...settings,
                    displayOptions: { ...settings.displayOptions!, showSchool: show }
                })}
                showGrade={settings.displayOptions?.showGrade}
                setShowGrade={(show) => updateSettings({
                    ...settings,
                    displayOptions: { ...settings.displayOptions!, showGrade: show }
                })}
                showHoldStudents={settings.displayOptions?.showHoldStudents}
                setShowHoldStudents={(show) => updateSettings({
                    ...settings,
                    displayOptions: { ...settings.displayOptions!, showHoldStudents: show }
                })}
                showWithdrawnStudents={settings.displayOptions?.showWithdrawnStudents}
                setShowWithdrawnStudents={(show) => updateSettings({
                    ...settings,
                    displayOptions: { ...settings.displayOptions!, showWithdrawnStudents: show }
                })}
                showRoom={settings.displayOptions?.showRoom}
                setShowRoom={(show) => updateSettings({
                    ...settings,
                    displayOptions: { ...settings.displayOptions!, showRoom: show }
                })}
                showTeacher={settings.displayOptions?.showTeacher}
                setShowTeacher={(show) => updateSettings({
                    ...settings,
                    displayOptions: { ...settings.displayOptions!, showTeacher: show }
                })}
                showSchedule={settings.displayOptions?.showSchedule}
                setShowSchedule={(show) => updateSettings({
                    ...settings,
                    displayOptions: { ...settings.displayOptions!, showSchedule: show }
                })}
            />

            {/* 그룹 설정 Modal */}
            <MathIntegrationViewSettings
                isOpen={isGroupSettingsOpen}
                onClose={() => setIsGroupSettingsOpen(false)}
                settings={settings}
                onChange={updateSettings}
                allClasses={allClassesForSettings}
                teachers={teachers}
                teachersData={teachersData}
            />

            {/* Class Detail Modal */}
            {selectedClassDetail && (
                <ClassDetailModal
                    classInfo={selectedClassDetail}
                    onClose={() => setSelectedClassDetail(null)}
                />
            )}

            {/* Student Detail Modal - 학생관리 권한에 따라 조회/수정 모드 결정 */}
            {selectedStudent && (
                <StudentDetailModal
                    student={selectedStudent}
                    onClose={() => setSelectedStudent(null)}
                    readOnly={!canManageStudents}
                    currentUser={currentUser}
                />
            )}

            {/* Embed Token Manager Modal - 관리자 전용 */}
            <EmbedTokenManager
                isOpen={isEmbedManagerOpen}
                onClose={() => setIsEmbedManagerOpen(false)}
                staffId={currentUser?.staffId || currentUser?.uid || ''}
                filterType={['math-timetable', 'english-timetable']}
            />
        </div>
    );
};

export default MathClassTab;
