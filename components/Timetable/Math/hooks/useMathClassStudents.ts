/**
 * useMathClassStudents - Centralized hook for fetching math class student data
 *
 * PURPOSE: Fetch student data from students/enrollments structure
 * instead of the legacy "이름_학교_학년" format in classes collection.
 *
 * DATA FLOW:
 * 1. Query enrollments collection group for subject='math'
 * 2. Get student IDs from enrollment document paths
 * 3. Map student data from studentMap (unified student DB)
 *
 * USAGE:
 * const { classDataMap, isLoading } = useMathClassStudents(classNames, studentMap);
 * // classDataMap[className] = { studentList: [...], studentIds: [...] }
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { query, where, collectionGroup, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { TimetableStudent } from '../../../../types';

export interface ClassStudentData {
    studentList: TimetableStudent[];
    studentIds: string[];
}

export const useMathClassStudents = (
    classNames: string[],
    studentMap: Record<string, any> = {}
) => {
    const [classDataMap, setClassDataMap] = useState<Record<string, ClassStudentData>>({});
    const [isLoading, setIsLoading] = useState(true);

    // Use Ref to avoid re-subscription when studentMap reference changes
    const studentMapRef = useRef(studentMap);
    useEffect(() => {
        studentMapRef.current = studentMap;
    }, [studentMap]);

    // Memoize classNames to avoid unnecessary re-subscriptions
    const classNamesKey = useMemo(() => [...classNames].sort().join(','), [classNames]);

    useEffect(() => {
        if (classNames.length === 0) {
            setClassDataMap({});
            setIsLoading(false);
            return;
        }

        // Query enrollments collection group for math subject
        // This gets students from students/{studentId}/enrollments
        const enrollmentsQuery = query(
            collectionGroup(db, 'enrollments'),
            where('subject', '==', 'math')
        );

        const unsub = onSnapshot(enrollmentsQuery, (snapshot) => {
            // Build a map of className -> studentIds
            const classStudentMap: Record<string, Set<string>> = {};
            const enrollmentDataMap: Record<string, Record<string, any>> = {}; // className -> studentId -> enrollment data

            // Initialize all requested classes
            classNames.forEach(name => {
                classStudentMap[name] = new Set();
                enrollmentDataMap[name] = {};
            });

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const className = data.className as string;

                // Only process if this class is in our requested list
                if (!classNames.includes(className)) return;

                // Get student ID from document path: students/{studentId}/enrollments/{enrollmentId}
                const studentId = doc.ref.parent.parent?.id;
                if (!studentId) return;

                classStudentMap[className].add(studentId);
                enrollmentDataMap[className][studentId] = {
                    enrollmentDate: data.enrollmentDate || data.startDate,
                    withdrawalDate: data.withdrawalDate,
                    onHold: data.onHold,
                };
            });

            // Convert to ClassStudentData format
            const result: Record<string, ClassStudentData> = {};

            classNames.forEach(className => {
                const studentIds = Array.from(classStudentMap[className] || []);
                const studentList: TimetableStudent[] = studentIds
                    .map(id => {
                        const baseStudent = studentMapRef.current[id];
                        const enrollmentData = enrollmentDataMap[className]?.[id] || {};

                        if (!baseStudent) {
                            // Student not found in studentMap - might be deleted or not loaded yet
                            return null;
                        }

                        return {
                            id,
                            name: baseStudent.name || '',
                            englishName: baseStudent.englishName || '',
                            school: baseStudent.school || '',
                            grade: baseStudent.grade || '',
                            // Merge enrollment-specific data
                            enrollmentDate: enrollmentData.enrollmentDate,
                            withdrawalDate: enrollmentData.withdrawalDate,
                            onHold: enrollmentData.onHold,
                            isMoved: false,
                        } as TimetableStudent;
                    })
                    .filter(Boolean) as TimetableStudent[];

                // Sort by name
                studentList.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

                result[className] = {
                    studentList,
                    studentIds,
                };
            });

            setClassDataMap(result);
            setIsLoading(false);
        }, (error) => {
            console.error('[useMathClassStudents] Error:', error);
            setIsLoading(false);
        });

        return () => unsub();
    }, [classNamesKey]);

    return { classDataMap, isLoading };
};
