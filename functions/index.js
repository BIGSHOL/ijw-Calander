/**
 * Cloud Function: Timetable -> Attendance Student Sync (Gen 1)
 */

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const CryptoJS = require("crypto-js");
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

