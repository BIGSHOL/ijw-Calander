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

        // Check if there are actual changes to student list
        const beforeKeys = new Set(beforeStudents.map(s => getStudentKey(s)));
        const afterKeys = new Set(afterStudents.map(s => getStudentKey(s)));

        const addedStudents = afterStudents.filter(s => !beforeKeys.has(getStudentKey(s)));
        const removedStudents = beforeStudents.filter(s => !afterKeys.has(getStudentKey(s)));

        if (addedStudents.length === 0 && removedStudents.length === 0) {
            logger.info("[syncStudents] No student changes detected.");
            return null;
        }

        const classData = afterData || beforeData;
        const className = classData?.className || classId;
        const subject = inferSubject(classData, classId);

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

        logger.info(`[syncStudents] Class: ${className}, Subject: ${subject}, Teacher: ${teacher}, Days: ${days.join(",")}`);

        const batch = db.batch();
        const now = new Date().toISOString();

        // Process ADDED
        for (const student of addedStudents) {
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
                const enrollments = existingData.enrollments || [];
                const exists = enrollments.some(e => e.classId === classId && e.teacherId === teacher);

                if (!exists) {
                    enrollments.push(enrollment);
                    // Also update group if needed (optional logic, keeping simple)
                    // existingData.groups could be Set, needing conversion
                    batch.update(studentRef, { enrollments, updatedAt: now });
                }
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

        // Process REMOVED
        for (const student of removedStudents) {
            const studentKey = getStudentKey(student);
            const studentRef = db.collection("students").doc(studentKey);
            const studentDoc = await studentRef.get();

            if (studentDoc.exists) {
                const existingData = studentDoc.data();
                let enrollments = existingData.enrollments || [];
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
