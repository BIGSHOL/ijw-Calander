import React, { useMemo } from 'react';
import { TimetableClass } from '../../../../types';
import { getSubjectTheme } from '../utils/gridUtils';

interface ClassCardProps {
    cls: TimetableClass;
    span: number;
    searchQuery: string;
    showStudents: boolean;
    showClassName: boolean;
    showSchool: boolean;
    showGrade: boolean;
    canEdit: boolean;
    dragOverClassId: string | null;
    onClick: (cls: TimetableClass) => void;
    onDragStart: (e: React.DragEvent, studentId: string, fromClassId: string) => void;
    onDragOver: (e: React.DragEvent, classId: string) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, toClassId: string) => void;
    studentMap: Record<string, any>;
}

const ClassCard: React.FC<ClassCardProps> = ({
    cls,
    span,
    searchQuery,
    showStudents,
    showClassName,
    showSchool,
    showGrade,
    canEdit,
    dragOverClassId,
    onClick,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    studentMap
}) => {
    const theme = getSubjectTheme(cls.subject);
    const hasSearchMatch = searchQuery && cls.studentList?.some(s => s.name.includes(searchQuery));
    const sortedStudents = useMemo(() => {
        if (!cls.studentIds) return cls.studentList && cls.studentList.length > 0 ? [...cls.studentList].sort((a, b) => a.name.localeCompare(b.name, 'ko')) : [];

        return cls.studentIds
            .map(id => studentMap[id])
            .filter(Boolean)
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }, [cls.studentIds, cls.studentList, studentMap]);

    return (
        <div
            onClick={() => canEdit && onClick(cls)}
            onDragOver={(e) => canEdit && onDragOver(e, cls.id)}
            onDragLeave={canEdit ? onDragLeave : undefined}
            onDrop={(e) => canEdit && onDrop(e, cls.id)}
            className={`flex flex-col rounded-lg border ${theme.border} ${theme.bg} overflow-hidden shadow-sm transition-all mb-1 ${dragOverClassId === cls.id ? 'ring-2 ring-indigo-400 scale-[1.02]' : (canEdit ? 'hover:shadow-md cursor-pointer' : '')} ${hasSearchMatch ? 'ring-2 ring-yellow-400' : ''}`}
            style={{
                minHeight: span > 1 ? `${span * 80}px` : undefined
            }}
        >
            {/* Class Name Header */}
            {showClassName && (
                <div className={`text-center font-bold py-1 px-1 text-[10px] border-b ${theme.border} bg-white/50 text-gray-800`}>
                    ({cls.className})
                </div>
            )}

            {/* Student List */}
            {showStudents && (
                <div className="flex-1 p-1 max-h-[150px] overflow-y-auto">
                    <ul className="flex flex-col gap-0.5">
                        {sortedStudents.map(s => {
                            const isHighlighted = searchQuery && s.name.includes(searchQuery);
                            // Format: Name/School/Grade
                            let displayText = s.name;
                            if (showSchool && s.school) {
                                displayText += `/${s.school}`;
                            }
                            if (showGrade && s.grade) {
                                displayText += showSchool ? s.grade : `/${s.grade}`;
                            }
                            return (
                                <li
                                    key={s.id}
                                    draggable={canEdit}
                                    onDragStart={(e) => canEdit && onDragStart(e, s.id, cls.id)}
                                    className={`py-0.5 px-1 rounded text-center text-[10px] transition-colors truncate flex items-center justify-between group
                                    ${canEdit ? 'cursor-grab' : ''}
                                    ${isHighlighted ? 'bg-yellow-300 font-bold text-black' : `hover:bg-white/80 ${theme.text}`}`}
                                >
                                    <span className="truncate flex-1">{displayText}</span>
                                    <span className="text-gray-400 opacity-0 group-hover:opacity-100 ml-1">⋮</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {/* Footer with Student Count */}
            <div className={`text-center py-1 font-bold border-t ${theme.border} ${theme.bg} text-[9px] ${theme.text}`}>
                총 {cls.studentList?.length || 0}명
            </div>
        </div>
    );
};

export default ClassCard;
