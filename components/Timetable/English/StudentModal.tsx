// StudentModal.tsx - 영어 통합 뷰 학생 관리 모달
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Trash2, Users, Check, Underline, Settings, Save, Minus, UserPlus } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { TimetableStudent, EnglishLevel } from '../../../types';
import { DEFAULT_ENGLISH_LEVELS, parseClassName, CLASS_COLLECTION, CLASS_DRAFT_COLLECTION } from './englishUtils';

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

    // New student form
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentEnglishName, setNewStudentEnglishName] = useState('');
    const [newStudentGrade, setNewStudentGrade] = useState('');
    const [newStudentSchool, setNewStudentSchool] = useState('');
    const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', englishName: '', school: '', grade: '' });

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

    // Wrapper for manual input
    const handleAddStudentFromInput = async () => {
        if (!newStudentName.trim()) return;
        await handleAddStudent(newStudentName, newStudentEnglishName, newStudentGrade, newStudentSchool);

        // Reset manual inputs
        setNewStudentName('');
        setNewStudentEnglishName('');
        setNewStudentGrade('');
        setNewStudentSchool('');
    };

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

    const startEditing = (student: TimetableStudent) => {
        setEditingStudentId(student.id);
        setEditForm({
            name: student.name,
            englishName: student.englishName || '',
            school: student.school || '',
            grade: student.grade || ''
        });
    };

    const cancelEditing = () => {
        setEditingStudentId(null);
        setEditForm({ name: '', englishName: '', school: '', grade: '' });
    };

    const [isManageMenuOpen, setIsManageMenuOpen] = useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsManageMenuOpen(false);
            }
        }

        if (isManageMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isManageMenuOpen]);

    // Save single edit (Local)
    const saveEditing = async () => {
        if (!editingStudentId) return;

        setStudents(prev => prev.map(s => {
            if (s.id === editingStudentId) {
                return {
                    ...s,
                    name: editForm.name,
                    englishName: editForm.englishName,
                    school: editForm.school,
                    grade: editForm.grade
                };
            }
            return s;
        }));

        setEditingStudentId(null);
        setIsDirty(true);
    };

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

                {/* Add Student Section - Gated by edit permission */}
                {canEditEnglish && (
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-3">
                        <div className="flex items-end gap-2">
                            <div className="flex-1 grid grid-cols-4 gap-2">
                                <div className="col-span-1">
                                    <label className="text-[10px] text-gray-500 font-bold mb-1 block">이름</label>
                                    <input
                                        type="text"
                                        placeholder="이름"
                                        value={newStudentName}
                                        onChange={(e) => setNewStudentName(e.target.value)}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddStudentFromInput()}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[10px] text-gray-500 font-bold mb-1 block">E.Name</label>
                                    <input
                                        type="text"
                                        placeholder="영어이름"
                                        value={newStudentEnglishName}
                                        onChange={(e) => setNewStudentEnglishName(e.target.value)}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddStudentFromInput()}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[10px] text-gray-500 font-bold mb-1 block">학교</label>
                                    <input
                                        type="text"
                                        placeholder="학교"
                                        value={newStudentSchool}
                                        onChange={(e) => setNewStudentSchool(e.target.value)}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddStudentFromInput()}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[10px] text-gray-500 font-bold mb-1 block">학년</label>
                                    <input
                                        type="text"
                                        placeholder="학년"
                                        value={newStudentGrade}
                                        onChange={(e) => setNewStudentGrade(e.target.value)}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddStudentFromInput()}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleAddStudentFromInput}
                                disabled={!newStudentName.trim()}
                                className="px-3 py-1.5 bg-[#fdb813] text-[#081429] rounded font-bold text-xs hover:bg-[#e5a712] disabled:opacity-50 h-[34px] self-end"
                            >
                                추가
                            </button>
                        </div>
                    </div>
                )}

                {/* Student List */}
                <div className="flex-1 overflow-y-auto px-5 py-4 min-h-[150px] max-h-[300px]">
                    {loading ? (
                        <div className="text-center py-8 text-gray-400 text-sm">불러오는 중...</div>
                    ) : !classDocId ? (
                        <div className="text-center py-8 text-gray-400 text-sm">
                            <p>수업 정보를 찾을 수 없습니다.</p>
                            <p className="text-xs mt-1">'{className}'이(가) 수업목록에 등록되어 있는지 확인해주세요.</p>
                        </div>
                    ) : students.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">등록된 학생이 없습니다.</div>
                    ) : (
                        <div className="space-y-1.5">
                            {(() => {
                                const activeList = sortedStudents.filter(s => !s.withdrawalDate);
                                const withdrawnList = sortedStudents.filter(s => s.withdrawalDate);

                                return (
                                    <>
                                        {activeList.map((student, idx) => (
                                            <div
                                                key={student.id}
                                                className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors group ${editingStudentId === student.id ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50 hover:bg-gray-100'}`}
                                            >
                                                {editingStudentId === student.id ? (
                                                    // Editing Mode
                                                    <div className="flex items-center gap-2 w-full">
                                                        <div className="flex-1 grid grid-cols-12 gap-2">
                                                            <div className="col-span-3">
                                                                <input
                                                                    value={editForm.name}
                                                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                                    className="w-full text-xs p-1 border rounded"
                                                                    placeholder="이름"
                                                                />
                                                            </div>
                                                            <div className="col-span-3">
                                                                <input
                                                                    value={editForm.englishName}
                                                                    onChange={e => setEditForm({ ...editForm, englishName: e.target.value })}
                                                                    className="w-full text-xs p-1 border rounded"
                                                                    placeholder="E.Name"
                                                                />
                                                            </div>
                                                            <div className="col-span-4">
                                                                <input
                                                                    value={editForm.school}
                                                                    onChange={e => setEditForm({ ...editForm, school: e.target.value })}
                                                                    className="w-full text-xs p-1 border rounded"
                                                                    placeholder="학교"
                                                                />
                                                            </div>
                                                            <div className="col-span-2">
                                                                <input
                                                                    value={editForm.grade}
                                                                    onChange={e => setEditForm({ ...editForm, grade: e.target.value })}
                                                                    className="w-full text-xs p-1 border rounded text-center"
                                                                    placeholder="N"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <button onClick={saveEditing} className="p-1 text-green-600 hover:bg-green-100 rounded">
                                                                <Check size={16} />
                                                            </button>
                                                            <button onClick={cancelEditing} className="p-1 text-gray-400 hover:bg-gray-200 rounded">
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    // View Mode
                                                    <>
                                                        <div className={`flex items-center gap-3 flex-1 ${canEditEnglish ? 'cursor-pointer' : ''}`} onClick={() => canEditEnglish && startEditing(student)}>
                                                            <span className="w-5 h-5 rounded-full bg-[#081429] text-[#fdb813] text-[10px] font-bold flex items-center justify-center shrink-0">
                                                                {idx + 1}
                                                            </span>
                                                            <span className={`font-bold text-sm ${student.underline ? 'underline text-blue-600' : 'text-[#373d41]'}`}>
                                                                {student.name}
                                                                {student.englishName && <span className={`font-normal ${student.underline ? 'text-blue-400' : 'text-gray-500'}`}>({student.englishName})</span>}
                                                            </span>
                                                            {(student.school || student.grade) && (
                                                                <span className="text-xs text-gray-400">
                                                                    {student.school}{student.grade}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {canEditEnglish && (
                                                                <>
                                                                    <button
                                                                        onClick={() => {
                                                                            let nextDate: string | undefined = undefined;
                                                                            if (!student.enrollmentDate) {
                                                                                nextDate = new Date().toISOString().split('T')[0];
                                                                            } else {
                                                                                const start = new Date(student.enrollmentDate);
                                                                                const today = new Date();
                                                                                const diffDays = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                                                                if (diffDays <= 30) {
                                                                                    const pastDate = new Date();
                                                                                    pastDate.setDate(pastDate.getDate() - 35);
                                                                                    nextDate = pastDate.toISOString().split('T')[0];
                                                                                } else {
                                                                                    nextDate = undefined;
                                                                                }
                                                                            }
                                                                            handleUpdateStudent(student.id, { enrollmentDate: nextDate, onHold: false, withdrawalDate: undefined });
                                                                        }}
                                                                        className={`px-2 py-0.5 text-[10px] flex items-center justify-center rounded border transition-colors ${student.enrollmentDate
                                                                            ? (() => {
                                                                                const start = new Date(student.enrollmentDate);
                                                                                const today = new Date();
                                                                                const diffDays = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                                                                if (diffDays <= 30) return 'bg-red-500 text-white border-red-500 hover:bg-red-600';
                                                                                return 'bg-pink-300 text-red-600 border-pink-300 hover:bg-pink-400';
                                                                            })()
                                                                            : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                                                                            }`}
                                                                    >
                                                                        신입
                                                                    </button>

                                                                    <button
                                                                        onClick={() => handleUpdateStudent(student.id, { underline: !student.underline })}
                                                                        className={`p-1 rounded border transition-colors ${student.underline ? 'bg-blue-600 text-white border-blue-600 shadow-inner' : 'bg-white text-gray-400 border-gray-200 hover:bg-blue-50 hover:text-blue-500 hover:border-blue-200'}`}
                                                                        title="밑줄 강조"
                                                                    >
                                                                        <Underline size={12} />
                                                                    </button>

                                                                    <button
                                                                        onClick={() => {
                                                                            if (student.underline) {
                                                                                alert('밑줄이 표시된 학생은 퇴원 처리할 수 없습니다.\n먼저 밑줄을 해제해주세요.');
                                                                                return;
                                                                            }
                                                                            if (window.confirm("퇴원 처리 하시겠습니까?")) {
                                                                                handleUpdateStudent(student.id, { withdrawalDate: new Date().toISOString().split('T')[0], onHold: false, enrollmentDate: undefined });
                                                                            }
                                                                        }}
                                                                        className="px-2 py-0.5 text-[10px] rounded border border-gray-200 text-gray-400 hover:bg-gray-800 hover:text-white hover:border-gray-800 transition-colors"
                                                                    >
                                                                        퇴원
                                                                    </button>

                                                                    <button
                                                                        onClick={() => handleUpdateStudent(student.id, { onHold: !student.onHold, enrollmentDate: undefined, withdrawalDate: undefined })}
                                                                        className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${student.onHold ? 'bg-yellow-400 text-black border-yellow-500 hover:bg-yellow-500 font-bold' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'}`}
                                                                    >
                                                                        대기
                                                                    </button>

                                                                    <button
                                                                        onClick={() => handleRemoveStudent(student.id)}
                                                                        className="px-2 py-0.5 text-[10px] rounded border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                                                                    >
                                                                        삭제
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}

                                        {withdrawnList.length > 0 && (
                                            <div className="mt-6 border-t border-gray-100 pt-4">
                                                <div className="flex items-center gap-2 mb-3 px-1">
                                                    <div className="h-px bg-gray-200 flex-1"></div>
                                                    <span className="text-xs font-bold text-gray-400">퇴원한 학생 ({withdrawnList.length})</span>
                                                    <div className="h-px bg-gray-200 flex-1"></div>
                                                </div>
                                                <div className="opacity-70 grayscale space-y-1">
                                                    {withdrawnList.map((student) => (
                                                        <div
                                                            key={student.id}
                                                            className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50"
                                                        >
                                                            <div className="flex items-center gap-3 flex-1">
                                                                <span className="font-bold text-sm text-gray-400 line-through">
                                                                    {student.name}
                                                                    {student.englishName && <span className="font-normal text-gray-400">({student.englishName})</span>}
                                                                </span>
                                                                {(student.school || student.grade) && (
                                                                    <span className="text-xs text-gray-400">
                                                                        {student.school}{student.grade}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                {canEditEnglish && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleUpdateStudent(student.id, { withdrawalDate: undefined })}
                                                                            className="px-2 py-0.5 text-[10px] rounded border transition-colors bg-black text-white border-black hover:bg-gray-800"
                                                                        >
                                                                            퇴원 취소
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleRemoveStudent(student.id)}
                                                                            className="px-2 py-0.5 text-[10px] rounded border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                                                                        >
                                                                            삭제
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-2">
                        {canEditEnglish && (
                            <>
                                <button
                                    onClick={handleDeleteAll}
                                    disabled={students.length === 0}
                                    className="text-red-500 hover:text-red-600 font-bold text-sm flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 hover:bg-red-50 rounded"
                                >
                                    <Trash2 size={14} /> 삭제
                                </button>

                                {/* Batch Management Menu */}
                                <div className="relative" ref={menuRef}>
                                    <button
                                        onClick={() => setIsManageMenuOpen(!isManageMenuOpen)}
                                        disabled={students.length === 0}
                                        className="text-gray-600 hover:text-gray-800 font-bold text-sm flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 hover:bg-gray-200 rounded"
                                    >
                                        <Settings size={14} /> 일괄 관리
                                    </button>
                                    {isManageMenuOpen && (
                                        <div className="absolute bottom-full left-0 mb-2 w-56 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-10">
                                            <button
                                                onClick={() => {
                                                    handleBatchDeleteEnglishName();
                                                    setIsManageMenuOpen(false);
                                                }}
                                                className="w-full text-left px-4 py-3 text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                                            >
                                                <div className="font-bold mb-0.5">영어 이름 일괄 삭제</div>
                                                <div className="text-gray-400 text-[10px]">모든 학생의 영어 이름을 지웁니다.</div>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    handleBatchGradePromotion();
                                                    setIsManageMenuOpen(false);
                                                }}
                                                className="w-full text-left px-4 py-3 text-xs text-gray-700 hover:bg-gray-50"
                                            >
                                                <div className="font-bold mb-0.5">학년 일괄 승급 (+1)</div>
                                                <div className="text-gray-400 text-[10px]">모든 학생의 학년을 1씩 올립니다.</div>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
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
