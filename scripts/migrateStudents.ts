/**
 * migrateStudents.ts
 * 
 * Migration script to extract students from `수업목록` collection
 * and populate the new `students` unified collection.
 * 
 * v5: Uses english_schedules teacher count logic for homeroom determination
 *     Removes deprecated subjects/teacherIds fields
 * 
 * Run via browser console.
 */

import {
    collection,
    getDocs,
    doc,
    writeBatch,
    query
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UnifiedStudent, TimetableClass, TimetableStudent, Enrollment, Teacher } from '../types';

const COL_CLASSES = '수업목록';
const COL_STUDENTS = 'students';
const COL_ENGLISH_SCHEDULES = 'english_schedules';
const COL_TEACHERS = '강사목록';

interface MigrationResult {
    totalClasses: number;
    totalStudentsFound: number;
    uniqueStudentsMigrated: number;
    duplicatesSkipped: number;
    errors: string[];
}

// Manual mapping for teacher name normalization
const TEACHER_NAME_MAP: Record<string, string> = {
    '민주': '김민주',
    '성우': '이성우',
    '정은': '김은정',
    '희영': '이희영',
    '서영': '윤서영',
    '승아': '이승아',
    '윤하': '김윤하',
    'minju': '김민주',
};

function normalizeTeacherName(name: string | undefined): string | undefined {
    if (!name) return undefined;
    const trimmed = name.trim();
    return TEACHER_NAME_MAP[trimmed] || trimmed;
}

function getStudentKey(student: TimetableStudent): string {
    const name = student.name?.trim() || '';
    const school = student.school?.trim() || '';
    const grade = student.grade?.trim() || '';
    return `${name}|${school}|${grade}`.toLowerCase();
}

function inferSubject(classData: TimetableClass): 'math' | 'english' {
    const subject = classData.subject?.toLowerCase() || '';
    if (subject.includes('영어') || subject.includes('english')) {
        return 'english';
    }
    return 'math';
}

function extractTeacherFromClassId(classId: string): string | undefined {
    const parts = classId.split('_');
    if (parts.length >= 2) {
        return parts[1];
    }
    return undefined;
}

// Accumulated student data during migration
interface StudentAccumulatedData {
    student: TimetableStudent;
    enrollments: Enrollment[];
    days: Set<string>;
    groups: Set<string>;
    firstClassData: TimetableClass;
}

/**
 * Fetch English Class -> Homeroom Teacher mapping
 * Uses teacher count logic: Most frequent teacher (non-native preferred when tied)
 * 
 * Structure: Document ID = Teacher Name, Fields = {key: {className, room, ...}, ...}
 * where key format is "Teacher-Period-Day"
 */
async function fetchEnglishHomeroomMap(teachersData: Teacher[]): Promise<Record<string, string>> {
    console.log('Fetching English schedules to build Class->Homeroom map...');
    const classTeacherCounts: Record<string, Record<string, number>> = {};

    try {
        const snap = await getDocs(collection(db, COL_ENGLISH_SCHEDULES));
        snap.forEach(docSnap => {
            const teacherName = docSnap.id; // Document ID is the teacher name
            const data = docSnap.data();

            // Iterate through all fields in the document
            // Each field key is like "Ellen-2-월" and value is {className, room, ...}
            Object.entries(data).forEach(([fieldKey, cellData]: [string, any]) => {
                if (!cellData || typeof cellData !== 'object') return;

                const className = cellData.className;
                if (!className) return;

                // Use document ID (teacher name) as the teacher
                const teacher = teacherName;

                if (!classTeacherCounts[className]) {
                    classTeacherCounts[className] = {};
                }
                classTeacherCounts[className][teacher] = (classTeacherCounts[className][teacher] || 0) + 1;

                // Also handle merged classes if present
                if (cellData.merged && Array.isArray(cellData.merged)) {
                    cellData.merged.forEach((m: any) => {
                        if (m.className) {
                            if (!classTeacherCounts[m.className]) {
                                classTeacherCounts[m.className] = {};
                            }
                            classTeacherCounts[m.className][teacher] = (classTeacherCounts[m.className][teacher] || 0) + 1;
                        }
                    });
                }
            });
        });

        console.log(`Found schedules for ${Object.keys(classTeacherCounts).length} english classes.`);
    } catch (e) {
        console.error("Failed to fetch english schedules:", e);
    }

    // Determine homeroom for each class
    const homeroomMap: Record<string, string> = {};

    for (const [className, counts] of Object.entries(classTeacherCounts)) {
        const entries = Object.entries(counts);
        if (entries.length === 0) continue;

        const maxCount = Math.max(...entries.map(([, count]) => count));
        const topTeachers = entries.filter(([, count]) => count === maxCount);

        let homeroom: string;
        if (topTeachers.length === 1) {
            homeroom = topTeachers[0][0];
        } else {
            // Prefer non-native teacher when tied
            const nonNative = topTeachers.filter(([name]) => {
                const teacherData = teachersData.find(t => t.name === name);
                return !teacherData?.isNative;
            });
            homeroom = nonNative.length > 0 ? nonNative[0][0] : topTeachers[0][0];
        }

        homeroomMap[className] = normalizeTeacherName(homeroom) || homeroom;
    }

    console.log(`Built homeroom map for ${Object.keys(homeroomMap).length} english classes.`);
    return homeroomMap;
}

/**
 * Fetch teachers data for native check
 */
async function fetchTeachersData(): Promise<Teacher[]> {
    try {
        const snap = await getDocs(collection(db, COL_TEACHERS));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher));
    } catch (e) {
        console.error("Failed to fetch teachers:", e);
        return [];
    }
}

/**
 * Main migration function
 */
export async function migrateStudentsFromTimetable(dryRun = true): Promise<MigrationResult> {
    const result: MigrationResult = {
        totalClasses: 0,
        totalStudentsFound: 0,
        uniqueStudentsMigrated: 0,
        duplicatesSkipped: 0,
        errors: [],
    };

    const seenStudents = new Map<string, StudentAccumulatedData>();

    try {
        console.log(`\n=== Student Migration (v5 Homeroom Logic) ${dryRun ? '(DRY RUN)' : '(LIVE)'} ===\n`);

        // 0. Pre-fetch Teachers and English Homeroom Map
        const teachersData = await fetchTeachersData();
        const englishHomeroomMap = await fetchEnglishHomeroomMap(teachersData);

        // 1. Cleanup existing students if LIVE run
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

        // 2. Fetch all classes
        const classesSnapshot = await getDocs(collection(db, COL_CLASSES));
        result.totalClasses = classesSnapshot.size;
        console.log(`Found ${result.totalClasses} classes in ${COL_CLASSES}`);

        // 3. Extract and Merge
        classesSnapshot.forEach((docSnap) => {
            const classData = { id: docSnap.id, ...docSnap.data() } as TimetableClass;
            const studentList = classData.studentList || [];
            const subject = inferSubject(classData);

            // Determine teacher for this class
            let classTeacher = classData.teacher;

            if (!classTeacher) {
                // For Math: Extract from ID (e.g., 수학_김민주_...)
                if (subject === 'math') {
                    classTeacher = extractTeacherFromClassId(docSnap.id);
                }
                // For English: Use homeroom map
                else if (subject === 'english' && englishHomeroomMap[classData.className]) {
                    classTeacher = englishHomeroomMap[classData.className];
                }
            }
            classTeacher = normalizeTeacherName(classTeacher) || '';

            const isTargetDebug = classData.className?.includes('강민준');
            if (isTargetDebug) {
                console.log(`[DEBUG] Class: ${docSnap.id}, Teacher: ${classTeacher}`);
            }

            studentList.forEach((student) => {
                result.totalStudentsFound++;
                const key = getStudentKey(student);
                const isStudentDebug = student.name?.includes('강민준');

                const enrollment: Enrollment = {
                    subject,
                    classId: docSnap.id,
                    className: classData.className || docSnap.id,
                    teacherId: classTeacher,
                };

                if (seenStudents.has(key)) {
                    const existing = seenStudents.get(key)!;
                    existing.enrollments.push(enrollment);
                    if (classData.schedule) {
                        classData.schedule.forEach(s => existing.days.add(s.split(' ')[0]));
                    }
                    existing.groups.add(classData.className);

                    if (isStudentDebug) {
                        console.log(`[DEBUG: 강민준] Merged: ${enrollment.className} (${enrollment.teacherId})`);
                    }

                    result.duplicatesSkipped++;
                } else {
                    const days = new Set<string>();
                    if (classData.schedule) {
                        classData.schedule.forEach(s => days.add(s.split(' ')[0]));
                    }

                    seenStudents.set(key, {
                        student,
                        enrollments: [enrollment],
                        days,
                        groups: new Set([classData.className]),
                        firstClassData: classData,
                    });

                    if (isStudentDebug) {
                        console.log(`[DEBUG: 강민준] New: ${enrollment.className} (${enrollment.teacherId})`);
                    }
                }
            });
        });

        console.log(`\nTotal students found: ${result.totalStudentsFound}`);
        console.log(`Unique students: ${seenStudents.size}`);
        console.log(`Duplicates merged: ${result.duplicatesSkipped}`);

        // 4. Write to students collection
        if (!dryRun) {
            const batch = writeBatch(db);
            let batchCount = 0;
            const MAX_BATCH_SIZE = 500;

            for (const [key, accData] of seenStudents) {
                const { student, enrollments, days, groups, firstClassData } = accData;
                const now = new Date().toISOString();

                const safeName = student.name.trim();
                const safeSchool = (student.school || 'Unspecified').trim();
                const safeGrade = (student.grade || 'Unspecified').trim();
                const customId = `${safeName}_${safeSchool}_${safeGrade}`;

                // v5: Removed subjects and teacherIds (use enrollments instead)
                const studentDoc: Omit<UnifiedStudent, 'id'> = {
                    name: student.name || '',
                    englishName: student.englishName || null,
                    school: student.school || '',
                    grade: student.grade || '',

                    enrollments: enrollments,

                    status: student.withdrawalDate ? 'withdrawn' :
                        student.onHold ? 'on_hold' : 'active',
                    // 퇴원 학생만 기존 enrollmentDate 사용, 나머지는 2026-01-01
                    startDate: student.withdrawalDate
                        ? (student.enrollmentDate || '2026-01-01')
                        : '2026-01-01',
                    endDate: student.withdrawalDate || null,

                    days: Array.from(days),
                    group: Array.from(groups).join(', '),

                    createdAt: now,
                    updatedAt: now,
                };

                const studentDocRef = doc(db, COL_STUDENTS, customId);
                batch.set(studentDocRef, studentDoc);
                batchCount++;
                result.uniqueStudentsMigrated++;

                if (batchCount >= MAX_BATCH_SIZE) {
                    await batch.commit();
                    console.log(`Committed batch of ${batchCount} students`);
                    batchCount = 0;
                }
            }

            if (batchCount > 0) {
                await batch.commit();
                console.log(`Committed final batch of ${batchCount} students`);
            }

            console.log(`\n✅ Migration complete! ${result.uniqueStudentsMigrated} students migrated.`);
        } else {
            result.uniqueStudentsMigrated = seenStudents.size;
            console.log(`\n[DRY RUN] Would migrate ${seenStudents.size} unique students.`);
        }

    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(errMsg);
        console.error('Migration error:', errMsg);
    }

    return result;
}

export type { MigrationResult };

if (typeof window !== 'undefined') {
    (window as any).migrateStudentsFromTimetable = migrateStudentsFromTimetable;
}
