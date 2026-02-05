import React, { useState } from 'react';
import { X, Play, CheckCircle, AlertCircle, Loader2, Database, TrendingUp, FileText, Check } from 'lucide-react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const AttendanceMigrationModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const [isMigrating, setIsMigrating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [total, setTotal] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);
    const [errorCount, setErrorCount] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [updateCount, setUpdateCount] = useState(0);

    const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    const handleMigration = async () => {
        if (!window.confirm('데이터베이스 최적화 작업을 시작하시겠습니까?\n모든 학생의 수강 정보를 메인 문서로 통합합니다.')) return;

        setIsMigrating(true);
        setProgress(0);
        setLogs([]);
        setErrorCount(0);
        setIsComplete(false);
        setUpdateCount(0);

        try {
            addLog('학생 목록을 불러오는 중...');
            const studentsRef = collection(db, 'students');
            const studentsSnap = await getDocs(studentsRef);
            const students = studentsSnap.docs;

            setTotal(students.length);
            addLog(`총 ${students.length}명의 학생을 발견했습니다.`);

            let processed = 0;
            let updated = 0;

            // Chunking to avoid overwhelming browser
            const CHUNK_SIZE = 10;
            for (let i = 0; i < students.length; i += CHUNK_SIZE) {
                const chunk = students.slice(i, i + CHUNK_SIZE);

                await Promise.all(chunk.map(async (studentDoc) => {
                    try {
                        const studentId = studentDoc.id;
                        const enrollmentsRef = collection(db, 'students', studentId, 'enrollments');
                        const enrollmentsSnap = await getDocs(enrollmentsRef);

                        if (!enrollmentsSnap.empty) {
                            const enrollments = enrollmentsSnap.docs.map(d => ({
                                id: d.id,
                                ...d.data()
                            }));

                            await updateDoc(doc(db, 'students', studentId), {
                                enrollments: enrollments,
                                updatedAt: new Date().toISOString()
                            });
                            updated++;
                        } else {
                            // Ensure field exists as empty array if missing
                            await updateDoc(doc(db, 'students', studentId), {
                                enrollments: [],
                                updatedAt: new Date().toISOString()
                            });
                        }
                    } catch (err) {
                        console.error(err);
                        setErrorCount(prev => prev + 1);
                        addLog(`ERROR: ${studentDoc.id} 처리 실패`);
                    } finally {
                        processed++;
                        setProgress(processed);
                    }
                }));
            }

            setUpdateCount(updated);
            addLog('작업 완료!');
            addLog(`총 ${updated}명의 학생 데이터가 업데이트되었습니다.`);
            setIsComplete(true);
            alert(`최적화 완료! 페이지를 새로고침해주세요.`);

        } catch (e: any) {
            addLog(`치명적 오류 발생: ${e.message}`);
        } finally {
            setIsMigrating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center pt-[8vh]">
            <div className="bg-white rounded-sm shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                        <Database className="text-blue-500" size={18} />
                        데이터베이스 최적화
                    </h3>
                    <button onClick={onClose} disabled={isMigrating} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto space-y-2">
                    {/* Section 1: 마이그레이션 안내 (Before Migration) */}
                    {!isMigrating && progress === 0 && (
                        <div className="bg-white border border-gray-200 overflow-hidden">
                            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                <Database className="w-3 h-3 text-primary" />
                                <h3 className="text-primary font-bold text-xs">마이그레이션 안내</h3>
                            </div>
                            <div className="p-3">
                                <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-sm flex gap-2">
                                    <AlertCircle className="flex-shrink-0 mt-0.5" size={16} />
                                    <div className="space-y-2">
                                        <p className="font-bold">성능 개선 작업</p>
                                        <p className="opacity-90 leading-relaxed">
                                            학생 수강 정보를 메인 문서로 통합하여 로딩 속도를 획기적으로 개선합니다.
                                        </p>
                                        <div className="space-y-1 text-xxs opacity-80">
                                            <p>• 모든 학생의 enrollments 서브컬렉션을 메인 필드로 이동</p>
                                            <p>• 기존 데이터는 보존되며 안전하게 통합됩니다</p>
                                            <p>• 작업 중 창을 닫지 마세요</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Section 2: 작업 시작 (Before Migration) */}
                    {!isMigrating && progress === 0 && (
                        <div className="bg-white border border-gray-200 overflow-hidden">
                            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                <Play className="w-3 h-3 text-primary" />
                                <h3 className="text-primary font-bold text-xs">작업 시작</h3>
                            </div>
                            <div className="p-3 flex justify-center">
                                <button
                                    onClick={handleMigration}
                                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-sm font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 text-sm"
                                >
                                    <Play size={18} fill="currentColor" />
                                    최적화 시작
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Section 3: 진행 상황 (During Migration) */}
                    {progress > 0 && !isComplete && (
                        <div className="bg-white border border-gray-200 overflow-hidden">
                            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                <TrendingUp className="w-3 h-3 text-primary" />
                                <h3 className="text-primary font-bold text-xs">진행 상황</h3>
                            </div>
                            <div className="p-3 space-y-3">
                                <div className="flex justify-between text-xs font-bold text-gray-600">
                                    <span>진행률</span>
                                    <span className="text-blue-600">{Math.round((progress / total) * 100)}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-sm h-3 overflow-hidden">
                                    <div
                                        className="bg-blue-500 h-full rounded-sm transition-all duration-300 relative overflow-hidden"
                                        style={{ width: `${(progress / total) * 100}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/20 animate-[shimmer_1s_infinite] border-t border-white/20"></div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="animate-spin text-blue-500" size={14} />
                                        <span>처리 중...</span>
                                    </div>
                                    <span className="font-mono">{progress} / {total}</span>
                                </div>
                                {errorCount > 0 && (
                                    <div className="text-xs text-red-600 font-medium flex items-center gap-1">
                                        <AlertCircle size={14} />
                                        <span>오류 발생: {errorCount}건</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Section 4: 로그 (During Migration) */}
                    {logs.length > 0 && (
                        <div className="bg-white border border-gray-200 overflow-hidden">
                            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                <FileText className="w-3 h-3 text-primary" />
                                <h3 className="text-primary font-bold text-xs">로그</h3>
                            </div>
                            <div className="p-2">
                                <div className="bg-gray-900 rounded-sm p-3 h-48 overflow-y-auto font-mono text-xs text-green-400 space-y-1 shadow-inner">
                                    {logs.map((log, i) => (
                                        <div key={i} className={log.includes('ERROR') ? 'text-red-400 font-bold' : ''}>
                                            {log}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Section 5: 결과 요약 (After Migration) */}
                    {isComplete && (
                        <div className="bg-white border border-gray-200 overflow-hidden">
                            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                <Check className="w-3 h-3 text-primary" />
                                <h3 className="text-primary font-bold text-xs">결과 요약</h3>
                            </div>
                            <div className="p-3">
                                <div className="bg-green-50 text-green-800 p-3 rounded-sm space-y-2">
                                    <div className="flex items-center gap-2 font-bold">
                                        <CheckCircle className="text-green-600" size={18} />
                                        <span>마이그레이션 완료</span>
                                    </div>
                                    <div className="text-xs space-y-1 opacity-90">
                                        <div className="flex justify-between">
                                            <span>전체 처리:</span>
                                            <span className="font-bold">{total}명</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>업데이트 완료:</span>
                                            <span className="font-bold text-green-600">{updateCount}명</span>
                                        </div>
                                        {errorCount > 0 && (
                                            <div className="flex justify-between text-red-600">
                                                <span>오류 발생:</span>
                                                <span className="font-bold">{errorCount}건</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="pt-2 border-t border-green-200 text-xs">
                                        <p className="font-medium">✓ 페이지를 새로고침하여 변경사항을 확인하세요</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AttendanceMigrationModal;
