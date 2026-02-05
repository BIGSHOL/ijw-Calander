import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, getDocs, writeBatch, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { listenerRegistry } from '../../../utils/firebaseCleanup';
import { X, Save, Download, Clock, User, AlertTriangle, Pencil, Trash2, Check, FileText, GitCompare, Upload, CalendarClock } from 'lucide-react';
import { ScenarioEntry } from '../../../types';
import { usePermissions } from '../../../hooks/usePermissions';
import { useMathSimulationOptional } from './context/SimulationContext';

// Math-specific constants
const SCENARIO_COLLECTION = 'math_scenarios';
const CLASS_DRAFT_COLLECTION = 'math_class_drafts';  // 레거시용 (사용 안 할 예정)

// Utility functions for scenario validation
const validateScenarioData = (scenario: ScenarioEntry) => {
    if (!scenario.data && !scenario.classes) {
        return { isValid: false, error: '시나리오 데이터가 없습니다.' };
    }
    return { isValid: true, error: null };
};

const calculateScenarioStats = (scheduleData: Record<string, any>, studentData: Record<string, any>) => {
    return {
        timetableDocCount: Object.keys(scheduleData).length,
        classCount: Object.keys(scheduleData).length,
        studentCount: Object.values(studentData).reduce((acc: number, data: any) =>
            acc + (data.students ? Object.keys(data.students).length : 0), 0
        )
    };
};

const generateScenarioId = () => `math_scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

    const { hasPermission } = usePermissions(currentUser);
    const canEdit = hasPermission('timetable.math.edit') || currentUser?.role === 'master';
    const canManageSimulation = hasPermission('timetable.math.simulation') || currentUser?.role === 'master';
    const isMaster = currentUser?.role === 'master';

    // SimulationContext 사용 (새 구조)
    const simulation = useMathSimulationOptional();

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

                const classCount = Object.keys(simulation.scenarioClasses).length;
                const studentCount = Object.values(simulation.scenarioEnrollments)
                    .reduce((acc, enrollments) => acc + Object.keys(enrollments).length, 0);

                alert(`✅ 시나리오 "${newScenarioName}"가 저장되었습니다.\n(수업: ${classCount}개, 학생: ${studentCount}명)`);
                setIsSaveDialogOpen(false);
                setNewScenarioName('');
                setNewScenarioDesc('');
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
                stats
            };

            await setDoc(doc(db, SCENARIO_COLLECTION, scenarioId), newScenario);

            alert(`✅ 시나리오 "${newScenarioName}"가 저장되었습니다.\n(시간표: ${stats.timetableDocCount}개, 수업: ${stats.classCount}개, 학생: ${stats.studentCount}명)`);
            setIsSaveDialogOpen(false);
            setNewScenarioName('');
            setNewScenarioDesc('');
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

            // Step 1: Replace draft schedule data
            const currentScheduleSnapshot = await getDocs(collection(db, CLASS_DRAFT_COLLECTION));
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

            await scheduleBatch.commit();

            // Step 3: Replace draft student data (if exists)
            if (scenario.studentData && Object.keys(scenario.studentData).length > 0) {
                const currentClassSnapshot = await getDocs(collection(db, CLASS_DRAFT_COLLECTION));
                const currentClassIds = new Set(currentClassSnapshot.docs.map(d => d.id));
                const scenarioClassIds = new Set(Object.keys(scenario.studentData));

                if (Object.keys(scenario.studentData).length > 500) {
                    throw new Error(`수업 문서가 너무 많습니다 (${Object.keys(scenario.studentData).length}개). 500개 제한.`);
                }

                const classBatch = writeBatch(db);

                currentClassIds.forEach(docId => {
                    if (!scenarioClassIds.has(docId)) {
                        classBatch.delete(doc(db, CLASS_DRAFT_COLLECTION, docId));
                    }
                });

                Object.entries(scenario.studentData).forEach(([docId, docData]) => {
                    classBatch.set(doc(db, CLASS_DRAFT_COLLECTION, docId), sanitizeForFirestore(docData as Record<string, any>));
                });

                await classBatch.commit();
            }

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
        } catch (error) {
            console.error('시나리오 삭제 실패:', error);
            alert('시나리오 삭제에 실패했습니다.');
        }
    };

    const selectedScenario = selectedScenarioId ? scenarios.find(s => s.id === selectedScenarioId) : null;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center pt-[8vh] p-4" onClick={onClose}>
            <div className="bg-white rounded-sm shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <FileText size={18} />
                        <h2 className="text-sm font-bold text-primary">시나리오 관리</h2>
                        <span className="text-xs bg-purple-500 px-2 py-0.5 rounded-sm text-white">{scenarios.length}개</span>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

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
                                    <FileText className="w-3 h-3 text-primary" />
                                    <h3 className="text-primary font-bold text-xs">시나리오 목록</h3>
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

                                            return (
                                                <div
                                                    key={scenario.id}
                                                    onClick={() => setSelectedScenarioId(isSelected ? null : scenario.id)}
                                                    className={`p-2 rounded-sm border cursor-pointer transition-all ${
                                                        !validation.isValid
                                                            ? 'bg-red-50 border-red-200'
                                                            : isSelected
                                                                ? 'bg-purple-50 border-purple-300 shadow-sm'
                                                                : isLatest
                                                                    ? 'bg-blue-50 border-blue-200 hover:border-blue-300'
                                                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm text-gray-800 flex-1">{scenario.name}</span>
                                                        {isLatest && <span className="text-xxs bg-blue-500 text-white px-1.5 py-0.5 rounded-sm font-bold">최신</span>}
                                                        {isBackup && <span className="text-xxs bg-gray-500 text-white px-1.5 py-0.5 rounded-sm font-bold">백업</span>}
                                                        {!validation.isValid && <span className="text-xxs bg-red-500 text-white px-1.5 py-0.5 rounded-sm font-bold">손상됨</span>}
                                                    </div>
                                                    {scenario.description && (
                                                        <p className="text-xs text-gray-500 mt-1">{scenario.description}</p>
                                                    )}
                                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xxs text-gray-400 mt-1">
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
                                        <FileText className="w-3 h-3 text-primary" />
                                        <h3 className="text-primary font-bold text-xs">선택한 시나리오 정보</h3>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {/* Name Row */}
                                        <div className="flex items-center gap-2 px-2 py-1.5">
                                            <span className="w-16 shrink-0 text-xs font-medium text-primary-700">이름</span>
                                            {editingId === selectedScenario.id ? (
                                                <input
                                                    type="text"
                                                    value={editingName}
                                                    onChange={e => setEditingName(e.target.value)}
                                                    className="flex-1 px-2 py-1 border rounded-sm text-xs font-bold"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className="flex-1 text-xs text-primary font-bold">{selectedScenario.name}</span>
                                            )}
                                        </div>

                                        {/* Description Row */}
                                        <div className="flex items-start gap-2 px-2 py-1.5">
                                            <span className="w-16 shrink-0 text-xs font-medium text-primary-700 mt-1">설명</span>
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
                                                <span className="w-16 shrink-0 text-xs font-medium text-primary-700">통계</span>
                                                <div className="flex-1 flex gap-3 text-xs text-gray-600">
                                                    <span>수업: <strong>{selectedScenario.stats.classCount}개</strong></span>
                                                    <span>학생: <strong>{selectedScenario.stats.studentCount}명</strong></span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Created By Row */}
                                        <div className="flex items-center gap-2 px-2 py-1.5">
                                            <span className="w-16 shrink-0 text-xs font-medium text-primary-700">작성자</span>
                                            <span className="flex-1 text-xs text-gray-600 flex items-center gap-1">
                                                <User size={10} />
                                                {selectedScenario.createdBy}
                                            </span>
                                        </div>

                                        {/* Created At Row */}
                                        <div className="flex items-center gap-2 px-2 py-1.5">
                                            <span className="w-16 shrink-0 text-xs font-medium text-primary-700">생성일</span>
                                            <span className="flex-1 text-xs text-gray-600 flex items-center gap-1">
                                                <Clock size={10} />
                                                {formatDate(selectedScenario.createdAt)}
                                            </span>
                                        </div>

                                        {/* Scheduled Apply Date (if exists) */}
                                        {(selectedScenario as any).scheduledApplyDate && (
                                            <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-50">
                                                <span className="w-16 shrink-0 text-xs font-medium text-primary-700">예정 반영</span>
                                                <span className="flex-1 text-xs text-amber-700 flex items-center gap-1">
                                                    <CalendarClock size={10} />
                                                    {formatDate((selectedScenario as any).scheduledApplyDate)}
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
                                        <Save className="w-3 h-3 text-primary" />
                                        <h3 className="text-primary font-bold text-xs">새 시나리오 저장</h3>
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
                                        <GitCompare className="w-3 h-3 text-primary" />
                                        <h3 className="text-primary font-bold text-xs">작업</h3>
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
                        </div>
                        <div className="flex justify-end gap-2 mt-5">
                            <button
                                onClick={() => { setIsSaveDialogOpen(false); setNewScenarioName(''); setNewScenarioDesc(''); }}
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
