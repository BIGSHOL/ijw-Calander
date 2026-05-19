/**
 * 대시보드 정합성 공통 유틸
 *
 * 동일 지표가 여러 대시보드/모달에서 다르게 계산되어 발생하는 데이터 불일치를
 * 차단하기 위한 SSOT(Single Source of Truth) 함수 모음.
 *
 * 기준: MasterDashboard(2026-05-15 사용자 결정) — 시간표 헤더와 동일한 활성 판정.
 */
import { getTodayKST } from './dateUtils';

/**
 * 활성 enrollment 판정.
 *
 * 다음 조건을 모두 만족해야 활성으로 간주:
 *  - cancelledAt 없음 (배정 취소 아님)
 *  - onHold 없음 (보류 아님)
 *  - 시작일(enrollmentDate 우선, 없으면 startDate)이 오늘 이전
 *  - 종료일(withdrawalDate 우선, 없으면 endDate)이 없거나 오늘보다 미래
 *
 * @param e enrollment 객체
 * @param todayStr KST 기준 yyyy-MM-dd. 미지정 시 getTodayKST() 사용.
 */
export const isActiveEnrollment = (e: any, todayStr?: string): boolean => {
  if (!e) return false;
  if (e.cancelledAt) return false;
  if (e.onHold) return false;

  const today = todayStr || getTodayKST();

  const startStr =
    (typeof e.enrollmentDate === 'string' && e.enrollmentDate) ||
    (typeof e.startDate === 'string' && e.startDate) ||
    null;
  if (!startStr) return false;
  if (startStr > today) return false; // 미래 시작 = 배정 예정

  const endStr =
    (typeof e.withdrawalDate === 'string' && e.withdrawalDate) ||
    (typeof e.endDate === 'string' && e.endDate) ||
    null;
  if (endStr && endStr <= today) return false;

  return true;
};

/**
 * 재원 학생 판정.
 *
 * status === 'active' AND 활성 enrollment 1개 이상 보유.
 *
 * @param s 학생 객체
 * @param todayStr KST 기준 yyyy-MM-dd. 미지정 시 getTodayKST() 사용.
 */
export const isActiveStudent = (s: any, todayStr?: string): boolean => {
  if (!s) return false;
  if (s.status !== 'active') return false;
  const today = todayStr || getTodayKST();
  return Array.isArray(s.enrollments) && s.enrollments.some((e: any) => isActiveEnrollment(e, today));
};
