import React, { useState } from 'react';
import { X, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, AlertTriangle, Loader } from 'lucide-react';
import { collection, getDocs, writeBatch, doc, query, where, collectionGroup } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../../../firebaseConfig';
import { CLASS_COLLECTION } from './englishUtils';

interface LevelUpConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    oldClassName: string;
    newClassName: string;
    type: 'number' | 'class';
    direction?: 'up' | 'down';  // 레벨업 또는 레벨다운
    isSimulationMode?: boolean;
    onSimulationLevelUp?: (oldName: string, newName: string) => boolean;
}

const LevelUpConfirmModal: React.FC<LevelUpConfirmModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    oldClassName,
    newClassName,
    type,
    direction = 'up',  // 기본값은 레벨업
    isSimulationMode = false,
    onSimulationLevelUp,
}) => {
    const isLevelDown = direction === 'down';
    const queryClient = useQueryClient();
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [updateCount, setUpdateCount] = useState<number | null>(null);

    const handleConfirm = async () => {
        setIsProcessing(true);
        setError(null);

        try {
            // 시뮬레이션 모드: 메모리 상태만 변경 (Firebase 미사용)
            if (isSimulationMode && onSimulationLevelUp) {
                console.log('[LevelUp-Simulation] Renaming:', oldClassName, '→', newClassName);
                const success = onSimulationLevelUp(oldClassName, newClassName);

                if (!success) {
                    // 충돌 등으로 실패 시 (alert는 renameScenarioClass에서 이미 표시됨)
                    setIsProcessing(false);
                    return;
                }

                setUpdateCount(1);
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 1500);
                return;
            }

            console.log('[LevelUp] Starting:', oldClassName, '→', newClassName);
            const batch = writeBatch(db);

            // 1. Update classes 컬렉션 (시간표 데이터)
            const classesRef = collection(db, CLASS_COLLECTION);
            const classesSnapshot = await getDocs(classesRef);
            let classesCount = 0;

            classesSnapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                if (data.className === oldClassName && data.subject === 'english') {
                    console.log('[LevelUp] Classes collection match:', docSnap.id);
                    batch.update(doc(db, CLASS_COLLECTION, docSnap.id), { className: newClassName });
                    classesCount++;
                }
            });

            // 2-2. Update student enrollments (className 필드)
            const enrollmentsQuery = query(
                collectionGroup(db, 'enrollments'),
                where('className', '==', oldClassName),
                where('subject', '==', 'english')
            );
            const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
            let enrollmentsCount = 0;

            enrollmentsSnapshot.docs.forEach(docSnap => {
                console.log('[LevelUp] Enrollment match:', docSnap.ref.path);
                batch.update(docSnap.ref, { className: newClassName });
                enrollmentsCount++;
            });

            console.log('[LevelUp] Classes updated:', classesCount, 'Enrollments updated:', enrollmentsCount);

            // customGroups는 classId 기반이므로 레벨업 시 settings 업데이트 불필요

            const totalUpdates = classesCount + enrollmentsCount;
            console.log('[LevelUp] Total updates:', { classesCount, enrollmentsCount });

            if (totalUpdates === 0) {
                setError('업데이트할 데이터가 없습니다.');
                setIsProcessing(false);
                return;
            }

            await batch.commit();
            console.log('[LevelUp] Batch commit successful');
            setUpdateCount(totalUpdates);

            // React Query 캐시 무효화 - 시간표 및 학생 관리에 즉시 반영
            queryClient.invalidateQueries({ queryKey: ['englishClassStudents'] });
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['classes'] });
            console.log('[LevelUp] Cache invalidated');

            // Wait to show success message
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 2000);

        } catch (err) {
            console.error('Level up failed:', err);
            setError('레벨업 처리 중 오류가 발생했습니다.');
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-start justify-center pt-[8vh]" onClick={onClose}>
            <div className="bg-white rounded-sm shadow-2xl w-[400px] max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={`flex justify-between items-center px-5 py-4 ${
                    isLevelDown
                        ? (type === 'number' ? 'bg-blue-600' : 'bg-red-500')
                        : (type === 'number' ? 'bg-indigo-600' : 'bg-orange-500')
                } text-white`}>
                    <div className="flex items-center gap-2">
                        {isLevelDown
                            ? (type === 'number' ? <TrendingDown size={20} /> : <ArrowDownCircle size={20} />)
                            : (type === 'number' ? <TrendingUp size={20} /> : <ArrowUpCircle size={20} />)
                        }
                        <h2 className="text-lg font-bold">
                            {isLevelDown
                                ? (type === 'number' ? '숫자 레벨다운' : '클래스 레벨다운')
                                : (type === 'number' ? '숫자 레벨업' : '클래스 레벨업')
                            }
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-1 rounded-sm hover:bg-white/20">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Preview */}
                    <div className="flex items-center justify-center gap-4 mb-6">
                        <div className="px-4 py-3 bg-gray-100 rounded-sm text-center">
                            <div className="text-xs text-gray-500 mb-1">현재</div>
                            <div className="text-xl font-bold text-gray-700">{oldClassName}</div>
                        </div>
                        <div className="text-2xl text-gray-400">→</div>
                        <div className={`px-4 py-3 rounded-sm text-center ${
                            isLevelDown
                                ? (type === 'number' ? 'bg-blue-50' : 'bg-red-50')
                                : (type === 'number' ? 'bg-indigo-50' : 'bg-orange-50')
                        }`}>
                            <div className="text-xs text-gray-500 mb-1">변경</div>
                            <div className={`text-xl font-bold ${
                                isLevelDown
                                    ? (type === 'number' ? 'text-blue-700' : 'text-red-700')
                                    : (type === 'number' ? 'text-indigo-700' : 'text-orange-700')
                            }`}>{newClassName}</div>
                        </div>
                    </div>

                    {/* Warning */}
                    <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-sm mb-6">
                        <AlertTriangle size={18} className="text-yellow-600 shrink-0 mt-0.5" />
                        <div className="text-xs text-yellow-800">
                            <p className="font-bold mb-1">주의사항</p>
                            <p>모든 시간표 데이터에서 <strong>{oldClassName}</strong>이(가) <strong>{newClassName}</strong>(으)로 변경됩니다.</p>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-sm mb-4 text-xs text-red-600">
                            {error}
                        </div>
                    )}

                    {/* Success */}
                    {updateCount !== null && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-sm mb-4 text-xs text-green-600">
                            ✅ 레벨업 완료! ({updateCount}개 항목 업데이트)
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-4 bg-gray-50 border-t">
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-sm transition-colors disabled:opacity-50"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isProcessing || updateCount !== null}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-sm transition-colors disabled:opacity-50 ${type === 'number' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-orange-500 hover:bg-orange-600'}`}
                    >
                        {isProcessing ? (
                            <>
                                <Loader size={14} className="animate-spin" />
                                처리 중...
                            </>
                        ) : updateCount !== null ? (
                            '완료!'
                        ) : (
                            '레벨업 실행'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LevelUpConfirmModal;
