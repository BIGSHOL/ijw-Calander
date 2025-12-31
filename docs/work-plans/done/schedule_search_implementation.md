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

---

## 코드 검증 및 개선사항 (2025-12-30)

### 실제 구현 코드 분석 (CalendarBoard.tsx)

#### 현재 구현 상태 ✅

**위치**: Lines 247-303

**상태 관리**:
```typescript
const [searchQuery, setSearchQuery] = React.useState('');
const [isFilterOpen, setIsFilterOpen] = React.useState(false);
const [selectedDepts, setSelectedDepts] = React.useState<string[]>([]);
const [filterBaseDate, setFilterBaseDate] = React.useState<Date | null>(null);
const [filterDuration, setFilterDuration] = React.useState<'1w' | '1m' | '1y' | null>(null);
const [filterDirection, setFilterDirection] = React.useState<'before' | 'after'>('after');
```

**필터링 로직** (useMemo 사용):
```typescript
const filteredEvents = useMemo(() => {
    if (!searchQuery && selectedDepts.length === 0 && !filterBaseDate) {
        return []; // 활성 필터가 없으면 빈 배열 반환
    }

    // 날짜 범위 계산
    let startRange: Date | null = null;
    let endRange: Date | null = null;

    if (filterBaseDate && filterDuration) {
        const base = startOfDay(filterBaseDate);
        if (filterDirection === 'after') {
            startRange = base;
            if (filterDuration === '1w') endRange = addWeeks(base, 1);
            else if (filterDuration === '1m') endRange = addMonths(base, 1);
            else if (filterDuration === '1y') endRange = addYears(base, 1);
        } else {
            endRange = base;
            if (filterDuration === '1w') startRange = subWeeks(base, 1);
            else if (filterDuration === '1m') startRange = subMonths(base, 1);
            else if (filterDuration === '1y') startRange = subYears(base, 1);
        }
    }

    return events.filter(e => {
        // 1. 텍스트 검색
        const query = searchQuery.toLowerCase();
        const matchesText = !searchQuery ||
            e.title.toLowerCase().includes(query) ||
            (e.description && e.description.toLowerCase().includes(query)) ||
            (e.participants && typeof e.participants === 'string' &&
                e.participants.toLowerCase().includes(query));

        // 2. 부서 필터
        const matchesDept = selectedDepts.length === 0 ||
            selectedDepts.includes(e.departmentId);

        // 3. 날짜 필터
        let matchesDate = true;
        if (startRange && endRange) {
            const eventStart = startOfDay(parseISO(e.startDate));
            matchesDate = eventStart >= startRange && eventStart <= endRange;
        }

        return matchesText && matchesDept && matchesDate;
    }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}, [events, searchQuery, selectedDepts, filterBaseDate, filterDuration, filterDirection]);
```

---

### Firebase 비용 분석 💰

#### 비용 영향 평가

**현재 구현**:
- 검색은 **클라이언트 사이드**에서 수행 (Firestore 쿼리 아님)
- `events` prop으로 전달받은 데이터를 JavaScript로 필터링
- **추가 Firestore 읽기 없음** ✅

**비용 계산**:
```
읽기 비용: +0회 (검색은 메모리 내 필터링)
쓰기 비용: +0회 (검색 결과를 저장하지 않음)
총 비용 증가: $0.00/월 ✅
```

**결론**: 검색 기능 추가로 인한 **Firebase 비용 증가 없음**

#### 성능 최적화 상태

**✅ 이미 적용된 최적화**:
1. **useMemo 사용**: 의존성 배열 변경 시에만 재계산
2. **조건부 필터링**: 활성 필터가 없으면 빈 배열 반환 (불필요한 계산 방지)
3. **정렬**: 날짜순 정렬로 사용자 경험 향상

**⚠️ 잠재적 성능 이슈**:

**이슈 1: 대량 데이터 처리**
```typescript
// 문제: events가 10,000개 이상일 때 필터링 지연 발생 가능
return events.filter(e => { ... }).sort(...);

// 현재 상황: 학원 관리 시스템 - 연간 이벤트 ~1,000개 예상
// 영향도: 낮음 (현재 데이터 규모에서는 문제 없음)
```

**이슈 2: 검색어 입력마다 재계산**
```typescript
// 현재: 입력할 때마다 useMemo 재실행
onChange={(e) => setSearchQuery(e.target.value)}

// 개선: Debounce 추가 (300ms)
const debouncedSearch = useMemo(
    () => debounce((value: string) => setSearchQuery(value), 300),
    []
);

onChange={(e) => debouncedSearch(e.target.value)}
```

**예상 효과**: 타이핑 시 불필요한 재계산 방지 (성능 향상)

---

### 코드 품질 검토 🔍

#### ✅ 우수한 점

**1. 타입 안전성**
```typescript
// ✅ 타입 가드 적용
(e.participants && typeof e.participants === 'string' &&
    e.participants.toLowerCase().includes(query))
```

**2. 안전한 Optional Chaining**
```typescript
// ✅ null/undefined 처리
(e.description && e.description.toLowerCase().includes(query))
```

**3. 의존성 배열 명시**
```typescript
// ✅ 모든 의존성 나열
}, [events, searchQuery, selectedDepts, filterBaseDate, filterDuration, filterDirection]);
```

#### ⚠️ 개선 필요 사항

**1. participants 필드 타입 불일치**

**문제**:
```typescript
// CalendarEvent 타입 정의 확인 필요
// participants가 string | string[] | undefined 일 수 있음
e.participants && typeof e.participants === 'string'
```

**개선안**:
```typescript
// 배열도 처리 가능하도록 개선
const matchesParticipants = () => {
    if (!e.participants) return false;

    if (typeof e.participants === 'string') {
        return e.participants.toLowerCase().includes(query);
    }

    if (Array.isArray(e.participants)) {
        return e.participants.some(p =>
            p.toLowerCase().includes(query)
        );
    }

    return false;
};

const matchesText = !searchQuery ||
    e.title.toLowerCase().includes(query) ||
    (e.description && e.description.toLowerCase().includes(query)) ||
    matchesParticipants();
```

**2. 날짜 범위 계산 중복 코드**

**문제**:
```typescript
// before/after 분기에서 중복 패턴
if (filterDuration === '1w') endRange = addWeeks(base, 1);
else if (filterDuration === '1m') endRange = addMonths(base, 1);
else if (filterDuration === '1y') endRange = addYears(base, 1);
```

**개선안**:
```typescript
const calculateDateRange = (base: Date, duration: '1w' | '1m' | '1y', direction: 'before' | 'after') => {
    const durationMap = {
        '1w': { add: addWeeks, sub: subWeeks },
        '1m': { add: addMonths, sub: subMonths },
        '1y': { add: addYears, sub: subYears }
    };

    const fn = direction === 'after'
        ? durationMap[duration].add
        : durationMap[duration].sub;

    return direction === 'after'
        ? { start: base, end: fn(base, 1) }
        : { start: fn(base, 1), end: base };
};

if (filterBaseDate && filterDuration) {
    const base = startOfDay(filterBaseDate);
    const range = calculateDateRange(base, filterDuration, filterDirection);
    startRange = range.start;
    endRange = range.end;
}
```

**3. 검색 결과 없음 상태 처리**

**현재** (Lines 595-600):
```typescript
{(filteredEvents.length === 0) && (searchQuery) && (
    <div className="...">
        <p>검색 결과가 없습니다.</p>
    </div>
)}
```

**문제**: selectedDepts나 filterBaseDate로만 필터링 시 메시지 미표시

**개선안**:
```typescript
const hasActiveFilters = searchQuery || selectedDepts.length > 0 || filterBaseDate;

{(filteredEvents.length === 0) && hasActiveFilters && (
    <div className="...">
        <p>검색 결과가 없습니다.</p>
        <p className="text-xs">현재 필터:
            {searchQuery && `검색어 "${searchQuery}"`}
            {selectedDepts.length > 0 && ` | 부서 ${selectedDepts.length}개`}
            {filterBaseDate && ` | 기간 ${format(filterBaseDate, 'yyyy.MM.dd')}`}
        </p>
    </div>
)}
```

---

### 잠재적 버그 및 엣지 케이스 🐛

#### 버그 1: 날짜 경계값 처리

**시나리오**:
```
기준일: 2025-02-28
기간: 1개월 후
결과: 2025-03-28 (예상) vs 2025-03-31 (실제?)
```

**확인 필요**:
```typescript
// date-fns의 addMonths 동작 확인
console.log(addMonths(new Date('2025-01-31'), 1));
// 2025-02-28 (월말 조정)
```

**대응**: date-fns는 자동으로 월말 조정하므로 **문제 없음** ✅

#### 버그 2: 윤년 처리

**시나리오**:
```
기준일: 2024-02-29 (윤년)
기간: 1년 후
결과: 2025-02-28? 2025-03-01?
```

**확인**:
```typescript
console.log(addYears(new Date('2024-02-29'), 1));
// 2025-02-28 (date-fns가 자동 조정)
```

**대응**: date-fns가 처리하므로 **문제 없음** ✅

#### 버그 3: 특수문자 입력

**시나리오**:
```
검색어: "회의[정기]"
에러: 정규식으로 해석될 수 있음? (현재는 단순 includes 사용)
```

**확인**: `includes()` 메서드는 문자열로만 처리하므로 **문제 없음** ✅

#### 버그 4: 대소문자 구분 (비영어권)

**시나리오**:
```
검색어: "İstanbul" (터키어 대문자 I)
결과: "istanbul"과 매칭되지 않을 수 있음
```

**현재 코드**:
```typescript
toLowerCase() // JavaScript의 기본 동작 사용
```

**영향**: 한국어 서비스이므로 **영향 없음** ✅

#### 버그 5: 메모리 누수

**확인 필요**:
```typescript
// 검색 패널 열림/닫힘 시 이벤트 리스너 관리
// CalendarBoard 컴포넌트 언마운트 시 cleanup
```

**현재 상태**: 이벤트 리스너 미사용 (상태만 사용) → **문제 없음** ✅

---

### 보안 검토 🔒

#### ✅ 안전함

1. **XSS 방지**: React가 자동으로 이스케이프 처리
2. **인젝션 공격**: Firestore 쿼리 미사용 (클라이언트 필터링)
3. **민감 정보 노출**: 검색 결과는 이미 로드된 데이터만 표시

#### ⚠️ 확인 필요

**Firestore Security Rules**:
```javascript
// events 컬렉션 읽기 권한 확인
match /events/{eventId} {
  allow read: if request.auth != null; // 인증된 사용자만?
}
```

**권장**: 부서별 접근 제어 필요 시 추가 규칙 설정

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

---

## 5. 권장 개선사항 (우선순위별)

### 🔴 High Priority (즉시 적용 권장)

#### 1. Debounce 추가로 성능 최적화
**예상 소요**: 15분
**파일**: CalendarBoard.tsx
**위치**: Line 437

**현재**:
```typescript
onChange={(e) => setSearchQuery(e.target.value)}
```

**개선**:
```typescript
import { debounce } from 'lodash';

// 컴포넌트 상단
const debouncedSetSearch = useMemo(
    () => debounce((value: string) => setSearchQuery(value), 300),
    []
);

// cleanup
useEffect(() => {
    return () => {
        debouncedSetSearch.cancel();
    };
}, [debouncedSetSearch]);

// input onChange
onChange={(e) => debouncedSetSearch(e.target.value)}
```

**효과**: 타이핑 시 불필요한 재계산 방지, CPU 사용량 감소

---

#### 2. 검색 결과 없음 조건 개선
**예상 소요**: 10분
**파일**: CalendarBoard.tsx
**위치**: Line 595

**현재**:
```typescript
{(filteredEvents.length === 0) && (searchQuery) && (
    // 메시지 표시
)}
```

**개선**:
```typescript
const hasActiveFilters = searchQuery || selectedDepts.length > 0 || filterBaseDate;

{(filteredEvents.length === 0) && hasActiveFilters && (
    <div className="...">
        <Search size={32} className="mx-auto text-gray-300 mb-2" />
        <p className="text-gray-500 font-bold text-sm">검색 결과가 없습니다.</p>
        <div className="text-xs text-gray-400 mt-2 space-y-1">
            {searchQuery && <p>검색어: "{searchQuery}"</p>}
            {selectedDepts.length > 0 && (
                <p>선택된 부서: {selectedDepts.length}개</p>
            )}
            {filterBaseDate && (
                <p>기간: {format(filterBaseDate, 'yyyy.MM.dd')} {filterDuration && `(${filterDuration} ${filterDirection === 'after' ? '이후' : '이전'})`}</p>
            )}
        </div>
        <button
            onClick={() => {
                setSearchQuery('');
                setSelectedDepts([]);
                setFilterBaseDate(null);
                setFilterDuration(null);
            }}
            className="mt-3 text-xs text-indigo-500 hover:underline"
        >
            모든 필터 초기화
        </button>
    </div>
)}
```

**효과**: 사용자가 왜 결과가 없는지 명확히 이해, UX 향상

---

### 🟡 Medium Priority (다음 스프린트)

#### 3. participants 배열 타입 지원
**예상 소요**: 30분
**파일**: CalendarBoard.tsx
**위치**: Line 285-288

**개선**:
```typescript
const matchesParticipants = () => {
    if (!e.participants) return false;

    if (typeof e.participants === 'string') {
        return e.participants.toLowerCase().includes(query);
    }

    if (Array.isArray(e.participants)) {
        return e.participants.some(p =>
            typeof p === 'string' && p.toLowerCase().includes(query)
        );
    }

    return false;
};

const matchesText = !searchQuery ||
    e.title.toLowerCase().includes(query) ||
    (e.description && e.description.toLowerCase().includes(query)) ||
    matchesParticipants();
```

**효과**: 향후 참여자 필드가 배열로 변경되어도 호환성 유지

---

#### 4. 날짜 범위 계산 함수 리팩토링
**예상 소요**: 45분
**파일**: CalendarBoard.tsx
**위치**: Line 267-280

**개선**: 별도 유틸 함수 분리
```typescript
// utils/dateRangeUtils.ts (신규 파일)
export const calculateDateRange = (
    base: Date,
    duration: '1w' | '1m' | '1y',
    direction: 'before' | 'after'
): { start: Date; end: Date } => {
    const durationMap = {
        '1w': { add: addWeeks, sub: subWeeks },
        '1m': { add: addMonths, sub: subMonths },
        '1y': { add: addYears, sub: subYears }
    };

    const fn = direction === 'after'
        ? durationMap[duration].add
        : durationMap[duration].sub;

    return direction === 'after'
        ? { start: base, end: fn(base, 1) }
        : { start: fn(base, 1), end: base };
};

// CalendarBoard.tsx에서 사용
if (filterBaseDate && filterDuration) {
    const base = startOfDay(filterBaseDate);
    const range = calculateDateRange(base, filterDuration, filterDirection);
    startRange = range.start;
    endRange = range.end;
}
```

**효과**: 코드 재사용성 향상, 테스트 용이

---

### 🟢 Low Priority (선택적)

#### 5. 검색 히스토리 기능
**예상 소요**: 2시간
**설명**: 최근 검색어 5개 저장 및 제안

```typescript
const [searchHistory, setSearchHistory] = useState<string[]>([]);

// 검색 시 히스토리에 추가
const addToHistory = (query: string) => {
    if (!query.trim()) return;
    const newHistory = [query, ...searchHistory.filter(h => h !== query)].slice(0, 5);
    setSearchHistory(newHistory);
    localStorage.setItem('search_history', JSON.stringify(newHistory));
};

// 컴포넌트 마운트 시 로드
useEffect(() => {
    const saved = localStorage.getItem('search_history');
    if (saved) {
        setSearchHistory(JSON.parse(saved));
    }
}, []);
```

---

#### 6. 검색 결과 하이라이트
**예상 소요**: 1시간
**설명**: 검색어와 매칭되는 부분 강조 표시

```typescript
const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ?
            <mark key={i} className="bg-yellow-200">{part}</mark> :
            part
    );
};

// 사용
<span className="font-bold">{highlightText(event.title, searchQuery)}</span>
```

---

#### 7. 고급 검색 옵션
**예상 소요**: 3시간
**설명**: AND/OR/NOT 연산자 지원

```typescript
// 예: "회의 AND 정기" 또는 "행사 NOT 취소"
const parseSearchQuery = (query: string) => {
    // 간단한 구현
    const terms = query.split(' AND ').map(t => t.trim());
    // ... 더 복잡한 파싱 로직
};
```

---

## 6. 테스트 체크리스트

### 단위 테스트
- [ ] 텍스트 검색 (제목, 설명, 참여자)
- [ ] 부서 필터 (단일/다중 선택)
- [ ] 날짜 범위 계산 (1주/1개월/1년, 이전/이후)
- [ ] 빈 검색어 처리
- [ ] 특수문자 검색
- [ ] participants 타입 가드

### 통합 테스트
- [ ] 검색 + 부서 필터 조합
- [ ] 검색 + 날짜 필터 조합
- [ ] 모든 필터 동시 적용
- [ ] 필터 초기화

### E2E 테스트
- [ ] 검색어 입력 → 실시간 필터링
- [ ] 검색 결과 클릭 → 해당 날짜로 이동
- [ ] 필터 패널 열기/닫기
- [ ] 모바일 화면에서 검색

### 성능 테스트
- [ ] 1,000개 이벤트 필터링 (<100ms)
- [ ] 10,000개 이벤트 필터링 (<500ms)
- [ ] 타이핑 시 지연 없음 (debounce 적용 후)

### 접근성 테스트
- [ ] 키보드로 검색 가능
- [ ] Tab 키로 필터 이동
- [ ] Enter 키로 검색 결과 선택
- [ ] 스크린 리더 호환성

---

## 7. 변경 이력

### v2.0.0 (2025-12-30 - 코드 검증 및 개선안 추가)
- [추가] **코드 검증 섹션**: 실제 구현 코드 분석 (Lines 247-303)
- [추가] **Firebase 비용 분석**: 비용 증가 없음 확인 ($0.00/월)
- [추가] **성능 최적화 상태**: useMemo, 조건부 필터링, 정렬
- [추가] **코드 품질 검토**: 우수한 점 3개, 개선사항 3개
- [추가] **잠재적 버그 분석**: 5가지 엣지 케이스 검증
- [추가] **보안 검토**: XSS 방지, 인젝션 공격 대응
- [추가] **권장 개선사항**: 우선순위별 7가지 제안
  - High: Debounce 추가, 검색 결과 없음 조건 개선
  - Medium: participants 배열 지원, 날짜 계산 리팩토링
  - Low: 검색 히스토리, 하이라이트, 고급 검색
- [추가] **테스트 체크리스트**: 단위/통합/E2E/성능/접근성

### v1.0.0 (2025-12-29)
- [최초] 문서 작성 (기능 요구사항, UI 설계, 구현 계획)
