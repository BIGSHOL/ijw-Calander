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
            const cutoffDate = cutoffDateObj.toISOString().split("T")[0]; // YYYY-MM-DD

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
            const now = new Date();
            const kstOffset = 9 * 60 * 60 * 1000; // UTC+9
            const kstDate = new Date(now.getTime() + kstOffset);
            const today = kstDate.toISOString().split("T")[0];

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

    const today = new Date().toISOString().split("T")[0];

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
    let query = db.collection("students");
    if (args.status) query = query.where("status", "==", args.status);
    const snap = await query.get();
    let students = snap.docs.map(d => ({ id: d.id, name: d.data().name, grade: d.data().grade, status: d.data().status, school: d.data().school, startDate: d.data().startDate, withdrawalDate: d.data().withdrawalDate }));
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

    // 활성 수강의 수업 스케줄(요일/시간) 조회
    if (active.length > 0) {
        const classNames = active.map(e => e.className).filter(Boolean);
        if (classNames.length > 0) {
            const classSnap = await db.collection("classes").where("isActive", "==", true).get();
            const classMap = {};
            classSnap.docs.forEach(d => {
                const data = d.data();
                classMap[data.className] = data;
            });
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
    let query = db.collection("classes").where("isActive", "==", true);
    if (args.subject) query = query.where("subject", "==", args.subject);
    const snap = await query.get();
    let classes = snap.docs.map(d => {
        const data = d.data();
        let days = [];
        if (Array.isArray(data.schedule)) {
            days = [...new Set(data.schedule.map(s => s.day).filter(Boolean))];
        } else if (Array.isArray(data.legacySchedule)) {
            days = [...new Set(data.legacySchedule.map(s => s.split(' ')[0]).filter(Boolean))];
        }
        const studentCount = Array.isArray(data.students) ? data.students.length : 0;
        const capacity = data.capacity || data.maxStudents || null;
        return { id: d.id, className: data.className, subject: data.subject, teacher: data.mainTeacher || data.teacher, room: data.room, days, studentCount, capacity };
    });
    if (args.className) { const s = args.className.toLowerCase(); classes = classes.filter(c => c.className?.toLowerCase().includes(s)); }
    if (args.day) classes = classes.filter(c => c.days.includes(args.day));
    const daySummary = {};
    ['월','화','수','목','금','토','일'].forEach(day => { daySummary[day] = 0; });
    classes.forEach(c => c.days.forEach(day => { if (daySummary[day] !== undefined) daySummary[day]++; }));
    return { totalCount: classes.length, daySummary, classes };
}

async function toolGetStaffInfo(args) {
    const snap = await db.collection("staff").orderBy("name").get();
    let staff = snap.docs.map(d => ({ id: d.id, name: d.data().name, englishName: d.data().englishName, role: d.data().role, subjects: d.data().subjects, jobTitle: d.data().jobTitle, isNative: d.data().isNative }));
    if (args.name) { const s = args.name.toLowerCase(); staff = staff.filter(st => st.name?.toLowerCase().includes(s) || st.englishName?.toLowerCase().includes(s)); }
    if (args.subject) staff = staff.filter(st => Array.isArray(st.subjects) && st.subjects.includes(args.subject));
    // 담당 반 조회 (비용 최소화: 이름 검색 시에만)
    if (args.name && staff.length > 0 && staff.length <= 3) {
        const classSnap = await db.collection("classes").where("isActive", "==", true).get();
        const staffNames = staff.map(s => s.name);
        const classMap = {};
        classSnap.docs.forEach(d => {
            const data = d.data();
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
    if (args.upcoming) { const today = new Date().toISOString().split("T")[0]; exams = exams.filter(e => e.date >= today); }
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
    const today = new Date().toISOString().split("T")[0];
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

exports.chatWithAI = functions.region("asia-northeast3").https.onCall(async (data, context) => {
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
        const today = new Date().toISOString().split("T")[0];
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

시스템 사용법 안내 (도구 호출 없이 아래 지식 기반으로 직접 답변):
사용자가 탭/기능의 사용법을 물어보면 (예: "출석부 어떻게 써?", "시간표 기능 알려줘", "학생 등록하는 법", "역할이 뭐가 있어?", "강의실 배정 어떻게 해?"), 도구를 호출하지 말고 아래 도움말 지식을 참고하여 직접 안내하세요.

[시스템 도움말 지식]
■ 역할 체계: Master(전체관리), Admin(시스템관리), Manager(운영매니저), 수학팀장/영어팀장(교과총괄), 수학강사/영어강사(교과담당), User(기본사용자-대시보드/일정/출결만)
■ 탭 그룹: 홈(대시보드,공지사항) | 일정(연간일정,간트차트) | 수업(시간표,출석부,출결관리,수업관리,강의실,강의실배정,숙제관리,시험관리,교재관리) | 학생(학생관리,등록상담,학생상담,성적관리,퇴원관리,계약관리,학습리포트) | 소통(학부모소통,알림발송) | 마케팅(마케팅,셔틀관리) | 관리(수강료현황,직원관리,수납관리,자료실,역할관리,급여관리,매출분석)
■ 대시보드: 역할별 자동 전환. Master/Admin은 전체 KPI + 직원별 전환 가능. 팀장은 해당 과목 통계. 강사는 담당 수업/학생 현황
■ 연간일정: 일간/주간/월간/연간 뷰, 부서필터, 해시태그, 버킷리스트, 드래그이동, 이미지내보내기
■ 간트차트: 프로젝트/태스크 관리, 담당자배정, 진행률추적, 시뮬레이션모드, 템플릿, 시나리오비교
■ 시간표: 수학/영어/과학/국어 과목별, 강사별/교실별/수업별 뷰, 수업 추가/수정, 학생 드래그앤드롭 배정, 시뮬레이션모드, 이미지저장
■ 출석부: 월간/세션별 뷰, 출석/결석/지각/조퇴/사유결석 상태, 이름클릭으로 상태변경, 월급계산(강사용)
■ 출결관리: 카드뷰/리스트뷰/통계뷰, 일별 전체 출결 현황, 달력 네비게이션
■ 수업관리: 과목별/담임별/요일별 필터, 수업 생성(수업명/과목/강사/시간/교실), 학생배정
■ 강의실: 요일별 교실 사용현황, 시간대별 점유율 확인
■ 강의실배정: AI자동배정(프리셋), 수동 드래그앤드롭, 충돌감지, 병합제안, 미리보기/원본 비교
■ 학생관리: 2단레이아웃(목록+상세), 검색/필터/정렬, 기본정보/수강이력/성적/출결/메모, Excel마이그레이션, 중복병합
■ 등록상담: 대시보드/테이블/연도별 뷰, 상담등록, 레벨테스트(수학4영역/영어AI·NELT·EiE), 원생전환, QR접수
■ 학생상담: 목록/대시보드, 기간/유형/카테고리/후속조치 필터, 상담등록
■ 성적관리: 시험/레벨테스트 토글, 시험등록/성적입력/자동통계, 레벨테스트 날짜별그룹핑
■ 퇴원관리: 통계/목록 뷰, 퇴원등록(사유:졸업/이사/타학원/경제적/스케줄/불만족/기타), 활성수업감지, 재원복구
■ 수강료현황: 대시보드/보고서 뷰, 사업장별통계, AI보고서생성, 인쇄용뷰
■ 직원관리: 직원목록/근무일정, 권한관리, 승인관리, 휴가관리
■ 수납관리: 상태필터(미납/완납), 월별조회, Excel가져오기(19개필드)/내보내기, 교재수납감지
■ 자료실: 3단폴더구조, 검색, 즐겨찾기, 고정(Pin), 다중선택삭제, 카테고리순서변경
■ 역할관리: Master전용, 14개 카테고리별 세부권한 ON/OFF, 탭접근관리, 연동권한자동처리
■ 숙제관리: 과목별필터, 마감일추적, 과제목록관리
■ 시험관리: 시험목록/캘린더/분석뷰, 과목별필터, 응시인원/평균점수
■ 교재관리: 교재목록(카드)/배부이력/청구이력, 재고관리, 재고부족알림, Excel가져오기
■ 계약관리: 상태(초안→서명→활성→만료→해지), 수강료/할인관리
■ 학습리포트: 학생별/수업별/월별 종합리포트
■ 셔틀관리: 노선관리(정류장/출발시간/운전기사), 학생배정
■ 마케팅: 유입경로분석, 체험수업관리, 프로모션
■ 알림발송: SMS/카카오알림톡, 템플릿관리(변수지원), 발송이력

답변 시 해당 탭의 핵심 기능만 2~4줄로 간결하게 안내하세요. 사용자가 더 자세히 물어보면 추가 설명하세요.
탭에 관한 질문이 아닌 일반 데이터 조회 질문에는 반드시 도구를 호출하세요.`;

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

