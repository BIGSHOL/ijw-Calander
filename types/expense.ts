// 지출결의서 항목
export interface ExpenseItem {
  purpose: string;         // 용도
  vendor: string;          // 거래처
  description: string;     // 사용내역
  quantity: number;        // 수량
  unitPrice: number;       // 금액 (단가)
  totalPrice: number;      // 총액(VAT포함)
}

// 지출결의서
export interface Expense {
  id: string;
  // 결의서 헤더
  title: string;           // 제목
  author: string;          // 사업자/작성자 (성명)
  department: string;      // 부서명
  position: string;        // 직위
  createdDate: string;     // 작성일자 (YYYY-MM-DD)
  expenseDate: string;     // 지출일자 (YYYY-MM-DD)
  // 항목 (최대 7개 행)
  items: ExpenseItem[];
  // 통화
  currency?: string;       // 통화 기호 (₩, $, ¥ 등)
  // 정산
  paymentMethod: string;   // 정산방법 (카드결제/현금/계좌이체)
  bankName?: string;       // 은행명 (계좌이체 시)
  accountNumber: string;   // 계좌번호
  // 결재 상태
  approvalStatus: 'pending' | 'approved' | 'rejected';
  // 결재 체크 (작성/집행자/원장/대표)
  approvalChecks?: {
    author?: { checked: boolean; date?: string };
    executor?: { checked: boolean; date?: string };
    director?: { checked: boolean; date?: string };
    ceo?: { checked: boolean; date?: string };
  };
  // 증빙자료
  receiptUrl?: string;     // 증빙자료 종류 (레거시, 하위호환)
  receiptUrls?: string[];  // 증빙자료 이미지 URL 배열
  // 메타
  memo: string;            // 비고
  totalAmount: number;     // 합계 (자동계산)
  createdAt: string;
  updatedAt: string;
  createdBy: string;       // uid
}
