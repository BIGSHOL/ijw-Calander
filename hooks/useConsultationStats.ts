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
 * 상담 미완료 학생 정보 (과목별)
 * - 수학/영어를 동시 수강 중인 학생은 과목별로 2개 항목 생성
 */
export interface StudentNeedingConsultation {
  studentId: string;
  studentName: string;
  subject: 'math' | 'english';  // 해당 과목
  lastConsultationDate?: string;  // 해당 과목의 가장 최근 상담일 (전체 기간)
}

/**
 * 통계 결과 타입
 */
export interface ConsultationStatsResult {
  dailyStats: DailyConsultationStat[];
  categoryStats: CategoryStat[];
  staffPerformances: StaffPerformance[];
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
      const staffMap = new Map<string, { name: string; count: number }>();
      consultations.forEach((c) => {
        // 강사 목록이 있으면 강사만, 없으면 모든 상담자 표시
        if (c.consultantId && (teacherIds.size === 0 || teacherIds.has(c.consultantId))) {
          const existing = staffMap.get(c.consultantId) || {
            name: c.consultantName || '알 수 없음',
            count: 0,
          };
          existing.count++;
          staffMap.set(c.consultantId, existing);
        }
      });

      const teacherCount = teacherIds.size || 5;
      const staffPerformances: StaffPerformance[] = Array.from(
        staffMap.entries()
      )
        .map(([id, data]) => ({
          id,
          name: data.name,
          consultationCount: data.count,
          targetCount: Math.ceil(DEFAULT_MONTHLY_TARGET / teacherCount),
          percentage: Math.min(
            100,
            Math.round(
              (data.count / Math.ceil(DEFAULT_MONTHLY_TARGET / teacherCount)) * 100
            )
          ),
        }))
        .sort((a, b) => b.consultationCount - a.consultationCount);

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

      // 학생 ID -> 이름 매핑
      const studentMap = new Map<string, string>();
      studentsSnapshot.docs.forEach(doc => {
        studentMap.set(doc.id, doc.data().name || '(이름없음)');
      });

      // 2. 선생님 이름 -> ID 매핑 생성
      const teacherNameToIdMap = new Map<string, string>();
      (staff || []).forEach(member => {
        // role이 'teacher' 또는 '강사'인 경우 모두 포함
        if (member.role === 'teacher' || member.role === '강사') {
          teacherNameToIdMap.set(member.name, member.id);
          // 영어 이름도 매핑 (있는 경우)
          if (member.englishName) {
            teacherNameToIdMap.set(member.englishName, member.id);
          }
        }
      });

      // 담임 선생님별 학생 수 집계 맵 초기화 (숫자로 카운트)
      const teacherMainClassStudentsMap = new Map<string, Map<'math' | 'english', number>>();
      teacherNameToIdMap.forEach((staffId) => {
        teacherMainClassStudentsMap.set(staffId, new Map([
          ['math', 0],
          ['english', 0]
        ]));
      });

      // 3. 전체 enrollments 조회하여 수업별 학생 수 집계
      const allEnrollmentsSnap = await getDocs(collectionGroup(db, 'enrollments'));

      // 수업명별 학생 수 집계 (중복 학생 제거)
      const classStudentCount = new Map<string, Set<string>>();

      // 학생별 수강과목 집계 (상담 필요 학생 목록용)
      const studentEnrollmentMap = new Map<string, Set<'math' | 'english'>>();

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

        // 수업별 학생 집합에 추가
        if (!classStudentCount.has(className)) {
          classStudentCount.set(className, new Set());
        }
        classStudentCount.get(className)!.add(studentId);

        // 학생별 수강 과목 집계
        if (!studentEnrollmentMap.has(studentId)) {
          studentEnrollmentMap.set(studentId, new Set());
        }
        if (subject === 'math' || subject === '수학') {
          studentEnrollmentMap.get(studentId)!.add('math');
        } else if (subject === 'english' || subject === '영어') {
          studentEnrollmentMap.get(studentId)!.add('english');
        }
      });

      // 4. classes 컬렉션에서 담임별 학생 수 집계
      const classesSnap = await getDocs(collection(db, 'classes'));

      classesSnap.docs.forEach(classDoc => {
        const classData = classDoc.data();
        const teacherName = classData.teacher as string | undefined;
        const subject = classData.subject as string | undefined;
        const className = classData.className as string | undefined;

        if (!teacherName || !subject || !className || classData.isActive === false) return;

        // 과목 정규화
        let normalizedSubject: 'math' | 'english' | null = null;
        if (subject === 'math' || subject === '수학') normalizedSubject = 'math';
        else if (subject === 'english' || subject === '영어') normalizedSubject = 'english';

        if (!normalizedSubject) return;

        // 담임 이름 -> staff ID 변환
        const staffId = teacherNameToIdMap.get(teacherName);
        if (!staffId) return;

        // 이 수업의 학생 수를 담임 선생님에게 합산
        const studentCount = classStudentCount.get(className)?.size || 0;
        const teacherMap = teacherMainClassStudentsMap.get(staffId);
        if (teacherMap) {
          const currentCount = teacherMap.get(normalizedSubject) || 0;
          teacherMap.set(normalizedSubject, currentCount + studentCount);
        }
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
        // subject 정규화: 'math'/'수학' -> 'math', 'english'/'영어' -> 'english'
        let normalizedSubject = c.subject;
        if (c.subject === '수학') normalizedSubject = 'math';
        if (c.subject === '영어') normalizedSubject = 'english';
        consultedStudentSubjectSet.add(`${c.studentId}-${normalizedSubject}`);
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

      // 5. 상담 필요 학생들의 과목별 마지막 상담일 조회 (전체 기간에서)
      const studentSubjectLastConsultationMap = new Map<string, string>();

      if (needingConsultationItems.length > 0) {
        // 전체 상담 기록에서 해당 학생+과목의 마지막 상담일 조회
        const allConsultationsQuery = query(
          collection(db, COL_STUDENT_CONSULTATIONS),
          orderBy('date', 'desc')
        );
        const allConsultationsSnap = await getDocs(allConsultationsQuery);

        allConsultationsSnap.docs.forEach(doc => {
          const data = doc.data();
          const studentId = data.studentId as string;
          let normalizedSubject = data.subject as string;
          if (normalizedSubject === '수학') normalizedSubject = 'math';
          if (normalizedSubject === '영어') normalizedSubject = 'english';

          const key = `${studentId}-${normalizedSubject}`;
          // 이미 기록이 있으면 스킵 (desc 정렬이라 첫 번째가 최신)
          if (!studentSubjectLastConsultationMap.has(key)) {
            studentSubjectLastConsultationMap.set(key, data.date as string);
          }
        });
      }

      const studentsNeedingConsultation: StudentNeedingConsultation[] = needingConsultationItems.map(item => ({
        studentId: item.studentId,
        studentName: item.name,
        subject: item.subject,
        lastConsultationDate: studentSubjectLastConsultationMap.get(`${item.studentId}-${item.subject}`),
      }));

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

      // 선생님별 통계에 전체 필요 상담 건수 업데이트 (담임으로 있는 반의 학생 수 기준)
      staffSubjectStats.forEach(stat => {
        const teacherMap = teacherMainClassStudentsMap.get(stat.id);
        const mathStudents = teacherMap?.get('math') || 0;
        const englishStudents = teacherMap?.get('english') || 0;

        stat.mathTotal = mathStudents;
        stat.englishTotal = englishStudents;
        stat.totalNeeded = mathStudents + englishStudents;
      });

      return {
        dailyStats,
        categoryStats,
        staffPerformances,
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
        totalSubjectEnrollments,  // 전체 과목 수강 건수
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
