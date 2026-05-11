/**
 * useAutoFilterMyTimetable
 * ─────────────────────────────────────────────────────────────────────
 * 선생님 계정 로그인 시 시간표 화면에서 본인 강사만 visible, 나머지 hidden 으로 자동 설정.
 *
 * - DB / Firestore 는 건드리지 않음. localStorage 만 사용.
 *   (`ijw_math_hidden_teachers`, `ijw_english_hidden_teachers` 키)
 * - 본인 staff.id 가 바뀔 때(=로그인 사용자 전환 시점) 한 번만 실행.
 *   같은 세션에서 사용자가 다른 강사를 켜고/끄면 그 설정은 보존됨.
 *   다음 로그인 시 다시 본인만 visible 로 리셋.
 * - master / admin / manager 등 관리 역할은 자동 적용하지 않음
 *   (전체 시간표를 봐야 하므로).
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

interface Params {
  profile: UserProfile | null;
  staffMember?: StaffMember;
  teachers: Teacher[];
}

export function useAutoFilterMyTimetable({ profile, staffMember, teachers }: Params): void {
  const appliedForStaffIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (!TEACHER_ROLES.includes(profile.role)) return;
    if (!staffMember?.name || !staffMember.id) return;
    if (teachers.length === 0) return;

    if (appliedForStaffIdRef.current === staffMember.id) return;

    const myName = staffMember.name;
    const hiddenNames = teachers
      .map((t) => t.name)
      .filter((name): name is string => !!name && name !== myName);

    storage.setJSON(STORAGE_KEYS.MATH_HIDDEN_TEACHERS, hiddenNames);
    storage.setJSON(STORAGE_KEYS.ENGLISH_HIDDEN_TEACHERS, hiddenNames);

    appliedForStaffIdRef.current = staffMember.id;
  }, [profile, staffMember, teachers]);
}

export default useAutoFilterMyTimetable;
