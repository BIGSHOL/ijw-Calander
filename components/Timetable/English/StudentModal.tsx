// StudentModal.tsx - 영어 통합 뷰 학생 관리 모달
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Trash2, Users, Image as ImageIcon, Check, Loader2, RefreshCw } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { TimetableStudent, EnglishLevel } from '../../../types';
import { DEFAULT_ENGLISH_LEVELS, parseClassName } from './englishUtils';

interface StudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    className: string;  // 수업명 (EnglishClassTab에서 전달)
    teacher?: string;   // 담당강사 (EnglishClassTab에서 전달)
}

const StudentModal: React.FC<StudentModalProps> = ({ isOpen, onClose, className, teacher }) => {
    // State
    const [students, setStudents] = useState<TimetableStudent[]>([]);
    const [classDocId, setClassDocId] = useState<string | null>(null);
    const [classTeacher, setClassTeacher] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [englishLevels, setEnglishLevels] = useState<EnglishLevel[]>(DEFAULT_ENGLISH_LEVELS);

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

    // OCR State
    const [isOCRMode, setIsOCRMode] = useState(false);
    const [ocrImage, setOcrImage] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [ocrProgress, setOcrProgress] = useState(0);
    const [ocrResults, setOcrResults] = useState<TimetableStudent[]>([]);
    const [ocrStatus, setOcrStatus] = useState<string>(''); // For detailed status like 'Downloading language data...'

    // Handle Paste Event for Image
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (!isOCRMode) return;

            const items = e.clipboardData?.items;
            if (!items) return;

            for (const item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    if (blob) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            if (event.target?.result) {
                                setOcrImage(event.target.result as string);
                                runOCR(event.target.result as string);
                            }
                        };
                        reader.readAsDataURL(blob);
                    }
                    break;
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [isOCRMode]);

    const runOCR = async (imageSrc: string) => {
        setIsScanning(true);
        setOcrProgress(0);
        setOcrStatus('엔진 초기화 중...');
        setOcrResults([]);

        try {
            const result = await Tesseract.recognize(
                imageSrc,
                'kor+eng', // Korean and English
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            setOcrProgress(Math.round(m.progress * 100));
                            setOcrStatus(`텍스트 인식 중... ${Math.round(m.progress * 100)}%`);
                        } else {
                            setOcrStatus(m.status);
                        }
                    }
                }
            );

            parseOCRText(result.data.text);
        } catch (error) {
            console.error('OCR Error:', error);
            alert('이미지 인식 중 오류가 발생했습니다.');
        } finally {
            setIsScanning(false);
            setOcrStatus('');
        }
    };

    const parseOCRText = (text: string) => {
        // Simple line splitting
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        const parsedStudents: TimetableStudent[] = [];

        // Regex for "Name(Suffix)(EngName) SchoolGrade"
        // Captures: 1:Name+Suffix, 2:EngName (optional), 3:School(ends with 초/중/고), 4:Grade (optional)
        // Updated to support: 김윤아B, 달성초3 (Attached)
        const rowRegex = /([가-힣]{2,4}[A-Za-z0-9]?)\s*(?:\((.*?)\))?\s*([가-힣]+[초중고])?\s*(\d+)?/;

        lines.forEach((line, index) => {
            // Basic Cleanup
            const cleanLine = line.replace(/[|\]\[]/g, '').trim(); // Remove common OCR artifacts like list borders
            const match = cleanLine.match(rowRegex);

            if (match) {
                const name = match[1];
                const engName = match[2] || '';
                const school = match[3] || '';
                const grade = match[4] || '';

                // Filter out obviously wrong data (e.g. headers)
                if (name === '이름' || name === '담당강사') return;

                parsedStudents.push({
                    id: `ocr_${Date.now()}_${index}`,
                    name: name,
                    englishName: engName,
                    school: school,
                    grade: grade
                });
            }
        });

        if (parsedStudents.length === 0) {
            alert('인식된 학생 데이터가 없습니다. 이미지가 선명한지 확인해주세요.');
        }

        setOcrResults(parsedStudents);
    };

    const handleAddOCRStudent = async (student: TimetableStudent) => {
        await handleAddStudent(student.name, student.englishName || '', student.grade || '', student.school || '');
        // Remove from OCR list after adding
        setOcrResults(prev => prev.filter(s => s.id !== student.id));
    };

    const handleAddAllOCRStudents = async () => {
        if (!classDocId || ocrResults.length === 0) return;
        if (confirm(`${ocrResults.length}명의 학생을 일괄 추가하시겠습니까?`)) {
            try {
                const newStudentsToAdd = ocrResults.map(student => ({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    name: student.name.trim(),
                    englishName: student.englishName?.trim() || '',
                    grade: student.grade?.trim() || '',
                    school: student.school?.trim() || '',
                }));

                const updatedList = [...students, ...newStudentsToAdd];
                await updateDoc(doc(db, '수업목록', classDocId), {
                    studentList: updatedList
                });

                // setStudents(updatedList); // Real-time listener will update this, but optimistic update is fine too
                alert(`${ocrResults.length}명 추가 완료`);
                setOcrResults([]);
                setOcrImage(null);
                setIsOCRMode(false);
            } catch (e) {
                console.error('Add failed:', e);
                alert('일괄 추가 중 오류가 발생했습니다.');
            }
        }
    };

    // Find class document by className, auto-create if not found
    useEffect(() => {
        if (!isOpen || !className) return;

        const findOrCreateClass = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, '수업목록'), where('className', '==', className));
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
                    const { setDoc: setDocFn } = await import('firebase/firestore');
                    const newDocId = `영어_${className.replace(/\s/g, '_')}_${Date.now()}`;
                    const newClassData = {
                        id: newDocId,
                        className: className,
                        teacher: '',
                        subject: '영어',
                        room: '',
                        schedule: [],
                        studentList: [],
                        order: 999,  // 끝에 배치
                    };

                    await setDocFn(doc(db, '수업목록', newDocId), newClassData);
                    setClassDocId(newDocId);
                    setStudents([]);
                    setClassTeacher('');
                    console.log(`Auto-created class: ${className}`);
                }
            } catch (e) {
                console.error('Error finding/creating class:', e);
            }
            setLoading(false);
        };

        findOrCreateClass();
    }, [isOpen, className]);

    // Real-time sync when classDocId is available
    useEffect(() => {
        if (!classDocId) return;

        const unsub = onSnapshot(doc(db, '수업목록', classDocId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setStudents(data.studentList || []);
                setClassTeacher(data.teacher || '');
            }
        });

        return () => unsub();
    }, [classDocId]);

    // Add student
    // Add student
    // Add student
    const handleAddStudent = async (name: string, engName: string, grade: string, school: string) => {
        if (!classDocId || !name.trim()) return;

        const newStudent: TimetableStudent = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: name.trim(),
            englishName: engName.trim(),
            grade: grade.trim(),
            school: school.trim(),
        };

        const updatedList = [...students, newStudent];
        await updateDoc(doc(db, '수업목록', classDocId), {
            studentList: updatedList
        });
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



    // Remove student
    const handleRemoveStudent = async (studentId: string) => {
        if (!classDocId) return;
        if (!confirm('이 학생을 수업에서 제거하시겠습니까?')) return;

        const updatedList = students.filter(s => s.id !== studentId);
        try {
            await updateDoc(doc(db, '수업목록', classDocId), { studentList: updatedList });
        } catch (e) {
            console.error(e);
            alert('학생 제거 실패');
        }
    };

    // Delete all students
    const handleDeleteAll = async () => {
        if (!classDocId || students.length === 0) return;
        if (!confirm('모든 학생을 삭제하시겠습니까?')) return;

        try {
            await updateDoc(doc(db, '수업목록', classDocId), { studentList: [] });
        } catch (e) {
            console.error(e);
            alert('삭제 실패');
        }
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

    const saveEditing = async () => {
        if (!classDocId || !editingStudentId) return;

        const updatedList = students.map(s => {
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
        });

        try {
            await updateDoc(doc(db, '수업목록', classDocId), { studentList: updatedList });
            setEditingStudentId(null);
        } catch (e) {
            console.error(e);
            alert('수정 실패');
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Header - Dark bar */}
                <div className="px-5 py-3 flex items-center justify-between bg-[#081429] text-white">
                    <h2 className="text-sm font-bold flex items-center gap-2">
                        <Users size={18} className="text-[#fdb813]" />
                        {fullClassName} - 학생 관리
                    </h2>
                    <button
                        onClick={onClose}
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

                {/* Add Student Section (OCR Toggle) */}
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-3">
                    {/* Add Mode Toggle */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsOCRMode(false)}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${!isOCRMode ? 'bg-white border-indigo-200 text-indigo-700 shadow-sm' : 'bg-transparent border-transparent text-gray-400 hover:bg-gray-100'}`}
                        >
                            직접 입력
                        </button>
                        <button
                            onClick={() => setIsOCRMode(true)}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${isOCRMode ? 'bg-[#fdb813] border-[#fdb813] text-[#081429] shadow-sm' : 'bg-transparent border-transparent text-gray-400 hover:bg-gray-100'}`}
                        >
                            📷 이미지로 추가 (Beta)
                        </button>
                    </div>

                    {!isOCRMode ? (
                        /* Manual Input Form */
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
                    ) : (
                        /* OCR Input Area */
                        <div className="flex flex-col gap-4">
                            {!ocrImage ? (
                                <div
                                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => {
                                        alert('이미지를 Ctrl+V (붙여넣기) 해주세요!');
                                    }}
                                >
                                    <ImageIcon className="text-gray-400 mb-2" size={32} />
                                    <p className="text-sm font-bold text-gray-600">이곳을 클릭 후 Ctrl+V 하여 이미지를 붙여넣으세요</p>
                                    <p className="text-xs text-gray-400 mt-1">엑셀, 카카오톡 캡처 등 학생 명단이 포함된 이미지</p>
                                </div>
                            ) : (
                                <div className="flex gap-4">
                                    {/* Image Preview */}
                                    <div className="w-1/3 relative group">
                                        <img src={ocrImage} alt="Pasted" className="w-full h-auto rounded border border-gray-200" />
                                        <button
                                            onClick={() => { setOcrImage(null); setOcrResults([]); }}
                                            className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"
                                        >
                                            <X size={12} />
                                        </button>
                                        {isScanning && (
                                            <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center backdrop-blur-sm">
                                                <Loader2 className="animate-spin text-indigo-600 mb-2" />
                                                <span className="text-xs font-bold text-indigo-800">{ocrStatus}</span>
                                                <div className="w-2/3 h-1 bg-gray-200 rounded-full mt-2 overflow-hidden">
                                                    <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${ocrProgress}%` }}></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Parsed Result List */}
                                    <div className="w-2/3 flex flex-col h-full max-h-[200px]">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-gray-600">
                                                인식 결과 <span className="text-indigo-600">{ocrResults.length}명</span>
                                            </span>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => runOCR(ocrImage)}
                                                    className="p-1 hover:bg-gray-200 rounded text-gray-500"
                                                    title="재인식"
                                                >
                                                    <RefreshCw size={14} />
                                                </button>
                                                {ocrResults.length > 0 && (
                                                    <button
                                                        onClick={handleAddAllOCRStudents}
                                                        className="px-2 py-1 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 start-icon"
                                                    >
                                                        일괄 추가
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto border border-gray-200 rounded bg-white">
                                            {ocrResults.length === 0 ? (
                                                <div className="h-full flex items-center justify-center text-gray-400 text-xs p-4">
                                                    {isScanning ? '분석 중...' : '인식된 데이터가 없습니다.'}
                                                </div>
                                            ) : (
                                                <table className="w-full text-[10px]">
                                                    <thead className="bg-gray-50 text-gray-500 sticky top-0">
                                                        <tr>
                                                            <th className="py-1 px-2 text-left">이름</th>
                                                            <th className="py-1 px-2 text-left">E.Name</th>
                                                            <th className="py-1 px-2 text-left">학교/학년</th>
                                                            <th className="py-1 px-2 text-center">추가</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {ocrResults.map(student => (
                                                            <tr key={student.id} className="hover:bg-gray-50 group">
                                                                <td className="py-1 px-2">
                                                                    <input
                                                                        type="text"
                                                                        value={student.name}
                                                                        onChange={(e) => {
                                                                            const newName = e.target.value;
                                                                            setOcrResults(prev => prev.map(s => s.id === student.id ? { ...s, name: newName } : s));
                                                                        }}
                                                                        className="w-full bg-transparent outline-none focus:text-indigo-600 font-bold"
                                                                    />
                                                                </td>
                                                                <td className="py-1 px-2">
                                                                    <input
                                                                        type="text"
                                                                        value={student.englishName}
                                                                        onChange={(e) => {
                                                                            const newEng = e.target.value;
                                                                            setOcrResults(prev => prev.map(s => s.id === student.id ? { ...s, englishName: newEng } : s));
                                                                        }}
                                                                        className="w-full bg-transparent outline-none focus:text-indigo-600"
                                                                    />
                                                                </td>
                                                                <td className="py-1 px-2">
                                                                    <div className="flex gap-1">
                                                                        <input
                                                                            type="text"
                                                                            value={student.school}
                                                                            onChange={(e) => {
                                                                                const val = e.target.value;
                                                                                setOcrResults(prev => prev.map(s => s.id === student.id ? { ...s, school: val } : s));
                                                                            }}
                                                                            className="w-12 bg-transparent outline-none focus:text-indigo-600 text-right"
                                                                            placeholder="학교"
                                                                        />
                                                                        <input
                                                                            type="text"
                                                                            value={student.grade}
                                                                            onChange={(e) => {
                                                                                const val = e.target.value;
                                                                                setOcrResults(prev => prev.map(s => s.id === student.id ? { ...s, grade: val } : s));
                                                                            }}
                                                                            className="w-4 bg-transparent outline-none focus:text-indigo-600 text-center"
                                                                            placeholder="N"
                                                                        />
                                                                    </div>
                                                                </td>
                                                                <td className="py-1 px-2 text-center">
                                                                    <button
                                                                        onClick={() => handleAddOCRStudent(student)}
                                                                        className="p-1 rounded hover:bg-green-100 text-green-600"
                                                                        title="이 학생만 추가"
                                                                    >
                                                                        <Check size={12} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setOcrResults(prev => prev.filter(s => s.id !== student.id))}
                                                                        className="p-1 rounded hover:bg-red-100 text-red-500 ml-1"
                                                                        title="목록에서 제거"
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

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
                            {[...students].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((student, idx) => (
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
                                            <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => startEditing(student)}>
                                                <span className="w-5 h-5 rounded-full bg-[#081429] text-[#fdb813] text-[10px] font-bold flex items-center justify-center shrink-0">
                                                    {idx + 1}
                                                </span>
                                                <span className="font-bold text-sm text-[#373d41]">
                                                    {student.name}
                                                    {student.englishName && <span className="text-gray-500 font-normal">({student.englishName})</span>}
                                                </span>
                                                {(student.school || student.grade) && (
                                                    <span className="text-xs text-gray-400">
                                                        {student.school}{student.grade}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRemoveStudent(student.id); }}
                                                className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <X size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                    <button
                        onClick={handleDeleteAll}
                        disabled={students.length === 0}
                        className="text-red-500 hover:text-red-600 font-bold text-sm flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Trash2 size={14} /> 삭제
                    </button>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-[#081429] text-white rounded-lg font-bold text-sm hover:bg-[#0a1a35] transition-colors"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudentModal;
