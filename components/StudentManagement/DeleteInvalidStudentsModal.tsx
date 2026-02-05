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
    Wrench,
    BarChart3,
    FileText
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
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[8vh] bg-black/50">
            <div className="bg-white rounded-sm shadow-2xl w-[90%] max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
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
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-sm">
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
                        <div className="space-y-2">
                            {/* Section 1: 통계 요약 */}
                            <div className="bg-white border border-gray-200 overflow-hidden">
                                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                    <BarChart3 className="w-3 h-3 text-primary" />
                                    <h3 className="text-primary font-bold text-xs">통계 요약</h3>
                                </div>
                                <div className="p-2">
                                    <div className="grid grid-cols-4 gap-2">
                                        <div className="bg-emerald-50 p-2 rounded-sm border border-emerald-200">
                                            <div className="text-xxs text-emerald-700 mb-0.5">정상</div>
                                            <div className="text-lg font-bold text-emerald-700">{validCount}</div>
                                        </div>
                                        <div className="bg-blue-50 p-2 rounded-sm border border-blue-200">
                                            <div className="text-xxs text-blue-700 mb-0.5">수정</div>
                                            <div className="text-lg font-bold text-blue-700">{fixableCount}</div>
                                        </div>
                                        <div className="bg-red-50 p-2 rounded-sm border border-red-200">
                                            <div className="text-xxs text-red-700 mb-0.5">랜덤</div>
                                            <div className="text-lg font-bold text-red-700">{randomCount}</div>
                                        </div>
                                        <div className="bg-amber-50 p-2 rounded-sm border border-amber-200">
                                            <div className="text-xxs text-amber-700 mb-0.5">숫자</div>
                                            <div className="text-lg font-bold text-amber-700">{numericCount}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: 삭제 대상 */}
                            {toDelete.length > 0 && (
                                <div className="bg-white border border-gray-200 overflow-hidden">
                                    <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                        <Trash2 className="w-3 h-3 text-primary" />
                                        <h3 className="text-primary font-bold text-xs">삭제 대상</h3>
                                        <span className="text-xxs text-red-600 ml-1">({toDelete.length}개)</span>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {/* Warning Banner */}
                                        <div className="px-2 py-1.5 bg-red-50 flex items-start gap-1.5">
                                            <AlertTriangle className="w-3 h-3 text-red-600 shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="text-xs font-medium text-red-800">
                                                    {toDelete.length}개 문서가 영구 삭제됩니다
                                                </p>
                                                <p className="text-xxs text-red-700 mt-0.5">
                                                    이 작업은 되돌릴 수 없습니다!
                                                </p>
                                            </div>
                                        </div>

                                        {/* Sample List */}
                                        <div className="px-2 py-1.5">
                                            <p className="text-xxs text-gray-500 mb-1">샘플 (최대 10개)</p>
                                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                                {toDelete.slice(0, 10).map(s => (
                                                    <div key={s.id} className="flex items-center justify-between gap-2 px-1.5 py-1 bg-gray-50 rounded-sm">
                                                        <span className="text-xs text-gray-700 font-mono truncate flex-1">{s.id}</span>
                                                        <span className={`text-xxs px-1.5 py-0.5 rounded-sm shrink-0 ${
                                                            s.type === 'random'
                                                                ? 'bg-red-100 text-red-700'
                                                                : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                            {s.type === 'random' ? '랜덤/테스트' : '숫자'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            {toDelete.length > 10 && (
                                                <p className="text-xxs text-gray-500 mt-1">... 외 {toDelete.length - 10}개</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Section 3: 수정 대상 */}
                            {toFix.length > 0 && (
                                <div className="bg-white border border-gray-200 overflow-hidden">
                                    <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                        <Wrench className="w-3 h-3 text-primary" />
                                        <h3 className="text-primary font-bold text-xs">수정 대상</h3>
                                        <span className="text-xxs text-blue-600 ml-1">({toFix.length}개)</span>
                                    </div>
                                    <div className="px-2 py-1.5">
                                        <p className="text-xxs text-blue-600 mb-1.5">공백 제거하여 ID를 수정합니다</p>
                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                            {toFix.slice(0, 5).map(s => (
                                                <div key={s.id} className="px-1.5 py-1 bg-blue-50 rounded-sm">
                                                    <div className="flex items-center gap-1 text-xs">
                                                        <span className="text-blue-600 font-mono">{s.id}</span>
                                                        <span className="text-blue-400">→</span>
                                                        <span className="text-blue-900 font-bold font-mono">{s.fixedId}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {toFix.length > 5 && (
                                            <p className="text-xxs text-blue-600 mt-1">... 외 {toFix.length - 5}개</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Section 4: 유지 대상 */}
                            {validCount > 0 && (
                                <div className="bg-white border border-gray-200 overflow-hidden">
                                    <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                        <Check className="w-3 h-3 text-primary" />
                                        <h3 className="text-primary font-bold text-xs">유지 대상</h3>
                                        <span className="text-xxs text-emerald-600 ml-1">({validCount}개)</span>
                                    </div>
                                    <div className="px-2 py-1.5">
                                        <p className="text-xs text-gray-700">
                                            정상 형식의 학생 문서 <span className="font-bold text-emerald-600">{validCount}개</span>는 변경되지 않습니다.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="space-y-2">
                            {/* Section: 진행 상황 */}
                            <div className="bg-white border border-gray-200 overflow-hidden">
                                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                    <Loader2 className="w-3 h-3 text-primary animate-spin" />
                                    <h3 className="text-primary font-bold text-xs">진행 상황</h3>
                                </div>
                                <div className="p-4">
                                    <div className="text-center space-y-4">
                                        <Loader2 className="w-12 h-12 animate-spin text-red-600 mx-auto" />
                                        <h3 className="text-lg font-bold text-gray-900">처리 중...</h3>
                                        <div className="w-full bg-gray-200 rounded-sm h-2.5">
                                            <div
                                                className="bg-red-600 h-full transition-all rounded-sm"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        <p className="text-sm font-medium text-gray-600">{progress}%</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'done' && (
                        <div className="space-y-2">
                            {/* Section: 결과 요약 */}
                            <div className="bg-white border border-gray-200 overflow-hidden">
                                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                    <FileText className="w-3 h-3 text-primary" />
                                    <h3 className="text-primary font-bold text-xs">결과 요약</h3>
                                </div>
                                <div className="p-4">
                                    <div className="text-center space-y-4">
                                        <div className="w-16 h-16 bg-emerald-100 rounded-sm flex items-center justify-center mx-auto">
                                            <Check className="w-10 h-10 text-emerald-600" strokeWidth={3} />
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900">완료!</h3>
                                        <div className="flex gap-3 justify-center">
                                            {results.fixed > 0 && (
                                                <div className="bg-blue-50 px-3 py-2 rounded-sm border border-blue-200">
                                                    <span className="text-blue-700 font-bold text-sm">{results.fixed}개</span>
                                                    <span className="text-blue-600 text-xs ml-1">수정</span>
                                                </div>
                                            )}
                                            {results.deleted > 0 && (
                                                <div className="bg-red-50 px-3 py-2 rounded-sm border border-red-200">
                                                    <span className="text-red-700 font-bold text-sm">{results.deleted}개</span>
                                                    <span className="text-red-600 text-xs ml-1">삭제</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 푸터 */}
                <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
                    {step === 'preview' && (
                        <>
                            <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-sm">
                                취소
                            </button>
                            {(toDelete.length > 0 || toFix.length > 0) && (
                                <button
                                    onClick={handleProcess}
                                    className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-sm flex items-center gap-2 font-bold"
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
                            className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-sm"
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
