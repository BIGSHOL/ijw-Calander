/**
 * linkStudentsToClasses.ts
 * 
 * Script to populate `studentIds` in `TimetableClass` documents
 * by generating IDs from the existing `studentList`.
 * 
 * Run via Browser Console:
 * await linkStudentsToClasses(true)  // Dry Run
 * await linkStudentsToClasses(false) // Execute
 */

import {
    collection,
    getDocs,
    doc,
    writeBatch
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { TimetableClass, TimetableStudent } from '../types';

const COL_CLASSES = '수업목록';

interface LinkResult {
    totalClasses: number;
    classesUpdated: number;
    totalLinksCreated: number;
    errors: string[];
}

function getStudentId(student: TimetableStudent): string {
    const name = student.name?.trim() || '';
    const school = (student.school || 'Unspecified').trim();
    const grade = (student.grade || 'Unspecified').trim();
    return `${name}_${school}_${grade}`;
}

export async function linkStudentsToClasses(dryRun = true): Promise<LinkResult> {
    const result: LinkResult = {
        totalClasses: 0,
        classesUpdated: 0,
        totalLinksCreated: 0,
        errors: [],
    };

    try {
        console.log(`\n=== Link Students to Classes ${dryRun ? '(DRY RUN)' : '(LIVE)'} ===\n`);

        const classesSnapshot = await getDocs(collection(db, COL_CLASSES));
        result.totalClasses = classesSnapshot.size;
        console.log(`Found ${result.totalClasses} classes.`);

        const batch = writeBatch(db);
        let batchCount = 0;
        let pendingUpdates = false;

        classesSnapshot.forEach((docSnap) => {
            const classData = { id: docSnap.id, ...docSnap.data() } as TimetableClass;
            const studentList = classData.studentList || [];

            if (studentList.length === 0) {
                return;
            }

            const studentIds = studentList.map(s => getStudentId(s));

            // Only update if we have IDs
            if (studentIds.length > 0) {
                const classRef = doc(db, COL_CLASSES, classData.id);

                if (!dryRun) {
                    batch.update(classRef, { studentIds: studentIds });
                    batchCount++;
                    pendingUpdates = true;
                }

                result.classesUpdated++;
                result.totalLinksCreated += studentIds.length;

                if (dryRun) {
                    console.log(`[${classData.className}] Would link ${studentIds.length} students: ${studentIds.join(', ')}`);
                }
            }
        });

        if (!dryRun && pendingUpdates) {
            await batch.commit();
            console.log(`\n✅ Successfully updated ${result.classesUpdated} classes with student IDs.`);
        } else if (dryRun) {
            console.log(`\n[DRY RUN] Would update ${result.classesUpdated} classes.`);
        }

    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(errMsg);
        console.error('Linking error:', errMsg);
    }

    return result;
}

// Browser console export
if (typeof window !== 'undefined') {
    (window as any).linkStudentsToClasses = linkStudentsToClasses;
    console.log("✅ linkStudentsToClasses script loaded. Run `await linkStudentsToClasses(true)` to test.");
}
