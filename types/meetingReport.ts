// 회의록 녹음 분석 타입 정의

export type MeetingReportStatus =
  | 'uploading'      // 파일 업로드 중
  | 'transcribing'   // 음성 인식 중
  | 'analyzing'      // AI 분석 중
  | 'completed'      // 완료
  | 'failed'         // 분석 불가 (텍스트 부족/음성 인식 실패)
  | 'error';         // 오류

export interface MeetingReportSection {
  meetingType: string;       // 회의 유형
  summary: string;           // 회의 요약
  agendaDiscussion: string;  // 안건별 논의 내용
  decisions: string;         // 결정 사항
  actionItems: string;       // 액션 아이템
  speakerSummary: string;    // 참석자별 발언 요약
  concerns: string;          // 우려/이슈 사항
  nextSteps: string;         // 향후 계획
}

export interface MeetingSpeakerUtterance {
  speaker: string;  // "A", "B", "C"
  text: string;
  start: number;    // ms
  end: number;      // ms
}

export interface MeetingReport {
  id: string;

  // 메타데이터
  title: string;              // 회의 제목
  attendees: string[];        // 참석자 목록
  meetingDate: string;        // YYYY-MM-DD
  recorder: string;           // 기록자 (선택)

  // 녹음 파일 정보
  fileName: string;
  storagePath: string;
  fileSizeBytes: number;
  durationSeconds?: number;

  // 처리 상태
  status: MeetingReportStatus;
  statusMessage?: string;
  errorMessage?: string;

  // 음성 인식 결과
  transcription?: string;
  speakerLabels?: MeetingSpeakerUtterance[];

  // AI 분석 보고서
  report?: MeetingReportSection;
  speakerRoles?: Record<string, string>;

  // 수정 추적
  lastEditedBy?: string;       // 수정자 uid
  lastEditedByName?: string;   // 수정자 이름
  lastEditedAt?: number;       // 수정 시각 (timestamp ms)

  // 시스템 필드
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}
