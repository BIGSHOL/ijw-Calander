/**
 * Firestore에서 수학 시간표 데이터를 수집하여 `timetableExporter` 입력 형태로 변환.
 *
 * 출력:
 *   {
 *     exportParams: {                       // exportMathTimetableToBuffer() 입력
 *       weekLabel, filteredClasses, allResources, orderedSelectedDays,
 *       weekDates, teachers, currentPeriods, subjectFilter, referenceDate
 *     },
 *     teachers: [{ id, name, email, isActive }],   // 강사별 시트 빌드용
 *     adminEmails: ['admin@...', ...],              // 시트 공유용
 *   }
 *
 * 또는 데이터 없으면 { exportParams: null }
 */

const { getFirestore } = require("firebase-admin/firestore");

const DATABASE_ID = "restore20260319";

// 수학 시간표용 기본 교시 (constants.ts MATH_PERIODS 동일)
const MATH_PERIODS = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2", "4-1", "4-2"];
const ALL_WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

// ============ KST 헬퍼 ============

function getTodayKST() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().split("T")[0];
}

function toDateStringKST(value) {
    if (!value) return null;
    if (typeof value === "string") {
        // YYYY-MM-DD 형식이면 그대로
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
        // ISO 등은 Date로 파싱 후 KST 변환
        const d = new Date(value);
        if (isNaN(d.getTime())) return null;
        const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
        return kst.toISOString().split("T")[0];
    }
    if (value.toDate) {
        // Firestore Timestamp
        const d = value.toDate();
        const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
        return kst.toISOString().split("T")[0];
    }
    return null;
}

/**
 * 현재 주차의 월요일 ~ 일요일 날짜 계산
 * @param {Date} now - 기준 시각 (생략 시 오늘 KST)
 * @returns {{ weekLabel: string, weekDates: Record<string,{date,formatted}> }}
 */
function computeCurrentWeek(now) {
    const base = now || new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    const dayOfWeek = base.getDay(); // 0(일)~6(토)
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(base);
    monday.setDate(base.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const weekDates = {};
    ALL_WEEKDAYS.forEach((day, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        weekDates[day] = { date: d, formatted: `${m}/${dd}` };
    });

    const startStr = `${monday.getMonth() + 1}/${monday.getDate()}`;
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const endStr = `${sunday.getMonth() + 1}/${sunday.getDate()}`;
    const weekLabel = `${monday.getFullYear()} ${startStr}~${endStr}`;

    return { weekLabel, weekDates };
}

// ============ Firestore 데이터 수집 ============

/**
 * classes 컬렉션에서 수학 수업 조회
 */
async function fetchMathClasses(db) {
    const snapshot = await db
        .collection("classes")
        .where("subject", "==", "math")
        .where("isActive", "==", true)
        .get();

    return snapshot.docs.map(doc => {
        const data = doc.data();
        // schedule 형식 통일: [{day, periodId}] → "월 1-1" 형태 문자열 배열
        const scheduleStrings = Array.isArray(data.schedule)
            ? data.schedule.map(slot => {
                if (typeof slot === "string") return slot;
                if (slot && typeof slot === "object") {
                    return `${slot.day || ""} ${slot.periodId || ""}`.trim();
                }
                return "";
            }).filter(Boolean)
            : (data.legacySchedule || []);

        return {
            id: doc.id,
            className: data.className || "",
            teacher: data.mainTeacher || data.teacher || "",
            staffId: data.staffId || data.mainTeacherStaffId || null,
            subject: data.subject || "math",
            schedule: scheduleStrings,
            room: data.room || "",
            slotTeachers: data.slotTeachers || {},
            slotRooms: data.slotRooms || {},
            bgColor: data.bgColor || null,
            textColor: data.textColor || null,
        };
    });
}

/**
 * 모든 학생의 enrollment 조회 (수학 과목)
 * collectionGroup('enrollments')로 한 번에 조회
 */
async function fetchMathEnrollments(db) {
    const snapshot = await db
        .collectionGroup("enrollments")
        .where("subject", "==", "math")
        .get();

    const today = getTodayKST();

    // studentId × className 매핑
    const result = [];
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const studentId = doc.ref.parent.parent && doc.ref.parent.parent.id;
        if (!studentId) return;

        // 시작 전 (미래 배정) 제외
        const enrollmentDate = toDateStringKST(data.enrollmentDate);
        const startDate = enrollmentDate || toDateStringKST(data.startDate);
        if (startDate && startDate > today) return;

        result.push({
            studentId,
            className: data.className || "",
            classId: data.classId || null,
            enrollmentDate: enrollmentDate,
            firstSubjectEnrollmentDate: toDateStringKST(data.firstSubjectEnrollmentDate),
            withdrawalDate: toDateStringKST(data.withdrawalDate || data.endDate),
            isTransferred: !!data.isTransferred,
            isTransferredIn: !!data.isTransferredIn,
            underline: !!data.underline,
            onHold: !!data.onHold,
            attendanceDays: Array.isArray(data.attendanceDays) ? data.attendanceDays : null,
        });
    });
    return result;
}

/**
 * students 컬렉션에서 학생 정보 조회
 */
async function fetchStudents(db) {
    const snapshot = await db.collection("students").get();
    const map = new Map();
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        map.set(doc.id, {
            id: doc.id,
            name: data.이름 || data.name || "",
            school: data.학교 || data.school || "",
            grade: data.학년 || data.grade || "",
        });
    });
    return map;
}

/**
 * staff 컬렉션에서 강사 정보 조회 (시간표 표시 강사만)
 */
async function fetchTeachers(db) {
    const snapshot = await db.collection("staff").get();
    const teachers = [];
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        // teacher 역할만 + status active
        const isTeacherRole = data.role === "teacher" || data.role === "강사";
        if (!isTeacherRole) return;
        // 시간표에서 숨김 처리된 강사 제외
        if (data.isHiddenInTimetable === true) return;
        // 수학 부서 (departments에 'math' 또는 'highmath' 포함, 또는 departments 자체가 없으면 전부)
        const depts = data.departments;
        const isMathDept = !depts || (Array.isArray(depts) && (depts.includes("math") || depts.includes("highmath")));
        if (!isMathDept) return;

        teachers.push({
            id: doc.id,
            name: data.name || "",
            email: data.email || "",
            bgColor: data.bgColor || null,
            textColor: data.textColor || null,
            teacherOrder: typeof data.teacherOrder === "number" ? data.teacherOrder : 9999,
            isActive: data.status !== "inactive" && data.status !== "resigned",
        });
    });

    // teacherOrder 오름차순
    teachers.sort((a, b) => a.teacherOrder - b.teacherOrder);
    return teachers;
}

/**
 * 관리자 (master/admin) 이메일 조회
 */
async function fetchAdminEmails(db) {
    const snapshot = await db
        .collection("staff")
        .where("systemRole", "in", ["master", "admin"])
        .get();
    const emails = [];
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.email) emails.push(data.email);
    });
    return Array.from(new Set(emails));
}

// ============ 메인 ============

/**
 * 수학 시간표 데이터 수집 → exportParams 생성
 *
 * @returns {Promise<{
 *   exportParams: object | null,
 *   teachers: Array<{id, name, email, isActive}>,
 *   adminEmails: string[]
 * }>}
 */
async function collectTimetableData() {
    const db = getFirestore(DATABASE_ID);

    // 병렬 fetch
    const [classes, enrollments, studentMap, teachers, adminEmails] = await Promise.all([
        fetchMathClasses(db),
        fetchMathEnrollments(db),
        fetchStudents(db),
        fetchTeachers(db),
        fetchAdminEmails(db),
    ]);

    if (classes.length === 0) {
        return { exportParams: null, teachers, adminEmails };
    }

    // 각 수업에 학생 리스트 붙이기 (className 기준 매칭)
    const enrollmentsByClassName = new Map();
    enrollments.forEach(e => {
        if (!enrollmentsByClassName.has(e.className)) {
            enrollmentsByClassName.set(e.className, []);
        }
        enrollmentsByClassName.get(e.className).push(e);
    });

    const today = getTodayKST();
    const todayMs = new Date(today).getTime();

    const filteredClasses = classes.map(cls => {
        const enrollmentList = enrollmentsByClassName.get(cls.className) || [];
        const studentList = enrollmentList
            .map(e => {
                const student = studentMap.get(e.studentId);
                if (!student) return null;
                return {
                    id: student.id,
                    name: student.name,
                    school: student.school,
                    grade: student.grade,
                    enrollmentDate: e.enrollmentDate,
                    firstSubjectEnrollmentDate: e.firstSubjectEnrollmentDate,
                    withdrawalDate: e.withdrawalDate,
                    isTransferred: e.isTransferred,
                    isTransferredIn: e.isTransferredIn,
                    underline: e.underline,
                    onHold: e.onHold,
                    attendanceDays: e.attendanceDays,
                };
            })
            .filter(Boolean);
        return { ...cls, studentList };
    });

    // 강사 이름 배열 (순서대로) - 활성 강사만
    const activeTeachers = teachers.filter(t => t.isActive);
    const allResources = activeTeachers.map(t => t.name).filter(Boolean);

    // 현재 주차
    const { weekLabel, weekDates } = computeCurrentWeek();

    const exportParams = {
        weekLabel,
        filteredClasses,
        allResources,
        orderedSelectedDays: ALL_WEEKDAYS,
        weekDates,
        teachers: activeTeachers, // bgColor/textColor 참조용
        currentPeriods: MATH_PERIODS,
        subjectFilter: "수학",
        referenceDate: today,
    };

    return { exportParams, teachers, adminEmails };
}

module.exports = {
    collectTimetableData,
    computeCurrentWeek,
    getTodayKST,
    toDateStringKST,
};
