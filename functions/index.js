/**
 * Cloud Function: Timetable -> Attendance Student Sync (Gen 1)
 */

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const CryptoJS = require("crypto-js");
const { GoogleGenAI, createPartFromFunctionResponse } = require("@google/genai");
const logger = functions.logger;

admin.initializeApp();
const db = getFirestore("restore260202");

// KST(UTC+9) 기준 오늘 날짜 반환 (서버는 UTC 기준이므로 변환 필요)
function getTodayKST() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().split("T")[0];
}
function formatDateKST(date) {
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().split("T")[0];
}

// 인메모리 캐시 (인스턴스 재사용 시 Firestore 읽기 절약)
const cache = { students: null, studentsAt: 0, classes: null, classesAt: 0, staff: null, staffAt: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5분
async function getCachedStudents() {
    if (cache.students && Date.now() - cache.studentsAt < CACHE_TTL) return cache.students;
    const snap = await db.collection("students").get();
    cache.students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cache.studentsAt = Date.now();
    return cache.students;
}
async function getCachedClasses() {
    if (cache.classes && Date.now() - cache.classesAt < CACHE_TTL) return cache.classes;
    const snap = await db.collection("classes").where("isActive", "==", true).get();
    cache.classes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cache.classesAt = Date.now();
    return cache.classes;
}
async function getCachedStaff() {
    if (cache.staff && Date.now() - cache.staffAt < CACHE_TTL) return cache.staff;
    const snap = await db.collection("staff").orderBy("name").get();
    cache.staff = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cache.staffAt = Date.now();
    return cache.staff;
}

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

// Helper: Extract teacher name from class ID (new format: math_teacher_className)
function extractTeacherFromClassId(classId) {
    if (classId.startsWith("math_") || classId.startsWith("english_")) {
        const parts = classId.split("_");
        if (parts.length >= 2) return parts[1];
    }
    return "";
}

// Helper: Infer subject from class data
function inferSubject(classData, classId) {
    // 새 구조: classData.subject 필드 우선
    if (classData?.subject) return classData.subject;

    if (classId.startsWith("math_")) return "math";
    if (classId.startsWith("english_")) return "english";
    const className = classData?.className || "";
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
 * Triggered when any document in 'classes' is created, updated, or deleted.
 * Region: asia-northeast3 (Seoul)
 */
exports.syncStudentsOnClassChange = functions
    .region("asia-northeast3")
    .firestore
    .document("classes/{classId}")
    .onWrite(async (change, context) => {
        const classId = context.params.classId;

        try {
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

            // Build enrollment with date range
            const enrollment = {
                subject,
                classId,
                className,
                staffId: teacher,  // Changed from teacherId to staffId (migration to staff collection)
                days,
                startDate: student.enrollmentDate || now.split("T")[0],
                endDate: student.withdrawalDate || null,
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
        } catch (error) {
            logger.error("[syncStudents] Error:", error);
            return null;
        }
    });

exports.testSync = functions.region("asia-northeast3").https.onRequest((req, res) => {
    res.send("Cloud Functions (Gen 1) for syncStudents is deployed!");
});

/**
 * =========================================================
 * Cloud Function: Teacher Cascade Delete (Staff Collection)
 * =========================================================
 * Triggered when a staff document is deleted.
 * Only processes if role was 'teacher'.
 * Cleans up related data:
 * 1. Updates all classes that reference this teacher
 * 2. Updates student enrollments to remove this teacher's classes
 *
 * NOTE: 강사목록 컬렉션에서 staff 컬렉션으로 마이그레이션됨 (2026-01-17)
 */
exports.onTeacherDeleted = functions
    .region("asia-northeast3")
    .firestore
    .document("staff/{staffId}")
    .onDelete(async (snap, context) => {
        const staffId = context.params.staffId;
        const deletedStaff = snap.data();

        // 강사(teacher)가 아니면 무시
        if (deletedStaff?.role !== 'teacher') {
            logger.info(`[onTeacherDeleted] Skipping non-teacher staff: ${staffId}`);
            return null;
        }

        try {
        const teacherName = deletedStaff?.name || staffId;

        logger.info(`[onTeacherDeleted] Teacher deleted: ${teacherName}`);

        const batch = db.batch();
        const now = new Date().toISOString();
        let classesUpdated = 0;
        let studentsUpdated = 0;

        // 1. Find all classes with this teacher
        const classesSnapshot = await db.collection("classes")
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
        } catch (error) {
            logger.error("[onTeacherDeleted] Error:", error);
            return null;
        }
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

        try {

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
        } catch (error) {
            logger.error("[onConsultationWrite] Error:", error);
            return null;
        }
    });

/**
 * =========================================================
 * Cloud Function: Auto-Archive Old Events
 * =========================================================
 * Triggered daily. Moves events older than 'lookbackYears'
 * from 'events' to 'archived_events'.
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
            const cutoffDate = formatDateKST(cutoffDateObj); // YYYY-MM-DD (KST)

            logger.info(`[archiveOldEvents] Cutoff Date: ${cutoffDate} (Lookback: ${lookbackYears} years)`);

            // 3. Query Old Events
            // Limit to 450 to fill one batch comfortably (limit is 500)
            const snapshot = await db.collection("events")
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
                const originalRef = db.collection("events").doc(doc.id);

                // Copy to Archive with metadata
                batch.set(archiveRef, {
                    ...data,
                    archivedAt: new Date().toISOString(),
                    originalCollection: "events"
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

/**
 * =========================================================
 * Cloud Function: Set User Password (Admin Only)
 * =========================================================
 * Allows admin/master users to set a temporary password
 * for another user directly.
 *
 * @param {string} uid - Target user's Firebase UID
 * @param {string} password - New password (min 6 chars)
 */
exports.setUserPassword = functions
    .region("asia-northeast3")
    .https.onCall(async (data, context) => {
        const logger = functions.logger;

        // 1. Authentication check
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "로그인이 필요합니다."
            );
        }

        const callerUid = context.auth.uid;

        // 2. Get caller's role from Firestore (staff collection)
        const callerSnap = await db.collection("staff")
            .where("uid", "==", callerUid)
            .limit(1)
            .get();
        if (callerSnap.empty) {
            throw new functions.https.HttpsError(
                "permission-denied",
                "사용자 정보를 찾을 수 없습니다."
            );
        }

        const callerData = callerSnap.docs[0].data();
        const callerRole = callerData.systemRole || callerData.role;
        const allowedRoles = ["master", "admin"];

        if (!allowedRoles.includes(callerRole)) {
            throw new functions.https.HttpsError(
                "permission-denied",
                "비밀번호 변경 권한이 없습니다. (관리자만 가능)"
            );
        }

        // 3. Validate input
        const { uid, password } = data;

        if (!uid || typeof uid !== "string") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "대상 사용자 UID가 필요합니다."
            );
        }

        if (!password || typeof password !== "string" || password.length < 6) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "비밀번호는 최소 6자 이상이어야 합니다."
            );
        }

        // 4. Get target user's role (prevent admin from changing master's password)
        const targetSnap = await db.collection("staff")
            .where("uid", "==", uid)
            .limit(1)
            .get();
        if (!targetSnap.empty) {
            const targetData = targetSnap.docs[0].data();
            const targetRole = targetData.systemRole || targetData.role;
            // Only master can change master's password
            if (targetRole === "master" && callerRole !== "master") {
                throw new functions.https.HttpsError(
                    "permission-denied",
                    "MASTER 계정의 비밀번호는 변경할 수 없습니다."
                );
            }
            // Admin cannot change other admin's password
            if (targetRole === "admin" && callerRole === "admin" && uid !== callerUid) {
                throw new functions.https.HttpsError(
                    "permission-denied",
                    "다른 관리자의 비밀번호는 변경할 수 없습니다."
                );
            }
        }

        // 5. Update password using Identity Toolkit REST API
        try {
            const accessToken = await admin.app().options.credential.getAccessToken();

            const response = await fetch(
                "https://identitytoolkit.googleapis.com/v1/accounts:update",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${accessToken.access_token}`
                    },
                    body: JSON.stringify({
                        localId: uid,
                        password: password
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                logger.error(`[setUserPassword] Failed:`, JSON.stringify(result.error));
                throw new Error(result.error?.message || `HTTP ${response.status}`);
            }

            logger.info(`[setUserPassword] Password updated for ${result.email} by ${callerUid}`);

            return { success: true, message: "비밀번호가 변경되었습니다." };
        } catch (error) {
            logger.error(`[setUserPassword] Error:`, error);

            throw new functions.https.HttpsError(
                "internal",
                "비밀번호 변경 중 오류가 발생했습니다."
            );
        }
    });

/**
 * Cloud Function: 직원 이메일 변경
 * Firebase Auth + Firestore staff + staffIndex 3곳 동시 업데이트
 *
 * @param {string} uid - 대상 사용자 UID
 * @param {string} newEmail - 변경할 이메일
 * @param {string} staffDocId - staff 문서 ID
 * @returns {{ success: boolean, message: string }}
 */
exports.updateStaffEmail = functions
    .region("asia-northeast3")
    .https.onCall(async (data, context) => {
        const logger = functions.logger;

        // 1. Authentication check
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "로그인이 필요합니다."
            );
        }

        const callerUid = context.auth.uid;

        // 2. Get caller's role
        const callerSnap = await db.collection("staff")
            .where("uid", "==", callerUid)
            .limit(1)
            .get();
        if (callerSnap.empty) {
            throw new functions.https.HttpsError(
                "permission-denied",
                "사용자 정보를 찾을 수 없습니다."
            );
        }

        const callerData = callerSnap.docs[0].data();
        const callerRole = callerData.systemRole || callerData.role;
        const allowedRoles = ["master", "admin"];

        if (!allowedRoles.includes(callerRole)) {
            throw new functions.https.HttpsError(
                "permission-denied",
                "이메일 변경 권한이 없습니다. (관리자만 가능)"
            );
        }

        // 3. Validate input
        const { uid, newEmail, staffDocId } = data;

        if (!uid || typeof uid !== "string") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "대상 사용자 UID가 필요합니다."
            );
        }

        if (!newEmail || typeof newEmail !== "string") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "새 이메일을 입력해주세요."
            );
        }

        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "올바른 이메일 형식이 아닙니다."
            );
        }

        if (!staffDocId || typeof staffDocId !== "string") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "직원 문서 ID가 필요합니다."
            );
        }

        // 4. 대상 역할 검사 (master 이메일은 master만 변경 가능)
        const targetSnap = await db.collection("staff")
            .where("uid", "==", uid)
            .limit(1)
            .get();
        if (!targetSnap.empty) {
            const targetData = targetSnap.docs[0].data();
            const targetRole = targetData.systemRole || targetData.role;
            if (targetRole === "master" && callerRole !== "master") {
                throw new functions.https.HttpsError(
                    "permission-denied",
                    "MASTER 계정의 이메일은 변경할 수 없습니다."
                );
            }
        }

        // 5. 중복 이메일 체크
        try {
            await admin.auth().getUserByEmail(newEmail);
            throw new functions.https.HttpsError(
                "already-exists",
                "이미 사용 중인 이메일입니다."
            );
        } catch (error) {
            if (error.code === "functions/already-exists") {
                throw error;
            }
            // auth/user-not-found → 사용 가능한 이메일
        }

        // 6. Firebase Auth 이메일 업데이트
        try {
            await admin.auth().updateUser(uid, { email: newEmail });
            logger.info(`[updateStaffEmail] Auth email updated for ${uid} to ${newEmail}`);
        } catch (error) {
            logger.error(`[updateStaffEmail] Auth update failed:`, error);
            throw new functions.https.HttpsError(
                "internal",
                "Firebase 인증 이메일 변경에 실패했습니다."
            );
        }

        // 7. Firestore staff 문서 업데이트
        try {
            await db.collection("staff").doc(staffDocId).update({
                email: newEmail,
                updatedAt: new Date().toISOString(),
            });
            logger.info(`[updateStaffEmail] Staff doc updated: ${staffDocId}`);
        } catch (error) {
            logger.error(`[updateStaffEmail] Staff doc update failed:`, error);
            // Auth는 이미 변경됨 - 로그만 남김
        }

        // 8. staffIndex 문서 업데이트 (있으면)
        try {
            const indexRef = db.collection("staffIndex").doc(uid);
            const indexSnap = await indexRef.get();
            if (indexSnap.exists) {
                await indexRef.update({
                    email: newEmail,
                    updatedAt: new Date().toISOString(),
                });
                logger.info(`[updateStaffEmail] staffIndex updated: ${uid}`);
            }
        } catch (error) {
            logger.error(`[updateStaffEmail] staffIndex update failed:`, error);
        }

        return { success: true, message: "이메일이 변경되었습니다." };
    });

/**
 * Cloud Function: 미연동 직원 계정 연결/생성
 * 이메일로 기존 Firebase Auth 계정이 있으면 uid를 반환하고 비밀번호를 재설정,
 * 없으면 새 계정을 생성하여 uid를 반환합니다.
 *
 * @param {string} email - 직원 이메일
 * @param {string} password - 설정할 비밀번호 (min 6 chars)
 * @returns {{ uid: string, created: boolean }}
 */
exports.linkOrCreateStaffAccount = functions
    .region("asia-northeast3")
    .https.onCall(async (data, context) => {
        const logger = functions.logger;

        // 1. Authentication check
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "로그인이 필요합니다."
            );
        }

        const callerUid = context.auth.uid;

        // 2. Get caller's role from Firestore (staff collection)
        const callerSnap = await db.collection("staff")
            .where("uid", "==", callerUid)
            .limit(1)
            .get();
        if (callerSnap.empty) {
            throw new functions.https.HttpsError(
                "permission-denied",
                "사용자 정보를 찾을 수 없습니다."
            );
        }

        const callerData = callerSnap.docs[0].data();
        const callerRole = callerData.systemRole || callerData.role;
        const allowedRoles = ["master", "admin"];

        if (!allowedRoles.includes(callerRole)) {
            throw new functions.https.HttpsError(
                "permission-denied",
                "계정 생성/연결 권한이 없습니다. (관리자만 가능)"
            );
        }

        // 3. Validate input
        const { email, password } = data;

        if (!email || typeof email !== "string") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "이메일이 필요합니다."
            );
        }

        if (!password || typeof password !== "string" || password.length < 6) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "비밀번호는 최소 6자 이상이어야 합니다."
            );
        }

        // 4. Try to find existing user by email
        try {
            const existingUser = await admin.auth().getUserByEmail(email);

            // User exists → update password and return uid
            await admin.auth().updateUser(existingUser.uid, { password });

            logger.info(`[linkOrCreateStaffAccount] Linked existing account ${email} (uid: ${existingUser.uid}) by ${callerUid}`);

            return {
                success: true,
                uid: existingUser.uid,
                created: false,
                message: "기존 계정을 연결하고 비밀번호를 설정했습니다."
            };
        } catch (error) {
            if (error.code !== "auth/user-not-found") {
                logger.error(`[linkOrCreateStaffAccount] Error looking up user:`, error);
                throw new functions.https.HttpsError(
                    "internal",
                    "계정 조회 중 오류가 발생했습니다."
                );
            }
        }

        // 5. User not found → create new account
        try {
            const newUser = await admin.auth().createUser({
                email,
                password,
            });

            logger.info(`[linkOrCreateStaffAccount] Created new account ${email} (uid: ${newUser.uid}) by ${callerUid}`);

            return {
                success: true,
                uid: newUser.uid,
                created: true,
                message: "새 계정을 생성했습니다."
            };
        } catch (error) {
            logger.error(`[linkOrCreateStaffAccount] Error creating user:`, error);

            if (error.code === "auth/invalid-email") {
                throw new functions.https.HttpsError(
                    "invalid-argument",
                    "올바른 이메일 주소를 입력해주세요."
                );
            }

            throw new functions.https.HttpsError(
                "internal",
                "계정 생성 중 오류가 발생했습니다."
            );
        }
    });

/**
 * Cloud Function: 서버 측 전화번호 암호화
 * 클라이언트에 암호화 키를 노출하지 않고 서버에서 암호화 수행
 *
 * @param {Object} phones - { studentPhone, homePhone, parentPhone }
 * @returns {Object} encrypted - 암호화된 전화번호 객체
 */
exports.encryptPhoneNumbers = functions
    .runWith({ secrets: ["ENCRYPTION_KEY"] })
    .region("asia-northeast3")
    .https.onCall(async (data, context) => {
        // 1. 인증 확인
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "로그인이 필요합니다."
            );
        }

        // 2. 암호화 키 로드 (Firebase Functions 환경변수)
        const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
        if (!ENCRYPTION_KEY) {
            logger.error("[encryptPhoneNumbers] ENCRYPTION_KEY not configured");
            throw new functions.https.HttpsError(
                "internal",
                "암호화 키가 설정되지 않았습니다."
            );
        }

        // 3. 입력 검증
        const { phones } = data;
        if (!phones || typeof phones !== "object") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "전화번호 객체가 필요합니다."
            );
        }

        // 4. 각 전화번호 암호화
        try {
            const encrypted = {};
            for (const [key, value] of Object.entries(phones)) {
                if (value && typeof value === "string") {
                    const cleaned = value.replace(/-/g, "").trim();
                    if (cleaned) {
                        encrypted[key] = CryptoJS.AES.encrypt(cleaned, ENCRYPTION_KEY).toString();
                    } else {
                        encrypted[key] = null;
                    }
                } else {
                    encrypted[key] = null;
                }
            }

            return { encrypted };
        } catch (error) {
            logger.error("[encryptPhoneNumbers] Error:", error);
            throw new functions.https.HttpsError(
                "internal",
                "전화번호 암호화 중 오류가 발생했습니다."
            );
        }
    });

/**
 * Cloud Function: 서버 측 전화번호 복호화
 *
 * @param {Object} phones - 암호화된 전화번호 객체
 * @returns {Object} decrypted - 복호화된 전화번호 객체
 */
exports.decryptPhoneNumbers = functions
    .runWith({ secrets: ["ENCRYPTION_KEY"] })
    .region("asia-northeast3")
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "로그인이 필요합니다."
            );
        }

        const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
        if (!ENCRYPTION_KEY) {
            throw new functions.https.HttpsError(
                "internal",
                "암호화 키가 설정되지 않았습니다."
            );
        }

        const { phones } = data;
        if (!phones || typeof phones !== "object") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "전화번호 객체가 필요합니다."
            );
        }

        const decrypted = {};
        for (const [key, value] of Object.entries(phones)) {
            if (value && typeof value === "string") {
                try {
                    const bytes = CryptoJS.AES.decrypt(value, ENCRYPTION_KEY);
                    const plain = bytes.toString(CryptoJS.enc.Utf8);
                    if (plain && plain.length >= 10 && plain.length <= 11) {
                        // 전화번호 포맷팅
                        if (plain.length === 11 && plain.startsWith("01")) {
                            decrypted[key] = `${plain.slice(0, 3)}-${plain.slice(3, 7)}-${plain.slice(7)}`;
                        } else if (plain.length === 10) {
                            decrypted[key] = `${plain.slice(0, 3)}-${plain.slice(3, 6)}-${plain.slice(6)}`;
                        } else {
                            decrypted[key] = plain;
                        }
                    } else {
                        decrypted[key] = "";
                    }
                } catch {
                    decrypted[key] = "";
                }
            } else {
                decrypted[key] = "";
            }
        }

        return { decrypted };
    });

/**
 * =========================================================
 * Cloud Function: Auto-Apply Scheduled Scenarios
 * =========================================================
 * Triggered daily at midnight (KST).
 * Finds scenarios with scheduledApplyStatus='pending' and
 * scheduledApplyDate=today, then applies them to live data.
 *
 * Logic mirrors the client-side publishToLive function:
 * - Keep class IDs (merge: true)
 * - Update class data (className, teacher, room, schedule)
 * - Handle student enrollments (add/remove/move with history)
 */
exports.applyScheduledScenarios = functions
    .region("asia-northeast3")
    .pubsub.schedule("0 0 * * *") // Every day at midnight
    .timeZone("Asia/Seoul")
    .onRun(async (context) => {
        logger.info("[applyScheduledScenarios] Started.");

        try {
            // 1. Get today's date in YYYY-MM-DD format (KST)
            const today = getTodayKST();

            logger.info(`[applyScheduledScenarios] Today (KST): ${today}`);

            // 2. Query scenarios with pending status and today's date
            const scenariosSnapshot = await db.collection("english_scenarios")
                .where("scheduledApplyStatus", "==", "pending")
                .where("scheduledApplyDate", "==", today)
                .get();

            if (scenariosSnapshot.empty) {
                logger.info("[applyScheduledScenarios] No scenarios scheduled for today.");
                return null;
            }

            logger.info(`[applyScheduledScenarios] Found ${scenariosSnapshot.size} scenario(s) to apply.`);

            // 3. Process each scheduled scenario
            for (const scenarioDoc of scenariosSnapshot.docs) {
                const scenario = scenarioDoc.data();
                const scenarioId = scenarioDoc.id;

                logger.info(`[applyScheduledScenarios] Processing: ${scenario.name} (${scenarioId})`);

                try {
                    await applyScenarioToLive(scenarioId, scenario);

                    // Update scenario status to 'applied'
                    await scenarioDoc.ref.update({
                        scheduledApplyStatus: "applied",
                        scheduledApplyResult: {
                            appliedAt: new Date().toISOString(),
                            appliedBy: "system (scheduled)",
                        },
                    });

                    logger.info(`[applyScheduledScenarios] Successfully applied: ${scenario.name}`);
                } catch (applyError) {
                    logger.error(`[applyScheduledScenarios] Failed to apply ${scenario.name}:`, applyError);

                    // Update scenario status to 'failed'
                    await scenarioDoc.ref.update({
                        scheduledApplyStatus: "failed",
                        scheduledApplyResult: {
                            appliedAt: new Date().toISOString(),
                            appliedBy: "system (scheduled)",
                            error: applyError.message || "Unknown error",
                        },
                    });
                }
            }

            logger.info("[applyScheduledScenarios] Completed.");
        } catch (error) {
            logger.error("[applyScheduledScenarios] Error:", error);
        }

        return null;
    });

/**
 * Helper: Apply a scenario to live data
 * Mirrors the client-side publishToLive logic
 */
async function applyScenarioToLive(scenarioId, scenario) {
    const scenarioClasses = scenario.classes || {};
    const scenarioEnrollments = scenario.enrollments || {};

    const today = getTodayKST();

    // 1. Get current live classes
    const liveClassesSnapshot = await db.collection("classes")
        .where("subject", "==", "english")
        .get();

    const liveClassIds = new Set();
    const liveClasses = {};
    liveClassesSnapshot.docs.forEach(doc => {
        liveClassIds.add(doc.id);
        liveClasses[doc.id] = doc.data();
    });

    const scenarioClassIds = new Set(Object.keys(scenarioClasses));

    // 2. Update classes (merge: true to keep existing fields like isActive, createdAt)
    const classBatch = db.batch();
    for (const [classId, classData] of Object.entries(scenarioClasses)) {
        const classRef = db.collection("classes").doc(classId);
        classBatch.set(classRef, {
            ...classData,
            updatedAt: new Date().toISOString(),
        }, { merge: true });
    }
    await classBatch.commit();

    logger.info(`[applyScenarioToLive] Updated ${Object.keys(scenarioClasses).length} classes.`);

    // 3. Build enrollment maps
    // 현재 실시간 enrollments 맵
    const existingEnrollmentsSnapshot = await db.collectionGroup("enrollments")
        .where("subject", "==", "english")
        .get();

    // Detect class renames (same classId, different className)
    const renamedClasses = {}; // oldClassName -> newClassName
    for (const [classId, liveClass] of Object.entries(liveClasses)) {
        const scenarioClass = scenarioClasses[classId];
        if (scenarioClass && liveClass.className !== scenarioClass.className) {
            renamedClasses[liveClass.className] = scenarioClass.className;
        }
    }

    // Live enrollments: studentId -> { className, docRef, data }
    const liveStudentEnrollments = {};
    existingEnrollmentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        // Only process active enrollments (no endDate)
        if (!data.endDate) {
            const studentId = doc.ref.parent.parent?.id;
            if (studentId) {
                liveStudentEnrollments[studentId] = {
                    className: data.className,
                    docRef: doc.ref,
                    data,
                };
            }
        }
    });

    // Scenario enrollments: studentId -> className
    const scenarioStudentEnrollments = {};
    for (const [className, students] of Object.entries(scenarioEnrollments)) {
        for (const studentId of Object.keys(students)) {
            scenarioStudentEnrollments[studentId] = className;
        }
    }

    // 4. Categorize changes
    const toEndDate = []; // Set endDate on existing enrollment
    const toCreate = []; // Create new enrollment
    const toRename = []; // Class rename (delete + create with same startDate)

    // Process existing students
    for (const [studentId, liveInfo] of Object.entries(liveStudentEnrollments)) {
        const newClassName = scenarioStudentEnrollments[studentId];

        if (!newClassName) {
            // Student removed from scenario
            toEndDate.push({ docRef: liveInfo.docRef });
        } else if (newClassName !== liveInfo.className) {
            // Check if this is a class rename or actual transfer
            if (renamedClasses[liveInfo.className] === newClassName) {
                // Class rename (level-up) - preserve startDate
                toRename.push({
                    docRef: liveInfo.docRef,
                    studentId,
                    oldClassName: liveInfo.className,
                    newClassName,
                    data: liveInfo.data,
                });
            } else {
                // Actual transfer - end old, create new
                toEndDate.push({ docRef: liveInfo.docRef });
                const newEnrollment = scenarioEnrollments[newClassName]?.[studentId];
                if (newEnrollment) {
                    toCreate.push({
                        studentId,
                        className: newClassName,
                        data: {
                            ...newEnrollment,
                            subject: "english",
                            className: newClassName,
                            startDate: today,
                        },
                    });
                }
            }
        }
        // If same class, no change needed
    }

    // Process new students (not in live)
    for (const [studentId, className] of Object.entries(scenarioStudentEnrollments)) {
        if (!liveStudentEnrollments[studentId]) {
            const newEnrollment = scenarioEnrollments[className]?.[studentId];
            if (newEnrollment) {
                toCreate.push({
                    studentId,
                    className,
                    data: {
                        ...newEnrollment,
                        subject: "english",
                        className,
                        startDate: today,
                    },
                });
            }
        }
    }

    // 5. Execute batched updates
    // Rename batch (delete old + create new with same startDate)
    for (let i = 0; i < toRename.length; i += 250) {
        const batch = db.batch();
        const chunk = toRename.slice(i, i + 250);
        for (const item of chunk) {
            batch.delete(item.docRef);
            const newRef = db.collection("students").doc(item.studentId)
                .collection("enrollments").doc(`english_${item.newClassName}`);
            const newData = { ...item.data };
            newData.className = item.newClassName;
            delete newData.endDate;
            delete newData.withdrawalDate;
            batch.set(newRef, sanitizeObject(newData));
        }
        await batch.commit();
    }

    // End date batch
    for (let i = 0; i < toEndDate.length; i += 500) {
        const batch = db.batch();
        const chunk = toEndDate.slice(i, i + 500);
        for (const item of chunk) {
            batch.update(item.docRef, {
                endDate: today,
                withdrawalDate: today,
            });
        }
        await batch.commit();
    }

    // Create batch
    for (let i = 0; i < toCreate.length; i += 500) {
        const batch = db.batch();
        const chunk = toCreate.slice(i, i + 500);
        for (const item of chunk) {
            const ref = db.collection("students").doc(item.studentId)
                .collection("enrollments").doc(`english_${item.className}`);
            batch.set(ref, sanitizeObject(item.data));
        }
        await batch.commit();
    }

    logger.info(`[applyScenarioToLive] Enrollments: ${toRename.length} renamed, ${toEndDate.length} ended, ${toCreate.length} created.`);
}

/**
 * Helper: Remove undefined values from object (Firestore doesn't accept undefined)
 */
function sanitizeObject(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined) continue;
        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            result[key] = sanitizeObject(value);
        } else {
            result[key] = value;
        }
    }
    return result;
}

// =========================================================
// Cloud Function: Validate Consultation Form Token
// =========================================================
/**
 * 학부모 QR 폼용 토큰 검증 (비인증 호출 허용)
 * embed_tokens 컬렉션에서 토큰 유효성 확인
 *
 * @param {string} token - 임베드 토큰 값
 * @returns {{ valid: boolean, error?: string }}
 */
exports.validateConsultationToken = functions
    .region("asia-northeast3")
    .https.onCall(async (data) => {
        const tokenValue = data?.token;

        if (!tokenValue || typeof tokenValue !== "string") {
            return { valid: false, error: "INVALID_INPUT" };
        }

        try {
            const snapshot = await db.collection("embed_tokens")
                .where("token", "==", tokenValue)
                .where("type", "==", "consultation-form")
                .limit(1)
                .get();

            if (snapshot.empty) {
                return { valid: false, error: "NOT_FOUND" };
            }

            const tokenDoc = snapshot.docs[0];
            const tokenData = tokenDoc.data();

            if (!tokenData.isActive) {
                return { valid: false, error: "INACTIVE" };
            }

            if (tokenData.expiresAt && tokenData.expiresAt.toDate() < new Date()) {
                return { valid: false, error: "EXPIRED" };
            }

            // 사용 기록 업데이트
            await tokenDoc.ref.update({
                lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
                usageCount: (tokenData.usageCount || 0) + 1,
            });

            return { valid: true };
        } catch (error) {
            logger.error("[validateConsultationToken] Error:", error);
            return { valid: false, error: "INTERNAL_ERROR" };
        }
    });

// =========================================================
// Cloud Function: Submit Consultation Draft
// =========================================================
/**
 * 학부모 QR 폼 제출 (비인증 호출 허용)
 * 토큰 검증 후 consultation_drafts 컬렉션에 저장
 *
 * @param {string} token - 임베드 토큰 값
 * @param {object} formData - 폼 데이터
 * @returns {{ success: boolean, draftId?: string, error?: string }}
 */
exports.submitConsultationDraft = functions
    .region("asia-northeast3")
    .https.onCall(async (data) => {
        const tokenValue = data?.token;
        const formData = data?.formData;

        // 1. 입력 검증
        if (!tokenValue || typeof tokenValue !== "string") {
            throw new functions.https.HttpsError("invalid-argument", "토큰이 필요합니다.");
        }
        if (!formData || typeof formData !== "object") {
            throw new functions.https.HttpsError("invalid-argument", "폼 데이터가 필요합니다.");
        }

        // 필수 필드 검증
        const required = ["studentName", "parentName", "parentPhone", "schoolName", "grade"];
        for (const field of required) {
            if (!formData[field] || String(formData[field]).trim() === "") {
                throw new functions.https.HttpsError("invalid-argument", `${field} 필드가 필요합니다.`);
            }
        }

        if (!formData.privacyAgreement) {
            throw new functions.https.HttpsError("invalid-argument", "개인정보 수집 동의가 필요합니다.");
        }

        try {
            // 2. 토큰 검증
            const snapshot = await db.collection("embed_tokens")
                .where("token", "==", tokenValue)
                .where("type", "==", "consultation-form")
                .limit(1)
                .get();

            if (snapshot.empty) {
                throw new functions.https.HttpsError("not-found", "유효하지 않은 토큰입니다.");
            }

            const tokenDoc = snapshot.docs[0];
            const tokenData = tokenDoc.data();

            if (!tokenData.isActive) {
                throw new functions.https.HttpsError("permission-denied", "비활성화된 토큰입니다.");
            }

            if (tokenData.expiresAt && tokenData.expiresAt.toDate() < new Date()) {
                throw new functions.https.HttpsError("permission-denied", "만료된 토큰입니다.");
            }

            // 3. Rate limiting: 토큰당 시간당 10건 (단일 필드 쿼리 → 복합 인덱스 불필요)
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const tokenDrafts = await db.collection("consultation_drafts")
                .where("tokenId", "==", tokenDoc.id)
                .get();

            const recentCount = tokenDrafts.docs.filter(d => (d.data().submittedAt || "") >= oneHourAgo).length;
            if (recentCount >= 10) {
                throw new functions.https.HttpsError(
                    "resource-exhausted",
                    "제출 횟수를 초과했습니다. 잠시 후 다시 시도해주세요."
                );
            }

            // 4. Draft 저장
            const draft = {
                tokenId: tokenDoc.id,
                status: "pending",
                // 학생 정보
                studentName: String(formData.studentName).trim(),
                gender: formData.gender || null,
                bloodType: formData.bloodType || null,
                studentPhone: formData.studentPhone || null,
                careerGoal: formData.careerGoal || null,
                schoolName: String(formData.schoolName).trim(),
                grade: String(formData.grade),
                subjects: Array.isArray(formData.subjects) ? formData.subjects : [],
                siblings: formData.siblings || null,
                // 학부모 정보
                parentName: String(formData.parentName).trim(),
                parentRelation: formData.parentRelation || null,
                parentPhone: String(formData.parentPhone).trim(),
                consultationPath: formData.consultationPath || null,
                address: formData.address || null,
                // 기타
                shuttleBusRequest: !!formData.shuttleBusRequest,
                privacyAgreement: !!formData.privacyAgreement,
                installmentAgreement: !!formData.installmentAgreement,
                // 시스템
                submittedAt: new Date().toISOString(),
            };

            const docRef = await db.collection("consultation_drafts").add(draft);

            // 5. 토큰 사용 기록 업데이트
            await tokenDoc.ref.update({
                lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
                usageCount: (tokenData.usageCount || 0) + 1,
                submissionCount: (tokenData.submissionCount || 0) + 1,
            });

            logger.info(`[submitConsultationDraft] Draft created: ${docRef.id} for student: ${draft.studentName}`);

            return { success: true, draftId: docRef.id };
        } catch (error) {
            if (error.code) throw error; // re-throw HttpsError
            logger.error("[submitConsultationDraft] Error:", error);
            throw new functions.https.HttpsError("internal", "서버 오류가 발생했습니다.");
        }
    });

// ============================================================
// Cloud Function: AI Chatbot (Gemini 2.0 Flash + Function Calling)
// ============================================================

const CHATBOT_TOOL_DEFS = [
    {
        name: "search_students",
        description: "학생을 검색합니다. 이름, 상태, 학년, 학교로 필터링 가능. 재원생 수를 알려면 status='active'로 호출. 파라미터 없이 호출하면 전체 학생 목록 반환. '고등학생 몇명?' 같은 질문에는 grade 필터 사용. '한빛중학교 학생' 같은 질문에는 school 필터 사용.",
        parameters: { type: "object", properties: {
            name: { type: "string", description: "학생 이름 (부분 일치 검색)" },
            status: { type: "string", description: "학생 상태. active=재원생, withdrawn=퇴원생, on_hold=휴원, prospect=상담예정", enum: ["active", "withdrawn", "on_hold", "prospect"] },
            grade: { type: "string", description: "학년. 예: 초1, 초2, 중1, 중2, 중3, 고1, 고2, 고3" },
            school: { type: "string", description: "학교명 (부분 일치 검색)" },
        }, required: [] },
    },
    {
        name: "get_student_enrollments",
        description: "특정 학생이 수강 중인 과목/반 목록을 조회합니다. '영어를 수강하는 학생'을 찾으려면 이 도구 대신 get_enrollments_by_subject를 사용하세요.",
        parameters: { type: "object", properties: {
            studentId: { type: "string", description: "학생 문서 ID (search_students 결과에서 획득)" },
        }, required: ["studentId"] },
    },
    {
        name: "get_enrollments_by_subject",
        description: "특정 과목을 수강하는 학생 목록을 조회합니다. '영어 수강생', '수학 듣는 학생 수', '고등학생 중 영어 수강생' 같은 질문에 사용.",
        parameters: { type: "object", properties: {
            subject: { type: "string", description: "과목", enum: ["math", "english", "science", "korean"] },
            grade: { type: "string", description: "학년 필터 (선택). 예: 초1, 중2, 고3" },
        }, required: ["subject"] },
    },
    {
        name: "get_student_scores",
        description: "학생의 시험 성적과 성적 추이를 조회합니다. 평균 점수와 상승/하락 추세를 반환합니다.",
        parameters: { type: "object", properties: {
            studentId: { type: "string", description: "학생 문서 ID (search_students 결과에서 획득)" },
            subject: { type: "string", description: "과목 필터 (선택)", enum: ["math", "english", "science", "korean"] },
        }, required: ["studentId"] },
    },
    {
        name: "get_student_attendance",
        description: "학생의 출결 기록을 기간별로 조회합니다. 출석률, 지각, 결석 횟수를 반환합니다.",
        parameters: { type: "object", properties: {
            studentId: { type: "string", description: "학생 문서 ID (search_students 결과에서 획득)" },
            startDate: { type: "string", description: "시작일 (YYYY-MM-DD)" },
            endDate: { type: "string", description: "종료일 (YYYY-MM-DD)" },
        }, required: ["studentId", "startDate", "endDate"] },
    },
    {
        name: "get_class_info",
        description: "수업(반) 목록을 조회합니다. 과목별 반 목록, 담당 선생님, 강의실, 수업 요일 정보를 반환합니다. 요일별 수업 수 통계(daySummary)도 포함됩니다. '수학 반 목록', '영어 수업', '월요일 수업', '요일별 수업 수' 같은 질문에 사용.",
        parameters: { type: "object", properties: {
            className: { type: "string", description: "수업명 (부분 일치 검색)" },
            subject: { type: "string", description: "과목 필터", enum: ["math", "english", "science", "korean"] },
            day: { type: "string", description: "요일 필터 (특정 요일의 수업만 조회)", enum: ["월", "화", "수", "목", "금", "토", "일"] },
        }, required: [] },
    },
    {
        name: "get_staff_info",
        description: "선생님/직원 정보를 조회합니다. 이름, 담당 과목(subjects), 직책, 담당 반 정보를 반환합니다. '수학 선생님 몇명?', '영어 선생님 목록', '김선생님 담당 반' 같은 질문에 사용.",
        parameters: { type: "object", properties: {
            name: { type: "string", description: "이름 (부분 일치 검색)" },
            subject: { type: "string", description: "담당 과목 필터", enum: ["math", "english", "science", "korean"] },
        }, required: [] },
    },
    {
        name: "get_billing_summary",
        description: "특정 월의 수납 현황을 조회합니다. 총 청구액, 납부액, 미납액, 수납률을 반환합니다. studentName 파라미터로 특정 학생의 미납 내역도 조회 가능. '이번 달 수납률', '김민수 미납 내역' 같은 질문에 사용.",
        parameters: { type: "object", properties: {
            month: { type: "string", description: "조회할 월 (YYYY-MM 형식, 예: 2026-02)" },
            studentName: { type: "string", description: "학생 이름 (부분 일치 검색, 특정 학생 미납 조회)" },
        }, required: ["month"] },
    },
    {
        name: "get_withdrawal_stats",
        description: "기간별 신규 등록/퇴원 통계를 조회합니다. 재원생 수, 신규 등록 수, 퇴원 수, 순증감을 반환합니다.",
        parameters: { type: "object", properties: {
            startDate: { type: "string", description: "시작일 (YYYY-MM-DD)" },
            endDate: { type: "string", description: "종료일 (YYYY-MM-DD)" },
        }, required: ["startDate", "endDate"] },
    },
    {
        name: "get_teacher_enrollment_stats",
        description: "담임 선생님별 신입생/퇴원생 통계를 조회합니다. 각 선생님의 신규 등록, 종료, 순증감 수를 반환합니다.",
        parameters: { type: "object", properties: {
            staffName: { type: "string", description: "선생님 이름 (생략 시 전체 선생님)" },
            startDate: { type: "string", description: "시작일 (YYYY-MM-DD)" },
            endDate: { type: "string", description: "종료일 (YYYY-MM-DD)" },
        }, required: ["startDate", "endDate"] },
    },
    {
        name: "get_consultations",
        description: "학생 상담 내역을 조회합니다. 학생별/선생님별/기간별 상담 기록, 상담 유형(학부모/학생), 카테고리별 통계를 반환합니다. '김민수 상담 내역', '이번 달 상담 건수', '학부모 상담 목록' 같은 질문에 사용.",
        parameters: { type: "object", properties: {
            studentName: { type: "string", description: "학생 이름 (부분 일치 검색)" },
            consultantName: { type: "string", description: "상담 선생님 이름 (부분 일치 검색)" },
            type: { type: "string", description: "상담 유형", enum: ["parent", "student"] },
            startDate: { type: "string", description: "시작일 (YYYY-MM-DD)" },
            endDate: { type: "string", description: "종료일 (YYYY-MM-DD)" },
        }, required: [] },
    },
    {
        name: "get_exam_info",
        description: "시험 정보를 조회합니다. 예정된 시험, 과목별 시험, 시험 일정을 반환합니다. '다음 시험 언제?', '수학 시험 목록', '이번 달 시험 일정' 같은 질문에 사용.",
        parameters: { type: "object", properties: {
            subject: { type: "string", description: "과목 필터", enum: ["math", "english", "both"] },
            upcoming: { type: "boolean", description: "true이면 오늘 이후 예정된 시험만 반환" },
        }, required: [] },
    },
    {
        name: "get_homework_status",
        description: "숙제 현황을 조회합니다. 반별/과목별 숙제 목록, 마감 상태를 반환합니다. '숙제 현황', '수학 숙제', '이번 주 숙제' 같은 질문에 사용.",
        parameters: { type: "object", properties: {
            subject: { type: "string", description: "과목 필터", enum: ["math", "english", "science", "korean"] },
            status: { type: "string", description: "숙제 상태", enum: ["active", "closed"] },
            className: { type: "string", description: "반 이름 (부분 일치 검색)" },
        }, required: [] },
    },
];

// Tool executor functions (server-side, using firebase-admin)
async function toolSearchStudents(args) {
    const allStudents = await getCachedStudents();
    let students = allStudents.map(d => ({ id: d.id, name: d.name, grade: d.grade, status: d.status, school: d.school, startDate: d.startDate, withdrawalDate: d.withdrawalDate }));
    if (args.status) students = students.filter(st => st.status === args.status);
    if (args.name) { const s = args.name.toLowerCase(); students = students.filter(st => st.name?.toLowerCase().includes(s)); }
    if (args.grade) students = students.filter(st => st.grade?.includes(args.grade));
    if (args.school) { const s = args.school.toLowerCase(); students = students.filter(st => st.school?.toLowerCase().includes(s)); }
    const totalCount = students.length;
    return { totalCount, students: students.slice(0, 30) };
}

async function toolGetStudentEnrollments(args) {
    const snap = await db.collection("students").doc(args.studentId).collection("enrollments").get();
    const enrollments = snap.docs.map(d => {
        const data = d.data();
        return { subject: data.subject, className: data.className, teacher: data.teacher, startDate: data.startDate || data.enrollmentDate, endDate: data.endDate || data.withdrawalDate, onHold: data.onHold };
    });
    const active = enrollments.filter(e => !e.endDate);
    const ended = enrollments.filter(e => !!e.endDate);

    // 활성 수강의 수업 스케줄(요일/시간) 조회 (캐시 활용)
    if (active.length > 0) {
        const classNames = active.map(e => e.className).filter(Boolean);
        if (classNames.length > 0) {
            const allClasses = await getCachedClasses();
            const classMap = {};
            allClasses.forEach(data => { classMap[data.className] = data; });
            for (const enrollment of active) {
                const cls = classMap[enrollment.className];
                if (cls) {
                    if (Array.isArray(cls.schedule) && cls.schedule.length > 0) {
                        enrollment.schedule = cls.schedule.map(s => `${s.day} ${s.period || ''}교시 ${s.startTime || ''}`).join(', ');
                    } else if (Array.isArray(cls.legacySchedule) && cls.legacySchedule.length > 0) {
                        enrollment.schedule = cls.legacySchedule.join(', ');
                    }
                    enrollment.room = cls.room || null;
                }
            }
        }
    }

    return { active, ended, totalActive: active.length, totalEnded: ended.length };
}

async function toolGetStudentScores(args) {
    const snap = await db.collection("student_scores").where("studentId", "==", args.studentId).get();
    let scores = snap.docs.map(d => {
        const data = d.data();
        return { subject: data.subject, score: data.score, maxScore: data.maxScore, percentage: data.percentage, grade: data.grade, createdAt: data.createdAt };
    });
    if (args.subject) scores = scores.filter(s => s.subject === args.subject);
    scores.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    scores = scores.slice(0, 10);
    const avg = scores.length > 0 ? scores.reduce((sum, s) => sum + (s.percentage || 0), 0) / scores.length : 0;
    let trend = "stable";
    if (scores.length >= 2) { const diff = (scores[0].percentage || 0) - (scores[scores.length - 1].percentage || 0); if (diff > 5) trend = "improving"; else if (diff < -5) trend = "declining"; }
    return { totalExams: scores.length, averagePercentage: Math.round(avg * 10) / 10, trend, recentScores: scores };
}

async function toolGetStudentAttendance(args) {
    const dates = [];
    const start = new Date(args.startDate);
    const end = new Date(args.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) dates.push(d.toISOString().split("T")[0]);
    const limitedDates = dates.slice(0, 31);
    let present = 0, late = 0, absent = 0, excused = 0, earlyLeave = 0, total = 0;
    for (let i = 0; i < limitedDates.length; i += 7) {
        const batch = limitedDates.slice(i, i + 7);
        const results = await Promise.all(batch.map(date => db.collection("daily_attendance").doc(date).collection("records").where("studentId", "==", args.studentId).get()));
        for (const snap of results) { for (const doc of snap.docs) { const st = doc.data().status; total++; if (st === "present") present++; else if (st === "late") late++; else if (st === "absent") absent++; else if (st === "excused") excused++; else if (st === "early_leave") earlyLeave++; } }
    }
    const rate = total > 0 ? Math.round(((present + late) / total) * 1000) / 10 : 0;
    return { period: `${args.startDate} ~ ${args.endDate}`, totalRecords: total, present, late, absent, excused, earlyLeave, attendanceRate: `${rate}%` };
}

async function toolGetClassInfo(args) {
    const allClasses = await getCachedClasses();
    let classes = allClasses.map(data => {
        let days = [];
        if (Array.isArray(data.schedule)) {
            days = [...new Set(data.schedule.map(s => s.day).filter(Boolean))];
        } else if (Array.isArray(data.legacySchedule)) {
            days = [...new Set(data.legacySchedule.map(s => s.split(' ')[0]).filter(Boolean))];
        }
        const studentCount = Array.isArray(data.students) ? data.students.length : 0;
        const capacity = data.capacity || data.maxStudents || null;
        return { id: data.id, className: data.className, subject: data.subject, teacher: data.mainTeacher || data.teacher, room: data.room, days, studentCount, capacity };
    });
    if (args.subject) classes = classes.filter(c => c.subject === args.subject);
    if (args.className) { const s = args.className.toLowerCase(); classes = classes.filter(c => c.className?.toLowerCase().includes(s)); }
    if (args.day) classes = classes.filter(c => c.days.includes(args.day));
    const daySummary = {};
    ['월','화','수','목','금','토','일'].forEach(day => { daySummary[day] = 0; });
    classes.forEach(c => c.days.forEach(day => { if (daySummary[day] !== undefined) daySummary[day]++; }));
    return { totalCount: classes.length, daySummary, classes };
}

async function toolGetStaffInfo(args) {
    const allStaff = await getCachedStaff();
    let staff = allStaff.map(d => ({ id: d.id, name: d.name, englishName: d.englishName, role: d.role, subjects: d.subjects, jobTitle: d.jobTitle, isNative: d.isNative }));
    if (args.name) { const s = args.name.toLowerCase(); staff = staff.filter(st => st.name?.toLowerCase().includes(s) || st.englishName?.toLowerCase().includes(s)); }
    if (args.subject) staff = staff.filter(st => Array.isArray(st.subjects) && st.subjects.includes(args.subject));
    // 담당 반 조회 (캐시 활용)
    if (args.name && staff.length > 0 && staff.length <= 3) {
        const allClasses = await getCachedClasses();
        const staffNames = staff.map(s => s.name);
        const classMap = {};
        allClasses.forEach(data => {
            const teacher = data.mainTeacher || data.teacher;
            if (teacher && staffNames.includes(teacher)) {
                if (!classMap[teacher]) classMap[teacher] = [];
                classMap[teacher].push({ className: data.className, subject: data.subject });
            }
        });
        staff = staff.map(s => ({ ...s, assignedClasses: classMap[s.name] || [] }));
    }
    return { totalCount: staff.length, staff };
}

async function toolGetEnrollmentsBySubject(args) {
    const snap = await db.collectionGroup("enrollments").where("subject", "==", args.subject).get();
    const studentIds = new Set();
    const enrollments = [];
    snap.docs.forEach(d => {
        const data = d.data();
        if (data.endDate || data.withdrawalDate) return; // 종료된 수강 제외
        const sid = d.ref.parent.parent?.id;
        if (sid && !studentIds.has(sid)) {
            studentIds.add(sid);
            enrollments.push({ studentId: sid, className: data.className, teacher: data.teacher || data.staffId });
        }
    });
    // grade 필터가 있으면 학생 정보 조회
    let result = enrollments;
    if (args.grade && studentIds.size > 0) {
        const studentSnap = await db.collection("students").where("status", "==", "active").get();
        const gradeMap = {};
        studentSnap.docs.forEach(d => { gradeMap[d.id] = d.data().grade; });
        result = enrollments.filter(e => gradeMap[e.studentId]?.includes(args.grade));
    }
    const subjectNames = { math: "수학", english: "영어", science: "과학", korean: "국어" };
    return { subject: subjectNames[args.subject] || args.subject, totalCount: result.length, students: result.slice(0, 30) };
}

async function toolGetBillingSummary(args) {
    const snap = await db.collection("billing").where("month", "==", args.month).get();
    let totalBilled = 0, totalPaid = 0, totalUnpaid = 0, paidCount = 0, pendingCount = 0;
    const unpaidStudents = [];
    snap.docs.forEach(d => {
        const data = d.data();
        totalBilled += data.billedAmount || 0; totalPaid += data.paidAmount || 0; totalUnpaid += data.unpaidAmount || 0;
        if (data.status === "paid") paidCount++; else { pendingCount++; unpaidStudents.push({ studentName: data.studentName, unpaidAmount: data.unpaidAmount || 0 }); }
    });
    const rate = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 1000) / 10 : 0;
    let result = { month: args.month, totalRecords: snap.size, totalBilled, totalPaid, totalUnpaid, paidCount, pendingCount, collectionRate: `${rate}%` };
    if (args.studentName) {
        const s = args.studentName.toLowerCase();
        const filtered = unpaidStudents.filter(u => u.studentName?.toLowerCase().includes(s));
        result.studentUnpaid = filtered;
    } else if (unpaidStudents.length > 0) {
        result.unpaidStudents = unpaidStudents.slice(0, 10);
    }
    return result;
}

async function toolGetWithdrawalStats(args) {
    const snap = await db.collection("students").get();
    let newEnrollments = 0, withdrawals = 0, totalActive = 0;
    const reasons = {};
    snap.docs.forEach(d => { const data = d.data(); if (data.status === "active") totalActive++; if (data.startDate && data.startDate >= args.startDate && data.startDate <= args.endDate) newEnrollments++; const wDate = data.withdrawalDate || data.endDate; if (data.status === "withdrawn" && wDate && wDate >= args.startDate && wDate <= args.endDate) { withdrawals++; const r = data.withdrawalReason || "미입력"; reasons[r] = (reasons[r] || 0) + 1; } });
    return { period: `${args.startDate} ~ ${args.endDate}`, totalActive, newEnrollments, withdrawals, netChange: newEnrollments - withdrawals, withdrawalReasons: reasons };
}

async function toolGetTeacherEnrollmentStats(args) {
    const snap = await db.collectionGroup("enrollments").get();
    const stats = {};
    snap.docs.forEach(d => { const data = d.data(); const teacher = data.teacher || data.staffId || "unknown"; if (!stats[teacher]) stats[teacher] = { newCount: 0, endedCount: 0, totalActive: 0 }; if (!data.endDate && !data.withdrawalDate) stats[teacher].totalActive++; const sd = data.startDate || data.enrollmentDate; if (sd && sd >= args.startDate && sd <= args.endDate) stats[teacher].newCount++; const ed = data.endDate || data.withdrawalDate; if (ed && ed >= args.startDate && ed <= args.endDate) stats[teacher].endedCount++; });
    let result = Object.entries(stats).map(([name, s]) => ({ teacher: name, ...s, netChange: s.newCount - s.endedCount }));
    if (args.staffName) { const s = args.staffName.toLowerCase(); result = result.filter(r => r.teacher.toLowerCase().includes(s)); }
    result.sort((a, b) => b.netChange - a.netChange);
    return { period: `${args.startDate} ~ ${args.endDate}`, teacherStats: result };
}

async function toolGetConsultations(args) {
    let query = db.collection("student_consultations");
    if (args.type) query = query.where("type", "==", args.type);
    const snap = await query.get();
    let consultations = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, studentName: data.studentName, consultantName: data.consultantName, type: data.type, category: data.category, title: data.title, date: data.date, followUpNeeded: data.followUpNeeded, followUpDone: data.followUpDone };
    });
    if (args.studentName) { const s = args.studentName.toLowerCase(); consultations = consultations.filter(c => c.studentName?.toLowerCase().includes(s)); }
    if (args.consultantName) { const s = args.consultantName.toLowerCase(); consultations = consultations.filter(c => c.consultantName?.toLowerCase().includes(s)); }
    if (args.startDate) consultations = consultations.filter(c => c.date >= args.startDate);
    if (args.endDate) consultations = consultations.filter(c => c.date <= args.endDate);
    consultations.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const categoryStats = {};
    consultations.forEach(c => { categoryStats[c.category || "기타"] = (categoryStats[c.category || "기타"] || 0) + 1; });
    const followUpNeeded = consultations.filter(c => c.followUpNeeded && !c.followUpDone).length;
    return { totalCount: consultations.length, categoryStats, followUpNeeded, consultations: consultations.slice(0, 20) };
}

async function toolGetExamInfo(args) {
    const snap = await db.collection("exams").get();
    let exams = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, title: data.title, date: data.date, type: data.type, subject: data.subject, maxScore: data.maxScore, scope: data.scope, targetGrades: data.targetGrades };
    });
    if (args.subject) exams = exams.filter(e => e.subject === args.subject || e.subject === "both");
    if (args.upcoming) { const today = getTodayKST(); exams = exams.filter(e => e.date >= today); }
    exams.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    return { totalCount: exams.length, exams: exams.slice(0, 20) };
}

async function toolGetHomeworkStatus(args) {
    let query = db.collection("homework");
    if (args.status) query = query.where("status", "==", args.status);
    if (args.subject) query = query.where("subject", "==", args.subject);
    const snap = await query.get();
    let homework = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, title: data.title, className: data.className, subject: data.subject, assignedByName: data.assignedByName, assignedDate: data.assignedDate, dueDate: data.dueDate, status: data.status, targetCount: Array.isArray(data.targetStudentIds) ? data.targetStudentIds.length : 0 };
    });
    if (args.className) { const s = args.className.toLowerCase(); homework = homework.filter(h => h.className?.toLowerCase().includes(s)); }
    homework.sort((a, b) => (b.dueDate || "").localeCompare(a.dueDate || ""));
    const today = getTodayKST();
    const overdue = homework.filter(h => h.status === "active" && h.dueDate < today).length;
    return { totalCount: homework.length, overdueCount: overdue, homework: homework.slice(0, 20) };
}

const TOOL_EXECUTOR_MAP = {
    search_students: toolSearchStudents,
    get_student_enrollments: toolGetStudentEnrollments,
    get_enrollments_by_subject: toolGetEnrollmentsBySubject,
    get_student_scores: toolGetStudentScores,
    get_student_attendance: toolGetStudentAttendance,
    get_class_info: toolGetClassInfo,
    get_staff_info: toolGetStaffInfo,
    get_billing_summary: toolGetBillingSummary,
    get_withdrawal_stats: toolGetWithdrawalStats,
    get_teacher_enrollment_stats: toolGetTeacherEnrollmentStats,
    get_consultations: toolGetConsultations,
    get_exam_info: toolGetExamInfo,
    get_homework_status: toolGetHomeworkStatus,
};

exports.chatWithAI = functions.region("asia-northeast3").runWith({ timeoutSeconds: 60, memory: "512MB" }).https.onCall(async (data, context) => {
    // 1. Auth check
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const { message, history, userName, userRole } = data;
    if (!message || typeof message !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "메시지가 필요합니다.");
    }

    // 2. Get API key from environment
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        logger.error("[chatWithAI] GEMINI_API_KEY not set in functions/.env");
        throw new functions.https.HttpsError("failed-precondition", "AI 서비스가 설정되지 않았습니다.");
    }

    try {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        const today = getTodayKST();
        const currentMonth = today.slice(0, 7);

        const systemPrompt = `당신은 인재원 학원 관리 시스템의 AI 어시스턴트입니다.
사용자: ${userName || "사용자"} (${userRole || "user"})
오늘 날짜: ${today}, 현재 월: ${currentMonth}

중요 규칙:
1. 반드시 한국어로만 답변하세요. 영어, 기술 용어, 도구 이름을 절대 노출하지 마세요.
2. 질문에 답하려면 반드시 도구를 호출하여 실제 데이터를 조회하세요. 추측 금지.
3. 도구 호출 결과가 없거나 0건이면 "데이터가 없습니다"라고 정직하게 답하세요.
4. 답변은 간결하고 자연스러운 한국어로 작성하세요. 목록은 번호를 매겨주세요.

도구 활용 가이드:
- "재원생 몇명?" → search_students(status="active") 호출
- "고등학생 중 영어 수강생" → get_enrollments_by_subject(subject="english", grade="고1") 등 호출
- "김민수 출석률" → 먼저 search_students(name="김민수")로 ID 획득 → get_student_attendance 호출
- "수학 선생님" → get_staff_info(subject="math") 호출
- "이번 달 수납률" → get_billing_summary(month="${currentMonth}") 호출
- "김민수 상담 내역" → get_consultations(studentName="김민수") 호출
- "다음 시험 언제?" → get_exam_info(upcoming=true) 호출
- "숙제 현황" → get_homework_status(status="active") 호출
- "요일별 수업 수" → get_class_info() 호출 (daySummary 확인)
- "월요일 수업" → get_class_info(day="월") 호출
- "한빛중 학생" → search_students(school="한빛중") 호출
- "미납 학생" → get_billing_summary(month="${currentMonth}") 호출 (unpaidStudents 확인)
- 기간 미지정 통계 → 최근 1개월 (${today.slice(0,8)}01 ~ ${today}) 사용

과목 코드: math=수학, english=영어, science=과학, korean=국어
학년 형식: 초1~초6, 중1~중3, 고1~고3

조회할 수 없는 질문(공지사항, 자료실, 셔틀, 급여, 마케팅, 일정표 등)에 대해서는 "해당 정보는 시스템 화면에서 직접 확인하시는 것이 더 빠르고 정확합니다"라고 안내하세요.

응답 길이 규칙:
- 결과가 많을 경우 상위 항목만 보여주고, 마지막에 "...외 N건은 시스템에서 직접 확인해주세요." 라고 안내하세요.
- 답변이 길어질 것 같으면 핵심만 요약하고, 하단에 "📋 이후 내용은 생략되었습니다. 더 자세한 내용은 시스템에서 확인해주세요."를 반드시 추가하세요.

도움말/사용법 안내:
사용자가 "뭘 할 수 있어?", "도움말", "어떤 질문을 할 수 있어?", "기능 안내" 등 챗봇 기능을 물어보면, 도구를 호출하지 말고 아래 내용을 바로 안내하세요:
"아래와 같은 질문을 도와드릴 수 있어요!
👩‍🎓 학생 — 재원생 수, 학년별/학교별 검색
📚 수강 — 과목별 수강생, 학생별 수강 과목
✅ 출결 — 출석률, 지각/결석 현황
📝 시험·숙제 — 시험 일정, 숙제 현황
💰 수납 — 수납률, 미납 학생 목록
👨‍🏫 선생님 — 선생님 정보, 담당 반
📊 통계 — 신규/퇴원 추이, 담임별 통계
💬 상담 — 상담 내역, 후속 조치 현황

또한, 시스템 사용법도 안내해드릴 수 있어요! 예: '출석부 어떻게 써?', '학생 등록 방법'"

시스템 사용법 안내 (도구 호출 없이 직접 답변):
사용자가 탭/기능의 사용법을 물어보면 도구 호출 없이 아래 지식으로 답변하세요.
■ 역할: Master/Admin(전체) > Manager(운영) > 팀장(교과총괄) > 강사(교과담당) > User(기본)
■ 시간표: 과목별 강사/교실/수업별 뷰, 드래그 배정, 시뮬레이션
■ 출석부: 월간/세션별 뷰, 이름클릭 상태변경(출석/결석/지각/조퇴/사유결석)
■ 수업관리: 과목/담임/요일 필터, 수업 생성, 학생배정
■ 학생관리: 2단레이아웃, 검색/필터, 수강이력/성적/출결/메모, Excel마이그레이션
■ 등록상담: 상담등록, 레벨테스트, 원생전환, QR접수
■ 성적: 시험등록/성적입력/자동통계, 레벨테스트
■ 퇴원: 퇴원등록(사유추적), 재원복구
■ 수납: 상태필터, Excel가져오기/내보내기
■ 강의실배정: AI자동배정, 드래그 수동배정, 충돌감지
■ 기타: 연간일정(뷰모드/부서필터), 간트차트(프로젝트관리), 역할관리(권한설정), 자료실(폴더구조)
해당 탭 핵심만 2~3줄로 간결하게 안내. 데이터 조회 질문에는 반드시 도구 호출.`;

        // 3. Build conversation history for Gemini
        const contents = [];
        if (Array.isArray(history)) {
            for (const msg of history.slice(-20)) { // Keep last 20 messages
                contents.push({
                    role: msg.role === "assistant" ? "model" : "user",
                    parts: [{ text: msg.content }],
                });
            }
        }
        contents.push({ role: "user", parts: [{ text: message }] });

        // 4. Call Gemini with tools
        let response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents,
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.3,
                maxOutputTokens: 1024,
                tools: [{ functionDeclarations: CHATBOT_TOOL_DEFS }],
            },
        });

        // 5. Tool execution loop (max 5 iterations)
        const hasFunctionCalls = (resp) => { try { return resp.functionCalls && resp.functionCalls.length > 0; } catch { return false; } };
        logger.info("[chatWithAI] Initial response", { hasText: !!response.text, hasCalls: hasFunctionCalls(response), finishReason: response.candidates?.[0]?.finishReason });
        let iterations = 0;
        while (hasFunctionCalls(response) && iterations < 5) {
            iterations++;

            const toolResults = [];
            for (const fc of response.functionCalls) {
                logger.info(`[chatWithAI] Tool call: ${fc.name}`, { args: fc.args });
                const executor = TOOL_EXECUTOR_MAP[fc.name];
                let result;
                if (executor) {
                    try {
                        result = await executor(fc.args || {});
                        logger.info(`[chatWithAI] Tool result: ${fc.name}`, { resultKeys: Object.keys(result), count: result.totalCount || result.count });
                    } catch (err) {
                        logger.error(`[chatWithAI] Tool error: ${fc.name}`, { error: err.message });
                        result = { error: `조회 중 오류가 발생했습니다: ${err.message}` };
                    }
                } else {
                    result = { error: `알 수 없는 도구: ${fc.name}` };
                }
                toolResults.push(createPartFromFunctionResponse(fc.id || `call_${Date.now()}`, fc.name, result));
            }

            // Build new contents with function responses
            const updatedContents = [...contents];
            // Add model's function call
            updatedContents.push({ role: "model", parts: response.candidates?.[0]?.content?.parts || [] });
            // Add function responses
            updatedContents.push({ role: "user", parts: toolResults });

            response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: updatedContents,
                config: {
                    systemInstruction: systemPrompt,
                    temperature: 0.3,
                    maxOutputTokens: 1024,
                    tools: [{ functionDeclarations: CHATBOT_TOOL_DEFS }],
                },
            });

            // Update contents for potential next iteration
            contents.length = 0;
            contents.push(...updatedContents);
            if (response.functionCalls && response.functionCalls.length > 0) {
                contents.push({ role: "model", parts: response.candidates?.[0]?.content?.parts || [] });
            }
        }

        // 응답 텍스트 추출 (여러 방법으로 시도)
        let text = "";
        try {
            text = response.text || "";
        } catch (e) {
            // response.text getter가 throw할 수 있음 (safety filter 등)
            logger.warn("[chatWithAI] response.text threw:", e.message);
        }
        if (!text) {
            // candidates에서 직접 추출 시도
            const parts = response.candidates?.[0]?.content?.parts || [];
            text = parts.filter(p => p.text).map(p => p.text).join("");
        }
        if (!text) {
            const finishReason = response.candidates?.[0]?.finishReason;
            logger.warn("[chatWithAI] Empty response", { finishReason, candidateCount: response.candidates?.length });
            text = "죄송합니다. 응답을 생성하지 못했습니다. 질문을 다시 입력해주세요.";
        }
        logger.info("[chatWithAI] Final response length:", text.length);
        return { response: text };

    } catch (error) {
        logger.error("[chatWithAI] Error:", error);
        if (error.code) throw error;
        throw new functions.https.HttpsError("internal", "AI 응답 생성 중 오류가 발생했습니다.");
    }
});

// ===== MakeEdu 버스 데이터 크롤링 =====
const cheerio = require("cheerio");

/**
 * MakeEdu 버스 등록 페이지 크롤링하여 Firestore에 저장
 * .env 파일의 MAKEEDU_USERNAME / MAKEEDU_PASSWORD 사용
 */
exports.scrapeMakeEduBusData = functions
    .region("asia-northeast3")
    .runWith({ timeoutSeconds: 300, memory: "512MB" })
    .https.onCall(async (data, context) => {
        logger.info("[scrapeMakeEduBusData] Start");

        try {
            // 1. .env에서 MakeEdu 로그인 정보 가져오기
            const userId = process.env.MAKEEDU_USERNAME;
            const userPwd = process.env.MAKEEDU_PASSWORD;
            if (!userId || !userPwd) {
                throw new functions.https.HttpsError("not-found",
                    "MakeEdu 로그인 정보가 .env에 설정되지 않았습니다.");
            }

            const baseUrl = "https://school.makeedu.co.kr";
            const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

            // 2. 먼저 로그인 페이지 접근하여 JSESSIONID 쿠키 획득
            logger.info("[scrapeMakeEduBusData] Getting session...");
            const sessionRes = await fetch(`${baseUrl}/login.do`, {
                headers: { "User-Agent": UA },
                redirect: "manual",
            });

            const sessionCookies = [];
            const sessionSetCookies = sessionRes.headers.getSetCookie?.() || [];
            for (const h of sessionSetCookies) {
                const cookie = h.split(";")[0];
                if (cookie) sessionCookies.push(cookie);
            }
            let cookieStr = sessionCookies.join("; ");
            logger.info("[scrapeMakeEduBusData] Session cookies:", sessionCookies.length, cookieStr);

            // 3. MakeEdu 로그인 (membId, password)
            logger.info("[scrapeMakeEduBusData] Logging in...");
            const loginRes = await fetch(`${baseUrl}/loginPopProc.do`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": UA,
                    "Cookie": cookieStr,
                    "Referer": `${baseUrl}/login.do`,
                },
                body: `membId=${encodeURIComponent(userId)}&password=${encodeURIComponent(userPwd)}`,
                redirect: "manual",
            });

            // 로그인 응답에서 추가 쿠키 수집
            const loginSetCookies = loginRes.headers.getSetCookie?.() || [];
            for (const h of loginSetCookies) {
                const cookie = h.split(";")[0];
                if (cookie) sessionCookies.push(cookie);
            }
            cookieStr = sessionCookies.join("; ");

            const loginBody = await loginRes.text();
            logger.info("[scrapeMakeEduBusData] Login status:", loginRes.status, "Body:", loginBody.substring(0, 300));
            logger.info("[scrapeMakeEduBusData] All cookies:", cookieStr);

            // 로그인 성공 여부 확인 (OK 응답 또는 302 리다이렉트)
            const loginOk = loginBody.includes("OK") || loginRes.status === 302 || loginRes.status === 200;
            if (!loginOk && sessionCookies.length === 0) {
                throw new functions.https.HttpsError("unauthenticated",
                    `MakeEdu 로그인 실패 (status: ${loginRes.status})`);
            }

            // 4. 버스 등록 페이지 가져오기
            logger.info("[scrapeMakeEduBusData] Fetching bus page...");
            const busRes = await fetch(`${baseUrl}/bus/busRegist.do`, {
                headers: {
                    "Cookie": cookieStr,
                    "User-Agent": UA,
                    "Referer": `${baseUrl}/main.do`,
                },
            });

            if (!busRes.ok) {
                throw new functions.https.HttpsError("internal",
                    `버스 페이지 접근 실패: HTTP ${busRes.status}`);
            }

            const html = await busRes.text();
            logger.info("[scrapeMakeEduBusData] Got HTML, length:", html.length);

            // 4. "전체출력" 호출: POST busRegist.do with srchType=A
            // (btnSrchAll 핸들러: $('#srchType').val("A"); $('#srchForm').submit())
            logger.info("[scrapeMakeEduBusData] Calling 전체출력 (srchType=A)...");
            const printRes = await fetch(`${baseUrl}/bus/busRegist.do`, {
                method: "POST",
                headers: {
                    "Cookie": cookieStr,
                    "User-Agent": UA,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Referer": `${baseUrl}/bus/busRegist.do`,
                },
                body: "srchType=A",
            });
            let printHtml = await printRes.text();
            let hasStudents = printHtml.includes("bus_stname_list");
            logger.info(`[scrapeMakeEduBusData] 전체출력 result: status:${printRes.status} len:${printHtml.length} hasStudents:${hasStudents} hasMsrItem:${printHtml.includes("msrItem")}`);

            // 학생 데이터가 없으면 엑셀 endpoint 시도 (busRegist_excel.do도 bus_stname_list 포함)
            if (!hasStudents) {
                logger.info("[scrapeMakeEduBusData] Trying excel endpoint...");
                const excelRes = await fetch(`${baseUrl}/bus/busRegist_excel.do`, {
                    headers: { "Cookie": cookieStr, "User-Agent": UA, "Referer": `${baseUrl}/bus/busRegist.do` },
                });
                const excelHtml = await excelRes.text();
                if (excelHtml.includes("bus_stname_list")) {
                    logger.info(`[scrapeMakeEduBusData] Excel endpoint has students! len:${excelHtml.length}`);
                    printHtml = excelHtml;
                    hasStudents = true;
                }
            }

            // studAllList endpoint도 시도
            if (!hasStudents) {
                logger.info("[scrapeMakeEduBusData] Trying studAllList endpoint...");
                const studRes = await fetch(`${baseUrl}/bus/busRegist_studAllList.do`, {
                    headers: { "Cookie": cookieStr, "User-Agent": UA, "Referer": `${baseUrl}/bus/busRegist.do` },
                });
                const studHtml = await studRes.text();
                if (studHtml.includes("bus_stname_list") || studHtml.includes("msrItem")) {
                    logger.info(`[scrapeMakeEduBusData] studAllList has data! len:${studHtml.length}`);
                    printHtml = studHtml;
                    hasStudents = studHtml.includes("bus_stname_list");
                }
            }

            // 5. printHtml 파싱
            const busRoutes = [];
            const routes = parseBusHtml(printHtml);
            logger.info("[scrapeMakeEduBusData] Parsed routes:", routes.length, "totalStudents:", routes.reduce((s, r) => s + r.totalBoardingCount + r.totalAlightingCount, 0));

            // 원하는 버스만 필터링 (호차만, 방학중/박학중 제외)
            for (const route of routes) {
                if (route.busName.includes("호차") && !route.busName.includes("방학중") && !route.busName.includes("박학중")) {
                    busRoutes.push(route);
                }
            }
            logger.info("[scrapeMakeEduBusData] Filtered routes:", busRoutes.length);

            logger.info("[scrapeMakeEduBusData] Total parsed routes:", busRoutes.length);

            if (busRoutes.length === 0) {
                throw new functions.https.HttpsError("not-found",
                    `파싱 실패. busCodes: ${busCodes.map(b => b.code).join(",")}`);
            }

            // 5. Firestore에 저장 (기존 데이터 삭제 후 새로 저장)
            const batch = db.batch();

            const existingSnap = await db.collection("bus_routes").get();
            existingSnap.docs.forEach(d => batch.delete(d.ref));

            const now = new Date().toISOString();
            busRoutes.forEach(route => {
                const ref = db.collection("bus_routes").doc();
                batch.set(ref, {
                    ...route,
                    syncedAt: now,
                    source: "makeedu",
                });
            });

            await batch.commit();
            logger.info("[scrapeMakeEduBusData] Saved to Firestore");

            return {
                success: true,
                count: busRoutes.length,
                routes: busRoutes.map(r => ({
                    busName: r.busName,
                    stopCount: r.stops.length,
                    totalBoardingCount: r.totalBoardingCount,
                    totalAlightingCount: r.totalAlightingCount,
                })),
            };
        } catch (error) {
            logger.error("[scrapeMakeEduBusData] Error:", error);
            if (error.code) throw error;
            throw new functions.https.HttpsError("internal", error.message || "버스 데이터 크롤링 실패");
        }
    });

/**
 * 버스 페이지 HTML 파싱
 */
function parseBusHtml(html) {
    const $ = cheerio.load(html);
    const busRoutes = [];

    $(".msrItem").each((_, item) => {
        const busName = $(item).find("h4").first().text().trim();
        if (!busName) return;

        const stops = [];

        $(item).find("table tbody tr").each((__, row) => {
            const cells = $(row).find("td");
            if (cells.length < 5) return;

            const order = parseInt($(cells[0]).text().trim()) || 0;
            const destination = $(cells[1]).text().trim().replace(/\s+/g, " ");
            const time = $(cells[2]).text().trim();

            const boardingStudents = extractStudentsFromCell($, cells[3]);
            const alightingStudents = extractStudentsFromCell($, cells[4]);

            stops.push({
                order,
                destination,
                time,
                boardingStudents,
                alightingStudents,
            });
        });

        const totalBoardingCount = stops.reduce((sum, s) => sum + s.boardingStudents.length, 0);
        const totalAlightingCount = stops.reduce((sum, s) => sum + s.alightingStudents.length, 0);

        busRoutes.push({
            busName,
            stops,
            totalBoardingCount,
            totalAlightingCount,
        });
    });

    return busRoutes;
}

/**
 * AJAX 응답 (subBusList) HTML 파싱 - msrItem 없이 table 직접 파싱
 */
function parseSubBusHtml(html, busName) {
    const $ = cheerio.load(html);
    const stops = [];

    // table tbody tr 직접 파싱
    $("table tbody tr, tr").each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length < 5) return;

        const order = parseInt($(cells[0]).text().trim()) || 0;
        const destination = $(cells[1]).text().trim().replace(/\s+/g, " ");
        const time = $(cells[2]).text().trim();

        const boardingStudents = extractStudentsFromCell($, cells[3]);
        const alightingStudents = extractStudentsFromCell($, cells[4]);

        stops.push({ order, destination, time, boardingStudents, alightingStudents });
    });

    if (stops.length === 0) return [];

    const totalBoardingCount = stops.reduce((sum, s) => sum + s.boardingStudents.length, 0);
    const totalAlightingCount = stops.reduce((sum, s) => sum + s.alightingStudents.length, 0);

    return [{
        busName: busName || "버스",
        stops,
        totalBoardingCount,
        totalAlightingCount,
    }];
}

/**
 * 셀에서 학생 목록 추출 (다중 전략)
 */
function extractStudentsFromCell($, cell) {
    const students = [];

    // 전략 1: .bus_stname_list span
    $(cell).find(".bus_stname_list").each((_, span) => {
        const weekbox = $(span).find(".weekbox");
        const days = weekbox.text().replace(/[()]/g, "").trim();
        const cloned = $(span).clone();
        cloned.find(".weekbox").remove();
        const name = cloned.text().trim();
        if (name) students.push({ name, days });
    });
    if (students.length > 0) return students;

    // 전략 2: span 태그들 (클래스 무관)
    $(cell).find("span").each((_, span) => {
        const text = $(span).text().trim();
        if (!text || text.length > 20) return; // 이름이 아닌 긴 텍스트 제외
        // 요일 패턴 추출 (월화수목금 등)
        const daysMatch = text.match(/\(([월화수목금토일,\s]+)\)/);
        const days = daysMatch ? daysMatch[1].trim() : "";
        const name = text.replace(/\([^)]*\)/g, "").trim();
        if (name && name.length >= 2 && name.length <= 10) {
            students.push({ name, days });
        }
    });
    if (students.length > 0) return students;

    // 전략 3: <br> 또는 줄바꿈으로 구분된 텍스트
    const cellHtml = $(cell).html() || "";
    if (cellHtml.includes("<br")) {
        const parts = cellHtml.split(/<br\s*\/?>/i);
        for (const part of parts) {
            const $part = cheerio.load(`<span>${part}</span>`);
            const text = $part("span").text().trim();
            if (!text || text.length < 2) continue;
            const daysMatch = text.match(/\(([월화수목금토일,\s]+)\)/);
            const days = daysMatch ? daysMatch[1].trim() : "";
            const name = text.replace(/\([^)]*\)/g, "").trim();
            if (name && name.length >= 2 && name.length <= 10) {
                students.push({ name, days });
            }
        }
    }
    if (students.length > 0) return students;

    // 전략 4: div 안의 텍스트
    $(cell).find("div").each((_, div) => {
        const text = $(div).text().trim();
        if (!text || text.length < 2 || text.length > 20) return;
        const daysMatch = text.match(/\(([월화수목금토일,\s]+)\)/);
        const days = daysMatch ? daysMatch[1].trim() : "";
        const name = text.replace(/\([^)]*\)/g, "").trim();
        if (name && name.length >= 2 && name.length <= 10) {
            students.push({ name, days });
        }
    });
    if (students.length > 0) return students;

    // 전략 5: 셀의 전체 텍스트를 줄바꿈/쉼표로 분리
    const fullText = $(cell).text().trim();
    if (fullText && fullText.length >= 2) {
        const names = fullText.split(/[,\n\r]+/).map(s => s.trim()).filter(s => s.length >= 2 && s.length <= 10);
        for (const raw of names) {
            const daysMatch = raw.match(/\(([월화수목금토일,\s]+)\)/);
            const days = daysMatch ? daysMatch[1].trim() : "";
            const name = raw.replace(/\([^)]*\)/g, "").trim();
            if (name) students.push({ name, days });
        }
    }

    return students;
}

// ============================================================
// 시간표 배포 → 클래스노트 자동 업로드 (Puppeteer)
// Edutrix submitToClassNote_v2 로직 그대로 복사 + puppeteer-core/chromium 적용
// ============================================================
exports.submitTimetableToClassNote = functions
    .runWith({ memory: "2GB", timeoutSeconds: 540 })
    .region("asia-northeast3")
    .https.onCall(async (data, context) => {
        const puppeteer = require("puppeteer-core");
        const chromium = require("@sparticuz/chromium");
        const fs = require("fs");
        const path = require("path");
        const os = require("os");
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const { reports } = data;

        // 하드코딩된 클래스노트 로그인 정보
        const loginId = "injaewonpremium";
        const loginPw = "mbplaza2*";

        if (!reports || !Array.isArray(reports) || reports.length === 0) {
            throw new functions.https.HttpsError("invalid-argument", "보고서 데이터가 없습니다.");
        }

        logger.info(`=== submitTimetableToClassNote 함수 호출 시작 ===`);
        logger.info(`시간표 배포 시작: ${reports.length}명`);

        let browser = null;
        try {
            // Puppeteer 실행 (puppeteer-core + @sparticuz/chromium)
            browser = await puppeteer.launch({
                args: [
                    ...chromium.args,
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--lang=ko-KR',
                ],
                defaultViewport: { width: 1280, height: 720 },
                executablePath: await chromium.executablePath(),
                headless: chromium.headless,
            });

            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 720 });

            // User Agent + 한국어 설정
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.setExtraHTTPHeaders({ 'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7' });

            // 클래스노트 로그인
            logger.info('로그인 페이지로 이동...');
            try {
                await page.goto('https://www.classnote.com/login', {
                    waitUntil: 'networkidle2',
                    timeout: 60000
                });
                logger.info('로그인 페이지 로드 완료');
            } catch (gotoError) {
                logger.error('페이지 로드 오류:', gotoError);
                throw new Error(`로그인 페이지 로드 실패: ${gotoError.message}`);
            }

            // 로그인 정보 입력
            logger.info('로그인 정보 입력...');
            await page.waitForSelector('input[type="text"], input[type="email"]', { timeout: 10000 });

            const idInput = await page.$('input[type="text"], input[type="email"]');
            if (idInput) {
                await idInput.click({ clickCount: 3 });
                await idInput.type(loginId, { delay: 100 });
            }

            const pwInput = await page.$('input[type="password"]');
            if (pwInput) {
                await pwInput.click({ clickCount: 3 });
                await pwInput.type(loginPw, { delay: 100 });
            }

            // 로그인 버튼 클릭
            logger.info('로그인 버튼 클릭...');
            const loginButton = await page.evaluateHandle(() => {
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
                return buttons.find(btn => {
                    const text = btn.textContent || btn.value || '';
                    return text.includes('로그인') ||
                        text.includes('Login') ||
                        btn.type === 'submit';
                });
            });

            if (loginButton && loginButton.asElement()) {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
                    loginButton.asElement().click()
                ]);
            } else {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
                    page.keyboard.press('Enter')
                ]);
            }
            logger.info('로그인 완료');

            const results = [];

            // 각 보고서 처리
            for (let i = 0; i < reports.length; i++) {
                const report = reports[i];
                const { studentName, reportDate, imageBase64 } = report;

                if (!studentName || !reportDate || !imageBase64) {
                    logger.info(`보고서 ${i + 1} 데이터 불완전: studentName=${studentName}, reportDate=${reportDate}, hasImage=${!!imageBase64}`);
                    results.push({
                        success: false,
                        studentName: studentName || '알 수 없음',
                        reportDate: reportDate || '알 수 없음',
                        status: 'error',
                        message: '필수 데이터가 없습니다. (학생이름, 날짜, 이미지 필요)'
                    });
                    continue;
                }

                logger.info(`보고서 처리 중 (${i + 1}/${reports.length}): ${studentName} - ${reportDate}`);

                try {
                    // 보고서 작성 페이지 이동 (domcontentloaded + flat wait)
                    await page.goto('https://www.classnote.com/service/report/add', {
                        waitUntil: 'domcontentloaded',
                        timeout: 30000
                    });
                    await delay(2000);

                    // 호칭 설정 (관리자) - 항상 대기 후 체크 + 모달 닫힘 검증
                    logger.info(`[${studentName}] 호칭 설정 중...`);
                    await delay(3000);

                    // 호칭 모달 처리 (최대 3번 시도)
                    for (let hoChingAttempt = 0; hoChingAttempt < 3; hoChingAttempt++) {
                        const hoChingResult = await page.evaluate(() => {
                            // 호칭 모달이 있는지 확인 ("해당 호칭을 기본 호칭으로 저장" 텍스트)
                            const bodyText = document.body?.innerText || '';
                            const hasModal = bodyText.includes('호칭') || bodyText.includes('기본 호칭');
                            const radios = document.querySelectorAll('input[type="radio"]');

                            if (radios.length === 0 && !hasModal) {
                                return { status: 'no-modal' };
                            }

                            // 라디오 버튼 클릭
                            let selected = null;
                            for (let i = 0; i < radios.length; i++) {
                                const radio = radios[i];
                                const label = document.querySelector('label[for="' + radio.id + '"]');
                                const parent = radio.parentElement;
                                const text = (label ? label.textContent : '') + ' ' + (parent ? parent.textContent : '');
                                if (text.includes('관리자')) {
                                    radio.click();
                                    selected = '관리자';
                                    break;
                                }
                            }
                            if (!selected && radios.length > 0) {
                                radios[0].click();
                                selected = '첫번째';
                            }

                            return { status: 'modal-found', selected, radioCount: radios.length };
                        });
                        logger.info(`[${studentName}] 호칭 시도 ${hoChingAttempt + 1}: ${JSON.stringify(hoChingResult)}`);

                        if (hoChingResult.status === 'no-modal') {
                            logger.info(`[${studentName}] 호칭 모달 없음, 진행`);
                            break;
                        }

                        // 라디오 클릭 후 확인 버튼 JS 클릭 (모든 "확인" 중 호칭 모달의 것)
                        await delay(500);
                        const confirmResult = await page.evaluate(() => {
                            const buttons = Array.from(document.querySelectorAll('button'))
                                .filter(btn => btn.offsetParent !== null);
                            // 호칭 모달의 확인 버튼 찾기
                            const confirmBtn = buttons.find(btn => {
                                const t = (btn.textContent || '').trim();
                                return t === '확인' || t === 'OK';
                            });
                            if (confirmBtn) {
                                const btnText = (confirmBtn.textContent || '').trim();
                                // mousedown → mouseup → click 시퀀스 (React 호환)
                                confirmBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                                confirmBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                                confirmBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                return 'clicked: ' + btnText;
                            }
                            return 'not-found';
                        });
                        logger.info(`[${studentName}] 호칭 확인 JS 클릭: ${confirmResult}`);
                        await delay(2000);

                        // 호칭 모달이 닫혔는지 확인
                        const stillOpen = await page.evaluate(() => {
                            const bodyText = document.body?.innerText || '';
                            return bodyText.includes('해당 호칭을 기본 호칭으로 저장');
                        });
                        if (!stillOpen) {
                            logger.info(`[${studentName}] 호칭 모달 닫힘 확인!`);
                            break;
                        }
                        logger.warn(`[${studentName}] 호칭 모달 아직 열림, 재시도...`);
                        await delay(1000);
                    }

                    // 최종 확인: 호칭 모달이 아직 열려있으면 강제 닫기
                    const finalHoChingCheck = await page.evaluate(() => {
                        const bodyText = document.body?.innerText || '';
                        if (bodyText.includes('해당 호칭을 기본 호칭으로 저장')) {
                            // 취소 버튼 클릭으로 강제 닫기
                            const buttons = Array.from(document.querySelectorAll('button'))
                                .filter(btn => btn.offsetParent !== null);
                            // 마지막 "취소" 버튼이 호칭 모달의 것
                            const cancelBtns = buttons.filter(btn => {
                                const text = (btn.textContent || '').trim();
                                return text === '취소' || text === 'Cancel';
                            });
                            if (cancelBtns.length > 0) {
                                const lastCancel = cancelBtns[cancelBtns.length - 1];
                                lastCancel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                                lastCancel.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                                lastCancel.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                return 'force-cancelled';
                            }
                            // ESC 키로도 시도
                            return 'still-open';
                        }
                        return 'closed';
                    });
                    logger.info(`[${studentName}] 호칭 최종 상태: ${finalHoChingCheck}`);
                    if (finalHoChingCheck === 'still-open') {
                        await page.keyboard.press('Escape');
                        await delay(1000);
                    }
                    await delay(1000);

                    // 날짜 선택
                    logger.info(`[${studentName}] 날짜 선택 중...`);
                    const dateParts = reportDate.split("T")[0].split('-');
                    const year = parseInt(dateParts[0]);
                    const month = parseInt(dateParts[1]);
                    const day = parseInt(dateParts[2]);

                    let dateButton = null;
                    try {
                        await page.waitForSelector("button.e1a4g8se4", { timeout: 5000 });
                        dateButton = await page.$("button.e1a4g8se4");
                    } catch (e) {
                        dateButton = await page.evaluateHandle(() => {
                            const buttons = Array.from(document.querySelectorAll('button'));
                            for (let i = 0; i < buttons.length; i++) {
                                const btn = buttons[i];
                                const className = btn.className || '';
                                if (className.includes('e1a4g8se4')) {
                                    return btn;
                                }
                            }
                            // 날짜 패턴이 포함된 버튼 (fallback)
                            for (const b of buttons) {
                                if (b.offsetParent === null) continue;
                                const text = (b.textContent || '').trim();
                                if (/\d{4}[년.\-\/]\s*\d{1,2}[월.\-\/]/.test(text)) return b;
                                if (/\d{1,2}월\s*\d{1,2}일/.test(text)) return b;
                            }
                            return null;
                        });
                    }

                    if (dateButton && (dateButton.asElement ? dateButton.asElement() : dateButton)) {
                        const btnElement = dateButton.asElement ? dateButton.asElement() : dateButton;
                        await page.evaluate(el => el.click(), btnElement);
                        await delay(1000);

                        // 년월 조정
                        const targetYearMonth = `${year}년 ${month}월`;
                        const maxAttempts = 24;

                        for (let attempt = 0; attempt < maxAttempts; attempt++) {
                            const currentYearMonth = await page.evaluate(() => {
                                const yearMonthElement = document.querySelector('div.css-7vdbjr.e1a4g8se9');
                                if (yearMonthElement) return yearMonthElement.textContent.trim();
                                // fallback: "YYYY년 M월" 패턴을 가진 요소
                                const allEls = Array.from(document.querySelectorAll('div, span, h1, h2, h3, p'));
                                for (const e of allEls) {
                                    if (e.children.length > 2) continue;
                                    const text = (e.textContent || '').trim();
                                    if (/^\d{4}년\s*\d{1,2}월$/.test(text)) return text;
                                }
                                return null;
                            });

                            if (!currentYearMonth) break;
                            logger.info(`[${studentName}] 달력 현재: "${currentYearMonth}", 목표: "${targetYearMonth}"`);
                            if (currentYearMonth === targetYearMonth) break;

                            // 방향 결정
                            const currentParts = currentYearMonth.match(/(\d{4})년\s*(\d{1,2})월/);
                            const targetParts = targetYearMonth.match(/(\d{4})년\s*(\d{1,2})월/);
                            const goForward = currentParts && targetParts &&
                                (parseInt(currentParts[1]) * 12 + parseInt(currentParts[2])) <
                                (parseInt(targetParts[1]) * 12 + parseInt(targetParts[2]));

                            const navButton = await page.evaluateHandle((forward) => {
                                const buttons = Array.from(document.querySelectorAll('button'));
                                // CSS 클래스 기반
                                for (let i = 0; i < buttons.length; i++) {
                                    const btn = buttons[i];
                                    const className = btn.className || '';
                                    if (forward && className.includes('e1a4g8se11')) return btn;
                                    if (!forward && className.includes('css-7t0053') && className.includes('e1a4g8se10')) return btn;
                                }
                                // SVG 화살표 fallback
                                const arrowBtns = buttons.filter(btn => {
                                    if (btn.offsetParent === null) return false;
                                    const svg = btn.querySelector('svg');
                                    if (!svg) return false;
                                    return (btn.textContent || '').trim().length < 3;
                                });
                                if (arrowBtns.length >= 2) {
                                    return forward ? arrowBtns[arrowBtns.length - 1] : arrowBtns[0];
                                }
                                return null;
                            }, goForward);

                            if (navButton && (navButton.asElement ? navButton.asElement() : navButton)) {
                                const navBtnElement = navButton.asElement ? navButton.asElement() : navButton;
                                await page.evaluate(el => el.click(), navBtnElement);
                                await delay(500);
                            } else {
                                break;
                            }
                        }

                        // 날짜 클릭
                        const dateClicked = await page.evaluate((targetDay) => {
                            const dateLinks = Array.from(document.querySelectorAll('a'));
                            for (let i = 0; i < dateLinks.length; i++) {
                                const link = dateLinks[i];
                                if (link.textContent.trim() === String(targetDay)) {
                                    link.click();
                                    return true;
                                }
                            }
                            // button/td fallback
                            const btns = Array.from(document.querySelectorAll('button, td, div[role="button"]'));
                            for (const el of btns) {
                                if (el.offsetParent === null) continue;
                                if (el.textContent.trim() === String(targetDay)) { el.click(); return true; }
                            }
                            return false;
                        }, day);

                        if (dateClicked) {
                            logger.info(`[${studentName}] 날짜 ${day}일 클릭 완료`);
                            await delay(1000);
                            const confirmBtn = await page.evaluateHandle(() => {
                                const buttons = Array.from(document.querySelectorAll('button'));
                                for (let i = 0; i < buttons.length; i++) {
                                    const btn = buttons[i];
                                    if (btn.offsetParent === null) continue;
                                    const text = btn.textContent || '';
                                    if (text.includes('확인') || text.includes('OK')) {
                                        return btn;
                                    }
                                }
                                return null;
                            });

                            if (confirmBtn && (confirmBtn.asElement ? confirmBtn.asElement() : confirmBtn)) {
                                const confirmElement = confirmBtn.asElement ? confirmBtn.asElement() : confirmBtn;
                                await page.evaluate(el => el.click(), confirmElement);
                                logger.info(`[${studentName}] 날짜 확인 클릭`);
                                await delay(1000);
                            }
                        }
                    } else {
                        logger.warn(`[${studentName}] 날짜 버튼을 찾을 수 없음, 기본 날짜 사용`);
                    }

                    // 원아 선택
                    logger.info(`[${studentName}] 원아 선택 중...`);
                    await delay(1000);

                    // 원아 선택 버튼 찾기 + 디버그 로그
                    const studentSelectInfo = await page.evaluate(() => {
                        // 방법1: data-testid
                        const byTestId = document.querySelector("button[data-testid='auto-report-child-select-button']");
                        if (byTestId) {
                            return {
                                found: true,
                                method: 'data-testid',
                                text: (byTestId.textContent || '').trim().substring(0, 50),
                                tagName: byTestId.tagName,
                                visible: byTestId.offsetParent !== null,
                                rect: JSON.stringify(byTestId.getBoundingClientRect()),
                            };
                        }
                        // 방법2: 텍스트 기반
                        const allEls = Array.from(document.querySelectorAll('button, a, div'));
                        const textBtn = allEls.find(el => {
                            const text = (el.textContent || '').trim();
                            return text === '원아 선택' || text === '원아선택' || text === 'Choose Student';
                        });
                        if (textBtn) {
                            return {
                                found: true,
                                method: 'text-exact',
                                text: (textBtn.textContent || '').trim().substring(0, 50),
                                tagName: textBtn.tagName,
                                visible: textBtn.offsetParent !== null,
                                rect: JSON.stringify(textBtn.getBoundingClientRect()),
                            };
                        }
                        // 방법3: includes 텍스트
                        const includeBtn = allEls.find(el => {
                            const text = (el.textContent || '').trim();
                            return text.includes('원아 선택') || text.includes('원아선택') || text.includes('Choose Student');
                        });
                        if (includeBtn) {
                            return {
                                found: true,
                                method: 'text-includes',
                                text: (includeBtn.textContent || '').trim().substring(0, 50),
                                tagName: includeBtn.tagName,
                                visible: includeBtn.offsetParent !== null,
                                rect: JSON.stringify(includeBtn.getBoundingClientRect()),
                            };
                        }
                        return { found: false };
                    });
                    logger.info(`[${studentName}] 원아 선택 버튼 정보: ${JSON.stringify(studentSelectInfo)}`);

                    if (!studentSelectInfo.found) {
                        const fullText = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || '');
                        logger.error(`[${studentName}] 원아 선택 버튼 없음! 페이지 텍스트: ${fullText}`);
                        throw new Error(`원아 선택 버튼을 찾을 수 없습니다.`);
                    }

                    // JavaScript click으로 원아 선택 버튼 클릭 (React SPA 호환)
                    const clickResult = await page.evaluate(() => {
                        // data-testid 우선
                        let btn = document.querySelector("button[data-testid='auto-report-child-select-button']");
                        if (!btn) {
                            const allBtns = Array.from(document.querySelectorAll('button'));
                            btn = allBtns.find(b => {
                                const t = (b.textContent || '').trim();
                                return t === '원아 선택' || t === '원아선택' || t === 'Choose Student';
                            });
                        }
                        if (btn) {
                            btn.click();
                            return 'clicked';
                        }
                        return 'not-found';
                    });
                    logger.info(`[${studentName}] 원아 선택 JS click 결과: ${clickResult}`);
                    await delay(2000);

                    // 클릭 후 모달이 열렸는지 확인
                    const afterClickBtns = await page.evaluate(() => {
                        return Array.from(document.querySelectorAll('button'))
                            .filter(btn => btn.offsetParent !== null)
                            .map(btn => (btn.textContent || '').trim().substring(0, 40));
                    });
                    logger.info(`[${studentName}] 원아 선택 클릭 후 버튼들: ${JSON.stringify(afterClickBtns.slice(0, 20))}`);

                    // 모달이 안 열렸으면 Puppeteer native click 재시도
                    const hasStudentList = afterClickBtns.some(t => t.includes('선택완료') || t.includes('Complete'));
                    if (!hasStudentList) {
                        logger.info(`[${studentName}] 모달 미열림, Puppeteer click 재시도...`);
                        try {
                            await page.click("button[data-testid='auto-report-child-select-button']");
                        } catch (e) {
                            // data-testid 없으면 텍스트 기반으로 찾아서 클릭
                            const retryBtn = await page.evaluateHandle(() => {
                                const allBtns = Array.from(document.querySelectorAll('button'));
                                return allBtns.find(b => {
                                    const t = (b.textContent || '').trim();
                                    return t === '원아 선택' || t === '원아선택';
                                });
                            });
                            if (retryBtn && retryBtn.asElement()) {
                                await retryBtn.asElement().click();
                            }
                        }
                        await delay(2000);

                        // 두 번째 시도 후 확인
                        const afterRetryBtns = await page.evaluate(() => {
                            return Array.from(document.querySelectorAll('button'))
                                .filter(btn => btn.offsetParent !== null)
                                .map(btn => (btn.textContent || '').trim().substring(0, 40));
                        });
                        logger.info(`[${studentName}] 재시도 후 버튼들: ${JSON.stringify(afterRetryBtns.slice(0, 20))}`);

                        // 3차: dispatchEvent로 시도
                        const hasStudentListRetry = afterRetryBtns.some(t => t.includes('선택완료') || t.includes('Complete'));
                        if (!hasStudentListRetry) {
                            logger.info(`[${studentName}] 모달 여전히 미열림, dispatchEvent 시도...`);
                            await page.evaluate(() => {
                                let btn = document.querySelector("button[data-testid='auto-report-child-select-button']");
                                if (!btn) {
                                    const allBtns = Array.from(document.querySelectorAll('button'));
                                    btn = allBtns.find(b => (b.textContent || '').trim() === '원아 선택');
                                }
                                if (btn) {
                                    // mousedown → mouseup → click 시퀀스 (React 이벤트 호환)
                                    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                                    btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                                    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                }
                            });
                            await delay(3000);

                            const afterDispatchBtns = await page.evaluate(() => {
                                return Array.from(document.querySelectorAll('button'))
                                    .filter(btn => btn.offsetParent !== null)
                                    .map(btn => (btn.textContent || '').trim().substring(0, 40));
                            });
                            logger.info(`[${studentName}] dispatchEvent 후 버튼들: ${JSON.stringify(afterDispatchBtns.slice(0, 25))}`);
                        }
                    }

                    // "[ALL] 회원가입 후 반배정 필요" 아코디언 열기
                        const classAccordion = await page.evaluateHandle(() => {
                            const target = "[ALL] 회원가입 후 반배정 필요";
                            // data-testid 기반
                            const accordionBtns = Array.from(document.querySelectorAll("button[data-testid^='report-class-accordion']"));
                            for (const btn of accordionBtns) {
                                const text = (btn.textContent || btn.innerText || '').trim();
                                if (text.includes(target)) return btn;
                            }
                            // 모든 보이는 버튼에서 검색
                            const allBtns = Array.from(document.querySelectorAll('button'))
                                .filter(btn => btn.offsetParent !== null);
                            for (const btn of allBtns) {
                                const text = (btn.textContent || btn.innerText || '').trim();
                                if (text.includes(target)) return btn;
                            }
                            // "ALL" 또는 "반배정" 키워드로 검색 (대체)
                            for (const btn of allBtns) {
                                const text = (btn.textContent || btn.innerText || '').trim();
                                if (text.includes('[ALL]') || text.includes('반배정')) return btn;
                            }
                            return null;
                        });

                        if (classAccordion && (classAccordion.asElement ? classAccordion.asElement() : classAccordion)) {
                            const accElement = classAccordion.asElement ? classAccordion.asElement() : classAccordion;
                            const accText = await page.evaluate(el => (el.textContent || '').trim().substring(0, 50), accElement);
                            logger.info(`[${studentName}] 아코디언 클릭: "${accText}"`);
                            await page.evaluate(el => el.click(), accElement);
                            await delay(1500);
                        } else {
                            logger.warn(`[${studentName}] "[ALL]" 아코디언을 찾을 수 없음, 전체에서 학생 검색`);
                        }

                        // 학생 선택 (정확한 이름 매칭)
                        const studentItem = await page.evaluateHandle((sName) => {
                            const normalize = (text) => (text || '').trim();

                            // 1. Accordion Buttons (Priority)
                            const studentButtons = Array.from(document.querySelectorAll("button[data-testid^='report-class-accordion']"));
                            for (let i = 0; i < studentButtons.length; i++) {
                                const btn = studentButtons[i];
                                const btnText = normalize(btn.textContent || btn.innerText);
                                if (btnText === sName) return btn;
                            }

                            // 2. All visible buttons fallback
                            const allButtons = Array.from(document.querySelectorAll('button'));
                            for (let i = 0; i < allButtons.length; i++) {
                                const btn = allButtons[i];
                                if (btn.offsetParent === null) continue;
                                const btnText = normalize(btn.textContent || btn.innerText);
                                if (btnText === sName) return btn;
                            }
                            return null;
                        }, studentName);

                        if (studentItem && (studentItem.asElement ? studentItem.asElement() : studentItem)) {
                            const studentElement = studentItem.asElement ? studentItem.asElement() : studentItem;
                            await page.evaluate(el => el.click(), studentElement);
                            logger.info(`[${studentName}] 학생 버튼 클릭`);
                            await delay(1000);

                            const completeBtn = await page.evaluateHandle(() => {
                                const buttons = Array.from(document.querySelectorAll('button'));
                                for (let i = 0; i < buttons.length; i++) {
                                    const btn = buttons[i];
                                    if (btn.offsetParent === null) continue;
                                    const text = btn.textContent || btn.innerText || '';
                                    if (text.includes('선택완료') || text.includes('Complete selection')) {
                                        return btn;
                                    }
                                }
                                return null;
                            });

                            if (completeBtn && (completeBtn.asElement ? completeBtn.asElement() : completeBtn)) {
                                const completeElement = completeBtn.asElement ? completeBtn.asElement() : completeBtn;
                                await page.evaluate(el => el.click(), completeElement);
                                logger.info(`[${studentName}] 선택완료 버튼 클릭`);
                                await delay(1000);
                            }
                        } else {
                            // 디버그: 보이는 학생 목록 로그
                            const visibleStudents = await page.evaluate(() => {
                                return Array.from(document.querySelectorAll('button'))
                                    .filter(btn => btn.offsetParent !== null)
                                    .map(btn => (btn.textContent || '').trim())
                                    .filter(text => text.length >= 2 && text.length <= 10);
                            });
                            logger.error(`[${studentName}] 학생을 찾을 수 없음. 보이는 이름들: ${JSON.stringify(visibleStudents.slice(0, 30))}`);
                            throw new Error(`학생 '${studentName}'을 찾을 수 없습니다.`);
                        }

                    // 이미지 업로드
                    logger.info(`[${studentName}] 이미지 업로드 중...`);
                    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
                    const imageBuffer = Buffer.from(base64Data, 'base64');
                    const tempFilePath = path.join(os.tmpdir(), `report_${studentName}_${Date.now()}.jpg`);
                    fs.writeFileSync(tempFilePath, imageBuffer);

                    try {
                        let fileInput = null;
                        try {
                            await page.waitForSelector("input[data-testid='media-attachment-add-input']", { timeout: 5000 });
                            fileInput = await page.$("input[data-testid='media-attachment-add-input']");
                        } catch (e) {
                            try {
                                await page.waitForSelector("input[type='file']", { timeout: 5000 });
                                fileInput = await page.$("input[type='file']");
                            } catch (e2) {
                                const fileInputs = await page.$$("input[type='file']");
                                if (fileInputs && fileInputs.length > 0) {
                                    fileInput = fileInputs[0];
                                }
                            }
                        }

                        if (!fileInput) {
                            throw new Error('파일 업로드 input을 찾을 수 없습니다.');
                        }

                        await fileInput.uploadFile(tempFilePath);
                        logger.info(`[${studentName}] 파일 업로드 완료`);
                        await delay(3000);
                    } finally {
                        if (fs.existsSync(tempFilePath)) {
                            fs.unlinkSync(tempFilePath);
                        }
                    }

                    // 임시저장
                    logger.info(`[${studentName}] 임시저장 중...`);
                    const saveBtn = await page.evaluateHandle(() => {
                        const buttons = Array.from(document.querySelectorAll('button'))
                            .filter(btn => btn.offsetParent !== null);

                        // 1순위: "지금전송" / "보내기"
                        let found = buttons.find(btn => {
                            const text = (btn.textContent || '').trim();
                            return text === '지금전송' || text === '보내기' || text === 'Send now' || text === 'Send';
                        });
                        if (found) return found;

                        // 2순위: "임시저장"
                        found = buttons.find(btn => {
                            const text = (btn.textContent || '').trim();
                            return text.includes('임시저장') || text === 'Draft' || text === 'Save draft';
                        });
                        if (found) return found;

                        // 3순위: "저장" / "등록"
                        found = buttons.find(btn => {
                            const text = (btn.textContent || '').trim();
                            return text.includes('저장') || text.includes('등록') || text === 'Save' || text === 'Submit';
                        });
                        if (found) return found;

                        return null;
                    });

                    if (saveBtn && (saveBtn.asElement ? saveBtn.asElement() : saveBtn)) {
                        const saveBtnElement = saveBtn.asElement ? saveBtn.asElement() : saveBtn;
                        const saveBtnText = await page.evaluate(el => (el.textContent || '').trim(), saveBtnElement);
                        logger.info(`[${studentName}] "${saveBtnText}" 버튼 클릭`);
                        await page.evaluate(el => el.click(), saveBtnElement);
                        await delay(3000);

                        // 저장 후 확인 다이얼로그 처리 (JS click)
                        for (let confirmAttempt = 0; confirmAttempt < 3; confirmAttempt++) {
                            const confirmClicked = await page.evaluate(() => {
                                const buttons = Array.from(document.querySelectorAll('button')).filter(btn => btn.offsetParent !== null);
                                const btn = buttons.find(b => {
                                    const text = (b.textContent || '').trim();
                                    return text === '확인' || text === '네' || text === 'OK' || text === 'Yes'
                                        || text === 'Confirm' || text === '보내기' || text === 'Send';
                                });
                                if (btn) {
                                    btn.click();
                                    return (btn.textContent || '').trim();
                                }
                                return null;
                            });
                            if (confirmClicked) {
                                logger.info(`[${studentName}] 확인 다이얼로그 ${confirmAttempt + 1} "${confirmClicked}" 클릭`);
                                await delay(2000);
                            } else {
                                break;
                            }
                        }
                    } else {
                        logger.warn(`[${studentName}] 저장 버튼을 찾을 수 없음`);
                    }

                    results.push({
                        success: true,
                        studentName: studentName,
                        reportDate: reportDate,
                        status: 'success'
                    });

                    logger.info(`보고서 업로드 완료: ${studentName}`);

                } catch (innerError) {
                    logger.error(`보고서 ${studentName} 처리 중 오류:`, innerError);
                    results.push({
                        success: false,
                        studentName: studentName || '알 수 없음',
                        reportDate: reportDate || '알 수 없음',
                        status: 'error',
                        message: innerError.message
                    });
                }
            }

            // 브라우저 종료
            if (browser) {
                await browser.close();
            }

            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;
            logger.info(`배포 완료: 성공 ${successCount}, 실패 ${failCount}`);

            return { success: true, message: `성공 ${successCount}개, 실패 ${failCount}개`, results };
        } catch (error) {
            logger.error('전체 로직 오류:', error);

            if (browser) {
                try { await browser.close(); } catch (e) { /* ignore */ }
            }

            throw new functions.https.HttpsError("internal", error.message || "알 수 없는 오류");
        }
    });

