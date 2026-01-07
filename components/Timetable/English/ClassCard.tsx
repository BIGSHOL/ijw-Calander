import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, MoreVertical, TrendingUp, ArrowUpCircle, UserPlus } from 'lucide-react';

import { TimetableStudent, Teacher, ClassKeywordColor, EnglishLevel } from '../../../types';
import { ClassInfo } from './hooks/useEnglishClasses';
import { ClassStudentData } from './hooks/useClassStudents';
import { MoveChange } from './hooks/useEnglishChanges';
import { DisplayOptions } from './IntegrationViewSettings';
import MiniGridRow from './MiniGridRow';
import { isValidLevel, numberLevelUp, classLevelUp, isMaxLevel } from './englishUtils';
import StudentModal from './StudentModal';
import LevelUpConfirmModal from './LevelUpConfirmModal';

interface ClassCardProps {
    classInfo: ClassInfo;
    mode: 'view' | 'edit';
    isHidden: boolean;
    onToggleHidden: () => void;
    teachersData: Teacher[];
    classKeywords: ClassKeywordColor[];
    isMenuOpen: boolean;
    onMenuToggle: (isOpen: boolean) => void;
    displayOptions?: DisplayOptions;
    hiddenTeacherList?: string[];
    currentUser: any;
    englishLevels: EnglishLevel[];
    isSimulationMode?: boolean;
    moveChanges?: Map<string, MoveChange>;
    onMoveStudent?: (student: TimetableStudent, fromClass: string, toClass: string) => void;
    studentMap: Record<string, any>;
    classStudentData?: ClassStudentData; // Cost Optimization: Centralized fetch
}

const ClassCard: React.FC<ClassCardProps> = ({
    classInfo,
    mode,
    isHidden,
    onToggleHidden,
    teachersData,
    classKeywords,
    isMenuOpen,
    onMenuToggle,
    displayOptions,
    hiddenTeacherList,
    currentUser,
    englishLevels,
    isSimulationMode = false,
    moveChanges,
    onMoveStudent,
    studentMap,
    classStudentData // Cost Optimization: Centralized fetch
}) => {
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [studentCount, setStudentCount] = useState<number>(0);
    const [students, setStudents] = useState<TimetableStudent[]>([]);
    const [displayStudents, setDisplayStudents] = useState<TimetableStudent[]>([]);
    const [levelUpModal, setLevelUpModal] = useState<{ isOpen: boolean; type: 'number' | 'class'; newName: string }>({ isOpen: false, type: 'number', newName: '' });

    // Drag Handlers
    const handleDragOver = (e: React.DragEvent) => {
        if (mode === 'edit') {
            e.preventDefault(); // Enable Drop
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        if (mode !== 'edit') return;
        e.preventDefault();
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data && data.student && onMoveStudent) {
                // Ignore if dropping on same class
                // But fromClass is in data.
                onMoveStudent(data.student, data.fromClass, classInfo.name);
            }
        } catch (err) {
            console.error('Drop parse error', err);
        }
    };

    const handleDragStart = (e: React.DragEvent, student: TimetableStudent) => {
        if (mode !== 'edit') return;
        if (student.withdrawalDate || student.enrollmentDate) {
            e.preventDefault(); // Withdrawn or New students are not draggable
            return;
        }
        e.dataTransfer.setData('text/plain', JSON.stringify({
            student,
            fromClass: classInfo.name
        }));
    };

    // Cost Optimization: Use centralized data from parent instead of individual onSnapshot
    // Fallback to empty if prop not provided (backward compatibility)
    useEffect(() => {
        if (classStudentData) {
            setStudents(classStudentData.studentList || []);
        } else {
            setStudents([]);
        }
    }, [classStudentData]);

    // Compute Display List (DB + Local Changes)
    useEffect(() => {
        let currentList = [...students];

        if (moveChanges) {
            // 1. Remove students moved OUT
            currentList = currentList.filter(s => {
                const change = moveChanges.get(s.id);
                // If there is a change where fromClass is THIS class, remove it.
                // Unless it moved back here (handled in handleMoveStudent logic, the entry is delted if moving back)
                // So if an entry exists, it means it is moved somewhere else.
                return !(change && change.fromClass === classInfo.name);
            });

            // 2. Add students moved IN
            moveChanges.forEach(change => {
                if (change.toClass === classInfo.name) {
                    // Check duplicate to be safe
                    if (!currentList.find(s => s.id === change.student.id)) {
                        // Mark as temporary for highlighting
                        const tempStudent = { ...change.student, isTempMoved: true };
                        currentList.push(tempStudent);
                    }
                }
            });
        }

        // Update Count (Active Only)
        const activeCount = currentList.filter(s => !s.withdrawalDate && !s.onHold).length;
        setStudentCount(activeCount);
        setDisplayStudents(currentList);

    }, [students, moveChanges, classInfo.name]);

    return (
        <>
            <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`w-[280px] flex flex-col border-r border-gray-300 shrink-0 bg-white transition-opacity ${isHidden && mode === 'edit' ? 'opacity-50' : ''} ${mode === 'edit' ? 'hover:bg-gray-50' : ''}`}
            >
                {/* Header - 키워드 색상 적용 */}
                {(() => {
                    const matchedKw = classKeywords.find(kw => classInfo.name?.includes(kw.keyword));
                    return (
                        <div
                            className="p-2 text-center font-bold text-sm border-b border-gray-300 flex items-center justify-center h-[50px] break-keep leading-tight relative group"
                            style={matchedKw ? { backgroundColor: matchedKw.bgColor, color: matchedKw.textColor } : { backgroundColor: '#EFF6FF', color: '#1F2937' }}
                        >
                            {classInfo.name}
                            {/* Edit Controls: Menu & Hide (Edit Mode Only) */}
                            {mode === 'edit' && (
                                <>
                                    {/* Hide Toggle - Right 7 (approx 28px left of menu) */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onToggleHidden(); }}
                                        className="absolute top-1 right-7 p-1 rounded hover:bg-black/10 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title={isHidden ? "보이기" : "숨기기"}
                                    >
                                        {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                                    </button>

                                    {/* Menu Button - Right 1 */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onMenuToggle(!isMenuOpen); }}
                                        className="absolute top-1 right-1 p-1 rounded hover:bg-black/10 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <MoreVertical size={14} />
                                    </button>

                                    {/* Level Up Dropdown */}
                                    {isMenuOpen && (
                                        <div className="absolute top-8 right-1 bg-white shadow-lg rounded-lg border border-gray-200 z-20 py-1 min-w-[140px]" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={() => {
                                                    // Check if class level is valid
                                                    if (!isValidLevel(classInfo.name, englishLevels)) {
                                                        alert(`'${classInfo.name}' 수업은 레벨 설정에 등록되지 않았습니다.\n\n영어 레벨 설정에서 해당 레벨을 추가해주세요.`);
                                                        onMenuToggle(false);
                                                        return;
                                                    }

                                                    const newName = numberLevelUp(classInfo.name);
                                                    if (newName) {
                                                        setLevelUpModal({ isOpen: true, type: 'number', newName });
                                                    }
                                                    onMenuToggle(false);
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-indigo-50 text-gray-700"
                                            >
                                                <TrendingUp size={14} className="text-indigo-500" />
                                                숫자 레벨업
                                            </button>
                                            <button
                                                onClick={() => {
                                                    // Check if class level is valid
                                                    if (!isValidLevel(classInfo.name, englishLevels)) {
                                                        alert(`'${classInfo.name}' 수업은 레벨 설정에 등록되지 않았습니다.\n\n영어 레벨 설정에서 해당 레벨을 추가해주세요.`);
                                                        onMenuToggle(false);
                                                        return;
                                                    }

                                                    const newName = classLevelUp(classInfo.name, englishLevels);
                                                    if (newName) {
                                                        setLevelUpModal({ isOpen: true, type: 'class', newName });
                                                    }
                                                    onMenuToggle(false);
                                                }}
                                                disabled={isMaxLevel(classInfo.name, englishLevels)}
                                                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${isMaxLevel(classInfo.name, englishLevels) ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-orange-50 text-gray-700'}`}
                                            >
                                                <ArrowUpCircle size={14} className={isMaxLevel(classInfo.name, englishLevels) ? 'text-gray-300' : 'text-orange-500'} />
                                                클래스 레벨업
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })()}

                {/* Info Summary (Teacher/Room) */}
                {(displayOptions?.showTeacher || displayOptions?.showRoom) && (
                    <div className="bg-orange-50 border-b border-gray-300 text-xs flex flex-col">
                        {displayOptions?.showTeacher && (
                            <div className="flex border-b border-orange-200">
                                <div className="w-[70px] bg-orange-100 p-1 text-center font-bold border-r border-orange-200 flex items-center justify-center text-orange-800">
                                    담임
                                </div>
                                <div className="flex-1 p-1 text-center font-bold text-gray-900 flex items-center justify-center">
                                    {classInfo.mainTeacher}
                                </div>
                            </div>
                        )}
                        {displayOptions?.showRoom && (
                            <div className="flex">
                                <div className="w-[70px] bg-orange-100 p-1 text-center font-bold border-r border-orange-200 flex items-center justify-center text-orange-800">
                                    강의실
                                </div>
                                <div className="flex-1 p-1 text-center font-bold text-navy flex items-center justify-center break-words px-1 leading-tight py-1.5 min-h-[40px]">
                                    {classInfo.formattedRoomStr || classInfo.mainRoom}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="border-b border-gray-300 flex-none">
                    {/* Grid Header */}
                    <div className="flex bg-gray-200 text-[10px] font-bold border-b border-gray-400 h-[30px]">
                        <div className="w-[48px] flex items-center justify-center border-r border-gray-400 text-gray-600">시간</div>
                        {classInfo.finalDays.map((d) => (
                            <div key={d} className={`flex-1 flex items-center justify-center border-r border-gray-400 last:border-r-0 text-gray-700 ${d === '토' || d === '일' ? 'text-red-600' : ''}`}>
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Grid Rows */}
                    <div className="bg-white">
                        {classInfo.visiblePeriods.map(p => (
                            <MiniGridRow
                                key={p.id}
                                period={p}
                                scheduleMap={classInfo.scheduleMap}
                                weekendShift={classInfo.weekendShift}
                                teachersData={teachersData}
                                displayDays={classInfo.finalDays}
                                hiddenTeachers={hiddenTeacherList}
                            />
                        ))}
                    </div>
                </div>

                {/* Dynamic Content Section: Student List */}
                {displayOptions?.showStudents ? (
                    <div className="flex-1 flex flex-col bg-white min-h-[100px]">
                        <button
                            className={`p-1.5 text-center text-[13px] font-bold border-b border-gray-300 shadow-sm bg-gray-100 text-gray-600 flex items-center justify-center gap-2 transition-colors w-full ${mode === 'edit' ? 'cursor-pointer hover:bg-gray-200' : 'cursor-default'}`}
                            onClick={() => mode === 'edit' && setIsStudentModalOpen(true)}
                            aria-label={`${classInfo.name} 학생 명단 열기. 현재 ${studentCount}명`}
                        >
                            <span>학생 명단</span>
                            <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[12px]">
                                {studentCount}명
                            </span>
                            {mode === 'edit' && <UserPlus size={12} className="text-gray-400" />}
                        </button>
                        {/* Student Name Preview - 3 Section Layout */}
                        <div className="flex-1 overflow-y-auto px-2 py-1.5 text-[10px] flex flex-col">
                            {displayStudents.length === 0 ? (
                                <div
                                    className={`flex flex-col items-center justify-center h-full text-gray-300 ${mode === 'edit' ? 'cursor-pointer hover:text-gray-400' : 'cursor-default'}`}
                                    onClick={() => mode === 'edit' && setIsStudentModalOpen(true)}
                                >
                                    <span>학생이 없습니다</span>
                                    {mode === 'edit' && <span className="text-indigo-400 mt-0.5 hover:underline">+ 추가</span>}
                                </div>
                            ) : (() => {
                                // Split students into 3 groups
                                const activeStudents = displayStudents.filter(s => !s.withdrawalDate && !s.onHold);
                                const holdStudents = displayStudents.filter(s => s.onHold && !s.withdrawalDate);
                                const withdrawnStudents = displayStudents.filter(s => s.withdrawalDate);

                                // Sort active students: Underline(0) → Normal(1) → Pink(2) → Red(3)
                                const sortedActive = [...activeStudents].sort((a, b) => {
                                    const getWeight = (s: TimetableStudent) => {
                                        if (s.underline) return 0; // 1순위: 밑줄
                                        if (s.enrollmentDate) {
                                            const days = Math.ceil((Date.now() - new Date(s.enrollmentDate).getTime()) / (1000 * 60 * 60 * 24));
                                            if (days <= 30) return 3; // 4순위: 1개월차 (Red)
                                            if (days <= 60) return 2; // 3순위: 2개월차 (Pink)
                                        }
                                        return 1; // 2순위: 일반 학생
                                    };
                                    const wA = getWeight(a), wB = getWeight(b);
                                    return wA !== wB ? wA - wB : a.name.localeCompare(b.name, 'ko');
                                });

                                // Helper to get row style based on enrollment date
                                const getRowStyle = (student: TimetableStudent & { isTempMoved?: boolean }) => {
                                    if (student.isTempMoved) return { className: 'bg-green-100 ring-1 ring-green-300', textClass: 'text-green-800 font-bold', subTextClass: 'text-green-600', englishTextClass: 'text-green-700' };

                                    // 반이동 + 밑줄 (우선순위 높음)
                                    if (student.isMoved && student.underline) return { className: 'bg-green-50 ring-1 ring-green-300', textClass: 'underline decoration-blue-600 text-green-800 font-bold underline-offset-2', subTextClass: 'text-green-600', englishTextClass: 'text-green-700' };

                                    // 반이동 (단독)
                                    if (student.isMoved) return { className: 'bg-green-100 ring-1 ring-green-300', textClass: 'text-green-800 font-bold', subTextClass: 'text-green-600', englishTextClass: 'text-green-700' };

                                    if (student.underline) return { className: 'bg-blue-50', textClass: 'underline decoration-blue-600 text-blue-600 underline-offset-2', subTextClass: 'text-blue-500', englishTextClass: 'text-blue-600' };
                                    if (student.enrollmentDate) {
                                        const days = Math.ceil((Date.now() - new Date(student.enrollmentDate).getTime()) / (1000 * 60 * 60 * 24));
                                        if (days <= 30) return { className: 'bg-red-500', textClass: 'text-white font-bold', subTextClass: 'text-white', englishTextClass: 'text-white/80' }; // Red: 붉은 배경, 흰색 글씨
                                        if (days <= 60) return { className: 'bg-pink-100', textClass: 'text-black font-bold', subTextClass: 'text-black', englishTextClass: 'text-gray-600' }; // Pink: 연분홍 배경, 검은 글씨
                                    }
                                    return { className: '', textClass: 'text-gray-800', subTextClass: 'text-gray-500', englishTextClass: 'text-gray-500' };
                                };

                                return (
                                    <>
                                        {/* Active Students Section */}
                                        <div className="flex-1">
                                            {sortedActive.slice(0, 12).map((student: TimetableStudent & { isTempMoved?: boolean }) => {
                                                const style = getRowStyle(student);
                                                return (
                                                    <div
                                                        key={student.id}
                                                        draggable={mode === 'edit' && !student.isTempMoved} // Prevent dragging temp moved items again immediately (optional, but safer)
                                                        onDragStart={(e) => handleDragStart(e, student)}
                                                        className={`flex items-center justify-between text-[13px] py-0.5 px-1 rounded ${style.className} ${mode === 'edit' ? 'cursor-grab active:cursor-grabbing hover:brightness-95' : ''}`}
                                                        title={student.enrollmentDate ? `입학일: ${student.enrollmentDate}` : undefined}
                                                    >
                                                        <span className={`font-medium ${style.textClass}`}>
                                                            {student.name}
                                                            {student.englishName && <span className={`font-normal ${style.englishTextClass || 'text-gray-500'}`}>({student.englishName})</span>}
                                                        </span>
                                                        {(student.school || student.grade) && (
                                                            <span className={`text-[12px] ml-1 ${style.subTextClass || 'text-gray-500'} text-right`}>{student.school}{student.grade}</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {sortedActive.length > 12 && (
                                                <div
                                                    className={`text-indigo-500 font-bold mt-0.5 text-xs ${mode === 'edit' ? 'cursor-pointer hover:underline' : 'cursor-default'}`}
                                                    onClick={() => mode === 'edit' && setIsStudentModalOpen(true)}
                                                >
                                                    +{sortedActive.length - 12}명 더보기...
                                                </div>
                                            )}
                                        </div>

                                        {/* Hold Students Section */}
                                        {holdStudents.length > 0 && (
                                            <div className="mt-2 pt-1 border-t border-yellow-200">
                                                <div className="text-[9px] font-bold text-yellow-700 mb-0.5">대기 ({holdStudents.length})</div>
                                                {holdStudents.slice(0, 3).map((student) => (
                                                    <div key={student.id} className="flex items-center text-xs py-0.5 px-1 bg-yellow-50 rounded text-yellow-800">
                                                        <span className="font-medium">{student.name}</span>
                                                    </div>
                                                ))}
                                                {holdStudents.length > 3 && (
                                                    <span className="text-[9px] text-yellow-600">+{holdStudents.length - 3}명</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Withdrawn Students Section */}
                                        {withdrawnStudents.length > 0 && (
                                            <div className="mt-2 pt-1 border-t border-gray-200">
                                                <div className="text-[9px] font-bold text-gray-400 mb-0.5">퇴원 ({withdrawnStudents.length})</div>
                                                {withdrawnStudents.slice(0, 3).map((student) => (
                                                    <div
                                                        key={student.id}
                                                        className="flex items-center text-[13px] py-0.5 px-1 bg-black rounded text-white"
                                                        title={student.withdrawalDate ? `퇴원일: ${student.withdrawalDate}` : undefined}
                                                    >
                                                        <span>{student.name}</span>
                                                        {student.englishName && <span className="ml-1 text-gray-400">({student.englishName})</span>}
                                                    </div>
                                                ))}
                                                {withdrawnStudents.length > 3 && (
                                                    <span className="text-[9px] text-gray-400">+{withdrawnStudents.length - 3}명</span>
                                                )}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                ) : (
                    // When Students are hidden, fill space or show placeholder
                    !displayOptions?.showTeacher && !displayOptions?.showRoom && (
                        <div className="flex-1 flex flex-col items-center justify-center min-h-[100px] text-gray-300 gap-1 bg-white">
                            <EyeOff size={20} />
                            <span className="text-[10px]">정보 숨김</span>
                        </div>
                    )
                )}
            </div>

            {/* Student Modal */}
            <StudentModal
                isOpen={isStudentModalOpen}
                onClose={() => setIsStudentModalOpen(false)}
                className={classInfo.name}
                teacher={classInfo.mainTeacher}
                currentUser={currentUser}
                readOnly={mode === 'view' || (isSimulationMode && currentUser?.role !== 'master')}
                isSimulationMode={isSimulationMode}
            />

            {/* Level Up Confirm Modal */}
            <LevelUpConfirmModal
                isOpen={levelUpModal.isOpen}
                onClose={() => setLevelUpModal({ ...levelUpModal, isOpen: false })}
                onSuccess={() => {
                    console.log('[EnglishClassTab] Level-up succeeded for', classInfo.name, '→', levelUpModal.newName);
                    // onSnapshot subscription will automatically update scheduleData
                    // Optional: Add user notification here if needed
                }}
                oldClassName={classInfo.name}
                newClassName={levelUpModal.newName}
                type={levelUpModal.type}
            />
        </>
    );
};

export default ClassCard;
