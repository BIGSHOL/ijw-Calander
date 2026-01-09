# 일정 복사 기능 구현 계획 (Schedule Copy Implementation Plan)

## 1. 개요 (Overview)
기존 일정을 손쉽게 복제하여 새로운 일정을 생성할 수 있는 기능을 추가합니다. 반복적인 업무나 비슷한 유형의 일정을 등록할 때 사용자의 편의성을 높입니다.

## 2. 사용자 경험 (UX Design)
- **진입점**: 일정 상세 보기 모달 (Event Modal - View Mode)
- **UI 요소**: "복사" (Copy) 버튼 추가 (수정/삭제 버튼 근처)
- **동작 흐름**:
  1. 사용자가 기존 일정을 클릭하여 상세 팝업을 엽니다.
  2. "복사" 버튼을 클릭합니다.
  3. 팝업이 "일정 생성 모드"로 전환됩니다.
     - **제목**: `[복사] 원본 제목` (또는 그대로 유지)
     - **날짜/시간**: 원본과 동일 (사용자가 수정 가능)
     - **내용/참석자/색상**: 원본 데이터가 모두 미리 채워짐
  4. 사용자가 필요한 내용을 수정한 후 "저장" 버튼을 누릅니다.
  5. 새로운 일정이 생성됩니다.

## 3. 기술적 접근 (Technical Approach)

### A. App.tsx (State Management)
- 현재 `editingEvent` 상태는 "수정" 모드를 위한 것입니다.
- "복사"를 지원하기 위해 `templateEvent` (또는 `copySourceEvent`) 상태를 새로 추가하거나, 기존 `EventModal`의 Props 구조를 개선해야 합니다.
- **제안 방식**:
  - `EventModal`에 `templateEvent` prop을 추가합니다.
  - `templateEvent`가 존재하면:
    - ID는 무시하고(새 일정 취급)
    - Form 초기값은 이 객체에서 가져옵니다.
    - 저장 시 `addDoc` (생성) 로직을 따릅니다.

### B. EventModal.tsx (Component Logic)
- `interface EventModalProps`에 `onCopy` 콜백 추가.
- 뷰 모드(읽기 전용 상태)일 때 "복사" 버튼 렌더링.
- 초기 상태(`useState`) 설정 로직 수정:
  - `existingEvent`가 있으면 그것을 우선.
  - `existingEvent`가 없고 `templateEvent`가 있으면 그것을 초기값으로 사용.

## 4. 구현 단계 (Implementation Steps)

### Phase 1: EventModal Props 및 UI 수정
- [ ] `EventModalProps`에 `onCopy` 및 `templateEvent` 추가
- [ ] `EventModal` 내부 초기값 로직(`useEffect` or `useState` init) 수정하여 `templateEvent` 지원
- [ ] 상세 보기 화면(`isViewMode`) 하단에 "복사하기" 버튼 추가

### Phase 2: App.tsx 로직 구현
- [ ] `copiedEvent` state 추가 (선택 사항, 또는 `handleCopy`에서 즉시 처리)
- [ ] `handleCopyEvent(event)` 함수 구현:
  - 현재 보고 있는 `editingEvent`를 닫음.
  - `editingEvent`는 `null`로 설정.
  - `templateEvent`에 복사할 객체 전달.
  - 모달 다시 열기 (`setIsEventModalOpen(true)`).

### Phase 3: 검증 (Verification)
- [ ] 일정 복사 시 제목, 내용, 색상, 참석자 등이 올바르게 넘어오는지 확인
- [ ] 저장 시 기존 일정이 수정되는 것이 아니라 **새로운 일정**이 생성되는지 확인 (ID 확인)
- [ ] 복사 후 원본 일정은 그대로 유지되는지 확인

## 5. 예상되는 이슈 및 해결 (Potential Issues)
- **ID 충돌**: `templateEvent`를 사용할 때 ID는 반드시 제외하거나 무시해야 함.
- **날짜 처리**: 복사 시 날짜를 오늘 날짜로 바꿀지, 원본 날짜를 유지할지 결정 필요. (현재안: 원본 유지 후 사용자 수정 유도)

## 6. 결론
이 기능은 기존 모달 로직을 크게 해치지 않으면서 `template` 개념을 도입하여 안전하게 구현할 수 있습니다.
