// ============ CONSULTATION DRAFT TYPES (Parent QR Form Submission) ============

/**
 * 학부모가 QR 폼으로 제출한 상담 접수 데이터 (draft)
 * consultation_drafts 컬렉션에 저장됨
 */
export interface ConsultationDraft {
  id: string;
  tokenId: string;            // embed_tokens 문서 ID
  status: 'pending' | 'reviewed' | 'converted';

  // === 학생 정보 ===
  studentName: string;
  gender?: 'male' | 'female';
  bloodType?: string;
  studentPhone?: string;
  careerGoal?: string;
  schoolName: string;
  grade: string;              // SchoolGrade enum 값
  subjects: string[];         // ConsultationSubject 값 배열 (수학, 영어, 국어, 과학)
  siblings?: string;          // 형제자매 정보

  // === 학부모 정보 ===
  parentName: string;
  parentRelation: string;     // 모, 부, 조부, 조모, 기타
  parentPhone: string;
  consultationPath?: string;  // 상담 경로 (인터넷, 지인소개 등)
  address?: string;           // 집주소

  // === 기타 ===
  shuttleBusRequest: boolean;
  privacyAgreement: boolean;
  installmentAgreement: boolean;

  // === 시스템 ===
  submittedAt: string;        // ISO datetime
  reviewedAt?: string;        // 직원 확인 시각
  reviewedBy?: string;        // 직원 UID
  convertedToConsultationId?: string; // 전환된 consultation ID
}

/**
 * Cloud Function 제출용 (id, tokenId, status 등 시스템 필드 제외)
 */
export type ConsultationDraftSubmission = Omit<
  ConsultationDraft,
  'id' | 'tokenId' | 'status' | 'submittedAt' | 'reviewedAt' | 'reviewedBy' | 'convertedToConsultationId'
>;
