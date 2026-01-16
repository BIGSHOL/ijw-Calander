/**
 * 잘못 생성된 학생 문서 정리 컴포넌트
 * - 랜덤 ID, 숫자 ID 형식의 잘못된 문서 삭제
 * - 공백이 포함된 ID는 자동 수정
 * - 정상 형식: 이름_학교_학년 (예: 강민승_달성초_3)
 */

import React, { useState, useEffect } from 'react';
import {
    X,
    Trash2,
    AlertTriangle,
    Loader2,
    Check,
    Wrench
} from 'lucide-react';
import {
    collection,
    doc,
    writeBatch,
    getDocs,
    getDoc,
    setDoc,
    deleteDoc
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';

interface DeleteInvalidStudentsModalProps {
    onClose: () => void;
    onComplete?: () => void;
}

interface StudentDoc {
    id: string;
    name: string;
    type: 'valid' | 'random' | 'numeric' | 'fixable';
    fixedId?: string; // 공백 제거된 ID
}

// 공백 제거하여 수정된 ID 생성
function getFixedId(id: string): string {
    return id.replace(/\s+/g, '');
}

// 정상 ID 패턴: 이름_학교_학년
function classifyStudentId(id: string): 'valid' | 'random' | 'numeric' | 'fixable' {
    // 숫자만으로 구성된 ID
    if (/^\d+$/.test(id)) {
        return 'numeric';
    }

    // 공백이 포함된 ID (수정 가능)
    if (id.includes(' ')) {
        // 공백 제거 후 정상 패턴인지 확인
        const fixed = getFixedId(id);
        if (/^[가-힣A-Za-z0-9]+_[가-힣]+_[가-힣]*\d+[가-힣]*$/.test(fixed)) {
            return 'fixable';
        }
        return 'random'; // 공백 제거해도 정상 패턴 아님
    }

    // (테스트) 포함된 ID는 삭제 대상
    if (id.includes('(테스트)') || id.includes('테스트')) {
        return 'random';
    }

    // 이름_학교_학년 패턴 (유치원 포함)
    if (/^[가-힣A-Za-z0-9]+_[가-힣]+_[가-힣]*\d+[가-힣]*$/.test(id)) {
        return 'valid';
    }

    // 그 외는 랜덤 ID
    return 'random';
}

const DeleteInvalidStudentsModal: React.FC<DeleteInvalidStudentsModalProps> = ({
    onClose,
    onComplete
}) => {
    const [step, setStep] = useState<'loading' | 'preview' | 'processing' | 'done'>('loading');
    const [students, setStudents] = useState<StudentDoc[]>([]);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState({ deleted: 0, fixed: 0 });

    const validCount = students.filter(s => s.type === 'valid').length;
    const randomCount = students.filter(s => s.type === 'random').length;
    const numericCount = students.filter(s => s.type === 'numeric').length;
    const fixableCount = students.filter(s => s.type === 'fixable').length;

    const toDelete = students.filter(s => s.type === 'random' || s.type === 'numeric');
    const toFix = students.filter(s => s.type === 'fixable');

    useEffect(() => {
        loadStudents();
    }, []);

    const loadStudents = async () => {
        try {
            setStep('loading');
            const snapshot = await getDocs(collection(db, 'students'));

            const docs: StudentDoc[] = snapshot.docs.map(docSnap => {
                const type = classifyStudentId(docSnap.id);
                return {
                    id: docSnap.id,
                    name: docSnap.data().name || '(이름없음)',
                    type,
                    fixedId: type === 'fixable' ? getFixedId(docSnap.id) : undefined
                };
            });

            setStudents(docs);
            setStep('preview');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleProcess = async () => {
        setStep('processing');
        setProgress(0);

        let deleted = 0;
        let fixed = 0;

        try {
            const totalTasks = toDelete.length + toFix.length;
            let completed = 0;

            // 1. 공백 ID 수정 (복사 후 삭제)
            for (const student of toFix) {
                if (!student.fixedId) continue;

                // 원본 문서 가져오기
                const oldDocRef = doc(db, 'students', student.id);
                const oldDocSnap = await getDoc(oldDocRef);

                if (oldDocSnap.exists()) {
                    const data = oldDocSnap.data();

                    // 새 ID로 문서 생성
                    const newDocRef = doc(db, 'students', student.fixedId);
                    await setDoc(newDocRef, { ...data, id: student.fixedId });

                    // 서브컬렉션 복사 (enrollments)
                    const enrollmentsSnap = await getDocs(collection(db, 'students', student.id, 'enrollments'));
                    for (const enrollDoc of enrollmentsSnap.docs) {
                        await setDoc(
                            doc(db, 'students', student.fixedId, 'enrollments', enrollDoc.id),
                            enrollDoc.data()
                        );
                    }

                    // 원본 삭제
                    for (const enrollDoc of enrollmentsSnap.docs) {
                        await deleteDoc(enrollDoc.ref);
                    }
                    await deleteDoc(oldDocRef);

                    fixed++;
                }

                completed++;
                setProgress(Math.round((completed / totalTasks) * 100));
            }

            // 2. 잘못된 문서 삭제
            const batchSize = 400;
            for (let i = 0; i < toDelete.length; i += batchSize) {
                const batch = writeBatch(db);
                const batchDocs = toDelete.slice(i, i + batchSize);

                for (const student of batchDocs) {
                    // 서브컬렉션 삭제
                    const enrollmentsRef = collection(db, 'students', student.id, 'enrollments');
                    const enrollments = await getDocs(enrollmentsRef);
                    enrollments.docs.forEach(e => batch.delete(e.ref));

                    // 학생 문서 삭제
                    batch.delete(doc(db, 'students', student.id));
                    deleted++;
                }

                await batch.commit();
                completed += batchDocs.length;
                setProgress(Math.round((completed / totalTasks) * 100));
            }

            setResults({ deleted, fixed });
            setStep('done');
        } catch (err: any) {
            setError(err.message);
            setStep('preview');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                {/* 헤더 */}
                <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Wrench size={20} />
                        학생 문서 정리
                    </h2>
                    <button onClick={onClose} className="text-white/70 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* 컨텐츠 */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    {step === 'loading' && (
                        <div className="text-center py-12">
                            <Loader2 className="w-12 h-12 animate-spin text-red-600 mx-auto mb-4" />
                            <p className="text-gray-600">학생 문서 분석 중...</p>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-4">
                            {/* 통계 */}
                            <div className="grid grid-cols-4 gap-3">
                                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                                    <div className="text-xs text-emerald-700 mb-1">정상</div>
                                    <div className="text-xl font-bold text-emerald-700">{validCount}</div>
                                </div>
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                    <div className="text-xs text-blue-700 mb-1">수정</div>
                                    <div className="text-xl font-bold text-blue-700">{fixableCount}</div>
                                </div>
                                <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                                    <div className="text-xs text-red-700 mb-1">삭제(랜덤)</div>
                                    <div className="text-xl font-bold text-red-700">{randomCount}</div>
                                </div>
                                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                                    <div className="text-xs text-amber-700 mb-1">삭제(숫자)</div>
                                    <div className="text-xl font-bold text-amber-700">{numericCount}</div>
                                </div>
                            </div>

                            {/* 수정될 문서 */}
                            {toFix.length > 0 && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <p className="text-sm font-medium text-blue-800 mb-2">
                                        🔧 공백 제거하여 수정될 문서 ({toFix.length}개)
                                    </p>
                                    <div className="space-y-1 max-h-24 overflow-y-auto">
                                        {toFix.slice(0, 5).map(s => (
                                            <div key={s.id} className="text-xs text-blue-700 font-mono">
                                                {s.id} → <span className="text-blue-900 font-bold">{s.fixedId}</span>
                                            </div>
                                        ))}
                                        {toFix.length > 5 && <p className="text-xs text-blue-600">... 외 {toFix.length - 5}개</p>}
                                    </div>
                                </div>
                            )}

                            {/* 경고 */}
                            {toDelete.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                                        <div>
                                            <p className="font-medium text-red-800">
                                                {toDelete.length}개 문서가 삭제됩니다
                                            </p>
                                            <p className="text-sm text-red-700 mt-1">
                                                이 작업은 되돌릴 수 없습니다!
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 삭제 대상 샘플 */}
                            {toDelete.length > 0 && (
                                <div className="bg-white border border-gray-200 rounded-lg">
                                    <div className="px-4 py-2 bg-gray-50 border-b">
                                        <p className="text-sm font-medium">삭제 대상 (샘플 10개)</p>
                                    </div>
                                    <div className="divide-y max-h-32 overflow-y-auto">
                                        {toDelete.slice(0, 10).map(s => (
                                            <div key={s.id} className="px-4 py-2 flex items-center justify-between">
                                                <span className="text-sm text-gray-600 font-mono truncate max-w-[200px]">{s.id}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded ${s.type === 'random' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {s.type === 'random' ? '랜덤/테스트' : '숫자'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="text-center py-8 space-y-6">
                            <Loader2 className="w-16 h-16 animate-spin text-red-600 mx-auto" />
                            <h3 className="text-xl font-bold text-gray-900">처리 중...</h3>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                    className="bg-red-600 h-full transition-all rounded-full"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-sm text-gray-600">{progress}%</p>
                        </div>
                    )}

                    {step === 'done' && (
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                                <Check className="w-10 h-10 text-emerald-600" strokeWidth={3} />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">완료!</h3>
                            <div className="flex gap-4 justify-center">
                                {results.fixed > 0 && (
                                    <div className="bg-blue-50 px-4 py-2 rounded-lg">
                                        <span className="text-blue-700 font-bold">{results.fixed}개</span>
                                        <span className="text-blue-600 text-sm ml-1">수정</span>
                                    </div>
                                )}
                                {results.deleted > 0 && (
                                    <div className="bg-red-50 px-4 py-2 rounded-lg">
                                        <span className="text-red-700 font-bold">{results.deleted}개</span>
                                        <span className="text-red-600 text-sm ml-1">삭제</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 푸터 */}
                <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
                    {step === 'preview' && (
                        <>
                            <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">
                                취소
                            </button>
                            {(toDelete.length > 0 || toFix.length > 0) && (
                                <button
                                    onClick={handleProcess}
                                    className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg flex items-center gap-2 font-bold"
                                >
                                    <Wrench size={16} />
                                    {toFix.length > 0 && `${toFix.length}개 수정`}
                                    {toFix.length > 0 && toDelete.length > 0 && ' + '}
                                    {toDelete.length > 0 && `${toDelete.length}개 삭제`}
                                </button>
                            )}
                        </>
                    )}
                    {step === 'done' && (
                        <button
                            onClick={() => { onComplete?.(); onClose(); }}
                            className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg"
                        >
                            완료
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DeleteInvalidStudentsModal;
