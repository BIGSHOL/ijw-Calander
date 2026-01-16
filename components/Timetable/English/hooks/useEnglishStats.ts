/**
 * useEnglishStats - Student statistics for English timetable
 *
 * PURPOSE: Fetch student statistics from students/enrollments structure
 * instead of the legacy 수업목록 collection.
 *
 * DATA FLOW:
 * 1. Query enrollments collection group for subject='english'
 * 2. Calculate stats based on enrollment data and student status
 */

import { useState, useEffect, useRef } from 'react';
import { query, where, collectionGroup, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';

interface ScheduleCell {
    className?: string;
    room?: string;
    teacher?: string;
    note?: string;
    merged?: { className: string; room?: string, teacher?: string, underline?: boolean }[];
    underline?: boolean;
}

type ScheduleData = Record<string, ScheduleCell>;

export const useEnglishStats = (
    scheduleData: ScheduleData,
    isSimulationMode: boolean,
    studentMap: Record<string, any> = {}
) => {
    const [studentStats, setStudentStats] = useState({ active: 0, new1: 0, new2: 0, withdrawn: 0 });

    // Use Ref to avoid re-subscription when studentMap reference changes
    const studentMapRef = useRef(studentMap);
    useEffect(() => {
        studentMapRef.current = studentMap;
    }, [studentMap]);

    useEffect(() => {
        // Get unique class names from scheduleData
        const classNames = new Set<string>();
        Object.values(scheduleData).forEach(cell => {
            if (cell.className) classNames.add(cell.className);
            if (cell.merged) {
                cell.merged.forEach(m => {
                    if (m.className) classNames.add(m.className);
                });
            }
        });

        if (classNames.size === 0) {
            setStudentStats({ active: 0, new1: 0, new2: 0, withdrawn: 0 });
            return;
        }

        // Query enrollments collection group for english subject
        const enrollmentsQuery = query(
            collectionGroup(db, 'enrollments'),
            where('subject', '==', 'english')
        );

        const unsub = onSnapshot(enrollmentsQuery, (snapshot) => {
            const now = new Date();
            let active = 0, new1 = 0, new2 = 0, withdrawn = 0;

            // Track unique students to avoid double-counting (a student can have multiple enrollments)
            const countedStudents = new Set<string>();

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const className = data.className as string;

                // Only process if this class is in our scheduleData
                if (!classNames.has(className)) return;

                // Get student ID from document path
                const studentId = doc.ref.parent.parent?.id;
                if (!studentId) return;

                // Skip if already counted this student
                if (countedStudents.has(studentId)) return;
                countedStudents.add(studentId);

                // Get student base info
                const baseStudent = studentMapRef.current[studentId];

                // Withdrawn check (from enrollment data)
                if (data.withdrawalDate) {
                    const withdrawnDate = new Date(data.withdrawalDate);
                    const daysSinceWithdrawal = Math.floor((now.getTime() - withdrawnDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysSinceWithdrawal <= 30) {
                        withdrawn++;
                    }
                    return;
                }

                // On hold check
                if (data.onHold) return;

                // Check student status from studentMap
                if (baseStudent && baseStudent.status !== 'active') return;

                active++;

                // New student check
                const enrollmentDate = data.enrollmentDate || data.startDate;
                if (enrollmentDate) {
                    const enrollDate = new Date(enrollmentDate);
                    const daysSinceEnroll = Math.floor((now.getTime() - enrollDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysSinceEnroll <= 30) {
                        new1++;
                    } else if (daysSinceEnroll <= 60) {
                        new2++;
                    }
                }
            });

            setStudentStats({ active, new1, new2, withdrawn });
        });

        return () => unsub();
    }, [scheduleData, isSimulationMode]);

    return studentStats;
};
