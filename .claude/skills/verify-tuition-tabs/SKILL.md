---
name: verify-tuition-tabs
description: 수강료 계산기 탭의 컴포넌트 구조, 데이터 동기화, 청구서 CRUD, 세션/공휴일 관리를 검증합니다. 수강료 관련 컴포넌트/훅 수정 후 사용.
---

## Purpose

1. **3모드 전환** - TuitionCalculatorTab의 calculator/manage/invoiceList 모드가 올바르게 전환되는지 검증
2. **DB 카테고리 매핑** - TuitionSessionManager의 한국어↔영어 카테고리 매핑(수학↔math, 영어↔english, EiE↔eie)이 올바른지 검증
3. **출석부 동기화** - session_periods, holidays 컬렉션이 출석부와 양방향 동기화되는지 검증
4. **청구서 CRUD** - 청구서 저장/조회/삭제와 인쇄 기능이 올바르게 연결되어 있는지 검증
5. **학생 자동완성** - 학생명 입력 시 자동완성 + 학교/학년 자동채움이 동작하는지 검증
6. **인보이스 미리보기** - A4 미리보기와 로고 표시가 정상인지 검증

## When to Run

- `components/TuitionCalculator/` 디렉토리의 파일을 수정한 후
- `hooks/useTuition*.ts` 훅을 수정한 후
- `hooks/useSessionPeriods.ts`의 invalidation 로직을 변경한 후
- `types/tuition.ts` 타입을 변경한 후
- `constants/tuition*.ts` 상수를 변경한 후

## Related Files

| File | Purpose |
|------|---------|
| `components/TuitionCalculator/TuitionCalculatorTab.tsx` | 메인 탭 (3모드 전환, useStudents, staffName 기본값) |
| `components/TuitionCalculator/TuitionInputSection.tsx` | 좌측 입력 패널 (학생 자동완성, 과목/교재/할인 선택) |
| `components/TuitionCalculator/TuitionInvoicePreview.tsx` | 우측 A4 미리보기 (로고 /logo_garo.png) |
| `components/TuitionCalculator/TuitionInvoiceList.tsx` | 저장된 청구서 목록 |
| `components/TuitionCalculator/TuitionPriceViewer.tsx` | 과목 단가 조회 |
| `components/TuitionCalculator/TuitionExtrasViewer.tsx` | 기타항목 조회 |
| `components/TuitionCalculator/TuitionDiscountViewer.tsx` | 할인 조회 |
| `components/TuitionCalculator/TuitionHolidayManager.tsx` | 공휴일 CRUD |
| `components/TuitionCalculator/TuitionSessionManager.tsx` | 시수 기간 설정 (카테고리 DB↔UI 매핑) |
| `components/TuitionCalculator/index.ts` | 배럴 export |
| `hooks/useTuitionInvoices.ts` | 청구서 Firebase CRUD (tuition_invoices 컬렉션) |
| `hooks/useTuitionSessions.ts` | 시수기간 Firebase CRUD (session_periods 컬렉션) |
| `hooks/useTuitionHolidays.ts` | 공휴일 Firebase CRUD (holidays 컬렉션) |
| `hooks/useTuitionCourses.ts` | 과목 Firebase CRUD (tuition_courses 컬렉션) |
| `hooks/useTuitionExtras.ts` | 기타항목 Firebase CRUD (tuition_extras 컬렉션) |
| `hooks/useTuitionDiscounts.ts` | 할인 Firebase CRUD (tuition_discounts 컬렉션) |
| `hooks/useSessionPeriods.ts` | 출석부 세션 훅 (양방향 동기화 대상) |
| `types/tuition.ts` | 수강료 타입 정의 |
| `constants/tuitionCourses.ts` | 과목 기본 데이터 (54개 과목) |
| `constants/tuitionExtras.ts` | 기타항목/할인 기본 데이터 |
| `utils/tuitionHolidays.ts` | 공휴일 유틸리티 (KOREAN_HOLIDAYS 2025-2030) |

## Workflow

### Step 1: 3모드 전환 구현 검증

**파일:** `components/TuitionCalculator/TuitionCalculatorTab.tsx`

**검사:** calculator, manage, invoiceList 3개 모드 분기가 모두 존재해야 합니다.

```bash
grep -n "calculator\|manage\|invoiceList" components/TuitionCalculator/TuitionCalculatorTab.tsx | head -15
```

**PASS 기준:** 3개 모드 문자열이 모두 참조되고, 조건부 렌더링 존재
**FAIL 기준:** 모드 전환 로직 누락

### Step 2: DB 카테고리 매핑 검증

**파일:** `components/TuitionCalculator/TuitionSessionManager.tsx`

**검사:** CATEGORY_TO_DB와 DB_TO_CATEGORY 매핑 테이블이 존재하고, 수학↔math, 영어↔english, EiE↔eie 3쌍이 정의되어야 합니다.

```bash
grep -n "CATEGORY_TO_DB\|DB_TO_CATEGORY" components/TuitionCalculator/TuitionSessionManager.tsx
```

**PASS 기준:** 양방향 매핑 테이블 존재 (3쌍)
**FAIL 기준:** 매핑 누락 시 출석부와 세션 데이터 불일치 발생

### Step 3: 출석부 동기화 — React Query 키 일치 검증

**검사:** useTuitionSessions와 useSessionPeriods가 동일한 React Query 키 접두사를 사용하여 양방향 캐시 무효화가 동작하는지 확인합니다.

```bash
grep -n "queryKey.*sessionPeriods\|SESSION_PERIODS_KEY" hooks/useTuitionSessions.ts hooks/useSessionPeriods.ts | head -10
```

**PASS 기준:** 양쪽 훅이 `['sessionPeriods']` 접두사로 invalidation
**FAIL 기준:** 다른 키 접두사 사용 (캐시 동기화 실패)

### Step 4: 공휴일 동기화 검증

**검사:** useTuitionHolidays와 출석부의 holidays 쿼리가 동일한 키를 사용하는지 확인합니다.

```bash
grep -n "queryKey.*holidays\|QUERY_KEY" hooks/useTuitionHolidays.ts | head -5
```

**PASS 기준:** `['holidays']` 키 사용
**FAIL 기준:** 키 불일치

### Step 5: 학생 자동완성 패턴 검증

**파일:** `components/TuitionCalculator/TuitionInputSection.tsx`

**검사:** 학생명 입력 자동완성이 구현되어 있고, 선택 시 학교/학년이 자동으로 채워지는지 확인합니다.

```bash
grep -n "filteredStudents\|handleSelectStudent\|showStudentDropdown" components/TuitionCalculator/TuitionInputSection.tsx | head -10
```

**PASS 기준:** filteredStudents (useMemo), handleSelectStudent, showStudentDropdown 모두 존재
**FAIL 기준:** 자동완성 관련 변수/함수 누락

### Step 6: 인보이스 미리보기 로고 경로 검증

**파일:** `components/TuitionCalculator/TuitionInvoicePreview.tsx`

**검사:** 로고 이미지 경로가 실제 존재하는 파일을 참조하는지 확인합니다.

```bash
grep -n "logo\|img.*src" components/TuitionCalculator/TuitionInvoicePreview.tsx | head -5
ls public/logo_garo.png 2>/dev/null || echo "MISSING: public/logo_garo.png"
```

**PASS 기준:** 로고 경로가 `/logo_garo.png`이고 `public/logo_garo.png` 파일 존재
**FAIL 기준:** 잘못된 로고 경로 (깨진 이미지)

### Step 7: 6개 tuition 훅의 mutation + invalidation 검증

**검사:** 6개 tuition 훅 모두 useMutation + invalidateQueries + onError 패턴을 따르는지 확인합니다.

```bash
for f in hooks/useTuitionCourses.ts hooks/useTuitionDiscounts.ts hooks/useTuitionExtras.ts hooks/useTuitionHolidays.ts hooks/useTuitionInvoices.ts hooks/useTuitionSessions.ts; do
  mutations=$(grep -c "useMutation" "$f" 2>/dev/null);
  invalidations=$(grep -c "invalidateQueries" "$f" 2>/dev/null);
  errors=$(grep -c "onError\|try {" "$f" 2>/dev/null);
  echo "$f: mutations=$mutations, invalidations=$invalidations, errors=$errors";
done
```

**PASS 기준:** 모든 훅에 mutations > 0, invalidations > 0, errors > 0
**FAIL 기준:** mutation은 있지만 invalidation 또는 에러 처리 누락

### Step 8: 타입 정의 완전성 검증

**파일:** `types/tuition.ts`

**검사:** 수강료 계산기에 필요한 핵심 타입이 모두 정의되어 있는지 확인합니다.

```bash
grep -n "export.*type\|export.*interface" types/tuition.ts | head -15
```

**PASS 기준:** TuitionCourse, TuitionExtraItem, TuitionDiscount, TuitionStudentInfo, TuitionSavedInvoice 타입 존재
**FAIL 기준:** 핵심 타입 누락

## Output Format

| # | 검사 항목 | 범위 | 결과 | 상세 |
|---|----------|------|------|------|
| 1 | 3모드 전환 | TuitionCalculatorTab | PASS/FAIL | |
| 2 | DB 카테고리 매핑 | TuitionSessionManager | PASS/FAIL | 3쌍 |
| 3 | 세션 동기화 | useTuitionSessions + useSessionPeriods | PASS/FAIL | |
| 4 | 공휴일 동기화 | useTuitionHolidays | PASS/FAIL | |
| 5 | 학생 자동완성 | TuitionInputSection | PASS/FAIL | |
| 6 | 로고 경로 | TuitionInvoicePreview | PASS/FAIL | |
| 7 | 6개 훅 mutation 패턴 | hooks/useTuition*.ts | PASS/FAIL | |
| 8 | 타입 완전성 | types/tuition.ts | PASS/FAIL | |

## Exceptions

다음은 **위반이 아닙니다**:

1. **TuitionSessionManager의 클라이언트 사이드 필터링** - 전체 세션을 불러온 후 year/category로 필터링하는 것은 데이터 양이 적어 정상 패턴
2. **TuitionHolidayManager에 마이그레이션 버튼 없음** - 기본 데이터 불러오기 기능은 의도적으로 제거됨
3. **TuitionInvoicePreview의 인쇄 전용 CSS** - `.tuition-print-mode` 클래스는 index.css의 `@media print`에서만 활성화되며 일반 모드에서는 보이지 않음
4. **constants/tuitionCourses.ts의 하드코딩된 과목** - 기본 과목은 상수로 관리하되, Firebase에서 커스텀 과목을 추가할 수 있는 구조
5. **useTuitionSessions와 useSessionPeriods의 컬렉션명 동일** - 두 훅 모두 `session_periods` 컬렉션을 사용하는 것이 정상 (양방향 동기화 설계)
