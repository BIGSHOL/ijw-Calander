/**
 * 반 이동(class move) 트랜잭션 타입
 *
 * 한 학생의 반 이동을 단일 record 로 추적해 cancel/restore 를 양쪽 enrollment 에 atomic 하게 적용.
 *
 * 라이프사이클:
 *   1. createMove: pending 상태로 생성. from-enrollment.endDate=moveDate-1, to-enrollment.startDate=moveDate.
 *   2. cancelMove: status='cancelled' + cancelledAt + to-enrollment.cancelledAt + from-enrollment.endDate 제거.
 *   3. restoreMove: status='pending' + cancelledAt 제거 + to-enrollment.cancelledAt 제거 + from-enrollment.endDate 복원.
 *
 * 컬렉션: classMoves/{moveId}
 */

export interface ClassMove {
  /** doc id */
  id: string;
  /** 학생 id (students/{id}) */
  studentId: string;
  /** 학생 이름 (audit/표시용 — students 조인 안 해도 보이게) */
  studentName?: string;
  /** 종료될 enrollment id (반 A) */
  fromEnrollmentId: string;
  /** 신규 enrollment id (반 B) */
  toEnrollmentId: string;
  /** 이동 효력일 (YYYY-MM-DD). B.startDate = moveDate. A.endDate 는 그 직전 날(또는 같은 날) */
  moveDate: string;
  /** A 정보 — restore 시 endDate 복원용 (moveDate-1 가 일반적이지만 명시 보존) */
  fromMeta?: {
    className?: string;
    subject?: string;
    /** 이동 전 A 의 endDate (보통 moveDate-1) */
    endDateBeforeMove?: string;
  };
  /** B 정보 — 표시/검증용 */
  toMeta?: {
    className?: string;
    subject?: string;
  };
  /** 트랜잭션 상태 */
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  /** 취소 정보 */
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
}