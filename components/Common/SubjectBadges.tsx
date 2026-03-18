import React from 'react';
import type { Enrollment } from '../../types/student';

// 과목 표시 순서
const SUBJECT_ORDER: Record<string, number> = {
    math: 1, highmath: 2, english: 3, korean: 4, science: 5,
};

// 과목 라벨 (축약형)
const SUBJECT_SHORT: Record<string, string> = {
    math: '수', highmath: '고수', english: '영', korean: '국', science: '과',
};

// 과목 전체 라벨
const SUBJECT_FULL: Record<string, string> = {
    math: '수학', highmath: '고등수학', english: '영어', korean: '국어', science: '과학',
};

// 과목별 배지 색상
const BADGE_STYLES: Record<string, string> = {
    math: 'bg-amber-100 text-amber-800',
    highmath: 'bg-purple-100 text-purple-800',
    english: 'bg-blue-100 text-blue-800',
    korean: 'bg-red-100 text-red-700',
    science: 'bg-emerald-100 text-emerald-800',
};

/**
 * 학생의 enrollments에서 활성 과목 배지를 추출하여 렌더링
 */
export function getActiveSubjects(enrollments?: Enrollment[]): string[] {
    if (!enrollments || enrollments.length === 0) return [];
    const today = new Date().toISOString().slice(0, 10);
    const subjects = new Set<string>();
    enrollments.forEach(e => {
        if (e.endDate || e.withdrawalDate) return; // 종료된 수업 제외
        const start = e.startDate || e.enrollmentDate;
        if (start && start > today) return; // 미래 배정 제외
        if (e.subject && e.subject !== 'other') subjects.add(e.subject);
    });
    return Array.from(subjects).sort((a, b) => (SUBJECT_ORDER[a] || 99) - (SUBJECT_ORDER[b] || 99));
}

interface SubjectBadgesProps {
    enrollments?: Enrollment[];
    /** 'short' = 수/영/과, 'full' = 수학/영어/과학 */
    labelType?: 'short' | 'full';
    className?: string;
}

/**
 * 학생의 과목 배지를 표시하는 공통 컴포넌트
 */
export default function SubjectBadges({ enrollments, labelType = 'full', className = '' }: SubjectBadgesProps) {
    const subjects = getActiveSubjects(enrollments);
    if (subjects.length === 0) return null;

    const labels = labelType === 'short' ? SUBJECT_SHORT : SUBJECT_FULL;

    return (
        <span className={`inline-flex items-center gap-0.5 ${className}`}>
            {subjects.map(subject => (
                <span
                    key={subject}
                    className={`text-micro px-1 rounded-sm font-medium leading-tight ${BADGE_STYLES[subject] || 'bg-gray-100 text-gray-700'}`}
                >
                    {labels[subject] || subject}
                </span>
            ))}
        </span>
    );
}
