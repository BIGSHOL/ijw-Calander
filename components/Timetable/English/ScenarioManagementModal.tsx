import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, getDocs, writeBatch, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { listenerRegistry } from '../../../utils/firebaseCleanup';
import { X, Save, Download, Clock, User, AlertTriangle, Pencil, Trash2, Check, FileText, BarChart3 } from 'lucide-react';
import { CLASS_DRAFT_COLLECTION, SCENARIO_COLLECTION } from './englishUtils';
import { validateScenarioData, calculateScenarioStats, generateScenarioId } from './scenarioUtils';
import { ScenarioEntry } from '../../../types';
import { usePermissions } from '../../../hooks/usePermissions';
import { useSimulationOptional } from './context/SimulationContext';

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

    // Save Dialog State
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [newScenarioName, setNewScenarioName] = useState('');
    const [newScenarioDesc, setNewScenarioDesc] = useState('');

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

        setActiveOperation('saving');

        try {
            // 새 구조: SimulationContext 사용
            if (simulation?.isSimulationMode) {
                const scenarioId = await simulation.saveToScenario(
                    newScenarioName.trim(),
                    newScenarioDesc.trim(),
                    currentUser?.uid || '',
                    currentUser?.displayName || currentUser?.email || 'Unknown'
                );

                const classCount = Object.keys(simulation.draftClasses).length;
                const studentCount = Object.values(simulation.draftEnrollments)
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

        // 새 구조 시나리오 (version 2) 확인
        const isNewStructure = (scenario as any).version === 2;

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
            if (isNewStructure && simulation?.isSimulationMode) {
                await simulation.loadFromScenario(scenario.id);
                alert(`✅ 시나리오 "${scenario.name}"를 불러왔습니다.`);
                onLoadScenario?.(scenario.name);
                setActiveOperation(null);
                onClose();
                return;
            }

            // 레거시 시나리오 처리 (기존 로직 유지)
            // Step 1: Backup current draft state
            const preLoadBackupId = `backup_preload_${Date.now()}`;
            try {
                const [currentSchedule, currentClass] = await Promise.all([
                    getDocs(collection(db, CLASS_DRAFT_COLLECTION)),
                    getDocs(collection(db, CLASS_DRAFT_COLLECTION))
                ]);

                const currentScheduleData: Record<string, any> = {};
                const currentStudentData: Record<string, any> = {};

                currentSchedule.docs.forEach(docSnap => {
                    currentScheduleData[docSnap.id] = docSnap.data();
                });

                currentClass.docs.forEach(docSnap => {
                    currentStudentData[docSnap.id] = docSnap.data();
                });

                // 통계 계산
                const stats = calculateScenarioStats(currentScheduleData, currentStudentData);

                await setDoc(doc(db, SCENARIO_COLLECTION, preLoadBackupId), {
                    id: preLoadBackupId,
                    name: `백업(자동)_${new Date().toLocaleString()}`,
                    description: `[자동백업] 시나리오 "${scenario.name}" 불러오기 전 자동 생성됨.`,
                    data: sanitizeForFirestore(currentScheduleData),
                    studentData: sanitizeForFirestore(currentStudentData),
                    createdAt: new Date().toISOString(),
                    createdBy: `${currentUser?.displayName || 'Unknown'} (자동)`,
                    createdByUid: currentUser?.uid || '',
                    stats,
                    isPreRestoreBackup: true,
                    restoringTo: scenario.id
                });

                console.log(`✅ Pre-load backup created as Scenario: ${preLoadBackupId}`);
            } catch (backupError) {
                console.warn('불러오기 전 백업 생성 실패 (계속 진행):', backupError);
            }

            // Step 2: Replace draft schedule data
            const currentScheduleSnapshot = await getDocs(collection(db, CLASS_DRAFT_COLLECTION));
            const currentScheduleIds = new Set(currentScheduleSnapshot.docs.map(d => d.id));
            const scenarioScheduleIds = new Set(Object.keys(scenario.data));

            if (Object.keys(scenario.data).length > 500) {
                throw new Error(`시간표 문서가 너무 많습니다 (${Object.keys(scenario.data).length}개). 500개 제한.`);
            }

            const scheduleBatch = writeBatch(db);

            // Delete docs not in scenario
            currentScheduleIds.forEach(docId => {
                if (!scenarioScheduleIds.has(docId)) {
                    scheduleBatch.delete(doc(db, CLASS_DRAFT_COLLECTION, docId));
                }
            });

            // Write scenario data (sanitized)
            Object.entries(scenario.data).forEach(([docId, docData]) => {
                scheduleBatch.set(doc(db, CLASS_DRAFT_COLLECTION, docId), sanitizeForFirestore(docData as Record<string, any>));
            });

            await scheduleBatch.commit();
            console.log('✅ Schedule draft replaced');

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
                console.log('✅ Class draft replaced');
            }

            alert(`✅ 시나리오 "${scenario.name}"를 불러왔습니다.\n(자동 백업 ID: ${preLoadBackupId})`);
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-purple-600 text-white rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <FileText size={20} />
                        <h2 className="font-bold text-lg">시나리오 관리</h2>
                        <span className="text-xs bg-purple-500 px-2 py-0.5 rounded-full">{scenarios.length}개</span>
                    </div>
                    <button onClick={onClose} className="text-purple-200 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Action Bar */}
                {isSimulationMode && canEdit && (
                    <div className="p-3 border-b bg-purple-50 flex items-center justify-between">
                        <span className="text-sm text-purple-700">현재 Draft 상태를 시나리오로 저장할 수 있습니다.</span>
                        <button
                            onClick={() => setIsSaveDialogOpen(true)}
                            disabled={activeOperation !== null}
                            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors"
                        >
                            <Save size={14} />
                            현재 상태 저장
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-gray-400">
                            <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mr-2" />
                            로딩 중...
                        </div>
                    ) : scenarios.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <FileText size={48} className="mx-auto mb-3 opacity-30" />
                            <p className="font-medium">저장된 시나리오가 없습니다.</p>
                            <p className="text-sm mt-1">시뮬레이션 모드에서 "현재 상태 저장"을 눌러 시나리오를 생성하세요.</p>
                        </div>
                    ) : (
                        scenarios.map((scenario, index) => {
                            const validation = validateScenarioData(scenario);
                            const isLatest = index === 0;
                            const isOwner = scenario.createdByUid === currentUser?.uid;
                            const canModify = isMaster || isOwner || canManageSimulation;
                            const isBackup = scenario.id.startsWith('backup_');

                            return (
                                <div
                                    key={scenario.id}
                                    className={`p-3 rounded-lg border transition-colors ${!validation.isValid
                                        ? 'bg-red-50 border-red-200'
                                        : isLatest
                                            ? 'bg-blue-50 border-blue-200'
                                            : 'bg-white border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    {/* Name + Badges */}
                                    <div className="flex items-center gap-2 mb-1">
                                        {editingId === scenario.id ? (
                                            <input
                                                type="text"
                                                value={editingName}
                                                onChange={e => setEditingName(e.target.value)}
                                                className="flex-1 px-2 py-1 border rounded text-sm font-bold"
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="font-bold text-gray-800">{scenario.name}</span>
                                        )}
                                        {isLatest && <span className="text-xxs bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold">최신</span>}
                                        {isBackup && <span className="text-xxs bg-gray-500 text-white px-1.5 py-0.5 rounded font-bold">자동 백업</span>}
                                        {!validation.isValid && <span className="text-xxs bg-red-500 text-white px-1.5 py-0.5 rounded font-bold">손상됨</span>}
                                    </div>

                                    {/* Description */}
                                    {editingId === scenario.id ? (
                                        <textarea
                                            value={editingDesc}
                                            onChange={e => setEditingDesc(e.target.value)}
                                            placeholder="설명 (선택사항)"
                                            className="w-full px-2 py-1 border rounded text-xs mb-2 resize-none"
                                            rows={2}
                                        />
                                    ) : scenario.description ? (
                                        <p className="text-xs text-gray-500 mb-2">{scenario.description}</p>
                                    ) : null}

                                    {/* Metadata */}
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-2">
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
                                                시간표 {scenario.stats.timetableDocCount}개 / 수업 {scenario.stats.classCount}개 / 학생 {scenario.stats.studentCount}명
                                            </span>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        {editingId === scenario.id ? (
                                            <>
                                                <button
                                                    onClick={() => handleUpdateScenario(scenario.id)}
                                                    className="flex items-center gap-1 px-2 py-1 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600"
                                                >
                                                    <Check size={12} />
                                                    저장
                                                </button>
                                                <button
                                                    onClick={() => { setEditingId(null); setEditingName(''); setEditingDesc(''); }}
                                                    className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-bold hover:bg-gray-300"
                                                >
                                                    취소
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                {isSimulationMode && canEdit && validation.isValid && (
                                                    <button
                                                        onClick={() => handleLoadScenario(scenario)}
                                                        disabled={activeOperation !== null}
                                                        className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white rounded text-xs font-bold hover:bg-blue-600 disabled:opacity-50"
                                                    >
                                                        {activeOperation === scenario.id ? (
                                                            <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                                                        ) : (
                                                            <Download size={12} />
                                                        )}
                                                        불러오기
                                                    </button>
                                                )}
                                                {canModify && (
                                                    <button
                                                        onClick={() => {
                                                            setEditingId(scenario.id);
                                                            setEditingName(scenario.name);
                                                            setEditingDesc(scenario.description || '');
                                                        }}
                                                        className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                                        title="편집"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                )}
                                                {canManageSimulation && (
                                                    <button
                                                        onClick={() => handleDeleteScenario(scenario)}
                                                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                        title="삭제"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* Error display */}
                                    {!validation.isValid && (
                                        <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-700 flex items-center gap-1">
                                            <AlertTriangle size={12} />
                                            {validation.error}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 text-center rounded-b-xl">
                    시나리오는 Draft 컬렉션에만 적용됩니다. 실제 시간표에 반영하려면 "실제 반영" 버튼을 사용하세요.
                </div>
            </div>

            {/* Save Dialog Overlay */}
            {isSaveDialogOpen && (
                <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4" onClick={() => setIsSaveDialogOpen(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <Save size={18} className="text-purple-600" />
                            시나리오 저장
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">시나리오 이름 *</label>
                                <input
                                    type="text"
                                    value={newScenarioName}
                                    onChange={e => setNewScenarioName(e.target.value)}
                                    placeholder="예: 1월 시간표 확정안"
                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                                    className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-5">
                            <button
                                onClick={() => { setIsSaveDialogOpen(false); setNewScenarioName(''); setNewScenarioDesc(''); }}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-300 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSaveScenario}
                                disabled={activeOperation === 'saving' || !newScenarioName.trim()}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors"
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
