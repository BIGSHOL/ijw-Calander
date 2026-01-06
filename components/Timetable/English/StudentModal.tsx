// StudentModal.tsx - 영어 통합 뷰 학생 관리 모달
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Users, Save } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { TimetableStudent, EnglishLevel } from '../../../types';
import { DEFAULT_ENGLISH_LEVELS, parseClassName, CLASS_COLLECTION, CLASS_DRAFT_COLLECTION } from './englishUtils';
import AddStudentForm from './StudentModal/AddStudentForm';
import StudentListTable from './StudentModal/StudentListTable';
import StudentBatchActions from './StudentModal/StudentBatchActions';

interface StudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    className: string;  // 수업명 (EnglishClassTab에서 전달)
    teacher?: string;   // 담당강사 (EnglishClassTab에서 전달)
    currentUser: any;
    readOnly?: boolean;
    isSimulationMode?: boolean;  // 시뮬레이션 모드 여부
}

const StudentModal: React.FC<StudentModalProps> = ({ isOpen, onClose, className, teacher, currentUser, readOnly = false, isSimulationMode = false }) => {
    // State
    const [students, setStudents] = useState<TimetableStudent[]>([]);
    const [classDocId, setClassDocId] = useState<string | null>(null);
    const [classTeacher, setClassTeacher] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [englishLevels, setEnglishLevels] = useState<EnglishLevel[]>(DEFAULT_ENGLISH_LEVELS);
    const [isDirty, setIsDirty] = useState(false); // 변경사항 유무

    // Get full class name (e.g., PL5 -> Pre Let's 5)
    const fullClassName = useMemo(() => {
        const parsed = parseClassName(className);
        if (!parsed) return className;
        const level = englishLevels.find(l => l.abbreviation.toUpperCase() === parsed.levelAbbr.toUpperCase());
        return level ? `${level.fullName} ${parsed.number}${parsed.suffix}` : className;
    }, [className, englishLevels]);

    // Load english levels from settings
    useEffect(() => {
        const fetchLevels = async () => {
            const docSnap = await getDoc(doc(db, 'settings', 'english_levels'));
            if (docSnap.exists() && docSnap.data().levels) {
                setEnglishLevels(docSnap.data().levels);
            }
        };
        fetchLevels();
    }, []);

    // (Removed local state for adding/editing students as they are moved to sub-components)

    // Find class document by className, auto-create if not found
    useEffect(() => {
        if (!isOpen || !className) return;

        // Reset dirty state when opening
        setIsDirty(false);

        const findOrCreateClass = async () => {
            setLoading(true);
            try {
                const targetCollection = isSimulationMode ? CLASS_DRAFT_COLLECTION : CLASS_COLLECTION;
                const q = query(collection(db, targetCollection), where('className', '==', className));
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    // Class exists
                    const docRef = snapshot.docs[0];
                    setClassDocId(docRef.id);
                    const data = docRef.data();
                    setStudents(data.studentList || []);
                    setClassTeacher(data.teacher || '');
                } else {
                    // Auto-create class
                    if (isSimulationMode) {
                        // 시뮬레이션 모드: 자동 생성 허용
                        const { setDoc: setDocFn } = await import('firebase/firestore');
                        const newDocId = `영어_${className.replace(/\s/g, '_')}_${Date.now()}`;
                        const newClassData = {
                            id: newDocId,
                            className: className,
                            teacher: teacher || '',
                            subject: '영어',
                            room: '',
                            schedule: [],
                            studentList: [],
                            order: 999,
                        };
                        await setDocFn(doc(db, targetCollection, newDocId), newClassData);
                        setClassDocId(newDocId);
                        setStudents([]);
                        setClassTeacher(teacher || '');
                        console.log(`[Simulation] Auto-created class: ${className}`);
                    } else {
                        // 실시간 모드: 사용자 확인 필요
                        const confirmed = confirm(
                            `⚠️ "${className}" 수업이 수업목록에 없습니다.\n\n` +
                            `새로 생성하시겠습니까?\n(취소 시 모달이 닫힙니다)`
                        );
                        if (!confirmed) {
                            onClose();
                            setLoading(false);
                            return;
                        }
                        const { setDoc: setDocFn } = await import('firebase/firestore');
                        const newDocId = `영어_${className.replace(/\s/g, '_')}_${Date.now()}`;
                        const newClassData = {
                            id: newDocId,
                            className: className,
                            teacher: teacher || '',
                            subject: '영어',
                            room: '',
                            schedule: [],
                            studentList: [],
                            order: 999,
                        };
                        await setDocFn(doc(db, targetCollection, newDocId), newClassData);
                        setClassDocId(newDocId);
                        setStudents([]);
                        setClassTeacher(teacher || '');
                        console.log(`[Live] User-confirmed class creation: ${className}`);
                    }
                }
            } catch (e) {
                console.error('Error finding/creating class:', e);
                alert('수업 데이터 로드 중 오류가 발생했습니다.\n\n' + (e instanceof Error ? e.message : String(e)));
            }
            setLoading(false);
        };

        findOrCreateClass();
    }, [isOpen, className, isSimulationMode, teacher, onClose]);

    const { hasPermission } = usePermissions(currentUser);
    const isMaster = currentUser?.role === 'master';
    const canEditEnglish = (hasPermission('timetable.english.edit') || isMaster) && !readOnly;

    // Ref for isDirty to access current value inside callback without re-subscribing.
    const isDirtyRef = useRef(isDirty);
    useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

    // Real-time sync when classDocId is available - Optimized single listener
    useEffect(() => {
        if (!classDocId) return;
        const targetCollection = isSimulationMode ? CLASS_DRAFT_COLLECTION : CLASS_COLLECTION;
        const unsub = onSnapshot(doc(db, targetCollection, classDocId), (docSnap) => {
            if (isDirtyRef.current) return; // Use Ref to check current dirty state
            if (docSnap.exists()) {
                const data = docSnap.data();
                setStudents(data.studentList || []);
                setClassTeacher(data.teacher || '');
            }
        }, (error) => {
            console.error('Real-time listener error:', error);
            if (error.code === 'permission-denied') {
                alert('데이터 접근 권한이 없습니다.');
            } else if (error.code === 'unavailable') {
                alert('네트워크 연결을 확인해주세요.');
            }
        });
        return () => unsub();
    }, [classDocId, isSimulationMode]);


    // Save Changes to Firestore
    const handleSaveChanges = async () => {
        if (!classDocId) return;
        if (!confirm('변경사항을 저장하시겠습니까?')) return;

        try {
            // Sanitize students data to remove undefined values
            const sanitizedStudents = students.map(student => {
                const cleanStudent: any = { ...student };
                Object.keys(cleanStudent).forEach(key => {
                    if (cleanStudent[key] === undefined) {
                        delete cleanStudent[key];
                    }
                });
                return cleanStudent;
            });

            const targetCollection = isSimulationMode ? CLASS_DRAFT_COLLECTION : CLASS_COLLECTION;
            await updateDoc(doc(db, targetCollection, classDocId), { studentList: sanitizedStudents });
            setIsDirty(false);

            const mode = isSimulationMode ? '[시뮬레이션]' : '';
            alert(`${mode} 저장되었습니다.`);
        } catch (error: any) {
            console.error('Save error:', error);
            let message = '저장 실패: ';
            if (error.code === 'permission-denied') message += '권한이 없습니다.';
            else if (error.code === 'unavailable') message += '네트워크를 확인해주세요.';
            else if (error.code === 'not-found') message += '수업 문서를 찾을 수 없습니다.';
            else message += error.message || '알 수 없는 오류';
            alert(message);
        }
    };

    // Close Handler
    const handleClose = () => {
        if (isDirty) {
            if (confirm('저장되지 않은 변경사항이 있습니다. 정말 닫으시겠습니까? \n(변경사항은 저장되지 않습니다)')) {
                onClose();
            }
        } else {
            onClose();
        }
    };


    // Add student (Local)
    const handleAddStudent = async (name: string, engName: string, grade: string, school: string) => {
        if (!classDocId || !name.trim()) return;

        // Auto-mark as new student (today)
        const today = new Date().toISOString().split('T')[0];

        const newStudent: TimetableStudent = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: name.trim(),
            englishName: engName.trim(),
            grade: grade.trim(),
            school: school.trim(),
            enrollmentDate: today // Default to today
        };

        setStudents(prev => [...prev, newStudent]);
        setIsDirty(true);
    };

    // Generic update (Local)
    const handleUpdateStudent = (id: string, updates: Partial<TimetableStudent>) => {
        setStudents(prev => prev.map(s =>
            s.id === id ? { ...s, ...updates } : s
        ));
        setIsDirty(true);
    };

    // Add student (Local)

    // Remove student (Local)
    const handleRemoveStudent = (id: string) => {
        setStudents(prev => prev.filter(s => s.id !== id));
        setIsDirty(true);
    };

    // Sorting Logic (Same as EnglishClassTab)
    // 0: Underline (Top Priority)
    // 1: Normal
    // 2: Pink (New, 31-60 days)
    // 3: Red (New, <= 30 days)
    // 4: Withdrawn (Bottom)
    const sortedStudents = useMemo(() => {
        return [...students].sort((a, b) => {
            const getSortWeight = (s: TimetableStudent) => {
                if (s.withdrawalDate) return 4;
                if (s.underline) return 0;

                if (s.enrollmentDate) {
                    const start = new Date(s.enrollmentDate);
                    const today = new Date();
                    const diffDays = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

                    if (diffDays <= 30) return 3; // Red
                    if (diffDays <= 60) return 2; // Pink
                }
                return 1; // Normal
            };

            const weightA = getSortWeight(a);
            const weightB = getSortWeight(b);

            if (weightA !== weightB) {
                return weightA - weightB;
            }

            // Same weight -> Alphabetical
            return a.name.localeCompare(b.name, 'ko');
        });
    }, [students]);

    // Delete all students (Local)
    const handleDeleteAll = async () => {
        if (!confirm('모든 학생을 삭제하시겠습니까? (저장 시 반영됨)')) return;
        setStudents([]);
        setIsDirty(true);
    };

    // Toggle underline (Local)
    const handleToggleUnderline = async (studentId: string) => {
        setStudents(prev => prev.map(s =>
            s.id === studentId ? { ...s, underline: !s.underline } : s
        ));
        setIsDirty(true);
    };

    // (Editing logic moved to StudentListTable)

    // Batch Delete English Names (Local)
    const handleBatchDeleteEnglishName = async () => {
        if (students.length === 0) return;
        if (!confirm('정말로 모든 학생의 영어 이름을 삭제하시겠습니까?')) return;

        setStudents(prev => prev.map(s => ({ ...s, englishName: '' })));
        setIsDirty(true);
        alert('영어 이름이 일괄 삭제되었습니다. (저장 버튼을 눌러야 반영됩니다)');
    };

    // Batch Grade Promotion (Local)
    const handleBatchGradePromotion = async () => {
        if (students.length === 0) return;
        if (!confirm('모든 학생의 학년을 +1 하시겠습니까? \n(초6→중1 자동변환은 지원하지 않습니다. 제한 학년을 넘는 경우 승급이 거부됩니다.)')) return;

        let hasError = false;

        // Check first without modifying
        const invalidGradeStudents: string[] = [];

        for (const student of students) {
            const currentGrade = parseInt(student.grade || '0');
            const schoolName = student.school || '';

            // 승급 로직 제외 대상 (숫자가 아닌 경우) -> 명단 수집
            if (isNaN(currentGrade) || currentGrade === 0) {
                invalidGradeStudents.push(student.name);
                continue;
            }

            let maxGrade = 6; // 기본 초등

            // 학교급 판별 로직 개선 (Regex)
            if (/고등학교$|고교$/.test(schoolName)) maxGrade = 3;
            else if (/중학교$/.test(schoolName)) maxGrade = 3;
            else if (/초등학교$/.test(schoolName)) maxGrade = 6;
            else {
                maxGrade = 6;
            }

            if (currentGrade >= maxGrade) {
                alert(`'${student.name}' 학생은 이미 ${schoolName} ${currentGrade}학년이므로 승급할 수 없습니다.\n작업이 취소되었습니다.`);
                hasError = true;
                break;
            }
        }

        if (hasError) return;

        // 경고: 학년 정보가 없는 학생이 있는 경우
        if (invalidGradeStudents.length > 0) {
            if (!confirm(`다음 학생들은 학년 정보가 없어 승급에서 제외됩니다:\n${invalidGradeStudents.join(', ')}\n\n나머지 학생들만 승급하시겠습니까?`)) {
                return;
            }
        }

        setStudents(prev => prev.map(student => {
            const currentGrade = parseInt(student.grade || '0');
            if (isNaN(currentGrade) || currentGrade === 0) return student;
            return { ...student, grade: (currentGrade + 1).toString() };
        }));

        setIsDirty(true);
        alert('모든 학생의 학년이 +1 되었습니다. (저장 버튼을 눌러야 반영됩니다)');
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={handleClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Header - Dark bar */}
                <div className="px-5 py-3 flex items-center justify-between bg-[#081429] text-white">
                    <h2 className="text-sm font-bold flex items-center gap-2">
                        <Users size={18} className="text-[#fdb813]" />
                        {fullClassName} - 학생 관리
                        {isDirty && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded ml-2">변경사항 있음</span>}
                    </h2>
                    <button
                        onClick={handleClose}
                        className="p-1 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Class Info Row */}
                <div className="px-5 py-2 border-b border-gray-200 flex items-center gap-2 text-sm">
                    <span className="text-gray-500">담당강사</span>
                    <span className="text-[#373d41] font-bold">{teacher || classTeacher || '-'}</span>
                    <span className="text-gray-300">|</span>
                    <span className="bg-[#fdb813] text-[#081429] px-2 py-0.5 rounded font-bold text-xs">
                        {students.length}명
                    </span>
                </div>

                {/* Add Student Section */}
                {canEditEnglish && (
                    <AddStudentForm
                        onAdd={({ name, englishName, school, grade }) =>
                            handleAddStudent(name, englishName, grade, school)
                        }
                    />
                )}

                {/* Student List */}
                <div className="flex-1 overflow-y-auto px-5 py-4 min-h-[150px] max-h-[300px]">
                    <StudentListTable
                        students={sortedStudents}
                        loading={loading}
                        classDocId={classDocId}
                        className={className}
                        canEdit={canEditEnglish}
                        onUpdate={handleUpdateStudent}
                        onRemove={handleRemoveStudent}
                    />
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-2">
                        <StudentBatchActions
                            studentCount={students.length}
                            canEdit={canEditEnglish}
                            onDeleteAll={handleDeleteAll}
                            onBatchDeleteEnglishName={handleBatchDeleteEnglishName}
                            onBatchGradePromotion={handleBatchGradePromotion}
                        />
                    </div>

                    <div className="flex gap-2">
                        {isDirty && (
                            <button
                                onClick={handleSaveChanges}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center gap-1 animate-pulse"
                            >
                                <Save size={14} /> 저장
                            </button>
                        )}
                        <button
                            onClick={handleClose}
                            className="px-6 py-2 bg-[#081429] text-white rounded-lg font-bold text-sm hover:bg-[#0a1a35] transition-colors"
                        >
                            {isDirty ? '취소' : '닫기'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentModal;
