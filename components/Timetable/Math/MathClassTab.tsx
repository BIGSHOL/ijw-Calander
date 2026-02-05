// Math Class Integration Tab
// 수학 통합 시간표 탭 - 수업별 컬럼 뷰 (영어 통합뷰와 동일한 디자인)

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Settings, Eye, Edit, ArrowRightLeft, Copy, Upload, Save, SlidersHorizontal, Link2 } from 'lucide-react';
import { doc, collection, query, where, getDocs, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { Teacher, TimetableStudent, ClassKeywordColor, TimetableClass } from '../../../types';
import { usePermissions } from '../../../hooks/usePermissions';

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

interface MathClassTabProps {
    classes: TimetableClass[];
    teachers: string[];
    teachersData?: Teacher[];
    classKeywords?: ClassKeywordColor[];
    currentUser: any;
    studentMap: Record<string, any>;
    classesData?: ClassInfoFromHook[];
    isSimulationMode?: boolean;
    canSimulation?: boolean;
    onToggleSimulation?: () => void;
    onCopyLiveToDraft?: () => void;
    onPublishToLive?: () => void;
    onOpenScenarioModal?: () => void;
    canPublish?: boolean;
    // 주차 이동 시 배정 예정/퇴원 예정 미리보기용
    currentWeekStart?: Date;
    // 보기 설정 모달 제어 (TimetableHeader 버튼 연동)
    isViewSettingsOpen?: boolean;
    setIsViewSettingsOpen?: (isOpen: boolean) => void;
    // 검색어 (TimetableHeader 검색 필드와 통합)
    searchQuery?: string;
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
    canSimulation = false,
    onToggleSimulation,
    onCopyLiveToDraft,
    onPublishToLive,
    onOpenScenarioModal,
    canPublish = false,
    currentWeekStart,
    isViewSettingsOpen: isViewSettingsOpenProp,
    setIsViewSettingsOpen: setIsViewSettingsOpenProp,
    searchQuery = '',
}) => {
    const { hasPermission } = usePermissions(currentUser);
    const isMaster = currentUser?.role === 'master';
    const canEditMath = hasPermission('timetable.math.edit') || isMaster;
    const canManageStudents = isMaster || hasPermission('students.edit');

    const [mode, setMode] = useState<'view' | 'edit'>(isSimulationMode ? 'edit' : 'view');
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
    }, [isSimulationMode]);

    // --- Hook Integration ---
    const { settings, settingsLoading, updateSettings } = useMathSettings();
    const mathClasses = useMathIntegrationClasses(classes, settings, teachersData);
    const classNames = useMemo(() => mathClasses.map(c => c.name), [mathClasses]);
    const { classDataMap, isLoading: studentsLoading, refetch: refetchClassStudents } = useMathClassStudents(classNames, studentMap);

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
            {/* Simulation Action Bar */}
            {isSimulationMode && canEditMath && (
                <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-orange-50 border-b border-orange-200 flex-shrink-0">
                    <button
                        onClick={onCopyLiveToDraft}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-orange-300 text-orange-700 rounded-sm text-xs font-bold hover:bg-orange-50 shadow-sm transition-colors"
                        title="현재 실시간 시간표를 복사해옵니다"
                    >
                        <Copy size={12} />
                        현재 상태 가져오기
                    </button>
                    {canPublish && (
                        <button
                            onClick={onPublishToLive}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-600 text-white rounded-sm text-xs font-bold hover:bg-orange-700 shadow-sm transition-colors"
                            title="시뮬레이션 내용을 실제 시간표에 적용합니다"
                        >
                            <Upload size={12} />
                            실제 반영
                        </button>
                    )}
                    <button
                        onClick={onOpenScenarioModal}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-100 border border-purple-300 text-purple-700 rounded-sm text-xs font-bold hover:bg-purple-200 shadow-sm transition-colors"
                        title="시나리오 저장/불러오기"
                    >
                        <Save size={12} />
                        시나리오 관리
                    </button>
                </div>
            )}

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

                    {/* 그룹 설정 */}
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
                        {groupedClasses.map(group => (
                            <div key={group.periodIndex} className="bg-white shadow border border-gray-300 overflow-hidden w-max max-w-full">
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
            />
        </div>
    );
};

export default MathClassTab;
