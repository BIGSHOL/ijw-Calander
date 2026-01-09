/**
 * useClassStudents - Centralized hook for fetching class student data
 * 
 * PURPOSE: Replace individual onSnapshot listeners in ClassCard with a single
 * centralized fetch. This significantly reduces Firebase read costs.
 * 
 * USAGE:
 * const { classDataMap, isLoading } = useClassStudents(classNames, isSimulationMode);
 * // classDataMap[className] = { studentList: [...], studentIds: [...] }
 */

import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { CLASS_COLLECTION, CLASS_DRAFT_COLLECTION } from '../englishUtils';
import { TimetableStudent } from '../../../../types';

export interface ClassStudentData {
    studentList: TimetableStudent[];
    studentIds: string[];
}

export const useClassStudents = (
    classNames: string[],
    isSimulationMode: boolean = false,
    studentMap: Record<string, any> = {}
) => {
    const [classDataMap, setClassDataMap] = useState<Record<string, ClassStudentData>>({});
    const [isLoading, setIsLoading] = useState(true);

    // Use Ref to avoid re-subscription when studentMap reference changes
    const studentMapRef = useRef(studentMap);
    useEffect(() => {
        studentMapRef.current = studentMap;
    }, [studentMap]);

    useEffect(() => {
        if (classNames.length === 0) {
            setClassDataMap({});
            setIsLoading(false);
            return;
        }

        const targetCollection = isSimulationMode ? CLASS_DRAFT_COLLECTION : CLASS_COLLECTION;

        // Single onSnapshot for ALL classes (instead of one per class)
        // Firestore 'in' queries support up to 30 values, so we chunk if needed
        const CHUNK_SIZE = 30;
        const chunks: string[][] = [];
        for (let i = 0; i < classNames.length; i += CHUNK_SIZE) {
            chunks.push(classNames.slice(i, i + CHUNK_SIZE));
        }

        const unsubscribes: (() => void)[] = [];

        chunks.forEach((chunk, chunkIndex) => {
            const q = query(
                collection(db, targetCollection),
                where('className', 'in', chunk)
            );

            const unsub = onSnapshot(q, (snapshot) => {
                // Update state immediately for this chunk
                setClassDataMap(prevMap => {
                    const updatedMap = { ...prevMap };

                    snapshot.docs.forEach(doc => {
                        const data = doc.data();
                        const className = data.className as string;

                        let studentList: TimetableStudent[] = [];

                        // Get the original studentList from the class document (contains underline, enrollmentDate, etc.)
                        const originalStudentList = (data.studentList || []) as TimetableStudent[];

                        // If using studentIds (unified DB), merge with original properties
                        if (data.studentIds && Array.isArray(data.studentIds) && data.studentIds.length > 0) {
                            studentList = data.studentIds.map((id: string, index: number) => {
                                const baseStudent = studentMapRef.current[id];
                                // Find matching student in original list by id or index
                                const originalStudent = originalStudentList.find(s => s.id === id)
                                    || originalStudentList[index];

                                if (baseStudent) {
                                    // Merge: base from unified DB + original properties (underline, enrollmentDate, withdrawalDate, onHold)
                                    return {
                                        ...baseStudent,
                                        underline: originalStudent?.underline ?? baseStudent.underline,
                                        enrollmentDate: originalStudent?.enrollmentDate ?? baseStudent.enrollmentDate,
                                        withdrawalDate: originalStudent?.withdrawalDate ?? baseStudent.withdrawalDate,
                                        onHold: originalStudent?.onHold ?? baseStudent.onHold,
                                    };
                                }
                                return originalStudent || null;
                            }).filter(Boolean);
                        } else {
                            // Legacy: use studentList directly (already has all properties)
                            studentList = originalStudentList;
                        }

                        updatedMap[className] = {
                            studentList,
                            studentIds: data.studentIds || []
                        };
                    });

                    return updatedMap;
                });

                setIsLoading(false);
            }, (error) => {
                console.error('[useClassStudents] Error:', error);
                setIsLoading(false);
            });

            unsubscribes.push(unsub);
        });

        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, [classNames.join(','), isSimulationMode]);

    return { classDataMap, isLoading };
};
