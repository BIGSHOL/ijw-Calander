/**
 * 선생님 관련 유틸리티 함수
 * - 선생님 이름 매칭
 * - 담임/부담임 판별
 */

export interface StaffMember {
  id: string;
  name: string;
  englishName?: string;
  [key: string]: any;
}

/**
 * 선생님 이름 매칭 함수
 * - 영어 이름과 한글 이름 모두 체크
 * - staff 배열을 통한 교차 검증 지원
 *
 * @param teacherNameInClass - 수업/클래스에 등록된 선생님 이름
 * @param myName - 현재 선생님의 이름 (영어 이름 우선)
 * @param myKoreanName - 현재 선생님의 한글 이름 (선택)
 * @param staff - 전체 staff 목록 (교차 검증용, 선택)
 * @returns 매칭 여부
 */
export const isTeacherMatch = (
  teacherNameInClass: string,
  myName: string,
  myKoreanName?: string,
  staff?: StaffMember[]
): boolean => {
  if (!teacherNameInClass) return false;

  // 1. 직접 비교: 정확히 일치하면 true
  if (teacherNameInClass === myName || teacherNameInClass === myKoreanName) {
    return true;
  }

  // 2. staff 데이터를 통한 교차 검증 (선택)
  if (staff && staff.length > 0) {
    const staffMember = staff.find(
      s => s.name === teacherNameInClass || s.englishName === teacherNameInClass
    );
    if (!staffMember) return false;

    // staff에서 찾은 선생님의 이름/영어이름이 현재 선생님과 일치하는지 확인
    return staffMember.name === myName ||
           staffMember.name === myKoreanName ||
           staffMember.englishName === myName ||
           staffMember.englishName === myKoreanName;
  }

  return false;
};

/**
 * 수업의 slotTeachers에 특정 선생님이 포함되어 있는지 확인
 *
 * @param slotTeachers - 수업의 slotTeachers 객체
 * @param teacherName - 확인할 선생님 이름
 * @param teacherKoreanName - 확인할 선생님 한글 이름 (선택)
 * @param staff - 전체 staff 목록 (교차 검증용, 선택)
 * @returns 포함 여부
 */
export const isTeacherInSlotTeachers = (
  slotTeachers: Record<string, string> | undefined,
  teacherName: string,
  teacherKoreanName?: string,
  staff?: StaffMember[]
): boolean => {
  if (!slotTeachers) return false;

  const slotTeacherNames = Object.values(slotTeachers) as string[];
  return slotTeacherNames.some(name =>
    isTeacherMatch(name, teacherName, teacherKoreanName, staff)
  );
};

/**
 * 특정 교시의 slotTeacher가 현재 선생님과 일치하는지 확인
 *
 * @param slotTeachers - 수업의 slotTeachers 객체
 * @param slotKey - 교시 키 (예: "월-1-1")
 * @param teacherName - 확인할 선생님 이름
 * @param teacherKoreanName - 확인할 선생님 한글 이름 (선택)
 * @param staff - 전체 staff 목록 (교차 검증용, 선택)
 * @returns 매칭 여부
 */
export const isSlotTeacherMatch = (
  slotTeachers: Record<string, string> | undefined,
  slotKey: string,
  teacherName: string,
  teacherKoreanName?: string,
  staff?: StaffMember[]
): boolean => {
  if (!slotTeachers || !slotTeachers[slotKey]) return false;

  const slotTeacher = slotTeachers[slotKey];
  return isTeacherMatch(slotTeacher, teacherName, teacherKoreanName, staff);
};

/**
 * 수학 과목: enrollment의 isSlotTeacher 필드로 부담임 판별
 * - 학생별로 담임/부담임이 다를 수 있음
 * - enrollment에 isSlotTeacher: true 저장됨
 *
 * @param enrollmentData - enrollment 데이터
 * @returns true면 부담임, false면 담임
 */
export const isMathAssistantTeacher = (
  enrollmentData: { isSlotTeacher?: boolean } | undefined
): boolean => {
  return enrollmentData?.isSlotTeacher === true;
};

/**
 * 영어/과학/국어 과목: 수업의 slotTeachers로 부담임 판별
 * - 수업 레벨에서 교시별로 담당 선생님 정의
 * - 담임이 아니면 부담임
 *
 * @param classData - 수업 데이터
 * @param teacherName - 확인할 선생님 이름
 * @param teacherKoreanName - 확인할 선생님 한글 이름 (선택)
 * @param staff - 전체 staff 목록 (교차 검증용, 선택)
 * @returns true면 부담임, false면 담임
 */
export const isEnglishAssistantTeacher = (
  classData: { teacher?: string; slotTeachers?: Record<string, string> } | undefined,
  teacherName: string,
  teacherKoreanName?: string,
  staff?: StaffMember[]
): boolean => {
  // slotTeachers가 없으면 담임
  if (!classData?.slotTeachers || Object.keys(classData.slotTeachers).length === 0) {
    return false;
  }

  // 담임인지 확인
  const isMainTeacher = isTeacherMatch(
    classData.teacher || '',
    teacherName,
    teacherKoreanName,
    staff
  );

  // 담임이 아니면 부담임
  return !isMainTeacher;
};

/**
 * 통합 함수: 과목에 관계없이 부담임 판별
 * - 수학: enrollment의 isSlotTeacher 우선
 * - 영어/과학/국어: 수업의 slotTeachers 확인
 *
 * @param classData - 수업 데이터
 * @param enrollmentData - enrollment 데이터 (선택)
 * @param teacherName - 확인할 선생님 이름
 * @param teacherKoreanName - 확인할 선생님 한글 이름 (선택)
 * @param staff - 전체 staff 목록 (교차 검증용, 선택)
 * @returns true면 부담임, false면 담임
 */
export const isAssistantTeacher = (
  classData: { teacher?: string; slotTeachers?: Record<string, string> } | undefined,
  enrollmentData: { isSlotTeacher?: boolean } | undefined,
  teacherName: string,
  teacherKoreanName?: string,
  staff?: StaffMember[]
): boolean => {
  // 1. 수학: enrollment의 isSlotTeacher 필드 우선 확인
  if (enrollmentData?.isSlotTeacher !== undefined) {
    return isMathAssistantTeacher(enrollmentData);
  }

  // 2. 영어/과학/국어: 수업의 slotTeachers 확인
  return isEnglishAssistantTeacher(classData, teacherName, teacherKoreanName, staff);
};
