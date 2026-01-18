import React, { useState } from 'react';
import { Check, X, Underline } from 'lucide-react';
import { TimetableStudent } from '../../../../types';
import { formatSchoolGrade } from '../../../../utils/studentUtils';

interface StudentListTableProps {
    students: TimetableStudent[];
    loading: boolean;
    classDocId: string | null;
    className: string;
    canEdit: boolean;
    onUpdate: (id: string, updates: Partial<TimetableStudent>) => void;
    onRemove: (id: string) => void;
    useEnrollmentsMode?: boolean;  // NEW: enrollments 모드 사용 여부
}

const StudentListTable: React.FC<StudentListTableProps> = ({
    students,
    loading,
    classDocId,
    className,
    canEdit,
    onUpdate,
    onRemove,
    useEnrollmentsMode = false
}) => {
    const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', englishName: '', school: '', grade: '' });

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

    const saveEditing = () => {
        if (!editingStudentId) return;
        onUpdate(editingStudentId, {
            name: editForm.name,
            englishName: editForm.englishName,
            school: editForm.school,
            grade: editForm.grade
        });
        setEditingStudentId(null);
    };

    if (loading) {
        return <div className="text-center py-8 text-gray-400 text-sm">불러오는 중...</div>;
    }

    // enrollments 모드가 아닐 때만 classDocId 체크
    if (!useEnrollmentsMode && !classDocId) {
        return (
            <div className="text-center py-8 text-gray-400 text-sm">
                <p>수업 정보를 찾을 수 없습니다.</p>
                <p className="text-xs mt-1">'{className}'이(가) 등록되어 있는지 확인해주세요.</p>
            </div>
        );
    }

    if (students.length === 0) {
        return <div className="text-center py-8 text-gray-400 text-sm">등록된 학생이 없습니다.</div>;
    }

    const activeList = students.filter(s => !s.withdrawalDate);
    const withdrawnList = students.filter(s => {
        if (!s.withdrawalDate) return false;
        // 30일 지난 학생은 숨김 처리
        const withdrawnDate = new Date(s.withdrawalDate);
        const now = new Date();
        const daysSinceWithdrawal = Math.floor((now.getTime() - withdrawnDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceWithdrawal <= 30;
    });

    return (
        <div className="space-y-1.5">
            {/* Active Students */}
            {activeList.map((student, idx) => (
                <div
                    key={student.id}
                    className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors group ${editingStudentId === student.id ? 'bg-indigo-50 border border-indigo-200' : (student.isMoved ? 'bg-green-50 hover:bg-green-100' : 'bg-gray-50 hover:bg-gray-100')}`}
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
                            <div className={`flex items-center gap-3 flex-1 ${canEdit ? 'cursor-pointer' : ''}`} onClick={() => canEdit && startEditing(student)}>
                                <span className="w-5 h-5 rounded-full bg-[#081429] text-[#fdb813] text-xxs font-bold flex items-center justify-center shrink-0">
                                    {idx + 1}
                                </span>
                                <span className={`font-bold text-sm ${student.underline ? 'underline text-blue-600' : 'text-[#373d41]'} ${student.isMoved ? 'text-blue-600' : ''}`}>
                                    {student.name}
                                    {student.englishName && <span className={`font-normal ${student.underline || student.isMoved ? 'text-blue-400' : 'text-gray-500'}`}>({student.englishName})</span>}
                                </span>
                                {(student.school || student.grade) && (
                                    <span className="text-xs text-gray-400">
                                        {formatSchoolGrade(student.school, student.grade)}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                {canEdit && (
                                    <>
                                        {/* 신입 버튼 */}
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
                                                        // Toggle red/pink logic maintained? Or simpler toggle?
                                                        // Original logic: if red/pink, toggle between them or off?
                                                        // Original code:
                                                        // if diffDays <= 30 -> 1 month.
                                                        // Click logic: 
                                                        // defined in original as:
                                                        /*
                                                        if (diffDays <= 30) {
                                                             // make it older? or off?
                                                             const pastDate = new Date(); pastDate.setDate(pastDate.getDate() - 35);
                                                             nextDate = pastDate...
                                                        } else { nextDate = undefined }
                                                        */
                                                        const pastDate = new Date();
                                                        pastDate.setDate(pastDate.getDate() - 35);
                                                        nextDate = pastDate.toISOString().split('T')[0];
                                                    } else {
                                                        nextDate = undefined;
                                                    }
                                                }
                                                onUpdate(student.id, { enrollmentDate: nextDate, onHold: false, withdrawalDate: undefined, isMoved: false });
                                            }}
                                            className={`px-2 py-0.5 text-xxs flex items-center justify-center rounded border transition-colors ${student.enrollmentDate
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

                                        {/* 밑줄 버튼 */}
                                        <button
                                            onClick={() => onUpdate(student.id, { underline: !student.underline })}
                                            className={`p-1 rounded border transition-colors ${student.underline ? 'bg-blue-600 text-white border-blue-600 shadow-inner' : 'bg-white text-gray-400 border-gray-200 hover:bg-blue-50 hover:text-blue-500 hover:border-blue-200'}`}
                                            title="밑줄 강조"
                                        >
                                            <Underline size={12} />
                                        </button>

                                        {/* 반이동 버튼 */}
                                        <button
                                            onClick={() => {
                                                if (student.isMoved) {
                                                    onUpdate(student.id, { isMoved: false });
                                                } else {
                                                    onUpdate(student.id, { isMoved: true, enrollmentDate: undefined, withdrawalDate: undefined });
                                                }
                                            }}
                                            className={`px-2 py-0.5 text-xxs flex items-center justify-center gap-1 rounded border transition-colors ${student.isMoved
                                                ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                                                : 'bg-white text-gray-400 border-gray-200 hover:bg-green-50 hover:text-green-600'
                                                }`}
                                            title="반이동"
                                        >
                                            <span className="font-bold">반이동</span>
                                        </button>

                                        {/* 퇴원 버튼 */}
                                        <button
                                            onClick={() => {
                                                if (student.underline) {
                                                    alert('밑줄이 표시된 학생은 퇴원 처리할 수 없습니다.\n먼저 밑줄을 해제해주세요.');
                                                    return;
                                                }
                                                if (window.confirm("퇴원 처리 하시겠습니까?")) {
                                                    onUpdate(student.id, { withdrawalDate: new Date().toISOString().split('T')[0], onHold: false, enrollmentDate: undefined, isMoved: false });
                                                }
                                            }}
                                            className="px-2 py-0.5 text-xxs rounded border border-gray-200 text-gray-400 hover:bg-gray-800 hover:text-white hover:border-gray-800 transition-colors"
                                        >
                                            퇴원
                                        </button>

                                        {/* 대기 버튼 */}
                                        <button
                                            onClick={() => onUpdate(student.id, { onHold: !student.onHold, enrollmentDate: undefined, withdrawalDate: undefined })}
                                            className={`px-2 py-0.5 text-xxs rounded border transition-colors ${student.onHold ? 'bg-yellow-400 text-black border-yellow-500 hover:bg-yellow-500 font-bold' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'}`}
                                        >
                                            대기
                                        </button>

                                        {/* 삭제 버튼 */}
                                        <button
                                            onClick={() => onRemove(student.id)}
                                            className="px-2 py-0.5 text-xxs rounded border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
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

            {/* Withdrawn Students */}
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
                                            {formatSchoolGrade(student.school, student.grade)}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {canEdit && (
                                        <>
                                            <button
                                                onClick={() => onUpdate(student.id, { withdrawalDate: undefined })}
                                                className="px-2 py-0.5 text-xxs rounded border transition-colors bg-black text-white border-black hover:bg-gray-800"
                                            >
                                                퇴원 취소
                                            </button>
                                            <button
                                                onClick={() => onRemove(student.id)}
                                                className="px-2 py-0.5 text-xxs rounded border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
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
        </div>
    );
};

export default StudentListTable;
