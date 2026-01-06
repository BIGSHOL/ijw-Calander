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
    groups: Set<string>;
    firstClassData: TimetableClass;
}

/**
 * Fetch English Class -> Teacher -> Days mapping
 * For each class, collects all teachers and their respective teaching days
 * Also determines homeroom teacher for reference
 * 
 * Structure: Document ID = Teacher Name, Fields = {key: {className, room, ...}, ...}
 * where key format is "Teacher-Period-Day"
 * 
 * Returns:
 * - teacherDaysMap: className -> teacherName -> days[] (for all teachers)
 * - homeroomMap: className -> homeroom teacher name
 */
async function fetchEnglishClassMeta(teachersData: Teacher[]): Promise<{
    teacherDaysMap: Record<string, Record<string, string[]>>;
    homeroomMap: Record<string, string>;
}> {
    console.log('Fetching English schedules to build Class->Teacher->Days map...');

    // className -> teacherName -> Set<day>
    const classTeacherDays: Record<string, Record<string, Set<string>>> = {};
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

                // Skip LAB classes
                if (className.toUpperCase() === 'LAB' || className.toUpperCase().includes('LAB')) return;

                // Extract day from field key (last part after splitting by '-')
                const keyParts = fieldKey.split('-');
                const day = keyParts[keyParts.length - 1]; // e.g., "월", "화", "수"

                // Normalize teacher name
                const teacher = normalizeTeacherName(teacherName) || teacherName;

                // Initialize structures
                if (!classTeacherDays[className]) {
                    classTeacherDays[className] = {};
                }
                if (!classTeacherDays[className][teacher]) {
                    classTeacherDays[className][teacher] = new Set();
                }

                // Add day to this teacher's set for this class
                if (day && ['월', '화', '수', '목', '금', '토', '일'].includes(day)) {
                    classTeacherDays[className][teacher].add(day);
                }

                // Count for homeroom determination
                if (!classTeacherCounts[className]) {
                    classTeacherCounts[className] = {};
                }
                classTeacherCounts[className][teacher] = (classTeacherCounts[className][teacher] || 0) + 1;

                // Also handle merged classes if present
                if (cellData.merged && Array.isArray(cellData.merged)) {
                    cellData.merged.forEach((m: any) => {
                        if (m.className && !m.className.toUpperCase().includes('LAB')) {
                            if (!classTeacherDays[m.className]) {
                                classTeacherDays[m.className] = {};
                            }
                            if (!classTeacherDays[m.className][teacher]) {
                                classTeacherDays[m.className][teacher] = new Set();
                            }
                            if (day && ['월', '화', '수', '목', '금', '토', '일'].includes(day)) {
                                classTeacherDays[m.className][teacher].add(day);
                            }

                            if (!classTeacherCounts[m.className]) {
                                classTeacherCounts[m.className] = {};
                            }
                            classTeacherCounts[m.className][teacher] = (classTeacherCounts[m.className][teacher] || 0) + 1;
                        }
                    });
                }
            });
        });

        console.log(`Found schedules for ${Object.keys(classTeacherDays).length} english classes (excluding LAB).`);
    } catch (e) {
        console.error("Failed to fetch english schedules:", e);
    }

    // Determine homeroom for each class (most frequent, prefer non-native when tied)
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

        homeroomMap[className] = homeroom;
    }

    console.log(`Built homeroom map for ${Object.keys(homeroomMap).length} english classes.`);

    // Convert Set to Array for teacherDaysMap
    const teacherDaysMap: Record<string, Record<string, string[]>> = {};
    for (const [className, teacherDays] of Object.entries(classTeacherDays)) {
        teacherDaysMap[className] = {};
        for (const [teacher, daysSet] of Object.entries(teacherDays)) {
            teacherDaysMap[className][teacher] = Array.from(daysSet);
        }
    }

    // Log sample
    const sampleClasses = Object.keys(teacherDaysMap).slice(0, 3);
    sampleClasses.forEach(cls => {
        console.log(`  ${cls}: ${Object.keys(teacherDaysMap[cls]).join(', ')}`);
    });

    return { teacherDaysMap, homeroomMap };
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
        console.log(`\n=== Student Migration (v7 Multi-Teacher Enrollments) ${dryRun ? '(DRY RUN)' : '(LIVE)'} ===\n`);

        // 0. Pre-fetch Teachers and English Teacher/Days Map
        const teachersData = await fetchTeachersData();
        const { teacherDaysMap: englishTeacherDaysMap, homeroomMap: englishHomeroomMap } = await fetchEnglishClassMeta(teachersData);

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

            const isTargetDebug = classData.className?.includes('LT1b');
            if (isTargetDebug) {
                console.log(`[DEBUG] Processing class: ${classData.className}`);
            }

            studentList.forEach((student) => {
                result.totalStudentsFound++;
                const key = getStudentKey(student);
                const isStudentDebug = student.name?.includes('강민준');

                // Build enrollments based on subject
                const enrollmentsToAdd: Enrollment[] = [];

                if (subject === 'math') {
                    // For Math: Single enrollment with teacher from classData or extracted from ID
                    let classTeacher = classData.teacher;
                    if (!classTeacher) {
                        classTeacher = extractTeacherFromClassId(docSnap.id);
                    }
                    classTeacher = normalizeTeacherName(classTeacher) || '';

                    const classDays: string[] = [];
                    if (classData.schedule) {
                        classData.schedule.forEach((s: string) => {
                            const day = s.split(' ')[0];
                            if (day && !classDays.includes(day)) classDays.push(day);
                        });
                    }

                    enrollmentsToAdd.push({
                        subject: 'math',
                        classId: docSnap.id,
                        className: classData.className || docSnap.id,
                        teacherId: classTeacher,
                        days: classDays,
                    });
                } else if (subject === 'english') {
                    // For English: Create enrollment for EACH teacher with their days
                    const classTeacherData = englishTeacherDaysMap[classData.className];

                    if (classTeacherData) {
                        // Create separate enrollment for each teacher
                        for (const [teacher, days] of Object.entries(classTeacherData)) {
                            enrollmentsToAdd.push({
                                subject: 'english',
                                classId: `영어_${classData.className}_${teacher}_${Date.now()}`,
                                className: classData.className,
                                teacherId: teacher,
                                days: days,
                            });

                            if (isTargetDebug) {
                                console.log(`  -> Adding enrollment: ${classData.className} / ${teacher} / [${days.join(',')}]`);
                            }
                        }
                    } else {
                        // Fallback: use homeroom teacher with no specific days
                        const homeroom = englishHomeroomMap[classData.className] || '';
                        enrollmentsToAdd.push({
                            subject: 'english',
                            classId: docSnap.id,
                            className: classData.className || docSnap.id,
                            teacherId: normalizeTeacherName(homeroom) || homeroom,
                            days: [],
                        });
                    }
                }

                if (seenStudents.has(key)) {
                    const existing = seenStudents.get(key)!;
                    // Add all enrollments (multiple for English)
                    enrollmentsToAdd.forEach(enrollment => {
                        existing.enrollments.push(enrollment);
                    });
                    existing.groups.add(classData.className);

                    if (isStudentDebug) {
                        console.log(`[DEBUG: 강민준] Merged ${enrollmentsToAdd.length} enrollments for ${classData.className}`);
                    }

                    result.duplicatesSkipped++;
                } else {
                    seenStudents.set(key, {
                        student,
                        enrollments: [...enrollmentsToAdd],
                        groups: new Set([classData.className]),
                        firstClassData: classData,
                    });

                    if (isStudentDebug) {
                        console.log(`[DEBUG: 강민준] New: ${enrollmentsToAdd.length} enrollments for ${classData.className}`);
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
                const { student, enrollments, groups, firstClassData } = accData;
                const now = new Date().toISOString();

                const safeName = student.name.trim();
                const safeSchool = (student.school || 'Unspecified').trim();
                const safeGrade = (student.grade || 'Unspecified').trim();
                const customId = `${safeName}_${safeSchool}_${safeGrade}`;

                // v6: days moved into enrollments
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
