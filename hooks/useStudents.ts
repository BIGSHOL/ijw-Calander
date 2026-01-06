import { useState, useEffect, useCallback } from 'react';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    Timestamp,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UnifiedStudent } from '../types';

export const COL_STUDENTS = 'students';

// Hook for fetching and managing students
export function useStudents() {
    const [students, setStudents] = useState<UnifiedStudent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Subscribe to all active students (default)
    useEffect(() => {
        setLoading(true);
        const q = query(
            collection(db, COL_STUDENTS),
            where('status', '!=', 'withdrawn') // Default filters usually exclude withdrawn
            // orderBy('name') // Requires composite index with status != withdrawn
        );

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const studentList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as UnifiedStudent));

                // Client-side sort by name to avoid index requirements for now
                studentList.sort((a, b) => a.name.localeCompare(b.name));

                setStudents(studentList);
                setLoading(false);
            },
            (err) => {
                console.error("Error fetching students:", err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // One-off fetch for specific student
    const getStudent = useCallback(async (id: string) => {
        try {
            const docRef = doc(db, COL_STUDENTS, id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() } as UnifiedStudent;
            }
            return null;
        } catch (err) {
            console.error("Error getting student:", err);
            throw err;
        }
    }, []);

    // Create student
    const addStudent = useCallback(async (studentData: Omit<UnifiedStudent, 'id' | 'createdAt' | 'updatedAt'>) => {
        try {
            const now = new Date().toISOString();
            const docRef = await addDoc(collection(db, COL_STUDENTS), {
                ...studentData,
                createdAt: now,
                updatedAt: now,
            });
            return docRef.id;
        } catch (err) {
            console.error("Error adding student:", err);
            throw err;
        }
    }, []);

    // Update student
    const updateStudent = useCallback(async (id: string, updates: Partial<UnifiedStudent>) => {
        try {
            const docRef = doc(db, COL_STUDENTS, id);
            const now = new Date().toISOString();
            await updateDoc(docRef, {
                ...updates,
                updatedAt: now,
            });
        } catch (err) {
            console.error("Error updating student:", err);
            throw err;
        }
    }, []);

    // Delete (or soft delete) student
    const deleteStudent = useCallback(async (id: string, hardDelete = false) => {
        try {
            const docRef = doc(db, COL_STUDENTS, id);
            if (hardDelete) {
                await deleteDoc(docRef);
            } else {
                // Soft delete (mark as withdrawn)
                const now = new Date().toISOString();
                await updateDoc(docRef, {
                    status: 'withdrawn',
                    updatedAt: now,
                    endDate: now
                });
            }
        } catch (err) {
            console.error("Error deleting student:", err);
            throw err;
        }
    }, []);

    return {
        students,
        loading,
        error,
        getStudent,
        addStudent,
        updateStudent,
        deleteStudent
    };
}
