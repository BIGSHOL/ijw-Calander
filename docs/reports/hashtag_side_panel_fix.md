# 참가자 관리 패널 레이아웃 수정

## 수정 날짜
2026-01-09

## 문제점
초기 구현에서 참가자 패널이 **화면 우측 끝**에서 나타나도록 되어 있었음.
- `position: fixed`, `right: 0`
- 화면 전체를 덮는 backdrop

## 요구사항
일정 모달 **바로 옆**에 참가자 모달이 나타나야 함.
- 두 개의 모달이 나란히 표시
- 기존 일정 모달 + 참가자 모달 (좌우 배치)

## 수정 내용

### 1. EventModal.tsx
**Before:**
```typescript
return (
  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={onClose}>
    <div className="bg-white rounded-2xl ... max-w-2xl ...">
      {/* 일정 모달 내용 */}
    </div>
    {/* 참가자 패널이 여기 */}
  </div>
);
```

**After:**
```typescript
return (
  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 gap-4 p-4" onClick={onClose}>
    {/* Main Event Modal */}
    <div className="bg-white rounded-2xl ... max-w-2xl ...">
      {/* 일정 모달 내용 */}
    </div>

    {/* Participants Management Side Panel */}
    <div onClick={(e) => e.stopPropagation()}>
      <ParticipantsPanel isOpen={isPanelOpen} ... />
    </div>
  </div>
);
```

**변경 사항:**
- Flex container에 `gap-4 p-4` 추가 → 두 모달 사이 간격
- 참가자 패널을 wrapper div로 감싸서 클릭 이벤트 전파 방지

### 2. ParticipantsPanel.tsx

**Before:**
```typescript
return (
  <>
    {/* Backdrop */}
    {isOpen && (
      <div className="fixed inset-0 bg-black/20 z-[9998]" onClick={onClose} />
    )}

    {/* Side Panel */}
    <div className="fixed top-0 right-0 h-full w-96 bg-white ...">
      {/* 패널 내용 */}
    </div>
  </>
);
```

**After:**
```typescript
return (
  <>
    {/* Side Panel - No backdrop, positioned relative to modal */}
    <div className="bg-white rounded-2xl shadow-2xl w-96 max-h-[90vh] border border-gray-200 transform transition-all duration-300 ease-in-out ${
      isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
    }">
      <div className="flex flex-col max-h-[90vh]">
        {/* 패널 내용 */}
      </div>
    </div>
  </>
);
```

**변경 사항:**
- ❌ Backdrop 제거 (EventModal의 backdrop 공유)
- ❌ `fixed`, `right-0`, `h-full` 제거 → 상대 위치로 변경
- ✅ `max-h-[90vh]` 추가 → 일정 모달과 동일한 높이
- ✅ `opacity`와 `scale` 애니메이션으로 변경
- ✅ `pointer-events-none` → 닫혔을 때 클릭 불가

## 결과 레이아웃

```
┌────────────────────────────────────────────────────────┐
│          fixed backdrop (bg-black/60)                  │
│                                                        │
│  ┌─────────────────┐      ┌─────────────────┐        │
│  │                 │ gap  │                 │        │
│  │  일정 모달      │  4   │  참가자 패널    │        │
│  │  (max-w-2xl)    │      │  (w-96)         │        │
│  │                 │      │                 │        │
│  │  max-h-[90vh]   │      │  max-h-[90vh]   │        │
│  │                 │      │                 │        │
│  └─────────────────┘      └─────────────────┘        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

## CSS 클래스 정리

### EventModal backdrop container
- `fixed inset-0` - 전체 화면
- `bg-black bg-opacity-60` - 반투명 배경
- `flex items-center justify-center` - 가운데 정렬
- `z-50` - 최상위
- `gap-4 p-4` - 모달 간격 및 여백

### 일정 모달
- `bg-white rounded-2xl shadow-2xl`
- `w-full max-w-2xl` - 최대 너비
- `max-h-[90vh]` - 최대 높이
- `overflow-hidden border border-gray-200`

### 참가자 패널
- `bg-white rounded-2xl shadow-2xl`
- `w-96` - 고정 너비 384px
- `max-h-[90vh]` - 일정 모달과 동일한 최대 높이
- `transform transition-all duration-300`
- `opacity-100 scale-100` (열림) / `opacity-0 scale-95 pointer-events-none` (닫힘)

## 애니메이션

### 이전 (슬라이드 인)
```css
transform: translateX(0);  /* 열림 */
transform: translateX(100%); /* 닫힘 */
```

### 현재 (페이드 + 스케일)
```css
opacity: 1; scale: 1; /* 열림 */
opacity: 0; scale: 0.95; pointer-events: none; /* 닫힘 */
```

## 사용자 경험

1. 일정 생성/수정 모달 열기
2. 해시태그 선택 → #세미나 등
3. 자동으로 우측에 참가자 패널 페이드 인
4. 두 모달이 나란히 표시
5. 배경 클릭 시 두 모달 모두 닫힘
6. 각 모달 내부 클릭 시 닫히지 않음 (stopPropagation)

## 반응형 고려사항

현재는 데스크톱 기준 구현:
- 일정 모달: 최대 672px (max-w-2xl)
- 참가자 패널: 384px (w-96)
- 간격: 16px (gap-4)
- 총 필요 너비: ~1088px

향후 모바일 대응 필요:
```css
@media (max-width: 1200px) {
  /* 작은 화면에서는 세로 배치 또는 탭 전환 */
}
```

## 테스트 체크리스트

- [x] TypeScript 컴파일 에러 없음
- [ ] 세미나 태그 선택 시 패널 나타남
- [ ] 두 모달이 나란히 표시됨
- [ ] 배경 클릭 시 모두 닫힘
- [ ] 모달 내부 클릭 시 닫히지 않음
- [ ] 스크롤이 각 모달에서 독립적으로 작동
- [ ] 애니메이션이 자연스러움
