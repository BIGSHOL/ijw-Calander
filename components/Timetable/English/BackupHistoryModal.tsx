import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, getDocs, writeBatch, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { listenerRegistry } from '../../../utils/firebaseCleanup';
import { X, RotateCcw, Clock, User, AlertTriangle, Pencil, Trash2, Check, Database, Eye, FileText } from 'lucide-react';
import { CLASS_COLLECTION } from './englishUtils';
import { usePermissions } from '../../../hooks/usePermissions';

interface BackupEntry {
    id: string;
    createdAt: string;
    createdBy: string;
    createdByUid: string;
    name?: string;  // 백업 이름 (Optional)
    data: Record<string, any>;
    studentData?: Record<string, any>;  // 학생 데이터 (Optional for backward compatibility)
    isPreRestoreBackup?: boolean;
    restoringTo?: string;
}

interface BackupHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: any;
}

const BACKUP_COLLECTION = 'english_backups';
const MAX_BACKUPS = 20;

// CRITICAL FIX Issue 3: Add backup data validation function
const validateBackupData = (backup: BackupEntry): { isValid: boolean; error?: string } => {
    // Check if backup object exists
    if (!backup) {
        return { isValid: false, error: '백업 데이터가 존재하지 않습니다.' };
    }

    // Check required fields
    if (!backup.id || typeof backup.id !== 'string') {
        return { isValid: false, error: '백업 ID가 올바르지 않습니다.' };
    }

    if (!backup.createdAt || typeof backup.createdAt !== 'string') {
        return { isValid: false, error: '백업 생성 시간 정보가 올바르지 않습니다.' };
    }

    // Validate createdAt is a valid date
    const date = new Date(backup.createdAt);
    if (isNaN(date.getTime())) {
        return { isValid: false, error: '백업 생성 시간 형식이 올바르지 않습니다.' };
    }

    if (!backup.createdBy || typeof backup.createdBy !== 'string') {
        return { isValid: false, error: '백업 생성자 정보가 올바르지 않습니다.' };
    }

    // Check if data exists and is an object
    if (!backup.data || typeof backup.data !== 'object') {
        return { isValid: false, error: '백업 데이터 구조가 올바르지 않습니다.' };
    }

    // Check if backup data is empty
    if (Object.keys(backup.data).length === 0) {
        return { isValid: false, error: '백업 데이터가 비어있습니다.' };
    }

    // Validate each document in backup data
    for (const [docId, docData] of Object.entries(backup.data)) {
        if (typeof docId !== 'string' || !docId) {
            return { isValid: false, error: `잘못된 문서 ID가 포함되어 있습니다: ${docId}` };
        }

        if (!docData || typeof docData !== 'object') {
            return { isValid: false, error: `문서 "${docId}"의 데이터가 올바르지 않습니다.` };
        }
    }

    return { isValid: true };
};

const BackupHistoryModal: React.FC<BackupHistoryModalProps> = ({ isOpen, onClose, currentUser }) => {
    const [backups, setBackups] = useState<BackupEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [restoring, setRestoring] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [selectedBackup, setSelectedBackup] = useState<BackupEntry | null>(null);

    const { hasPermission } = usePermissions(currentUser);
    const canRestore = hasPermission('timetable.english.backup.restore') || currentUser?.role === 'master';
    const isMaster = currentUser?.role === 'master';

    // Calculate total student count from studentData
    const getStudentCount = (backup: BackupEntry) => {
        if (!backup.studentData) return 0;
        let total = 0;
        Object.values(backup.studentData).forEach((classData: any) => {
            if (classData.studentList && Array.isArray(classData.studentList)) {
                total += classData.studentList.filter((s: any) => !s.withdrawalDate && !s.onHold).length;
            }
        });
        return total;
    };

    // Format creator display: displayName (email)
    const formatCreator = (backup: BackupEntry) => {
        const parts = backup.createdBy?.split('@');
        if (parts && parts.length > 1) {
            // If it's an email, show as is
            return backup.createdBy;
        }
        return backup.createdBy || '(알 수 없음)';
    };

    // Handle name update
    const handleUpdateName = async (backupId: string) => {
        try {
            await updateDoc(doc(db, BACKUP_COLLECTION, backupId), {
                name: editingName.trim() || null
            });
            setEditingId(null);
            setEditingName('');
        } catch (error) {
            console.error('Failed to update backup name:', error);
            alert('백업 이름 수정에 실패했습니다.');
        }
    };

    // Handle backup delete
    const handleDelete = async (backup: BackupEntry) => {
        if (!isMaster) {
            alert('삭제 권한이 없습니다. (master only)');
            return;
        }
        if (!confirm(`정말로 이 백업을 삭제하시겠습니까?\n\n${backup.name || formatDate(backup.createdAt)}`)) return;

        try {
            await deleteDoc(doc(db, BACKUP_COLLECTION, backup.id));
            if (selectedBackup?.id === backup.id) {
                setSelectedBackup(null);
            }
        } catch (error) {
            console.error('Failed to delete backup:', error);
            alert('백업 삭제에 실패했습니다.');
        }
    };

    useEffect(() => {
        if (!isOpen) return;

        const q = query(
            collection(db, BACKUP_COLLECTION),
            orderBy('createdAt', 'desc'),
            limit(MAX_BACKUPS)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const backupList: BackupEntry[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as BackupEntry));
            setBackups(backupList);
            setLoading(false);
        }, (error) => {
            console.error('백업 목록 로딩 실패:', error);
            setLoading(false);
        });

        return listenerRegistry.register('BackupHistoryModal', unsubscribe);
    }, [isOpen]);

    const handleRestore = async (backup: BackupEntry) => {
        if (!canRestore) {
            alert('복원 권한이 없습니다.');
            return;
        }

        // CRITICAL FIX Issue 3: Validate backup data before restoration
        const validation = validateBackupData(backup);
        if (!validation.isValid) {
            alert(`⚠️ 백업 데이터 검증 실패\n\n${validation.error}\n\n복원을 진행할 수 없습니다.`);
            console.error('Backup validation failed:', validation.error, backup);
            return;
        }

        const confirmMsg = `⚠️ 정말로 이 백업으로 복원하시겠습니까?

백업 시점: ${formatDate(backup.createdAt)}
생성자: ${backup.createdBy}
문서 수: ${Object.keys(backup.data).length}개

✨ 복원 전 현재 상태가 자동으로 백업됩니다.
현재 시간표 데이터가 이 백업의 데이터로 완전히 대체됩니다.
이 작업은 되돌릴 수 없지만, 자동 백업으로 복원 가능합니다.`;

        if (!confirm(confirmMsg)) return;

        setRestoring(backup.id);

        try {
            // Step 1: 현재 상태 백업 (복원 전 안전장치) - 시간표 + 학생 데이터
            const preRestoreBackupId = `pre_restore_${Date.now()}`;
            try {
                const currentTimetableSnapshot = await getDocs(collection(db, CLASS_COLLECTION));
                const currentClassSnapshot = await getDocs(collection(db, CLASS_COLLECTION));

                const currentTimetableData: Record<string, any> = {};
                const currentStudentData: Record<string, any> = {};

                currentTimetableSnapshot.docs.forEach(docSnap => {
                    currentTimetableData[docSnap.id] = docSnap.data();
                });

                currentClassSnapshot.docs.forEach(docSnap => {
                    currentStudentData[docSnap.id] = docSnap.data();
                });

                await setDoc(doc(db, BACKUP_COLLECTION, preRestoreBackupId), {
                    createdAt: new Date().toISOString(),
                    createdBy: `복원 전 자동백업 (${currentUser?.displayName || 'Unknown'})`,
                    createdByUid: currentUser?.uid || '',
                    data: currentTimetableData,
                    studentData: currentStudentData,
                    isPreRestoreBackup: true,
                    restoringTo: backup.id
                });
            } catch (preBackupError) {
                console.warn('복원 전 백업 생성 실패 (계속 진행):', preBackupError);
            }

            // Step 2: 시간표 복원
            const currentSnapshot = await getDocs(collection(db, CLASS_COLLECTION));
            const currentDocIds = new Set(currentSnapshot.docs.map(doc => doc.id));
            const backupDocIds = new Set(Object.keys(backup.data));

            const timetableBatch = writeBatch(db);
            let timetableDeleteCount = 0;
            let timetableWriteCount = 0;

            currentDocIds.forEach(docId => {
                if (!backupDocIds.has(docId)) {
                    timetableBatch.delete(doc(db, CLASS_COLLECTION, docId));
                    timetableDeleteCount++;
                }
            });

            Object.entries(backup.data).forEach(([docId, docData]) => {
                timetableBatch.set(doc(db, CLASS_COLLECTION, docId), docData);
                timetableWriteCount++;
            });

            await timetableBatch.commit();

            // Step 3: 학생 데이터 복원 (있는 경우만)
            let studentDeleteCount = 0;
            let studentWriteCount = 0;

            if (backup.studentData && Object.keys(backup.studentData).length > 0) {
                const currentClassSnapshot = await getDocs(collection(db, CLASS_COLLECTION));
                const currentClassIds = new Set(currentClassSnapshot.docs.map(doc => doc.id));
                const backupClassIds = new Set(Object.keys(backup.studentData));

                if (Object.keys(backup.studentData).length > 500) {
                    throw new Error(`복원할 수업 문서가 너무 많습니다 (${Object.keys(backup.studentData).length}개).`);
                }

                const studentBatch = writeBatch(db);

                currentClassIds.forEach(docId => {
                    if (!backupClassIds.has(docId)) {
                        studentBatch.delete(doc(db, CLASS_COLLECTION, docId));
                        studentDeleteCount++;
                    }
                });

                Object.entries(backup.studentData).forEach(([docId, docData]) => {
                    studentBatch.set(doc(db, CLASS_COLLECTION, docId), docData);
                    studentWriteCount++;
                });

                await studentBatch.commit();
            }

            // 결과 메시지
            const resultMessage = backup.studentData
                ? `✅ 복원이 완료되었습니다.\n\n시간표:\n- 삭제: ${timetableDeleteCount}개\n- 복원: ${timetableWriteCount}개\n\n학생 데이터:\n- 삭제: ${studentDeleteCount}개\n- 복원: ${studentWriteCount}개\n\n💡 복원 전 상태는 자동 백업되었습니다.\n(${preRestoreBackupId})`
                : `✅ 복원이 완료되었습니다. (시간표만)\n\n시간표:\n- 삭제: ${timetableDeleteCount}개\n- 복원: ${timetableWriteCount}개\n\n⚠️ 이 백업은 학생 데이터를 포함하지 않습니다.\n\n💡 복원 전 상태는 자동 백업되었습니다.\n(${preRestoreBackupId})`;

            alert(resultMessage);
            onClose();
        } catch (error) {
            console.error('복원 실패:', error);
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            alert(`⚠️ 복원 중 오류가 발생했습니다.\n\n${errorMessage}\n\n데이터가 변경되지 않았을 수 있습니다. 현재 상태를 확인해주세요.`);
        } finally {
            setRestoring(null);
        }
    };

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const getRelativeTime = (isoString: string) => {
        const now = new Date();
        const date = new Date(isoString);
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return '방금 전';
        if (diffMins < 60) return `${diffMins}분 전`;
        if (diffHours < 24) return `${diffHours}시간 전`;
        if (diffDays < 7) return `${diffDays}일 전`;
        return formatDate(isoString);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[8vh] bg-black/50" onClick={onClose}>
            <div
                className="bg-white rounded-sm shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <Clock className="text-blue-600" size={20} />
                        <h2 className="text-lg font-bold text-gray-800">백업 기록</h2>
                        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-sm">
                            최근 {MAX_BACKUPS}개
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-sm hover:bg-gray-200 transition-colors"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-32 text-gray-400">
                            로딩 중...
                        </div>
                    ) : backups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-2">
                            <AlertTriangle size={32} />
                            <span>저장된 백업이 없습니다.</span>
                            <span className="text-xs">시뮬레이션 모드에서 "실제 반영" 시 자동으로 백업됩니다.</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Section 1: 백업 목록 */}
                            <div className="bg-white border border-gray-200 overflow-hidden">
                                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                    <Database className="w-3 h-3 text-primary" />
                                    <h3 className="text-primary font-bold text-xs">백업 목록</h3>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {backups.map((backup, index) => {
                                        // Validate each backup for display
                                        const validation = validateBackupData(backup);
                                        const isCorrupted = !validation.isValid;
                                        const isPreRestoreBackup = backup.isPreRestoreBackup === true;
                                        const isSelected = selectedBackup?.id === backup.id;

                                        return (
                                            <div
                                                key={backup.id}
                                                onClick={() => setSelectedBackup(backup)}
                                                className={`flex items-center justify-between p-3 transition-colors cursor-pointer ${
                                                    isCorrupted
                                                        ? 'bg-red-50 hover:bg-red-100'
                                                        : isPreRestoreBackup
                                                            ? 'bg-purple-50 hover:bg-purple-100'
                                                            : isSelected
                                                                ? 'bg-blue-50'
                                                                : index === 0
                                                                    ? 'bg-green-50 hover:bg-green-100'
                                                                    : 'bg-white hover:bg-gray-50'
                                                }`}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    {/* 백업 이름 (편집 모드) */}
                                                    {editingId === backup.id ? (
                                                        <div className="flex items-center gap-2 mb-1" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="text"
                                                                value={editingName}
                                                                onChange={(e) => setEditingName(e.target.value)}
                                                                placeholder="백업 이름 입력..."
                                                                className="flex-1 px-2 py-1 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                                autoFocus
                                                                onKeyPress={(e) => e.key === 'Enter' && handleUpdateName(backup.id)}
                                                            />
                                                            <button
                                                                onClick={() => handleUpdateName(backup.id)}
                                                                className="p-1 text-green-600 hover:bg-green-100 rounded-sm"
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => { setEditingId(null); setEditingName(''); }}
                                                                className="p-1 text-gray-400 hover:bg-gray-200 rounded-sm"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        /* 백업 이름 (보기 모드) */
                                                        backup.name && (
                                                            <div className="text-sm font-bold text-indigo-700 mb-1 truncate">
                                                                <FileText className="inline w-3 h-3 mr-1" />
                                                                {backup.name}
                                                            </div>
                                                        )
                                                    )}
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Clock size={12} className="text-gray-400 shrink-0" />
                                                        <span className={`font-semibold text-sm truncate ${isCorrupted ? 'text-red-700' : isPreRestoreBackup ? 'text-purple-700' : 'text-gray-800'}`}>
                                                            {backup.createdAt ? formatDate(backup.createdAt) : '(날짜 정보 없음)'}
                                                        </span>
                                                        {index === 0 && !isCorrupted && !isPreRestoreBackup && (
                                                            <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-sm shrink-0">
                                                                최신
                                                            </span>
                                                        )}
                                                        {isPreRestoreBackup && (
                                                            <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-sm shrink-0">
                                                                자동백업
                                                            </span>
                                                        )}
                                                        {isCorrupted && (
                                                            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-sm shrink-0">
                                                                손상됨
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                                                        <span className="flex items-center gap-1">
                                                            <User size={12} />
                                                            <span className="truncate">{formatCreator(backup)}</span>
                                                        </span>
                                                        {backup.createdAt && (
                                                            <span className="text-gray-400">
                                                                {getRelativeTime(backup.createdAt)}
                                                            </span>
                                                        )}
                                                        {backup.studentData && (
                                                            <span className="text-blue-600 font-medium">
                                                                {getStudentCount(backup)}명 / {Object.keys(backup.studentData).length}수업
                                                            </span>
                                                        )}
                                                    </div>
                                                    {isCorrupted && (
                                                        <div className="mt-2 text-xs text-red-600 bg-red-100 px-2 py-1 rounded-sm">
                                                            {validation.error}
                                                        </div>
                                                    )}
                                                    {isPreRestoreBackup && backup.restoringTo && (
                                                        <div className="mt-2 text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-sm truncate">
                                                            복원 대상: {backup.restoringTo}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 버튼 영역 */}
                                                <div className="flex items-center gap-1 shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
                                                    {/* 이름 수정 버튼 */}
                                                    {isMaster && editingId !== backup.id && (
                                                        <button
                                                            onClick={() => { setEditingId(backup.id); setEditingName(backup.name || ''); }}
                                                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-sm transition-colors"
                                                            title="이름 수정"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                    )}
                                                    {/* 삭제 버튼 */}
                                                    {isMaster && (
                                                        <button
                                                            onClick={() => handleDelete(backup)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                                                            title="백업 삭제"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Section 2: 선택한 백업 정보 */}
                            {selectedBackup && (
                                <div className="bg-white border border-gray-200 overflow-hidden">
                                    <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                        <Database className="w-3 h-3 text-primary" />
                                        <h3 className="text-primary font-bold text-xs">선택한 백업 정보</h3>
                                    </div>
                                    <div className="p-3 space-y-2">
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500 shrink-0">백업 시점:</span>
                                                <span className="font-medium text-gray-800 truncate">{formatDate(selectedBackup.createdAt)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500 shrink-0">생성자:</span>
                                                <span className="font-medium text-gray-800 truncate">{formatCreator(selectedBackup)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500 shrink-0">수업 수:</span>
                                                <span className="font-medium text-gray-800">{Object.keys(selectedBackup.data).length}개</span>
                                            </div>
                                            {selectedBackup.studentData && (
                                                <>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-500 shrink-0">학생 수:</span>
                                                        <span className="font-medium text-gray-800">{getStudentCount(selectedBackup)}명</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Section 3: 미리보기 */}
                            {selectedBackup && (
                                <div className="bg-white border border-gray-200 overflow-hidden">
                                    <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                        <Eye className="w-3 h-3 text-primary" />
                                        <h3 className="text-primary font-bold text-xs">미리보기</h3>
                                    </div>
                                    <div className="p-3">
                                        <div className="bg-gray-50 border border-gray-200 rounded-sm p-3 max-h-48 overflow-y-auto">
                                            <div className="space-y-1.5">
                                                <div className="text-xs font-bold text-gray-700 mb-2">수업 데이터 ({Object.keys(selectedBackup.data).length}개)</div>
                                                {Object.keys(selectedBackup.data).slice(0, 10).map((key) => (
                                                    <div key={key} className="text-xs text-gray-600 font-mono truncate">
                                                        {key}
                                                    </div>
                                                ))}
                                                {Object.keys(selectedBackup.data).length > 10 && (
                                                    <div className="text-xs text-gray-400 italic">
                                                        ... 외 {Object.keys(selectedBackup.data).length - 10}개
                                                    </div>
                                                )}
                                                {selectedBackup.studentData && (
                                                    <>
                                                        <div className="text-xs font-bold text-gray-700 mt-3 mb-2">학생 데이터 ({Object.keys(selectedBackup.studentData).length}개)</div>
                                                        {Object.keys(selectedBackup.studentData).slice(0, 5).map((key) => (
                                                            <div key={key} className="text-xs text-gray-600 font-mono truncate">
                                                                {key}
                                                            </div>
                                                        ))}
                                                        {Object.keys(selectedBackup.studentData).length > 5 && (
                                                            <div className="text-xs text-gray-400 italic">
                                                                ... 외 {Object.keys(selectedBackup.studentData).length - 5}개
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Section 4: 작업 */}
                            {selectedBackup && (
                                <div className="bg-white border border-gray-200 overflow-hidden">
                                    <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                        <RotateCcw className="w-3 h-3 text-primary" />
                                        <h3 className="text-primary font-bold text-xs">작업</h3>
                                    </div>
                                    <div className="p-3">
                                        <div className="flex items-center gap-2">
                                            {/* 복원 버튼 */}
                                            {canRestore && (
                                                <button
                                                    onClick={() => handleRestore(selectedBackup)}
                                                    disabled={restoring === selectedBackup.id || !validateBackupData(selectedBackup).isValid}
                                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-sm text-sm font-medium transition-colors ${
                                                        restoring === selectedBackup.id
                                                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                            : !validateBackupData(selectedBackup).isValid
                                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                                    }`}
                                                    title={!validateBackupData(selectedBackup).isValid ? '손상된 백업은 복원할 수 없습니다' : '이 백업으로 복원'}
                                                >
                                                    <RotateCcw size={14} className={restoring === selectedBackup.id ? 'animate-spin' : ''} />
                                                    {restoring === selectedBackup.id ? '복원 중...' : '이 백업으로 복원'}
                                                </button>
                                            )}
                                            {/* 삭제 버튼 */}
                                            {isMaster && (
                                                <button
                                                    onClick={() => handleDelete(selectedBackup)}
                                                    className="flex items-center gap-1.5 px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-sm text-sm font-medium transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                    삭제
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t bg-gray-50 rounded-b-xl">
                    <p className="text-xs text-gray-500 text-center">
                        백업은 "실제 반영" 버튼 클릭 시 자동으로 생성됩니다. 복원 시 현재 상태가 자동 백업되며, 백업 시점 상태로 완전히 되돌아갑니다.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BackupHistoryModal;
