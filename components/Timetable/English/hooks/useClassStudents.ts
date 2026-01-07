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

import { useState, useEffect } from 'react';
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
        const tempDataMap: Record<string, ClassStudentData> = {};

        chunks.forEach((chunk, chunkIndex) => {
            const q = query(
                collection(db, targetCollection),
                where('className', 'in', chunk)
            );

            const unsub = onSnapshot(q, (snapshot) => {
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const className = data.className as string;

                    let studentList: TimetableStudent[] = [];

                    // Prefer studentIds (unified DB) over studentList (legacy)
                    if (data.studentIds && Array.isArray(data.studentIds) && data.studentIds.length > 0) {
                        studentList = data.studentIds
                            .map((id: string) => studentMap[id])
                            .filter(Boolean);
                    } else if (data.studentList && Array.isArray(data.studentList)) {
                        studentList = data.studentList as TimetableStudent[];
                    }

                    tempDataMap[className] = {
                        studentList,
                        studentIds: data.studentIds || []
                    };
                });

                // Only set state when ALL chunks have been processed (last one)
                if (chunkIndex === chunks.length - 1) {
                    setClassDataMap({ ...tempDataMap });
                    setIsLoading(false);
                }
            }, (error) => {
                console.error('[useClassStudents] Error:', error);
                setIsLoading(false);
            });

            unsubscribes.push(unsub);
        });

        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, [classNames.join(','), isSimulationMode, studentMap]);

    return { classDataMap, isLoading };
};
