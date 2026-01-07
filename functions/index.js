/**
 * Cloud Function: Timetable -> Attendance Student Sync (Gen 1)
 */

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const logger = functions.logger;

admin.initializeApp();
const db = admin.firestore();

// Helper: Normalize teacher name
function normalizeTeacherName(name) {
    if (!name) return "";
    const mappings = {
        "김*주": "김민주",
        "이*나": "이서나",
        "조*성": "조유성",
        "장*진": "장세진",
        "유*원": "유보원",
        "김*주_수학": "김민주",
        "이*나_수학": "이서나",
    };
    return mappings[name] || name;
}

// Helper: Extract teacher name from Math class ID
function extractTeacherFromClassId(classId) {
    if (classId.startsWith("수학_")) {
        const parts = classId.split("_");
        if (parts.length >= 2) return parts[1];
    }
    return "";
}

// Helper: Infer subject from class data
function inferSubject(classData, classId) {
    if (classId.startsWith("수학_")) return "math";
    if (classId.startsWith("영어_")) return "english";
    const className = classData.className || "";
    if (/^[A-Z]{2,3}\d/.test(className)) return "english";
    return "math";
}

// Helper: Get student unique key
function getStudentKey(student) {
    const name = (student.name || "").trim();
    const school = (student.school || "Unspecified").trim();
    const grade = (student.grade || "Unspecified").trim();
    return `${name}_${school}_${grade}`;
}

/**
 * Triggered when any document in '수업목록' is created, updated, or deleted.
 * Region: asia-northeast3 (Seoul)
 */
exports.syncStudentsOnClassChange = functions
    .region("asia-northeast3")
    .firestore
    .document("수업목록/{classId}")
    .onWrite(async (change, context) => {
        const classId = context.params.classId;
        const beforeData = change.before.data();
        const afterData = change.after.data();

        logger.info(`[syncStudents] Triggered for class: ${classId}`);

        const beforeStudents = beforeData?.studentList || [];
        const afterStudents = afterData?.studentList || [];

        // Identify student changes
        const beforeKeys = new Set(beforeStudents.map(s => getStudentKey(s)));
        const afterKeys = new Set(afterStudents.map(s => getStudentKey(s)));

        const addedStudents = afterStudents.filter(s => !beforeKeys.has(getStudentKey(s)));
        const removedStudents = beforeStudents.filter(s => !afterKeys.has(getStudentKey(s)));
        const remainingStudents = afterStudents.filter(s => beforeKeys.has(getStudentKey(s)));

        // --- Metadata Change Detection ---
        const classData = afterData || beforeData;
        const className = classData?.className || classId;
        const subject = inferSubject(classData, classId);

        // 1. Current Teacher & Days
        let teacher = classData?.teacher || "";
        if (!teacher && subject === "math") {
            teacher = extractTeacherFromClassId(classId);
        }
        teacher = normalizeTeacherName(teacher);

        const days = [];
        if (classData?.schedule && Array.isArray(classData.schedule)) {
            classData.schedule.forEach((s) => {
                const day = s.split(" ")[0];
                if (day && !days.includes(day)) days.push(day);
            });
        }
        days.sort();

        // 2. Previous Teacher & Days
        const beforeClassData = beforeData || {};
        let beforeTeacher = beforeClassData.teacher || "";
        if (!beforeTeacher && subject === "math") {
            beforeTeacher = extractTeacherFromClassId(classId);
        }
        beforeTeacher = normalizeTeacherName(beforeTeacher);

        const beforeDays = [];
        if (beforeClassData.schedule && Array.isArray(beforeClassData.schedule)) {
            beforeClassData.schedule.forEach((s) => {
                const day = s.split(" ")[0];
                if (day && !beforeDays.includes(day)) beforeDays.push(day);
            });
        }
        beforeDays.sort();

        const metadataChanged = (teacher !== beforeTeacher) || (JSON.stringify(days) !== JSON.stringify(beforeDays));

        // If no changes at all, exit
        if (addedStudents.length === 0 && removedStudents.length === 0 && !metadataChanged) {
            logger.info("[syncStudents] No relevant changes detected.");
            return null;
        }

        logger.info(`[syncStudents] Class: ${className}`);
        logger.info(`[syncStudents] Metadata Changed: ${metadataChanged}`);
        logger.info(`[syncStudents] Teacher: ${beforeTeacher} -> ${teacher}`);
        logger.info(`[syncStudents] Days: ${beforeDays.join(",")} -> ${days.join(",")}`);
        logger.info(`[syncStudents] (+${addedStudents.length}, -${removedStudents.length})`);

        const batch = db.batch();
        const now = new Date().toISOString();

        // Target students to update enrollment for: 
        // 1. New students (Added)
        // 2. Existing students (Remaining) - ONLY IF metadata changed
        const studentsToUpdate = metadataChanged ? [...addedStudents, ...remainingStudents] : addedStudents;

        // Process UPDATES (Add/Update Enrollment)
        for (const student of studentsToUpdate) {
            const studentKey = getStudentKey(student);
            const studentRef = db.collection("students").doc(studentKey);
            const studentDoc = await studentRef.get();

            const enrollment = {
                subject,
                classId,
                className,
                teacherId: teacher,
                days,
            };

            if (studentDoc.exists) {
                const existingData = studentDoc.data();
                let enrollments = existingData.enrollments || [];

                // Remove potential old entry for this class (replace with new metadata)
                enrollments = enrollments.filter(e => e.classId !== classId);

                // Add new/updated enrollment
                enrollments.push(enrollment);

                batch.update(studentRef, { enrollments, updatedAt: now });
            } else {
                const newStudent = {
                    name: student.name || "",
                    englishName: student.englishName || null,
                    school: student.school || "",
                    grade: student.grade || "",
                    enrollments: [enrollment],
                    status: "active",
                    startDate: now.split("T")[0],
                    endDate: null,
                    group: className,
                    createdAt: now,
                    updatedAt: now,
                };
                batch.set(studentRef, newStudent);
            }
        }

        // Process REMOVALS
        for (const student of removedStudents) {
            const studentKey = getStudentKey(student);
            const studentRef = db.collection("students").doc(studentKey);
            const studentDoc = await studentRef.get();

            if (studentDoc.exists) {
                const existingData = studentDoc.data();
                let enrollments = existingData.enrollments || [];

                // Remove enrollment for this class
                enrollments = enrollments.filter(e => e.classId !== classId);

                if (enrollments.length === 0) {
                    batch.update(studentRef, {
                        enrollments: [],
                        status: "withdrawn",
                        endDate: now.split("T")[0],
                        updatedAt: now,
                    });
                } else {
                    batch.update(studentRef, { enrollments, updatedAt: now });
                }
            }
        }

        await batch.commit();
        logger.info("[syncStudents] Sync completed.");
        return null;
    });

exports.testSync = functions.region("asia-northeast3").https.onRequest((req, res) => {
    res.send("Cloud Functions (Gen 1) for syncStudents is deployed!");
});

/**
 * =========================================================
 * Cloud Function: Teacher Cascade Delete
 * =========================================================
 * Triggered when a teacher document is deleted from '강사목록'.
 * Cleans up related data:
 * 1. Updates all classes that reference this teacher
 * 2. Updates student enrollments to remove this teacher's classes
 */
exports.onTeacherDeleted = functions
    .region("asia-northeast3")
    .firestore
    .document("강사목록/{teacherId}")
    .onDelete(async (snap, context) => {
        const teacherId = context.params.teacherId;
        const deletedTeacher = snap.data();
        const teacherName = deletedTeacher?.name || teacherId;

        logger.info(`[onTeacherDeleted] Teacher deleted: ${teacherName}`);

        const batch = db.batch();
        const now = new Date().toISOString();
        let classesUpdated = 0;
        let studentsUpdated = 0;

        // 1. Find all classes with this teacher
        const classesSnapshot = await db.collection("수업목록")
            .where("teacher", "==", teacherName)
            .get();

        logger.info(`[onTeacherDeleted] Found ${classesSnapshot.size} classes with teacher: ${teacherName}`);

        // Collect class IDs to remove from student enrollments
        const classIdsToRemove = [];

        classesSnapshot.forEach(doc => {
            classIdsToRemove.push(doc.id);
            // Option A: Delete the class
            // batch.delete(doc.ref);

            // Option B: Mark as orphaned (safer - keeps data)
            batch.update(doc.ref, {
                teacher: null,
                teacherDeleted: true,
                deletedTeacherName: teacherName,
                updatedAt: now
            });
            classesUpdated++;
        });

        // 2. Find all students with enrollments for these classes
        if (classIdsToRemove.length > 0) {
            const studentsSnapshot = await db.collection("students").get();

            studentsSnapshot.forEach(doc => {
                const studentData = doc.data();
                const enrollments = studentData.enrollments || [];

                // Filter out enrollments for deleted teacher's classes
                const filteredEnrollments = enrollments.filter(
                    e => !classIdsToRemove.includes(e.classId)
                );

                // Only update if something changed
                if (filteredEnrollments.length !== enrollments.length) {
                    if (filteredEnrollments.length === 0) {
                        batch.update(doc.ref, {
                            enrollments: [],
                            status: "withdrawn",
                            endDate: now.split("T")[0],
                            updatedAt: now
                        });
                    } else {
                        batch.update(doc.ref, {
                            enrollments: filteredEnrollments,
                            updatedAt: now
                        });
                    }
                    studentsUpdated++;
                }
            });
        }

        await batch.commit();
        logger.info(`[onTeacherDeleted] Cleanup completed: ${classesUpdated} classes, ${studentsUpdated} students updated.`);
        return null;
    });

/**
 * =========================================================
 * Cloud Function: Consultation Auto-Registration Trigger
 * =========================================================
 * Triggered when a consultation record is created or updated.
 * If status changes to a "registered" status, automatically creates
 * a student record in the unified students collection.
 */
exports.onConsultationWrite = functions
    .region("asia-northeast3")
    .firestore
    .document("consultations/{consultationId}")
    .onWrite(async (change, context) => {
        const consultationId = context.params.consultationId;
        const afterData = change.after.exists ? change.after.data() : null;
        const beforeData = change.before.exists ? change.before.data() : null;

        // Only proceed if document exists (not deleted)
        if (!afterData) {
            logger.info(`[onConsultationWrite] Consultation deleted: ${consultationId}`);
            return null;
        }

        const registeredStatuses = ["영수등록", "수학등록", "영어등록"];
        const isNowRegistered = registeredStatuses.includes(afterData.status);
        const wasRegistered = beforeData ? registeredStatuses.includes(beforeData.status) : false;

        // Only trigger on NEW registration (status changed to registered)
        if (!isNowRegistered || wasRegistered) {
            return null;
        }

        logger.info(`[onConsultationWrite] New registration detected: ${consultationId}`);

        const studentName = afterData.studentName || "";
        const schoolName = afterData.schoolName || "";
        const grade = afterData.grade || "";
        const status = afterData.status;

        if (!studentName) {
            logger.warn("[onConsultationWrite] No student name provided, skipping.");
            return null;
        }

        // Determine subject from status
        let subject = "math";
        if (status === "영어등록") subject = "english";
        if (status === "영수등록") subject = "both";

        const studentKey = `${studentName.trim()}_${schoolName.trim() || "Unspecified"}_${grade.trim() || "Unspecified"}`;
        const studentRef = db.collection("students").doc(studentKey);
        const studentDoc = await studentRef.get();

        const now = new Date().toISOString();

        if (studentDoc.exists) {
            // Student exists - just log (actual enrollment will happen via timetable sync)
            logger.info(`[onConsultationWrite] Student already exists: ${studentKey}. Enrollment will be handled when added to class.`);
        } else {
            // Create new student record (pre-registration)
            const newStudent = {
                name: studentName.trim(),
                englishName: afterData.englishName || null,
                school: schoolName.trim(),
                grade: grade.trim(),
                enrollments: [], // Empty - will be populated when added to actual class
                status: "pending", // Pre-registered, awaiting class assignment
                startDate: null,
                endDate: null,
                group: null,
                consultationId: consultationId,
                registrationSubject: subject,
                createdAt: now,
                updatedAt: now,
            };
            await studentRef.set(newStudent);
            logger.info(`[onConsultationWrite] Created pre-registered student: ${studentKey} (${subject})`);
        }

        return null;
    });

/**
 * =========================================================
 * Cloud Function: Auto-Archive Old Events
 * =========================================================
 * Triggered daily. Moves events older than 'lookbackYears'
 * from '일정' to 'archived_events'.
 */
exports.archiveOldEvents = functions
    .region("asia-northeast3")
    .pubsub.schedule("0 0 * * *") // Every day at midnight
    .timeZone("Asia/Seoul")
    .onRun(async (context) => {
        const logger = functions.logger;
        logger.info("[archiveOldEvents] Started.");

        try {
            // 1. Get Retention Config
            const configSnap = await db.collection("system_config").limit(1).get();
            let lookbackYears = 2; // Default
            if (!configSnap.empty) {
                const config = configSnap.docs[0].data();
                if (config.eventLookbackYears) {
                    lookbackYears = Number(config.eventLookbackYears);
                }
            }

            // 2. Calculate Cutoff Date (YYYY-MM-DD)
            const now = new Date();
            // Subtract years
            const cutoffDateObj = new Date(now.setFullYear(now.getFullYear() - lookbackYears));
            const cutoffDate = cutoffDateObj.toISOString().split("T")[0]; // YYYY-MM-DD

            logger.info(`[archiveOldEvents] Cutoff Date: ${cutoffDate} (Lookback: ${lookbackYears} years)`);

            // 3. Query Old Events
            // Limit to 450 to fill one batch comfortably (limit is 500)
            const snapshot = await db.collection("일정")
                .where("종료일", "<", cutoffDate)
                .limit(450)
                .get();

            if (snapshot.empty) {
                logger.info("[archiveOldEvents] No events to archive.");
                return null;
            }

            logger.info(`[archiveOldEvents] Found ${snapshot.size} events to archive.`);

            const batch = db.batch();
            let count = 0;

            snapshot.forEach(doc => {
                const data = doc.data();
                const archiveRef = db.collection("archived_events").doc(doc.id);
                const originalRef = db.collection("일정").doc(doc.id);

                // Copy to Archive with metadata
                batch.set(archiveRef, {
                    ...data,
                    archivedAt: new Date().toISOString(),
                    originalCollection: "일정"
                });

                // Delete from Original
                batch.delete(originalRef);
                count++;
            });

            await batch.commit();
            logger.info(`[archiveOldEvents] Successfully archived ${count} events.`);
        } catch (error) {
            logger.error("[archiveOldEvents] Error:", error);
        }
        return null;
    });


