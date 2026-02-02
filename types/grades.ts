// ============ GRADE MANAGEMENT TYPES (GradeGuard Integration) ============

/**
 * 시험 범위 (누가 치는 시험인가?)
 */
export type ExamScope = 'class' | 'grade' | 'subject' | 'school' | 'academy';

/**
 * 시험 범위 라벨
 */
export const EXAM_SCOPE_LABELS: Record<ExamScope, string> = {
  class: '반별',
  grade: '학년별',
  subject: '과목별',
  school: '학교별',
  academy: '학원 전체',
};

/**
 * 시험 유형
 */
export type ExamType =
  | 'daily'        // 일일 테스트
  | 'weekly'       // 주간 테스트
  | 'monthly'      // 월말평가
  | 'midterm'      // 중간고사
  | 'final'        // 기말고사
  | 'mock'         // 모의고사
  | 'school'       // 학교 내신
  | 'competition'  // 경시대회
  | 'diagnostic'   // 진단 평가
  | 'other';       // 기타

/**
 * 시험 정보
 */
export interface Exam {
  id: string;
  title: string;             // "1월 모의고사", "중간고사"
  date: string;              // YYYY-MM-DD
  type: ExamType;
  subject: 'math' | 'english' | 'both';  // 수학/영어/통합
  maxScore: number;          // 만점 (기본 100)
  description?: string;      // 시험 설명

  // 시험 범위 관련
  scope: ExamScope;                      // 시험 범위
  targetClassIds?: string[];             // scope='class'일 때 대상 반 IDs
  targetGrades?: string[];               // scope='grade'일 때 대상 학년들 ['중1', '중2']
  targetSchools?: string[];              // scope='school'일 때 대상 학교들
  gradeLevel?: string;                   // 학년 필터링용 (단일 학년, 레거시 호환)

  // 태그 및 시리즈
  tags?: string[];                       // 태그 배열 ['#내신대비', '#재시험']
  seriesId?: string;                     // 시험 시리즈 ID
  seriesName?: string;                   // 시리즈 이름 (조회 편의)

  // 메타데이터
  createdBy: string;         // UID
  createdByName?: string;    // 생성자 이름
  createdAt: number;
  updatedAt?: number;

  // 통계 (비정규화 - 읽기 비용 최적화)
  stats?: ExamStats;
}

/**
 * 시험 성적 통계 (Exam 문서에 비정규화되어 저장됨)
 */
export interface ExamStats {
  count: number;     // 응시자 수
  avg: number;       // 전체 평균
  max: number;       // 최고점
  min: number;       // 최저점
}

/**
 * 학생별 성적
 */
export interface StudentScore {
  id: string;
  studentId: string;         // UnifiedStudent.id와 연결
  studentName?: string;      // 스냅샷 (조회 편의)
  examId: string;            // Exam.id와 연결
  examTitle?: string;        // 스냅샷 (조회 편의)
  subject: 'math' | 'english';
  score: number;             // 점수
  maxScore: number;          // 만점 (Exam에서 복사)
  percentage?: number;       // 백분율 (score/maxScore * 100)

  // 선택적 통계
  average?: number;          // 반/학원 평균
  rank?: number;             // 석차
  totalStudents?: number;    // 전체 학생수
  grade?: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'F';

  // 메모
  memo?: string;

  // 메타데이터
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  createdByName?: string;
}

/**
 * 학생 성적 요약 (조회용)
 */
export interface StudentGradeSummary {
  studentId: string;
  studentName: string;
  recentScores: StudentScore[];    // 최근 5개 성적
  averageScore: number;            // 평균 점수
  totalExams: number;              // 총 시험 수
  trend: 'up' | 'down' | 'stable'; // 성적 추이
}

/**
 * 성적 등급 계산 헬퍼
 */
export const calculateGrade = (percentage: number): StudentScore['grade'] => {
  if (percentage >= 97) return 'A+';
  if (percentage >= 93) return 'A';
  if (percentage >= 90) return 'A-';
  if (percentage >= 87) return 'B+';
  if (percentage >= 83) return 'B';
  if (percentage >= 80) return 'B-';
  if (percentage >= 77) return 'C+';
  if (percentage >= 73) return 'C';
  if (percentage >= 70) return 'C-';
  if (percentage >= 67) return 'D+';
  if (percentage >= 60) return 'D';
  return 'F';
};

/**
 * 성적 등급별 색상
 */
export const GRADE_COLORS: Record<NonNullable<StudentScore['grade']>, { bg: string; text: string; border: string }> = {
  'A+': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  'A': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'A-': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  'B+': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  'B': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'B-': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  'C+': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  'C': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  'C-': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'D+': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  'D': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  'F': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
};

/**
 * 시험 유형 라벨
 */
export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  daily: '일일 테스트',
  weekly: '주간 테스트',
  monthly: '월말평가',
  midterm: '중간고사',
  final: '기말고사',
  mock: '모의고사',
  school: '학교 내신',
  competition: '경시대회',
  diagnostic: '진단 평가',
  other: '기타',
};

// ============ GRADE PROFILE SYSTEM (Phase 1-5) ============

/**
 * 레벨테스트 유형
 */
export type LevelTestType = 'placement' | 'promotion' | 'diagnostic';

/**
 * 레벨테스트 기록
 */
export interface LevelTest {
  id: string;
  studentId: string;
  studentName: string;

  testDate: string;              // YYYY-MM-DD
  subject: 'math' | 'english';
  testType: LevelTestType;       // 배치/승급/진단

  score: number;
  maxScore: number;
  percentage: number;

  // 영역별 세부 점수 (선택)
  sections?: {
    name: string;                // '어휘', '문법', '독해', '연산' 등
    score: number;
    maxScore: number;
  }[];

  // 레벨 판정
  recommendedLevel: string;      // 'LE', 'RTT', '최상급', '중급' 등
  recommendedClass?: string;     // 추천 반

  // 강사 평가
  strengths?: string;            // 강점
  weaknesses?: string;           // 보완점

  // 메타데이터
  evaluatorId: string;
  evaluatorName: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 목표 점수 설정
 */
export interface GoalSetting {
  id: string;
  studentId: string;
  studentName: string;

  examId: string;
  examTitle: string;
  examDate: string;
  subject: 'math' | 'english';

  targetScore: number;           // 목표 점수
  maxScore: number;
  targetPercentage: number;

  // 실제 결과 (시험 후 업데이트)
  actualScore?: number;
  actualPercentage?: number;
  achieved?: boolean;

  reason?: string;               // 목표 설정 사유

  // 메타데이터
  setBy: string;
  setByName: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 강사 코멘트 카테고리
 */
export type GradeCommentCategory =
  | 'strength'           // 학습적 강점
  | 'improvement'        // 학습적 보완점
  | 'effort'             // 성적향상 노력
  | 'potential'          // 성장 잠재력
  | 'general';           // 종합 소견

/**
 * 강사 코멘트
 */
export interface GradeComment {
  id: string;
  studentId: string;
  studentName: string;

  category: GradeCommentCategory;
  subject?: 'math' | 'english' | 'all';
  content: string;

  // 기간 (월별)
  period: string;                // '2026-01'

  // 공개 설정
  isSharedWithParent: boolean;

  // 메타데이터
  authorId: string;
  authorName: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 코멘트 카테고리 라벨
 */
export const COMMENT_CATEGORY_LABELS: Record<GradeCommentCategory, { label: string; icon: string; color: string }> = {
  strength: { label: '학습적 강점', icon: '💪', color: 'emerald' },
  improvement: { label: '학습적 보완점', icon: '📌', color: 'amber' },
  effort: { label: '이번달 노력한 점', icon: '🌟', color: 'blue' },
  potential: { label: '성장 잠재력', icon: '🚀', color: 'purple' },
  general: { label: '종합 소견', icon: '📝', color: 'gray' },
};
