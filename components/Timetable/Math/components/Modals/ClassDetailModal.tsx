import React from 'react';
import { Users, Settings, X, Trash2 } from 'lucide-react';
import { TimetableClass, TimetableStudent } from '../../../../../types';
import { ALL_WEEKDAYS, MATH_PERIODS, ENGLISH_PERIODS, MATH_PERIOD_TIMES } from '../../../constants';
import { formatSchoolGrade } from '../../../../../utils/studentUtils';

interface ClassDetailModalProps {
    selectedClass: TimetableClass | null;
    onClose: () => void;
    isEditingClass: boolean;
    setIsEditingClass: (value: boolean) => void;
    editRoom: string;
    setEditRoom: (value: string) => void;
    editSchedule: string[];
    toggleEditScheduleSlot: (day: string, period: string) => void;
    handleUpdateClass: () => void;
    handleDeleteClass: (classId: string) => void;

    // Student Management
    newStudentName: string;
    setNewStudentName: (value: string) => void;
    newStudentSchool: string;
    setNewStudentSchool: (value: string) => void;
    newStudentGrade: string;
    setNewStudentGrade: (value: string) => void;
    handleAddStudent: () => void;
    handleRemoveStudent: (studentId: string) => void;
    handleWithdrawal: (studentId: string) => void;
    handleRestoreStudent: (studentId: string) => void;
    handleDragStart: (e: React.DragEvent, studentId: string, classId: string) => void;
    studentMap: Record<string, any>;
}

const ClassDetailModal: React.FC<ClassDetailModalProps> = ({
    selectedClass,
    onClose,
    isEditingClass,
    setIsEditingClass,
    editRoom,
    setEditRoom,
    editSchedule,
    toggleEditScheduleSlot,
    handleUpdateClass,
    handleDeleteClass,
    newStudentName,
    setNewStudentName,
    newStudentSchool,
    setNewStudentSchool,
    newStudentGrade,
    setNewStudentGrade,
    handleAddStudent,
    handleRemoveStudent,
    handleWithdrawal,
    handleRestoreStudent,
    handleDragStart,
    studentMap
}) => {
    if (!selectedClass) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className={`bg-white rounded-xl shadow-2xl ${isEditingClass ? 'w-full max-w-2xl' : 'w-[400px]'} max-h-[90vh] overflow-hidden flex flex-col transition-all duration-300`} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-base font-bold flex items-center gap-2 text-[#081429]">
                        <Users size={18} className="text-[#fdb813]" />
                        {selectedClass.className}
                        {isEditingClass && <span className="text-xs text-gray-400 font-normal">(수정 중)</span>}
                    </h3>
                    {!isEditingClass && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsEditingClass(true)}
                                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                title="수업 수정"
                            >
                                <Settings size={18} />
                            </button>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                                <X size={18} />
                            </button>
                        </div>
                    )}
                </div>

                {isEditingClass ? (
                    // Edit View
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                        {/* Room Edit */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">교실</label>
                            <input
                                type="text"
                                value={editRoom}
                                onChange={(e) => setEditRoom(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] outline-none"
                                placeholder="교실 입력 (예: 301호)"
                            />
                        </div>

                        {/* Schedule Edit */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-2">시간표</label>
                            <div className="flex">
                                {/* Time labels column */}
                                <div className="flex flex-col mr-2">
                                    <div className="text-xs font-bold text-gray-400 mb-1 h-[24px]"></div>
                                    {(selectedClass.subject === '수학' ? MATH_PERIODS : ENGLISH_PERIODS).map(period => (
                                        <div key={period} className="text-xxs text-gray-600 font-bold h-[32px] flex items-center justify-end pr-2 whitespace-nowrap">
                                            {MATH_PERIOD_TIMES[period] || period}
                                        </div>
                                    ))}
                                </div>
                                {/* Days grid */}
                                <div className="grid grid-cols-7 gap-1 flex-1">
                                    {ALL_WEEKDAYS.map(day => (
                                        <div key={day} className="text-center">
                                            <div className={`text-xs font-bold mb-1 ${(day === '토' || day === '일') ? 'text-orange-500' : 'text-gray-500'}`}>{day}</div>
                                            {(selectedClass.subject === '수학' ? MATH_PERIODS : ENGLISH_PERIODS).map(period => {
                                                const slot = `${day} ${period}`;
                                                const isSelected = editSchedule.includes(slot);
                                                return (
                                                    <button
                                                        key={slot}
                                                        onClick={() => toggleEditScheduleSlot(day, period)}
                                                        className={`w-full p-1.5 text-xs rounded mb-1 transition-all ${isSelected
                                                            ? 'bg-[#fdb813] text-[#081429] font-bold shadow-sm'
                                                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                            }`}
                                                        title={MATH_PERIOD_TIMES[period] || ''}
                                                    >
                                                        {period.replace('교시', '')}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Normal View (Students) - 영어 스타일 UI 적용
                    <>
                        {/* Sub Header with Student Count */}
                        <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-2 text-sm">
                            <span className="text-gray-500">담당강사</span>
                            <span className="text-[#373d41] font-bold">{selectedClass.teacher || '-'}</span>
                            {selectedClass.room && <span className="text-gray-400">| {selectedClass.room}</span>}
                            <span className="text-gray-300">|</span>
                            <span className="bg-[#fdb813] text-[#081429] px-2 py-0.5 rounded font-bold text-xs">
                                {selectedClass.studentList?.length || 0}명
                            </span>
                        </div>

                        {/* Add Student Form - 영어 스타일 그리드 레이아웃 */}
                        <div className="p-4 border-b border-gray-100 bg-gray-50">
                            <div className="flex items-end gap-2">
                                <div className="flex-1 grid grid-cols-3 gap-2">
                                    <div className="col-span-1">
                                        <label className="text-xxs text-gray-500 font-bold mb-1 block">이름</label>
                                        <input
                                            type="text"
                                            value={newStudentName}
                                            onChange={(e) => setNewStudentName(e.target.value)}
                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none"
                                            placeholder="이름"
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()}
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-xxs text-gray-500 font-bold mb-1 block">학교</label>
                                        <input
                                            type="text"
                                            value={newStudentSchool}
                                            onChange={(e) => setNewStudentSchool(e.target.value)}
                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none"
                                            placeholder="학교"
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()}
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-xxs text-gray-500 font-bold mb-1 block">학년</label>
                                        <input
                                            type="text"
                                            value={newStudentGrade}
                                            onChange={(e) => setNewStudentGrade(e.target.value)}
                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none"
                                            placeholder="학년"
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()}
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleAddStudent}
                                    disabled={!newStudentName.trim()}
                                    className="px-4 py-1.5 bg-[#fdb813] text-[#081429] rounded font-bold text-sm hover:bg-[#e5a712] disabled:opacity-50 h-[34px]"
                                >
                                    추가
                                </button>
                            </div>
                        </div>

                        {/* Student List - IntegrationClassCard 스타일 (재원생/대기/퇴원 섹션) */}
                        <div className="flex-1 overflow-y-auto max-h-[400px]">
                            {(() => {
                                const studentList = selectedClass.studentList || [];
                                // 재원생: 퇴원 아니고, 휴원 아닌 학생
                                const activeList = studentList.filter(s => !s.withdrawalDate && !s.onHold);
                                // 대기: 휴원(onHold) 학생
                                const holdList = studentList.filter(s => s.onHold && !s.withdrawalDate);
                                // 퇴원: withdrawalDate가 있고 반이동(isTransferred)이 아닌 학생
                                const withdrawnList = studentList.filter(s => s.withdrawalDate && !s.isTransferred);

                                return (
                                    <>
                                        {/* 재원생 섹션 */}
                                        <div className="border-b border-indigo-100">
                                            <div className="bg-indigo-50 text-indigo-600 px-4 py-2 text-sm font-bold flex items-center gap-2">
                                                <Users size={14} />
                                                재원생 ({activeList.length}명)
                                            </div>
                                            <div className="px-4 py-2 space-y-1 max-h-[180px] overflow-y-auto">
                                                {activeList.length === 0 ? (
                                                    <div className="text-center text-gray-300 py-4 text-sm">-</div>
                                                ) : (
                                                    activeList.map((student, idx) => (
                                                        <div
                                                            key={student.id}
                                                            draggable
                                                            onDragStart={(e) => handleDragStart(e, student.id, selectedClass.id)}
                                                            className="flex items-center justify-between py-1.5 px-2 rounded bg-gray-50 hover:bg-gray-100 cursor-grab group transition-colors"
                                                        >
                                                            <div className="flex items-center gap-2 flex-1">
                                                                <span className="w-5 h-5 rounded-full bg-[#081429] text-[#fdb813] text-xxs font-bold flex items-center justify-center shrink-0">
                                                                    {idx + 1}
                                                                </span>
                                                                <span className="font-bold text-sm text-[#373d41]">{student.name}</span>
                                                                {(student.school || student.grade) && (
                                                                    <span className="text-xs text-gray-400">{formatSchoolGrade(student.school, student.grade)}</span>
                                                                )}
                                                            </div>
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => handleWithdrawal(student.id)}
                                                                    className="px-2 py-0.5 text-xxs rounded border border-gray-200 text-gray-400 hover:bg-gray-800 hover:text-white hover:border-gray-800 transition-colors"
                                                                >
                                                                    퇴원
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRemoveStudent(student.id)}
                                                                    className="px-2 py-0.5 text-xxs rounded border bg-white text-red-400 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
                                                                >
                                                                    삭제
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        {/* 대기 섹션 (휴원 학생) */}
                                        <div className="border-b border-pink-200">
                                            <div className="bg-pink-50 text-pink-600 px-4 py-2 text-sm font-bold">
                                                대기 ({holdList.length}명)
                                            </div>
                                            <div className="bg-pink-50/50 px-4 py-2 space-y-1 max-h-[100px] overflow-y-auto">
                                                {holdList.length === 0 ? (
                                                    <div className="text-center text-pink-300 py-2 text-sm">-</div>
                                                ) : (
                                                    holdList.map((student) => (
                                                        <div
                                                            key={student.id}
                                                            className="flex items-center justify-between py-1.5 px-2 rounded bg-amber-50 text-amber-800 group"
                                                        >
                                                            <div className="flex items-center gap-2 flex-1">
                                                                <span className="font-medium text-sm">{student.name}</span>
                                                                {(student.school || student.grade) && (
                                                                    <span className="text-xs text-amber-600">{formatSchoolGrade(student.school, student.grade)}</span>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={() => handleRestoreStudent(student.id)}
                                                                className="px-2 py-0.5 text-xxs rounded bg-amber-600 text-white hover:bg-amber-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                복구
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        {/* 퇴원 섹션 */}
                                        <div>
                                            <div className="bg-gray-100 text-gray-600 px-4 py-2 text-sm font-bold">
                                                퇴원 ({withdrawnList.length}명)
                                            </div>
                                            <div className="bg-gray-50 px-4 py-2 space-y-1 max-h-[100px] overflow-y-auto">
                                                {withdrawnList.length === 0 ? (
                                                    <div className="text-center text-gray-300 py-2 text-sm">-</div>
                                                ) : (
                                                    withdrawnList.map((student) => (
                                                        <div
                                                            key={student.id}
                                                            className="flex items-center justify-between py-1.5 px-2 rounded bg-black text-white group"
                                                            title={student.withdrawalDate ? `퇴원일: ${student.withdrawalDate}` : undefined}
                                                        >
                                                            <div className="flex items-center gap-2 flex-1">
                                                                <span className="font-medium text-sm">{student.name}</span>
                                                                {(student.school || student.grade) && (
                                                                    <span className="text-xs text-gray-300">{formatSchoolGrade(student.school, student.grade)}</span>
                                                                )}
                                                            </div>
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => handleRestoreStudent(student.id)}
                                                                    className="px-2 py-0.5 text-xxs rounded bg-yellow-500 text-black hover:bg-yellow-400"
                                                                >
                                                                    복구
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRemoveStudent(student.id)}
                                                                    className="px-2 py-0.5 text-xxs rounded bg-red-600 text-white hover:bg-red-500"
                                                                >
                                                                    삭제
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </>
                )}

                {/* Footer */}
                <div className="flex justify-between items-center p-4 border-t bg-gray-50">
                    {isEditingClass ? (
                        <>
                            <button
                                onClick={() => setIsEditingClass(false)}
                                className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm font-bold"
                            >
                                취소
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleUpdateClass}
                                    className="px-5 py-2 bg-[#fdb813] text-[#081429] rounded-lg text-sm font-bold hover:brightness-110"
                                >
                                    저장
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => handleDeleteClass(selectedClass.id)}
                                className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm font-bold flex items-center gap-1"
                            >
                                <Trash2 size={14} /> 삭제
                            </button>
                            <button onClick={onClose} className="px-5 py-2 bg-[#081429] text-white rounded-lg text-sm font-bold hover:bg-[#1e293b]">
                                닫기
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClassDetailModal;
