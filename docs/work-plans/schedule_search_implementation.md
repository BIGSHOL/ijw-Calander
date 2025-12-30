# 일정 검색 기능 구현 계획

## 목표
캘린더 일정을 검색/필터링하는 통합 검색 기능 구현

---

## 기능 요구사항

### 1. 텍스트 검색
- 일정명/설명에서 키워드 검색
- 실시간 필터링 (입력 시 즉시 반영)
- 검색 결과 하이라이트

### 2. 카테고리 필터
- 색상/카테고리별 필터
- 다중 선택 가능
- 토글 방식 UI

### 3. 날짜 범위 검색
- 시작일 ~ 종료일 선택
- 해당 기간 일정만 표시
- 빠른 선택: 오늘, 이번 주, 이번 달

---

## UI 설계

```
┌─────────────────────────────────────────────────┐
│ 🔍 일정 검색...                          [필터] │
├─────────────────────────────────────────────────┤
│ [필터 패널 - 펼침 시 표시]                       │
│ ┌─────────────────────────────────────────────┐ │
│ │ 카테고리: [학교] [학원] [진로] [기타]        │ │
│ │ 기간: [이번 주 ▼] 또는 [2025.03.01] ~ [...] │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## 구현 계획 (상세)

### 구현 위치
- **파일**: `components/CalendarBoard.tsx`
- **삽입 위치**: Line 310 (Navigation Group 위)

---

### Phase 1: 레이아웃 재배치 & 컴포넌트 이동
- **목표**: 검색바를 상단 헤더의 네비게이션(좌)과 액션버튼(우) 사이로 이동
- **구조**:
  ```tsx
  <div className="flex justify-between items-center gap-4 ...">
    <NavigationGroup /> {/* Left */}
    <SearchComponent className="flex-1 max-w-lg" /> {/* Center */}
    <ActionGroup /> {/* Right */}
  </div>
  ```

### Phase 2: 필터 로직 전면 수정
- **카테고리**:
  - 색상 필터 제거
  - 실제 부서(Department) 명칭 기반 선택 UI
  - `departments` prop 활용
- **기간 필터 (Smart Date Range)**:
  - **구성요소**:
    1. 기준일 (Date Input)
    2. 기간 단위 (1주/1개월/1년)
    3. 방향 (이전/이후)
  - **로직 예시**: 
    - 2025-01-25 + 1년 + 이전 => 2024-01-25 ~ 2025-01-25

### Phase 3: 테스트
- 날짜 계산 로직 검증 (date-fns 활용)
- 모바일/데스크탑 레이아웃 확인

---

### Phase 4: 결과 패널 (Option B)
**예상 시간**: 45분

```tsx
{searchQuery && filteredEvents.length > 0 && (
  <div className="bg-white rounded-xl border shadow-lg max-h-[300px] overflow-y-auto">
    <div className="p-2 border-b font-bold">
      검색 결과 ({filteredEvents.length}건)
    </div>
    {filteredEvents.map(event => (
      <div 
        key={event.id}
        onClick={() => {
          onDateChange(parseISO(event.startDate));
          setSearchQuery('');
        }}
        className="p-3 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
      >
        <div className="w-3 h-3 rounded-full" style={{backgroundColor: event.color}} />
        <span className="font-bold">{event.title}</span>
        <span className="text-gray-400 text-sm">
          {format(parseISO(event.startDate), 'yyyy.MM.dd')}
        </span>
      </div>
    ))}
  </div>
)}
```

---

### Phase 5: 테스트
- [ ] 텍스트 검색 동작 확인
- [ ] 카테고리 필터 동작 확인
- [ ] 날짜 범위 필터 동작 확인
- [ ] 결과 클릭 시 해당 날짜로 이동 확인
- [ ] 모바일 반응형 확인

---

## 검색 결과 표시 (선택됨: 옵션 B)

**별도 결과 패널 방식**:
- 검색바 아래 슬라이드 패널로 결과 표시
- 리스트 형태: 일정명, 날짜, 카테고리
- 클릭 시 해당 날짜로 캘린더 이동
- 결과 개수 표시

```
┌──────────────────────────────────────────┐
│ 🔍 "회의" 검색                    [필터 ▼] │
├──────────────────────────────────────────┤
│ 📋 검색 결과 (3건)                        │
│ ┌────────────────────────────────────┐   │
│ │ 🔴 정기회의 - 2025.03.05 (수)      │   │
│ │ 🟡 학부모회의 - 2025.03.12 (수)    │   │
│ │ 🔵 교사회의 - 2025.03.20 (목)      │   │
│ └────────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

---

## 4. 최종 구현 보고서 (2025-12-30 완료)

### 4.1 UI 구조 및 레이아웃
- **위치 변경**: 검색바를 헤더의 중앙(Navigation Group과 Action Group 사이)에 배치하여 접근성 향상.
- **반응형 디자인**: `flex-1` 및 `max-w` 속성을 사용하여 화면 너비에 따라 유동적으로 조절됨.
- **컴포넌트 구조**:
  ```tsx
  <div className="flex ... gap-4">
    <NavigationGroup /> {/* 날짜 이동 */}
    <div className="flex-1 ...">
      <SearchBar /> {/* 검색 입력 및 필터 버튼 */}
      <FilterPanel /> {/* 조건부 렌더링 */}
      <ResultList /> {/* 조건부 렌더링 */}
    </div>
    <ActionGroup /> {/* 내 일정, 보기 설정 등 */}
  </div>
  ```

### 4.2 필터 로직 (Smart Filter)
기존 계획(단순 날짜 범위)에서 사용자 피드백을 반영하여 **스마트 기간 필터**로 고도화되었습니다.

1.  **텍스트 검색**:
    - 대상: 제목, 설명, 참여자(`participants`)
    - 방식: `toLowerCase()`를 이용한 대소문자 무시 부분 일치 검색
    - **안전성 확보**: `participants` 필드가 문자열이 아닌 경우를 대비한 타입 가드(`typeof === 'string'`) 추가 적용.

2.  **카테고리 필터**:
    - 기준: `departmentId` (부서 ID)
    - UI: `departments` 배열을 기반으로 버튼 생성 (기존 색상 필터 대체)
    - 동작: 다중 선택 가능 (OR 조건)

3.  **기간 필터 (Smart Date Range)**:
    - **구성요소**:
        - 기준일 (`filterBaseDate`): 사용자 지정 날짜
        - 기간 (`filterDuration`): 1주(1w) / 1개월(1m) / 1년(1y)
        - 방향 (`filterDirection`): 이전(before) / 이후(after)
    - **계산 로직**:
        - `date-fns`의 `addWeeks`, `subMonths` 등을 활용하여 동적으로 `startRange`와 `endRange` 계산.
        - 예: [2025-01-01] + [1년] + [이전] => 2024-01-01 ~ 2025-01-01

### 4.3 데이터 처리 및 성능
- **Memoization**: `useMemo` 훅을 사용하여 필터 조건이나 원본 이벤트 데이터가 변경될 때만 필터링 로직 재수행.
- **날짜 포맷**: `date-fns/locale/ko`를 적용하여 한국어 요일 및 날짜 형식으로 결과 표시.

### 4.4 주요 수정 이력
- **버그 수정**: `e.participants.toLowerCase` 실행 시 발생하던 `TypeError` 수정 (데이터 무결성 확보).
- **UI 개선**: 검색바가 너무 길다는 피드백 반영, 레이아웃 중앙 배치로 수정.
