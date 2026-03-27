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
  // 정산
  paymentMethod: string;   // 정산방법 (카드결제/현금/계좌이체)
  accountNumber: string;   // 계좌번호
  // 결재 상태
  approvalStatus: 'pending' | 'approved' | 'rejected';
  // 증빙자료
  receiptUrl?: string;     // 증빙자료 종류 (영수증/세금계산서/견적서 등)
  // 메타
  memo: string;            // 비고
  totalAmount: number;     // 합계 (자동계산)
  createdAt: string;
  updatedAt: string;
  createdBy: string;       // uid
}
