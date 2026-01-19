import React, { useState } from 'react';
import { X, Play, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
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

    const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    const handleMigration = async () => {
        if (!window.confirm('데이터베이스 최적화 작업을 시작하시겠습니까?\n모든 학생의 수강 정보를 메인 문서로 통합합니다.')) return;

        setIsMigrating(true);
        setProgress(0);
        setLogs([]);
        setErrorCount(0);

        try {
            addLog('학생 목록을 불러오는 중...');
            const studentsRef = collection(db, 'students');
            const studentsSnap = await getDocs(studentsRef);
            const students = studentsSnap.docs;

            setTotal(students.length);
            addLog(`총 ${students.length}명의 학생을 발견했습니다.`);

            let processed = 0;
            let updated = 0;

            // Batch processing (limit 500 per batch, but we do one by one for safety/subcol reads first)
            // Actually we update one by one to avoid complexity with subcol reads mixed with batch writes

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
                            // addLog(`${studentDoc.data().name}: ${enrollments.length}개 수강 정보 통합 완료`);
                        } else {
                            // If no subcollection, simpler update or skip? 
                            // Best to ensure field exists as empty array if missing, to prevent future fetches
                            await updateDoc(doc(db, 'students', studentId), {
                                enrollments: [], // Mark as migrated (empty)
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

            addLog('작업 완료!');
            addLog(`총 ${updated}명의 학생 데이터가 업데이트되었습니다.`);
            alert(`최적화 완료! 페이지를 새로고침해주세요.`);

        } catch (e: any) {
            addLog(`치명적 오류 발생: ${e.message}`);
        } finally {
            setIsMigrating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
                    <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                        <Loader2 className={`text-blue-500 ${isMigrating ? 'animate-spin' : ''}`} />
                        데이터베이스 최적화
                    </h3>
                    <button onClick={onClose} disabled={isMigrating} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg mb-6 flex gap-3">
                        <AlertCircle className="flex-shrink-0 mt-0.5" size={16} />
                        <div>
                            <p className="font-bold mb-1">성능 개선 작업</p>
                            <p className="opacity-90 leading-relaxed">
                                학생 수강 정보를 메인 문서로 통합하여 로딩 속도를 획기적으로 개선합니다.
                                작업 중 창을 닫지 마세요.
                            </p>
                        </div>
                    </div>

                    {!isMigrating && progress === 0 && (
                        <div className="flex justify-center mb-4">
                            <button
                                onClick={handleMigration}
                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
                            >
                                <Play size={18} fill="currentColor" />
                                최적화 시작
                            </button>
                        </div>
                    )}

                    {progress > 0 && (
                        <div className="space-y-4">
                            <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                                <span>진행률</span>
                                <span>{Math.round((progress / total) * 100)}% ({progress}/{total})</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                <div
                                    className="bg-blue-500 h-full rounded-full transition-all duration-300 relative overflow-hidden"
                                    style={{ width: `${(progress / total) * 100}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/20 animate-[shimmer_1s_infinite] border-t border-white/20"></div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 bg-gray-900 rounded-lg p-4 h-48 overflow-y-auto font-mono text-xs text-green-400 space-y-1 shadow-inner">
                        {logs.length === 0 ? <span className="text-gray-600 text-center block mt-16">- 대기 중 -</span> : logs.map((log, i) => <div key={i}>{log}</div>)}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default AttendanceMigrationModal;
