/**
 * useAutoFilterMyTimetable (안전 버전)
 * ─────────────────────────────────────────────────────────────────────
 * 선생님 계정 로그인 시 시간표에서 본인 강사만 visible, 같은 과목의 다른 강사는 hidden.
 *
 * 안전 원칙:
 * - DB / Firestore 는 건드리지 않음. localStorage 만 사용.
 * - 본인 과목 기준으로만 hidden 설정. 다른 과목 시간표는 절대 안 건드림.
 *   예: 수학 강사 로그인 → MATH_HIDDEN_TEACHERS 만 set, ENGLISH 키는 손도 안 댐.
 * - hidden 배열에는 "같은 과목 강사 중 본인 외" 만 포함 (전체 staff 다 넣지 않음).
 *   예: 수학 강사 로그인 → 수학/고등수학 담당 강사들 중 본인 외만 hidden.
 *   영어 강사 이름은 hidden 에 들어가지 않음 → 영어 시간표 레이아웃 영향 0.
 *
 * 실행 시점:
 * - 본인 staff.id 가 바뀐 첫 시점에 1회. 세션 중 사용자 토글 보존.
 * - 다음 로그인 시 본인만 visible 로 리셋.
 *
 * 적용 제외:
 * - master / admin / manager 등 관리 역할 (전체 시간표 봐야 함).
 */
import { useEffect, useRef } from 'react';
import { UserProfile, StaffMember, Teacher, UserRole } from '../types';
import { storage, STORAGE_KEYS } from '../utils/localStorage';

const TEACHER_ROLES: ReadonlyArray<UserRole> = [
  'math_teacher',
  'english_teacher',
  'math_lead',
  'english_lead',
];

type SubjectId = 'math' | 'highmath' | 'english' | 'science' | 'korean';

interface Params {
  profile: UserProfile | null;
  staffMember?: StaffMember;
  teachers: Teacher[];
}

const teacherHasSubject = (teacher: Teacher, subjects: ReadonlyArray<SubjectId>): boolean => {
  if (!teacher.subjects || teacher.subjects.length === 0) return false;
  return teacher.subjects.some((s) => subjects.includes(s as SubjectId));
};

const collectHiddenNames = (
  myName: string,
  teachers: Teacher[],
  subjects: ReadonlyArray<SubjectId>
): string[] =>
  teachers
    .filter((t) => !!t.name && t.name !== myName && teacherHasSubject(t, subjects))
    .map((t) => t.name as string);

export function useAutoFilterMyTimetable({ profile, staffMember, teachers }: Params): void {
  const appliedForStaffIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (!TEACHER_ROLES.includes(profile.role)) return;
    if (!staffMember?.name || !staffMember.id) return;
    if (teachers.length === 0) return;

    if (appliedForStaffIdRef.current === staffMember.id) return;

    const myName = staffMember.name;
    const mySubjects = (staffMember.subjects ?? []) as SubjectId[];

    // role 기반 fallback (subjects 비어있을 수 있음)
    const isMath =
      mySubjects.includes('math') ||
      mySubjects.includes('highmath') ||
      profile.role === 'math_teacher' ||
      profile.role === 'math_lead';
    const isEnglish =
      mySubjects.includes('english') ||
      profile.role === 'english_teacher' ||
      profile.role === 'english_lead';

    if (isMath) {
      const hidden = collectHiddenNames(myName, teachers, ['math', 'highmath']);
      storage.setJSON(STORAGE_KEYS.MATH_HIDDEN_TEACHERS, hidden);
      // 같은 탭 내에서는 'storage' 이벤트가 발사되지 않으므로 커스텀 이벤트로 소비자(useMathSettings) 깨움
      window.dispatchEvent(new Event('mathHiddenTeachersChanged'));
    }
    if (isEnglish) {
      const hidden = collectHiddenNames(myName, teachers, ['english']);
      storage.setJSON(STORAGE_KEYS.ENGLISH_HIDDEN_TEACHERS, hidden);
      window.dispatchEvent(new Event('englishHiddenTeachersChanged'));
    }

    appliedForStaffIdRef.current = staffMember.id;
  }, [profile, staffMember, teachers]);
}

export default useAutoFilterMyTimetable;