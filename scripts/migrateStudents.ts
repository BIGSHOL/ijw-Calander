/**
 * migrateStudents.ts
 * 
 * Migration script to extract students from `수업목록` collection
 * and populate the new `students` unified collection.
 * 
 * Run via: npx ts-node scripts/migrateStudents.ts
 * Or in browser console after importing the function.
 */

import {
    collection,
    getDocs,
    doc,
    setDoc,
    writeBatch,
    query
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UnifiedStudent, TimetableClass, TimetableStudent } from '../types';

const COL_CLASSES = '수업목록';
const COL_STUDENTS = 'students';

interface MigrationResult {
    totalClasses: number;
    totalStudentsFound: number;
    uniqueStudentsMigrated: number;
    duplicatesSkipped: number;
    errors: string[];
}

/**
 * Generate a unique key for duplicate detection
 * Based on: name + school + grade
 */
function getStudentKey(student: TimetableStudent): string {
    const name = student.name?.trim() || '';
    const school = student.school?.trim() || '';
    const grade = student.grade?.trim() || '';
    return `${name}|${school}|${grade}`.toLowerCase();
}

/**
 * Determine subject based on class data
 */
function inferSubject(classData: TimetableClass): 'math' | 'english' {
    const subject = classData.subject?.toLowerCase() || '';
    if (subject.includes('영어') || subject.includes('english')) {
        return 'english';
    }
    return 'math'; // Default to math
}

/**
 * Create UnifiedStudent from TimetableStudent
 */
function createUnifiedStudent(
    student: TimetableStudent,
    classData: TimetableClass,
    existingId?: string
): Omit<UnifiedStudent, 'id'> {
    const now = new Date().toISOString();

    return {
        name: student.name || '',
        englishName: student.englishName || null,
        school: student.school || '',
        grade: student.grade || '',

        subject: inferSubject(classData),
        teacherIds: classData.teacher ? [classData.teacher] : [],

        status: student.withdrawalDate ? 'withdrawn' :
            student.onHold ? 'on_hold' : 'active',
        startDate: student.enrollmentDate || now.split('T')[0],
        endDate: student.withdrawalDate || null,

        // Attendance-related fields
        days: classData.schedule?.map(s => s.split(' ')[0]) || [],
        group: classData.className,

        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Main migration function
 * @param dryRun If true, only simulates migration without writing
 */
export async function migrateStudentsFromTimetable(dryRun = true): Promise<MigrationResult> {
    const result: MigrationResult = {
        totalClasses: 0,
        totalStudentsFound: 0,
        uniqueStudentsMigrated: 0,
        duplicatesSkipped: 0,
        errors: [],
    };

    const seenStudents = new Map<string, { student: TimetableStudent; classData: TimetableClass }>();

    try {
        console.log(`\n=== Student Migration ${dryRun ? '(DRY RUN)' : '(LIVE)'} ===\n`);

        // 0. Cleanup existing students if LIVE run (to prevent duplicates with old random IDs)
        if (!dryRun) {
            console.log('🧹 Cleaning up existing students collection...');
            const existingQuery = query(collection(db, COL_STUDENTS));
            const existingDocs = await getDocs(existingQuery);
            const deleteBatch = writeBatch(db);
            let deleteCount = 0;

            existingDocs.forEach(doc => {
                deleteBatch.delete(doc.ref);
                deleteCount++;
            });

            if (deleteCount > 0) {
                await deleteBatch.commit();
                console.log(`✨ Deleted ${deleteCount} existing student records.`);
            } else {
                console.log('No existing records to clean.');
            }
        }

        // 1. Fetch all classes from 수업목록
        const classesSnapshot = await getDocs(collection(db, COL_CLASSES));
        result.totalClasses = classesSnapshot.size;
        console.log(`Found ${result.totalClasses} classes in ${COL_CLASSES}`);

        // 2. Extract all students and detect duplicates
        classesSnapshot.forEach((docSnap) => {
            const classData = { id: docSnap.id, ...docSnap.data() } as TimetableClass;
            const studentList = classData.studentList || [];

            studentList.forEach((student) => {
                result.totalStudentsFound++;
                const key = getStudentKey(student);

                if (seenStudents.has(key)) {
                    result.duplicatesSkipped++;
                    console.log(`  [DUPLICATE] ${student.name} (${student.school} ${student.grade})`);
                } else {
                    seenStudents.set(key, { student, classData });
                }
            });
        });

        console.log(`\nTotal students found: ${result.totalStudentsFound}`);
        console.log(`Unique students: ${seenStudents.size}`);
        console.log(`Duplicates skipped: ${result.duplicatesSkipped}`);

        // 3. Write to students collection (batch write)
        if (!dryRun) {
            const batch = writeBatch(db);
            let batchCount = 0;
            const MAX_BATCH_SIZE = 500;

            for (const [key, { student, classData }] of seenStudents) {
                // Generate Custom ID: Name_School_Grade
                // Sanitize to remove invalid chars if necessary, but keep Korean
                const safeName = student.name.trim();
                const safeSchool = (student.school || 'Unspecified').trim();
                const safeGrade = (student.grade || 'Unspecified').trim();
                const customId = `${safeName}_${safeSchool}_${safeGrade}`;

                // Check for ID collision in this batch (shouldn't happen due to Map dedupe, but good for safety)
                // For live run, we use the custom ID
                const studentDocRef = doc(db, COL_STUDENTS, customId);
                const studentData = createUnifiedStudent(student, classData);

                // Add to batch
                batch.set(studentDocRef, studentData);
                batchCount++;
                result.uniqueStudentsMigrated++;

                // Commit batch if reaching limit
                if (batchCount >= MAX_BATCH_SIZE) {
                    await batch.commit();
                    console.log(`Committed batch of ${batchCount} students`);
                    batchCount = 0;
                }
            }

            // Commit remaining
            if (batchCount > 0) {
                await batch.commit();
                console.log(`Committed final batch of ${batchCount} students`);
            }

            console.log(`\n✅ Migration complete! ${result.uniqueStudentsMigrated} students migrated.`);
        } else {
            result.uniqueStudentsMigrated = seenStudents.size;
            console.log(`\n[DRY RUN] Would migrate ${seenStudents.size} unique students.`);
            console.log('Run with dryRun=false to execute migration.');
        }

    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(errMsg);
        console.error('Migration error:', errMsg);
    }

    return result;
}

// Export for use in browser console or other scripts
export type { MigrationResult };

// Browser console export
if (typeof window !== 'undefined') {
    (window as any).migrateStudentsFromTimetable = migrateStudentsFromTimetable;
}
