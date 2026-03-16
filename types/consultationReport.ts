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
  parentConcerns: string;       // 학부모 걱정/불안 (직접 말한 것 + 추론)
  parentQuestions: string;      // 학부모 질문사항 (답변 여부 구분)
  parentRequests: string;       // 학부모 명시적 요청
  parentSatisfaction: string;   // 만족도/감정 상태 분석
  studentNotes: string;         // 학생 특이사항 (학습, 행동, 강점/약점)
  teacherResponse: string;      // 교사 해결책/설명 요약
  agreements: string;           // 합의된 사항
  actionItems: string;          // 후속 조치 항목
  riskFlags: string;            // 주의 신호 (퇴원 가능성, 심각한 불만 등)
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

  // 시스템 필드
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}
