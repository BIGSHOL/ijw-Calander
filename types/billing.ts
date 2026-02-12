// ============ BILLING MANAGEMENT TYPES ============

/**
 * 수납 상태
 */
export type BillingStatus = 'pending' | 'paid';

/**
 * 수납 기록 (xlsx 1행 = 1레코드, flat 구조)
 */
export interface BillingRecord {
  id: string;
  // 학생 정보
  externalStudentId: string; // 원생고유번호
  studentName: string; // 이름
  grade: string; // 학년
  school: string; // 학교
  parentPhone: string; // 학부모연락처
  studentPhone: string; // 원생연락처
  // 청구 정보
  category: string; // 구분 (수업 등)
  month: string; // 청구월 (2026-01 형식)
  billingDay: number; // 청구일
  billingName: string; // 수납명
  // 금액 정보
  status: BillingStatus; // 수납여부 (pending=미납, paid=납부완료)
  billedAmount: number; // 청구액
  discountAmount: number; // 할인액
  pointsUsed: number; // 적립금사용
  paidAmount: number; // 실제낸금액
  unpaidAmount: number; // 미납금액
  // 결제 정보
  paymentMethod: string; // 결제수단
  cardCompany: string; // 카드사
  paidDate: string; // 수납일
  cashReceipt: string; // 현금영수증
  // 기타
  memo: string; // 메모
  teacher?: string; // 담임강사
  discountReason?: string; // 할인사유
  siblings?: string; // 형제
  createdAt: string; // 등록일시
  updatedAt: string; // 수정일시
  createdBy?: string; // 등록자
  updatedBy?: string; // 수정자
  // 등록차수 연동
  studentId?: string; // Firestore student doc ID (매칭된 학생)
  studentMatchStatus?: 'matched' | 'unmatched' | 'manual'; // 학생 매칭 상태
}

/**
 * 수납 통계
 */
export interface BillingSummaryStats {
  totalBilled: number; // 총 청구 금액
  totalDiscount: number; // 총 할인 금액
  totalPaid: number; // 총 납부 금액
  totalUnpaid: number; // 총 미납 금액
  pendingCount: number; // 미납 건수
  paidCount: number; // 완납 건수
  collectionRate: number; // 수납률 (%)
}

/**
 * 수납 상태 색상
 */
export const BILLING_STATUS_COLORS: Record<BillingStatus, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  paid: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
};

/**
 * 수납 상태 라벨
 */
export const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  pending: '미납',
  paid: '납부완료',
};

/**
 * 결제 수단 라벨
 */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  '카드': '카드',
  '온라인(계좌)': '계좌이체',
  '현금': '현금',
  '': '-',
};
