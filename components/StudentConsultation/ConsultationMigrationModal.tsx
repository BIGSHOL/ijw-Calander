import React, { useState, useEffect } from 'react';
import { read, utils } from 'xlsx';
import { X, Upload, Check, Loader2, Database, Plus, FileText, Users, UserPlus } from 'lucide-react';
import { useStudents } from '../../hooks/useStudents';
import { useStaff } from '../../hooks/useStaff';
import { StaffMember, UnifiedStudent } from '../../types';
import { collection, writeBatch, doc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

interface ParsedConsultation {
    no: number | string;
    studentName: string;
    parentPhone: string | number;
    studentPhone: string | number; // New
    schoolName: string;
    grade: string;
    counselor: string; // 담당선생님
    registrar: string; // 등록자 (Column K)
    consultationDate: string;
    notes: string;
    subject: string;
    status: string;
}

interface MigrationItem extends ParsedConsultation {
    matchStatus: 'READY' | 'NO_STUDENT' | 'NO_COUNSELOR' | 'ERROR' | 'AMBIGUOUS' | 'NEW_STUDENT';
    matchedStudent?: UnifiedStudent;
    matchedConsultant?: StaffMember;
    matchedHomeroom?: StaffMember; // 담임선생님 (enrollment 기반)
    generatedTitle?: string;
    generatedCategory?: string;
    isNewStudent?: boolean; // New flag for auto-creation
}

interface ConsultationMigrationModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

// Helper Functions for Excel Parsing
const mapGrade = (raw: any) => {
    if (!raw) return '기타';
    const normalized = String(raw).trim();
    const map: Record<string, string> = {
        '초1': '초1', '초2': '초2', '초3': '초3', '초4': '초4', '초5': '초5', '초6': '초6',
        '중1': '중1', '중2': '중2', '중3': '중3',
        '고1': '고1', '고2': '고2', '고3': '고3'
    };
    return map[normalized] || '기타';
};

const mapSubjectFromContent = (content: any) => {
    if (!content) return '기타';
    const text = String(content);

    // Priority: Brackets first, then specific phrases
    if (text.includes('[수학')) return '수학';
    if (text.includes('[영어')) return '영어';
    if (text.includes('수학 상담')) return '수학';
    if (text.includes('영어 상담')) return '영어';
    if (text.includes('EiE')) return '영어';

    // Scan body
    const hasMath = text.includes('수학');
    const hasEng = text.includes('영어');

    if (hasMath && !hasEng) return '수학';
    if (hasEng && !hasMath) return '영어';
    if (hasMath && hasEng) return '수학'; // Default prioritize Math

    return '기타';
};

const mapStatus = (statusCell: any) => {
    const status = String(statusCell || '').trim();
    if (status === '재원생') return '재원생';
    if (status.includes('대기')) return '대기';
    if (status.includes('퇴원')) return '퇴원';
    if (status.includes('미등록')) return '미등록';
    return status || '기타';
};

const parseExcelDate = (cellVal: any) => {
    if (!cellVal) return '';
    if (cellVal instanceof Date) return cellVal.toISOString().split('T')[0];
    const str = String(cellVal).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    return '';
};

const ConsultationMigrationModal: React.FC<ConsultationMigrationModalProps> = ({ onClose, onSuccess }) => {
    const { students, loading: studentsLoading } = useStudents(true);
    const { staff: staffMembers, loading: staffLoading } = useStaff();

    const [rawData, setRawData] = useState<ParsedConsultation[]>([]);
    const [migrationItems, setMigrationItems] = useState<MigrationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<'load' | 'preview' | 'migrating' | 'done'>('load');
    const [progress, setProgress] = useState(0);
    const [skippedCount, setSkippedCount] = useState(0); // 중복 스킵 카운트

    // 1. File Upload Handler (Excel & JSON Support)
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError(null);

        try {
            const isExcel = file.name.endsWith('.xls') || file.name.endsWith('.xlsx');

            if (isExcel) {
                const arrayBuffer = await file.arrayBuffer();
                const workbook = read(arrayBuffer, { cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = utils.sheet_to_json(sheet, { header: 'A' }) as any[];

                // Skip header if present (check A column)
                if (jsonData.length > 0 && jsonData[0]['A'] === 'No') {
                    jsonData.shift();
                }

                const records: ParsedConsultation[] = [];
                let currentRecord: any = null;

                jsonData.forEach((row, index) => {
                    const no = row['A'];

                    // New Record
                    if (no && !isNaN(parseInt(no))) {
                        if (currentRecord) records.push(currentRecord);

                        const rawContent = row['P'] || '';
                        // P열에서 불필요한 헤더 제거: "상담 내역", "상담 기록 항목:" 등
                        const content = rawContent
                            .replace(/^상담\s*내역\s*/gm, '')
                            .replace(/^상담\s*기록\s*항목\s*:\s*/gm, '')
                            .trim();
                        const subject = mapSubjectFromContent(content);
                        const statusStr = row['B'] ? String(row['B']) : '';
                        const dateStr = parseExcelDate(row['L']);

                        // O열에서 제목 읽기 (없으면 자동 생성)
                        const excelTitle = row['O'] ? String(row['O']).trim() : '';
                        let generatedTitle = excelTitle;
                        if (!generatedTitle) {
                            // O열이 비어있으면 기존 로직으로 제목 생성
                            generatedTitle = `상담 기록 (${dateStr})`;
                            if (content.length > 0) {
                                const firstLine = content.split('\n')[0];
                                if (firstLine.length < 30) generatedTitle = firstLine;
                                else generatedTitle = firstLine.substring(0, 30) + '...';
                            }
                        }

                        // Determine Category
                        let generatedCategory = 'general';
                        if (subject !== '기타') generatedCategory = 'progress';
                        if (statusStr.includes('등록')) generatedCategory = 'general';

                        // Build Notes
                        let noteContent = '';
                        // G is now a column
                        if (content) noteContent += content;

                        currentRecord = {
                            no: no,
                            studentName: row['C'] || '',
                            parentPhone: row['F'] || '',
                            studentPhone: row['G'] || '',
                            schoolName: row['D'] || '',
                            grade: mapGrade(row['E']),
                            counselor: '', // Empty
                            registrar: row['K'] || '',
                            consultationDate: dateStr,
                            notes: noteContent.trim(),
                            subject: subject,
                            status: mapStatus(statusStr),
                            generatedTitle,
                            generatedCategory
                        };
                    } else if (currentRecord) {
                        // Append multi-line content (불필요한 헤더 제거)
                        if (row['P']) {
                            const additionalContent = String(row['P'])
                                .replace(/^상담\s*내역\s*/gm, '')
                                .replace(/^상담\s*기록\s*항목\s*:\s*/gm, '')
                                .trim();
                            if (additionalContent) {
                                currentRecord.notes += '\n' + additionalContent;
                            }
                        }
                    }
                });

                if (currentRecord) records.push(currentRecord);

                const validRecords = records.filter(r => r.studentName && r.studentName !== '이름');
                setRawData(validRecords);
                setStep('preview');

            } else {
                // Legacy JSON support
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const json = JSON.parse(e.target?.result as string);
                        setRawData(json);
                        setStep('preview');
                    } catch (err) {
                        console.error(err);
                        setError('파일 형식이 올바르지 않습니다.');
                    }
                };
                reader.readAsText(file);
            }

        } catch (err) {
            console.error(err);
            setError('데이터 파싱 중 오류가 발생했습니다: ' + (err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    // Remove automatic loading effect since we use upload now
    useEffect(() => {
        // Only set step to load initially
        if (step === 'load' && rawData.length > 0) {
            // If we somehow have data, move to preview
            setStep('preview');
        }
    }, [step, rawData]);

    // 2. Normalize and Match Data
    useEffect(() => {
        if (rawData.length === 0 || studentsLoading || staffLoading) return;

        const processItems = () => {
            const items: MigrationItem[] = rawData.map(item => {
                let status: MigrationItem['matchStatus'] = 'READY';

                // Student Matching
                // Phone normalization: remove dashes, spaces, ensure string
                const cleanPhone = (phone: string | number | undefined) => {
                    if (!phone) return '';
                    return String(phone).replace(/[^0-9]/g, '');
                };
                const targetPhone = cleanPhone(item.parentPhone);

                const matchedStudent = students.find(s =>
                    s.name === item.studentName &&
                    (cleanPhone(s.parentPhone || '').includes(targetPhone) || (targetPhone && targetPhone.includes(cleanPhone(s.parentPhone || ''))))
                );

                if (!matchedStudent) {
                    status = 'NO_STUDENT';
                    // Allow creation of new student
                    // We will set isNewStudent = true
                }

                // Counselor Matching - registrar 필드에서 직접 매칭
                // registrar 형식: "박나연(Jenny)" 또는 "박나연" 또는 "Jenny"
                let matchedConsultant = staffMembers.find(s => {
                    if (!item.registrar) return false;
                    const registrar = item.registrar.trim();

                    // 정확히 일치
                    if (s.name === registrar || s.englishName === registrar) return true;

                    // "박나연(Jenny)" 형식에서 한글 이름 추출
                    const koreanNameMatch = registrar.match(/^([가-힣]+)/);
                    if (koreanNameMatch && s.name === koreanNameMatch[1]) return true;

                    // "박나연(Jenny)" 형식에서 영문 이름 추출
                    const englishNameMatch = registrar.match(/\(([^)]+)\)/);
                    if (englishNameMatch && s.englishName &&
                        s.englishName.toLowerCase() === englishNameMatch[1].toLowerCase()) return true;

                    // 부분 매칭
                    if (registrar.includes(s.name)) return true;
                    if (s.englishName && registrar.toLowerCase().includes(s.englishName.toLowerCase())) return true;

                    return false;
                });

                // 담임선생님 매칭 (학생의 enrollment 기반)
                let matchedHomeroom: typeof matchedConsultant = undefined;
                if (matchedStudent) {
                    const subjectKey = item.subject === '수학' ? 'math' : (item.subject === '영어' ? 'english' : null);
                    let candidateEnrollments = matchedStudent.enrollments || [];

                    // 과목별 필터링
                    if (subjectKey) {
                        candidateEnrollments = candidateEnrollments.filter(e => e.subject === subjectKey);
                    }

                    if (candidateEnrollments.length === 1) {
                        // 수업이 1개면 해당 담당 선생님
                        const staffId = candidateEnrollments[0].staffId;
                        matchedHomeroom = staffMembers.find(s => s.id === staffId);
                    } else if (candidateEnrollments.length > 1 && item.registrar) {
                        // 수업이 여러개면 registrar와 매칭되는 선생님 (한글/영어 이름 모두 지원)
                        const matchingEnrollment = candidateEnrollments.find(e => {
                            const teacher = staffMembers.find(s => s.id === e.staffId);
                            if (!teacher) return false;
                            const registrar = item.registrar.trim();

                            // 한글 이름 매칭
                            if (teacher.name === registrar) return true;
                            const koreanNameMatch = registrar.match(/^([가-힣]+)/);
                            if (koreanNameMatch && teacher.name === koreanNameMatch[1]) return true;

                            // 영어 이름 매칭 (영어 선생님용)
                            if (teacher.englishName) {
                                if (teacher.englishName.toLowerCase() === registrar.toLowerCase()) return true;
                                const englishNameMatch = registrar.match(/\(([^)]+)\)/);
                                if (englishNameMatch && teacher.englishName.toLowerCase() === englishNameMatch[1].toLowerCase()) return true;
                            }

                            return false;
                        });

                        if (matchingEnrollment) {
                            const staffId = matchingEnrollment.staffId;
                            matchedHomeroom = staffMembers.find(s => s.id === staffId);
                        }
                    }
                }

                // 상담자가 없으면 담임선생님을 상담자로 사용
                if (!matchedConsultant && matchedHomeroom) {
                    matchedConsultant = matchedHomeroom;
                }

                // 담임이 비어있고, 상담자가 강사로 등록되어 있다면 담임으로 매칭
                if (!matchedHomeroom && matchedConsultant && matchedConsultant.role === 'teacher') {
                    matchedHomeroom = matchedConsultant;
                }

                // 상담자가 강사라면, 그 강사의 과목으로 우선 분류
                let finalSubject = item.subject;
                if (matchedConsultant && matchedConsultant.role === 'teacher' && matchedConsultant.subjects && matchedConsultant.subjects.length > 0) {
                    // 강사의 첫 번째 과목으로 분류 (math -> 수학, english -> 영어)
                    const teacherSubject = matchedConsultant.subjects[0];
                    if (teacherSubject === 'math') {
                        finalSubject = '수학';
                    } else if (teacherSubject === 'english') {
                        finalSubject = '영어';
                    }
                }

                if (!matchedConsultant && status === 'READY') status = 'NO_COUNSELOR';

                // 기존 generatedTitle 유지 (파싱 단계에서 O열 또는 P열 기반으로 이미 생성됨)
                // 없는 경우에만 기본값 설정
                let title = (item as any).generatedTitle;
                if (!title) {
                    const content = item.notes || '';
                    title = content.length > 20 ? content.substring(0, 20) + '...' : content;
                    if (!title) title = "상담 기록 (자동 이전)";
                }

                return {
                    ...item,
                    subject: finalSubject, // 상담자 과목 우선 적용
                    matchStatus: status,
                    matchedStudent,
                    matchedConsultant,
                    matchedHomeroom,
                    generatedTitle: title,
                    generatedCategory: (item as any).generatedCategory || 'general',
                    isNewStudent: !matchedStudent // Flag to indicate need for creation
                };
            });
            setMigrationItems(items);
        };

        processItems();
    }, [rawData, students, staffMembers, studentsLoading, staffLoading]);

    // 3. Execution using Batch (중복 체크 포함)
    const handleMigrate = async () => {
        if (migrationItems.length === 0) return;

        setStep('migrating');
        setProgress(0);
        setError(null);

        try {
            // === 중복 체크: 기존 상담 기록 조회 ===
            const existingConsultationsSnap = await getDocs(collection(db, 'student_consultations'));
            const existingKeys = new Set<string>();

            existingConsultationsSnap.docs.forEach(doc => {
                const data = doc.data();
                // 중복 판별 키: studentId + date + content 앞 100자 (하루에 여러 상담 가능)
                const contentKey = (data.content || '').replace(/\s+/g, '').substring(0, 100);
                const key = `${data.studentId}_${data.date}_${contentKey}`;
                existingKeys.add(key);
            });

            // Process ALL items, creating students if needed
            // Filter out Error if any (though currently logic doesn't set ERROR)
            const itemsToProcess = migrationItems.filter(i => i.matchStatus !== 'ERROR');
            const total = itemsToProcess.length;
            const batchSize = 100; // Safe batch size

            let processed = 0;
            let skippedDuplicates = 0;

            // Chunking
            for (let i = 0; i < total; i += batchSize) {
                const batch = writeBatch(db);
                const chunk = itemsToProcess.slice(i, i + batchSize);
                let batchHasItems = false;

                for (const item of chunk) {
                    let studentId = item.matchedStudent?.id;
                    const studentName = item.matchedStudent?.name || item.studentName;

                    // If NO_STUDENT, create a new student with 이름_학교_학년 ID pattern
                    if (!studentId && item.isNewStudent) {
                        // 문서 ID: 이름_학교_학년 형식
                        const docId = `${item.studentName}_${item.schoolName || '미정'}_${item.grade || '0'}`;
                        const newStudentRef = doc(db, 'students', docId);
                        studentId = docId;

                        const newStudentData = {
                            id: studentId,
                            name: item.studentName,
                            school: item.schoolName || '',
                            grade: item.grade || '',
                            parentPhone: String(item.parentPhone || ''),
                            studentPhone: String(item.studentPhone || ''),
                            status: 'prospective' as any,
                            source: 'MakeEdu_Migration',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            enrollments: []
                        };
                        // merge: true로 기존 문서가 있으면 병합
                        batch.set(newStudentRef, newStudentData, { merge: true });
                        batchHasItems = true;
                    }

                    if (!studentId) continue;

                    // === 중복 체크 (내용 기반) ===
                    const contentKey = (item.notes || '').replace(/\s+/g, '').substring(0, 100);
                    const duplicateKey = `${studentId}_${item.consultationDate}_${contentKey}`;
                    if (existingKeys.has(duplicateKey)) {
                        skippedDuplicates++;
                        continue; // 중복이면 스킵
                    }

                    // 새 키를 추가 (같은 배치 내 중복 방지)
                    existingKeys.add(duplicateKey);

                    const docRef = doc(collection(db, 'student_consultations'));

                    // Append Registrar to content since schema doesn't have it
                    let finalContent = item.notes || '';
                    if (item.registrar) {
                        finalContent += `\n\n[등록자: ${item.registrar}]`;
                    }

                    const consultationData = {
                        id: docRef.id,
                        studentId: studentId,
                        studentName: studentName,
                        type: 'parent',
                        consultantId: item.matchedConsultant?.id || 'unknown',
                        consultantName: item.matchedConsultant?.name || item.counselor || '미지정',
                        date: item.consultationDate,
                        title: item.generatedTitle || '상담 기록',
                        content: finalContent,
                        category: item.generatedCategory || 'general',
                        subject: (item.subject === '수학' ? 'math' : item.subject === '영어' ? 'english' : null),
                        createdAt: new Date().getTime(),
                        updatedAt: new Date().getTime(),
                        createdBy: 'migration_tool',
                        followUpNeeded: false,
                        followUpDone: false,
                        isMigrated: true,
                        migrationSource: 'MakeEdu_Excel'
                    };

                    batch.set(docRef, consultationData);
                    batchHasItems = true;
                }

                if (batchHasItems) {
                    await batch.commit();
                }
                processed += chunk.length;
                setProgress(Math.round((processed / total) * 100));
            }

            // 중복 스킵 카운트 저장
            setSkippedCount(skippedDuplicates);

            setStep('done');
        } catch (err: any) {
            console.error(err);
            setError(`마이그레이션 중 오류 발생: ${err.message}`);
            setStep('preview');
        }
    };

    // 4. Cleanup Function for Wrongly Migrated Data
    const handleCleanup = async () => {
        if (!confirm('정말로 잘못 업로드된 데이터를 삭제하시겠습니까? (consultations 컬렉션의 MakeEdu_Excel 데이터)')) return;

        setLoading(true);
        try {
            const wrongColRef = collection(db, 'consultations');
            const q = query(wrongColRef, where('migrationSource', '==', 'MakeEdu_Excel'));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                alert('삭제할 잘못된 데이터가 없습니다.');
                setLoading(false);
                return;
            }

            const batch = writeBatch(db);
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            alert(`총 ${snapshot.size}건의 잘못된 데이터를 삭제했습니다.`);
        } catch (err: any) {
            console.error(err);
            alert(`삭제 중 오류 발생: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const readyCount = migrationItems.length; // All processed
    const newStudentCount = migrationItems.filter(i => i.isNewStudent).length;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]" onClick={onClose}>
            <div className="bg-white rounded-sm shadow-2xl w-[900px] max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                    <h2 className="text-sm font-bold text-[#081429] flex items-center gap-2">
                        <Database size={18} className="text-[#fdb813]" />
                        MakeEdu 상담 내역 마이그레이션
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col p-6 bg-gray-50">
                    {step === 'load' && (
                        <div className="flex flex-col items-center justify-center h-full gap-6">
                            <div className="w-full max-w-md p-8 bg-white rounded-sm border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-center hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer relative">
                                <input
                                    type="file"
                                    accept=".xls, .xlsx"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <Upload className="text-gray-400 mb-4" size={48} />
                                <h3 className="text-lg font-bold text-gray-900 mb-1">상담 내역 엑셀 업로드</h3>
                                <p className="text-sm text-gray-500 mb-4">MakeEdu에서 내려받은 엑셀 파일(.xls, .xlsx)을 업로드하세요.</p>
                                <button className="px-4 py-2 bg-[#081429] text-white rounded-sm text-sm font-medium">
                                    파일 선택하기
                                </button>
                            </div>

                            {/* Cleanup Button */}
                            <button
                                onClick={handleCleanup}
                                className="text-xs text-red-500 underline hover:text-red-700 mt-4"
                            >
                                잘못된 데이터 삭제 (초기화)
                            </button>

                            {loading && (
                                <div className="flex items-center gap-2 text-blue-600">
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>데이터 처리 중...</span>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'preview' && (
                        <>
                            {/* Summary Cards Section */}
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Database size={16} className="text-gray-600" />
                                    <h3 className="text-sm font-bold text-gray-700">마이그레이션 요약</h3>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-white p-4 rounded-sm border border-gray-200 shadow-sm">
                                        <div className="text-sm text-gray-500 mb-1">총 데이터</div>
                                        <div className="text-2xl font-bold text-gray-900">{migrationItems.length}건</div>
                                    </div>
                                    <div className="bg-blue-50 p-4 rounded-sm border border-blue-100 shadow-sm">
                                        <div className="text-sm text-blue-600 mb-1">이전 진행 (전체)</div>
                                        <div className="text-xl font-bold text-blue-700">{readyCount}건</div>
                                    </div>
                                    <div className="bg-purple-50 p-4 rounded-sm border border-purple-100 shadow-sm">
                                        <div className="text-sm text-purple-600 mb-1 flex items-center gap-1">
                                            <UserPlus size={14} />
                                            신규 생성 예정
                                        </div>
                                        <div className="text-xl font-bold text-purple-700">{newStudentCount}건</div>
                                    </div>
                                </div>
                            </div>

                            {/* Data Preview Section */}
                            <div className="flex-1 overflow-hidden flex flex-col">
                                <div className="flex items-center gap-2 mb-3">
                                    <FileText size={16} className="text-gray-600" />
                                    <h3 className="text-sm font-bold text-gray-700">데이터 미리보기</h3>
                                    <span className="text-xs text-gray-500">({migrationItems.length}건)</span>
                                </div>
                                <div className="flex-1 overflow-auto border border-gray-200 rounded-sm bg-white">
                                    <table className="w-full text-xs text-left whitespace-nowrap">
                                        <thead className="bg-gray-100 font-bold text-gray-700 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-3 py-2 border-b w-10">No</th>
                                                <th className="px-3 py-2 border-b w-16">구분</th>
                                                <th className="px-3 py-2 border-b w-20">이름</th>
                                                <th className="px-3 py-2 border-b w-20">학교</th>
                                                <th className="px-3 py-2 border-b w-12">학년</th>
                                                <th className="px-3 py-2 border-b w-24">보호자연락처</th>
                                                <th className="px-3 py-2 border-b w-24">원생연락처</th>
                                                <th className="px-3 py-2 border-b">제목</th>
                                                <th className="px-3 py-2 border-b w-20">상담자</th>
                                                <th className="px-3 py-2 border-b w-20">담임선생님</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {migrationItems.map((item, idx) => (
                                                <tr key={idx} className={`hover:bg-gray-50 ${item.matchStatus !== 'READY' ? 'bg-purple-50/30' : ''}`}>
                                                    <td className="px-3 py-2 text-gray-500 font-mono">{item.no}</td>
                                                    <td className="px-3 py-2 text-gray-700">{item.subject}</td>
                                                    <td className="px-3 py-2 font-medium text-gray-900">
                                                        {item.studentName}
                                                        {item.matchStatus === 'NEW_STUDENT' && <span className="text-xxs text-purple-600 ml-1">(신규)</span>}
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-600">{item.schoolName}</td>
                                                    <td className="px-3 py-2 text-gray-600">{item.grade}</td>
                                                    <td className="px-3 py-2 text-gray-500">{item.parentPhone}</td>
                                                    <td className="px-3 py-2 text-gray-500 text-[11px]">{item.studentPhone}</td>
                                                    <td className="px-3 py-2 max-w-[300px]" title={item.notes}>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`px-1.5 py-0.5 rounded text-xxs shrink-0 ${
                                                                item.generatedCategory === 'progress'
                                                                    ? 'bg-blue-100 text-blue-700'
                                                                    : 'bg-gray-100 text-gray-600'
                                                            }`}>
                                                                {item.generatedCategory === 'progress' ? '학습 진도' : '일반 상담'}
                                                            </span>
                                                            <span className="truncate">{item.generatedTitle}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-600">
                                                        {item.registrar ? (
                                                            item.matchedConsultant ? (
                                                                <span className="text-blue-600 font-medium">{item.matchedConsultant.name}</span>
                                                            ) : (
                                                                <span className="text-orange-500">{item.registrar}</span>
                                                            )
                                                        ) : (
                                                            <span className="text-gray-300">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-400">
                                                        {item.matchedHomeroom ? (
                                                            <span className="text-green-600">{item.matchedHomeroom.name}</span>
                                                        ) : (
                                                            <span className="text-gray-300">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {step === 'migrating' && (
                        <div className="flex flex-col items-center justify-center h-full gap-6">
                            <div className="relative w-24 h-24">
                                <div className="absolute inset-0 rounded-sm border-4 border-gray-100"></div>
                                <div className="absolute inset-0 rounded-sm border-4 border-[#fdb813] border-t-transparent animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-[#081429]">
                                    {progress}%
                                </div>
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">데이터베이스에 저장 중입니다...</h3>
                                <p className="text-gray-500">잠시만 기다려주세요. 창을 닫지 마세요.</p>
                            </div>
                        </div>
                    )}

                    {step === 'done' && (
                        <div className="flex flex-col items-center justify-center h-full gap-6 animate-in fade-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-sm flex items-center justify-center mb-2">
                                <Check size={40} strokeWidth={3} />
                            </div>
                            <div className="text-center space-y-2">
                                <h3 className="text-2xl font-bold text-[#081429]">마이그레이션 완료!</h3>
                                <p className="text-gray-600">
                                    총 <span className="text-green-600 font-bold">{readyCount - skippedCount}</span>건의 상담 기록이 성공적으로 저장되었습니다.
                                </p>
                                {skippedCount > 0 && (
                                    <p className="text-sm text-orange-600">
                                        (중복 <span className="font-bold">{skippedCount}</span>건 스킵)
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="bg-white border-t border-gray-100 p-4 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors"
                        disabled={step === 'migrating'}
                    >
                        {step === 'done' ? '닫기' : '취소'}
                    </button>

                    {step === 'preview' && (
                        <button
                            onClick={handleMigrate}
                            disabled={readyCount === 0}
                            className={`flex items-center gap-2 px-5 py-2 rounded-sm font-bold text-sm shadow-sm transition-all ${readyCount > 0
                                ? 'bg-[#081429] text-white hover:bg-[#112a55]'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                        >
                            <Upload size={16} />
                            {readyCount > 0 ? `${readyCount}건 일괄 마이그레이션` : '데이터 없음'}
                        </button>
                    )}

                    {step === 'done' && (
                        <button
                            onClick={onSuccess}
                            className="flex items-center gap-2 px-5 py-2 rounded-sm font-bold text-sm shadow-sm bg-[#fdb813] text-[#081429] hover:bg-[#e5a60f]"
                        >
                            완료 및 새로고침
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConsultationMigrationModal;
