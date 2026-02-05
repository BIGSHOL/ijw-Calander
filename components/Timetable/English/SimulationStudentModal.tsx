// Simulation Mode Student Assignment Modal
// 시뮬레이션 모드 학생 배정 모달

import React, { useState, useMemo } from 'react';
import { X, Search, UserPlus, UserMinus, Users, ArrowRight, FlaskConical, Save, RotateCcw } from 'lucide-react';
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
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-start justify-center pt-[8vh]" onClick={onClose}>
            <div
                className="bg-white rounded-sm shadow-2xl w-[600px] max-h-[85vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 bg-indigo-600 text-white">
                    <div className="flex items-center gap-2">
                        <FlaskConical size={20} />
                        <h2 className="text-lg font-bold">{className} - 학생 배정</h2>
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-sm">시뮬레이션</span>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-sm hover:bg-white/20">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {/* Section 1: 시뮬레이션 정보 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <FlaskConical className="w-3 h-3 text-primary" />
                            <h3 className="text-primary font-bold text-xs">시뮬레이션 정보</h3>
                        </div>
                        <div className="px-2 py-1.5">
                            <div className="bg-indigo-50 border border-indigo-200 px-3 py-2 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-indigo-900">현재 수업:</span>
                                    <span className="text-xs text-indigo-700">{className}</span>
                                </div>
                                <div className="text-xxs text-indigo-600">
                                    시뮬레이션 모드에서 변경사항은 임시로 저장됩니다. 시나리오로 저장하여 적용하세요.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: 학생 목록 */}
                    <div className="bg-white border border-gray-200 overflow-hidden">
                        <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                            <div className="flex items-center gap-1">
                                <Users className="w-3 h-3 text-primary" />
                                <h3 className="text-primary font-bold text-xs">학생 목록</h3>
                                <span className="text-xxs text-gray-500 ml-1">({currentStudents.length}명)</span>
                            </div>
                            <button
                                onClick={() => setShowAddPanel(!showAddPanel)}
                                className={`flex items-center gap-1 px-2 py-1 text-xxs font-bold rounded-sm transition-colors ${
                                    showAddPanel
                                        ? 'bg-gray-200 text-gray-700'
                                        : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                }`}
                            >
                                <UserPlus size={12} />
                                {showAddPanel ? '닫기' : '학생 추가'}
                            </button>
                        </div>

                        <div className="max-h-[200px] overflow-y-auto">
                            {currentStudents.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-xs">
                                    배정된 학생이 없습니다
                                </div>
                            ) : (
                                <div className="p-2 space-y-1">
                                    {currentStudents.map(student => (
                                        <div
                                            key={student.id}
                                            className="flex items-center justify-between p-2 bg-gray-50 rounded-sm hover:bg-gray-100 border border-gray-200"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900 text-xs">{student.name}</span>
                                                {student.englishName && (
                                                    <span className="text-xxs text-gray-500">({student.englishName})</span>
                                                )}
                                                <span className="text-xxs text-gray-400">{student.school} {student.grade}</span>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveStudent(student.id, student.name)}
                                                className="p-1 text-red-500 hover:bg-red-50 rounded-sm"
                                                title="제거"
                                            >
                                                <UserMinus size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Section 3: 학생 추가 */}
                    {showAddPanel && (
                        <div className="bg-white border border-gray-200 overflow-hidden">
                            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                <UserPlus className="w-3 h-3 text-primary" />
                                <h3 className="text-primary font-bold text-xs">학생 추가</h3>
                            </div>
                            <div className="p-2 space-y-2">
                                {/* 검색 */}
                                <div className="relative">
                                    <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="학생 이름, 영어이름, 학교로 검색..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-sm text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>

                                <div className="max-h-[300px] overflow-y-auto space-y-2">
                                    {/* 미배정 학생 */}
                                    {availableStudents.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-1 mb-1.5">
                                                <span className="text-xxs font-bold text-gray-500">미배정 학생</span>
                                                <span className="text-xxs text-gray-400">({availableStudents.length}명)</span>
                                            </div>
                                            <div className="space-y-1">
                                                {availableStudents.slice(0, 20).map(student => (
                                                    <div
                                                        key={student.id}
                                                        className="flex items-center justify-between p-2 bg-white rounded-sm border border-gray-200 hover:border-indigo-300"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-gray-900 text-xs">{student.name}</span>
                                                            {student.englishName && (
                                                                <span className="text-xxs text-gray-500">({student.englishName})</span>
                                                            )}
                                                            <span className="text-xxs text-gray-400">{student.school} {student.grade}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleAddStudent(student.id, student.name || '')}
                                                            className="flex items-center gap-1 px-2 py-1 text-xxs font-bold text-indigo-600 hover:bg-indigo-50 rounded-sm"
                                                        >
                                                            <UserPlus size={12} />
                                                            추가
                                                        </button>
                                                    </div>
                                                ))}
                                                {availableStudents.length > 20 && (
                                                    <div className="text-xxs text-gray-500 text-center py-1.5 bg-gray-50 rounded-sm">
                                                        +{availableStudents.length - 20}명 더 있음 (검색으로 찾기)
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* 다른 수업에 배정된 학생 (이동 가능) */}
                                    {studentsInOtherClasses.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-1 mb-1.5">
                                                <span className="text-xxs font-bold text-gray-500">다른 수업 학생</span>
                                                <span className="text-xxs text-gray-400">({studentsInOtherClasses.length}명)</span>
                                                <span className="text-xxs text-orange-600 ml-1">- 이동 가능</span>
                                            </div>
                                            <div className="space-y-1">
                                                {studentsInOtherClasses.slice(0, 10).map(({ student, currentClass }) => (
                                                    <div
                                                        key={student.id}
                                                        className="flex items-center justify-between p-2 bg-white rounded-sm border border-orange-200 hover:border-orange-300"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-gray-900 text-xs">{student.name}</span>
                                                            {student.englishName && (
                                                                <span className="text-xxs text-gray-500">({student.englishName})</span>
                                                            )}
                                                            <span className="text-xxs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-sm">
                                                                {currentClass}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleMoveStudent(student.id, currentClass, student.name || '')}
                                                            className="flex items-center gap-1 px-2 py-1 text-xxs font-bold text-orange-600 hover:bg-orange-50 rounded-sm"
                                                        >
                                                            <ArrowRight size={12} />
                                                            이동
                                                        </button>
                                                    </div>
                                                ))}
                                                {studentsInOtherClasses.length > 10 && (
                                                    <div className="text-xxs text-gray-500 text-center py-1.5 bg-gray-50 rounded-sm">
                                                        +{studentsInOtherClasses.length - 10}명 더 있음 (검색으로 찾기)
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {availableStudents.length === 0 && studentsInOtherClasses.length === 0 && (
                                        <div className="text-center py-8 text-gray-400 text-xs">
                                            {searchTerm ? '검색 결과가 없습니다' : '추가할 수 있는 학생이 없습니다'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-4 bg-gray-50 border-t">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-sm transition-colors"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SimulationStudentModal;
