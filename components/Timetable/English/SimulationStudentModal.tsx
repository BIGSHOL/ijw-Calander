// Simulation Mode Student Assignment Modal
// 시뮬레이션 모드 학생 배정 모달

import React, { useState, useMemo } from 'react';
import { X, Search, UserPlus, UserMinus, Users, ArrowRight } from 'lucide-react';
import { useScenario, ScenarioEnrollment } from './context/SimulationContext';
import { UnifiedStudent } from '../../../types';

interface SimulationStudentModalProps {
    className: string;
    classId: string;
    onClose: () => void;
    studentMap: Record<string, UnifiedStudent>;
}

const SimulationStudentModal: React.FC<SimulationStudentModalProps> = ({
    className,
    classId,
    onClose,
    studentMap,
}) => {
    const scenario = useScenario();
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddPanel, setShowAddPanel] = useState(false);

    // 현재 수업의 학생 목록 (시나리오 데이터에서)
    const currentStudents = useMemo(() => {
        const enrollments = scenario.scenarioEnrollments[className] || {};
        return Object.entries(enrollments)
            .map(([studentId, enrollment]) => {
                const student = studentMap[studentId];
                if (!student || student.status !== 'active') return null;
                return {
                    ...student,
                    id: studentId,
                    enrollment,
                };
            })
            .filter(Boolean) as (UnifiedStudent & { enrollment: ScenarioEnrollment })[];
    }, [scenario.scenarioEnrollments, className, studentMap]);

    // 배정 가능한 학생 목록 (영어 수업에 배정되지 않은 학생)
    const availableStudents = useMemo(() => {
        // 이미 영어 수업에 배정된 학생 ID 수집
        const assignedStudentIds = new Set<string>();
        Object.values(scenario.scenarioEnrollments).forEach(classEnrollments => {
            Object.keys(classEnrollments).forEach(studentId => {
                assignedStudentIds.add(studentId);
            });
        });

        // 배정되지 않은 active 학생만 필터링
        return Object.values(studentMap)
            .filter(student =>
                student.status === 'active' &&
                !assignedStudentIds.has(student.id)
            )
            .filter(student => {
                if (!searchTerm) return true;
                const term = searchTerm.toLowerCase();
                return (
                    student.name?.toLowerCase().includes(term) ||
                    student.englishName?.toLowerCase().includes(term) ||
                    student.school?.toLowerCase().includes(term)
                );
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
    }, [scenario.scenarioEnrollments, studentMap, searchTerm]);

    // 다른 수업에 배정된 학생 (이동 가능)
    const studentsInOtherClasses = useMemo(() => {
        const result: { student: UnifiedStudent; currentClass: string }[] = [];

        Object.entries(scenario.scenarioEnrollments).forEach(([cls, enrollments]) => {
            if (cls === className) return; // 현재 수업 제외

            Object.keys(enrollments).forEach(studentId => {
                const student = studentMap[studentId];
                if (student && student.status === 'active') {
                    if (!searchTerm) {
                        result.push({ student, currentClass: cls });
                    } else {
                        const term = searchTerm.toLowerCase();
                        if (
                            student.name?.toLowerCase().includes(term) ||
                            student.englishName?.toLowerCase().includes(term)
                        ) {
                            result.push({ student, currentClass: cls });
                        }
                    }
                }
            });
        });

        return result.sort((a, b) => (a.student.name || '').localeCompare(b.student.name || '', 'ko'));
    }, [scenario.scenarioEnrollments, className, studentMap, searchTerm]);

    const handleAddStudent = (studentId: string, studentName: string) => {
        scenario.addStudentToClass(className, studentId, {
            enrollmentDate: new Date().toISOString().split('T')[0],
        }, studentName);
    };

    const handleRemoveStudent = (studentId: string, studentName: string) => {
        if (confirm('이 학생을 수업에서 제거하시겠습니까?')) {
            scenario.removeStudentFromClass(className, studentId, studentName);
        }
    };

    const handleMoveStudent = (studentId: string, fromClass: string, studentName: string) => {
        scenario.moveStudent(fromClass, className, studentId, studentName);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center" onClick={onClose}>
            <div
                className="bg-white rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 bg-indigo-600 text-white">
                    <div className="flex items-center gap-2">
                        <Users size={20} />
                        <h2 className="text-lg font-bold">{className} - 학생 배정</h2>
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded">시뮬레이션</span>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* 현재 학생 목록 */}
                    <div className="p-4 border-b">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Users size={16} className="text-indigo-500" />
                                현재 배정된 학생 ({currentStudents.length}명)
                            </h3>
                            <button
                                onClick={() => setShowAddPanel(!showAddPanel)}
                                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                                    showAddPanel
                                        ? 'bg-gray-200 text-gray-700'
                                        : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                }`}
                            >
                                <UserPlus size={14} />
                                {showAddPanel ? '닫기' : '학생 추가'}
                            </button>
                        </div>

                        <div className="max-h-[200px] overflow-y-auto">
                            {currentStudents.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    배정된 학생이 없습니다
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {currentStudents.map(student => (
                                        <div
                                            key={student.id}
                                            className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900">{student.name}</span>
                                                {student.englishName && (
                                                    <span className="text-xs text-gray-500">({student.englishName})</span>
                                                )}
                                                <span className="text-xs text-gray-400">{student.school} {student.grade}</span>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveStudent(student.id, student.name)}
                                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                title="제거"
                                            >
                                                <UserMinus size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 학생 추가 패널 */}
                    {showAddPanel && (
                        <div className="flex-1 overflow-hidden flex flex-col p-4 bg-gray-50">
                            {/* 검색 */}
                            <div className="relative mb-3">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="학생 이름, 영어이름, 학교로 검색..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                {/* 미배정 학생 */}
                                {availableStudents.length > 0 && (
                                    <div className="mb-4">
                                        <h4 className="text-xs font-bold text-gray-500 mb-2">미배정 학생 ({availableStudents.length}명)</h4>
                                        <div className="space-y-1">
                                            {availableStudents.slice(0, 20).map(student => (
                                                <div
                                                    key={student.id}
                                                    className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200 hover:border-indigo-300"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-gray-900">{student.name}</span>
                                                        {student.englishName && (
                                                            <span className="text-xs text-gray-500">({student.englishName})</span>
                                                        )}
                                                        <span className="text-xs text-gray-400">{student.school} {student.grade}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleAddStudent(student.id, student.name || '')}
                                                        className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded"
                                                    >
                                                        <UserPlus size={14} />
                                                        추가
                                                    </button>
                                                </div>
                                            ))}
                                            {availableStudents.length > 20 && (
                                                <div className="text-xs text-gray-500 text-center py-2">
                                                    +{availableStudents.length - 20}명 더 있음 (검색으로 찾기)
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 다른 수업에 배정된 학생 (이동 가능) */}
                                {studentsInOtherClasses.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-500 mb-2">다른 수업 학생 - 이동 가능 ({studentsInOtherClasses.length}명)</h4>
                                        <div className="space-y-1">
                                            {studentsInOtherClasses.slice(0, 10).map(({ student, currentClass }) => (
                                                <div
                                                    key={student.id}
                                                    className="flex items-center justify-between p-2 bg-white rounded-lg border border-orange-200 hover:border-orange-300"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-gray-900">{student.name}</span>
                                                        {student.englishName && (
                                                            <span className="text-xs text-gray-500">({student.englishName})</span>
                                                        )}
                                                        <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">
                                                            {currentClass}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleMoveStudent(student.id, currentClass, student.name || '')}
                                                        className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-orange-600 hover:bg-orange-50 rounded"
                                                    >
                                                        <ArrowRight size={14} />
                                                        이동
                                                    </button>
                                                </div>
                                            ))}
                                            {studentsInOtherClasses.length > 10 && (
                                                <div className="text-xs text-gray-500 text-center py-2">
                                                    +{studentsInOtherClasses.length - 10}명 더 있음 (검색으로 찾기)
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {availableStudents.length === 0 && studentsInOtherClasses.length === 0 && (
                                    <div className="text-center py-8 text-gray-400">
                                        {searchTerm ? '검색 결과가 없습니다' : '추가할 수 있는 학생이 없습니다'}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-4 bg-gray-50 border-t">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SimulationStudentModal;
