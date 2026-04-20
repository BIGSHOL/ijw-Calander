/**
 * 학생별 공유 메모 (담임·부담임 간 소통)
 *
 * 저장 경로: students/{studentId}/memos/{memoId}
 *
 * 권한:
 * - 읽기: students.view 권한자 전체 (강사 누구나)
 * - 작성: 해당 학생의 담임·부담임만 (+ master/admin)
 * - 수정/삭제: 본인 작성 메모만 (+ master/admin)
 */

export type MemoCategory = 'academic' | 'life' | 'consultation' | 'health' | 'other';

export interface MemoCategoryMeta {
  label: string;
  bg: string;      // 카테고리 뱃지 배경
  text: string;    // 카테고리 뱃지 글자
  dot: string;     // 카테고리 도트 (좌측 색띠)
}

export const MEMO_CATEGORY_META: Record<MemoCategory, MemoCategoryMeta> = {
  academic:     { label: '학업', bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  life:         { label: '생활', bg: '#f3e8ff', text: '#6b21a8', dot: '#a855f7' },
  consultation: { label: '상담', bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  health:       { label: '건강', bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
  other:        { label: '기타', bg: '#f3f4f6', text: '#374151', dot: '#6b7280' },
};

export const MEMO_CATEGORY_ORDER: MemoCategory[] = ['academic', 'life', 'consultation', 'health', 'other'];

export interface StudentMemo {
  id: string;
  content: string;
  category: MemoCategory;
  authorId: string;          // Firebase Auth UID — 수정/삭제 권한 식별
  authorName: string;        // 표시용 이름 (작성 시점 스냅샷)
  authorStaffId?: string;    // staff 문서 ID (호환성, 출결/성적 등과 연결용)
  isPinned?: boolean;        // 중요 메모 상단 고정
  createdAt: string;         // ISO 문자열
  updatedAt: string;
}
