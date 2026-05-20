import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Consultation, ConsultationCategory, StaffMember, UnifiedStudent } from '../types';
import { COL_STUDENT_CONSULTATIONS } from './useStudentConsultations';
import { DailyConsultationStat } from '../components/Dashboard/CounselingOverview';
import { CategoryStat } from '../components/Dashboard/CategoryStats';
import { StaffPerformance } from '../components/Dashboard/PerformanceProgress';
import { COL_STUDENTS } from './useStudents';

/**
 * 상담 통계 필터 옵션
 */
export interface ConsultationStatsFilters {
  dateRange?: { start: string; end: string };
  subject?: 'math' | 'english' | 'all';
}

/**
 * 선생님별 과목별 상담 통계
 */
export interface StaffSubjectStat {
  id: string;
  name: string;
  mathCount: number;
  mathTotal: number;  // 수학 전체 필요 상담 건수
  englishCount: number;
  englishTotal: number;  // 영어 전체 필요 상담 건수
  totalCount: number;
  totalNeeded: number;  // 전체 필요 상담 건수
}

/**
 * 상담 미완료 사유
 */
export type ConsultationMissingReason =
  | 'new_student'     // 신입생 (등록 30일 이내) — 아직 상담 일정 잡힐 시간 부족
  | 'recent_consult'  // 최근 상담 (30일 이내) — 굳이 이번 달 또 안 해도 됨
  | 'no_response'     // 연락 미응답 — 학부모 연락 시도했으나 응답 없음
  | 'pending';        // 진행 대기중 — 진짜 액션 필요

/**
 * 상담 미완료 학생 정보 (과목별)
 * - 수학/영어를 동시 수강 중인 학생은 과목별로 2개 항목 생성
 */
export interface StudentNeedingConsultation {
  studentId: string;
  studentName: string;
  subject: 'math' | 'english';  // 해당 과목
  lastConsultationDate?: string;  // 해당 과목의 가장 최근 상담일 (전체 기간)
  reason: ConsultationMissingReason;  // 미완료 사유
  reasonDetail?: string;  // 사유 상세 (예: "5일 전 상담", "이번 달 등록")
}

/**
 * 통계 결과 타입
 */
export interface ConsultationStatsResult {
  dailyStats: DailyConsultationStat[];
  categoryStats: CategoryStat[];
  staffPerformances: StaffPerformance[];
  /** 전화상담 0건인 강사 (별도 분류 표시) */
  inactiveTeachers: { id: string; name: string; subjects: string[] }[];
  staffSubjectStats: StaffSubjectStat[];
  topPerformer: StaffPerformance | null;
  totalConsultations: number;
  parentConsultations: number;
  studentConsultations: number;
  followUpNeeded: number;
  followUpDone: number;
  studentsNeedingConsultation: StudentNeedingConsultation[];
  totalActiveStudents: number;  // 전체 재원생 수 (status === 'active')
  totalSubjectEnrollments: number;  // 전체 과목 수강 건수 (수학+영어 동시 수강 → 2건)
  completedCount: number;  // 이번 달 상담 완료된 (학생×과목) 건수
  meaningfulTargetCount: number;  // 상담 대상 (학생×과목) — 이력/예정 0 건인 진행 대기중 제외
}

/**
 * 월간 상담 목표 (기본값)
 */
export const DEFAULT_MONTHLY_TARGET = 100;

/**
 * 상담 통계 조회 Hook (성능 최적화 버전)
 * - 일별/카테고리별/상담자별 통계
 * - 대시보드용 집계 데이터
 * - 상담 미완료 학생 목록
 *
 * 최적화 내용:
 * - Firestore 서버사이드 날짜 필터링 (where 사용)
 * - 중복 쿼리 제거 (allConsultationsQuery 제거)
 * - collectionGroup 대신 학생 문서 내 enrollments 배열 활용
 */
export function useConsultationStats(
  filters?: ConsultationStatsFilters,
  staff?: StaffMember[]
) {
  // 기본 날짜 범위: 이번 달 (로컬 시간 기준)
  const defaultDateRange = useMemo(() => {
    return getDateRangeFromPreset('thisMonth');
  }, []);

  const dateRange = filters?.dateRange || defaultDateRange;

  const { data, isLoading, error: queryError, refetch } = useQuery<ConsultationStatsResult>({
    queryKey: ['consultation_stats', dateRange, filters?.subject],
    queryFn: async () => {
      const colRef = collection(db, COL_STUDENT_CONSULTATIONS);

      // === 성능 최적화: Firestore 서버사이드 날짜 필터링 ===
      // 기존: 전체 데이터 로드 후 클라이언트 필터링 -> 개선: 서버에서 범위 쿼리
      const q = query(
        colRef,
        where('date', '>=', dateRange.start),
        where('date', '<=', dateRange.end),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);

      let consultations = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Consultation)
      );

      // 과목 필터링 (subject는 'math'/'english' 또는 '수학'/'영어' 둘 다 가능)
      if (filters?.subject && filters.subject !== 'all') {
        consultations = consultations.filter((c) => {
          if (filters.subject === 'math') {
            return c.subject === 'math' || c.subject === '수학';
          } else if (filters.subject === 'english') {
            return c.subject === 'english' || c.subject === '영어';
          }
          return true;
        });
      }

      // 일별 통계 집계
      const dailyMap = new Map<string, { parent: number; student: number }>();
      consultations.forEach((c) => {
        const existing = dailyMap.get(c.date) || { parent: 0, student: 0 };
        if (c.type === 'parent') {
          existing.parent++;
        } else {
          existing.student++;
        }
        dailyMap.set(c.date, existing);
      });

      const dailyStats: DailyConsultationStat[] = Array.from(dailyMap.entries())
        .map(([date, counts]) => ({
          date,
          parentCount: counts.parent,
          studentCount: counts.student,
          total: counts.parent + counts.student,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // 카테고리별 통계 집계
      const categoryMap = new Map<ConsultationCategory, number>();
      consultations.forEach((c) => {
        const current = categoryMap.get(c.category) || 0;
        categoryMap.set(c.category, current + 1);
      });

      const totalConsultations = consultations.length;
      const categoryStats: CategoryStat[] = Array.from(categoryMap.entries()).map(
        ([category, count]) => ({
          category,
          count,
          percentage:
            totalConsultations > 0
              ? Math.round((count / totalConsultations) * 100)
              : 0,
        })
      );

      // 강사(teacher) ID 목록 생성
      const teacherIds = new Set(
        (staff || []).filter(s => s.role === 'teacher' || s.role === '강사').map(s => s.id)
      );

      // 상담자별 통계 집계 (강사만)
      // - count: 상담 기록 건수 (한 학생 여러 번 만나면 여러 번 카운트, 활동량)
      // - uniqueStudents: 이번 달 만난 unique 학생 ID Set (커버리지)
      const staffMap = new Map<string, {
        name: string;
        count: number;
        uniqueStudents: Set<string>;
        mathCount: number;     // 상담 subject 가 math/수학/all 인 건수 (강사 과목 추론용)
        englishCount: number;  // 상담 subject 가 english/영어/all 인 건수
      }>();
      consultations.forEach((c) => {
        // 강사 목록이 있으면 강사만, 없으면 모든 상담자 표시
        if (c.consultantId && (teacherIds.size === 0 || teacherIds.has(c.consultantId))) {
          const existing = staffMap.get(c.consultantId) || {
            name: c.consultantName || '알 수 없음',
            count: 0,
            uniqueStudents: new Set<string>(),
            mathCount: 0,
            englishCount: 0,
          };
          existing.count++;
          if (c.studentId) existing.uniqueStudents.add(c.studentId);
          // 상담 subject 카운트 — 강사 과목 fallback 추론용
          const subj = (c as any).subject;
          if (subj === 'math' || subj === '수학') existing.mathCount++;
          else if (subj === 'english' || subj === '영어') existing.englishCount++;
          else if (subj === 'all') { existing.mathCount++; existing.englishCount++; }
          staffMap.set(c.consultantId, existing);
        }
      });

      const teacherCount = teacherIds.size || 5;
      // staff id → subjects 매핑 (강사 과목 표시용)
      const staffSubjectsById = new Map<string, string[]>();
      (staff || []).forEach(s => {
        if (Array.isArray(s.subjects)) staffSubjectsById.set(s.id, s.subjects);
      });
      const staffPerformances: StaffPerformance[] = Array.from(
        staffMap.entries()
      )
        .map(([id, data]) => ({
          id,
          name: data.name,
          consultationCount: data.count,
          uniqueStudentCount: data.uniqueStudents.size,
          targetCount: Math.ceil(DEFAULT_MONTHLY_TARGET / teacherCount),
          percentage: Math.min(
            100,
            Math.round(
              (data.count / Math.ceil(DEFAULT_MONTHLY_TARGET / teacherCount)) * 100
            )
          ),
          subjects: staffSubjectsById.get(id) || [],
          mathCount: data.mathCount,
          englishCount: data.englishCount,
        }))
        .sort((a, b) => b.consultationCount - a.consultationCount);

      // 전화상담 0건인 강사 (별도 표시)
      const inactiveTeachers = (staff || [])
        .filter(s => (s.role === 'teacher' || s.role === '강사') && !staffMap.has(s.id))
        .map(s => ({
          id: s.id,
          name: s.name,
          subjects: Array.isArray(s.subjects) ? s.subjects : [],
        }));

      // 선생님별 과목별 통계 집계 (강사만)
      const staffSubjectMap = new Map<string, { name: string; math: number; english: number }>();

      // 모든 teacher를 초기화 (상담 기록이 없어도 표시)
      (staff || []).filter(s => s.role === 'teacher' || s.role === '강사').forEach(teacher => {
        staffSubjectMap.set(teacher.id, {
          name: teacher.name,
          math: 0,
          english: 0,
        });
      });

      // 상담 기록으로 카운트 업데이트
      consultations.forEach((c) => {
        if (c.consultantId && (teacherIds.size === 0 || teacherIds.has(c.consultantId))) {
          const existing = staffSubjectMap.get(c.consultantId) || {
            name: c.consultantName || '알 수 없음',
            math: 0,
            english: 0,
          };
          // subject는 'math' | 'english' | '수학' | '영어' 둘 다 가능
          if (c.subject === 'math' || c.subject === '수학') {
            existing.math++;
          } else if (c.subject === 'english' || c.subject === '영어') {
            existing.english++;
          }
          staffSubjectMap.set(c.consultantId, existing);
        }
      });

      // 과목별 전체 수강 건수 계산 (나중에 eligibleStudents에서 계산)
      // 이 시점에서는 먼저 staffSubjectStats를 생성하고, 나중에 업데이트
      const staffSubjectStats: StaffSubjectStat[] = Array.from(
        staffSubjectMap.entries()
      )
        .map(([id, data]) => ({
          id,
          name: data.name,
          mathCount: data.math,
          mathTotal: 0,  // 나중에 계산
          englishCount: data.english,
          englishTotal: 0,  // 나중에 계산
          totalCount: data.math + data.english,
          totalNeeded: 0,  // 나중에 계산
        }))
        .sort((a, b) => b.totalCount - a.totalCount);

      // 후속 조치 통계
      const followUpNeeded = consultations.filter(
        (c) => c.followUpNeeded && !c.followUpDone
      ).length;
      const followUpDone = consultations.filter(
        (c) => c.followUpNeeded && c.followUpDone
      ).length;

      // ============ 상담 미완료 학생 목록 계산 (최적화) ============
      // 의도: 선택한 기간 내에 1건 이상의 상담 기록이 없는 재원생 목록

      // 1. 재원생 조회 (status === 'active') - enrollments 배열 포함
      const studentsQuery = query(
        collection(db, COL_STUDENTS),
        where('status', '==', 'active')
      );
      const studentsSnapshot = await getDocs(studentsQuery);

      // 학생 ID -> 이름 매핑 + 등록일(startDate or createdAt) 매핑
      const studentMap = new Map<string, string>();
      const studentStartDateMap = new Map<string, string>();  // YYYY-MM-DD
      studentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        studentMap.set(doc.id, data.name || '(이름없음)');
        // startDate 우선, 없으면 createdAt 의 날짜 부분
        let startDate: string | undefined = data.startDate || data.enrollmentDate;
        if (!startDate && data.createdAt) {
          const raw = data.createdAt;
          if (typeof raw === 'string' && raw.length >= 10) startDate = raw.substring(0, 10);
          else if (raw?.toDate) {
            const d: Date = raw.toDate();
            startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          }
        }
        if (startDate) studentStartDateMap.set(doc.id, startDate);
      });

      // 2. 선생님 이름 -> ID 매핑 생성 (다양한 형식 fallback)
      // classes.teacher / classes.mainTeacher 가 다음 중 어느 형식이라도 매칭되도록:
      //   - 한글 이름 ("정유진")
      //   - 영어 이름 ("Yoojin")
      //   - 합성 이름 ("정유진(Yoojin)") — UI 표시 형식
      //   - staff.id 직접 (Firestore document ID)
      const teacherNameToIdMap = new Map<string, string>();
      (staff || []).forEach(member => {
        if (member.role === 'teacher' || member.role === '강사') {
          teacherNameToIdMap.set(member.id, member.id);  // ID 직접 매핑
          if (member.name) teacherNameToIdMap.set(member.name, member.id);
          if (member.englishName) {
            teacherNameToIdMap.set(member.englishName, member.id);
            if (member.name) {
              teacherNameToIdMap.set(`${member.name}(${member.englishName})`, member.id);
              teacherNameToIdMap.set(`${member.name} (${member.englishName})`, member.id);
            }
          }
        }
      });

      // 담임/부담임 가중치를 합산하는 맵 (소수점 가능 — 학생을 요일별로 분할)
      // 예: 학생 A 가 월/화/목/금=담임, 수=부담임 → 담임 +4/5, 부담임 +1/5
      const teacherWeightedStudentsMap = new Map<string, Map<'math' | 'english', number>>();
      teacherNameToIdMap.forEach((staffId) => {
        teacherWeightedStudentsMap.set(staffId, new Map([
          ['math', 0],
          ['english', 0]
        ]));
      });

      // 3. 전체 enrollments 조회하여 수업별 학생 수 집계 + 학생별 enrollment 보관 (가중 계산용)
      const allEnrollmentsSnap = await getDocs(collectionGroup(db, 'enrollments'));

      // 수업명별 학생 수 집계 (중복 학생 제거)
      const classStudentCount = new Map<string, Set<string>>();

      // 학생별 수강과목 집계 (상담 필요 학생 목록용)
      const studentEnrollmentMap = new Map<string, Set<'math' | 'english'>>();

      // 학생별 enrollment 보관 (담임/부담임 가중 계산용)
      // staffId 추가 — schedule 정보 없는 경우 fallback 으로 직접 담임 매칭
      type EnrFlat = {
        studentId: string;
        className: string;
        subject: 'math' | 'english';
        schedule: any[];
        staffId: string;
      };
      const studentEnrollments: EnrFlat[] = [];

      allEnrollmentsSnap.docs.forEach(enrollDoc => {
        // 문서 경로: students/{studentId}/enrollments/{enrollmentId}
        const pathParts = enrollDoc.ref.path.split('/');
        const studentId = pathParts[1];

        // 재원생만 처리
        if (!studentMap.has(studentId)) return;

        const enrollData = enrollDoc.data();
        const className = enrollData.className as string | undefined;
        const subject = enrollData.subject as string;

        if (!className) return;

        // 활성 수강만 처리 (퇴원/보류 제외)
        if (enrollData.withdrawalDate || enrollData.onHold) return;

        // 수업별 학생 집합에 추가
        if (!classStudentCount.has(className)) {
          classStudentCount.set(className, new Set());
        }
        classStudentCount.get(className)!.add(studentId);

        // 학생별 수강 과목 집계 — highmath 도 math 로 묶음
        if (!studentEnrollmentMap.has(studentId)) {
          studentEnrollmentMap.set(studentId, new Set());
        }
        let normalizedSubject: 'math' | 'english' | null = null;
        if (subject === 'math' || subject === '수학' || subject === 'highmath') normalizedSubject = 'math';
        else if (subject === 'english' || subject === '영어') normalizedSubject = 'english';
        if (normalizedSubject) {
          studentEnrollmentMap.get(studentId)!.add(normalizedSubject);
          studentEnrollments.push({
            studentId,
            className,
            subject: normalizedSubject,
            schedule: Array.isArray(enrollData.schedule) ? enrollData.schedule : [],
            staffId: (enrollData.staffId || '') as string,
          });
        }
      });

      // 4. classes 컬렉션에서 담임/부담임(slotTeachers) + 수업 스케줄 정보 보관
      // 키: className → { teacher (담임), slotTeachers (요일-교시 → 부담임), subject, schedule }
      // schedule 은 object array [{day, periodId, ...}] — slotKey 매칭에 사용
      type ClassInfo = {
        teacher: string;
        slotTeachers: Record<string, string>;
        subject: 'math' | 'english';
        schedule: any[];
      };
      const classByName = new Map<string, ClassInfo>();
      const classesSnap = await getDocs(collection(db, 'classes'));

      classesSnap.docs.forEach(classDoc => {
        const classData = classDoc.data();
        // 영어 수업은 mainTeacher, 수학은 teacher — useClasses.ts 패턴
        const teacherName = (classData.mainTeacher || classData.teacher) as string | undefined;
        const subject = classData.subject as string | undefined;
        const className = classData.className as string | undefined;

        if (!teacherName || !subject || !className || classData.isActive === false) return;

        let normalizedSubject: 'math' | 'english' | null = null;
        if (subject === 'math' || subject === '수학' || subject === 'highmath') normalizedSubject = 'math';
        else if (subject === 'english' || subject === '영어') normalizedSubject = 'english';
        if (!normalizedSubject) return;

        classByName.set(className, {
          teacher: teacherName,
          slotTeachers: (classData.slotTeachers || {}) as Record<string, string>,
          subject: normalizedSubject,
          schedule: Array.isArray(classData.schedule) ? classData.schedule : [],
        });
      });

      // 5. 학생별 enrollment 의 schedule 요일을 따라 강사별 가중치 합산
      // - 수요일 슬롯 → slotTeachers[`수-${periodId}`] (부담임), 없으면 담임 fallback
      // - 그 외 요일 → 담임
      // - 한 학생의 총 슬롯 수로 나눠서 가중치 분할 (월화목금=담임 / 수=부담임 → 담임 4/5, 부담임 1/5)
      const studentTeacherSlots = new Map<string, Map<'math' | 'english', Map<string, number>>>();
      // 학생 → 과목 → staffId → 슬롯 수

      // staffId 직접 매칭 헬퍼 — 슬롯 1개 추가
      const addSlot = (studentId: string, subject: 'math' | 'english', staffId: string) => {
        if (!staffId) return;
        if (!studentTeacherSlots.has(studentId)) {
          studentTeacherSlots.set(studentId, new Map());
        }
        const subjectMap = studentTeacherSlots.get(studentId)!;
        if (!subjectMap.has(subject)) subjectMap.set(subject, new Map());
        const teacherSlotMap = subjectMap.get(subject)!;
        teacherSlotMap.set(staffId, (teacherSlotMap.get(staffId) || 0) + 1);
      };

      studentEnrollments.forEach(enr => {
        const classInfo = classByName.get(enr.className);

        // 슬롯 소스 선택 우선순위: enrollment.schedule > class.schedule
        const slotsSource = (enr.schedule && enr.schedule.length > 0)
          ? enr.schedule
          : (classInfo?.schedule || []);

        // 슬롯 정보 전무 → enrollment.staffId 또는 class.teacher 로 fallback (학생당 1슬롯, 담임만)
        if (slotsSource.length === 0) {
          let fallbackStaffId = enr.staffId
            ? (teacherNameToIdMap.get(enr.staffId) || enr.staffId)
            : '';
          if (!fallbackStaffId && classInfo?.teacher) {
            fallbackStaffId = teacherNameToIdMap.get(classInfo.teacher) || '';
          }
          if (fallbackStaffId && teacherWeightedStudentsMap.has(fallbackStaffId)) {
            addSlot(enr.studentId, enr.subject, fallbackStaffId);
          }
          return;
        }

        // classInfo 가 없으면 슬롯 정보 있어도 담임/부담임 결정 불가 → enr.staffId fallback
        if (!classInfo) {
          const fallbackStaffId = enr.staffId
            ? (teacherNameToIdMap.get(enr.staffId) || enr.staffId)
            : '';
          if (fallbackStaffId && teacherWeightedStudentsMap.has(fallbackStaffId)) {
            addSlot(enr.studentId, enr.subject, fallbackStaffId);
          }
          return;
        }

        for (const slot of slotsSource) {
          let day = '';
          let periodId = '';
          if (typeof slot === 'string') {
            const parts = slot.split(/[\s_]+/);
            day = parts[0] || '';
            periodId = parts.slice(1).join('-') || '';
          } else if (slot && typeof slot === 'object') {
            day = (slot.day || '') as string;
            periodId = (slot.periodId || '') as string;
          }
          if (!day) continue;

          // 요일별 담당 강사 결정
          let teacherName = classInfo.teacher;
          if (day === '수') {
            const slotKey = `${day}-${periodId}`;
            teacherName = classInfo.slotTeachers[slotKey] || classInfo.teacher;
          }

          // 이름 매칭 실패 → enr.staffId fallback
          let staffId = teacherNameToIdMap.get(teacherName) || '';
          if (!staffId && enr.staffId) {
            staffId = teacherNameToIdMap.get(enr.staffId) || enr.staffId;
          }
          if (!staffId || !teacherWeightedStudentsMap.has(staffId)) continue;

          addSlot(enr.studentId, enr.subject, staffId);
        }
      });

      // 슬롯 수를 가중 학생 수로 변환 (학생 단위 합 = 1, 강사별 분할)
      studentTeacherSlots.forEach((subjectMap) => {
        subjectMap.forEach((teacherSlotMap, subject) => {
          const totalSlots = Array.from(teacherSlotMap.values()).reduce((s, v) => s + v, 0);
          if (totalSlots === 0) return;
          teacherSlotMap.forEach((slots, staffId) => {
            const weight = slots / totalSlots;
            const tMap = teacherWeightedStudentsMap.get(staffId);
            if (tMap) {
              const cur = tMap.get(subject) || 0;
              tMap.set(subject, cur + weight);
            }
          });
        });
      });

      // 수강과목이 있는 재원생만 필터링
      const eligibleStudents: { id: string; name: string; enrolledSubjects: ('math' | 'english')[] }[] = [];
      studentEnrollmentMap.forEach((subjects, studentId) => {
        if (subjects.size > 0) {
          eligibleStudents.push({
            id: studentId,
            name: studentMap.get(studentId) || '(이름없음)',
            enrolledSubjects: Array.from(subjects),
          });
        }
      });

      // 3. 학생별 과목별 상담 여부 체크 (과목 단위로 분리)
      // 선택 기간 내 상담 기록을 학생ID+과목 키로 매핑
      const consultedStudentSubjectSet = new Set<string>();
      consultations.forEach(c => {
        if (!c.studentId) return;
        // subject 정규화: 'math'/'수학' -> 'math', 'english'/'영어' -> 'english'
        let normalizedSubject: string | undefined = c.subject;
        if (c.subject === '수학') normalizedSubject = 'math';
        if (c.subject === '영어') normalizedSubject = 'english';

        // 'all' 또는 미지정 상담: 학생의 모든 수강 과목에 대해 완료 처리
        // (한 번의 상담이 두 과목을 동시에 다룬 경우)
        if (normalizedSubject === 'all' || !normalizedSubject) {
          consultedStudentSubjectSet.add(`${c.studentId}-math`);
          consultedStudentSubjectSet.add(`${c.studentId}-english`);
        } else {
          consultedStudentSubjectSet.add(`${c.studentId}-${normalizedSubject}`);
        }
      });

      // 4. 과목별로 상담 필요 학생 항목 생성
      const needingConsultationItems: Array<{ studentId: string; name: string; subject: 'math' | 'english' }> = [];
      eligibleStudents.forEach(student => {
        student.enrolledSubjects.forEach(subject => {
          const key = `${student.id}-${subject}`;
          // 선택 기간 내 해당 과목 상담이 없으면 추가
          if (!consultedStudentSubjectSet.has(key)) {
            needingConsultationItems.push({
              studentId: student.id,
              name: student.name,
              subject,
            });
          }
        });
      });

      // 5. 상담 필요 학생들의 과목별 마지막 상담일 + 미응답 시도 여부 조회
      const studentSubjectLastConsultationMap = new Map<string, string>();
      // 학생별 이번 달 학부모 상담에 "미응답" 키워드가 있는지
      const NO_RESPONSE_KEYWORDS = ['미응답', '부재중', '응답 없', '응답없', '안받', '안 받', '연락 안', '연락안', '통화 안', '통화안'];
      const studentNoResponseSet = new Set<string>();  // studentId
      // 학생별 상담 기록(과거 완료 + 미래 예정) 보유 여부
      // — 이력 0건 학생은 '진행 대기중'으로 잡혀도 실제 액션 대상 아니므로 미완료에서 제외
      const studentHasAnyConsultation = new Set<string>();

      if (needingConsultationItems.length > 0) {
        const allConsultationsQuery = query(
          collection(db, COL_STUDENT_CONSULTATIONS),
          orderBy('date', 'desc')
        );
        const allConsultationsSnap = await getDocs(allConsultationsQuery);

        allConsultationsSnap.docs.forEach(doc => {
          const data = doc.data();
          const studentId = data.studentId as string;
          if (!studentId) return;
          // 한 건이라도 상담 기록(예정/완료/취소 등 status 무관) 있으면 의미 있는 대상
          studentHasAnyConsultation.add(studentId);
          let normalizedSubject: string | undefined = data.subject as string | undefined;
          if (normalizedSubject === '수학') normalizedSubject = 'math';
          if (normalizedSubject === '영어') normalizedSubject = 'english';

          const dateValue = data.date as string;
          if (normalizedSubject === 'all' || !normalizedSubject) {
            for (const sub of ['math', 'english'] as const) {
              const key = `${studentId}-${sub}`;
              if (!studentSubjectLastConsultationMap.has(key)) {
                studentSubjectLastConsultationMap.set(key, dateValue);
              }
            }
          } else {
            const key = `${studentId}-${normalizedSubject}`;
            if (!studentSubjectLastConsultationMap.has(key)) {
              studentSubjectLastConsultationMap.set(key, dateValue);
            }
          }

          // 미응답 키워드 검사 (이번 달 학부모 상담)
          if (
            (data.type === 'parent' || data.parentName)
            && dateValue >= dateRange.start && dateValue <= dateRange.end
          ) {
            const text = `${data.title || ''} ${data.content || ''} ${data.followUpNotes || ''}`;
            if (NO_RESPONSE_KEYWORDS.some(k => text.includes(k))) {
              studentNoResponseSet.add(studentId);
            }
          }
        });
      }

      // 사유 판정 헬퍼
      const today = new Date();
      const todayMs = today.getTime();
      const DAY_MS = 24 * 60 * 60 * 1000;
      const determineMissingReason = (
        studentId: string,
        lastDate: string | undefined,
      ): { reason: ConsultationMissingReason; detail?: string } => {
        // 1) 신입생 — 등록 30일 이내
        const startDate = studentStartDateMap.get(studentId);
        if (startDate) {
          const startMs = new Date(startDate).getTime();
          if (!isNaN(startMs)) {
            const daysSinceStart = Math.floor((todayMs - startMs) / DAY_MS);
            if (daysSinceStart <= 30 && daysSinceStart >= 0) {
              return { reason: 'new_student', detail: `등록 ${daysSinceStart}일차` };
            }
          }
        }
        // 2) 최근 상담 — 마지막 상담일 30일 이내
        if (lastDate) {
          const lastMs = new Date(lastDate).getTime();
          if (!isNaN(lastMs)) {
            const daysSince = Math.floor((todayMs - lastMs) / DAY_MS);
            if (daysSince <= 30 && daysSince >= 0) {
              return { reason: 'recent_consult', detail: `${daysSince}일 전 상담` };
            }
          }
        }
        // 3) 연락 미응답 — 이번 달 학부모 상담에 키워드 포함
        if (studentNoResponseSet.has(studentId)) {
          return { reason: 'no_response', detail: '이번 달 학부모 연락 미응답' };
        }
        // 4) 그 외 진행 대기중
        return { reason: 'pending' };
      };

      const studentsNeedingConsultation: StudentNeedingConsultation[] = needingConsultationItems
        .map(item => {
          const lastDate = studentSubjectLastConsultationMap.get(`${item.studentId}-${item.subject}`);
          const { reason, detail } = determineMissingReason(item.studentId, lastDate);
          return {
            studentId: item.studentId,
            studentName: item.name,
            subject: item.subject,
            lastConsultationDate: lastDate,
            reason,
            reasonDetail: detail,
          };
        })
        // 의미 있는 미완료만 표시: 신입생/최근상담/연락미응답 OR 상담 이력 보유
        // — '진행 대기중' + 상담 기록 0건 학생은 실제 액션 대상 아니므로 제외
        .filter(item => {
          if (item.reason !== 'pending') return true;
          return studentHasAnyConsultation.has(item.studentId);
        });

      // 마지막 상담일 기준 오름차순 정렬 (오래된 순, 없는 경우 맨 위)
      studentsNeedingConsultation.sort((a, b) => {
        if (!a.lastConsultationDate && !b.lastConsultationDate) {
          // 상담 기록이 둘 다 없으면 이름순, 이름이 같으면 과목순 (math < english)
          const nameComp = a.studentName.localeCompare(b.studentName);
          if (nameComp !== 0) return nameComp;
          return a.subject.localeCompare(b.subject);
        }
        if (!a.lastConsultationDate) return -1;
        if (!b.lastConsultationDate) return 1;
        return a.lastConsultationDate.localeCompare(b.lastConsultationDate);
      });

      // 전체 과목 수강 건수 계산 (과목별로 분리)
      let totalSubjectEnrollments = 0;
      let totalMathEnrollments = 0;
      let totalEnglishEnrollments = 0;

      eligibleStudents.forEach(student => {
        totalSubjectEnrollments += student.enrolledSubjects.length;
        if (student.enrolledSubjects.includes('math')) {
          totalMathEnrollments++;
        }
        if (student.enrolledSubjects.includes('english')) {
          totalEnglishEnrollments++;
        }
      });

      // 선생님별 통계에 가중 학생 수 적용 (월화목금=담임 / 수=부담임 분할)
      staffSubjectStats.forEach(stat => {
        const teacherMap = teacherWeightedStudentsMap.get(stat.id);
        const mathStudents = Math.round(teacherMap?.get('math') || 0);
        const englishStudents = Math.round(teacherMap?.get('english') || 0);

        stat.mathTotal = mathStudents;
        stat.englishTotal = englishStudents;
        stat.totalNeeded = mathStudents + englishStudents;
      });

      // staffPerformances 의 targetCount 를 가중 담당 학생 수로 교체 + percentage 재계산
      // (기존: DEFAULT_MONTHLY_TARGET / teacherCount 균등 분배 → 강사별 실제 담당 기준)
      staffPerformances.forEach(perf => {
        const teacherMap = teacherWeightedStudentsMap.get(perf.id);
        const target = Math.round((teacherMap?.get('math') || 0) + (teacherMap?.get('english') || 0));
        perf.targetCount = target;
        // 분모가 0이면 100% 폴백하지 않고 0% 표시 (분모 매칭 실패가 진짜 100% 처럼 보이는 것 방지)
        perf.percentage = target > 0
          ? Math.min(100, Math.round((perf.consultationCount / target) * 100))
          : 0;
      });


      // 완료 / 의미있는 분모 계산
      // - completedCount: 이번 달 상담 완료된 (학생×과목) 건수 = 원래 분모 - 원래 미완료(필터링 전)
      // - meaningfulTargetCount: 완료 + 의미있는 미완료 (이력 0 진행 대기중 제외)
      const completedCount = Math.max(0, totalSubjectEnrollments - needingConsultationItems.length);
      const meaningfulTargetCount = completedCount + studentsNeedingConsultation.length;

      return {
        dailyStats,
        categoryStats,
        staffPerformances,
        inactiveTeachers,
        staffSubjectStats,
        topPerformer: staffPerformances[0] || null,
        totalConsultations,
        parentConsultations: consultations.filter((c) => c.type === 'parent')
          .length,
        studentConsultations: consultations.filter((c) => c.type === 'student')
          .length,
        followUpNeeded,
        followUpDone,
        studentsNeedingConsultation,
        totalActiveStudents: studentsSnapshot.docs.length,  // 전체 재원생 수
        totalSubjectEnrollments,  // 전체 과목 수강 건수 (사실 데이터, 변하지 않음)
        completedCount,
        meaningfulTargetCount,
      };
    },
    staleTime: 1000 * 60 * 5, // 5분 캐싱
    gcTime: 1000 * 60 * 10, // 10분 GC
    refetchOnWindowFocus: false,
  });

  const error = queryError ? (queryError as Error).message : null;

  return {
    stats: data || {
      dailyStats: [],
      categoryStats: [],
      staffPerformances: [],
      inactiveTeachers: [],
      staffSubjectStats: [],
      topPerformer: null,
      totalConsultations: 0,
      parentConsultations: 0,
      studentConsultations: 0,
      followUpNeeded: 0,
      followUpDone: 0,
      studentsNeedingConsultation: [],
      totalActiveStudents: 0,
      totalSubjectEnrollments: 0,
      completedCount: 0,
      meaningfulTargetCount: 0,
    },
    loading: isLoading,
    error,
    refetch,
  };
}

/**
 * 기간 선택 프리셋
 */
export type DatePreset = 'thisWeek' | 'thisMonth' | 'lastMonth' | 'last3Months';

/**
 * Date를 'YYYY-MM-DD' 형식으로 변환 (로컬 시간 기준)
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDateRangeFromPreset(preset: DatePreset): {
  start: string;
  end: string;
} {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (preset) {
    case 'thisWeek':
      // 이번 주: 월요일 ~ 일요일
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 일요일이면 -6, 아니면 월요일까지 거리
      start = new Date(now);
      start.setDate(now.getDate() + mondayOffset);
      end = new Date(start);
      end.setDate(start.getDate() + 6); // 일요일
      break;
    case 'thisMonth':
      // 이번 달: 1일 ~ 말일 (예: 1/1 ~ 1/31)
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // 말일
      break;
    case 'lastMonth':
      // 지난 달: 1일 ~ 말일
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0); // 지난달 말일
      break;
    case 'last3Months':
      // 3개월: 2달 전 1일 ~ 이번달 말일
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // 이번달 말일
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end),
  };
}
