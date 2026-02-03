/**
 * 수업 매칭 진단 모달 (매칭 상세 정보 표시 강화)
 * - 모든 Enrollment 출력 (매칭 여부 관계없이)
 * - 매칭 성공 시 실제 Class 정보 표시
 * - 매칭 실패 시 원본 Enrollment 정보만 표시
 */

import React, { useState, useEffect } from 'react';
import {
    X,
    Search,
    Loader2,
    RefreshCw,
    Link2Off,
    Trash2,
    Info,
    CheckCircle2,
    User,
    BookOpen,
    ArrowRight,
    Stethoscope,
    AlertTriangle,
    Activity,
    Filter
} from 'lucide-react';
import { formatSchoolGrade } from '../../utils/studentUtils';
import {
    collection,
    getDocs,
    deleteDoc,
    doc,
    writeBatch,
    updateDoc,
    arrayRemove
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
// UnifiedClass 타입 정의가 types.ts에 있지만, 여기서 간단히 정의하거나 import
interface SimplifiedClass {
    id: string;
    className: string;
    teacher?: string;
    // 필요한 다른 필드들
}


interface EnrollmentDiagnosticModalProps {
    onClose: () => void;
}

interface EnrollmentDiagnosis {
    id: string; // enrollment ID
    // Firebase raw data
    rawClassId: string;
    rawClassName: string;
    rawSubject: string;

    // Diagnosis results
    isMatched: boolean;
    matchType?: 'ID' | 'NAME' | 'NONE';
    matchedClass?: SimplifiedClass; // 매칭된 실제 수업 정보
    _source?: string; // 데이터 출처 ('subcollection' | 'array_field')
    originalData?: any; // Array remove를 위한 원본 데이터
}

interface StudentDiagnosis {
    studentId: string;
    studentName: string;
    school: string;
    grade: string;
    enrollments: EnrollmentDiagnosis[];
}

const EnrollmentDiagnosticModal: React.FC<EnrollmentDiagnosticModalProps> = ({
    onClose
}) => {
    const [step, setStep] = useState<'loading' | 'results'>('loading');
    const [progress, setProgress] = useState(0);
    const [allStudents, setAllStudents] = useState<StudentDiagnosis[]>([]);
    const [totalClasses, setTotalClasses] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'has_issues' | 'no_enrollment' | 'fix_required'>('all');

    // 통계 계산
    const stats = React.useMemo(() => {
        let totalEnrollments = 0;
        let matchFailCount = 0;
        let fixRequiredCount = 0; // 복구 대상 카운트
        let missingCount = 0;

        allStudents.forEach(s => {
            if (!s.enrollments || s.enrollments.length === 0) {
                missingCount++;
            }
            s.enrollments?.forEach(e => {
                totalEnrollments++;
                if (!e.isMatched) matchFailCount++;
                // 복구 대상: 이름만 매칭되었거나, 소스가 배열인 경우
                if ((e.isMatched && e.matchType === 'NAME') || e._source === 'array_field') {
                    fixRequiredCount++;
                }
            });
        });

        return { totalEnrollments, matchFailCount, missingCount, fixRequiredCount };
    }, [allStudents]);

    // 필터링 로직
    const filteredStudents = allStudents.filter(student => {
        // 1. 검색어 필터
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery ||
            student.studentName.toLowerCase().includes(searchLower) ||
            student.school.toLowerCase().includes(searchLower) ||
            student.enrollments.some(e => e.rawClassName.toLowerCase().includes(searchLower));

        if (!matchesSearch) return false;

        // 2. 상태 필터 (옵션에 따라)
        if (filterType === 'no_enrollment') return student.enrollments.length === 0;
        if (filterType === 'has_issues') {
            return student.enrollments.some(e => !e.isMatched);
        }
        if (filterType === 'fix_required') {
            // 복구 대상이 하나라도 있는 학생만 표시
            return student.enrollments.some(e =>
                (e.isMatched && e.matchType === 'NAME') || e._source === 'array_field'
            );
        }

        return true;
    });

    const [deletingId, setDeletingId] = useState<string | null>(null);

    const runDiagnostic = async () => {
        setStep('loading');
        setProgress(0);
        setAllStudents([]);

        try {
            // 1. 모든 클래스 정보 가져오기
            const classesSnap = await getDocs(collection(db, 'classes'));
            const classesMap = new Map<string, SimplifiedClass>();
            const classNamesMap = new Map<string, SimplifiedClass>();

            classesSnap.docs.forEach(d => {
                const data = d.data();
                const cls: SimplifiedClass = {
                    id: d.id,
                    className: data.className,
                    teacher: data.teacher
                };
                classesMap.set(d.id, cls);
                if (data.className) {
                    classNamesMap.set(data.className, cls);
                }
            });
            setTotalClasses(classesSnap.size);

            // 2. 모든 학생 정보 가져오기
            const studentsSnap = await getDocs(collection(db, 'students'));
            const totalStudents = studentsSnap.size;
            let processedCount = 0;

            const studentsData: StudentDiagnosis[] = [];

            for (const studentDoc of studentsSnap.docs) {
                const sData = studentDoc.data();
                const enrollments: EnrollmentDiagnosis[] = [];

                // A. Subcollection 'enrollments' 가져오기
                const enrollmentsByIdRef = collection(db, `students/${studentDoc.id}/enrollments`);
                const enrollmentsSnap = await getDocs(enrollmentsByIdRef);

                enrollmentsSnap.docs.forEach(enDoc => {
                    const eData = enDoc.data();
                    const rawClassId = eData.classId || '';
                    const rawClassName = eData.className || '';

                    let isMatched = false;
                    let matchType: 'ID' | 'NAME' | 'NONE' = 'NONE';
                    let matchedClass: SimplifiedClass | undefined;

                    if (classesMap.has(rawClassId)) {
                        isMatched = true;
                        matchType = 'ID';
                        matchedClass = classesMap.get(rawClassId);
                    } else if (classNamesMap.has(rawClassName)) {
                        isMatched = true;
                        matchType = 'NAME';
                        matchedClass = classNamesMap.get(rawClassName);
                    }

                    enrollments.push({
                        id: enDoc.id,
                        rawClassId,
                        rawClassName,
                        rawSubject: eData.subject || '',
                        isMatched,
                        matchType,
                        matchedClass,
                        _source: 'subcollection'
                    });
                });

                // B. Array Field 'enrollments' (구버전) 처리
                if (Array.isArray(sData.enrollments)) {
                    sData.enrollments.forEach((eData: any, idx: number) => {
                        const rawClassId = eData.classId || '';
                        const rawClassName = eData.className || '';

                        let isMatched = false;
                        let matchType: 'ID' | 'NAME' | 'NONE' = 'NONE';
                        let matchedClass: SimplifiedClass | undefined;

                        if (classesMap.has(rawClassId)) {
                            isMatched = true;
                            matchType = 'ID';
                            matchedClass = classesMap.get(rawClassId);
                        } else if (classNamesMap.has(rawClassName)) {
                            isMatched = true;
                            matchType = 'NAME';
                            matchedClass = classNamesMap.get(rawClassName);
                        }

                        enrollments.push({
                            id: `array_${idx}_${Date.now()}`, // 임시 ID
                            rawClassId,
                            rawClassName,
                            rawSubject: eData.subject || '',
                            isMatched,
                            matchType,
                            matchedClass,
                            _source: 'array_field',
                            originalData: eData // 나중에 삭제하기 위해 원본 저장
                        });
                    });
                }

                studentsData.push({
                    studentId: studentDoc.id,
                    studentName: sData.name || '(이름없음)',
                    school: sData.school || '',
                    grade: sData.grade || '',
                    enrollments
                });

                processedCount++;
                if (processedCount % 5 === 0) {
                    setProgress(Math.round((processedCount / totalStudents) * 100));
                }
            }

            setAllStudents(studentsData);
            setStep('results');

        } catch (error) {
            console.error(error);
            alert('데이터 로드 중 오류가 발생했습니다.');
        }
    };

    const handleDelete = async (studentId: string, enrollmentId: string) => {
        if (!confirm('정말로 삭제하시겠습니까?')) return;
        setDeletingId(enrollmentId);
        try {
            // 서브컬렉션 문서는 삭제 가능하지만, Array Field의 경우 이 방식으로는 삭제 불가함.
            // 여기서는 서브컬렉션 삭제만 지원
            if (enrollmentId.startsWith('array_')) {
                alert('Array 형태의 데이터는 직접 삭제가 어렵습니다. 일괄 복구를 통해 변환 후 삭제하세요.');
                return;
            }
            await deleteDoc(doc(db, `students/${studentId}/enrollments`, enrollmentId));

            setAllStudents(prev => prev.map(s => {
                if (s.studentId !== studentId) return s;
                return {
                    ...s,
                    enrollments: s.enrollments.filter(e => e.id !== enrollmentId)
                };
            }));
        } catch (e) {
            console.error(e);
            alert('삭제 실패');
        } finally {
            setDeletingId(null);
        }
    };

    const handleFixAll = async () => {
        const fixTargets: { studentId: string; enroll: EnrollmentDiagnosis }[] = [];

        allStudents.forEach(s => {
            s.enrollments.forEach(e => {
                if ((e.isMatched && e.matchType === 'NAME') || e._source === 'array_field') {
                    fixTargets.push({ studentId: s.studentId, enroll: e });
                }
            });
        });

        if (fixTargets.length === 0) {
            alert('복구할 대상이 없습니다.');
            return;
        }

        if (!confirm(`총 ${fixTargets.length}건의 데이터(이름매칭 업데이트 및 배열변환)를 복구하시겠습니까?`)) return;

        try {
            setStep('loading');
            setProgress(0);

            const CHUNK_SIZE = 200;
            const chunks = [];
            for (let i = 0; i < fixTargets.length; i += CHUNK_SIZE) {
                chunks.push(fixTargets.slice(i, i + CHUNK_SIZE));
            }

            let processedCount = 0;

            for (const chunk of chunks) {
                const batch = writeBatch(db);

                for (const item of chunk) {
                    const { studentId, enroll } = item;

                    // ID가 array_ 로 시작하면 새로 생성, 아니면 기존 ID 사용
                    const newEnrollmentId = enroll.id.startsWith('array_')
                        ? `fixed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                        : enroll.id;

                    const enrollmentRef = doc(db, 'students', studentId, 'enrollments', newEnrollmentId);

                    const updateData: any = {
                        classId: enroll.matchedClass?.id || enroll.rawClassId,
                        className: enroll.matchedClass?.className || enroll.rawClassName,
                        subject: enroll.rawSubject,
                        updatedAt: new Date().toISOString(),
                        _migratedAt: new Date().toISOString(),
                        _fixType: enroll._source === 'array_field' ? 'format_migration' : 'id_update'
                    };

                    batch.set(enrollmentRef, updateData, { merge: true });

                    // Array field 인 경우 원본 배열에서 제거
                    if (enroll._source === 'array_field' && enroll.originalData) {
                        const studentRef = doc(db, 'students', studentId);
                        batch.update(studentRef, {
                            enrollments: arrayRemove(enroll.originalData)
                        });
                    }
                }

                await batch.commit();
                processedCount += chunk.length;
                setProgress(Math.round((processedCount / fixTargets.length) * 100));
            }

            alert('복구 및 이관이 완료되었습니다.');
            runDiagnostic(); // Reload

        } catch (err: any) {
            console.error(err);
            alert('복구 중 오류 발생: ' + err.message);
            setStep('results');
        }
    };

    useEffect(() => {
        runDiagnostic();
    }, []);

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[8vh] bg-black/50">
            <div className="bg-white rounded-sm shadow-2xl w-[95%] max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* 헤더 */}
                <div className="bg-[#081429] px-6 py-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Stethoscope size={20} className="text-[#fdb813]" />
                        전체 Enrollment 정밀 진단
                    </h2>
                    <div className="flex items-center gap-4">
                        <div className="text-xs text-gray-400 flex items-center gap-1">
                            <Info size={12} />
                            Project: <span className="font-mono text-[#fdb813]">{(db.app.options as any).projectId}</span>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* 로딩 화면 */}
                {step === 'loading' && (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <Loader2 className="w-12 h-12 animate-spin text-[#fdb813] mb-4" />
                        <p className="text-gray-600 mb-2">모든 학생의 데이터를 분석 중입니다...</p>
                        <div className="w-64 bg-gray-100 rounded-sm h-2 overflow-hidden">
                            <div className="bg-[#fdb813] h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-sm text-gray-400 mt-2">{progress}%</p>
                    </div>
                )}

                {/* 결과 화면 */}
                {step === 'results' && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* 섹션: 진단 결과 통계 */}
                        <div className="bg-white border-b">
                            <div className="px-6 py-3 border-b bg-gray-50">
                                <div className="flex items-center gap-2">
                                    <Activity size={16} className="text-gray-600" />
                                    <h3 className="font-bold text-sm text-gray-700">진단 결과 통계</h3>
                                </div>
                            </div>
                            <div className="px-6 py-4 grid grid-cols-5 gap-4">
                                <div className="bg-white p-3 rounded border shadow-sm">
                                    <div className="text-xs text-gray-500">총 학생</div>
                                    <div className="text-xl font-bold">{allStudents.length}</div>
                                </div>
                                <div className="bg-white p-3 rounded border shadow-sm">
                                    <div className="text-xs text-gray-500">총 Enrollment</div>
                                    <div className="text-xl font-bold text-blue-600">{stats.totalEnrollments}</div>
                                </div>
                                <div className={`p-3 rounded border shadow-sm ${stats.matchFailCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
                                    <div className="text-xs text-gray-500">매칭 실패</div>
                                    <div className={`text-xl font-bold ${stats.matchFailCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {stats.matchFailCount}
                                    </div>
                                </div>
                                <div className={`p-3 rounded border shadow-sm ${stats.fixRequiredCount > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white'}`}>
                                    <div className="text-xs text-gray-500">복구 필요 (Fix)</div>
                                    <div className={`text-xl font-bold ${stats.fixRequiredCount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                                        {stats.fixRequiredCount}
                                    </div>
                                </div>
                                <div className="flex items-center justify-center">
                                    <button
                                        onClick={handleFixAll}
                                        disabled={stats.fixRequiredCount === 0}
                                        className={`w-full h-full max-h-[70px] flex flex-col items-center justify-center rounded-sm border font-bold transition-all ${stats.fixRequiredCount > 0
                                            ? 'bg-orange-500 text-white hover:bg-orange-600 border-orange-600 shadow-md'
                                            : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                            }`}
                                    >
                                        <RefreshCw size={20} className={stats.fixRequiredCount > 0 ? "mb-1" : "mb-1 opacity-50"} />
                                        <span className="text-xs">일괄 복구 실행</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 섹션: 필터 및 검색 */}
                        <div className="bg-white border-b">
                            <div className="px-6 py-3 border-b bg-gray-50">
                                <div className="flex items-center gap-2">
                                    <Filter size={16} className="text-gray-600" />
                                    <h3 className="font-bold text-sm text-gray-700">필터 및 검색</h3>
                                </div>
                            </div>
                            <div className="px-6 py-3 flex gap-3 items-center">
                                <div className="flex bg-gray-100 p-1 rounded-sm">
                                    <button
                                        onClick={() => setFilterType('all')}
                                        className={`px-3 py-1.5 text-xs font-bold rounded ${filterType === 'all' ? 'bg-white shadow text-black' : 'text-gray-500'}`}
                                    >
                                        전체
                                    </button>
                                    <button
                                        onClick={() => setFilterType('has_issues')}
                                        className={`px-3 py-1.5 text-xs font-bold rounded ${filterType === 'has_issues' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}
                                    >
                                        문제 있음 ({stats.matchFailCount})
                                    </button>
                                    <button
                                        onClick={() => setFilterType('fix_required')}
                                        className={`px-3 py-1.5 text-xs font-bold rounded ${filterType === 'fix_required' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}
                                    >
                                        복구 필요 ({stats.fixRequiredCount})
                                    </button>
                                    <button
                                        onClick={() => setFilterType('no_enrollment')}
                                        className={`px-3 py-1.5 text-xs font-bold rounded ${filterType === 'no_enrollment' ? 'bg-white shadow text-gray-600' : 'text-gray-500'}`}
                                    >
                                        미수강 ({stats.missingCount})
                                    </button>
                                </div>
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="학생 이름, classID 검색..."
                                        className="w-full pl-9 pr-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
                                    />
                                </div>
                                <button onClick={runDiagnostic} className="p-2 hover:bg-gray-100 rounded-sm text-gray-600" title="새로고침">
                                    <RefreshCw size={18} />
                                </button>
                            </div>
                        </div>

                        {/* 섹션: 진단 상세 내역 */}
                        <div className="flex-1 flex flex-col overflow-hidden bg-white">
                            <div className="px-6 py-3 border-b bg-gray-50">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-gray-600" />
                                    <h3 className="font-bold text-sm text-gray-700">진단 상세 내역</h3>
                                    <span className="text-xs text-gray-500 ml-auto">
                                        {filteredStudents.length}명의 학생
                                    </span>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
                                <div className="space-y-4">
                                    {filteredStudents.map(student => {
                                        if (student.enrollments.length === 0 && filterType !== 'no_enrollment' && filterType !== 'all') return null;

                                        return (
                                            <div key={student.studentId} className="bg-white rounded-sm border shadow-sm overflow-hidden">
                                                <div className="bg-gray-50 px-4 py-2 flex items-center justify-between border-b">
                                                    <div className="flex items-center gap-2">
                                                        <User size={16} className="text-gray-500" />
                                                        <span className="font-bold text-gray-800">{student.studentName}</span>
                                                        <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                                                            {formatSchoolGrade(student.school, student.grade)}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-mono text-gray-400 select-all">{student.studentId}</span>
                                                </div>

                                                {student.enrollments.length === 0 ? (
                                                    <div className="p-4 text-center text-sm text-gray-400 italic bg-gray-50/50">
                                                        (Enrollment 없음)
                                                    </div>
                                                ) : (
                                                    <div className="divide-y">
                                                        {student.enrollments.map(enroll => (
                                                            <div key={enroll.id} className="p-3 grid grid-cols-[1fr_auto_1fr_auto] gap-4 hover:bg-gray-50 items-center">
                                                                {/* 왼쪽: Firebase Enrollment 정보 */}
                                                                <div className="flex flex-col">
                                                                    <div className="flex items-center gap-1 mb-0.5">
                                                                        <div className="text-xxs text-gray-400 uppercase">Enrollment Data</div>
                                                                        {enroll._source === 'array_field' && (
                                                                            <span className="text-micro px-1 py-0.5 bg-yellow-100 text-yellow-700 rounded border border-yellow-200 font-bold leading-none">
                                                                                Array Format
                                                                            </span>
                                                                        )}
                                                                        {enroll.isMatched && enroll.matchType === 'NAME' && (
                                                                            <span className="text-micro px-1 py-0.5 bg-blue-100 text-blue-700 rounded border border-blue-200 font-bold leading-none">
                                                                                ID Update Needed
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-sm font-medium text-gray-700">
                                                                        {enroll.rawClassName || '(이름없음)'}
                                                                    </div>
                                                                    <div className="text-xs text-gray-400 font-mono select-all" title={enroll.rawClassId}>
                                                                        ID: {enroll.rawClassId}
                                                                    </div>
                                                                </div>

                                                                {/* 화살표 & 매칭 상태 */}
                                                                <div className="flex flex-col items-center px-2">
                                                                    {enroll.isMatched ? (
                                                                        enroll.matchType === 'ID' ? (
                                                                            <div className="text-green-500 flex flex-col items-center">
                                                                                <CheckCircle2 size={18} />
                                                                                <span className="text-xxs font-bold mt-0.5">ID OK</span>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-blue-500 flex flex-col items-center">
                                                                                <CheckCircle2 size={18} />
                                                                                <span className="text-xxs font-bold mt-0.5">NAME OK</span>
                                                                            </div>
                                                                        )
                                                                    ) : (
                                                                        <div className="text-red-500 flex flex-col items-center">
                                                                            <Link2Off size={18} />
                                                                            <span className="text-xxs font-bold mt-0.5">FAIL</span>
                                                                        </div>
                                                                    )}
                                                                    <ArrowRight size={14} className="text-gray-300 mt-1" />
                                                                </div>

                                                                {/* 오른쪽: 매칭된 Class 정보 */}
                                                                <div className="flex flex-col">
                                                                    <div className="text-xxs text-gray-400 uppercase mb-0.5">Matched Class(DB)</div>
                                                                    {enroll.isMatched && enroll.matchedClass ? (
                                                                        <>
                                                                            <div className={`text-sm font-medium ${enroll.matchType === 'ID' ? 'text-green-700' : 'text-blue-700'}`}>
                                                                                {enroll.matchedClass.className}
                                                                            </div>
                                                                            <div className="text-xs text-gray-500 flex gap-1">
                                                                                <span>{enroll.matchedClass.teacher || '강사 미배정'}</span>
                                                                                <span className="text-gray-300">|</span>
                                                                                <span className="text-xs text-gray-400 font-mono select-all">
                                                                                    {enroll.matchedClass.id.slice(0, 6)}...
                                                                                </span>
                                                                            </div>
                                                                        </>
                                                                    ) : (
                                                                        <div className="text-sm text-red-400 italic">
                                                                            매칭된 수업 없음
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* 삭제 버튼 */}
                                                                <button
                                                                    onClick={() => handleDelete(student.studentId, enroll.id)}
                                                                    disabled={deletingId === enroll.id}
                                                                    className="text-gray-300 hover:text-red-500 p-2 hover:bg-red-50 rounded transition-colors ml-4"
                                                                    title="Enrollment 삭제"
                                                                >
                                                                    {deletingId === enroll.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnrollmentDiagnosticModal;
