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
const db = getFirestore("restore20260319");

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

// 학생 컨텍스트를 프롬프트 텍스트로 포맷팅
function formatStudentContext(ctx) {
    if (!ctx || typeof ctx !== "object") return "";
    const lines = [];
    if (ctx.schoolName) lines.push(`- 학교: ${ctx.schoolName}`);
    if (ctx.grade) lines.push(`- 학년: ${ctx.grade}`);
    if (ctx.parentName) lines.push(`- 보호자: ${ctx.parentName}${ctx.parentRelation ? ` (${ctx.parentRelation})` : ""}`);
    if (ctx.parentPhone) lines.push(`- 보호자 연락처: ${ctx.parentPhone}`);
    if (ctx.address) lines.push(`- 주소: ${ctx.address}`);
    if (ctx.birthDate) lines.push(`- 생년월일: ${ctx.birthDate}`);
    if (ctx.gender) lines.push(`- 성별: ${ctx.gender}`);
    if (ctx.siblings) lines.push(`- 형제자매: ${ctx.siblings}`);
    if (ctx.enrolledClasses) lines.push(`- 현재 수강반: ${Array.isArray(ctx.enrolledClasses) ? ctx.enrolledClasses.join(", ") : ctx.enrolledClasses}`);
    if (ctx.enrollmentDate) lines.push(`- 등록일: ${ctx.enrollmentDate}`);
    if (ctx.consultationHistory) lines.push(`- 최근 상담 이력: ${ctx.consultationHistory}`);
    if (ctx.grades) lines.push(`- 최근 성적: ${ctx.grades}`);
    if (ctx.attendanceRate) lines.push(`- 출석률: ${ctx.attendanceRate}`);
    if (ctx.notes) lines.push(`- 비고: ${ctx.notes}`);
    if (lines.length === 0) return "";
    return `\n--- 학생 기본 정보 (사전 입력) ---\n${lines.join("\n")}\n--- 학생 정보 끝 ---\n\n위 학생 정보를 참고하여 분석 시 더 정확한 맥락을 파악해주세요. 특히 ASR에서 학생/학부모 이름이 잘못 인식된 경우 위 정보로 교정해주세요.\n`;
}

// Claude API 호출 재시도 래퍼 (529 Overloaded 등 일시적 오류 대응)
async function fetchClaudeWithRetry(url, options, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const response = await fetch(url, options);
        if (response.ok || (response.status < 500 && response.status !== 429)) {
            return response;
        }
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === maxRetries - 1) {
            return response;
        }
        const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 15000);
        logger.warn(`[fetchClaudeWithRetry] ${response.status} 응답, ${Math.round(delay)}ms 후 재시도 (${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
    }
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
                if (typeof s !== "string") return;
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
                if (typeof s !== "string") return;
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

        // enrollmentId: classId 사용 (Firestore 문서 ID)
        // 기존 문서 호환: classId로 못 찾으면 쿼리로 fallback
        const findEnrollRef = async (studentRef, targetClassId) => {
            // 1) classId로 직접 접근
            const directRef = studentRef.collection("enrollments").doc(targetClassId);
            const directSnap = await directRef.get();
            if (directSnap.exists) return { ref: directRef, exists: true };
            // 2) 기존 형식 fallback (subject_className)
            const oldRef = studentRef.collection("enrollments").doc(`${subject}_${className}`);
            const oldSnap = await oldRef.get();
            if (oldSnap.exists) return { ref: oldRef, exists: true };
            // 3) 쿼리 fallback
            const qSnap = await studentRef.collection("enrollments")
                .where("classId", "==", targetClassId).limit(1).get();
            if (!qSnap.empty) return { ref: qSnap.docs[0].ref, exists: true };
            // 4) 새로 생성할 ref (classId as doc ID)
            return { ref: directRef, exists: false };
        };

        // Process UPDATES (Add/Update Enrollment) → 서브컬렉션에 저장
        for (const student of studentsToUpdate) {
            const studentKey = getStudentKey(student);
            const studentRef = db.collection("students").doc(studentKey);
            const studentDoc = await studentRef.get();

            // Build enrollment data
            const enrollmentData = {
                subject,
                classId,
                className,
                staffId: teacher,
                days,
                startDate: student.enrollmentDate || now.split("T")[0],
                enrollmentDate: student.enrollmentDate || now.split("T")[0],
                createdAt: now,
                updatedAt: now,
            };

            if (studentDoc.exists) {
                const { ref: enrollRef, exists: enrollExists } = await findEnrollRef(studentRef, classId);
                if (enrollExists) {
                    // 기존 문서 업데이트: endDate 명시적으로 제거 (재등록 시)
                    batch.update(enrollRef, {
                        ...enrollmentData,
                        endDate: student.withdrawalDate || admin.firestore.FieldValue.delete(),
                    });
                } else {
                    // 새 문서 생성 (doc ID = classId)
                    batch.set(enrollRef, { ...enrollmentData, endDate: student.withdrawalDate || null });
                }
                batch.update(studentRef, { updatedAt: now });
            } else {
                // 학생 문서가 없으면 학생 먼저 생성
                const newStudent = {
                    name: student.name || "",
                    englishName: student.englishName || null,
                    school: student.school || "",
                    grade: student.grade || "",
                    status: "active",
                    startDate: now.split("T")[0],
                    endDate: null,
                    group: className,
                    createdAt: now,
                    updatedAt: now,
                };
                batch.set(studentRef, newStudent);
                const enrollRef = studentRef.collection("enrollments").doc(classId);
                batch.set(enrollRef, { ...enrollmentData, endDate: student.withdrawalDate || null });
            }
        }

        // Process REMOVALS → 서브컬렉션에서 endDate 설정
        for (const student of removedStudents) {
            const studentKey = getStudentKey(student);
            const studentRef = db.collection("students").doc(studentKey);
            const studentDoc = await studentRef.get();

            if (studentDoc.exists) {
                const { ref: enrollRef, exists: enrollExists } = await findEnrollRef(studentRef, classId);
                const enrollDoc = enrollExists ? { exists: true } : { exists: false };

                if (enrollDoc.exists) {
                    batch.update(enrollRef, {
                        endDate: now.split("T")[0],
                        updatedAt: now,
                    });
                }

                // 남은 활성 enrollment가 있는지 확인
                const allEnrollments = await studentRef.collection("enrollments").get();
                const activeCount = allEnrollments.docs.filter(d => {
                    const data = d.data();
                    return !data.endDate && d.id !== enrollmentDocId;
                }).length;

                if (activeCount === 0) {
                    batch.update(studentRef, {
                        status: "withdrawn",
                        endDate: now.split("T")[0],
                        updatedAt: now,
                    });
                } else {
                    batch.update(studentRef, { updatedAt: now });
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
 * 일괄 정리: enrollment 데이터 정합성 검증 및 수정
 *
 * 수행 내용:
 * 1. 배열 필드에만 있고 서브컬렉션에 없는 enrollment → 서브컬렉션에 생성
 *    (같은 classId를 가진 서브컬렉션 문서가 이미 있으면 건너뜀 = 중복 방지)
 * 2. 서브컬렉션에서 같은 classId를 가진 중복 문서 정리
 *    (endDate 없는 활성 enrollment 우선, 나머지는 유지하되 중복 표시만)
 * 3. class의 studentList와 비교하여 endDate 불일치 수정
 *    (수업에 있는데 endDate 설정됨 → endDate 제거)
 *    (수업에 없는데 endDate 없음 → endDate 설정)
 *
 * mode: "dryrun" (기본) = 변경 없이 통계만 반환
 * mode: "execute" = 실제 수정 수행
 */
exports.migrateEnrollmentsToSubcollection = functions
    .region("asia-northeast3")
    .runWith({ timeoutSeconds: 540, memory: "1GB" })
    .https.onCall(async (data, context) => {
        const mode = (data && data.mode) || "dryrun";
        const isDryRun = mode !== "execute";

        const stats = {
            mode,
            totalStudents: 0,
            studentsWithArrayField: 0,
            enrollmentsMigrated: 0,
            duplicatesFound: 0,
            duplicatesDeleted: 0,
            docIdRenamed: 0,
            endDateCleared: 0,
            endDateSet: 0,
            metadataSynced: 0,
            skippedNoClassId: 0,
            details: [],
            errors: [],
        };

        try {
            // 1. 모든 classes 조회 → classId → Set<studentKey>, classId → metadata
            const classesSnap = await db.collection("classes").get();
            const classStudentMap = new Map();
            const classMetaMap = new Map();

            classesSnap.docs.forEach(doc => {
                const d = doc.data();
                const studentKeys = new Set((d.studentList || []).map(s => getStudentKey(s)));
                classStudentMap.set(doc.id, studentKeys);

                const subject = inferSubject(d, doc.id);
                let teacher = d.teacher || "";
                if (!teacher && subject === "math") teacher = extractTeacherFromClassId(doc.id);
                teacher = normalizeTeacherName(teacher);

                const days = [];
                if (d.schedule && Array.isArray(d.schedule)) {
                    d.schedule.forEach(s => {
                        if (typeof s !== "string") return;
                        const day = s.split(" ")[0];
                        if (day && !days.includes(day)) days.push(day);
                    });
                }
                days.sort();

                classMetaMap.set(doc.id, {
                    className: d.className || doc.id,
                    subject,
                    staffId: teacher,
                    days,
                    schedule: d.schedule || [],
                });
            });

            // 역방향 맵: subject_className → classId (doc ID 변환용)
            const classNameToIdMap = new Map();
            classMetaMap.forEach((meta, classId) => {
                const key = `${meta.subject}_${meta.className}`;
                classNameToIdMap.set(key, classId);
            });

            // 2. 모든 학생 순회
            const studentsSnap = await db.collection("students").get();
            stats.totalStudents = studentsSnap.size;

            for (const studentDoc of studentsSnap.docs) {
                const studentData = studentDoc.data();
                const studentKey = studentDoc.id;
                const arrayEnrollments = studentData.enrollments || [];

                if (arrayEnrollments.length > 0) {
                    stats.studentsWithArrayField++;
                }

                // 기존 서브컬렉션 조회
                const subSnap = await studentDoc.ref.collection("enrollments").get();

                // classId → [docId, ...] 매핑 (중복 감지용)
                const classIdToSubDocs = new Map();
                subSnap.docs.forEach(d => {
                    const cid = d.data().classId;
                    if (cid) {
                        if (!classIdToSubDocs.has(cid)) classIdToSubDocs.set(cid, []);
                        classIdToSubDocs.get(cid).push({ docId: d.id, data: d.data(), ref: d.ref });
                    }
                });

                // 2a. 배열 필드 → 서브컬렉션 마이그레이션 (classId 기준 중복 방지)
                for (const enrollment of arrayEnrollments) {
                    const classId = enrollment.classId;
                    if (!classId) { stats.skippedNoClassId++; continue; }

                    // 같은 classId를 가진 서브컬렉션 문서가 이미 있는지 확인
                    const existingDocs = classIdToSubDocs.get(classId) || [];
                    if (existingDocs.length > 0) continue; // 이미 있으면 건너뜀

                    const docId = classId; // doc ID = classId로 통일
                    stats.enrollmentsMigrated++;

                    if (!isDryRun) {
                        try {
                            const now = new Date().toISOString();
                            await studentDoc.ref.collection("enrollments").doc(docId).set({
                                subject: enrollment.subject || "math",
                                classId: classId,
                                className: enrollment.className || "",
                                staffId: enrollment.staffId || "",
                                days: enrollment.days || [],
                                startDate: enrollment.startDate || null,
                                enrollmentDate: enrollment.startDate || enrollment.enrollmentDate || null,
                                endDate: enrollment.endDate || null,
                                createdAt: now,
                                updatedAt: now,
                                _migratedFromArray: true,
                            });
                        } catch (e) {
                            stats.errors.push(`Migrate: ${studentKey}/${docId}: ${e.message}`);
                        }
                    } else {
                        stats.details.push(`[migrate] ${studentKey}: ${enrollment.className} (${classId})`);
                    }
                }

                // 서브컬렉션 다시 조회 (마이그레이션 반영)
                const finalSubSnap = isDryRun ? subSnap : await studentDoc.ref.collection("enrollments").get();

                // 2b. 중복 감지: 같은 classId를 가진 서브컬렉션 문서가 여러 개인 경우
                const finalClassIdMap = new Map();
                finalSubSnap.docs.forEach(d => {
                    const cid = d.data().classId;
                    if (cid) {
                        if (!finalClassIdMap.has(cid)) finalClassIdMap.set(cid, []);
                        finalClassIdMap.get(cid).push({ docId: d.id, data: d.data(), ref: d.ref });
                    }
                });

                for (const [classId, docs] of finalClassIdMap) {
                    if (docs.length > 1) {
                        stats.duplicatesFound += docs.length - 1;

                        // 활성(endDate 없음) enrollment 우선, 같으면 최신 createdAt 우선
                        const sorted = [...docs].sort((a, b) => {
                            const aActive = !a.data.endDate ? 1 : 0;
                            const bActive = !b.data.endDate ? 1 : 0;
                            if (aActive !== bActive) return bActive - aActive;
                            const aTime = a.data.createdAt || "";
                            const bTime = b.data.createdAt || "";
                            return bTime > aTime ? 1 : bTime < aTime ? -1 : 0;
                        });
                        const keep = sorted[0];
                        const toDelete = sorted.slice(1);

                        for (const dup of toDelete) {
                            stats.duplicatesDeleted++;
                            if (!isDryRun) {
                                try {
                                    await dup.ref.delete();
                                } catch (e) {
                                    stats.errors.push(`DelDup: ${studentKey}/${dup.docId}: ${e.message}`);
                                }
                            } else {
                                stats.details.push(`[duplicate] ${studentKey}: classId=${classId}, keep=${keep.docId}, delete=${dup.docId}`);
                            }
                        }
                    }
                }

                // 중복 삭제 후 서브컬렉션 다시 조회 (삭제된 문서 제외)
                const cleanSubSnap = (!isDryRun && stats.duplicatesDeleted > 0)
                    ? await studentDoc.ref.collection("enrollments").get()
                    : finalSubSnap;

                // 2c. class studentList와 비교하여 endDate 정합성 확인
                const todayStr = new Date().toISOString().split("T")[0];
                for (const enrollDoc of cleanSubSnap.docs) {
                    const enrollData = enrollDoc.data();
                    const classId = enrollData.classId;
                    if (!classId) continue;

                    const currentStudents = classStudentMap.get(classId);
                    if (currentStudents === undefined) continue; // 수업이 삭제됨 → 건드리지 않음

                    const isInClass = currentStudents.has(studentKey);

                    if (isInClass && enrollData.endDate) {
                        // 수업에 있는데 endDate 설정됨 → endDate 제거
                        stats.endDateCleared++;
                        if (!isDryRun) {
                            try {
                                await enrollDoc.ref.update({ endDate: null, updatedAt: new Date().toISOString() });
                            } catch (e) {
                                stats.errors.push(`ClearEnd: ${studentKey}/${enrollDoc.id}: ${e.message}`);
                            }
                        } else {
                            stats.details.push(`[clearEnd] ${studentKey}: ${enrollData.className} (endDate ${enrollData.endDate} → null)`);
                        }
                    } else if (!isInClass && !enrollData.endDate) {
                        // 수업에 없는데 endDate 없음 → 종료 처리 (오늘 날짜)
                        stats.endDateSet++;
                        if (!isDryRun) {
                            try {
                                await enrollDoc.ref.update({ endDate: todayStr, updatedAt: new Date().toISOString() });
                            } catch (e) {
                                stats.errors.push(`SetEnd: ${studentKey}/${enrollDoc.id}: ${e.message}`);
                            }
                        } else {
                            stats.details.push(`[setEnd] ${studentKey}: ${enrollData.className} (endDate → ${todayStr})`);
                        }
                    }

                    // 2d. 활성 enrollment의 메타데이터 동기화 (schedule, days, staffId)
                    // endDate가 없는 (활성) enrollment만 대상, class가 존재하는 경우만
                    if (!enrollData.endDate && classMetaMap.has(classId)) {
                        const meta = classMetaMap.get(classId);
                        const updates = {};

                        // days 비교
                        const currentDays = (enrollData.days || []).slice().sort();
                        if (JSON.stringify(currentDays) !== JSON.stringify(meta.days)) {
                            updates.days = meta.days;
                        }

                        // staffId 비교
                        if (enrollData.staffId !== meta.staffId && meta.staffId) {
                            updates.staffId = meta.staffId;
                        }

                        // schedule 비교
                        const currentSchedule = (enrollData.schedule || []).slice().sort();
                        const metaSchedule = (meta.schedule || []).slice().sort();
                        if (JSON.stringify(currentSchedule) !== JSON.stringify(metaSchedule)) {
                            updates.schedule = meta.schedule;
                        }

                        if (Object.keys(updates).length > 0) {
                            stats.metadataSynced++;
                            if (!isDryRun) {
                                try {
                                    updates.updatedAt = new Date().toISOString();
                                    await enrollDoc.ref.update(updates);
                                } catch (e) {
                                    stats.errors.push(`MetaSync: ${studentKey}/${enrollDoc.id}: ${e.message}`);
                                }
                            } else {
                                const changes = Object.keys(updates).filter(k => k !== 'updatedAt').join(', ');
                                stats.details.push(`[metaSync] ${studentKey}: ${enrollData.className} (${changes})`);
                            }
                        }
                    }
                }
            }

            // 2e. doc ID 변환: classId가 있지만 doc ID가 classId가 아닌 문서 → classId로 변환
            for (const studentDoc of studentsSnap.docs) {
                const studentKey = studentDoc.id;
                const allEnrollSnap = isDryRun
                    ? await studentDoc.ref.collection("enrollments").get()
                    : await studentDoc.ref.collection("enrollments").get();

                for (const enrollDoc of allEnrollSnap.docs) {
                    const data = enrollDoc.data();
                    let classId = data.classId;
                    // classId 필드가 없으면 subject+className으로 역방향 조회
                    if (!classId && data.subject && data.className) {
                        const lookupKey = `${data.subject}_${data.className}`;
                        classId = classNameToIdMap.get(lookupKey);
                    }
                    if (!classId) continue;
                    if (enrollDoc.id === classId) continue; // 이미 classId가 doc ID

                    // 같은 classId로 된 문서가 이미 있으면 건너뜀 (중복 방지)
                    const existingRef = studentDoc.ref.collection("enrollments").doc(classId);
                    const existingSnap = await existingRef.get();
                    if (existingSnap.exists) continue;

                    stats.docIdRenamed++;
                    if (!isDryRun) {
                        try {
                            await existingRef.set({ ...data, classId }); // 새 doc ID로 복사 + classId 필드 보장
                            await enrollDoc.ref.delete(); // 기존 문서 삭제
                        } catch (e) {
                            stats.errors.push(`Rename: ${studentKey}/${enrollDoc.id}→${classId}: ${e.message}`);
                        }
                    } else {
                        stats.details.push(`[rename] ${studentKey}: ${enrollDoc.id} → ${classId} (${data.className || ''})`);
                    }
                }
            }

            logger.info(`[migration] ${mode} completed:`, JSON.stringify(stats));
            return stats;
        } catch (error) {
            logger.error("[migration] Error:", error);
            stats.errors.push(error.message);
            return stats;
        }
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

    // className → classId 매핑
    const classNameToId = {};
    for (const [cId, cData] of Object.entries(scenarioClasses)) {
        if (cData.className) classNameToId[cData.className] = cId;
    }

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
            const newClassId = classNameToId[item.newClassName] || item.newClassName;
            const newRef = db.collection("students").doc(item.studentId)
                .collection("enrollments").doc(newClassId);
            const newData = { ...item.data };
            newData.classId = newClassId;
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
            const cId = classNameToId[item.className] || item.className;
            const ref = db.collection("students").doc(item.studentId)
                .collection("enrollments").doc(cId);
            item.data.classId = cId;
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
    {
        name: "get_consultation_reports",
        description: "AI 상담 녹음 분석 보고서를 조회합니다. 녹음된 상담의 AI 분석 결과(요약, 학부모 걱정, 위험신호 등)를 반환합니다. '김민수 상담 분석 결과', '최근 상담 녹음 분석', '위험 학생 상담' 같은 질문에 사용.",
        parameters: { type: "object", properties: {
            studentName: { type: "string", description: "학생 이름 (부분 일치 검색)" },
            hasRiskFlags: { type: "boolean", description: "true이면 주의 신호가 있는 보고서만 반환" },
            limit: { type: "number", description: "반환할 보고서 수 (기본 10)" },
        }, required: [] },
    },
    {
        name: "get_registration_consultations",
        description: "등록 상담 기록을 조회합니다. 신규 학생의 등록 과정에서 기록된 상세 상담 내용(레벨테스트 점수, 과목별 상담, 학원 히스토리, 추천반, 등록 상태 등)을 반환합니다. '김민수 등록할 때 상담 내용', '이번 달 등록 상담', '미등록 학생 목록', '레벨테스트 결과' 같은 질문에 사용.",
        parameters: { type: "object", properties: {
            studentName: { type: "string", description: "학생 이름 (부분 일치 검색)" },
            status: { type: "string", description: "등록 상태 필터", enum: ["영수등록", "수학등록", "영어등록", "국어등록", "과학등록", "이번달 등록예정", "추후 등록예정", "미등록", "등록완료"] },
            subject: { type: "string", description: "상담 과목 필터", enum: ["영어", "EiE", "수학", "국어", "과학"] },
            startDate: { type: "string", description: "시작일 (YYYY-MM-DD)" },
            endDate: { type: "string", description: "종료일 (YYYY-MM-DD)" },
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
        return { id: d.id, studentName: data.studentName, consultantName: data.consultantName, type: data.type, category: data.category, title: data.title, date: data.date, followUpNeeded: data.followUpNeeded, followUpDone: data.followUpDone, consultationReportId: data.consultationReportId || null, autoGenerated: data.autoGenerated || false };
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

async function toolGetConsultationReports(args) {
    let query = db.collection("consultation_reports").where("status", "==", "completed").orderBy("createdAt", "desc");
    query = query.limit(args.limit || 10);
    const snap = await query.get();
    let reports = snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id, studentName: data.studentName, consultantName: data.consultantName,
            consultationDate: data.consultationDate, summary: data.report?.summary || "",
            parentConcerns: data.report?.parentConcerns || "", parentRequests: data.report?.parentRequests || "",
            agreements: data.report?.agreements || "", actionItems: data.report?.actionItems || "",
            riskFlags: data.report?.riskFlags || "", durationSeconds: data.durationSeconds,
        };
    });
    if (args.studentName) { const s = args.studentName.toLowerCase(); reports = reports.filter(r => r.studentName?.toLowerCase().includes(s)); }
    if (args.hasRiskFlags) { reports = reports.filter(r => r.riskFlags && !r.riskFlags.includes("특이사항 없음") && !r.riskFlags.includes("없음") && r.riskFlags.trim() !== ""); }
    const riskCount = reports.filter(r => r.riskFlags && !r.riskFlags.includes("특이사항 없음") && !r.riskFlags.includes("없음") && r.riskFlags.trim() !== "").length;
    return { totalCount: reports.length, riskFlagCount: riskCount, reports };
}

async function toolGetRegistrationConsultations(args) {
    const snap = await db.collection("consultations").get();
    let records = snap.docs.map(d => {
        const data = d.data();
        // 과목별 레벨테스트 요약 생성
        const levelTests = [];
        if (data.mathConsultation?.levelTestScore) levelTests.push(`수학: ${data.mathConsultation.levelTestScore}`);
        if (data.englishConsultation?.engLevel) levelTests.push(`영어: Lv${data.englishConsultation.engLevel}`);
        if (data.koreanConsultation?.levelTestScore) levelTests.push(`국어: ${data.koreanConsultation.levelTestScore}`);
        if (data.scienceConsultation?.levelTestScore) levelTests.push(`과학: ${data.scienceConsultation.levelTestScore}`);
        // 과목별 추천반/담임 요약
        const recommendations = [];
        const subjects = ["mathConsultation", "englishConsultation", "koreanConsultation", "scienceConsultation"];
        const subjectLabels = { mathConsultation: "수학", englishConsultation: "영어", koreanConsultation: "국어", scienceConsultation: "과학" };
        for (const subj of subjects) {
            if (data[subj]?.recommendedClass) recommendations.push(`${subjectLabels[subj]}: ${data[subj].recommendedClass}${data[subj].homeRoomTeacher ? ` (${data[subj].homeRoomTeacher})` : ""}`);
        }
        return {
            id: d.id, studentName: data.studentName, schoolName: data.schoolName, grade: data.grade,
            parentPhone: data.parentPhone, parentName: data.parentName,
            consultationDate: data.consultationDate, subject: data.subject, status: data.status,
            counselor: data.counselor, notes: data.notes,
            levelTests: levelTests.join(", ") || "없음",
            recommendations: recommendations.join(", ") || "없음",
            nonRegistrationReason: data.nonRegistrationReason || "",
            followUpDate: data.followUpDate || "", followUpContent: data.followUpContent || "",
            academyHistory: data.mathConsultation?.academyHistory || data.englishConsultation?.academyHistory || "",
            registeredStudentId: data.registeredStudentId || null,
        };
    });
    if (args.studentName) { const s = args.studentName.toLowerCase(); records = records.filter(r => r.studentName?.toLowerCase().includes(s)); }
    if (args.status) records = records.filter(r => r.status === args.status);
    if (args.subject) records = records.filter(r => r.subject === args.subject);
    if (args.startDate) records = records.filter(r => r.consultationDate >= args.startDate);
    if (args.endDate) records = records.filter(r => r.consultationDate <= args.endDate);
    records.sort((a, b) => (b.consultationDate || "").localeCompare(a.consultationDate || ""));
    const statusStats = {};
    records.forEach(r => { statusStats[r.status || "미분류"] = (statusStats[r.status || "미분류"] || 0) + 1; });
    const registeredCount = records.filter(r => r.registeredStudentId).length;
    return { totalCount: records.length, statusStats, registeredCount, conversionRate: records.length > 0 ? Math.round(registeredCount / records.length * 100) + "%" : "0%", records: records.slice(0, 20) };
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
    get_consultation_reports: toolGetConsultationReports,
    get_registration_consultations: toolGetRegistrationConsultations,
};

exports.chatWithAI = functions.region("asia-northeast3").runWith({ timeoutSeconds: 60, memory: "512MB", secrets: ["GEMINI_API_KEY"] }).https.onCall(async (data, context) => {
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

// ===== MakeEdu 공통 유틸리티 =====
const cheerio = require("cheerio");

/** 학교명 정규화 */
function normalizeSchoolName(school) {
    return (school || "").trim()
        .replace(/초등학교$/g, "초")
        .replace(/중학교$/g, "중")
        .replace(/고등학교$/g, "고");
}

/** 학년 정규화 */
function normalizeGradeValue(grade, school) {
    if (!grade) return "";
    const gradeNum = grade.match(/\d+/)?.[0];
    if (!gradeNum) return grade.trim();
    const num = parseInt(gradeNum);
    const s = (school || "").toLowerCase();
    if (s.includes("초") || s.includes("elementary")) return `초${num}`;
    if (s.includes("중") || s.includes("middle")) return `중${num}`;
    if (s.includes("고") || s.includes("high")) return `고${num}`;
    if (grade.includes("초")) return `초${num}`;
    if (grade.includes("중")) return `중${num}`;
    if (grade.includes("고")) return `고${num}`;
    if (num >= 1 && num <= 6) return `초${num}`;
    if (num >= 7 && num <= 9) return `중${num - 6}`;
    return grade.trim();
}

/** 전화번호 포맷팅 */
function formatPhoneNumber(phone) {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    if (!digits) return null;
    let normalized = digits;
    if (digits.length === 10 && digits.startsWith("10")) normalized = "0" + digits;
    if (normalized.length === 11 && normalized.startsWith("01"))
        return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
    if (normalized.length === 10 && normalized.startsWith("0") && !normalized.startsWith("02"))
        return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
    if (normalized.startsWith("02")) {
        if (normalized.length === 9) return `02-${normalized.slice(2, 5)}-${normalized.slice(5)}`;
        if (normalized.length === 10) return `02-${normalized.slice(2, 6)}-${normalized.slice(6)}`;
    }
    return phone.trim();
}

/** 날짜 포맷 (YYYYMMDD → YYYY-MM-DD) */
function formatDateValue(date) {
    if (!date) return null;
    const digits = date.replace(/\D/g, "");
    if (digits.length === 8) return `${digits.substring(0, 4)}-${digits.substring(4, 6)}-${digits.substring(6, 8)}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    return date;
}

/** 전화번호 비교용 정규화 (숫자만, 암호화 값은 빈 문자열) */
function normalizePhoneDigits(phone) {
    if (!phone) return "";
    if (phone.startsWith("U2FsdGVkX1")) return "";
    return phone.replace(/\D/g, "");
}

/** 출결번호 생성 */
function generateAttNum(parentPhone, existingNumbers) {
    let base;
    if (parentPhone && parentPhone.length >= 4) {
        const d = parentPhone.replace(/\D/g, "");
        base = d.length >= 4 ? d.slice(-4) : String(Math.floor(1000 + Math.random() * 9000));
    } else {
        base = String(Math.floor(1000 + Math.random() * 9000));
    }
    let num = base;
    let suffix = 1;
    while (existingNumbers.has(num)) { num = base + suffix; suffix++; }
    return num;
}

/** 학생 고유번호 생성 */
function generateStudCode(existingCodes) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let a = 0; a < 1000; a++) {
        let code = "";
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        if (!existingCodes.has(code)) return code;
    }
    return "X" + Date.now().toString(36).slice(-5).toUpperCase();
}

/** 영어 클래스명 파싱 (DP3, RTT2a 등) */
const ENGLISH_LEVELS = [
    "DP", "PL", "RTT", "LT", "RTS", "LS", "LE", "KW", "PJ", "JP", "SP", "MEC",
];
function parseEngClassName(name) {
    if (!name) return null;
    const m = name.match(/^([A-Z]+)(\d+)([a-z]?)$/);
    if (!m) return null;
    return { levelAbbr: m[1], number: parseInt(m[2]), suffix: m[3] || "" };
}

// ===== MakeEdu 버스 데이터 크롤링 =====

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

// ===== MakeEdu 신규원생 크롤링 =====

/**
 * MakeEdu 신규원생 스크래핑 내부 헬퍼 (onCall + scheduled 공용)
 * @param {string} [overrideUser] - 커스텀 username (고등수학관 등 별도 계정용)
 * @param {string} [overridePwd] - 커스텀 password
 * @returns {{ students: Array, count: number, headers: string[] }}
 */
async function scrapeMakeEduStudentsInternal(overrideUser, overridePwd) {
    const userId = overrideUser || process.env.MAKEEDU_USERNAME;
    const userPwd = overridePwd || process.env.MAKEEDU_PASSWORD;
    if (!userId || !userPwd) {
        throw new Error("MakeEdu 로그인 정보가 .env에 설정되지 않았습니다.");
    }

            const baseUrl = "https://school.makeedu.co.kr";
            const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

            // 1. 세션 쿠키 획득
            logger.info("[scrapeMakeEduNewStudents] Getting session...");
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

            // 2. 로그인
            logger.info("[scrapeMakeEduNewStudents] Logging in...");
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
            const loginSetCookies = loginRes.headers.getSetCookie?.() || [];
            for (const h of loginSetCookies) {
                const cookie = h.split(";")[0];
                if (cookie) sessionCookies.push(cookie);
            }
            cookieStr = sessionCookies.join("; ");
            const loginBody = await loginRes.text();
            logger.info("[scrapeMakeEduNewStudents] Login status:", loginRes.status);

            const loginOk = loginBody.includes("OK") || loginRes.status === 302 || loginRes.status === 200;
            if (!loginOk && sessionCookies.length === 0) {
                throw new functions.https.HttpsError("unauthenticated",
                    `MakeEdu 로그인 실패 (status: ${loginRes.status})`);
            }

            // 3. 메인 페이지에서 학생 관련 URL 탐색
            logger.info("[scrapeMakeEduNewStudents] Fetching main page for URL discovery...");
            const mainRes = await fetch(`${baseUrl}/main.do`, {
                headers: {
                    "Cookie": cookieStr,
                    "User-Agent": UA,
                },
            });
            const mainHtml = await mainRes.text();
            const $main = cheerio.load(mainHtml);

            // 메인 페이지에서 학생/원생 관련 링크 추출
            const candidateUrls = [];
            $main("a[href]").each((_, a) => {
                const href = $main(a).attr("href") || "";
                const text = $main(a).text().trim();
                if (href.includes("student") || href.includes("member") ||
                    href.includes("consult") || href.includes("pupil") ||
                    text.includes("원생") || text.includes("학생") || text.includes("등록")) {
                    const fullUrl = href.startsWith("http") ? href : `${baseUrl}${href.startsWith("/") ? "" : "/"}${href}`;
                    candidateUrls.push({ url: fullUrl, text, href });
                }
            });
            // onclick 속성에서도 URL 추출
            $main("[onclick]").each((_, el) => {
                const onclick = $main(el).attr("onclick") || "";
                const text = $main(el).text().trim();
                const urlMatch = onclick.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
                const urlMatch2 = onclick.match(/['"](\/?[a-zA-Z]+\/[a-zA-Z]+\.do[^'"]*)['"]/);
                const matched = urlMatch?.[1] || urlMatch2?.[1];
                if (matched && (matched.includes("student") || matched.includes("member") ||
                    text.includes("원생") || text.includes("학생"))) {
                    const fullUrl = matched.startsWith("http") ? matched : `${baseUrl}${matched.startsWith("/") ? "" : "/"}${matched}`;
                    candidateUrls.push({ url: fullUrl, text, href: matched });
                }
            });
            logger.info("[scrapeMakeEduNewStudents] Candidate URLs from main:", JSON.stringify(candidateUrls.slice(0, 20)));

            // 시도할 URL 목록 (발견된 URL + 일반적인 MakeEdu URL 패턴)
            const urlsToTry = [
                ...candidateUrls.map(c => c.url),
                `${baseUrl}/student/studentList.do`,
                `${baseUrl}/student/studentMng.do`,
                `${baseUrl}/student/studentManage.do`,
                `${baseUrl}/student/studentInfo.do`,
                `${baseUrl}/student/studentRegist.do`,
                `${baseUrl}/student/newStudent.do`,
                `${baseUrl}/member/memberList.do`,
                `${baseUrl}/consult/consultRegist.do`,
                `${baseUrl}/consult/consultList.do`,
            ];
            // 중복 제거
            const uniqueUrls = [...new Set(urlsToTry)];

            // 4. 각 URL 시도하여 학생 목록 페이지 찾기
            let html = "";
            let studentPageUrl = "";
            for (const url of uniqueUrls) {
                try {
                    logger.info("[scrapeMakeEduNewStudents] Trying URL:", url);
                    const res = await fetch(url, {
                        headers: {
                            "Cookie": cookieStr,
                            "User-Agent": UA,
                            "Referer": `${baseUrl}/main.do`,
                        },
                        redirect: "follow",
                    });
                    if (res.ok) {
                        const body = await res.text();
                        // 학생 관련 테이블이 있는 페이지인지 확인
                        const $check = cheerio.load(body);
                        const hasTable = $check("table").length > 0;
                        const hasStudentContent = body.includes("원생") || body.includes("학생") ||
                            body.includes("이름") || body.includes("성명");
                        if (hasTable && hasStudentContent) {
                            html = body;
                            studentPageUrl = url;
                            logger.info("[scrapeMakeEduNewStudents] Found student page at:", url, "HTML length:", body.length);
                            break;
                        } else {
                            logger.info("[scrapeMakeEduNewStudents] URL ok but no student table:", url,
                                "tables:", $check("table").length, "hasStudentContent:", hasStudentContent);
                        }
                    } else {
                        logger.info("[scrapeMakeEduNewStudents] URL failed:", url, "status:", res.status);
                    }
                } catch (urlErr) {
                    logger.info("[scrapeMakeEduNewStudents] URL error:", url, urlErr.message);
                }
            }

            if (!studentPageUrl) {
                // 메인 페이지의 모든 링크를 로그하여 디버깅 지원
                const allLinks = [];
                $main("a[href]").each((_, a) => {
                    allLinks.push({ href: $main(a).attr("href"), text: $main(a).text().trim().substring(0, 50) });
                });
                logger.info("[scrapeMakeEduNewStudents] All main page links:", JSON.stringify(allLinks.slice(0, 50)));
                throw new functions.https.HttpsError("internal",
                    `학생 페이지를 찾을 수 없습니다. 시도한 URL 수: ${uniqueUrls.length}. 후보 URL: ${candidateUrls.map(c => c.href).join(', ')}`);
            }

            // 5. 페이지 form에서 신규원생 필터 파라미터 탐색
            const $page = cheerio.load(html);
            const formParams = {};
            // select 요소에서 "신규" 관련 옵션 찾기
            $page("select").each((_, sel) => {
                const selName = $page(sel).attr("name") || "";
                const selId = $page(sel).attr("id") || "";
                const options = [];
                $page(sel).find("option").each((__, opt) => {
                    options.push({ value: $page(opt).attr("value") || "", text: $page(opt).text().trim() });
                });
                logger.info("[scrapeMakeEduNewStudents] Select:", selName, "id:", selId, "options:", JSON.stringify(options));

                // listSize select를 찾아서 500으로 설정
                if (selName === "listSize" || selId === "listSize") {
                    const opt500 = options.find(o => o.value === "500");
                    if (opt500) {
                        formParams[selName] = "500";
                        logger.info(`[scrapeMakeEduNewStudents] Set listSize to 500 (페이지당 500개)`);
                    }
                }

                // "전체" 원생 조회: "신규"와 "전체" 옵션을 모두 가진 select에서 "전체" 선택
                const hasNewOption = options.some(o => o.text.includes("신규"));
                const hasAllOption = options.some(o => o.text.includes("전체") || o.text === "A");
                const isNewStudentSelect = hasNewOption && hasAllOption;

                if (isNewStudentSelect) {
                    const allOpt = options.find(o => o.text.includes("전체") || o.text === "A");
                    if (allOpt) {
                        formParams[selName] = allOpt.value;
                        logger.info(`[scrapeMakeEduNewStudents] Selected "전체" option for ${selName}: ${allOpt.value}`);
                    }
                }
            });
            // hidden input과 기본 form 파라미터 수집
            const formInputs = {};
            $page("form").first().find("input[type='hidden'], input[name]").each((_, inp) => {
                const name = $page(inp).attr("name") || "";
                const val = $page(inp).attr("value") || "";
                if (name) formInputs[name] = val;
            });
            logger.info("[scrapeMakeEduNewStudents] Form params (new student filter):", JSON.stringify(formParams));
            logger.info("[scrapeMakeEduNewStudents] Form hidden inputs:", JSON.stringify(formInputs));

            // POST body 구성: 기본 파라미터 + 신규원생 필터
            const postParams = new URLSearchParams();
            // form에서 발견한 listSize 및 신규원생 필터 적용
            for (const [k, v] of Object.entries(formParams)) {
                postParams.set(k, v);
            }
            // 발견 못했으면 기본값 시도
            if (Object.keys(formParams).length === 0) {
                postParams.set("srchType", "A");
                postParams.set("srchNewStat", "N");
            }
            logger.info("[scrapeMakeEduNewStudents] POST body:", postParams.toString());

            // 6. 신규원생 검색 (POST)
            logger.info("[scrapeMakeEduNewStudents] Searching new students at:", studentPageUrl);
            const searchRes = await fetch(studentPageUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Cookie": cookieStr,
                    "User-Agent": UA,
                    "Referer": studentPageUrl,
                },
                body: postParams.toString(),
            });
            let searchHtml = await searchRes.text();
            logger.info("[scrapeMakeEduNewStudents] Search result length:", searchHtml.length);

            // 테이블이 없으면 다른 파라미터 시도
            const $ = cheerio.load(searchHtml);
            let tableRows = $("table tbody tr");
            logger.info("[scrapeMakeEduNewStudents] Found table rows:", tableRows.length);

            // 테이블이 없으면 원본 GET HTML에서 시도
            if (tableRows.length === 0) {
                logger.info("[scrapeMakeEduNewStudents] No rows in search, trying GET html...");
                const $orig = cheerio.load(html);
                tableRows = $orig("table tbody tr");
                logger.info("[scrapeMakeEduNewStudents] GET html table rows:", tableRows.length);
                if (tableRows.length > 0) {
                    searchHtml = html;
                }
            }

            // 7. 테이블 헤더 추출
            const $final = cheerio.load(searchHtml);
            const headers = [];
            // thead에서 th 추출
            $final("table thead tr th, table thead tr td").each((_, el) => {
                headers.push($final(el).text().trim());
            });
            // thead가 없으면 첫번째 tr에서 th 추출
            if (headers.length === 0) {
                $final("table tr").first().find("th").each((_, el) => {
                    headers.push($final(el).text().trim());
                });
            }
            // 그래도 없으면 첫번째 tr의 td에서 추출 (헤더행으로 간주)
            if (headers.length === 0) {
                $final("table tr").first().find("td").each((_, el) => {
                    headers.push($final(el).text().trim());
                });
            }
            logger.info("[scrapeMakeEduNewStudents] Headers:", JSON.stringify(headers));

            // 헤더 키워드 Set (데이터 행에서 헤더행 걸러내기 용)
            const headerKeywords = new Set(["이름", "성명", "원생명", "학생명", "학교", "학년", "연락처",
                "전화번호", "보호자", "등록일", "입학일", "반", "성별", "주소", "메모", "상태", "번호",
                "출결", "생년월일", "강사", "담당", "비고"]);

            // 6. 헤더 인덱스 매핑 (유연하게)
            const findCol = (keywords) => {
                return headers.findIndex(h =>
                    keywords.some(k => h.includes(k))
                );
            };

            const colName = findCol(["이름", "성명", "원생명", "학생명"]);
            const colSchool = findCol(["학교"]);
            const colGrade = findCol(["학년"]);
            const colPhone = findCol(["원생연락", "학생연락", "휴대폰", "핸드폰"]);
            const colParentPhone = findCol(["보호자연락", "학부모연락", "보호자폰", "부모연락"]);
            const colRegDate = findCol(["등록일", "입학일", "등원일", "입원일"]);
            const colClass = findCol(["반", "클래스", "수업"]);
            const colTeacher = findCol(["선생", "담당", "강사"]);
            const colGender = findCol(["성별"]);
            const colParentName = findCol(["보호자명", "보호자이름", "학부모명"]);
            const colBirth = findCol(["생년", "생일", "출생"]);
            const colAddress = findCol(["주소"]);
            const colAttNum = findCol(["출결번호", "출석번호"]);
            const colCustom1 = findCol(["기타항목1", "기타1", "사용자1", "비고1"]);
            const colCustom2 = findCol(["기타항목2", "기타2", "사용자2", "비고2"]);
            const colSiblings = findCol(["형제", "자매"]);
            const colMemo = findCol(["메모", "비고"]);
            const colStatus = findCol(["상태", "재원", "등록상태"]);
            const colNo = findCol(["원생고유번호"]);
            const colAddressDetail = findCol(["상세주소"]);

            logger.info("[scrapeMakeEduNewStudents] Column mapping:", JSON.stringify({
                colName, colSchool, colGrade, colPhone, colParentPhone,
                colRegDate, colClass, colTeacher, colGender,
            }));

            // 8. 각 행에서 학생 데이터 추출 (페이지네이션)
            const allStudents = [];
            let currentPage = 1;
            const maxPages = 20; // 최대 20페이지 (300 * 20 = 6000명)
            
            while (currentPage <= maxPages) {
                // 다양한 페이지네이션 파라미터 시도 (MakeEdu가 어떤 것을 사용하는지 확실하지 않음)
                postParams.set("pageIndex", currentPage.toString());
                postParams.set("currentPage", currentPage.toString());
                postParams.set("page", currentPage.toString());
                postParams.set("pageNo", currentPage.toString());

                logger.info(`[scrapeMakeEduNewStudents] Fetching page ${currentPage}...`);
                
                const pageRes = await fetch(studentPageUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Cookie": cookieStr,
                        "User-Agent": UA,
                        "Referer": studentPageUrl,
                    },
                    body: postParams.toString(),
                });
                const pageHtml = await pageRes.text();
                const $page = cheerio.load(pageHtml);
                
                const pageStudents = [];
                // tbody tr 또는 전체 tr에서 추출 (thead 다음부터)
                let dataRows = $page("table tbody tr");
            if (dataRows.length === 0) {
                    dataRows = $page("table tr").slice(1);
                }
            dataRows.each((_, row) => {
                // th 셀이 있는 행은 헤더행이므로 스킵
                if ($page(row).find("th").length > 0) return;

                const cells = [];
                $page(row).find("td").each((__, td) => {
                    cells.push($page(td).text().trim());
                });

                if (cells.length < 3) return; // 최소 3개 컬럼 필요

                // 헤더행이 tbody에 섞여있는 경우 필터: 셀 내용이 헤더 키워드와 대부분 일치하면 스킵
                let headerMatchCount = 0;
                cells.forEach(c => {
                    if (headerKeywords.has(c) || headers.includes(c)) headerMatchCount++;
                });
                if (headerMatchCount >= 3) return; // 3개 이상 헤더 키워드 매칭 → 헤더행

                const name = colName >= 0 ? cells[colName] : "";
                if (!name) return; // 이름 없으면 스킵

                // _raw: 모든 필드를 헤더와 매핑
                const raw = {};
                headers.forEach((h, i) => {
                    if (i < cells.length) raw[h] = cells[i];
                });

                pageStudents.push({
                    name,
                    school: colSchool >= 0 ? cells[colSchool] || "" : "",
                    grade: colGrade >= 0 ? cells[colGrade] || "" : "",
                    phone: colPhone >= 0 ? cells[colPhone] || "" : "",
                    parentPhone: colParentPhone >= 0 ? cells[colParentPhone] || "" : "",
                    registrationDate: colRegDate >= 0 ? cells[colRegDate] || "" : "",
                    className: colClass >= 0 ? cells[colClass] || "" : "",
                    teacher: colTeacher >= 0 ? cells[colTeacher] || "" : "",
                    gender: colGender >= 0 ? cells[colGender] || "" : "",
                    parentName: colParentName >= 0 ? cells[colParentName] || "" : "",
                    birthDate: colBirth >= 0 ? cells[colBirth] || "" : "",
                    address: colAddress >= 0 ? cells[colAddress] || "" : "",
                    addressDetail: colAddressDetail >= 0 ? cells[colAddressDetail] || "" : "",
                    attendanceNumber: colAttNum >= 0 ? cells[colAttNum] || "" : "",
                    customField1: colCustom1 >= 0 ? cells[colCustom1] || "" : "",
                    customField2: colCustom2 >= 0 ? cells[colCustom2] || "" : "",
                    siblings: colSiblings >= 0 ? cells[colSiblings] || "" : "",
                    memo: colMemo >= 0 ? cells[colMemo] || "" : "",
                    status: colStatus >= 0 ? cells[colStatus] || "" : "",
                    makeEduNo: colNo >= 0 ? cells[colNo] || "" : "",
                    _raw: raw,
                });
            });

                logger.info(`[scrapeMakeEduNewStudents] Page ${currentPage}: Found ${pageStudents.length} students`);

                // Add page students to total
                allStudents.push(...pageStudents);

                // Break if no more students on this page
                if (pageStudents.length === 0) {
                    logger.info(`[scrapeMakeEduNewStudents] No more students found. Stopping at page ${currentPage}`);
                    break;
                }

                currentPage++;
            }

            const students = allStudents;
            logger.info("[scrapeMakeEduNewStudents] Total parsed students:", students.length);

            // 파싱 실패 시 HTML 일부를 반환하여 디버깅 지원
            if (students.length === 0) {
                // 페이지에서 form/table 구조 파악을 위해 HTML 일부 로깅
                const forms = [];
                $final("form").each((_, f) => {
                    forms.push({
                        action: $final(f).attr("action") || "",
                        id: $final(f).attr("id") || "",
                        method: $final(f).attr("method") || "",
                    });
                });
                const tables = [];
                $final("table").each((_, t) => {
                    const id = $final(t).attr("id") || "";
                    const cls = $final(t).attr("class") || "";
                    const rows = $final(t).find("tr").length;
                    tables.push({ id, class: cls, rows });
                });
                const links = [];
                $final("a[href*='student'], a[href*='consult'], a[href*='new']").each((_, a) => {
                    links.push({ href: $final(a).attr("href"), text: $final(a).text().trim() });
                });
                logger.info("[scrapeMakeEduNewStudents] Page structure - forms:", JSON.stringify(forms));
                logger.info("[scrapeMakeEduNewStudents] Page structure - tables:", JSON.stringify(tables));
                logger.info("[scrapeMakeEduNewStudents] Page structure - links:", JSON.stringify(links.slice(0, 20)));

                // HTML 첫 5000자 로깅 (디버깅용)
                logger.info("[scrapeMakeEduNewStudents] HTML preview:", searchHtml.substring(0, 5000));
            }

    return {
        students,
        count: students.length,
        headers,
    };
}

/**
 * MakeEdu 신규원생 목록 크롤링 (클라이언트 호출용)
 */
exports.scrapeMakeEduNewStudents = functions
    .region("asia-northeast3")
    .runWith({ timeoutSeconds: 300, memory: "512MB" })
    .https.onCall(async (data, context) => {
        logger.info("[scrapeMakeEduNewStudents] Start (onCall)");
        try {
            return await scrapeMakeEduStudentsInternal();
        } catch (error) {
            logger.error("[scrapeMakeEduNewStudents] Error:", error);
            if (error.code) throw error;
            throw new functions.https.HttpsError("internal", error.message || "신규원생 크롤링 실패");
        }
    });

/**
 * 고등수학관 MakeEdu 신규원생 스크래핑 (별도 계정 사용)
 * - MAKEEDU_GD_USERNAME / MAKEEDU_GD_PASSWORD 환경변수 사용
 * - 본원 스크래핑과 동일한 로직, 다른 크리덴셜
 */
exports.scrapeMakeEduGodeungStudents = functions
    .region("asia-northeast3")
    .runWith({ timeoutSeconds: 300, memory: "512MB" })
    .https.onCall(async (data, context) => {
        logger.info("[scrapeMakeEduGodeungStudents] Start (onCall)");
        try {
            const gdUser = process.env.MAKEEDU_GD_USERNAME;
            const gdPwd = process.env.MAKEEDU_GD_PASSWORD;
            if (!gdUser || !gdPwd) {
                throw new functions.https.HttpsError("failed-precondition",
                    "고등수학관 MakeEdu 로그인 정보가 .env에 설정되지 않았습니다. (MAKEEDU_GD_USERNAME / MAKEEDU_GD_PASSWORD)");
            }
            return await scrapeMakeEduStudentsInternal(gdUser, gdPwd);
        } catch (error) {
            logger.error("[scrapeMakeEduGodeungStudents] Error:", error);
            if (error.code) throw error;
            throw new functions.https.HttpsError("internal", error.message || "고등수학관 신규원생 크롤링 실패");
        }
    });

/**
 * MakeEdu 신규원생 자동 동기화 (30분마다 실행)
 * 1. MakeEdu에서 신규원생 스크래핑
 * 2. Firestore 기존 학생과 이름 비교
 * 3. 미등록 학생 자동 등록 + 기존 학생 필드 업데이트
 * 4. 영어 수업 자동 배정 (기타항목1에 E 포함 시)
 * 5. 동기화 로그 저장 (makeEduSyncLogs)
 */
exports.scheduledMakeEduSync = functions
    .region("asia-northeast3")
    .runWith({ timeoutSeconds: 540, memory: "512MB" })
    .pubsub.schedule("every 30 minutes")
    .timeZone("Asia/Seoul")
    .onRun(async (context) => {
        logger.info("[scheduledMakeEduSync] Start");
        const syncStart = Date.now();
        const results = { registered: [], updated: [], errors: [], skipped: 0, total: 0 };

        try {
            // 1. MakeEdu 스크래핑
            const { students, headers } = await scrapeMakeEduStudentsInternal();
            results.total = students.length;
            logger.info("[scheduledMakeEduSync] Scraped students:", students.length);

            if (students.length === 0) {
                logger.info("[scheduledMakeEduSync] No students found, skipping.");
                await saveSyncLog(results, syncStart);
                return null;
            }

            // 2. 기존 IJW 학생 전체 조회
            const studentsSnap = await db.collection("students").get();
            const ijwNameMap = new Map();
            const ijwCodeMap = new Map(); // 원생고유번호로 매칭
            const usedAttNums = new Set();
            const usedStudCodes = new Set();
            studentsSnap.forEach(d => {
                const s = d.data();
                if (s.name) ijwNameMap.set(s.name.trim(), { id: d.id, ...s });
                if (s.studentCode && s.studentCode.trim() !== "") {
                    ijwCodeMap.set(s.studentCode.trim(), { id: d.id, ...s });
                }
                if (s.attendanceNumber) usedAttNums.add(s.attendanceNumber);
                if (s.studentCode) usedStudCodes.add(s.studentCode);
            });
            logger.info("[scheduledMakeEduSync] Existing IJW students:", ijwNameMap.size, "with studentCode:", ijwCodeMap.size);

            // 3. 영어 클래스 목록 (자동 배정용)
            const classesSnap = await db.collection("classes").get();
            const englishClasses = [];
            classesSnap.forEach(d => {
                const c = d.data();
                if (c.subject === "english") englishClasses.push({ id: d.id, ...c });
            });

            // 4. 각 학생 비교 및 처리
            for (const meStudent of students) {
                const name = (meStudent.name || "").trim();
                if (!name) { results.skipped++; continue; }

                try {
                    // 우선순위 1: 원생고유번호로 매칭 (이름이 바뀌어도 동일 학생 식별)
                    const makeEduNo = meStudent.makeEduNo?.trim();
                    let existing = null;
                    let matchedByCode = false;

                    if (makeEduNo && makeEduNo !== "") {
                        existing = ijwCodeMap.get(makeEduNo);
                        if (existing) {
                            matchedByCode = true;
                            logger.info(`[scheduledMakeEduSync] Matched by studentCode: ${name} (code: ${makeEduNo})`);
                        }
                    }

                    // 우선순위 2: 이름으로 매칭 (원생고유번호가 없거나 매칭 실패한 경우)
                    if (!existing) {
                        existing = ijwNameMap.get(name);
                        if (existing) {
                            logger.info(`[scheduledMakeEduSync] Matched by name: ${name}`);
                        }
                    }

                    if (existing) {
                        // === 기존 학생: 필드 업데이트 ===
                        const updateData = buildUpdateData(existing, meStudent);
                        if (Object.keys(updateData).length > 0) {
                            updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
                            updateData.makeEduSync = true;
                            await db.collection("students").doc(existing.id).update(updateData);

                            // 영어 자동 배정
                            const enrollNote = await tryAutoEnrollEnglish(existing.id, meStudent, englishClasses, existing.startDate);
                            results.updated.push({
                                name, fields: Object.keys(updateData).filter(k => k !== "updatedAt" && k !== "makeEduSync"),
                                enrollNote: enrollNote || undefined,
                            });
                        } else {
                            // 영어 배정만 체크 (필드 업데이트 없어도)
                            const enrollNote = await tryAutoEnrollEnglish(existing.id, meStudent, englishClasses, existing.startDate);
                            if (enrollNote) {
                                results.updated.push({ name, fields: [], enrollNote });
                            } else {
                                results.skipped++;
                            }
                        }
                    } else {
                        // === 신규 학생: 자동 등록 ===
                        const normalizedSchool = normalizeSchoolName(meStudent.school);
                        const grade = normalizeGradeValue(meStudent.grade, meStudent.school);
                        const gender = meStudent.gender === "남" ? "male" : meStudent.gender === "여" ? "female" : null;
                        const startDate = formatDateValue(meStudent.registrationDate) || getTodayKST();

                        // ID 생성
                        const baseId = `${name}_${normalizedSchool || "Unspecified"}_${grade || "Unspecified"}`;
                        let studentId = baseId;
                        let counter = 1;
                        while ((await db.collection("students").doc(studentId).get()).exists) {
                            counter++;
                            studentId = `${baseId}_${counter}`;
                            if (counter > 100) throw new Error("동일한 학생 정보가 너무 많습니다.");
                        }

                        // 출결번호 & 고유번호
                        let attendanceNumber = meStudent.attendanceNumber;
                        if (!attendanceNumber || usedAttNums.has(attendanceNumber)) {
                            attendanceNumber = generateAttNum(meStudent.parentPhone || meStudent.phone, usedAttNums);
                        }
                        usedAttNums.add(attendanceNumber);
                        const studentCode = meStudent.makeEduNo || null; // MakeEdu 원생고유번호 사용

                        const formattedStudentPhone = formatPhoneNumber(meStudent.phone);
                        const formattedParentPhone = formatPhoneNumber(meStudent.parentPhone);

                        await db.collection("students").doc(studentId).set({
                            name, englishName: null, gender,
                            school: normalizedSchool || null, grade: grade || null, graduationYear: null,
                            attendanceNumber, studentCode,
                            studentPhone: formattedStudentPhone || null,
                            homePhone: null,
                            parentPhone: formattedParentPhone || null,
                            parentName: meStudent.parentName || null, parentRelation: "모",
                            zipCode: null, address: meStudent.address || null,
                            addressDetail: meStudent.addressDetail || null,
                            birthDate: meStudent.birthDate || null, nickname: null,
                            startDate, enrollmentReason: null,
                            memo: meStudent.memo || null,
                            customField1: meStudent.customField1 || null,
                            customField2: meStudent.customField2 || null,
                            status: "active",
                            enrollmentDate: admin.firestore.FieldValue.serverTimestamp(),
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            smsNotification: true, pushNotification: false, kakaoNotification: true,
                            billingSmsPrimary: true, billingSmsOther: false,
                            overdueSmsPrimary: true, overdueSmsOther: false,
                            makeEduSync: true,
                        });

                        // 영어 자동 배정
                        const enrollNote = await tryAutoEnrollEnglish(studentId, meStudent, englishClasses, startDate);

                        // ijwNameMap에 추가 (같은 이름 중복 등록 방지)
                        ijwNameMap.set(name, { id: studentId });
                        results.registered.push({ name, studentId, enrollNote: enrollNote || undefined });
                    }
                } catch (studentErr) {
                    logger.error("[scheduledMakeEduSync] Error processing:", name, studentErr.message);
                    results.errors.push({ name, error: studentErr.message });
                }
            }

            logger.info("[scheduledMakeEduSync] Done.",
                "Registered:", results.registered.length,
                "Updated:", results.updated.length,
                "Errors:", results.errors.length,
                "Skipped:", results.skipped);

            await saveSyncLog(results, syncStart);
            return null;
        } catch (error) {
            logger.error("[scheduledMakeEduSync] Fatal error:", error);
            results.errors.push({ name: "_fatal", error: error.message });
            await saveSyncLog(results, syncStart);
            return null;
        }
    });

/** 기존 학생과 MakeEdu 데이터 비교하여 업데이트할 필드 반환 */
function buildUpdateData(existing, meStudent) {
    const updateData = {};
    const normalizedSchool = normalizeSchoolName(meStudent.school);
    const normalizedGrade = normalizeGradeValue(meStudent.grade, meStudent.school);
    const gender = meStudent.gender === "남" ? "male" : meStudent.gender === "여" ? "female" : null;

    // 이름 업데이트 (원생고유번호로 매칭된 경우 이름이 변경되었을 수 있음)
    const newName = (meStudent.name || "").trim();
    if (newName && existing.name !== newName) updateData.name = newName;

    if (gender && existing.gender !== gender) updateData.gender = gender;
    if (normalizedSchool && existing.school !== normalizedSchool) updateData.school = normalizedSchool;
    if (normalizedGrade && existing.grade !== normalizedGrade) updateData.grade = normalizedGrade;
    if (meStudent.attendanceNumber && existing.attendanceNumber !== meStudent.attendanceNumber) updateData.attendanceNumber = meStudent.attendanceNumber;
    if (meStudent.parentName && existing.parentName !== meStudent.parentName) updateData.parentName = meStudent.parentName;
    // MakeEdu 원생고유번호로 studentCode 업데이트 (빈 문자열 제외)
    if (meStudent.makeEduNo && meStudent.makeEduNo.trim() !== "" && existing.studentCode !== meStudent.makeEduNo) {
        updateData.studentCode = meStudent.makeEduNo;
    }
    if (meStudent.birthDate && existing.birthDate !== meStudent.birthDate) updateData.birthDate = meStudent.birthDate;
    if (meStudent.address && existing.address !== meStudent.address) updateData.address = meStudent.address;
    if (meStudent.customField1 && existing.customField1 !== meStudent.customField1) updateData.customField1 = meStudent.customField1;
    if (meStudent.customField2 && existing.customField2 !== meStudent.customField2) updateData.customField2 = meStudent.customField2;
    if (meStudent.memo && !existing.memo) updateData.memo = meStudent.memo;

    const fStudentPhone = formatPhoneNumber(meStudent.phone);
    const fParentPhone = formatPhoneNumber(meStudent.parentPhone);
    if (fStudentPhone && normalizePhoneDigits(existing.studentPhone) !== normalizePhoneDigits(fStudentPhone))
        updateData.studentPhone = fStudentPhone;
    if (fParentPhone && normalizePhoneDigits(existing.parentPhone) !== normalizePhoneDigits(fParentPhone))
        updateData.parentPhone = fParentPhone;

    return updateData;
}

/** 영어 수업 자동 배정 (기타항목1에 E 포함 시) */
async function tryAutoEnrollEnglish(studentId, meStudent, englishClasses, startDate) {
    const cf1 = (meStudent.customField1 || "").toUpperCase();
    if (!cf1.includes("E") || !meStudent.className) return null;
    if (englishClasses.length === 0) return "영어 수업이 등록되어 있지 않습니다";

    // 이미 영어 배정되어 있으면 스킵
    const enrollSnap = await db.collection("students").doc(studentId).collection("enrollments").get();
    const hasEnglish = enrollSnap.docs.some(d => {
        const data = d.data();
        return data.subject === "english" && !data.endDate;
    });
    if (hasEnglish) return null;

    const matchByLevel = (name) => {
        const parsed = parseEngClassName(name);
        if (!parsed || !ENGLISH_LEVELS.includes(parsed.levelAbbr.toUpperCase())) return null;
        let found = englishClasses.find(c => c.className === name);
        if (found) return found;
        found = englishClasses.find(c => {
            const p = parseEngClassName(c.className);
            return p && p.levelAbbr.toUpperCase() === parsed.levelAbbr.toUpperCase() && p.number === parsed.number;
        });
        return found || null;
    };

    let matched = englishClasses.find(c => c.className === meStudent.className);
    if (!matched) matched = matchByLevel(meStudent.className);
    // _raw에서 영어 패턴 탐색
    if (!matched && meStudent._raw) {
        for (const val of Object.values(meStudent._raw)) {
            if (!val || val === meStudent.className) continue;
            matched = matchByLevel(val.trim());
            if (matched) break;
        }
    }
    // 부분 문자열 매칭
    if (!matched) {
        matched = englishClasses.find(c =>
            c.className && meStudent.className &&
            (c.className.includes(meStudent.className) || meStudent.className.includes(c.className))
        );
    }

    if (!matched) return `영어 수업 '${meStudent.className}' 매칭 실패`;

    const enrollDate = formatDateValue(meStudent.registrationDate) || startDate || getTodayKST();
    const enrollmentId = matched.id;
    await db.collection(`students/${studentId}/enrollments`).doc(enrollmentId).set({
        classId: matched.id,
        subject: "english",
        className: matched.className,
        staffId: matched.teacher || "",
        teacher: matched.teacher || "",
        schedule: matched.schedule || [],
        days: [],
        period: null, room: null,
        startDate: enrollDate, endDate: null, color: null,
        isSlotTeacher: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return null; // 성공
}

/** 동기화 결과 로그 저장 */
async function saveSyncLog(results, syncStart) {
    try {
        const duration = Date.now() - syncStart;
        await db.collection("makeEduSyncLogs").add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            durationMs: duration,
            totalScraped: results.total,
            registeredCount: results.registered.length,
            updatedCount: results.updated.length,
            errorCount: results.errors.length,
            skippedCount: results.skipped,
            registered: results.registered.slice(0, 50), // 최대 50명까지 로그
            updated: results.updated.slice(0, 50),
            errors: results.errors.slice(0, 20),
        });
        logger.info("[scheduledMakeEduSync] Sync log saved. Duration:", duration, "ms");
    } catch (logErr) {
        logger.error("[scheduledMakeEduSync] Failed to save sync log:", logErr.message);
    }
}

/** 고등수학관 동기화 결과 로그 저장 */
async function saveGodeungSyncLog(results, syncStart) {
    try {
        const duration = Date.now() - syncStart;
        await db.collection("makeEduGodeungSyncLogs").add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            durationMs: duration,
            totalScraped: results.total,
            registeredCount: results.registered.length,
            updatedCount: results.updated.length,
            errorCount: results.errors.length,
            skippedCount: results.skipped,
            registered: results.registered.slice(0, 50),
            updated: results.updated.slice(0, 50),
            errors: results.errors.slice(0, 20),
        });
        logger.info("[scheduledMakeEduGodeungSync] Sync log saved. Duration:", duration, "ms");
    } catch (logErr) {
        logger.error("[scheduledMakeEduGodeungSync] Failed to save sync log:", logErr.message);
    }
}

/**
 * 고등수학관 MakeEdu 자동 동기화 (1시간마다)
 * scheduledMakeEduSync와 동일 로직, 차이점:
 * - 고등수학관 전용 MakeEdu 크리덴셜 사용
 * - campus === 'godeung' 학생만 매칭 대상
 * - 신규 학생: campus='godeung', 문서 ID에 'gd_' 프리픽스
 * - 로그: makeEduGodeungSyncLogs 컬렉션
 */
exports.scheduledMakeEduGodeungSync = functions
    .region("asia-northeast3")
    .runWith({ timeoutSeconds: 540, memory: "512MB" })
    .pubsub.schedule("every 60 minutes")
    .timeZone("Asia/Seoul")
    .onRun(async (context) => {
        logger.info("[scheduledMakeEduGodeungSync] Start");
        const syncStart = Date.now();
        const results = { registered: [], updated: [], errors: [], skipped: 0, total: 0 };

        try {
            // 0. 고등수학관 크리덴셜 확인
            const gdUser = process.env.MAKEEDU_GD_USERNAME;
            const gdPwd = process.env.MAKEEDU_GD_PASSWORD;
            if (!gdUser || !gdPwd) {
                logger.warn("[scheduledMakeEduGodeungSync] Godeung credentials not set, skipping.");
                return null;
            }

            // 1. 고등수학관 MakeEdu 스크래핑
            const { students } = await scrapeMakeEduStudentsInternal(gdUser, gdPwd);
            results.total = students.length;
            logger.info("[scheduledMakeEduGodeungSync] Scraped students:", students.length);

            if (students.length === 0) {
                logger.info("[scheduledMakeEduGodeungSync] No students found, skipping.");
                await saveGodeungSyncLog(results, syncStart);
                return null;
            }

            // 2. 기존 고등수학관 학생만 조회 (campus === 'godeung')
            const studentsSnap = await db.collection("students").get();
            const ijwNameMap = new Map();
            const ijwCodeMap = new Map();
            const usedAttNums = new Set();
            studentsSnap.forEach(d => {
                const s = d.data();
                if (s.attendanceNumber) usedAttNums.add(s.attendanceNumber);
                // 고등수학관 학생만 매칭 대상
                if (s.campus !== "godeung") return;
                if (s.name) ijwNameMap.set(s.name.trim(), { id: d.id, ...s });
                if (s.studentCode && s.studentCode.trim() !== "") {
                    ijwCodeMap.set(s.studentCode.trim(), { id: d.id, ...s });
                }
            });
            logger.info("[scheduledMakeEduGodeungSync] Existing godeung students:", ijwNameMap.size, "with studentCode:", ijwCodeMap.size);

            // 3. 영어 클래스 목록 (자동 배정용)
            const classesSnap = await db.collection("classes").get();
            const englishClasses = [];
            classesSnap.forEach(d => {
                const c = d.data();
                if (c.subject === "english") englishClasses.push({ id: d.id, ...c });
            });

            // 4. 각 학생 비교 및 처리
            for (const meStudent of students) {
                const name = (meStudent.name || "").trim();
                if (!name) { results.skipped++; continue; }

                try {
                    const makeEduNo = meStudent.makeEduNo?.trim();
                    let existing = null;
                    let matchedByCode = false;

                    if (makeEduNo && makeEduNo !== "") {
                        existing = ijwCodeMap.get(makeEduNo);
                        if (existing) {
                            matchedByCode = true;
                            logger.info(`[scheduledMakeEduGodeungSync] Matched by studentCode: ${name} (code: ${makeEduNo})`);
                        }
                    }

                    if (!existing) {
                        existing = ijwNameMap.get(name);
                        if (existing) {
                            logger.info(`[scheduledMakeEduGodeungSync] Matched by name: ${name}`);
                        }
                    }

                    if (existing) {
                        // === 기존 학생: 필드 업데이트 ===
                        const updateData = buildUpdateData(existing, meStudent);
                        if (Object.keys(updateData).length > 0) {
                            updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
                            updateData.makeEduSync = true;
                            await db.collection("students").doc(existing.id).update(updateData);

                            const enrollNote = await tryAutoEnrollEnglish(existing.id, meStudent, englishClasses, existing.startDate);
                            results.updated.push({
                                name, fields: Object.keys(updateData).filter(k => k !== "updatedAt" && k !== "makeEduSync"),
                                enrollNote: enrollNote || undefined,
                            });
                        } else {
                            const enrollNote = await tryAutoEnrollEnglish(existing.id, meStudent, englishClasses, existing.startDate);
                            if (enrollNote) {
                                results.updated.push({ name, fields: [], enrollNote });
                            } else {
                                results.skipped++;
                            }
                        }
                    } else {
                        // === 신규 학생: 자동 등록 (gd_ 프리픽스 + campus='godeung') ===
                        const normalizedSchool = normalizeSchoolName(meStudent.school);
                        const grade = normalizeGradeValue(meStudent.grade, meStudent.school);
                        const gender = meStudent.gender === "남" ? "male" : meStudent.gender === "여" ? "female" : null;
                        const startDate = formatDateValue(meStudent.registrationDate) || getTodayKST();

                        const baseId = `gd_${name}_${normalizedSchool || "Unspecified"}_${grade || "Unspecified"}`;
                        let studentId = baseId;
                        let counter = 1;
                        while ((await db.collection("students").doc(studentId).get()).exists) {
                            counter++;
                            studentId = `${baseId}_${counter}`;
                            if (counter > 100) throw new Error("동일한 학생 정보가 너무 많습니다.");
                        }

                        let attendanceNumber = meStudent.attendanceNumber;
                        if (!attendanceNumber || usedAttNums.has(attendanceNumber)) {
                            attendanceNumber = generateAttNum(meStudent.parentPhone || meStudent.phone, usedAttNums);
                        }
                        usedAttNums.add(attendanceNumber);
                        const studentCode = meStudent.makeEduNo || null;

                        const formattedStudentPhone = formatPhoneNumber(meStudent.phone);
                        const formattedParentPhone = formatPhoneNumber(meStudent.parentPhone);

                        await db.collection("students").doc(studentId).set({
                            name, englishName: null, gender,
                            campus: "godeung",
                            school: normalizedSchool || null, grade: grade || null, graduationYear: null,
                            attendanceNumber, studentCode,
                            studentPhone: formattedStudentPhone || null,
                            homePhone: null,
                            parentPhone: formattedParentPhone || null,
                            parentName: meStudent.parentName || null, parentRelation: "모",
                            zipCode: null, address: meStudent.address || null,
                            addressDetail: meStudent.addressDetail || null,
                            birthDate: meStudent.birthDate || null, nickname: null,
                            startDate, enrollmentReason: null,
                            memo: meStudent.memo || null,
                            customField1: meStudent.customField1 || null,
                            customField2: meStudent.customField2 || null,
                            status: "active",
                            enrollmentDate: admin.firestore.FieldValue.serverTimestamp(),
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            smsNotification: true, pushNotification: false, kakaoNotification: true,
                            billingSmsPrimary: true, billingSmsOther: false,
                            overdueSmsPrimary: true, overdueSmsOther: false,
                            makeEduSync: true,
                        });

                        const enrollNote = await tryAutoEnrollEnglish(studentId, meStudent, englishClasses, startDate);
                        ijwNameMap.set(name, { id: studentId });
                        results.registered.push({ name, studentId, enrollNote: enrollNote || undefined });
                    }
                } catch (studentErr) {
                    logger.error("[scheduledMakeEduGodeungSync] Error processing:", name, studentErr.message);
                    results.errors.push({ name, error: studentErr.message });
                }
            }

            logger.info("[scheduledMakeEduGodeungSync] Done.",
                "Registered:", results.registered.length,
                "Updated:", results.updated.length,
                "Errors:", results.errors.length,
                "Skipped:", results.skipped);

            await saveGodeungSyncLog(results, syncStart);
            return null;
        } catch (error) {
            logger.error("[scheduledMakeEduGodeungSync] Fatal error:", error);
            results.errors.push({ name: "_fatal", error: error.message });
            await saveGodeungSyncLog(results, syncStart);
            return null;
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

                    // 호칭 설정 (관리자) - 모달 감지 개선 + 다중 클릭 전략
                    logger.info(`[${studentName}] 호칭 설정 중...`);
                    await delay(3000);

                    // 호칭 모달 처리 (최대 5번 시도)
                    let hoChingHandled = false;
                    for (let hoChingAttempt = 0; hoChingAttempt < 5; hoChingAttempt++) {
                        const hoChingResult = await page.evaluate(() => {
                            const bodyText = document.body?.innerText || '';
                            // 모달 특정 텍스트로 감지 (사이드바 "호칭 설정해 주세요"와 구분)
                            const hasRealModal = bodyText.includes('해당 호칭을 기본 호칭으로 저장') ||
                                bodyText.includes('호칭을 선택해') ||
                                bodyText.includes('호칭 선택');

                            // 모달 오버레이/다이얼로그 DOM 요소 체크
                            const modalEl = document.querySelector('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="overlay"][class*="Overlay"], [class*="popup"], [class*="Popup"]');
                            const hasModalDom = modalEl && modalEl.offsetParent !== null;

                            if (!hasRealModal && !hasModalDom) {
                                return { status: 'no-modal' };
                            }

                            // 라디오 버튼 찾기 (다양한 방법)
                            let radios = Array.from(document.querySelectorAll('input[type="radio"]'));

                            // 커스텀 라디오 요소 (role="radio")
                            if (radios.length === 0) {
                                radios = Array.from(document.querySelectorAll('[role="radio"]'));
                            }

                            // 호칭 옵션 텍스트가 포함된 클릭 가능 요소 (label, li, div 등)
                            if (radios.length === 0) {
                                const scope = modalEl || document;
                                const clickables = Array.from(scope.querySelectorAll('label, li, div, span, button'));
                                const hoChingKeywords = ['관리자', '선생님', '원장님', '원장', '선생'];
                                radios = clickables.filter(el => {
                                    if (el.offsetParent === null) return false;
                                    if (el.children.length > 3) return false; // 너무 큰 컨테이너 제외
                                    const text = (el.textContent || '').trim();
                                    return hoChingKeywords.some(kw => text === kw || text.startsWith(kw));
                                });
                            }

                            if (radios.length === 0) {
                                // 디버그: 모달 내 모든 텍스트 출력
                                const modalText = modalEl ? modalEl.innerText.substring(0, 500) : '';
                                return { status: 'modal-no-radios', modalText, hasRealModal, hasModalDom: !!hasModalDom };
                            }

                            // "관리자" 라디오 선택
                            let selected = null;
                            for (const radio of radios) {
                                const labelEl = radio.id ? document.querySelector('label[for="' + radio.id + '"]') : null;
                                const allText = ((labelEl ? labelEl.textContent : '') + ' ' + (radio.textContent || '') + ' ' + (radio.parentElement?.textContent || '')).trim();
                                if (allText.includes('관리자')) {
                                    radio.click();
                                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                                    radio.dispatchEvent(new Event('input', { bubbles: true }));
                                    selected = '관리자';
                                    break;
                                }
                            }
                            if (!selected && radios.length > 0) {
                                radios[0].click();
                                radios[0].dispatchEvent(new Event('change', { bubbles: true }));
                                radios[0].dispatchEvent(new Event('input', { bubbles: true }));
                                selected = '첫번째: ' + (radios[0].textContent || '').trim().substring(0, 20);
                            }

                            // "기본 호칭으로 저장" 체크박스 체크
                            const scope2 = modalEl || document;
                            const checkboxes = scope2.querySelectorAll('input[type="checkbox"]');
                            let checkedSave = false;
                            checkboxes.forEach(cb => {
                                const parent = cb.closest('label') || cb.parentElement;
                                const text = (parent ? parent.textContent : '') + (cb.nextSibling?.textContent || '');
                                if (text.includes('호칭') || text.includes('저장') || text.includes('기본')) {
                                    if (!cb.checked) {
                                        cb.click();
                                        cb.dispatchEvent(new Event('change', { bubbles: true }));
                                        checkedSave = true;
                                    } else {
                                        checkedSave = true; // 이미 체크됨
                                    }
                                }
                            });
                            // 체크박스를 못 찾았으면 모든 체크박스 체크
                            if (!checkedSave && checkboxes.length > 0) {
                                checkboxes.forEach(cb => {
                                    if (!cb.checked) {
                                        cb.click();
                                        cb.dispatchEvent(new Event('change', { bubbles: true }));
                                    }
                                });
                            }

                            return { status: 'modal-found', selected, radioCount: radios.length, checkedSave };
                        });
                        logger.info(`[${studentName}] 호칭 시도 ${hoChingAttempt + 1}: ${JSON.stringify(hoChingResult)}`);

                        if (hoChingResult.status === 'no-modal') {
                            logger.info(`[${studentName}] 호칭 모달 없음, 진행`);
                            hoChingHandled = true;
                            break;
                        }

                        if (hoChingResult.status === 'modal-no-radios') {
                            logger.warn(`[${studentName}] 호칭 모달 감지됨, 라디오 없음: ${JSON.stringify(hoChingResult)}`);
                            // 라디오 없이도 확인 버튼 클릭 시도 (기본 선택이 있을 수 있음)
                        }

                        // 확인 버튼 클릭 - 방법1: 모달 컨텍스트 내 JS 클릭
                        await delay(500);
                        const confirmResult = await page.evaluate(() => {
                            // 모달 컨테이너 찾기
                            const modals = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="overlay"][class*="Overlay"], [class*="popup"], [class*="Popup"]');
                            let targetButtons = [];
                            modals.forEach(m => {
                                targetButtons.push(...Array.from(m.querySelectorAll('button')).filter(b => b.offsetParent !== null));
                            });

                            // 모달 내 버튼 없으면 전체에서 검색
                            if (targetButtons.length === 0) {
                                targetButtons = Array.from(document.querySelectorAll('button')).filter(btn => btn.offsetParent !== null);
                            }

                            const confirmBtn = targetButtons.find(btn => {
                                const t = (btn.textContent || '').trim();
                                return t === '확인' || t === 'OK' || t === '저장';
                            });
                            if (confirmBtn) {
                                const btnText = (confirmBtn.textContent || '').trim();
                                confirmBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                                confirmBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                                confirmBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                return 'js-clicked: ' + btnText;
                            }
                            // 버튼 목록 반환 (디버그)
                            return 'not-found, buttons: ' + targetButtons.map(b => (b.textContent || '').trim().substring(0, 20)).join(', ');
                        });
                        logger.info(`[${studentName}] 호칭 확인 클릭 결과: ${confirmResult}`);

                        // 방법2: Puppeteer 네이티브 click 시도
                        if (confirmResult.startsWith('not-found')) {
                            try {
                                const confirmHandle = await page.evaluateHandle(() => {
                                    const btns = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null);
                                    return btns.find(b => {
                                        const t = (b.textContent || '').trim();
                                        return t === '확인' || t === 'OK';
                                    }) || null;
                                });
                                if (confirmHandle && confirmHandle.asElement()) {
                                    await confirmHandle.asElement().click();
                                    logger.info(`[${studentName}] 호칭 확인 Puppeteer native click 성공`);
                                }
                            } catch (e) {
                                logger.warn(`[${studentName}] 호칭 확인 Puppeteer click 실패: ${e.message}`);
                            }
                        }

                        await delay(2000);

                        // 모달 닫힘 확인
                        const stillOpen = await page.evaluate(() => {
                            const bodyText = document.body?.innerText || '';
                            return bodyText.includes('해당 호칭을 기본 호칭으로 저장') || bodyText.includes('호칭을 선택해');
                        });
                        if (!stillOpen) {
                            logger.info(`[${studentName}] 호칭 모달 닫힘 확인!`);
                            hoChingHandled = true;
                            break;
                        }

                        logger.warn(`[${studentName}] 호칭 모달 아직 열림, 재시도... (${hoChingAttempt + 1}/5)`);

                        // 3번째부터 Puppeteer native click 재시도 (라디오 + 확인)
                        if (hoChingAttempt >= 2) {
                            try {
                                // 페이지 내 모든 라디오 요소에 Puppeteer click
                                const radioHandles = await page.$$('input[type="radio"]');
                                if (radioHandles.length > 0) {
                                    await radioHandles[0].click();
                                    logger.info(`[${studentName}] 라디오 Puppeteer click (${radioHandles.length}개 중 첫번째)`);
                                    await delay(300);
                                }
                                // 확인 버튼 Puppeteer click
                                const allBtnHandles = await page.$$('button');
                                for (const bh of allBtnHandles) {
                                    const txt = await bh.evaluate(el => (el.textContent || '').trim());
                                    if (txt === '확인' || txt === 'OK') {
                                        await bh.click();
                                        logger.info(`[${studentName}] 확인 버튼 Puppeteer click (시도 ${hoChingAttempt + 1})`);
                                        break;
                                    }
                                }
                                await delay(2000);
                            } catch (e) {
                                logger.warn(`[${studentName}] Puppeteer 재시도 실패: ${e.message}`);
                            }
                        }
                        await delay(1000);
                    }

                    // 호칭 모달 최종 처리: 안 닫히면 페이지 재로드 후 재시도
                    if (!hoChingHandled) {
                        logger.warn(`[${studentName}] 호칭 모달 5번 시도 실패, 페이지 재로드...`);
                        await page.keyboard.press('Escape');
                        await delay(500);
                        // 페이지 재로드로 호칭 모달 다시 트리거
                        await page.goto('https://www.classnote.com/service/report/add', {
                            waitUntil: 'domcontentloaded',
                            timeout: 30000
                        });
                        await delay(3000);

                        // 재로드 후 호칭 모달 한번 더 처리 시도
                        const retryResult = await page.evaluate(() => {
                            const bodyText = document.body?.innerText || '';
                            if (!bodyText.includes('해당 호칭을 기본 호칭으로 저장')) {
                                return 'no-modal';
                            }
                            // 라디오 찾아서 클릭
                            const radios = Array.from(document.querySelectorAll('input[type="radio"], [role="radio"]'));
                            if (radios.length > 0) {
                                radios[0].click();
                                radios[0].dispatchEvent(new Event('change', { bubbles: true }));
                            }
                            // 체크박스 체크
                            const cbs = document.querySelectorAll('input[type="checkbox"]');
                            cbs.forEach(cb => { if (!cb.checked) { cb.click(); cb.dispatchEvent(new Event('change', { bubbles: true })); } });
                            return 'retry-selected';
                        });
                        logger.info(`[${studentName}] 호칭 재로드 후 결과: ${retryResult}`);

                        if (retryResult === 'retry-selected') {
                            await delay(500);
                            // Puppeteer native click으로 확인
                            const allBtns = await page.$$('button');
                            for (const bh of allBtns) {
                                const txt = await bh.evaluate(el => (el.textContent || '').trim());
                                if (txt === '확인' || txt === 'OK') {
                                    await bh.click();
                                    logger.info(`[${studentName}] 호칭 재로드 후 확인 Puppeteer click`);
                                    break;
                                }
                            }
                            await delay(2000);
                        }

                        // 최종 확인
                        const finalCheck = await page.evaluate(() => {
                            return (document.body?.innerText || '').includes('해당 호칭을 기본 호칭으로 저장');
                        });
                        if (finalCheck) {
                            logger.error(`[${studentName}] 호칭 설정 최종 실패. ClassNote에서 직접 호칭을 설정해주세요.`);
                            throw new Error('호칭 설정 실패: 모달을 닫을 수 없습니다. ClassNote에서 직접 호칭을 설정해주세요.');
                        }
                    }
                    await delay(1000);

                    // 날짜 선택 (견고한 셀렉터 전략 - CSS 클래스 + 텍스트 패턴 + data-testid)
                    logger.info(`[${studentName}] 날짜 선택 중: ${reportDate}`);
                    const dateParts = reportDate.split("T")[0].split('-');
                    const year = parseInt(dateParts[0]);
                    const month = parseInt(dateParts[1]);
                    const day = parseInt(dateParts[2]);

                    // Step 1: 날짜 버튼 찾기 (다중 전략)
                    const dateButton = await page.evaluateHandle(() => {
                        // 전략 1: 기존 CSS 클래스
                        const cssBtn = document.querySelector('button.e1a4g8se4');
                        if (cssBtn) return cssBtn;
                        // 전략 2: data-testid
                        const testIdBtn = document.querySelector("button[data-testid*='date'], button[data-testid*='calendar']");
                        if (testIdBtn) return testIdBtn;
                        // 전략 3: 날짜 텍스트 패턴이 있는 버튼
                        const buttons = Array.from(document.querySelectorAll('button'));
                        for (const btn of buttons) {
                            if (btn.offsetParent === null) continue;
                            const text = (btn.textContent || '').trim();
                            if (/\d{4}[.\-]\d{1,2}[.\-]\d{1,2}/.test(text) ||
                                /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/.test(text)) {
                                return btn;
                            }
                        }
                        // 전략 4: "수업일" 라벨 근처 버튼
                        const allEls = document.querySelectorAll('label, span, div, p');
                        for (const el of allEls) {
                            if ((el.textContent || '').includes('수업일')) {
                                const nearBtn = el.parentElement?.querySelector('button') ||
                                                el.closest('div')?.querySelector('button');
                                if (nearBtn) return nearBtn;
                            }
                        }
                        return null;
                    });

                    const dateEl = dateButton && (dateButton.asElement ? dateButton.asElement() : dateButton);
                    if (!dateEl) {
                        logger.warn(`[${studentName}] 날짜 버튼을 찾을 수 없음, 기본 날짜 사용`);
                    } else {
                        await page.evaluate(el => el.click(), dateEl);
                        await delay(1000);

                        // Step 2: 년/월 탐색 (숫자 비교로 zero-padding 문제 방지)
                        const maxAttempts = 24;

                        for (let attempt = 0; attempt < maxAttempts; attempt++) {
                            const currentYearMonth = await page.evaluate(() => {
                                // 전략 1: 기존 CSS 클래스
                                const el1 = document.querySelector('div.css-7vdbjr.e1a4g8se9');
                                if (el1) return el1.textContent.trim();
                                // 전략 2: "YYYY년 MM월" 패턴 매칭
                                const candidates = document.querySelectorAll('div, span, h2, h3, strong');
                                for (const el of candidates) {
                                    const t = (el.textContent || '').trim();
                                    if (/^\d{4}년\s*\d{1,2}월$/.test(t)) return t;
                                }
                                return null;
                            });

                            if (!currentYearMonth) {
                                logger.warn(`[${studentName}] 캘린더 년/월 표시를 찾을 수 없음`);
                                break;
                            }

                            // 숫자 비교 (zero-padding "03월" vs "3월" 차이 무시)
                            const cm = currentYearMonth.match(/(\d{4})년\s*(\d{1,2})월/);
                            if (cm && parseInt(cm[1]) === year && parseInt(cm[2]) === month) {
                                logger.info(`[${studentName}] 캘린더 도달: ${currentYearMonth}`);
                                break;
                            }

                            // 방향 결정: 앞으로 or 뒤로
                            if (!cm) break;
                            const currentTotal = parseInt(cm[1]) * 12 + parseInt(cm[2]);
                            const targetTotal = year * 12 + month;
                            const goForward = targetTotal > currentTotal;
                            logger.info(`[${studentName}] 달력 현재: "${currentYearMonth}", 목표: ${year}년 ${month}월, 방향: ${goForward ? '→' : '←'}`);

                            const navBtn = await page.evaluateHandle((forward) => {
                                // 전략 1: 기존 CSS 클래스
                                const knownBtns = Array.from(document.querySelectorAll('button')).filter(b => {
                                    const cn = b.className || '';
                                    return cn.includes('e1a4g8se10') || cn.includes('e1a4g8se11');
                                });
                                if (knownBtns.length >= 2) {
                                    return forward ? knownBtns[knownBtns.length - 1] : knownBtns[0];
                                }
                                if (knownBtns.length === 1) return knownBtns[0];
                                // 전략 2: aria-label
                                const ariaBtn = document.querySelector(
                                    forward
                                        ? 'button[aria-label*="next"], button[aria-label*="다음"]'
                                        : 'button[aria-label*="prev"], button[aria-label*="이전"]'
                                );
                                if (ariaBtn) return ariaBtn;
                                // 전략 3: SVG 화살표 버튼 위치
                                const arrowBtns = Array.from(document.querySelectorAll('button')).filter(btn => {
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

                            const navEl = navBtn && (navBtn.asElement ? navBtn.asElement() : navBtn);
                            if (navEl) {
                                await page.evaluate(el => el.click(), navEl);
                                await delay(500);
                            } else {
                                logger.warn(`[${studentName}] 캘린더 ${goForward ? '다음' : '이전'}월 버튼을 찾을 수 없음`);
                                break;
                            }
                        }

                        // Step 3: 날짜 클릭
                        const dateClicked = await page.evaluate((targetDay) => {
                            // <a> 태그 우선 (기존 ClassNote 구조)
                            const dateLinks = Array.from(document.querySelectorAll('a'));
                            for (const link of dateLinks) {
                                if (link.textContent.trim() === String(targetDay)) {
                                    link.click();
                                    return true;
                                }
                            }
                            // 폴백: td, button, span 등
                            const cells = Array.from(document.querySelectorAll('td, button, span'));
                            for (const cell of cells) {
                                if (cell.textContent.trim() === String(targetDay) && cell.children.length === 0) {
                                    cell.click();
                                    return true;
                                }
                            }
                            return false;
                        }, day);

                        if (dateClicked) {
                            logger.info(`[${studentName}] 날짜 ${day}일 클릭 완료`);
                            await delay(1000);
                            const confirmBtn = await page.evaluateHandle(() => {
                                const buttons = Array.from(document.querySelectorAll('button'));
                                for (const btn of buttons) {
                                    if (btn.offsetParent === null) continue;
                                    const text = (btn.textContent || '').trim();
                                    if (text.includes('확인') || text === 'OK' || text === '선택') {
                                        return btn;
                                    }
                                }
                                return null;
                            });

                            const confirmEl = confirmBtn && (confirmBtn.asElement ? confirmBtn.asElement() : confirmBtn);
                            if (confirmEl) {
                                await page.evaluate(el => el.click(), confirmEl);
                                logger.info(`[${studentName}] 날짜 확인 클릭`);
                                await delay(1000);
                            }
                        } else {
                            logger.warn(`[${studentName}] 캘린더에서 ${day}일을 클릭할 수 없음`);
                        }
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

/**
 * MakeEdu 전체 학생 목록에서 기타수납 컬럼을 스크래핑하여
 * "셔틀버스비"가 포함된 학생을 shuttle_students 컬렉션에 저장
 */
async function scrapeMakeEduShuttleStudentsInternal() {
    const userId = process.env.MAKEEDU_USERNAME;
    const userPwd = process.env.MAKEEDU_PASSWORD;
    if (!userId || !userPwd) {
        throw new Error("MakeEdu 로그인 정보가 .env에 설정되지 않았습니다.");
    }

    const baseUrl = "https://school.makeedu.co.kr";
    const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

    // 1. 세션 쿠키 획득
    logger.info("[scrapeMakeEduShuttle] Getting session...");
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

    // 2. 로그인
    logger.info("[scrapeMakeEduShuttle] Logging in...");
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
    const loginSetCookies = loginRes.headers.getSetCookie?.() || [];
    for (const h of loginSetCookies) {
        const cookie = h.split(";")[0];
        if (cookie) sessionCookies.push(cookie);
    }
    cookieStr = sessionCookies.join("; ");
    const loginBody = await loginRes.text();

    const loginOk = loginBody.includes("OK") || loginRes.status === 302 || loginRes.status === 200;
    if (!loginOk && sessionCookies.length === 0) {
        throw new functions.https.HttpsError("unauthenticated",
            `MakeEdu 로그인 실패 (status: ${loginRes.status})`);
    }

    // 3. 메인 페이지에서 학생 관련 URL 탐색
    logger.info("[scrapeMakeEduShuttle] Fetching main page for URL discovery...");
    const mainRes = await fetch(`${baseUrl}/main.do`, {
        headers: { "Cookie": cookieStr, "User-Agent": UA },
    });
    const mainHtml = await mainRes.text();
    const $main = cheerio.load(mainHtml);

    const candidateUrls = [];
    $main("a[href]").each((_, a) => {
        const href = $main(a).attr("href") || "";
        const text = $main(a).text().trim();
        if (href.includes("student") || href.includes("member") ||
            href.includes("consult") || href.includes("pupil") ||
            text.includes("원생") || text.includes("학생") || text.includes("등록")) {
            const fullUrl = href.startsWith("http") ? href : `${baseUrl}${href.startsWith("/") ? "" : "/"}${href}`;
            candidateUrls.push({ url: fullUrl, text, href });
        }
    });
    $main("[onclick]").each((_, el) => {
        const onclick = $main(el).attr("onclick") || "";
        const text = $main(el).text().trim();
        const urlMatch = onclick.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
        const urlMatch2 = onclick.match(/['"](\/?[a-zA-Z]+\/[a-zA-Z]+\.do[^'"]*)['"]/);
        const matched = urlMatch?.[1] || urlMatch2?.[1];
        if (matched && (matched.includes("student") || matched.includes("member") ||
            text.includes("원생") || text.includes("학생"))) {
            const fullUrl = matched.startsWith("http") ? matched : `${baseUrl}${matched.startsWith("/") ? "" : "/"}${matched}`;
            candidateUrls.push({ url: fullUrl, text, href: matched });
        }
    });

    // 4. 학생 목록 페이지 찾기
    const urlsToTry = [
        ...candidateUrls.map(c => c.url),
        `${baseUrl}/student/studentList.do`,
        `${baseUrl}/student/studentMng.do`,
        `${baseUrl}/student/studentManage.do`,
        `${baseUrl}/student/studentInfo.do`,
        `${baseUrl}/student/studentRegist.do`,
        `${baseUrl}/member/memberList.do`,
    ];
    const uniqueUrls = [...new Set(urlsToTry)];

    let html = "";
    let studentPageUrl = "";
    for (const url of uniqueUrls) {
        try {
            const res = await fetch(url, {
                headers: { "Cookie": cookieStr, "User-Agent": UA, "Referer": `${baseUrl}/main.do` },
                redirect: "follow",
            });
            if (res.ok) {
                const body = await res.text();
                const $check = cheerio.load(body);
                const hasTable = $check("table").length > 0;
                const hasStudentContent = body.includes("원생") || body.includes("학생") ||
                    body.includes("이름") || body.includes("성명");
                if (hasTable && hasStudentContent) {
                    html = body;
                    studentPageUrl = url;
                    logger.info("[scrapeMakeEduShuttle] Found student page at:", url);
                    break;
                }
            }
        } catch (urlErr) {
            logger.info("[scrapeMakeEduShuttle] URL error:", url, urlErr.message);
        }
    }

    if (!studentPageUrl) {
        throw new functions.https.HttpsError("internal",
            `학생 페이지를 찾을 수 없습니다. 시도한 URL 수: ${uniqueUrls.length}`);
    }

    // 5. 전체 학생 조회 (신규원생 필터 없이)
    const $page = cheerio.load(html);
    const formParams = {};

    // select 요소에서 listSize 찾기
    $page("select").each((_, sel) => {
        const selName = $page(sel).attr("name") || "";
        const selId = $page(sel).attr("id") || "";
        const options = [];
        $page(sel).find("option").each((__, opt) => {
            options.push({ value: $page(opt).attr("value") || "", text: $page(opt).text().trim() });
        });

        // listSize select를 찾아서 500으로 설정
        if (selName === "listSize" || selId === "listSize") {
            const opt500 = options.find(o => o.value === "500");
            if (opt500) {
                formParams[selName] = "500";
                logger.info(`[scrapeMakeEduShuttle] Set listSize to 500 (페이지당 500개)`);
            }
        }
    });

    const formInputs = {};
    $page("form").first().find("input[type='hidden'], input[name]").each((_, inp) => {
        const name = $page(inp).attr("name") || "";
        const val = $page(inp).attr("value") || "";
        if (name) formInputs[name] = val;
    });

    const postParams = new URLSearchParams();
    // listSize 파라미터 적용
    for (const [k, v] of Object.entries(formParams)) {
        postParams.set(k, v);
    }
    postParams.set("srchType", "A");
    // 신규원생 필터(srchNewStat) 없이 전체 조회

    logger.info("[scrapeMakeEduShuttle] POST body:", postParams.toString());

    const searchRes = await fetch(studentPageUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": cookieStr,
            "User-Agent": UA,
            "Referer": studentPageUrl,
        },
        body: postParams.toString(),
    });
    let searchHtml = await searchRes.text();
    logger.info("[scrapeMakeEduShuttle] Search result length:", searchHtml.length);

    const $ = cheerio.load(searchHtml);
    let tableRows = $("table tbody tr");
    if (tableRows.length === 0) {
        const $orig = cheerio.load(html);
        tableRows = $orig("table tbody tr");
        if (tableRows.length > 0) searchHtml = html;
    }

    // 6. 헤더 추출
    const $final = cheerio.load(searchHtml);
    const headers = [];
    $final("table thead tr th, table thead tr td").each((_, el) => {
        headers.push($final(el).text().trim());
    });
    if (headers.length === 0) {
        $final("table tr").first().find("th").each((_, el) => {
            headers.push($final(el).text().trim());
        });
    }
    if (headers.length === 0) {
        $final("table tr").first().find("td").each((_, el) => {
            headers.push($final(el).text().trim());
        });
    }
    logger.info("[scrapeMakeEduShuttle] Headers:", JSON.stringify(headers));

    const headerKeywords = new Set(["이름", "성명", "원생명", "학생명", "학교", "학년", "연락처",
        "전화번호", "보호자", "등록일", "입학일", "반", "성별", "주소", "메모", "상태", "번호",
        "출결", "생년월일", "강사", "담당", "비고"]);

    // 7. 컬럼 매핑 — 이름 + 기타수납만 필요
    const findCol = (keywords) => {
        return headers.findIndex(h => keywords.some(k => h.includes(k)));
    };

    const colName = findCol(["이름", "성명", "원생명", "학생명"]);
    // "기타수납"을 먼저 정확히 찾고, 못 찾으면 "기타"로 폴백 (기타항목1/2와 혼동 방지)
    let colEtcBilling = headers.findIndex(h => h === "기타수납");
    if (colEtcBilling < 0) colEtcBilling = headers.findIndex(h => h.includes("기타수납"));
    if (colEtcBilling < 0) colEtcBilling = findCol(["기타"]);

    logger.info("[scrapeMakeEduShuttle] Column mapping:", JSON.stringify({ colName, colEtcBilling }));

    if (colName < 0) {
        throw new functions.https.HttpsError("internal",
            `이름 컬럼을 찾을 수 없습니다. 헤더: ${JSON.stringify(headers)}`);
    }

    // 8. 행 파싱 (페이지네이션)
    const allStudents = [];
    let currentPage = 1;
    const maxPages = 20; // 최대 20페이지 (300 * 20 = 6000명)

    while (currentPage <= maxPages) {
        // 다양한 페이지네이션 파라미터 시도
        postParams.set("pageIndex", currentPage.toString());
        postParams.set("currentPage", currentPage.toString());
        postParams.set("page", currentPage.toString());
        postParams.set("pageNo", currentPage.toString());

        logger.info(`[scrapeMakeEduShuttle] Fetching page ${currentPage}...`);

        const pageRes = await fetch(studentPageUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Cookie": cookieStr,
                "User-Agent": UA,
                "Referer": studentPageUrl,
            },
            body: postParams.toString(),
        });
        const pageHtml = await pageRes.text();
        const $page = cheerio.load(pageHtml);

        const pageStudents = [];
        let dataRows = $page("table tbody tr");
        if (dataRows.length === 0) {
            dataRows = $page("table tr").slice(1);
        }
        dataRows.each((_, row) => {
            if ($page(row).find("th").length > 0) return;

            const cells = [];
            $page(row).find("td").each((__, td) => {
                cells.push($page(td).text().trim());
            });

            if (cells.length < 3) return;

            let headerMatchCount = 0;
            cells.forEach(c => {
                if (headerKeywords.has(c) || headers.includes(c)) headerMatchCount++;
            });
            if (headerMatchCount >= 3) return;

            const name = colName >= 0 ? cells[colName] : "";
            if (!name) return;

            const etcBilling = colEtcBilling >= 0 ? (cells[colEtcBilling] || "") : "";
            const isShuttle = etcBilling.includes("셔틀버스비") || etcBilling.includes("셔틀") ||
                              etcBilling.includes("스쿨버스비") || etcBilling.includes("스쿨버스");

            pageStudents.push({ name, etcBilling, isShuttle });
        });

        logger.info(`[scrapeMakeEduShuttle] Page ${currentPage}: Found ${pageStudents.length} students`);

        // Add page students to total
        allStudents.push(...pageStudents);

        // Break if no more students on this page
        if (pageStudents.length === 0) {
            logger.info(`[scrapeMakeEduShuttle] No more students found. Stopping at page ${currentPage}`);
            break;
        }

        currentPage++;
    }

    const students = allStudents;
    logger.info("[scrapeMakeEduShuttle] Total parsed students:", students.length);

    // 디버그: 기타수납 컬럼에 값이 있는 학생들 로깅
    const studentsWithEtc = students.filter(s => s.etcBilling && s.etcBilling.trim() !== "");
    logger.info("[scrapeMakeEduShuttle] Students with etcBilling:", studentsWithEtc.length,
        "samples:", JSON.stringify(studentsWithEtc.slice(0, 20).map(s => ({ name: s.name, etcBilling: s.etcBilling }))));

    const shuttleStudents = students.filter(s => s.isShuttle);
    logger.info("[scrapeMakeEduShuttle] Shuttle students:", shuttleStudents.length);

    // 9. Firestore shuttle_students 컬렉션 업데이트 (batch)
    const now = new Date().toISOString();

    // 기존 문서 모두 삭제
    const existingSnap = await db.collection("shuttle_students").get();
    const deleteBatch = db.batch();
    existingSnap.docs.forEach(doc => deleteBatch.delete(doc.ref));
    await deleteBatch.commit();

    // 셔틀 학생만 저장
    if (shuttleStudents.length > 0) {
        // Firestore batch는 500개 제한
        const batchSize = 450;
        for (let i = 0; i < shuttleStudents.length; i += batchSize) {
            const batch = db.batch();
            const chunk = shuttleStudents.slice(i, i + batchSize);
            chunk.forEach(s => {
                const ref = db.collection("shuttle_students").doc();
                batch.set(ref, {
                    name: s.name,
                    isShuttle: true,
                    etcBilling: s.etcBilling,
                    makeEduNo: s.makeEduNo || null,
                    syncedAt: now,
                });
            });
            await batch.commit();
        }
    }

    return {
        totalStudents: students.length,
        shuttleStudents: shuttleStudents.length,
        shuttleNames: shuttleStudents.map(s => s.name),
        headers,
        syncedAt: now,
    };
}

/**
 * MakeEdu 셔틀 학생 동기화 (클라이언트 호출용)
 */
exports.scrapeMakeEduShuttleStudents = functions
    .region("asia-northeast3")
    .runWith({ timeoutSeconds: 300, memory: "512MB" })
    .https.onCall(async (data, context) => {
        logger.info("[scrapeMakeEduShuttleStudents] Start (onCall)");
        try {
            return await scrapeMakeEduShuttleStudentsInternal();
        } catch (error) {
            logger.error("[scrapeMakeEduShuttleStudents] Error:", error);
            if (error.code) throw error;
            throw new functions.https.HttpsError("internal", error.message || "셔틀 학생 크롤링 실패");
        }
    });

// ========================================================================
// 상담 녹음 분석 (AssemblyAI 음성인식 + Claude AI 보고서)
// ========================================================================

/**
 * 상담 녹음 파일을 분석하여 보고서를 생성하는 Cloud Function
 *
 * Flow:
 * 1. Storage에서 Signed URL 생성
 * 2. AssemblyAI로 음성인식 + 화자구분
 * 3. Claude API로 보고서 생성
 * 4. Firestore consultation_reports에 저장
 */

// AssemblyAI word_boost: 학원 상담 도메인 용어 (인식률 향상)
const ACADEMY_WORD_BOOST = [
    // === 학원 운영 ===
    "학원", "원장", "원장님", "부원장", "실장", "팀장",
    "수업", "수강", "수강료", "등원", "하원", "셔틀", "셔틀버스",
    "강의실", "자습실", "상담실", "로비", "데스크",
    "교재", "부교재", "워크북", "프린트", "교구",
    "숙제", "과제", "오답노트", "학습지", "진도",
    "시험", "테스트", "퀴즈", "단원평가", "모의시험",
    "레벨테스트", "레벨", "진단평가", "배치고사", "반배정",
    "등록", "퇴원", "재원", "재등록", "대기", "대기번호",
    "원비", "납부", "수납", "환불", "감면", "할인", "미납",
    "출결", "출석", "결석", "지각", "조퇴", "보강", "휴원", "방학",
    "상담", "학부모상담", "전화상담", "대면상담", "정기상담",
    "공지", "알림", "문자", "카톡", "카카오톡",

    // === 교육 인력 ===
    "선생님", "담임", "담임선생님", "부담임", "강사", "조교",
    "학부모", "어머니", "아버지", "부모님", "보호자",
    "학생", "아이", "자녀", "형", "누나", "동생", "언니", "오빠",

    // === 과목 ===
    "수학", "영어", "국어", "과학", "사회", "한국사",
    "물리", "화학", "생물", "지구과학", "생명과학",
    "영문법", "독해", "리딩", "리스닝", "스피킹", "라이팅", "문법",
    "단어", "어휘", "보카", "파닉스", "회화",
    "연산", "도형", "방정식", "함수", "미적분", "확률", "통계",
    "논술", "서술형", "토론", "발표",
    "코딩", "프로그래밍", "정보", "AI", "인공지능",

    // === 학년/학교 ===
    "유치원", "어린이집", "초등", "중등", "고등",
    "초등학교", "중학교", "고등학교", "대학교",
    "예비초", "예비중", "예비고",
    "1학년", "2학년", "3학년", "4학년", "5학년", "6학년",
    "초1", "초2", "초3", "초4", "초5", "초6",
    "중1", "중2", "중3", "고1", "고2", "고3",
    "저학년", "고학년", "최상위", "상위권", "중위권", "하위권",

    // === 성적/평가 ===
    "성적", "점수", "등급", "석차", "백분위", "표준점수",
    "내신", "내신등급", "학교시험", "중간고사", "기말고사",
    "모의고사", "수능", "수능모의", "전국모의",
    "1등급", "2등급", "3등급", "4등급", "5등급",
    "만점", "평균", "오답률", "정답률", "취약점", "취약단원",
    "상승", "하락", "향상", "올랐", "떨어졌", "유지",

    // === 학습 관련 ===
    "예습", "복습", "선행", "선행학습", "심화", "심화학습",
    "기본", "기초", "응용", "사고력", "창의력",
    "진도", "진도표", "커리큘럼", "로드맵", "학습플랜",
    "반편성", "분반", "클래스", "개인지도", "그룹수업",
    "온라인", "화상수업", "줌", "대면수업",
    "자기주도학습", "자기주도", "학습습관", "학습태도",
    "집중력", "이해력", "암기력", "응용력", "문제풀이",

    // === 입시/진로 ===
    "입시", "대입", "고입", "특목고", "자사고", "외고", "과학고",
    "영재원", "영재", "경시대회", "올림피아드",
    "수시", "정시", "학생부", "생활기록부", "생기부",
    "학생부종합", "학생부교과", "논술전형", "실기",
    "자기소개서", "자소서", "면접", "포트폴리오",
    "진로", "진학", "의대", "약대", "치대", "한의대",
    "SKY", "인서울", "지방대", "전문대",

    // === 영어 시험/자격 ===
    "토익", "토플", "텝스", "아이엘츠", "TOEIC", "TOEFL",
    "영어인증", "말하기시험", "듣기평가",

    // === 감정/상태 ===
    "걱정", "불안", "스트레스", "자신감", "자존감",
    "동기부여", "의욕", "흥미", "재미", "싫어", "좋아",
    "힘들", "어렵", "쉽", "못하", "잘하", "부족",
    "만족", "불만", "고민", "우려",

    // === 행동/성격 ===
    "산만", "차분", "꼼꼼", "덜렁", "소극적", "적극적",
    "내성적", "외향적", "성실", "게으른", "책임감",
    "교우관계", "친구", "따돌림", "왕따", "학교폭력",
    "핸드폰", "스마트폰", "게임", "유튜브", "SNS",

    // === 시간/일정 ===
    "월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일",
    "월수금", "화목", "주말",
    "오전", "오후", "저녁", "야간",
    "1시", "2시", "3시", "4시", "5시", "6시", "7시", "8시", "9시", "10시",
    "30분", "40분", "50분", "60분", "90분",
    "주1회", "주2회", "주3회", "주4회", "주5회",
    "학기", "1학기", "2학기", "여름방학", "겨울방학", "봄방학",

    // === 교육 브랜드/교재 ===
    "쎈", "개념원리", "수학의정석", "블랙라벨", "일품",
    "라이트쎈", "에이급", "최상위", "최고수준",
    "능률", "천재", "비상", "교학사", "미래엔", "동아",
    "EBS", "이비에스", "수능특강", "수능완성",
    "메가스터디", "대성", "이투스",

    // === 기타 자주 쓰는 표현 ===
    "그러니까", "아무래도", "사실은", "솔직히", "원래는",
    "아이가", "우리아이", "저희아이", "우리애", "저희애",
    "다른학원", "이전학원", "과외", "개인과외", "그룹과외",
    "효과", "효율", "가성비", "비용", "투자",
];

exports.processConsultationRecording = functions
    .region("asia-northeast3")
    .runWith({
        timeoutSeconds: 540,
        memory: "1GB",
        secrets: ["ASSEMBLYAI_API_KEY", "ANTHROPIC_API_KEY"],
    })
    .https.onCall(async (data, context) => {
        // 1. Auth check
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
        }

        const { reportId: existingReportId, storagePath, studentId, studentName, consultantName, consultationDate, fileName, studentContext } = data;

        // 2. 입력 검증
        if (!storagePath || !studentName || !consultationDate) {
            throw new functions.https.HttpsError("invalid-argument", "필수 정보가 누락되었습니다. (storagePath, studentName, consultationDate)");
        }

        // 3. API 키 확인
        const assemblyAiKey = process.env.ASSEMBLYAI_API_KEY;
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (!assemblyAiKey || !anthropicKey) {
            logger.error("[processConsultationRecording] API keys not configured");
            throw new functions.https.HttpsError("failed-precondition", "AI 서비스가 설정되지 않았습니다.");
        }

        // 4. Firestore 문서 (프론트에서 미리 생성한 경우 재사용, 아니면 새로 생성)
        const reportRef = existingReportId
            ? db.collection("consultation_reports").doc(existingReportId)
            : db.collection("consultation_reports").doc();
        const now = Date.now();
        const docData = {
            studentId: studentId || "",
            studentName,
            consultantName: consultantName || "",
            consultationDate,
            fileName: fileName || storagePath.split("/").pop(),
            storagePath,
            fileSizeBytes: 0,
            status: "transcribing",
            statusMessage: "음성 인식을 시작합니다...",
            updatedAt: now,
            createdBy: context.auth.uid,
        };
        if (existingReportId) {
            await reportRef.update(docData);
        } else {
            await reportRef.set({ ...docData, createdAt: now });
        }

        try {
            // 5. Storage에서 Signed URL 생성
            logger.info("[processConsultationRecording] Getting signed URL", { storagePath });
            const bucket = admin.storage().bucket();
            const file = bucket.file(storagePath);
            const [metadata] = await file.getMetadata();
            const fileSizeMB = (parseInt(metadata.size || "0") / 1024 / 1024).toFixed(1);
            const [signedUrl] = await file.getSignedUrl({
                action: "read",
                expires: Date.now() + 30 * 60 * 1000, // 30분
            });

            await reportRef.update({
                fileSizeBytes: parseInt(metadata.size || "0"),
                statusMessage: `파일 확인 완료 (${fileSizeMB}MB). 음성 인식 중...`,
                updatedAt: Date.now(),
            });

            // 6. AssemblyAI에 전사 요청
            logger.info("[processConsultationRecording] Submitting to AssemblyAI", { storagePath, fileSizeMB });

            const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
                method: "POST",
                headers: {
                    "Authorization": assemblyAiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    audio_url: signedUrl,
                    language_code: "ko",
                    speaker_labels: true,
                    speech_models: ["universal-3-pro", "universal-2"],
                    word_boost: ACADEMY_WORD_BOOST,
                    boost_param: "high",
                }),
            });

            if (!transcriptResponse.ok) {
                const errText = await transcriptResponse.text();
                throw new Error(`AssemblyAI 요청 실패: ${transcriptResponse.status} - ${errText}`);
            }

            const transcriptData = await transcriptResponse.json();
            const transcriptId = transcriptData.id;
            logger.info("[processConsultationRecording] AssemblyAI transcript ID:", transcriptId);

            await reportRef.update({
                statusMessage: "음성 인식 서버에 전송 완료. 분석 대기 중...",
                updatedAt: Date.now(),
            });

            // 7. 전사 완료까지 폴링 (5초 간격, 최대 7.5분)
            let transcriptResult;
            let pollCount = 0;
            const maxPolls = 90;
            const pollStartTime = Date.now();
            // 파일 크기 기반 예상 폴링 횟수 (1MB당 ~2회 폴링, 최소 8회 = 40초)
            const estimatedPolls = Math.max(8, Math.round(parseFloat(fileSizeMB) * 2));

            while (pollCount < maxPolls) {
                await new Promise(resolve => setTimeout(resolve, 5000));

                const pollResponse = await fetch(
                    `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
                    { headers: { "Authorization": assemblyAiKey } }
                );
                transcriptResult = await pollResponse.json();

                if (transcriptResult.status === "completed") {
                    const elapsedSec = Math.round((Date.now() - pollStartTime) / 1000);
                    logger.info("[processConsultationRecording] Transcription completed", { elapsedSec });
                    break;
                } else if (transcriptResult.status === "error") {
                    throw new Error(`음성 인식 실패: ${transcriptResult.error}`);
                }

                // 10초마다 상태 업데이트 (더 자주)
                if (pollCount % 2 === 0) {
                    // 파일 크기 기반 예상치로 진행률 계산 (processing이면 최소 15%)
                    const rawPct = Math.round((pollCount / estimatedPolls) * 95);
                    const minPct = transcriptResult.status === "processing" ? 15 : 0;
                    const progressPct = Math.min(Math.max(rawPct, minPct), 95);
                    const statusLabel = transcriptResult.status === "queued"
                        ? `음성 인식 준비 중... (${progressPct}%)`
                        : `음성을 텍스트로 변환 중... (${progressPct}%)`;
                    await reportRef.update({
                        statusMessage: statusLabel,
                        updatedAt: Date.now(),
                    });
                }
                pollCount++;
            }

            if (!transcriptResult || transcriptResult.status !== "completed") {
                throw new Error("음성 인식 시간 초과");
            }

            // 8. 화자 구분 결과 추출
            const fullText = (transcriptResult.text || "").trim();
            const speakerLabels = (transcriptResult.utterances || []).map(u => ({
                speaker: u.speaker,
                text: u.text,
                start: u.start,
                end: u.end,
            }));
            const audioDuration = Math.round(transcriptResult.audio_duration || 0);

            // 8-1. 전사 결과 유효성 검증 — 분석 불가 시 Claude API 호출 차단
            const MIN_TEXT_LENGTH = 30; // 최소 30자 이상이어야 의미 있는 분석 가능
            const MIN_AUDIO_DURATION = 5; // 최소 5초 이상
            const textLength = fullText.replace(/\s+/g, "").length; // 공백 제외 글자 수

            if (!fullText || textLength < MIN_TEXT_LENGTH) {
                logger.warn("[processConsultationRecording] Transcription too short, skipping Claude API", {
                    textLength,
                    audioDuration,
                });
                await reportRef.update({
                    status: "failed",
                    statusMessage: textLength === 0
                        ? "음성에서 텍스트를 인식하지 못했습니다. 녹음 파일을 확인해주세요."
                        : `인식된 텍스트가 너무 짧습니다 (${textLength}자). 상담 내용이 충분히 녹음되었는지 확인해주세요.`,
                    transcription: fullText || null,
                    durationSeconds: audioDuration,
                    updatedAt: Date.now(),
                });
                return { reportId: reportRef.id, status: "failed" };
            }

            if (audioDuration > 0 && audioDuration < MIN_AUDIO_DURATION) {
                logger.warn("[processConsultationRecording] Audio too short, skipping Claude API", { audioDuration });
                await reportRef.update({
                    status: "failed",
                    statusMessage: `녹음 시간이 너무 짧습니다 (${audioDuration}초). 5초 이상의 녹음이 필요합니다.`,
                    transcription: fullText,
                    durationSeconds: audioDuration,
                    updatedAt: Date.now(),
                });
                return { reportId: reportRef.id, status: "failed" };
            }

            const speakerCount = new Set(speakerLabels.map(s => s.speaker)).size;
            const durationMin = Math.floor(audioDuration / 60);
            const durationSec = audioDuration % 60;
            const durationStr = durationMin > 0 ? `${durationMin}분 ${durationSec}초` : `${durationSec}초`;
            await reportRef.update({
                status: "analyzing",
                statusMessage: `음성 인식 완료 (${durationStr}, 화자 ${speakerCount}명). AI가 분석 중...`,
                transcription: fullText,
                speakerLabels,
                durationSeconds: audioDuration,
                updatedAt: Date.now(),
            });

            // 9. Claude API로 보고서 생성
            logger.info("[processConsultationRecording] Calling Claude API for analysis", { textLength, audioDuration, speakerCount });

            const formattedTranscript = speakerLabels.length > 0
                ? speakerLabels.map(s => `[화자 ${s.speaker}] ${s.text}`).join("\n")
                : fullText;

            const claudeResponse = await fetchClaudeWithRetry("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "x-api-key": anthropicKey,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "claude-sonnet-4-20250514",
                    max_tokens: 8192,
                    messages: [{
                        role: "user",
                        content: `당신은 학원 학부모 상담 기록을 깊이 있게 분석하는 교육 상담 전문가입니다.

다음은 학부모와 학원 상담사 간의 상담 녹음을 텍스트로 변환한 것입니다.
음성인식(ASR) 특성상 고유명사(인명, 지명, 학교명 등)가 잘못 인식될 수 있습니다.
같은 사람을 가리키는 유사한 이름이 여러 형태로 나타나면 하나로 통일하되, 통일한 사실을 메모해주세요.
화자가 구분되어 있으며, 대화 맥락을 바탕으로 [선생님], [학부모], [학생] 역할을 추정해주세요.

학생: ${studentName}
상담일: ${consultationDate}
상담자: ${consultantName || "미지정"}
${formatStudentContext(studentContext)}
--- 상담 내용 ---
${formattedTranscript}
--- 끝 ---

위 상담 내용을 심층 분석하여 보고서를 작성해주세요.

분석 시 반드시 주의할 점:
1. 상담의 성격을 정확히 파악하세요 (등록/영업 상담 vs 정기 상담 vs 성적 상담 vs 문제 상담 등). 등록 상담이면 상담사가 프로그램 등록을 유도하는 구조임을 명시하세요.
2. 학부모가 직접 언급한 개인 배경(나이, 가족 상황, 직업, 과거 경험 등)을 빠짐없이 기록하세요. 이는 학부모의 동기와 감정을 이해하는 핵심 맥락입니다.
3. "학부모 요청사항"은 학부모가 직접 발의한 것만 포함하세요. 상담사가 제안하고 학부모가 수용한 것은 "교사 대응/설명 요약" 또는 "합의된 사항"에 넣으세요.
4. "주의 필요 신호"는 절대 가볍게 보지 마세요. 다음을 반드시 감지하세요:
   - 학생의 자존감/자기효능감 저하 신호 (IQ 의심, "나는 머리가 나쁜가" 등)
   - 가정 내 갈등/압박 신호 (부부 갈등, 부모의 과도한 기대, 체벌/화냄 고백 등)
   - 학생의 눈치를 보는 성향, 의사소통 어려움
   - 퇴원/이탈 가능성
   - 학부모의 번아웃/좌절감
5. 학생의 심리 상태와 의사소통 패턴에 주목하세요 (예: 문제를 인식하고도 부모에게 말 못하는 상황, 주변 눈치를 보는 성향 등).
6. 상담사가 등록/유지를 위해 사용한 설득 포인트(성공 사례, 입시 정보, 시설 홍보 등)를 별도로 정리하세요.
7. 합의사항에는 구체적인 학습 로드맵(시기별 목표, 진도 계획)이 언급되었으면 반드시 포함하세요.

대화의 행간, 감정, 뉘앙스까지 읽어서 학부모의 진짜 의도와 감정을 파악해주세요.

ASR 오류 처리: 음성인식 특성상 문맥에 맞지 않는 단어가 포함될 수 있습니다.
- 문맥상 의미가 통하지 않거나 맞지 않는 표현은 해당 부분 뒤에 [?]를 붙여주세요. 예: '티켓 찍으려 한다[?]며 추가적인 스트레스'
- 고유명사(인명, 학교명, 지명)가 잘못 인식된 것 같으면 문맥으로 추론한 뒤 [?]를 붙여주세요. 예: '대구일중[?]'
- 확실히 오인식된 부분은 보고서에 그대로 포함하되, 반드시 [?]를 표시하여 사용자가 원본 녹음과 대조할 수 있게 하세요.

중요: 각 JSON 값 내에서 항목을 구분할 때 반드시 줄바꿈(\\n)을 사용하세요.
불릿 포인트(-)는 각각 새 줄에 작성하세요. 예시: "- 첫번째 항목\\n- 두번째 항목\\n- 세번째 항목"

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "speakerRoles": {"A": "선생님", "B": "학부모"} (화자 식별 결과. 가능한 역할: 선생님, 학부모, 학생, 원장, 기타),
  "consultationType": "상담 성격 한 줄 요약 (예: '등록 상담 - 진단평가 결과 설명 및 프로그램 등록 유도', '정기 성적 상담', '학습 태도 문제 상담' 등)",
  "summary": "상담의 전체적인 요약 (5-7문장).\\n상담 성격, 핵심 흐름, 주요 결론을 포함.\\nASR 인식 오류로 이름이 혼재된 경우 통일 사실도 명시",
  "familyContext": "상담에서 드러난 가정 배경과 개인 맥락 (학부모의 나이/직업/가족구성, 학생의 형제관계, 과거 학습 이력, 이전 학원/공부방 경험, 학부모의 학력관/교육철학 등).\\n언급되지 않은 항목은 생략. 각 항목은 - 불릿으로 줄바꿈",
  "parentConcerns": "학부모가 걱정하거나 불안해하는 부분.\\n직접 말한 것 + 말투/맥락에서 추론되는 것 모두 포함.\\n각 항목은 - 불릿으로 줄바꿈",
  "parentQuestions": "학부모가 궁금해하거나 질문한 사항들.\\n각 질문마다 상담자가 어떻게 답변했는지 구체적으로 요약할 것.\\n형식: - [질문] 질문 내용\\n  → [답변] 상담자의 답변 요약 (핵심만 2-3문장)\\n답변이 없었으면 → [미답변]으로 표시.\\n각 항목은 - 불릿으로 줄바꿈",
  "parentRequests": "학부모가 직접 발의하여 요청한 사항만 포함 (상담사 제안 제외).\\n각 항목은 - 불릿으로 줄바꿈",
  "parentSatisfaction": "학부모의 전반적인 만족도/감정 상태 분석.\\n긍정적 반응, 불만/우려, 아직 해소되지 않은 부분을 구분.\\n문단 구분 시 \\n 사용",
  "studentNotes": "학생에 관한 특이사항.\\n학습 태도, 성적 변화, 심리 상태(자존감/자기효능감), 의사소통 패턴(눈치, 표현 어려움), 교우관계, 강점/약점.\\n각 항목은 - 불릿으로 줄바꿈",
  "teacherResponse": "교사/상담사가 제시한 해결책, 설명, 제안 요약 (상담사가 제안하고 학부모가 수용한 것 포함).\\n각 항목은 - 불릿으로 줄바꿈",
  "salesPoints": "상담사가 등록/유지를 위해 사용한 설득 논거 (성공 사례, 입시 정보, 시설/프로그램 홍보, 지역 특수성 등).\\n등록/영업 성격이 아닌 상담이면 빈 문자열.\\n각 항목은 - 불릿으로 줄바꿈",
  "agreements": "상담 중 합의된 사항.\\n구체적인 일정/방법/학습 로드맵(시기별 목표, 진도 계획) 포함.\\n누가 제안했는지 (학부모/상담사) 표시.\\n각 항목은 - 불릿으로 줄바꿈",
  "actionItems": "후속 조치가 필요한 항목 (담당자, 기한 포함 가능하면).\\n각 항목은 - 불릿으로 줄바꿈",
  "riskFlags": "주의가 필요한 신호. 절대 '특이사항 없음'으로 넘기지 말고 다음을 꼼꼼히 확인:\\n- 학생 자존감/자기효능감 저하 (IQ 의심, 자신감 상실 등)\\n- 가정 내 갈등/압박 (부부 갈등, 과도한 기대, 감정적 훈육 등)\\n- 학생 의사소통 문제 (부모에게 말 못함, 눈치 봄 등)\\n- 퇴원/이탈 가능성\\n- 학부모 번아웃/좌절감\\n위 항목 중 해당 없으면 '확인된 위험 신호 없음'으로 표기.\\n각 항목은 - 불릿으로 줄바꿈",
  "conversationFlow": [
    {
      "topic": "주제명 (예: 학생 현황 파악)",
      "summary": "이 주제에서 논의된 핵심 내용 1줄 요약",
      "children": [
        {
          "topic": "하위 주제명",
          "summary": "하위 주제 핵심 내용 1줄 요약",
          "children": []
        }
      ]
    }
  ]
}`
                    }],
                }),
            });

            if (!claudeResponse.ok) {
                const errBody = await claudeResponse.text();
                throw new Error(`Claude API 오류: ${claudeResponse.status} - ${errBody}`);
            }

            const claudeData = await claudeResponse.json();
            const reportText = claudeData.content?.[0]?.text || "";

            // JSON 파싱
            let report;
            try {
                const jsonMatch = reportText.match(/\{[\s\S]*\}/);
                report = JSON.parse(jsonMatch ? jsonMatch[0] : reportText);
            } catch {
                // JSON 파싱 실패 시 전체 텍스트를 summary에 저장
                report = {
                    summary: reportText,
                    parentRequests: "",
                    studentNotes: "",
                    agreements: "",
                    actionItems: "",
                };
            }

            // 10. speakerRoles 추출 후 보고서에서 분리
            const speakerRoles = report.speakerRoles || {};
            delete report.speakerRoles;

            // 11. 최종 보고서 저장
            await reportRef.update({
                status: "completed",
                statusMessage: "분석이 완료되었습니다.",
                report,
                speakerRoles,
                ...(studentContext ? { studentContext } : {}),
                updatedAt: Date.now(),
            });

            // 11. student_consultations에 자동 상담 기록 생성
            try {
                const autoConsultation = {
                    studentId,
                    studentName,
                    consultantName: consultantName || "",
                    type: "parent",
                    category: "general",
                    title: `[녹음분석] ${consultationDate} 상담`,
                    content: report.summary || "",
                    date: consultationDate,
                    followUpNeeded: !!(report.actionItems && report.actionItems.trim() && !report.actionItems.includes("없음")),
                    followUpDone: false,
                    followUpNotes: report.actionItems || "",
                    consultationReportId: reportRef.id,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    createdBy: context.auth.uid,
                    autoGenerated: true,
                };
                await db.collection("student_consultations").add(autoConsultation);
                logger.info("[processConsultationRecording] Auto consultation record created");
            } catch (autoErr) {
                logger.error("[processConsultationRecording] Failed to create auto consultation:", autoErr);
            }

            logger.info("[processConsultationRecording] Complete", { reportId: reportRef.id });
            return { reportId: reportRef.id, status: "completed" };

        } catch (error) {
            logger.error("[processConsultationRecording] Error:", error);
            // 에러 원인을 사용자 친화적으로 변환
            let userMessage = "처리 중 오류가 발생했습니다.";
            const errMsg = error.message || "";
            if (errMsg.includes("deadline") || errMsg.includes("timeout") || errMsg.includes("시간 초과")) {
                userMessage = "처리 시간이 초과되었습니다. 파일이 너무 크거나 서버가 바쁜 상태입니다. 잠시 후 다시 시도해주세요.";
            } else if (errMsg.includes("AssemblyAI")) {
                userMessage = `음성 인식 서비스 오류: ${errMsg}`;
            } else if (errMsg.includes("Claude")) {
                userMessage = `AI 분석 서비스 오류: ${errMsg}`;
            } else if (errMsg.includes("storage") || errMsg.includes("Storage")) {
                userMessage = `파일 접근 오류: ${errMsg}`;
            } else {
                userMessage = `오류: ${errMsg}`;
            }
            await reportRef.update({
                status: "error",
                statusMessage: userMessage,
                errorMessage: errMsg,
                updatedAt: Date.now(),
            });
            throw new functions.https.HttpsError("internal", errMsg || "상담 녹음 분석 실패");
        }
    });

/**
 * 기존 상담 녹음 보고서 재분석 (저장된 텍스트 활용, Claude만 재호출)
 */
exports.reanalyzeConsultationReport = functions
    .region("asia-northeast3")
    .runWith({
        timeoutSeconds: 300,
        memory: "512MB",
        secrets: ["ANTHROPIC_API_KEY"],
    })
    .https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");

        const { reportId } = data;
        if (!reportId) throw new functions.https.HttpsError("invalid-argument", "보고서 ID가 필요합니다.");

        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (!anthropicKey) throw new functions.https.HttpsError("internal", "API 키가 설정되지 않았습니다.");

        const reportRef = db.collection("consultation_reports").doc(reportId);
        const reportSnap = await reportRef.get();
        if (!reportSnap.exists) throw new functions.https.HttpsError("not-found", "보고서를 찾을 수 없습니다.");

        const reportData = reportSnap.data();
        const { transcription, speakerLabels, studentName, consultationDate, consultantName, studentContext } = reportData;

        if (!transcription) throw new functions.https.HttpsError("failed-precondition", "음성인식 텍스트가 없습니다.");

        try {
            await reportRef.update({ status: "analyzing", statusMessage: "AI가 새로운 알고리즘으로 재분석 중...", updatedAt: Date.now() });

            const formattedTranscript = speakerLabels && speakerLabels.length > 0
                ? speakerLabels.map(s => `[화자 ${s.speaker}] ${s.text}`).join("\n")
                : transcription;

            const claudeResponse = await fetchClaudeWithRetry("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "claude-sonnet-4-20250514",
                    max_tokens: 8192,
                    messages: [{
                        role: "user",
                        content: `당신은 학원 학부모 상담 기록을 깊이 있게 분석하는 교육 상담 전문가입니다.

다음은 학부모와 학원 상담사 간의 상담 녹음을 텍스트로 변환한 것입니다.
음성인식(ASR) 특성상 고유명사(인명, 지명, 학교명 등)가 잘못 인식될 수 있습니다.
같은 사람을 가리키는 유사한 이름이 여러 형태로 나타나면 하나로 통일하되, 통일한 사실을 메모해주세요.
화자가 구분되어 있으며, 대화 맥락을 바탕으로 [선생님], [학부모], [학생] 역할을 추정해주세요.

학생: ${studentName}
상담일: ${consultationDate}
상담자: ${consultantName || "미지정"}
${formatStudentContext(studentContext)}
--- 상담 내용 ---
${formattedTranscript}
--- 끝 ---

위 상담 내용을 심층 분석하여 보고서를 작성해주세요.

분석 시 반드시 주의할 점:
1. 상담의 성격을 정확히 파악하세요 (등록/영업 상담 vs 정기 상담 vs 성적 상담 vs 문제 상담 등). 등록 상담이면 상담사가 프로그램 등록을 유도하는 구조임을 명시하세요.
2. 학부모가 직접 언급한 개인 배경(나이, 가족 상황, 직업, 과거 경험 등)을 빠짐없이 기록하세요. 이는 학부모의 동기와 감정을 이해하는 핵심 맥락입니다.
3. "학부모 요청사항"은 학부모가 직접 발의한 것만 포함하세요. 상담사가 제안하고 학부모가 수용한 것은 "교사 대응/설명 요약" 또는 "합의된 사항"에 넣으세요.
4. "주의 필요 신호"는 절대 가볍게 보지 마세요. 다음을 반드시 감지하세요:
   - 학생의 자존감/자기효능감 저하 신호 (IQ 의심, "나는 머리가 나쁜가" 등)
   - 가정 내 갈등/압박 신호 (부부 갈등, 부모의 과도한 기대, 체벌/화냄 고백 등)
   - 학생의 눈치를 보는 성향, 의사소통 어려움
   - 퇴원/이탈 가능성
   - 학부모의 번아웃/좌절감
5. 학생의 심리 상태와 의사소통 패턴에 주목하세요 (예: 문제를 인식하고도 부모에게 말 못하는 상황, 주변 눈치를 보는 성향 등).
6. 상담사가 등록/유지를 위해 사용한 설득 포인트(성공 사례, 입시 정보, 시설 홍보 등)를 별도로 정리하세요.
7. 합의사항에는 구체적인 학습 로드맵(시기별 목표, 진도 계획)이 언급되었으면 반드시 포함하세요.

대화의 행간, 감정, 뉘앙스까지 읽어서 학부모의 진짜 의도와 감정을 파악해주세요.

ASR 오류 처리: 음성인식 특성상 문맥에 맞지 않는 단어가 포함될 수 있습니다.
- 문맥상 의미가 통하지 않거나 맞지 않는 표현은 해당 부분 뒤에 [?]를 붙여주세요. 예: '티켓 찍으려 한다[?]며 추가적인 스트레스'
- 고유명사(인명, 학교명, 지명)가 잘못 인식된 것 같으면 문맥으로 추론한 뒤 [?]를 붙여주세요. 예: '대구일중[?]'
- 확실히 오인식된 부분은 보고서에 그대로 포함하되, 반드시 [?]를 표시하여 사용자가 원본 녹음과 대조할 수 있게 하세요.

중요: 각 JSON 값 내에서 항목을 구분할 때 반드시 줄바꿈(\\n)을 사용하세요.
불릿 포인트(-)는 각각 새 줄에 작성하세요. 예시: "- 첫번째 항목\\n- 두번째 항목\\n- 세번째 항목"

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "speakerRoles": {"A": "선생님", "B": "학부모"} (화자 식별 결과. 가능한 역할: 선생님, 학부모, 학생, 원장, 기타),
  "consultationType": "상담 성격 한 줄 요약 (예: '등록 상담 - 진단평가 결과 설명 및 프로그램 등록 유도', '정기 성적 상담', '학습 태도 문제 상담' 등)",
  "summary": "상담의 전체적인 요약 (5-7문장).\\n상담 성격, 핵심 흐름, 주요 결론을 포함.\\nASR 인식 오류로 이름이 혼재된 경우 통일 사실도 명시",
  "familyContext": "상담에서 드러난 가정 배경과 개인 맥락 (학부모의 나이/직업/가족구성, 학생의 형제관계, 과거 학습 이력, 이전 학원/공부방 경험, 학부모의 학력관/교육철학 등).\\n언급되지 않은 항목은 생략. 각 항목은 - 불릿으로 줄바꿈",
  "parentConcerns": "학부모가 걱정하거나 불안해하는 부분.\\n직접 말한 것 + 말투/맥락에서 추론되는 것 모두 포함.\\n각 항목은 - 불릿으로 줄바꿈",
  "parentQuestions": "학부모가 궁금해하거나 질문한 사항들.\\n각 질문마다 상담자가 어떻게 답변했는지 구체적으로 요약할 것.\\n형식: - [질문] 질문 내용\\n  → [답변] 상담자의 답변 요약 (핵심만 2-3문장)\\n답변이 없었으면 → [미답변]으로 표시.\\n각 항목은 - 불릿으로 줄바꿈",
  "parentRequests": "학부모가 직접 발의하여 요청한 사항만 포함 (상담사 제안 제외).\\n각 항목은 - 불릿으로 줄바꿈",
  "parentSatisfaction": "학부모의 전반적인 만족도/감정 상태 분석.\\n긍정적 반응, 불만/우려, 아직 해소되지 않은 부분을 구분.\\n문단 구분 시 \\n 사용",
  "studentNotes": "학생에 관한 특이사항.\\n학습 태도, 성적 변화, 심리 상태(자존감/자기효능감), 의사소통 패턴(눈치, 표현 어려움), 교우관계, 강점/약점.\\n각 항목은 - 불릿으로 줄바꿈",
  "teacherResponse": "교사/상담사가 제시한 해결책, 설명, 제안 요약 (상담사가 제안하고 학부모가 수용한 것 포함).\\n각 항목은 - 불릿으로 줄바꿈",
  "salesPoints": "상담사가 등록/유지를 위해 사용한 설득 논거 (성공 사례, 입시 정보, 시설/프로그램 홍보, 지역 특수성 등).\\n등록/영업 성격이 아닌 상담이면 빈 문자열.\\n각 항목은 - 불릿으로 줄바꿈",
  "agreements": "상담 중 합의된 사항.\\n구체적인 일정/방법/학습 로드맵(시기별 목표, 진도 계획) 포함.\\n누가 제안했는지 (학부모/상담사) 표시.\\n각 항목은 - 불릿으로 줄바꿈",
  "actionItems": "후속 조치가 필요한 항목 (담당자, 기한 포함 가능하면).\\n각 항목은 - 불릿으로 줄바꿈",
  "riskFlags": "주의가 필요한 신호. 절대 '특이사항 없음'으로 넘기지 말고 다음을 꼼꼼히 확인:\\n- 학생 자존감/자기효능감 저하 (IQ 의심, 자신감 상실 등)\\n- 가정 내 갈등/압박 (부부 갈등, 과도한 기대, 감정적 훈육 등)\\n- 학생 의사소통 문제 (부모에게 말 못함, 눈치 봄 등)\\n- 퇴원/이탈 가능성\\n- 학부모 번아웃/좌절감\\n위 항목 중 해당 없으면 '확인된 위험 신호 없음'으로 표기.\\n각 항목은 - 불릿으로 줄바꿈",
  "conversationFlow": [
    {
      "topic": "주제명 (예: 학생 현황 파악)",
      "summary": "이 주제에서 논의된 핵심 내용 1줄 요약",
      "children": [
        {
          "topic": "하위 주제명",
          "summary": "하위 주제 핵심 내용 1줄 요약",
          "children": []
        }
      ]
    }
  ]
}`
                    }],
                }),
            });

            if (!claudeResponse.ok) {
                const errBody = await claudeResponse.text();
                throw new Error(`Claude API 오류: ${claudeResponse.status} - ${errBody}`);
            }

            const claudeData = await claudeResponse.json();
            const reportText = claudeData.content?.[0]?.text || "";

            let report;
            try {
                const jsonMatch = reportText.match(/\{[\s\S]*\}/);
                report = JSON.parse(jsonMatch ? jsonMatch[0] : reportText);
            } catch {
                report = { summary: reportText };
            }

            const speakerRoles = report.speakerRoles || {};
            delete report.speakerRoles;

            await reportRef.update({
                status: "completed",
                statusMessage: "재분석이 완료되었습니다.",
                report,
                speakerRoles,
                updatedAt: Date.now(),
            });

            logger.info("[reanalyzeConsultationReport] Complete", { reportId });
            return { reportId, status: "completed" };
        } catch (error) {
            logger.error("[reanalyzeConsultationReport] Error:", error);
            await reportRef.update({
                status: "completed",
                statusMessage: "재분석 실패 - 이전 분석 결과를 유지합니다.",
                errorMessage: error.message || "",
                updatedAt: Date.now(),
            });
            throw new functions.https.HttpsError("internal", error.message || "재분석 실패");
        }
    });

/**
 * 등록 상담 녹음 분석 → ConsultationRecord 폼 자동 채우기용 JSON 추출
 */
exports.processRegistrationRecording = functions
    .region("asia-northeast3")
    .runWith({
        timeoutSeconds: 540,
        memory: "1GB",
        secrets: ["ASSEMBLYAI_API_KEY", "ANTHROPIC_API_KEY"],
    })
    .https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");

        const { storagePath, studentName, consultationDate, counselorName, fileName, studentContext } = data;
        if (!storagePath || !studentName) throw new functions.https.HttpsError("invalid-argument", "필수 정보가 누락되었습니다.");

        const assemblyAiKey = process.env.ASSEMBLYAI_API_KEY;
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (!assemblyAiKey || !anthropicKey) throw new functions.https.HttpsError("failed-precondition", "API keys not configured");

        // Firestore 진행 상태 문서
        const reportRef = db.collection("registration_recording_reports").doc();
        const now = Date.now();
        await reportRef.set({
            studentName, consultationDate: consultationDate || "", counselorName: counselorName || "",
            fileName: fileName || "", storagePath, status: "transcribing",
            statusMessage: "음성 인식을 시작합니다...", createdAt: now, updatedAt: now, createdBy: context.auth.uid,
        });

        try {
            // 1. Signed URL
            const bucket = admin.storage().bucket();
            const file = bucket.file(storagePath);
            const [signedUrl] = await file.getSignedUrl({ action: "read", expires: Date.now() + 30 * 60 * 1000 });
            const [metadata] = await file.getMetadata();
            const fileSizeMB = ((metadata.size || 0) / (1024 * 1024)).toFixed(1);

            // 2. AssemblyAI 전사
            const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
                method: "POST",
                headers: { "Authorization": assemblyAiKey, "Content-Type": "application/json" },
                body: JSON.stringify({
                    audio_url: signedUrl,
                    language_code: "ko",
                    speaker_labels: true,
                    speech_models: ["universal-3-pro", "universal-2"],
                    word_boost: ACADEMY_WORD_BOOST,
                    boost_param: "high",
                }),
            });
            const { id: transcriptId } = await transcriptResponse.json();

            // 3. 폴링 (파일 크기 기반 예상 시간)
            const estimatedPolls = Math.max(8, Math.round(parseFloat(fileSizeMB) * 2));
            let transcript = null;
            for (let i = 0; i < 90; i++) {
                await new Promise(r => setTimeout(r, 5000));
                const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
                    headers: { "Authorization": assemblyAiKey },
                });
                const pollData = await pollRes.json();
                if (pollData.status === "completed") { transcript = pollData; break; }
                if (pollData.status === "error") throw new Error("음성 인식 실패: " + (pollData.error || ""));
                if (i % 6 === 0) {
                    const rawPct = Math.round((i / estimatedPolls) * 95);
                    const minPct = pollData.status === "processing" ? 15 : 0;
                    const pct = Math.min(Math.max(rawPct, minPct), 95);
                    const label = pollData.status === "queued" ? `음성 인식 준비 중... (${pct}%)` : `음성을 텍스트로 변환 중... (${pct}%)`;
                    await reportRef.update({ statusMessage: label, updatedAt: Date.now() });
                }
            }
            if (!transcript) throw new Error("음성 인식 시간 초과");

            const fullText = (transcript.text || "").trim();
            const audioDuration = Math.round(transcript.audio_duration || 0);
            const textLength = fullText.replace(/\s+/g, "").length;

            if (!fullText || textLength < 30) {
                logger.warn("[processRegistrationRecording] Transcription too short, skipping Claude API", { textLength, audioDuration });
                await reportRef.update({
                    status: "failed",
                    statusMessage: textLength === 0
                        ? "음성에서 텍스트를 인식하지 못했습니다. 녹음 파일을 확인해주세요."
                        : `인식된 텍스트가 너무 짧습니다 (${textLength}자). 상담 내용이 충분히 녹음되었는지 확인해주세요.`,
                    transcription: fullText || null,
                    durationSeconds: audioDuration,
                    updatedAt: Date.now(),
                });
                return { reportId: reportRef.id, status: "failed" };
            }

            if (audioDuration > 0 && audioDuration < 5) {
                logger.warn("[processRegistrationRecording] Audio too short, skipping Claude API", { audioDuration });
                await reportRef.update({
                    status: "failed",
                    statusMessage: `녹음 시간이 너무 짧습니다 (${audioDuration}초). 5초 이상의 녹음이 필요합니다.`,
                    transcription: fullText,
                    durationSeconds: audioDuration,
                    updatedAt: Date.now(),
                });
                return { reportId: reportRef.id, status: "failed" };
            }

            // speaker labels 추출 (상담녹음분석과 동일)
            const speakerLabels = (transcript.utterances || []).map(u => ({
                speaker: u.speaker,
                text: u.text,
                start: u.start,
                end: u.end,
            }));
            const speakerCount = new Set(speakerLabels.map(s => s.speaker)).size;
            const formattedTranscript = speakerLabels.length > 0
                ? speakerLabels.map(s => `[화자 ${s.speaker}] ${s.text}`).join("\n")
                : fullText;

            await reportRef.update({
                status: "analyzing",
                statusMessage: "AI가 등록상담 내용을 분석 중...",
                transcription: fullText,
                durationSeconds: audioDuration,
                updatedAt: Date.now(),
            });

            // 4. Claude 병렬 호출: 폼 필드 추출 + 상담녹음 심층분석
            const claudeHeaders = { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" };

            const [formResponse, analysisResponse] = await Promise.all([
                // (A) 등록상담 폼 필드 추출 (기존)
                fetchClaudeWithRetry("https://api.anthropic.com/v1/messages", {
                    method: "POST",
                    headers: claudeHeaders,
                    body: JSON.stringify({
                        model: "claude-sonnet-4-20250514",
                        max_tokens: 4096,
                        messages: [{ role: "user", content: `당신은 학원 등록 상담 내용을 분석하여 상담 기록 양식에 맞게 구조화하는 전문가입니다.

학생: ${studentName}
상담일: ${consultationDate || "미지정"}
상담자: ${counselorName || "미지정"}
${formatStudentContext(studentContext)}
--- 상담 녹음 텍스트 ---
${fullText}
--- 끝 ---

위 등록 상담 내용에서 다음 정보를 추출하여 JSON으로 응답하세요.
정보가 언급되지 않은 필드는 빈 문자열("")로 남기세요.
추측하지 말고 명확히 언급된 내용만 채우세요.

{
  "studentName": "학생 이름",
  "schoolName": "학교 이름 (예: 대구일중학교)",
  "grade": "학년 (초1~초6, 중1~중3, 고1~고3 중 하나)",
  "parentPhone": "학부모 전화번호",
  "parentName": "보호자 이름",
  "parentRelation": "보호자 관계 (모/부/조부/조모/기타)",
  "address": "주소",
  "birthDate": "생년월일 (YYYY-MM-DD)",
  "consultationPath": "상담 경로 (전화/방문/소개/블로그/인스타 등)",
  "enrollmentReason": "등학 동기/이유",
  "siblings": "남매 관계 (형제자매 정보)",
  "shuttleBusRequest": "셔틀 신청 여부 (true/false 또는 빈 문자열)",
  "safetyNotes": "안전사항/주의사항 (알레르기, 건강 등)",
  "careerGoal": "희망 진로",
  "subject": "주요 상담 과목 (영어/수학/국어/과학 중 하나)",
  "status": "등록 상태 추정 (영수등록/수학등록/영어등록/이번달 등록예정/추후 등록예정/미등록 중 하나)",
  "notes": "전체 상담 요약 (5~10문장으로 상담 흐름, 학부모 요구사항, 합의사항, 주의점을 종합 정리)",
  "nonRegistrationReason": "미등록 사유 (해당 시)",
  "followUpDate": "후속 상담 예정일 (YYYY-MM-DD, 해당 시)",
  "followUpContent": "후속 상담 내용/계획",
  "mathConsultation": {
    "levelTestScore": "수학 레벨테스트 점수",
    "academyHistory": "수학 학원 이력",
    "learningProgress": "수학 학습 진도/현재 수준",
    "examResults": "수학 시험 성적",
    "recommendedClass": "수학 추천반",
    "homeRoomTeacher": "수학 담임 선생님",
    "firstClassDate": "수학 첫 수업일 (YYYY-MM-DD)",
    "notes": "수학 관련 기타 사항"
  },
  "englishConsultation": {
    "engLevel": "영어 레벨 (숫자)",
    "englishTestType": "영어 테스트 종류 (ai/nelt/eie 중 하나)",
    "academyHistory": "영어 학원 이력",
    "learningProgress": "영어 학습 진도/현재 수준",
    "examResults": "영어 시험 성적",
    "recommendedClass": "영어 추천반",
    "homeRoomTeacher": "영어 담임 선생님",
    "firstClassDate": "영어 첫 수업일 (YYYY-MM-DD)",
    "notes": "영어 관련 기타 사항"
  },
  "koreanConsultation": {
    "levelTestScore": "국어 레벨테스트 점수",
    "academyHistory": "국어 학원 이력",
    "learningProgress": "국어 학습 진도/현재 수준",
    "recommendedClass": "국어 추천반",
    "notes": "국어 관련 기타 사항"
  },
  "scienceConsultation": {
    "levelTestScore": "과학 레벨테스트 점수",
    "academyHistory": "과학 학원 이력",
    "learningProgress": "과학 학습 진도/현재 수준",
    "recommendedClass": "과학 추천반",
    "notes": "과학 관련 기타 사항"
  }
}

반드시 위 JSON 형식으로만 응답하세요.` }],
                    }),
                }),

                // (B) 상담녹음 심층분석 (processConsultationRecording과 동일 프롬프트)
                fetchClaudeWithRetry("https://api.anthropic.com/v1/messages", {
                    method: "POST",
                    headers: claudeHeaders,
                    body: JSON.stringify({
                        model: "claude-sonnet-4-20250514",
                        max_tokens: 8192,
                        messages: [{ role: "user", content: `당신은 학원 학부모 상담 기록을 깊이 있게 분석하는 교육 상담 전문가입니다.

다음은 학부모와 학원 상담사 간의 상담 녹음을 텍스트로 변환한 것입니다.
음성인식(ASR) 특성상 고유명사(인명, 지명, 학교명 등)가 잘못 인식될 수 있습니다.
같은 사람을 가리키는 유사한 이름이 여러 형태로 나타나면 하나로 통일하되, 통일한 사실을 메모해주세요.
화자가 구분되어 있으며, 대화 맥락을 바탕으로 [선생님], [학부모], [학생] 역할을 추정해주세요.

학생: ${studentName}
상담일: ${consultationDate || "미지정"}
상담자: ${counselorName || "미지정"}
${formatStudentContext(studentContext)}
--- 상담 내용 ---
${formattedTranscript}
--- 끝 ---

위 상담 내용을 심층 분석하여 보고서를 작성해주세요.

분석 시 반드시 주의할 점:
1. 상담의 성격을 정확히 파악하세요 (등록/영업 상담 vs 정기 상담 vs 성적 상담 vs 문제 상담 등). 등록 상담이면 상담사가 프로그램 등록을 유도하는 구조임을 명시하세요.
2. 학부모가 직접 언급한 개인 배경(나이, 가족 상황, 직업, 과거 경험 등)을 빠짐없이 기록하세요. 이는 학부모의 동기와 감정을 이해하는 핵심 맥락입니다.
3. "학부모 요청사항"은 학부모가 직접 발의한 것만 포함하세요. 상담사가 제안하고 학부모가 수용한 것은 "교사 대응/설명 요약" 또는 "합의된 사항"에 넣으세요.
4. "주의 필요 신호"는 절대 가볍게 보지 마세요. 다음을 반드시 감지하세요:
   - 학생의 자존감/자기효능감 저하 신호 (IQ 의심, "나는 머리가 나쁜가" 등)
   - 가정 내 갈등/압박 신호 (부부 갈등, 부모의 과도한 기대, 체벌/화냄 고백 등)
   - 학생의 눈치를 보는 성향, 의사소통 어려움
   - 퇴원/이탈 가능성
   - 학부모의 번아웃/좌절감
5. 학생의 심리 상태와 의사소통 패턴에 주목하세요 (예: 문제를 인식하고도 부모에게 말 못하는 상황, 주변 눈치를 보는 성향 등).
6. 상담사가 등록/유지를 위해 사용한 설득 포인트(성공 사례, 입시 정보, 시설 홍보 등)를 별도로 정리하세요.
7. 합의사항에는 구체적인 학습 로드맵(시기별 목표, 진도 계획)이 언급되었으면 반드시 포함하세요.

대화의 행간, 감정, 뉘앙스까지 읽어서 학부모의 진짜 의도와 감정을 파악해주세요.

ASR 오류 처리: 음성인식 특성상 문맥에 맞지 않는 단어가 포함될 수 있습니다.
- 문맥상 의미가 통하지 않거나 맞지 않는 표현은 해당 부분 뒤에 [?]를 붙여주세요. 예: '티켓 찍으려 한다[?]며 추가적인 스트레스'
- 고유명사(인명, 학교명, 지명)가 잘못 인식된 것 같으면 문맥으로 추론한 뒤 [?]를 붙여주세요. 예: '대구일중[?]'
- 확실히 오인식된 부분은 보고서에 그대로 포함하되, 반드시 [?]를 표시하여 사용자가 원본 녹음과 대조할 수 있게 하세요.

중요: 각 JSON 값 내에서 항목을 구분할 때 반드시 줄바꿈(\\n)을 사용하세요.
불릿 포인트(-)는 각각 새 줄에 작성하세요. 예시: "- 첫번째 항목\\n- 두번째 항목\\n- 세번째 항목"

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "speakerRoles": {"A": "선생님", "B": "학부모"} (화자 식별 결과. 가능한 역할: 선생님, 학부모, 학생, 원장, 기타),
  "consultationType": "상담 성격 한 줄 요약 (예: '등록 상담 - 진단평가 결과 설명 및 프로그램 등록 유도', '정기 성적 상담', '학습 태도 문제 상담' 등)",
  "summary": "상담의 전체적인 요약 (5-7문장).\\n상담 성격, 핵심 흐름, 주요 결론을 포함.\\nASR 인식 오류로 이름이 혼재된 경우 통일 사실도 명시",
  "familyContext": "상담에서 드러난 가정 배경과 개인 맥락 (학부모의 나이/직업/가족구성, 학생의 형제관계, 과거 학습 이력, 이전 학원/공부방 경험, 학부모의 학력관/교육철학 등).\\n언급되지 않은 항목은 생략. 각 항목은 - 불릿으로 줄바꿈",
  "parentConcerns": "학부모가 걱정하거나 불안해하는 부분.\\n직접 말한 것 + 말투/맥락에서 추론되는 것 모두 포함.\\n각 항목은 - 불릿으로 줄바꿈",
  "parentQuestions": "학부모가 궁금해하거나 질문한 사항들.\\n각 질문마다 상담자가 어떻게 답변했는지 구체적으로 요약할 것.\\n형식: - [질문] 질문 내용\\n  → [답변] 상담자의 답변 요약 (핵심만 2-3문장)\\n답변이 없었으면 → [미답변]으로 표시.\\n각 항목은 - 불릿으로 줄바꿈",
  "parentRequests": "학부모가 직접 발의하여 요청한 사항만 포함 (상담사 제안 제외).\\n각 항목은 - 불릿으로 줄바꿈",
  "parentSatisfaction": "학부모의 전반적인 만족도/감정 상태 분석.\\n긍정적 반응, 불만/우려, 아직 해소되지 않은 부분을 구분.\\n문단 구분 시 \\n 사용",
  "studentNotes": "학생에 관한 특이사항.\\n학습 태도, 성적 변화, 심리 상태(자존감/자기효능감), 의사소통 패턴(눈치, 표현 어려움), 교우관계, 강점/약점.\\n각 항목은 - 불릿으로 줄바꿈",
  "teacherResponse": "교사/상담사가 제시한 해결책, 설명, 제안 요약 (상담사가 제안하고 학부모가 수용한 것 포함).\\n각 항목은 - 불릿으로 줄바꿈",
  "salesPoints": "상담사가 등록/유지를 위해 사용한 설득 논거 (성공 사례, 입시 정보, 시설/프로그램 홍보, 지역 특수성 등).\\n등록/영업 성격이 아닌 상담이면 빈 문자열.\\n각 항목은 - 불릿으로 줄바꿈",
  "agreements": "상담 중 합의된 사항.\\n구체적인 일정/방법/학습 로드맵(시기별 목표, 진도 계획) 포함.\\n누가 제안했는지 (학부모/상담사) 표시.\\n각 항목은 - 불릿으로 줄바꿈",
  "actionItems": "후속 조치가 필요한 항목 (담당자, 기한 포함 가능하면).\\n각 항목은 - 불릿으로 줄바꿈",
  "riskFlags": "주의가 필요한 신호. 절대 '특이사항 없음'으로 넘기지 말고 다음을 꼼꼼히 확인:\\n- 학생 자존감/자기효능감 저하 (IQ 의심, 자신감 상실 등)\\n- 가정 내 갈등/압박 (부부 갈등, 과도한 기대, 감정적 훈육 등)\\n- 학생 의사소통 문제 (부모에게 말 못함, 눈치 봄 등)\\n- 퇴원/이탈 가능성\\n- 학부모 번아웃/좌절감\\n위 항목 중 해당 없으면 '확인된 위험 신호 없음'으로 표기.\\n각 항목은 - 불릿으로 줄바꿈",
  "conversationFlow": [
    {
      "topic": "주제명 (예: 학생 현황 파악)",
      "summary": "이 주제에서 논의된 핵심 내용 1줄 요약",
      "children": [
        {
          "topic": "하위 주제명",
          "summary": "하위 주제 핵심 내용 1줄 요약",
          "children": []
        }
      ]
    }
  ]
}` }],
                    }),
                }),
            ]);

            // (A) 폼 필드 추출 결과 처리
            if (!formResponse.ok) {
                const errBody = await formResponse.text();
                throw new Error(`Claude API 오류 (폼 추출): ${formResponse.status} - ${errBody}`);
            }
            const formData = await formResponse.json();
            const formText = formData.content?.[0]?.text || "";

            let extractedData;
            try {
                const jsonMatch = formText.match(/\{[\s\S]*\}/);
                extractedData = JSON.parse(jsonMatch ? jsonMatch[0] : formText);
            } catch {
                extractedData = { notes: formText };
            }

            // 5. 등록상담 폼 데이터 저장
            await reportRef.update({
                status: "completed", statusMessage: "분석 완료", extractedData, updatedAt: Date.now(),
            });

            // (B) 상담녹음 심층분석 결과 처리 → consultation_reports 자동 생성
            try {
                if (!analysisResponse.ok) {
                    logger.error("[processRegistrationRecording] 상담분석 Claude 오류:", analysisResponse.status);
                } else {
                    const analysisData = await analysisResponse.json();
                    const analysisText = analysisData.content?.[0]?.text || "";

                    let report;
                    try {
                        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
                        report = JSON.parse(jsonMatch ? jsonMatch[0] : analysisText);
                    } catch {
                        report = { summary: analysisText, parentRequests: "", studentNotes: "", agreements: "", actionItems: "" };
                    }

                    const speakerRoles = report.speakerRoles || {};
                    delete report.speakerRoles;

                    // consultation_reports 문서 생성
                    const consultReportRef = db.collection("consultation_reports").doc();
                    const consultNow = Date.now();
                    await consultReportRef.set({
                        studentId: "",
                        studentName,
                        consultantName: counselorName || "",
                        consultationDate: consultationDate || "",
                        fileName: fileName || storagePath.split("/").pop(),
                        storagePath,
                        fileSizeBytes: 0,
                        durationSeconds: audioDuration,
                        status: "completed",
                        statusMessage: "분석이 완료되었습니다.",
                        transcription: fullText,
                        speakerLabels,
                        report,
                        speakerRoles,
                        sourceType: "registration",
                        registrationReportId: reportRef.id,
                        createdAt: consultNow,
                        updatedAt: consultNow,
                        createdBy: context.auth.uid,
                    });
                    logger.info("[processRegistrationRecording] consultation_reports 자동 생성 완료", { consultReportId: consultReportRef.id });

                    // student_consultations 자동 기록 생성
                    try {
                        await db.collection("student_consultations").add({
                            studentId: "",
                            studentName,
                            consultantName: counselorName || "",
                            type: "parent",
                            category: "general",
                            title: `[등록상담 녹음분석] ${consultationDate || ""} 상담`,
                            content: report.summary || "",
                            date: consultationDate || "",
                            followUpNeeded: !!(report.actionItems && report.actionItems.trim() && !report.actionItems.includes("없음")),
                            followUpDone: false,
                            followUpNotes: report.actionItems || "",
                            consultationReportId: consultReportRef.id,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            createdBy: context.auth.uid,
                            autoGenerated: true,
                        });
                        logger.info("[processRegistrationRecording] student_consultations 자동 생성 완료");
                    } catch (autoErr) {
                        logger.error("[processRegistrationRecording] student_consultations 생성 실패:", autoErr);
                    }
                }
            } catch (analysisErr) {
                // 상담분석 실패해도 폼 추출은 이미 성공 → 에러 로그만 남김
                logger.error("[processRegistrationRecording] 상담분석 처리 실패 (폼 추출은 정상):", analysisErr);
            }

            logger.info("[processRegistrationRecording] Complete", { reportId: reportRef.id });
            return { reportId: reportRef.id, status: "completed", extractedData };

        } catch (error) {
            logger.error("[processRegistrationRecording] Error:", error);
            await reportRef.update({ status: "error", statusMessage: "처리 중 오류", errorMessage: error.message || "", updatedAt: Date.now() });
            throw new functions.https.HttpsError("internal", error.message || "등록 상담 녹음 분석 실패");
        }
    });

/**
 * AssemblyAI 실시간 전사용 임시 토큰 생성
 * 프론트엔드에서 WebSocket 연결 시 사용
 */
exports.createRealtimeToken = functions
    .region("asia-northeast3")
    .runWith({
        timeoutSeconds: 10,
        memory: "128MB",
        secrets: ["ASSEMBLYAI_API_KEY"],
    })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
        }

        const assemblyAiKey = process.env.ASSEMBLYAI_API_KEY;
        if (!assemblyAiKey) {
            throw new functions.https.HttpsError("failed-precondition", "AssemblyAI API 키가 설정되지 않았습니다.");
        }

        try {
            const tokenUrl = new URL("https://streaming.assemblyai.com/v3/token");
            tokenUrl.search = new URLSearchParams({ expires_in_seconds: "600" }).toString();
            const response = await fetch(tokenUrl, {
                method: "GET",
                headers: { "Authorization": assemblyAiKey },
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`토큰 생성 실패: ${response.status} - ${errText}`);
            }

            const tokenData = await response.json();
            return { token: tokenData.token };
        } catch (error) {
            logger.error("[createRealtimeToken] Error:", error);
            throw new functions.https.HttpsError("internal", error.message || "토큰 생성 실패");
        }
    });

// ============ 회의록 녹음 분석 ============

const MEETING_WORD_BOOST = [
    ...ACADEMY_WORD_BOOST,
    "회의", "안건", "발표", "논의", "결정", "합의", "투표",
    "찬성", "반대", "보류", "제안", "건의", "보고",
    "예산", "실적", "매출", "목표", "달성률",
    "인사", "채용", "퇴사", "승진", "발령",
    "교육과정", "커리큘럼", "신규프로그램", "폐강",
    "학부모설명회", "공개수업", "학원행사", "체험수업",
    "시설", "리모델링", "장비", "교구",
    "마케팅", "홍보", "전단", "블로그",
    "경쟁학원", "시장조사", "트렌드",
    "민원", "컴플레인", "개선", "피드백",
];

/**
 * 회의 녹음 분석 — AssemblyAI 전사 + Claude 회의록 생성
 */
exports.processMeetingRecording = functions
    .region("asia-northeast3")
    .runWith({
        timeoutSeconds: 540,
        memory: "1GB",
        secrets: ["ASSEMBLYAI_API_KEY", "ANTHROPIC_API_KEY"],
    })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
        }

        const { reportId: existingReportId, storagePath, title, attendees, meetingDate, recorder, fileName } = data;
        if (!storagePath || !title) {
            throw new functions.https.HttpsError("invalid-argument", "필수 정보(storagePath, title)가 누락되었습니다.");
        }

        const assemblyAiKey = process.env.ASSEMBLYAI_API_KEY;
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (!assemblyAiKey || !anthropicKey) {
            throw new functions.https.HttpsError("failed-precondition", "API keys not configured");
        }

        const COLLECTION = "meeting_reports";
        const reportRef = existingReportId
            ? db.collection(COLLECTION).doc(existingReportId)
            : db.collection(COLLECTION).doc();
        const now = Date.now();

        const docData = {
            title: title || "",
            attendees: attendees || [],
            meetingDate: meetingDate || "",
            recorder: recorder || "",
            fileName: fileName || storagePath.split("/").pop(),
            storagePath,
            fileSizeBytes: 0,
            status: "transcribing",
            statusMessage: "음성 인식을 시작합니다...",
            updatedAt: now,
            createdBy: context.auth.uid,
        };
        if (existingReportId) {
            await reportRef.update(docData);
        } else {
            await reportRef.set({ ...docData, createdAt: now });
        }

        try {
            // Signed URL 생성
            const bucket = admin.storage().bucket();
            const file = bucket.file(storagePath);
            const [metadata] = await file.getMetadata();
            const fileSizeMB = (parseInt(metadata.size || "0") / 1024 / 1024).toFixed(1);
            const [signedUrl] = await file.getSignedUrl({
                action: "read",
                expires: Date.now() + 30 * 60 * 1000,
            });

            await reportRef.update({
                fileSizeBytes: parseInt(metadata.size || "0"),
                statusMessage: `파일 확인 완료 (${fileSizeMB}MB). 음성 인식 중...`,
                updatedAt: Date.now(),
            });

            // AssemblyAI 전사 요청
            const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
                method: "POST",
                headers: {
                    "Authorization": assemblyAiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    audio_url: signedUrl,
                    language_code: "ko",
                    speaker_labels: true,
                    speech_models: ["universal-3-pro", "universal-2"],
                    word_boost: MEETING_WORD_BOOST,
                    boost_param: "high",
                }),
            });

            if (!transcriptResponse.ok) {
                const errText = await transcriptResponse.text();
                throw new Error(`AssemblyAI 요청 실패: ${transcriptResponse.status} - ${errText}`);
            }

            const transcriptData = await transcriptResponse.json();
            const transcriptId = transcriptData.id;

            await reportRef.update({
                statusMessage: "음성 인식 서버에 전송 완료. 분석 대기 중...",
                updatedAt: Date.now(),
            });

            // 폴링 (5초 간격, 최대 7.5분)
            let transcriptResult;
            let pollCount = 0;
            const maxPolls = 90;

            while (pollCount < maxPolls) {
                await new Promise(resolve => setTimeout(resolve, 5000));

                const pollResponse = await fetch(
                    `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
                    { headers: { "Authorization": assemblyAiKey } }
                );
                transcriptResult = await pollResponse.json();

                if (transcriptResult.status === "completed") break;
                if (transcriptResult.status === "error") {
                    throw new Error(`음성 인식 실패: ${transcriptResult.error}`);
                }

                if (pollCount % 2 === 0) {
                    const progressPct = Math.min(Math.round((pollCount / maxPolls) * 95), 95);
                    const statusLabel = transcriptResult.status === "queued"
                        ? `음성 인식 준비 중... (${progressPct}%)`
                        : `음성을 텍스트로 변환 중... (${progressPct}%)`;
                    await reportRef.update({
                        statusMessage: statusLabel,
                        updatedAt: Date.now(),
                    });
                }
                pollCount++;
            }

            if (!transcriptResult || transcriptResult.status !== "completed") {
                throw new Error("음성 인식 시간 초과");
            }

            // 결과 추출
            const fullText = (transcriptResult.text || "").trim();
            const speakerLabels = (transcriptResult.utterances || []).map(u => ({
                speaker: u.speaker,
                text: u.text,
                start: u.start,
                end: u.end,
            }));
            const audioDuration = Math.round(transcriptResult.audio_duration || 0);

            // 유효성 검증
            const textLength = fullText.replace(/\s+/g, "").length;
            if (!fullText || textLength < 30) {
                await reportRef.update({
                    status: "failed",
                    statusMessage: textLength === 0
                        ? "음성에서 텍스트를 인식하지 못했습니다. 녹음 파일을 확인해주세요."
                        : `인식된 텍스트가 너무 짧습니다 (${textLength}자). 회의 내용이 충분히 녹음되었는지 확인해주세요.`,
                    transcription: fullText || null,
                    durationSeconds: audioDuration,
                    updatedAt: Date.now(),
                });
                return { reportId: reportRef.id, status: "failed" };
            }

            if (audioDuration > 0 && audioDuration < 5) {
                await reportRef.update({
                    status: "failed",
                    statusMessage: `녹음 시간이 너무 짧습니다 (${audioDuration}초). 5초 이상의 녹음이 필요합니다.`,
                    transcription: fullText,
                    durationSeconds: audioDuration,
                    updatedAt: Date.now(),
                });
                return { reportId: reportRef.id, status: "failed" };
            }

            const speakerCount = new Set(speakerLabels.map(s => s.speaker)).size;
            const durationMin = Math.floor(audioDuration / 60);
            const durationSec = audioDuration % 60;
            const durationStr = durationMin > 0 ? `${durationMin}분 ${durationSec}초` : `${durationSec}초`;
            await reportRef.update({
                status: "analyzing",
                statusMessage: `음성 인식 완료 (${durationStr}, 화자 ${speakerCount}명). AI가 회의록 작성 중...`,
                transcription: fullText,
                speakerLabels,
                durationSeconds: audioDuration,
                updatedAt: Date.now(),
            });

            // Claude API 회의록 분석
            const formattedTranscript = speakerLabels.length > 0
                ? speakerLabels.map(s => `[화자 ${s.speaker}] ${s.text}`).join("\n")
                : fullText;

            const attendeeStr = (attendees || []).join(", ") || "미지정";

            const claudeResponse = await fetchClaudeWithRetry("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "x-api-key": anthropicKey,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "claude-sonnet-4-20250514",
                    max_tokens: 8192,
                    messages: [{ role: "user", content: `당신은 학원 내부 회의 기록을 정밀하게 분석하는 조직 관리 전문가입니다.

다음은 학원 교직원 회의/발표 녹음을 텍스트로 변환한 것입니다.
음성인식(ASR) 특성상 고유명사(인명, 지명, 학원명 등)가 잘못 인식될 수 있습니다.
같은 사람을 가리키는 유사한 이름이 여러 형태로 나타나면 하나로 통일하되, 통일한 사실을 메모해주세요.
화자가 구분되어 있으며, 대화 맥락을 바탕으로 역할(원장, 부원장, 실장, 팀장, 교사 등)을 추정해주세요.

회의 제목: ${title}
회의일: ${meetingDate || "미지정"}
참석자: ${attendeeStr}
기록자: ${recorder || "미지정"}

--- 회의 내용 ---
${formattedTranscript}
--- 끝 ---

위 회의 내용을 심층 분석하여 회의록을 작성해주세요.

분석 시 반드시 주의할 점:
1. 회의의 유형을 정확히 파악하세요 (정기 운영회의, 임시회의, 교사연수, 발표/세미나, 브레인스토밍, 학부모설명회 준비회의 등).
2. 안건(주제)이 여러 개인 경우 각 안건별로 논의 내용을 분리하여 정리하세요.
3. 결정 사항은 "누가 제안했고, 반대 의견은 무엇이었으며, 최종 어떻게 결정되었는지"를 명확히 기록하세요.
4. 액션 아이템은 반드시 담당자와 기한을 포함하세요. 기한이 명시되지 않았으면 "(기한 미정)"으로 표기하세요.
5. 참석자별 발언을 요약할 때 각 참석자의 입장/주장/관점을 중립적으로 기록하세요.
6. 미해결 이슈, 갈등 포인트, 위험 요소를 놓치지 마세요:
   - 의견 충돌이 해소되지 않은 안건
   - 예산/인력 부족으로 실행이 불확실한 계획
   - 불만이나 소진(번아웃) 신호를 보이는 참석자
   - 외부 리스크 (경쟁, 규제, 민원 등)
7. 향후 계획에는 다음 회의 일정, 후속 작업, 중장기 로드맵이 언급되었으면 반드시 포함하세요.

대화의 행간, 분위기, 뉘앙스까지 읽어서 회의의 실질적인 의사결정 과정을 파악해주세요.

중요: 각 JSON 값 내에서 항목을 구분할 때 반드시 줄바꿈(\\n)을 사용하세요.
불릿 포인트(-)는 각각 새 줄에 작성하세요. 예시: "- 첫번째 항목\\n- 두번째 항목"

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "speakerRoles": {"A": "원장", "B": "실장", "C": "수학팀장"},
  "meetingType": "회의 유형 한 줄 요약",
  "summary": "회의의 전체적인 요약 (5-7문장).\\n회의 목적, 핵심 논의 흐름, 주요 결론을 포함.",
  "agendaDiscussion": "안건별 논의 내용.\\n[안건 1: 제목] 내용...\\n[안건 2: 제목] 내용...\\n각 안건에서 누가 어떤 의견을 냈는지 기록.",
  "decisions": "확정된 결정 사항.\\n각 결정에 대해: 제안자, 반대 의견, 최종 결정 내용.\\n각 항목은 - 불릿으로 줄바꿈",
  "actionItems": "후속 조치/실행 항목.\\n형식: - [담당자] 내용 (기한: YYYY-MM-DD 또는 기한 미정).\\n각 항목은 - 불릿으로 줄바꿈",
  "speakerSummary": "참석자별 발언 요약.\\n[이름/역할] 주요 발언과 입장 요약.\\n각 참석자를 - 불릿으로 구분",
  "concerns": "우려/이슈 사항.\\n미해결 문제, 의견 충돌, 리스크.\\n해당 없으면 '특별한 우려 사항 없음'.\\n각 항목은 - 불릿으로 줄바꿈",
  "nextSteps": "향후 계획.\\n다음 회의 일정, 후속 작업 일정, 중장기 로드맵.\\n각 항목은 - 불릿으로 줄바꿈"
}` }],
                }),
            });

            if (!claudeResponse.ok) {
                const errBody = await claudeResponse.text();
                throw new Error(`Claude API 오류: ${claudeResponse.status} - ${errBody}`);
            }

            const claudeData = await claudeResponse.json();
            const reportText = claudeData.content?.[0]?.text || "";

            let report;
            try {
                const jsonMatch = reportText.match(/\{[\s\S]*\}/);
                report = JSON.parse(jsonMatch ? jsonMatch[0] : reportText);
            } catch {
                report = {
                    summary: reportText,
                    meetingType: "", agendaDiscussion: "", decisions: "",
                    actionItems: "", speakerSummary: "", concerns: "", nextSteps: "",
                };
            }

            const speakerRoles = report.speakerRoles || {};
            delete report.speakerRoles;

            await reportRef.update({
                status: "completed",
                statusMessage: "회의록 작성이 완료되었습니다.",
                report,
                speakerRoles,
                updatedAt: Date.now(),
            });

            logger.info("[processMeetingRecording] Complete", { reportId: reportRef.id });
            return { reportId: reportRef.id, status: "completed" };

        } catch (error) {
            logger.error("[processMeetingRecording] Error:", error);
            let userMessage = "처리 중 오류가 발생했습니다.";
            const errMsg = error.message || "";
            if (errMsg.includes("deadline") || errMsg.includes("timeout") || errMsg.includes("시간 초과")) {
                userMessage = "처리 시간이 초과되었습니다. 파일이 너무 크거나 서버가 바쁜 상태입니다.";
            } else if (errMsg.includes("AssemblyAI")) {
                userMessage = `음성 인식 서비스 오류: ${errMsg}`;
            } else if (errMsg.includes("Claude")) {
                userMessage = `AI 분석 서비스 오류: ${errMsg}`;
            }
            await reportRef.update({
                status: "error",
                statusMessage: userMessage,
                errorMessage: errMsg,
                updatedAt: Date.now(),
            });
            throw new functions.https.HttpsError("internal", errMsg || "회의록 분석 실패");
        }
    });

/**
 * 기존 회의록을 새 알고리즘으로 재분석 (음성인식 스킵)
 */
exports.reanalyzeMeetingReport = functions
    .region("asia-northeast3")
    .runWith({
        timeoutSeconds: 300,
        memory: "512MB",
        secrets: ["ANTHROPIC_API_KEY"],
    })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
        }

        const { reportId } = data;
        if (!reportId) {
            throw new functions.https.HttpsError("invalid-argument", "reportId가 필요합니다.");
        }

        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (!anthropicKey) {
            throw new functions.https.HttpsError("failed-precondition", "ANTHROPIC_API_KEY not configured");
        }

        const reportRef = db.collection("meeting_reports").doc(reportId);
        const reportDoc = await reportRef.get();
        if (!reportDoc.exists) {
            throw new functions.https.HttpsError("not-found", "회의록을 찾을 수 없습니다.");
        }

        const reportData = reportDoc.data();
        const { transcription, speakerLabels, title, meetingDate, attendees, recorder } = reportData;

        if (!transcription) {
            throw new functions.https.HttpsError("failed-precondition", "음성인식 결과가 없습니다.");
        }

        try {
            await reportRef.update({ status: "analyzing", statusMessage: "AI가 새로운 알고리즘으로 재분석 중...", updatedAt: Date.now() });

            const formattedTranscript = (speakerLabels || []).length > 0
                ? speakerLabels.map(s => `[화자 ${s.speaker}] ${s.text}`).join("\n")
                : transcription;

            const attendeeStr = (attendees || []).join(", ") || "미지정";

            const claudeResponse = await fetchClaudeWithRetry("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "x-api-key": anthropicKey,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "claude-sonnet-4-20250514",
                    max_tokens: 8192,
                    messages: [{ role: "user", content: `당신은 학원 내부 회의 기록을 정밀하게 분석하는 조직 관리 전문가입니다.

다음은 학원 교직원 회의/발표 녹음을 텍스트로 변환한 것입니다.
음성인식(ASR) 특성상 고유명사가 잘못 인식될 수 있습니다.
같은 사람을 가리키는 유사한 이름은 하나로 통일하되, 통일한 사실을 메모해주세요.

회의 제목: ${title || "미지정"}
회의일: ${meetingDate || "미지정"}
참석자: ${attendeeStr}
기록자: ${recorder || "미지정"}

--- 회의 내용 ---
${formattedTranscript}
--- 끝 ---

위 회의 내용을 심층 분석하여 회의록을 작성해주세요.

분석 시 주의할 점:
1. 회의 유형을 정확히 파악하세요.
2. 안건별로 논의 내용을 분리 정리하세요.
3. 결정 사항은 제안자, 반대 의견, 최종 결정을 명확히 기록하세요.
4. 액션 아이템은 담당자와 기한을 포함하세요.
5. 참석자별 발언을 중립적으로 요약하세요.
6. 미해결 이슈, 갈등, 리스크를 놓치지 마세요.
7. 향후 계획(다음 회의, 후속 작업, 로드맵)을 포함하세요.

중요: 각 JSON 값 내에서 항목을 구분할 때 반드시 줄바꿈(\\n)을 사용하세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "speakerRoles": {"A": "원장", "B": "실장"},
  "meetingType": "회의 유형 한 줄 요약",
  "summary": "회의 요약 (5-7문장)",
  "agendaDiscussion": "안건별 논의 내용",
  "decisions": "결정 사항",
  "actionItems": "액션 아이템 (담당자, 기한 포함)",
  "speakerSummary": "참석자별 발언 요약",
  "concerns": "우려/이슈 사항",
  "nextSteps": "향후 계획"
}` }],
                }),
            });

            if (!claudeResponse.ok) {
                throw new Error(`Claude API 오류: ${claudeResponse.status}`);
            }

            const claudeData = await claudeResponse.json();
            const reportText = claudeData.content?.[0]?.text || "";

            let report;
            try {
                const jsonMatch = reportText.match(/\{[\s\S]*\}/);
                report = JSON.parse(jsonMatch ? jsonMatch[0] : reportText);
            } catch {
                report = { summary: reportText };
            }

            const speakerRoles = report.speakerRoles || {};
            delete report.speakerRoles;

            await reportRef.update({
                status: "completed",
                statusMessage: "재분석이 완료되었습니다.",
                report,
                speakerRoles,
                updatedAt: Date.now(),
            });

            return { success: true };
        } catch (error) {
            logger.error("[reanalyzeMeetingReport] Error:", error);
            await reportRef.update({
                status: "completed",
                statusMessage: "재분석 실패 - 이전 분석 결과를 유지합니다.",
                errorMessage: error.message || "",
                updatedAt: Date.now(),
            });
            throw new functions.https.HttpsError("internal", error.message || "회의록 재분석 실패");
        }
    });

/**
 * =========================================================
 * Cloud Function: 녹음 파일 자동 정리 (120일 경과)
 * =========================================================
 * 매일 새벽 3시(KST) 실행.
 * 3개 녹음 컬렉션에서 120일 이상 지난 문서의 Storage 파일을 삭제하고,
 * Firestore 문서에 만료 표시를 남깁니다. (분석 결과는 영구 보존)
 *
 * 대상 컬렉션:
 * - meeting_reports (회의록)
 * - consultation_reports (상담 녹음) — crossAnalysis 문서는 파일 삭제 건너뜀
 * - registration_recording_reports (등록 상담)
 */
exports.cleanupExpiredRecordings = functions
    .region("asia-northeast3")
    .runWith({ timeoutSeconds: 300, memory: "256MB" })
    .pubsub.schedule("0 3 * * *")
    .timeZone("Asia/Seoul")
    .onRun(async (context) => {
        const RETENTION_DAYS = 120;
        const cutoffMs = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const bucket = admin.storage().bucket();
        const summary = [];

        const collections = [
            { name: "meeting_reports", skipCrossAnalysis: false },
            { name: "consultation_reports", skipCrossAnalysis: true },
            { name: "registration_recording_reports", skipCrossAnalysis: false },
        ];

        for (const col of collections) {
            const stats = { collection: col.name, processed: 0, deleted: 0, alreadyGone: 0, skippedCross: 0, errors: 0 };

            try {
                const snapshot = await db.collection(col.name)
                    .where("createdAt", "<", cutoffMs)
                    .limit(500)
                    .get();

                // storagePath가 있고 아직 만료 처리되지 않은 문서만 필터
                const docs = snapshot.docs.filter(d => {
                    const data = d.data();
                    return data.storagePath && !data.fileExpired;
                });

                if (docs.length === 0) {
                    logger.info(`[cleanupExpiredRecordings] ${col.name}: 정리 대상 없음`);
                    summary.push(stats);
                    continue;
                }

                logger.info(`[cleanupExpiredRecordings] ${col.name}: ${docs.length}건 정리 시작`);

                const batch = db.batch();
                let batchCount = 0;

                for (const docSnap of docs) {
                    const data = docSnap.data();
                    const isCrossAnalysis = col.skipCrossAnalysis && data.crossAnalysis === true;

                    // Storage 파일 삭제 (crossAnalysis가 아닌 경우만)
                    if (!isCrossAnalysis) {
                        try {
                            await bucket.file(data.storagePath).delete();
                            stats.deleted++;
                        } catch (err) {
                            if (err.code === 404 || err.message?.includes("No such object")) {
                                stats.alreadyGone++;
                            } else {
                                logger.error(`[cleanupExpiredRecordings] ${col.name}/${docSnap.id} 파일 삭제 오류:`, err.message);
                                stats.errors++;
                                continue;
                            }
                        }
                    } else {
                        stats.skippedCross++;
                    }

                    // Firestore 문서 만료 표시 (분석 결과는 보존)
                    batch.update(docSnap.ref, {
                        storagePath: "",
                        fileExpired: true,
                        fileExpiredAt: Date.now(),
                        updatedAt: Date.now(),
                    });
                    batchCount++;
                    stats.processed++;

                    if (batchCount >= 450) break;
                }

                if (batchCount > 0) {
                    await batch.commit();
                }

                logger.info(`[cleanupExpiredRecordings] ${col.name}: 완료`, stats);
            } catch (error) {
                logger.error(`[cleanupExpiredRecordings] ${col.name} 처리 오류:`, error);
                stats.errors++;
            }

            summary.push(stats);
        }

        logger.info("[cleanupExpiredRecordings] 전체 요약:", JSON.stringify(summary));
        return null;
    });

// ============ Google Calendar 동기화 ============
const googleCalendarSync = require("./googleCalendarSync");
exports.syncEventToGcal = googleCalendarSync.syncEventToGcal;
exports.triggerGcalSync = googleCalendarSync.triggerGcalSync;

