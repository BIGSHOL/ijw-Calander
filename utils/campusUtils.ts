// 캠퍼스(분원) 관련 타입 및 유틸리티

export type CampusType = 'main' | 'godeung';

export const CAMPUS_LABELS: Record<CampusType, string> = {
  main: '본원',
  godeung: '고등수학관',
};

export const CAMPUS_ID_PREFIX: Record<CampusType, string> = {
  main: '',
  godeung: 'gd_',
};

export const CAMPUS_COLORS: Record<CampusType, string> = {
  main: '#3b82f6',    // blue
  godeung: '#a855f7', // purple (기존 고등수학관 시간표 색상과 동일)
};

/** 학생 문서에서 캠퍼스 값 추출 (필드 없으면 'main' 반환) */
export function getCampus(student: { campus?: string }): CampusType {
  return (student.campus === 'godeung') ? 'godeung' : 'main';
}

/** 캠퍼스에 따른 학생 문서 ID 생성 */
export function generateStudentId(
  name: string,
  normalizedSchool: string,
  grade: string,
  campus: CampusType
): string {
  const prefix = CAMPUS_ID_PREFIX[campus];
  return `${prefix}${name.trim()}_${normalizedSchool}_${grade.trim()}`;
}

/** 학생 문서 ID에서 gd_ 프리픽스 제거 후 파싱 */
export function parseStudentIdWithCampus(id: string): {
  name: string;
  school: string;
  grade: string;
  campus: CampusType;
} {
  let workingId = id;
  let campus: CampusType = 'main';

  if (workingId.startsWith('gd_')) {
    workingId = workingId.substring(3);
    campus = 'godeung';
  }

  const parts = workingId.split('_');
  return {
    name: parts[0] || workingId,
    school: parts[1] || '',
    grade: parts[2] || '',
    campus,
  };
}