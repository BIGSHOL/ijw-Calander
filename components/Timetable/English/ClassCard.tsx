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
    isTimeColumnOnly?: boolean;
    hideTime?: boolean;
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
    classStudentData, // Cost Optimization: Centralized fetch
    isTimeColumnOnly = false,
    hideTime = false
}) => {
    // Width Logic:
    // Normal: 190px (includes 48px time + 142px days) -> Update logic if needed, but for now only changing hideTime width
    // HideTime: 160px (User requested increase from 142px)
    // TimeColumnOnly: 49px (48px time + 1px border)
    const cardWidthClass = isTimeColumnOnly ? 'w-[49px]' : (hideTime ? 'w-[160px]' : 'w-[190px]');

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
                onDragOver={isTimeColumnOnly ? undefined : handleDragOver}
                onDrop={isTimeColumnOnly ? undefined : handleDrop}
                className={`${cardWidthClass} h-full flex flex-col border-r border-gray-300 shrink-0 bg-white ${mode === 'edit' && !isTimeColumnOnly ? 'hover:bg-gray-50' : ''}`}
            >
                {/* Header - 키워드 색상 적용 */}
                {(() => {
                    const matchedKw = classKeywords.find(kw => classInfo.name?.includes(kw.keyword));

                    // If TimeColumnOnly, render generic empty style but keep height
                    if (isTimeColumnOnly) {
                        return (
                            <div className="p-2 text-center font-bold text-sm border-b border-orange-300 flex items-center justify-center h-[50px] bg-orange-200 text-orange-900 select-none">
                                수업
                            </div>
                        );
                    }

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
                            <div className={`flex border-b border-orange-200 h-[26px] ${isTimeColumnOnly ? 'bg-orange-100 justify-center items-center' : 'bg-orange-50'}`}>
                                {isTimeColumnOnly ? (
                                    <span className="font-bold text-orange-800">담임</span>
                                ) : (
                                    <div className="flex-1 p-0.5 text-center font-bold text-gray-900 flex items-center justify-center h-full">
                                        {classInfo.mainTeacher}
                                    </div>
                                )}
                            </div>
                        )}
                        {displayOptions?.showRoom && (
                            <div className={`flex h-[32px] ${isTimeColumnOnly ? 'bg-orange-100 justify-center items-center' : 'bg-orange-50'}`}>
                                {isTimeColumnOnly ? (
                                    <span className="font-bold text-orange-800">강의실</span>
                                ) : (
                                    <div className="flex-1 p-0.5 text-center font-bold text-navy flex items-center justify-center break-all h-full leading-tight text-xs">
                                        {classInfo.formattedRoomStr || classInfo.mainRoom || '-'}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="border-b border-gray-300 flex-none">
                    {/* Grid Header */}
                    <div className="flex bg-gray-200 text-xxs font-bold border-b border-gray-400 h-[24px]">
                        {!hideTime && (
                            <div className="w-[48px] flex items-center justify-center border-r border-gray-400 text-gray-600">시간</div>
                        )}
                        {/* If TimeOnly, don't show days header or keep it blank? TimeOnly usually implies just the time labels on the left. */}
                        {!isTimeColumnOnly && classInfo.finalDays.map((d) => (
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
                                hideTime={hideTime}
                                onlyTime={isTimeColumnOnly}
                            />
                        ))}
                    </div>
                </div>

                {/* Dynamic Content Section: Student List - 3 Sections */}
                {displayOptions?.showStudents ? (
                    isTimeColumnOnly ? (
                        // Sticky Column: 3 Labels (재원생, 대기, 퇴원생)
                        <div className="flex flex-col border-r border-gray-300">
                            {/* 재원생 Label - Fixed Height */}
                            <div className="h-[290px] flex flex-col items-center justify-center bg-indigo-50 text-indigo-900 font-bold text-sm leading-relaxed select-none border-b border-indigo-100">
                                <span>재</span>
                                <span>원</span>
                                <span>생</span>
                            </div>
                            {/* 대기 Label */}
                            <div className="flex items-center justify-center bg-violet-100 text-violet-700 font-bold text-xs h-[40px] border-b border-violet-200 select-none">
                                대기
                            </div>
                            {/* 퇴원생 Label */}
                            <div className="flex items-center justify-center bg-gray-100 text-gray-600 font-bold text-xs h-[80px] select-none">
                                퇴원
                            </div>
                        </div>
                    ) : (
                        // Data Column: 3 Sections with Content
                        <div className="flex flex-col bg-white border-r border-gray-300">
                            {/* 재원생 Section - Fixed Height */}
                            <div className="h-[290px] flex flex-col border-b border-indigo-100">
                                <div className="border-b border-gray-300 flex items-center justify-center h-[30px] shrink-0 bg-white">
                                    <button
                                        className={`w-full h-full text-center text-[13px] font-bold bg-indigo-50 text-indigo-600 flex items-center justify-center gap-2 transition-colors ${mode === 'edit' ? 'cursor-pointer hover:bg-indigo-100' : 'cursor-default'}`}
                                        onClick={(e) => {
                                            if (mode === 'edit') {
                                                e.stopPropagation();
                                                setIsStudentModalOpen(true);
                                            }
                                        }}
                                    >
                                        {mode === 'edit' && <UserPlus size={14} />}
                                        <span>{studentCount}명</span>
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto px-2 py-1.5 text-xxs flex flex-col custom-scrollbar">
                                    {(() => {
                                        const activeStudents = displayStudents.filter(s => !s.withdrawalDate && !s.onHold);

                                        if (activeStudents.length === 0) {
                                            return (
                                                <div
                                                    className={`flex flex-col items-center justify-center h-full text-gray-300 ${mode === 'edit' ? 'cursor-pointer hover:text-gray-400' : 'cursor-default'}`}
                                                    onClick={() => mode === 'edit' && setIsStudentModalOpen(true)}
                                                >
                                                    <span>학생이 없습니다</span>
                                                    {mode === 'edit' && <span className="text-indigo-400 mt-0.5 hover:underline">+ 추가</span>}
                                                </div>
                                            );
                                        }

                                        // Sort active students
                                        const sortedActive = [...activeStudents].sort((a, b) => {
                                            const getWeight = (s: TimetableStudent) => {
                                                if (s.underline) return 0;
                                                if (s.enrollmentDate) {
                                                    const days = Math.ceil((Date.now() - new Date(s.enrollmentDate).getTime()) / (1000 * 60 * 60 * 24));
                                                    if (days <= 30) return 3;
                                                    if (days <= 60) return 2;
                                                }
                                                return 1;
                                            };
                                            const wA = getWeight(a), wB = getWeight(b);
                                            return wA !== wB ? wA - wB : a.name.localeCompare(b.name, 'ko');
                                        });

                                        const getRowStyle = (student: TimetableStudent & { isTempMoved?: boolean }) => {
                                            if (student.isTempMoved) return { className: 'bg-green-100 ring-1 ring-green-300', textClass: 'text-green-800 font-bold', subTextClass: 'text-green-600', englishTextClass: 'text-green-700' };
                                            if (student.isMoved && student.underline) return { className: 'bg-green-50 ring-1 ring-green-300', textClass: 'underline decoration-blue-600 text-green-800 font-bold underline-offset-2', subTextClass: 'text-green-600', englishTextClass: 'text-green-700' };
                                            if (student.isMoved) return { className: 'bg-green-100 ring-1 ring-green-300', textClass: 'text-green-800 font-bold', subTextClass: 'text-green-600', englishTextClass: 'text-green-700' };
                                            if (student.underline) return { className: 'bg-blue-50', textClass: 'underline decoration-blue-600 text-blue-600 underline-offset-2', subTextClass: 'text-blue-500', englishTextClass: 'text-blue-600' };
                                            if (student.enrollmentDate) {
                                                const days = Math.ceil((Date.now() - new Date(student.enrollmentDate).getTime()) / (1000 * 60 * 60 * 24));
                                                if (days <= 30) return { className: 'bg-red-500', textClass: 'text-white font-bold', subTextClass: 'text-white', englishTextClass: 'text-white/80' };
                                                if (days <= 60) return { className: 'bg-pink-100', textClass: 'text-black font-bold', subTextClass: 'text-black', englishTextClass: 'text-gray-600' };
                                            }
                                            return { className: '', textClass: 'text-gray-800', subTextClass: 'text-gray-500', englishTextClass: 'text-gray-500' };
                                        };

                                        return (
                                            <>
                                                {sortedActive.slice(0, 12).map((student: TimetableStudent & { isTempMoved?: boolean }) => {
                                                    const style = getRowStyle(student);
                                                    return (
                                                        <div
                                                            key={student.id}
                                                            draggable={mode === 'edit' && !student.isTempMoved}
                                                            onDragStart={(e) => handleDragStart(e, student)}
                                                            className={`flex items-center justify-between text-[12px] py-0.5 px-1 rounded ${style.className} ${mode === 'edit' ? 'cursor-grab active:cursor-grabbing hover:brightness-95' : ''}`}
                                                            title={student.enrollmentDate ? `입학일: ${student.enrollmentDate}` : undefined}
                                                        >
                                                            <span className={`font-medium truncate ${style.textClass} max-w-[90px]`}>
                                                                {student.name}
                                                                {student.englishName && <span className={`font-normal ml-0.5 ${style.englishTextClass || 'text-gray-500'}`}>({student.englishName})</span>}
                                                            </span>
                                                            <span className={`text-micro ml-1 shrink-0 ${style.subTextClass || 'text-gray-500'} text-right leading-none`}>
                                                                {student.school?.replace(/초등학교|중학교/g, '') || ''}{student.grade}
                                                            </span>
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
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* 대기 Section - Fixed Height */}
                            <div className="h-[40px] flex items-center bg-violet-50 border-b border-violet-200 px-2 overflow-hidden">
                                {(() => {
                                    const holdStudents = displayStudents.filter(s => s.onHold && !s.withdrawalDate);
                                    if (holdStudents.length === 0) {
                                        return <span className="text-xxs text-violet-300">-</span>;
                                    }
                                    return (
                                        <div className="flex flex-wrap gap-1 text-xxs">
                                            {holdStudents.slice(0, 3).map(s => (
                                                <span key={s.id} className="bg-violet-100 text-violet-800 px-1 rounded">{s.name}</span>
                                            ))}
                                            {holdStudents.length > 3 && <span className="text-violet-600">+{holdStudents.length - 3}</span>}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* 퇴원생 Section - Fixed Height with Original Display */}
                            <div className="h-[80px] flex flex-col bg-gray-100 px-2 py-1 overflow-y-auto custom-scrollbar">
                                {(() => {
                                    const withdrawnStudents = displayStudents.filter(s => s.withdrawalDate);
                                    if (withdrawnStudents.length === 0) {
                                        return <span className="text-xxs text-gray-500 flex items-center justify-center h-full">-</span>;
                                    }
                                    return (
                                        <>
                                            {withdrawnStudents.slice(0, 3).map((student) => (
                                                <div
                                                    key={student.id}
                                                    className="flex items-center justify-between text-[12px] py-0.5 px-1 bg-black rounded text-white mb-0.5"
                                                    title={student.withdrawalDate ? `퇴원일: ${student.withdrawalDate}` : undefined}
                                                >
                                                    <div className="flex items-center truncate max-w-[90px]">
                                                        <span className="font-medium">{student.name}</span>
                                                        {student.englishName && <span className="ml-1 text-gray-400">({student.englishName})</span>}
                                                    </div>
                                                    <span className="text-xxs ml-1 shrink-0 text-gray-300 text-right leading-none">
                                                        {student.school?.replace(/초등학교|중학교/g, '') || ''}{student.grade}
                                                    </span>
                                                </div>
                                            ))}
                                            {withdrawnStudents.length > 3 && (
                                                <span className="text-micro text-gray-400">+{withdrawnStudents.length - 3}명</span>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    )
                ) : (
                    // When Students are hidden, fill space or show placeholder
                    !isTimeColumnOnly && !displayOptions?.showTeacher && !displayOptions?.showRoom && (
                        <div className="flex-1 flex flex-col items-center justify-center min-h-[100px] text-gray-300 gap-1 bg-white">
                            <EyeOff size={20} />
                            <span className="text-xxs">정보 숨김</span>
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
