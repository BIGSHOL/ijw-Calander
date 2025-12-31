# 전자 결제 탭 추가 계획

## 목표
`next-month-tuition-report` 프로젝트를 `ijw-calander`의 세 번째 탭 "전자 결제"로 통합

## 색상 스킴
- 곤색: `#081429`
- 노란색: `#fdb813`
- 회색: `#373d41`

---

## Proposed Changes

### 1. App State & Types
#### [MODIFY] [App.tsx](file:///d:/ijw-calander/App.tsx)
- `appMode` 타입에 `'payment'` 추가: `useState<'calendar' | 'timetable' | 'payment'>('calendar')`
- 탭 버튼 추가 (MASTER 권한 체크)
- `appMode === 'payment'` 일 때 새 컴포넌트 렌더링

---

### 2. Payment Report Component (New)
#### [NEW] [PaymentReport.tsx](file:///d:/ijw-calander/components/PaymentReport/PaymentReport.tsx)
- `next-month-tuition-report/App.tsx` 로직 이식
- 색상 스킴 적용 (`#081429`, `#fdb813`, `#373d41`)
- Firebase 연결 재사용 (`../../../firebaseConfig`)

#### [NEW] [EntryForm.tsx](file:///d:/ijw-calander/components/PaymentReport/EntryForm.tsx)
- `next-month-tuition-report/components/EntryForm.tsx` 이식

#### [NEW] [TuitionChart.tsx](file:///d:/ijw-calander/components/PaymentReport/TuitionChart.tsx)
- `next-month-tuition-report/components/TuitionChart.tsx` 이식

---

### 3. Services (New)
#### [NEW] [geminiService.ts](file:///d:/ijw-calander/services/geminiService.ts)
- AI 분석 서비스 이식

#### [NEW] [sheetService.ts](file:///d:/ijw-calander/services/sheetService.ts)
- Google Sheets 동기화 서비스 이식

---

### 4. Types
#### [MODIFY] [types.ts](file:///d:/ijw-calander/types.ts)
- `TuitionEntry` 및 `ReportSummary` 인터페이스 추가

---

## Verification Plan

### Manual Verification
1. MASTER 계정으로 로그인 → "전자 결제" 탭 표시 확인
2. 일반 사용자 로그인 → 탭 숨김 확인
3. 결제 리포트 CRUD 기능 테스트

---

## Implementation Results (2025-12-31)

### ✅ Completed
- **App.tsx**: `appMode`에 `'payment'` 추가, MASTER 전용 탭 버튼 생성, PaymentReport 렌더링 추가
- **components/PaymentReport/**:
  - `PaymentReport.tsx` - 메인 컴포넌트
  - `EntryForm.tsx` - 수강료 등록/수정 모달
  - `TuitionChart.tsx` - 차트 컴포넌트 (recharts)
- **services/**:
  - `geminiService.ts` - AI 리포트 생성
  - `sheetService.ts` - Google Sheets 동기화
- **types.ts**: `TuitionEntry`, `ReportSummary` 인터페이스 추가
- **Dependencies**: `recharts`, `@google/genai`, `react-markdown` 설치

### 적용된 색상 스킴
- 곤색 (`#081429`): 헤더 배경, 테이블 헤더
- 노란색 (`#fdb813`): 강조 버튼, 차트 색상, 활성 탭
- 회색 (`#373d41`): 텍스트, 테두리

