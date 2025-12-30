import React, { useState } from 'react';
import { X, TrendingUp, ArrowUpCircle, AlertTriangle, Loader } from 'lucide-react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { EN_COLLECTION } from './englishUtils';

interface LevelUpConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    oldClassName: string;
    newClassName: string;
    type: 'number' | 'class';
}

const LevelUpConfirmModal: React.FC<LevelUpConfirmModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    oldClassName,
    newClassName,
    type
}) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [updateCount, setUpdateCount] = useState<number | null>(null);

    const handleConfirm = async () => {
        setIsProcessing(true);
        setError(null);

        try {
            // Fetch all schedule documents
            const schedulesRef = collection(db, EN_COLLECTION);
            const snapshot = await getDocs(schedulesRef);

            const batch = writeBatch(db);
            let count = 0;

            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                let hasUpdate = false;
                const updates: Record<string, any> = {};

                Object.entries(data).forEach(([key, cell]) => {
                    if (typeof cell === 'object' && cell !== null && (cell as any).className === oldClassName) {
                        updates[key] = { ...cell, className: newClassName };
                        count++;
                        hasUpdate = true;
                    }
                });

                if (hasUpdate) {
                    batch.update(doc(db, EN_COLLECTION, docSnap.id), updates);
                }
            });

            if (count === 0) {
                setError('업데이트할 시간표 데이터가 없습니다.');
                setIsProcessing(false);
                return;
            }

            await batch.commit();
            setUpdateCount(count);

            // Wait a moment then close
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1500);

        } catch (err) {
            console.error('Level up failed:', err);
            setError('레벨업 처리 중 오류가 발생했습니다.');
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-[400px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={`flex justify-between items-center px-5 py-4 ${type === 'number' ? 'bg-indigo-600' : 'bg-orange-500'} text-white`}>
                    <div className="flex items-center gap-2">
                        {type === 'number' ? <TrendingUp size={20} /> : <ArrowUpCircle size={20} />}
                        <h2 className="text-lg font-bold">
                            {type === 'number' ? '숫자 레벨업' : '클래스 레벨업'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Preview */}
                    <div className="flex items-center justify-center gap-4 mb-6">
                        <div className="px-4 py-3 bg-gray-100 rounded-lg text-center">
                            <div className="text-xs text-gray-500 mb-1">현재</div>
                            <div className="text-xl font-bold text-gray-700">{oldClassName}</div>
                        </div>
                        <div className="text-2xl text-gray-400">→</div>
                        <div className={`px-4 py-3 rounded-lg text-center ${type === 'number' ? 'bg-indigo-50' : 'bg-orange-50'}`}>
                            <div className="text-xs text-gray-500 mb-1">변경</div>
                            <div className={`text-xl font-bold ${type === 'number' ? 'text-indigo-700' : 'text-orange-700'}`}>{newClassName}</div>
                        </div>
                    </div>

                    {/* Warning */}
                    <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-6">
                        <AlertTriangle size={18} className="text-yellow-600 shrink-0 mt-0.5" />
                        <div className="text-xs text-yellow-800">
                            <p className="font-bold mb-1">주의사항</p>
                            <p>모든 시간표 데이터에서 <strong>{oldClassName}</strong>이(가) <strong>{newClassName}</strong>(으)로 변경됩니다.</p>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4 text-xs text-red-600">
                            {error}
                        </div>
                    )}

                    {/* Success */}
                    {updateCount !== null && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4 text-xs text-green-600">
                            ✅ {updateCount}개의 시간표 셀이 업데이트되었습니다!
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-4 bg-gray-50 border-t">
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isProcessing || updateCount !== null}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg transition-colors disabled:opacity-50 ${type === 'number' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-orange-500 hover:bg-orange-600'}`}
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
