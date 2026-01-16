/**
 * 영어 수업 자동 배정 모달
 * - Excel 파일에서 이름 + 수업 컬럼을 읽어서 매칭
 * - [EiE] 접두사가 있는 영어 수업만 처리
 * - 수업 관리(classes)에 등록된 수업과 매칭하여 enrollment 생성
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    X,
    BookOpen,
    Check,
    Loader2,
    AlertCircle,
    Play,
    FileSpreadsheet,
    Upload,
    ChevronDown
} from 'lucide-react';
import {
    collection,
    doc,
    writeBatch,
    getDocs,
    getDoc,
    query,
    where,
    collectionGroup
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { read, utils } from 'xlsx';
import { DEFAULT_ENGLISH_LEVELS } from '../Timetable/English/englishUtils';
import { EnglishLevel } from '../../types';

interface EnglishClassAssignmentModalProps {
    onClose: () => void;
    onComplete?: () => void;
}

interface ExcelRow {
    이름: string;
    수업?: string;
    [key: string]: any;
}

interface ClassInfo {
    id: string;
    className: string;
    teacher: string;
    currentStudentCount?: number;
}

interface StudentInfo {
    id: string;
    name: string;
    existingEnglishClasses: string[]; // 이미 등록된 영어 수업 className 목록
}

interface AssignmentItem {
    studentId: string;
    studentName: string;
    excelClassName: string;      // Excel에서 추출한 원본 수업명
    matchedClassId: string;      // 매칭된 수업 ID
    matchedClassName: string;    // 매칭된 수업명
}

interface SkippedItem {
    studentName: string;
    className: string;
    reason: string;
}

interface UnmatchedItem {
    studentName: string;
    excelClassName: string;
}

const EnglishClassAssignmentModal: React.FC<EnglishClassAssignmentModalProps> = ({
    onClose,
    onComplete
}) => {
    const [step, setStep] = useState<'upload' | 'loading' | 'preview' | 'assigning' | 'done'>('upload');
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);

    const [existingClasses, setExistingClasses] = useState<ClassInfo[]>([]);
    const [studentsMap, setStudentsMap] = useState<Map<string, StudentInfo>>(new Map());
    const [englishLevels, setEnglishLevels] = useState<EnglishLevel[]>(DEFAULT_ENGLISH_LEVELS);

    const [assignmentItems, setAssignmentItems] = useState<AssignmentItem[]>([]);
    const [skippedItems, setSkippedItems] = useState<SkippedItem[]>([]);
    const [unmatchedItems, setUnmatchedItems] = useState<UnmatchedItem[]>([]);

    // 수동 매칭: excelClassName -> classId
    const [manualMappings, setManualMappings] = useState<Map<string, string>>(new Map());

    const fileInputRef = useRef<HTMLInputElement>(null);

    // 초기 로드: 수업 목록과 학생 목록
    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            // 0. 영어 레벨 설정 로드
            const levelsDoc = await getDoc(doc(db, 'settings', 'english_levels'));
            if (levelsDoc.exists()) {
                const data = levelsDoc.data();
                const levels = (data.levels || []).sort((a: EnglishLevel, b: EnglishLevel) =>
                    (a.order ?? 999) - (b.order ?? 999)
                );
                if (levels.length > 0) {
                    setEnglishLevels(levels);
                }
            }

            // 1. classes 컬렉션에서 영어 수업 조회
            const classesQuery = query(
                collection(db, 'classes'),
                where('subject', '==', 'english'),
                where('isActive', '==', true)
            );
            const classesSnapshot = await getDocs(classesQuery);

            const classes: ClassInfo[] = classesSnapshot.docs.map(docSnap => ({
                id: docSnap.id,
                className: docSnap.data().className,
                teacher: docSnap.data().teacher || '',
                currentStudentCount: 0
            }));

            // 2. 현재 수강 인원 카운트
            const enrollmentsQuery = query(
                collectionGroup(db, 'enrollments'),
                where('subject', '==', 'english')
            );
            const enrollmentsSnap = await getDocs(enrollmentsQuery);

            const counts = new Map<string, number>();
            enrollmentsSnap.forEach(docSnap => {
                const classId = docSnap.data().classId;
                if (classId) {
                    counts.set(classId, (counts.get(classId) || 0) + 1);
                }
            });

            classes.forEach(c => {
                c.currentStudentCount = counts.get(c.id) || 0;
            });

            setExistingClasses(classes);

            // 3. 학생 목록 로드 (이름 -> ID 매핑)
            const studentsSnapshot = await getDocs(collection(db, 'students'));
            const studentMap = new Map<string, StudentInfo>();

            for (const docSnap of studentsSnapshot.docs) {
                const data = docSnap.data();

                // 기존 영어 enrollment 조회
                const enrollmentsRef = collection(db, 'students', docSnap.id, 'enrollments');
                const existingEnrollments = await getDocs(enrollmentsRef);
                const englishClasses = existingEnrollments.docs
                    .filter(d => d.data().subject === 'english')
                    .map(d => d.data().className);

                studentMap.set(data.name, {
                    id: docSnap.id,
                    name: data.name,
                    existingEnglishClasses: englishClasses
                });
            }

            setStudentsMap(studentMap);

        } catch (err: any) {
            console.error('초기 데이터 로드 실패:', err);
            setError(err.message || '데이터 로드 중 오류가 발생했습니다.');
        }
    };

    // Excel 파일 업로드 처리
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setStep('loading');
        setError(null);

        try {
            // Excel 파싱
            const arrayBuffer = await file.arrayBuffer();
            const workbook = read(arrayBuffer, { cellDates: false });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data: ExcelRow[] = utils.sheet_to_json(sheet, { raw: false, defval: '' });

            if (data.length === 0) {
                throw new Error('Excel 파일에 데이터가 없습니다.');
            }

            // 매칭 계산
            calculateMatching(data);

            setStep('preview');

        } catch (err: any) {
            console.error('Excel 파싱 실패:', err);
            setError(err.message || 'Excel 파일 처리 중 오류가 발생했습니다.');
            setStep('upload');
        }

        // 파일 입력 초기화
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Excel 데이터에서 영어 수업 추출
    const extractEnglishClasses = (수업?: string): string[] => {
        if (!수업) return [];

        const classNames: string[] = [];
        const parts = 수업.split(',');

        parts.forEach(part => {
            const trimmed = part.trim();
            // [EiE] 접두사가 있는 수업만 추출
            const englishMatch = trimmed.match(/\[EiE\]\s*(.+)/);

            if (englishMatch) {
                let className = englishMatch[1].trim();
                // 교재 정보 제거
                if (className.includes('교재')) {
                    const idx = className.indexOf('교재');
                    className = className.substring(0, idx).trim();
                }
                if (className.length > 0) {
                    classNames.push(className);
                }
            }
        });

        return [...new Set(classNames)];
    };

    // 수업명 정규화 (매칭용)
    const normalize = (s: string) => (s || '').normalize('NFC').replace(/[\s\u200B\u00A0\uFEFF]+/g, '').toLowerCase();

    // 축약어 → 전체명 변환 (DP2 → Dr. Phonics 2, Dr.Phonics 2)
    const expandAbbreviation = (className: string): string[] => {
        const variations: string[] = [className];

        // 패턴: 축약어 + 숫자 (예: DP2, RTT3a)
        const match = className.match(/^([A-Z]+)(\d+)([a-z]?)$/i);
        if (match) {
            const [, abbr, num, suffix] = match;
            const upperAbbr = abbr.toUpperCase();

            // 레벨 설정에서 전체명 찾기
            const level = englishLevels.find(l => l.abbreviation.toUpperCase() === upperAbbr);
            if (level) {
                // "Dr. Phonics 2", "Dr.Phonics 2", "Dr Phonics 2" 등 변형 생성
                const fullName = level.fullName;
                variations.push(`${fullName} ${num}${suffix}`);
                variations.push(`${fullName}${num}${suffix}`);
                // 점과 공백 변형
                variations.push(`${fullName.replace(/\.\s*/g, '. ')} ${num}${suffix}`);
                variations.push(`${fullName.replace(/\.\s*/g, '.')} ${num}${suffix}`);
                variations.push(`${fullName.replace(/\./g, '')} ${num}${suffix}`);
            }
        }

        return variations;
    };

    // Excel 수업명에서 핵심 부분 추출 (강사명, 요일 등 제거)
    // 예: "중등E_초등 브릿지 C GINA 월목" → "중등E_초등 브릿지 C"
    // 예: "Dr.Phonics 2 YURI 월목 ..." → "Dr.Phonics 2"
    const extractCoreClassName = (excelClassName: string): string => {
        let core = excelClassName.trim();

        // 강사명 패턴 제거 (대문자 영어 이름: GINA, YURI, ALEX 등)
        core = core.replace(/\s+[A-Z]{2,}(?:\s|$).*$/i, '');

        // 요일 패턴 제거 (월화수목금토일 조합)
        core = core.replace(/\s+[월화수목금토일]+(?:\s|$).*$/g, '');

        // 시간 패턴 제거
        core = core.replace(/\s+\d{1,2}:\d{2}.*$/g, '');

        return core.trim();
    };

    // 수업 매칭 (개선된 로직)
    const findMatchingClass = (excelClassName: string, classes: ClassInfo[], manualMap: Map<string, string>): ClassInfo | null => {
        // 1. 수동 매칭 우선
        const manualClassId = manualMap.get(excelClassName);
        if (manualClassId) {
            return classes.find(c => c.id === manualClassId) || null;
        }

        // 2. 핵심 수업명 추출
        const coreExcelName = extractCoreClassName(excelClassName);
        const targetVariations = [
            normalize(excelClassName),
            normalize(coreExcelName),
            ...expandAbbreviation(excelClassName).map(normalize),
            ...expandAbbreviation(coreExcelName).map(normalize)
        ];

        // 3. 정확한 매칭 시도
        for (const cls of classes) {
            const dbName = normalize(cls.className);
            for (const target of targetVariations) {
                if (dbName === target) {
                    return cls;
                }
            }
        }

        // 4. 부분 일치 매칭 (DB 수업명이 Excel 수업명에 포함되는 경우)
        // 예: DB "중등E_초등 브릿지 C" ⊂ Excel "중등E_초등 브릿지 C GINA 월목"
        let bestMatch: ClassInfo | null = null;
        let maxScore = 0;

        for (const cls of classes) {
            const dbName = normalize(cls.className);
            if (dbName.length < 2) continue;

            for (const target of targetVariations) {
                // DB 수업명이 타겟에 포함되거나, 타겟이 DB 수업명에 포함
                if (target.includes(dbName) || dbName.includes(target)) {
                    // 더 긴 매칭이 더 정확함
                    const matchLen = Math.min(dbName.length, target.length);
                    // 길이 비율도 고려 (정확할수록 높은 점수)
                    const ratio = matchLen / Math.max(dbName.length, target.length);
                    const score = matchLen * (1 + ratio);

                    if (score > maxScore) {
                        maxScore = score;
                        bestMatch = cls;
                    }
                }
            }
        }

        return bestMatch;
    };

    // 매칭 계산
    const calculateMatching = (excelData: ExcelRow[], customMappings?: Map<string, string>) => {
        const mappings = customMappings || manualMappings;
        const assignments: AssignmentItem[] = [];
        const skipped: SkippedItem[] = [];
        const unmatched: UnmatchedItem[] = [];

        for (const row of excelData) {
            const studentName = row.이름?.trim();
            if (!studentName) continue;

            // 학생 찾기
            const student = studentsMap.get(studentName);
            if (!student) {
                // 학생이 DB에 없음 - 스킵
                const englishClasses = extractEnglishClasses(row.수업);
                englishClasses.forEach(cls => {
                    skipped.push({
                        studentName,
                        className: cls,
                        reason: '학생 미등록'
                    });
                });
                continue;
            }

            // 영어 수업 추출
            const englishClasses = extractEnglishClasses(row.수업);

            for (const excelClassName of englishClasses) {
                // 이미 등록된 수업인지 확인
                const isAlreadyEnrolled = student.existingEnglishClasses.some(
                    existing => normalize(existing) === normalize(excelClassName)
                );

                if (isAlreadyEnrolled) {
                    skipped.push({
                        studentName,
                        className: excelClassName,
                        reason: '이미 등록됨'
                    });
                    continue;
                }

                // 수업 매칭
                const matchedClass = findMatchingClass(excelClassName, existingClasses, mappings);

                if (matchedClass) {
                    // 매칭된 수업으로도 이미 등록되어 있는지 확인
                    const isAlreadyEnrolledByMatch = student.existingEnglishClasses.some(
                        existing => normalize(existing) === normalize(matchedClass.className)
                    );

                    if (isAlreadyEnrolledByMatch) {
                        skipped.push({
                            studentName,
                            className: excelClassName,
                            reason: '이미 등록됨'
                        });
                        continue;
                    }

                    assignments.push({
                        studentId: student.id,
                        studentName,
                        excelClassName,
                        matchedClassId: matchedClass.id,
                        matchedClassName: matchedClass.className
                    });
                } else {
                    unmatched.push({
                        studentName,
                        excelClassName
                    });
                }
            }
        }

        setAssignmentItems(assignments);
        setSkippedItems(skipped);
        setUnmatchedItems(unmatched);
    };

    // 수동 매칭 변경 시 재계산 (Excel 데이터 다시 읽어야 함 - 현재 구조에서는 preview 상태에서만 변경)
    const handleManualMappingChange = (excelClassName: string, classId: string) => {
        const newMappings = new Map(manualMappings);
        if (classId) {
            newMappings.set(excelClassName, classId);
        } else {
            newMappings.delete(excelClassName);
        }
        setManualMappings(newMappings);

        // 매칭 재계산을 위해 unmatched 항목 업데이트
        const updatedUnmatched: UnmatchedItem[] = [];
        const updatedAssignments: AssignmentItem[] = [...assignmentItems];

        for (const item of unmatchedItems) {
            if (item.excelClassName === excelClassName && classId) {
                // 수동 매칭됨 - assignments로 이동
                const student = studentsMap.get(item.studentName);
                const matchedClass = existingClasses.find(c => c.id === classId);

                if (student && matchedClass) {
                    updatedAssignments.push({
                        studentId: student.id,
                        studentName: item.studentName,
                        excelClassName: item.excelClassName,
                        matchedClassId: matchedClass.id,
                        matchedClassName: matchedClass.className
                    });
                }
            } else {
                updatedUnmatched.push(item);
            }
        }

        setAssignmentItems(updatedAssignments);
        setUnmatchedItems(updatedUnmatched);
    };

    // 배정 실행
    const handleAssign = async () => {
        if (assignmentItems.length === 0) return;

        setStep('assigning');
        setProgress(0);

        try {
            const batchSize = 400;
            let processed = 0;

            for (let i = 0; i < assignmentItems.length; i += batchSize) {
                const batch = writeBatch(db);
                const batchItems = assignmentItems.slice(i, i + batchSize);

                for (const item of batchItems) {
                    const enrollmentId = `english_${item.matchedClassId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                    const enrollmentRef = doc(
                        db,
                        'students',
                        item.studentId,
                        'enrollments',
                        enrollmentId
                    );

                    batch.set(enrollmentRef, {
                        subject: 'english',
                        classId: item.matchedClassId,
                        className: item.matchedClassName,
                        teacherId: '',
                        days: [],
                        createdAt: new Date().toISOString(),
                        source: 'excel_import'
                    });

                    processed++;
                }

                await batch.commit();
                setProgress(Math.round((processed / assignmentItems.length) * 100));
            }

            setStep('done');

        } catch (err: any) {
            console.error('배정 중 오류:', err);
            setError(err.message || '배정 중 오류가 발생했습니다.');
            setStep('preview');
        }
    };

    // 매칭 안 된 고유 수업명 목록
    const getUniqueUnmatchedClasses = (): string[] => {
        const unique = new Set(unmatchedItems.map(item => item.excelClassName));
        return Array.from(unique).sort();
    };

    // 수업별 배정 통계
    const getClassStats = (): Map<string, number> => {
        const stats = new Map<string, number>();
        assignmentItems.forEach(item => {
            stats.set(item.matchedClassName, (stats.get(item.matchedClassName) || 0) + 1);
        });
        return stats;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* 헤더 */}
                <div className="bg-emerald-600 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <BookOpen size={20} />
                        영어 수업 자동 배정
                    </h2>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* 컨텐츠 */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* 에러 */}
                    {error && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-red-900">오류</p>
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* 1. 파일 업로드 */}
                    {step === 'upload' && (
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                                <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">원생목록 Excel 업로드</h3>
                                <p className="text-gray-600 text-sm mb-4">
                                    이름과 수업 컬럼이 포함된 Excel 파일을 업로드하세요.
                                </p>
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-left space-y-2 mb-6 max-w-md mx-auto">
                                    <p className="text-sm font-medium text-emerald-800">필수 컬럼:</p>
                                    <ul className="text-sm text-emerald-700 list-disc list-inside">
                                        <li><strong>이름</strong> - 학생 이름</li>
                                        <li><strong>수업</strong> - [EiE] 접두사가 있는 영어 수업</li>
                                    </ul>
                                </div>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 mx-auto"
                            >
                                <Upload size={20} />
                                Excel 파일 선택
                            </button>

                            {/* 수업 관리 현황 */}
                            {existingClasses.length > 0 && (
                                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                                    <p className="text-sm font-medium text-blue-800 mb-2">
                                        📚 수업 관리에 등록된 영어 수업: {existingClasses.length}개
                                    </p>
                                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                                        {existingClasses.map(c => (
                                            <span key={c.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                                {c.className} ({c.currentStudentCount})
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 2. 로딩 */}
                    {step === 'loading' && (
                        <div className="text-center py-12">
                            <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
                            <p className="text-gray-600">Excel 파일 분석 중...</p>
                        </div>
                    )}

                    {/* 3. 미리보기 */}
                    {step === 'preview' && (
                        <div className="space-y-4">
                            {/* 통계 */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                                    <div className="text-sm text-emerald-700 mb-1">배정 가능</div>
                                    <div className="text-2xl font-bold text-emerald-700">{assignmentItems.length}건</div>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <div className="text-sm text-gray-600 mb-1">건너뜀</div>
                                    <div className="text-2xl font-bold text-gray-600">{skippedItems.length}건</div>
                                </div>
                                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                                    <div className="text-sm text-amber-700 mb-1">매칭 필요</div>
                                    <div className="text-2xl font-bold text-amber-700">{getUniqueUnmatchedClasses().length}개 수업</div>
                                </div>
                            </div>

                            {/* 수동 매칭 UI */}
                            {getUniqueUnmatchedClasses().length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                    <p className="text-sm font-medium text-amber-800 mb-3">
                                        ⚠️ 매칭되지 않은 수업 ({getUniqueUnmatchedClasses().length}개)
                                    </p>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {getUniqueUnmatchedClasses().map(excelName => {
                                            const selectedClassId = manualMappings.get(excelName) || '';
                                            const studentCount = unmatchedItems.filter(i => i.excelClassName === excelName).length;

                                            return (
                                                <div key={excelName} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-amber-200">
                                                    <div className="flex-shrink-0 min-w-[150px]">
                                                        <span className="text-sm font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded">
                                                            {excelName}
                                                        </span>
                                                        <span className="text-xs text-gray-500 ml-2">({studentCount}명)</span>
                                                    </div>
                                                    <span className="text-gray-400">→</span>
                                                    <div className="flex-1 relative">
                                                        <select
                                                            value={selectedClassId}
                                                            onChange={(e) => handleManualMappingChange(excelName, e.target.value)}
                                                            className="w-full px-3 py-2 pr-8 text-sm rounded-lg border border-amber-300 bg-white appearance-none cursor-pointer"
                                                        >
                                                            <option value="">-- 수업 선택 --</option>
                                                            {existingClasses.map(c => (
                                                                <option key={c.id} value={c.id}>
                                                                    {c.className} {c.teacher && `(${c.teacher})`}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* 배정될 수업 통계 */}
                            {assignmentItems.length > 0 && (
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                    <p className="text-sm font-medium text-gray-700 mb-3">✅ 배정될 수업:</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Array.from(getClassStats().entries())
                                            .sort((a, b) => a[0].localeCompare(b[0]))
                                            .map(([className, count]) => (
                                                <div key={className} className="flex items-center justify-between text-sm">
                                                    <span className="text-gray-600">{className}</span>
                                                    <span className="font-medium text-emerald-600">{count}명</span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* 배정 샘플 */}
                            {assignmentItems.length > 0 && (
                                <div className="bg-white border border-gray-200 rounded-lg">
                                    <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                                        <p className="text-sm font-medium text-gray-700">
                                            👥 배정 대상 (샘플 10명)
                                        </p>
                                    </div>
                                    <div className="divide-y divide-gray-100 max-h-32 overflow-y-auto">
                                        {assignmentItems.slice(0, 10).map((item, idx) => (
                                            <div key={idx} className="px-4 py-2 flex items-center justify-between">
                                                <span className="text-sm text-gray-700">{item.studentName}</span>
                                                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                                    {item.matchedClassName}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 배정 불가 메시지 */}
                            {assignmentItems.length === 0 && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                                    <p className="text-yellow-800 font-medium">배정 가능한 항목이 없습니다.</p>
                                    <p className="text-yellow-700 text-sm mt-1">
                                        이미 모두 등록되어 있거나, 매칭되는 수업이 없습니다.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 4. 배정 중 */}
                    {step === 'assigning' && (
                        <div className="text-center py-8 space-y-6">
                            <Loader2 className="w-16 h-16 animate-spin text-emerald-600 mx-auto" />
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">배정 중...</h3>
                                <p className="text-gray-600 text-sm">잠시만 기다려주세요.</p>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                    className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-sm text-gray-600">{progress}%</p>
                        </div>
                    )}

                    {/* 5. 완료 */}
                    {step === 'done' && (
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                                <Check className="w-10 h-10 text-emerald-600" strokeWidth={3} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-gray-900">완료!</h3>
                                <p className="text-gray-600 mt-2">
                                    <span className="text-emerald-600 font-bold">{assignmentItems.length}</span>건 배정 완료
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* 푸터 */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                    {step === 'upload' && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            취소
                        </button>
                    )}

                    {step === 'preview' && (
                        <>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                취소
                            </button>
                            {assignmentItems.length > 0 && (
                                <button
                                    onClick={handleAssign}
                                    className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2 font-bold"
                                >
                                    <Play size={16} />
                                    {assignmentItems.length}건 배정
                                </button>
                            )}
                        </>
                    )}

                    {step === 'done' && (
                        <button
                            onClick={() => {
                                onComplete?.();
                                onClose();
                            }}
                            className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors"
                        >
                            완료
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EnglishClassAssignmentModal;
