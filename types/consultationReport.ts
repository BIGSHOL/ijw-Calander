// 상담 녹음 분석 타입 정의

export type ConsultationReportStatus =
  | 'uploading'      // 파일 업로드 중
  | 'transcribing'   // 음성 인식 중
  | 'analyzing'      // AI 분석 중
  | 'completed'      // 완료
  | 'failed'         // 분석 불가 (텍스트 부족/음성 인식 실패)
  | 'error';         // 오류

export interface ConsultationReportSection {
  summary: string;              // 상담 요약 (분위기, 핵심 흐름)
  consultationType: string;     // 상담 성격 (등록상담/정기상담/성적상담/문제상담 등)
  familyContext: string;        // 가정 배경/개인 맥락 (ASR 노이즈 메모 포함)
  parentConcerns: string;       // 학부모 걱정/불안 (직접 말한 것 + 추론)
  parentQuestions: string;      // 학부모 질문사항 (답변 여부 구분)
  parentRequests: string;       // 학부모가 직접 요청한 사항 (상담사 제안과 구분)
  parentSatisfaction: string;   // 만족도/감정 상태 분석
  studentNotes: string;         // 학생 특이사항 (학습, 행동, 심리, 의사소통 패턴)
  teacherResponse: string;      // 교사/상담사 대응 요약
  salesPoints: string;          // 상담사의 세일즈 포인트/설득 논거 (등록상담 시)
  agreements: string;           // 합의된 사항 (구체적 로드맵 포함)
  actionItems: string;          // 후속 조치 항목
  riskFlags: string;            // 주의 신호 (자존감, 가정 갈등, 퇴원 가능성 등)
  conversationFlow?: ConversationFlowNode[]; // 상담 흐름 수형도
}

export interface ConversationFlowNode {
  topic: string;
  summary: string;
  children?: ConversationFlowNode[];
}

export interface SpeakerUtterance {
  speaker: string;  // "A", "B", "C"
  text: string;
  start: number;    // ms
  end: number;      // ms
}

export interface ConsultationReport {
  id: string;

  // 메타데이터
  studentId: string;
  studentName: string;          // 콤마 구분 (호환용)
  studentNames?: string[];      // 복수 학생 이름 배열
  studentIds?: string[];        // 복수 학생 ID 배열
  consultantName: string;
  consultationDate: string;     // YYYY-MM-DD

  // 녹음 파일 정보
  fileName: string;
  storagePath: string;        // consultation-recordings/...
  fileSizeBytes: number;
  durationSeconds?: number;

  // 처리 상태
  status: ConsultationReportStatus;
  statusMessage?: string;
  errorMessage?: string;

  // 음성 인식 결과
  transcription?: string;
  speakerLabels?: SpeakerUtterance[];

  // AI 분석 보고서
  report?: ConsultationReportSection;
  speakerRoles?: Record<string, string>;  // { "A": "선생님", "B": "학부모" }

  // 수정 이력
  lastEditedBy?: string;       // 수정자 uid
  lastEditedByName?: string;   // 수정자 이름
  lastEditedAt?: number;       // 수정 시각 (timestamp ms)

  // 시스템 필드
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}
