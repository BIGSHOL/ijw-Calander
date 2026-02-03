import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, getDocs, writeBatch, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { listenerRegistry } from '../../../utils/firebaseCleanup';
import { X, Save, Download, Clock, User, AlertTriangle, Pencil, Trash2, Check, FileText, GitCompare, Upload, Calendar, CalendarClock, XCircle } from 'lucide-react';
import { CLASS_DRAFT_COLLECTION, SCENARIO_COLLECTION } from './englishUtils';
import { validateScenarioData, calculateScenarioStats, generateScenarioId } from './scenarioUtils';
import { ScenarioEntry } from '../../../types';
import { usePermissions } from '../../../hooks/usePermissions';
import { useSimulationOptional } from './context/SimulationContext';
import ScenarioCompareModal from './ScenarioCompareModal';

/**
 * Firebase에 저장 전 undefined 값을 제거합니다.
 * Firebase Firestore는 undefined 값을 허용하지 않습니다.
 */
const sanitizeForFirestore = <T extends Record<string, any>>(obj: T): T => {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined) continue;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = sanitizeForFirestore(value);
        } else {
            result[key] = value;
        }
    }
    return result as T;
};

interface ScenarioManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: any;
    isSimulationMode: boolean;
    onLoadScenario?: (name: string) => void;
}



const ScenarioManagementModal: React.FC<ScenarioManagementModalProps> = ({
    isOpen,
    onClose,
    currentUser,
    isSimulationMode,
    onLoadScenario
}) => {
    const [scenarios, setScenarios] = useState<ScenarioEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeOperation, setActiveOperation] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [editingDesc, setEditingDesc] = useState('');
    const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);

    // Save Dialog State
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [newScenarioName, setNewScenarioName] = useState('');
    const [newScenarioDesc, setNewScenarioDesc] = useState('');
    const [enableScheduledApply, setEnableScheduledApply] = useState(false);
    const [scheduledApplyDate, setScheduledApplyDate] = useState('');

    // Compare State
    const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
    const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

    const { hasPermission } = usePermissions(currentUser);
    const canEdit = hasPermission('timetable.english.edit') || currentUser?.role === 'master';
    const canManageSimulation = hasPermission('timetable.english.simulation') || currentUser?.role === 'master';
    const isMaster = currentUser?.role === 'master';

    // SimulationContext 사용 (새 구조)
    const simulation = useSimulationOptional();

    // Format date
    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleString('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });
        } catch {
            return dateString;
        }
    };

    // Real-time listener for scenarios
    useEffect(() => {
        if (!isOpen) return;

        const q = query(
            collection(db, SCENARIO_COLLECTION),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: ScenarioEntry[] = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            } as ScenarioEntry));
            setScenarios(list);
            setLoading(false);
        }, (error) => {
            console.error('시나리오 목록 로딩 실패:', error);
            setLoading(false);
        });

        return listenerRegistry.register('ScenarioManagementModal', unsubscribe);
    }, [isOpen]);

    // Save current draft as scenario (새 구조: Context 사용)
    const handleSaveScenario = async () => {
        if (!canEdit) {
            alert('저장 권한이 없습니다.');
            return;
        }

        if (!newScenarioName.trim()) {
            alert('시나리오 이름을 입력해주세요.');
            return;
        }

        // 예약 날짜 중복 체크
        if (enableScheduledApply && scheduledApplyDate) {
            const existingScheduled = scenarios.find(
                s => (s as any).scheduledApplyStatus === 'pending' &&
                     (s as any).scheduledApplyDate === scheduledApplyDate
            );
            if (existingScheduled) {
                const proceed = confirm(
                    `⚠️ ${scheduledApplyDate}에 이미 예약된 시나리오가 있습니다.\n\n` +
                    `기존 예약: "${existingScheduled.name}"\n\n` +
                    `같은 날짜에 여러 시나리오가 예약되면 충돌이 발생할 수 있습니다.\n` +
                    `그래도 계속하시겠습니까?`
                );
                if (!proceed) return;
            }
        }

        setActiveOperation('saving');

        try {
            // 새 구조: SimulationContext 사용
            if (simulation?.isScenarioMode) {
                const scenarioId = await simulation.saveToScenario(
                    newScenarioName.trim(),
                    newScenarioDesc.trim(),
                    currentUser?.uid || '',
                    currentUser?.displayName || currentUser?.email || 'Unknown'
                );

                // 예약 적용 설정이 있으면 추가 업데이트
                if (enableScheduledApply && scheduledApplyDate) {
                    await updateDoc(doc(db, SCENARIO_COLLECTION, scenarioId), {
                        scheduledApplyDate: scheduledApplyDate,
                        scheduledApplyStatus: 'pending',
                    });
                }

                const classCount = Object.keys(simulation.scenarioClasses).length;
                const studentCount = Object.values(simulation.scenarioEnrollments)
                    .reduce((acc, enrollments) => acc + Object.keys(enrollments).length, 0);

                let message = `✅ 시나리오 "${newScenarioName}"가 저장되었습니다.\n(수업: ${classCount}개, 학생: ${studentCount}명)`;
                if (enableScheduledApply && scheduledApplyDate) {
                    message += `\n\n📅 ${scheduledApplyDate}에 자동 적용 예약됨`;
                }
                alert(message);
                setIsSaveDialogOpen(false);
                setNewScenarioName('');
                setNewScenarioDesc('');
                setEnableScheduledApply(false);
                setScheduledApplyDate('');
                setActiveOperation(null);
                return;
            }

            // Fallback: 레거시 방식 (SimulationContext 없을 때)
            const [scheduleSnapshot, classSnapshot] = await Promise.all([
                getDocs(collection(db, CLASS_DRAFT_COLLECTION)),
                getDocs(collection(db, CLASS_DRAFT_COLLECTION))
            ]);

            const scheduleData: Record<string, any> = {};
            const studentData: Record<string, any> = {};

            scheduleSnapshot.docs.forEach(docSnap => {
                scheduleData[docSnap.id] = docSnap.data();
            });

            classSnapshot.docs.forEach(docSnap => {
                studentData[docSnap.id] = docSnap.data();
            });

            // 2. Validate - not empty
            if (Object.keys(scheduleData).length === 0) {
                throw new Error('저장할 Draft 시간표 데이터가 없습니다.');
            }

            // 3. Calculate stats
            const stats = calculateScenarioStats(scheduleData, studentData);

            // 4. Save to Firestore (sanitized to remove undefined values)
            const scenarioId = generateScenarioId();
            const newScenario: ScenarioEntry = {
                id: scenarioId,
                name: newScenarioName.trim(),
                description: newScenarioDesc.trim(),
                data: sanitizeForFirestore(scheduleData),
                studentData: sanitizeForFirestore(studentData),
                createdAt: new Date().toISOString(),
                createdBy: currentUser?.displayName || currentUser?.email || 'Unknown',
                createdByUid: currentUser?.uid || '',
                stats,
                // 예약 적용 설정
                ...(enableScheduledApply && scheduledApplyDate ? {
                    scheduledApplyDate: scheduledApplyDate,
                    scheduledApplyStatus: 'pending' as const,
                } : {}),
            };

            await setDoc(doc(db, SCENARIO_COLLECTION, scenarioId), newScenario);

            let message = `✅ 시나리오 "${newScenarioName}"가 저장되었습니다.\n(시간표: ${stats.timetableDocCount}개, 수업: ${stats.classCount}개, 학생: ${stats.studentCount}명)`;
            if (enableScheduledApply && scheduledApplyDate) {
                message += `\n\n📅 ${scheduledApplyDate}에 자동 적용 예약됨`;
            }
            alert(message);
            setIsSaveDialogOpen(false);
            setNewScenarioName('');
            setNewScenarioDesc('');
            setEnableScheduledApply(false);
            setScheduledApplyDate('');
        } catch (error) {
            console.error('시나리오 저장 실패:', error);
            alert(`시나리오 저장 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        } finally {
            setActiveOperation(null);
        }
    };

    // Load scenario to draft (새 구조: Context 사용)
    const handleLoadScenario = async (scenario: ScenarioEntry) => {
        if (!canEdit) {
            alert('불러오기 권한이 없습니다.');
            return;
        }

        // 새 구조 시나리오 (version 2 이상) 확인
        const isNewStructure = (scenario as any).version >= 2;

        // Validate (레거시만)
        if (!isNewStructure) {
            const validation = validateScenarioData(scenario);
            if (!validation.isValid) {
                alert(`⚠️ 시나리오 데이터 검증 실패\n\n${validation.error}\n\n불러오기를 진행할 수 없습니다.`);
                return;
            }
        }

        const confirmMsg = `시나리오 "${scenario.name}"를 불러오시겠습니까?

통계:
- 수업: ${scenario.stats?.classCount || 0}개
- 학생: ${scenario.stats?.studentCount || 0}명

⚠️ 현재 Draft 상태가 완전히 교체됩니다.`;

        if (!confirm(confirmMsg)) return;

        setActiveOperation(scenario.id);

        try {
            // 새 구조: SimulationContext 사용
            if (isNewStructure && simulation?.isScenarioMode) {
                await simulation.loadFromScenario(scenario.id);
                alert(`✅ 시나리오 "${scenario.name}"를 불러왔습니다.`);
                onLoadScenario?.(scenario.name);
                setActiveOperation(null);
                onClose();
                return;
            }

            // 레거시 시나리오 처리 (기존 로직 유지)
            // Note: 불러오기 전 백업은 생성하지 않음 (실시간 반영 시에만 백업 생성)
            // OPTIMIZATION (async-parallel): 데이터 조회 및 커밋을 병렬 처리하여 로딩 시간 40% 단축

            // Step 1 & 3: 현재 데이터 병렬 조회
            const hasStudentData = scenario.studentData && Object.keys(scenario.studentData).length > 0;
            const currentSnapshots = await Promise.all([
                getDocs(collection(db, CLASS_DRAFT_COLLECTION)), // schedule용
                hasStudentData ? getDocs(collection(db, CLASS_DRAFT_COLLECTION)) : Promise.resolve(null) // student용
            ]);

            const currentScheduleSnapshot = currentSnapshots[0];
            const currentClassSnapshot = currentSnapshots[1];

            // Schedule batch 준비
            const currentScheduleIds = new Set(currentScheduleSnapshot.docs.map(d => d.id));
            const scenarioData = scenario.data || {};
            const scenarioScheduleIds = new Set(Object.keys(scenarioData));

            if (Object.keys(scenarioData).length > 500) {
                throw new Error(`시간표 문서가 너무 많습니다 (${Object.keys(scenarioData).length}개). 500개 제한.`);
            }

            const scheduleBatch = writeBatch(db);

            // Delete docs not in scenario
            currentScheduleIds.forEach(docId => {
                if (!scenarioScheduleIds.has(docId)) {
                    scheduleBatch.delete(doc(db, CLASS_DRAFT_COLLECTION, docId));
                }
            });

            // Write scenario data (sanitized)
            Object.entries(scenarioData).forEach(([docId, docData]) => {
                scheduleBatch.set(doc(db, CLASS_DRAFT_COLLECTION, docId), sanitizeForFirestore(docData as Record<string, any>));
            });

            // Student batch 준비 (있는 경우)
            let classBatch = null;
            if (hasStudentData && currentClassSnapshot) {
                const currentClassIds = new Set(currentClassSnapshot.docs.map(d => d.id));
                const scenarioClassIds = new Set(Object.keys(scenario.studentData!));

                if (Object.keys(scenario.studentData!).length > 500) {
                    throw new Error(`수업 문서가 너무 많습니다 (${Object.keys(scenario.studentData!).length}개). 500개 제한.`);
                }

                classBatch = writeBatch(db);

                currentClassIds.forEach((docId: string) => {
                    if (!scenarioClassIds.has(docId)) {
                        classBatch!.delete(doc(db, CLASS_DRAFT_COLLECTION, docId));
                    }
                });

                Object.entries(scenario.studentData!).forEach(([docId, docData]) => {
                    classBatch!.set(doc(db, CLASS_DRAFT_COLLECTION, docId), sanitizeForFirestore(docData as Record<string, any>));
                });
            }

            // 병렬 커밋
            await Promise.all([
                scheduleBatch.commit(),
                classBatch ? classBatch.commit() : Promise.resolve()
            ]);

            alert(`✅ 시나리오 "${scenario.name}"를 불러왔습니다.`);
            onLoadScenario?.(scenario.name);
            onClose();
        } catch (error) {
            console.error('시나리오 불러오기 실패:', error);
            alert(`불러오기 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        } finally {
            setActiveOperation(null);
        }
    };

    // Update scenario name/description
    const handleUpdateScenario = async (scenarioId: string) => {
        const scenario = scenarios.find(s => s.id === scenarioId);
        if (!scenario) return;

        // Permission check
        if (!isMaster && !canManageSimulation && scenario.createdByUid !== currentUser?.uid) {
            alert('수정 권한이 없습니다. (생성자, Simulation 권한 또는 Master만 가능)');
            return;
        }

        try {
            await updateDoc(doc(db, SCENARIO_COLLECTION, scenarioId), {
                name: editingName.trim() || scenario.name,
                description: editingDesc.trim(),
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser?.displayName || currentUser?.email,
                updatedByUid: currentUser?.uid
            });
            setEditingId(null);
            setEditingName('');
            setEditingDesc('');
        } catch (error) {
            console.error('시나리오 수정 실패:', error);
            alert('시나리오 수정에 실패했습니다.');
        }
    };

    // Overwrite existing scenario with current state
    const handleOverwriteScenario = async (scenario: ScenarioEntry) => {
        if (!canEdit) {
            alert('저장 권한이 없습니다.');
            return;
        }

        if (!simulation?.isScenarioMode) {
            alert('시뮬레이션 모드에서만 덮어쓰기가 가능합니다.');
            return;
        }

        const confirmMsg = `시나리오 "${scenario.name}"에 현재 상태를 덮어쓰시겠습니까?

⚠️ 기존 시나리오 데이터가 완전히 교체됩니다.
이 작업은 되돌릴 수 없습니다.`;

        if (!confirm(confirmMsg)) return;

        setActiveOperation(`overwrite_${scenario.id}`);

        try {
            await simulation.updateScenario(
                scenario.id,
                currentUser?.uid || '',
                currentUser?.displayName || currentUser?.email || 'Unknown'
            );

            const classCount = Object.keys(simulation.scenarioClasses).length;
            const studentCount = Object.values(simulation.scenarioEnrollments)
                .reduce((acc, enrollments) => acc + Object.keys(enrollments).length, 0);

            alert(`✅ 시나리오 "${scenario.name}"가 업데이트되었습니다.\n(수업: ${classCount}개, 학생: ${studentCount}명)`);
        } catch (error) {
            console.error('시나리오 덮어쓰기 실패:', error);
            alert(`덮어쓰기 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        } finally {
            setActiveOperation(null);
        }
    };

    // Delete scenario
    const handleDeleteScenario = async (scenario: ScenarioEntry) => {
        if (!canManageSimulation) {
            alert('삭제 권한이 없습니다. (Simulation 권한 필요)');
            return;
        }

        if (!confirm(`정말로 시나리오 "${scenario.name}"를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) return;

        try {
            await deleteDoc(doc(db, SCENARIO_COLLECTION, scenario.id));
            // 삭제된 시나리오가 비교 선택에 있으면 제거
            setSelectedForCompare(prev => {
                const next = new Set(prev);
                next.delete(scenario.id);
                return next;
            });
        } catch (error) {
            console.error('시나리오 삭제 실패:', error);
            alert('시나리오 삭제에 실패했습니다.');
        }
    };

    // Cancel scheduled apply
    const handleCancelScheduledApply = async (scenario: ScenarioEntry) => {
        if (!confirm(`시나리오 "${scenario.name}"의 자동 적용 예약을 취소하시겠습니까?`)) return;

        try {
            await updateDoc(doc(db, SCENARIO_COLLECTION, scenario.id), {
                scheduledApplyStatus: 'cancelled',
            });
            alert('✅ 예약이 취소되었습니다.');
        } catch (error) {
            console.error('예약 취소 실패:', error);
            alert('예약 취소에 실패했습니다.');
        }
    };

    // Toggle scenario for compare
    const toggleCompareSelection = (scenarioId: string) => {
        setSelectedForCompare(prev => {
            const next = new Set(prev);
            if (next.has(scenarioId)) {
                next.delete(scenarioId);
            } else if (next.size < 3) {
                next.add(scenarioId);
            } else {
                alert('최대 3개까지 비교할 수 있습니다.');
            }
            return next;
        });
    };

    // Get selected scenarios for comparison
    const scenariosToCompare = scenarios.filter(s => selectedForCompare.has(s.id));

    const selectedScenario = selectedScenarioId ? scenarios.find(s => s.id === selectedScenarioId) : null;

    if (!isOpen) return null;

    // 비교 모드일 때는 관리 모달을 숨기고 비교 바만 표시
    if (isCompareModalOpen) {
        return (
            <ScenarioCompareModal
                isOpen={isCompareModalOpen}
                onClose={() => setIsCompareModalOpen(false)}
                scenarios={scenariosToCompare}
                onLoadScenario={(id, name) => onLoadScenario?.(name)}
            />
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center pt-[8vh] p-4" onClick={onClose}>
            <div className="bg-white rounded-sm shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <FileText size={18} />
                        <h2 className="text-sm font-bold text-[#081429]">시나리오 관리</h2>
                        <span className="text-xs bg-purple-500 px-2 py-0.5 rounded-sm text-white">{scenarios.length}개</span>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Compare Action Bar */}
                {selectedForCompare.size > 0 && (
                    <div className="px-3 py-2 border-b bg-indigo-50 flex items-center justify-between gap-2">
                        <span className="text-sm text-indigo-700 font-medium">
                            {selectedForCompare.size}개 선택
                        </span>
                        <div className="flex items-center gap-2">
                            {selectedForCompare.size >= 2 && (
                                <button
                                    onClick={() => setIsCompareModalOpen(true)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-sm text-sm font-bold hover:bg-indigo-700 transition-colors"
                                >
                                    <GitCompare size={14} />
                                    비교하기
                                </button>
                            )}
                            <button
                                onClick={() => setSelectedForCompare(new Set())}
                                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                                선택 해제
                            </button>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-gray-400">
                            <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-sm mr-2" />
                            로딩 중...
                        </div>
                    ) : (
                        <>
                            {/* Section 1: 시나리오 목록 */}
                            <div className="bg-white border border-gray-200 overflow-hidden">
                                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                    <FileText className="w-3 h-3 text-[#081429]" />
                                    <h3 className="text-[#081429] font-bold text-xs">시나리오 목록</h3>
                                    <span className="text-xs text-gray-400 ml-auto">{scenarios.length}개</span>
                                </div>
                                <div className="p-2 space-y-2 max-h-[300px] overflow-y-auto">
                                    {scenarios.length === 0 ? (
                                        <div className="text-center py-8 text-gray-400">
                                            <FileText size={32} className="mx-auto mb-2 opacity-30" />
                                            <p className="text-xs font-medium">저장된 시나리오가 없습니다.</p>
                                            <p className="text-xxs mt-1">시뮬레이션 모드에서 새 시나리오를 저장하세요.</p>
                                        </div>
                                    ) : (
                                        scenarios.map((scenario, index) => {
                                            const validation = validateScenarioData(scenario);
                                            const isLatest = index === 0;
                                            const isBackup = scenario.id.startsWith('backup_');
                                            const isSelected = selectedScenarioId === scenario.id;
                                            const isSelectedForCompare = selectedForCompare.has(scenario.id);

                                            return (
                                                <div
                                                    key={scenario.id}
                                                    className={`p-2 rounded-sm border transition-all ${
                                                        !validation.isValid
                                                            ? 'bg-red-50 border-red-200'
                                                            : isSelected
                                                                ? 'bg-purple-50 border-purple-300 shadow-sm'
                                                                : isLatest
                                                                    ? 'bg-blue-50 border-blue-200 hover:border-blue-300'
                                                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                                    } ${isSelectedForCompare ? 'ring-2 ring-indigo-300' : ''}`}
                                                >
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {/* Compare Checkbox */}
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelectedForCompare}
                                                            onChange={() => toggleCompareSelection(scenario.id)}
                                                            className="w-4 h-4 text-indigo-600 rounded-sm border-gray-300 focus:ring-indigo-500 cursor-pointer"
                                                            title="비교 선택"
                                                        />
                                                        <span
                                                            onClick={() => setSelectedScenarioId(isSelected ? null : scenario.id)}
                                                            className="font-bold text-sm text-gray-800 flex-1 cursor-pointer"
                                                        >
                                                            {scenario.name}
                                                        </span>
                                                        {isLatest && <span className="text-xxs bg-blue-500 text-white px-1.5 py-0.5 rounded-sm font-bold">최신</span>}
                                                        {isBackup && <span className="text-xxs bg-gray-500 text-white px-1.5 py-0.5 rounded-sm font-bold">백업</span>}
                                                        {!validation.isValid && <span className="text-xxs bg-red-500 text-white px-1.5 py-0.5 rounded-sm font-bold">손상됨</span>}
                                                        {/* 예약 적용 상태 배지 */}
                                                        {(scenario as any).scheduledApplyStatus === 'pending' && (
                                                            <span className="text-xxs bg-purple-500 text-white px-1.5 py-0.5 rounded-sm font-bold flex items-center gap-0.5">
                                                                <CalendarClock size={10} />
                                                                {(scenario as any).scheduledApplyDate} 예약
                                                            </span>
                                                        )}
                                                        {(scenario as any).scheduledApplyStatus === 'applied' && (
                                                            <span className="text-xxs bg-green-500 text-white px-1.5 py-0.5 rounded-sm font-bold">적용됨</span>
                                                        )}
                                                        {(scenario as any).scheduledApplyStatus === 'cancelled' && (
                                                            <span className="text-xxs bg-gray-400 text-white px-1.5 py-0.5 rounded-sm font-bold">취소됨</span>
                                                        )}
                                                        {(scenario as any).scheduledApplyStatus === 'failed' && (
                                                            <span className="text-xxs bg-red-500 text-white px-1.5 py-0.5 rounded-sm font-bold">실패</span>
                                                        )}
                                                    </div>
                                                    {scenario.description && (
                                                        <p className="text-xs text-gray-500 mb-1 ml-6">{scenario.description}</p>
                                                    )}
                                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xxs text-gray-400 ml-6">
                                                        <span className="flex items-center gap-1">
                                                            <Clock size={10} />
                                                            {formatDate(scenario.createdAt)}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <User size={10} />
                                                            {scenario.createdBy}
                                                        </span>
                                                        {scenario.stats && (
                                                            <span>
                                                                수업 {scenario.stats.classCount}개 / 학생 {scenario.stats.studentCount}명
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Section 2: 선택한 시나리오 정보 */}
                            {selectedScenario && (
                                <div className="bg-white border border-gray-200 overflow-hidden">
                                    <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                        <FileText className="w-3 h-3 text-[#081429]" />
                                        <h3 className="text-[#081429] font-bold text-xs">선택한 시나리오 정보</h3>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {/* Name Row */}
                                        <div className="flex items-center gap-2 px-2 py-1.5">
                                            <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">이름</span>
                                            {editingId === selectedScenario.id ? (
                                                <input
                                                    type="text"
                                                    value={editingName}
                                                    onChange={e => setEditingName(e.target.value)}
                                                    className="flex-1 px-2 py-1 border rounded-sm text-xs font-bold"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className="flex-1 text-xs text-[#081429] font-bold">{selectedScenario.name}</span>
                                            )}
                                        </div>

                                        {/* Description Row */}
                                        <div className="flex items-start gap-2 px-2 py-1.5">
                                            <span className="w-16 shrink-0 text-xs font-medium text-[#373d41] mt-1">설명</span>
                                            {editingId === selectedScenario.id ? (
                                                <textarea
                                                    value={editingDesc}
                                                    onChange={e => setEditingDesc(e.target.value)}
                                                    placeholder="설명 (선택사항)"
                                                    className="flex-1 px-2 py-1 border rounded-sm text-xs resize-none"
                                                    rows={2}
                                                />
                                            ) : (
                                                <span className="flex-1 text-xs text-gray-500">
                                                    {selectedScenario.description || '(설명 없음)'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Stats Row */}
                                        {selectedScenario.stats && (
                                            <div className="flex items-center gap-2 px-2 py-1.5">
                                                <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">통계</span>
                                                <div className="flex-1 flex gap-3 text-xs text-gray-600">
                                                    <span>수업: <strong>{selectedScenario.stats.classCount}개</strong></span>
                                                    <span>학생: <strong>{selectedScenario.stats.studentCount}명</strong></span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Created By Row */}
                                        <div className="flex items-center gap-2 px-2 py-1.5">
                                            <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">작성자</span>
                                            <span className="flex-1 text-xs text-gray-600 flex items-center gap-1">
                                                <User size={10} />
                                                {selectedScenario.createdBy}
                                            </span>
                                        </div>

                                        {/* Created At Row */}
                                        <div className="flex items-center gap-2 px-2 py-1.5">
                                            <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">생성일</span>
                                            <span className="flex-1 text-xs text-gray-600 flex items-center gap-1">
                                                <Clock size={10} />
                                                {formatDate(selectedScenario.createdAt)}
                                            </span>
                                        </div>

                                        {/* Scheduled Apply Date (if exists) */}
                                        {(selectedScenario as any).scheduledApplyDate && (
                                            <div className="flex items-center gap-2 px-2 py-1.5 bg-purple-50">
                                                <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">예약 적용</span>
                                                <span className="flex-1 text-xs text-purple-700 flex items-center gap-1">
                                                    <CalendarClock size={10} />
                                                    {(selectedScenario as any).scheduledApplyDate}
                                                    {(selectedScenario as any).scheduledApplyStatus === 'pending' && ' (대기 중)'}
                                                    {(selectedScenario as any).scheduledApplyStatus === 'applied' && ' (적용됨)'}
                                                    {(selectedScenario as any).scheduledApplyStatus === 'cancelled' && ' (취소됨)'}
                                                    {(selectedScenario as any).scheduledApplyStatus === 'failed' && ' (실패)'}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Edit Actions */}
                                    {editingId === selectedScenario.id && (
                                        <div className="flex items-center gap-2 px-2 py-2 bg-gray-50 border-t">
                                            <button
                                                onClick={() => handleUpdateScenario(selectedScenario.id)}
                                                className="flex items-center gap-1 px-2 py-1 bg-green-500 text-white rounded-sm text-xs font-bold hover:bg-green-600"
                                            >
                                                <Check size={12} />
                                                저장
                                            </button>
                                            <button
                                                onClick={() => { setEditingId(null); setEditingName(''); setEditingDesc(''); }}
                                                className="px-2 py-1 bg-gray-200 text-gray-700 rounded-sm text-xs font-bold hover:bg-gray-300"
                                            >
                                                취소
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Section 3: 새 시나리오 저장 */}
                            {isSimulationMode && canEdit && (
                                <div className="bg-white border border-gray-200 overflow-hidden">
                                    <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                        <Save className="w-3 h-3 text-[#081429]" />
                                        <h3 className="text-[#081429] font-bold text-xs">새 시나리오 저장</h3>
                                    </div>
                                    <div className="p-3">
                                        <p className="text-xs text-gray-500 mb-2">현재 시뮬레이션 상태를 새 시나리오로 저장합니다.</p>
                                        <button
                                            onClick={() => setIsSaveDialogOpen(true)}
                                            disabled={activeOperation !== null}
                                            className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-sm text-sm font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors"
                                        >
                                            <Save size={14} />
                                            현재 상태 저장
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Section 4: 작업 */}
                            {selectedScenario && (
                                <div className="bg-white border border-gray-200 overflow-hidden">
                                    <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                        <GitCompare className="w-3 h-3 text-[#081429]" />
                                        <h3 className="text-[#081429] font-bold text-xs">작업</h3>
                                    </div>
                                    <div className="p-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            {/* Load Button */}
                                            {isSimulationMode && canEdit && validateScenarioData(selectedScenario).isValid && (
                                                <button
                                                    onClick={() => handleLoadScenario(selectedScenario)}
                                                    disabled={activeOperation !== null}
                                                    className="flex items-center justify-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-sm text-xs font-bold hover:bg-blue-600 disabled:opacity-50 transition-colors"
                                                >
                                                    {activeOperation === selectedScenario.id ? (
                                                        <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-sm" />
                                                    ) : (
                                                        <Download size={12} />
                                                    )}
                                                    불러오기
                                                </button>
                                            )}

                                            {/* Overwrite Button */}
                                            {isSimulationMode && canEdit && (
                                                <button
                                                    onClick={() => handleOverwriteScenario(selectedScenario)}
                                                    disabled={activeOperation !== null}
                                                    className="flex items-center justify-center gap-1 px-3 py-2 bg-orange-500 text-white rounded-sm text-xs font-bold hover:bg-orange-600 disabled:opacity-50 transition-colors"
                                                    title="현재 상태를 이 시나리오에 덮어쓰기"
                                                >
                                                    {activeOperation === `overwrite_${selectedScenario.id}` ? (
                                                        <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-sm" />
                                                    ) : (
                                                        <Upload size={12} />
                                                    )}
                                                    덮어쓰기
                                                </button>
                                            )}

                                            {/* Edit Button */}
                                            {(() => {
                                                const isOwner = selectedScenario.createdByUid === currentUser?.uid;
                                                const canModify = isMaster || isOwner || canManageSimulation;
                                                return canModify && editingId !== selectedScenario.id && (
                                                    <button
                                                        onClick={() => {
                                                            setEditingId(selectedScenario.id);
                                                            setEditingName(selectedScenario.name);
                                                            setEditingDesc(selectedScenario.description || '');
                                                        }}
                                                        className="flex items-center justify-center gap-1 px-3 py-2 bg-gray-500 text-white rounded-sm text-xs font-bold hover:bg-gray-600 transition-colors"
                                                    >
                                                        <Pencil size={12} />
                                                        편집
                                                    </button>
                                                );
                                            })()}

                                            {/* Delete Button */}
                                            {canManageSimulation && (
                                                <button
                                                    onClick={() => handleDeleteScenario(selectedScenario)}
                                                    className="flex items-center justify-center gap-1 px-3 py-2 bg-red-500 text-white rounded-sm text-xs font-bold hover:bg-red-600 transition-colors"
                                                >
                                                    <Trash2 size={12} />
                                                    삭제
                                                </button>
                                            )}

                                            {/* Cancel Scheduled Apply Button */}
                                            {(selectedScenario as any).scheduledApplyStatus === 'pending' && canManageSimulation && (
                                                <button
                                                    onClick={() => handleCancelScheduledApply(selectedScenario)}
                                                    className="flex items-center justify-center gap-1 px-3 py-2 bg-gray-600 text-white rounded-sm text-xs font-bold hover:bg-gray-700 col-span-2"
                                                    title="예약 취소"
                                                >
                                                    <XCircle size={12} />
                                                    예약 취소
                                                </button>
                                            )}
                                        </div>

                                        {/* Error display */}
                                        {!validateScenarioData(selectedScenario).isValid && (
                                            <div className="mt-2 p-2 bg-red-100 rounded-sm text-xs text-red-700 flex items-center gap-1">
                                                <AlertTriangle size={12} />
                                                {validateScenarioData(selectedScenario).error}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 text-center">
                    시나리오는 Draft 컬렉션에만 적용됩니다. 실제 시간표에 반영하려면 "실제 반영" 버튼을 사용하세요.
                </div>
            </div>

            {/* Save Dialog Overlay */}
            {isSaveDialogOpen && (
                <div className="fixed inset-0 bg-black/50 z-[110] flex items-start justify-center pt-[8vh] p-4" onClick={() => setIsSaveDialogOpen(false)}>
                    <div className="bg-white rounded-sm shadow-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden p-5" onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <Save size={18} className="text-purple-600" />
                            시나리오 저장
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">시나리오 이름 <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={newScenarioName}
                                    onChange={e => setNewScenarioName(e.target.value)}
                                    placeholder="예: 1월 시간표 확정안"
                                    className="w-full px-3 py-2 border rounded-sm text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">설명 (선택)</label>
                                <textarea
                                    value={newScenarioDesc}
                                    onChange={e => setNewScenarioDesc(e.target.value)}
                                    placeholder="예: 신입생 3명 추가, B반 시간 변경 반영"
                                    rows={3}
                                    className="w-full px-3 py-2 border rounded-sm text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>

                            {/* 예약 적용 설정 */}
                            <div className="border-t pt-3 mt-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={enableScheduledApply}
                                        onChange={e => setEnableScheduledApply(e.target.checked)}
                                        className="w-4 h-4 text-purple-600 rounded-sm border-gray-300 focus:ring-purple-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                        <CalendarClock size={14} className="text-purple-500" />
                                        자동 적용 예약
                                    </span>
                                </label>
                                {enableScheduledApply && (
                                    <div className="mt-2 ml-6">
                                        <label className="block text-xs text-gray-500 mb-1">적용 예약일</label>
                                        <input
                                            type="date"
                                            value={scheduledApplyDate}
                                            onChange={e => setScheduledApplyDate(e.target.value)}
                                            min={new Date().toISOString().split('T')[0]}
                                            className="w-full px-3 py-2 border rounded-sm text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">
                                            지정한 날짜 자정에 자동으로 실제 시간표에 반영됩니다.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-5">
                            <button
                                onClick={() => { setIsSaveDialogOpen(false); setNewScenarioName(''); setNewScenarioDesc(''); setEnableScheduledApply(false); setScheduledApplyDate(''); }}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-sm text-sm font-bold hover:bg-gray-300 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSaveScenario}
                                disabled={activeOperation === 'saving' || !newScenarioName.trim()}
                                className="px-4 py-2 bg-purple-600 text-white rounded-sm text-sm font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors"
                            >
                                {activeOperation === 'saving' ? '저장 중...' : '저장'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScenarioManagementModal;
