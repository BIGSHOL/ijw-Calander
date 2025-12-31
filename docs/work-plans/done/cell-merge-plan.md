# 시간표 셀 병합 구현 계획서

## 문제 정의

현재 하나의 수업이 **여러 연속 교시**에 걸쳐 있을 때, 각 교시마다 **별도의 카드**로 반복 표시됩니다.

```
현재 (문제):
┌─────────┐
│ (수업A) │ ← 1-2 교시
│ 총 2명  │
└─────────┘
┌─────────┐
│ (수업A) │ ← 2-1 교시 (중복 표시)
│ 총 2명  │
└─────────┘
┌─────────┐
│ (수업A) │ ← 2-2 교시 (중복 표시)
│ 총 2명  │
└─────────┘
```

**원하는 결과:**
```
┌─────────┐
│         │
│ (수업A) │ ← 1-2 ~ 2-2 병합된 하나의 셀
│ 총 2명  │
│         │
└─────────┘
```

---

## 기술적 분석

### 현재 구조
- `TimetableManager.tsx`에서 교시별(행) 순회
- 각 행에서 `getClassesForCell(day, period, resource)` 호출
- 해당 교시에 수업이 있으면 카드 렌더링

### 문제점
- 현재 구조에서는 각 행을 **독립적**으로 렌더링
- HTML `rowspan`을 사용하려면 **첫 번째 행에서 미리 계산** 필요

---

## 구현 방안 비교

| 방안 | 장점 | 단점 | 복잡도 |
|------|------|------|--------|
| **A. rowspan 사용** | 시각적으로 완벽한 병합 | 렌더링 로직 대폭 수정, 버그 위험 | 🔴 높음 |
| **B. CSS Grid 재구성** | 유연한 레이아웃 | 전체 테이블 구조 변경 필요 | 🔴 높음 |
| **C. 첫 교시만 표시** | 간단한 수정 | 빈 셀이 생김 | 🟡 중간 |
| **D. 연속 표시 + 라벨** | 현재 구조 유지 | 여전히 3개 카드 표시 | 🟢 낮음 |

---

## ✅ 구현 완료: 방안 A (rowspan)

**구현 일시**: 2025-12-30
**파일**: `TimetableManager.tsx` (Lines 649-669)

### 단계별 구현 결과

#### 1단계: 헬퍼 함수 추가 ✅ (완료)
```typescript
// 연속 교시 수 계산 (Line 218-231)
getConsecutiveSpan(cls, day, periodIndex) → number

// 이전 교시에서 이미 병합된 셀인지 확인 (Line 234-249)
shouldSkipCell(cls, day, periodIndex) → boolean
```

#### 2단계: 렌더링 로직 수정 ✅ (완료)

**Before (잘못된 구현):**
```tsx
// <td>는 항상 렌더링, 내부 <div>만 조건부 렌더링
<td>
    {cellClasses.map(cls => {
        if (shouldSkipCell(cls, day, periodIndex)) return null;
        return <div style={{minHeight: span * 80}}>카드</div>;
    })}
</td>
```

**After (올바른 구현):**
```tsx
// Line 654-669
const shouldSkipThisCell = cellClasses.some((cls: TimetableClass) =>
    shouldSkipCell(cls, day, periodIndex)
);

if (shouldSkipThisCell) {
    return null;  // <td> 자체를 렌더링 안 함
}

const maxSpan = Math.max(...cellClasses.map((cls: TimetableClass) =>
    getConsecutiveSpan(cls, day, periodIndex)
));

return (
    <td rowSpan={maxSpan > 1 ? maxSpan : undefined}>
        {cellClasses.map((cls: TimetableClass) => (
            <div key={cls.id}>수업 카드</div>
        ))}
    </td>
);
```

#### 3단계: 테이블 구조 조정 ✅ (완료)
- `<td rowSpan={maxSpan}>` 적용
- 병합된 셀에서 `<td>` 자체를 `null` 반환하여 제거

---

## 구현 세부사항

### 핵심 로직

```typescript
// 예: 수업A가 1-2, 2-1, 2-2 교시에 있는 경우

// === 1-2 교시 렌더링 ===
periodIndex = 1
shouldSkipThisCell = false  // 첫 시작
maxSpan = 3                 // 연속 3개 교시
→ <td rowSpan={3}> 렌더링 ✅

// === 2-1 교시 렌더링 ===
periodIndex = 2
shouldSkipThisCell = true   // 이전에서 병합됨
→ return null (td 자체 안 만듦) ✅

// === 2-2 교시 렌더링 ===
periodIndex = 3
shouldSkipThisCell = true   // 이전에서 병합됨
→ return null (td 자체 안 만듦) ✅
```

### 시각적 결과

**HTML 출력:**
```html
<!-- Before -->
<tr>
  <td><div style="minHeight: 240px">수업A</div></td>
</tr>
<tr>
  <td></td> <!-- 빈 셀이 존재 -->
</tr>
<tr>
  <td></td> <!-- 빈 셀이 존재 -->
</tr>

<!-- After -->
<tr>
  <td rowSpan="3">
    <div>수업A</div>
  </td>
</tr>
<tr>
  <!-- <td>가 아예 없음 -->
</tr>
<tr>
  <!-- <td>가 아예 없음 -->
</tr>
```

---

## 테스트 결과

### 테스트 시나리오
1. ✅ 연속 3개 교시 수업 생성
2. ✅ 첫 교시에만 카드 표시 확인
3. ✅ rowSpan="3" 속성 확인 (개발자 도구)
4. ✅ 다른 강사 열과 정렬 확인
5. ✅ 드래그 앤 드롭 정상 작동 확인

### 발견된 이슈
- **이슈**: 시각적 높이만 늘어났지만 실제 테이블 병합은 안 됨
- **원인**: `<div>`에만 `minHeight` 적용, `<td>`는 여전히 각 행마다 생성
- **해결**: `<td>` 레벨에서 `rowSpan` 적용 + 병합된 행에서 `<td>` 자체를 `null` 반환

---

## 구현 통계

| 항목 | 값 |
|------|-----|
| 수정 파일 | 1개 (TimetableManager.tsx) |
| 추가된 라인 | ~15 lines |
| 수정된 라인 | ~10 lines |
| 총 구현 시간 | ~25분 |
| 디버깅 시간 | ~15분 |
| **총 작업 시간** | **~40분** |

---

## 코드 변경 이력

### Commit 1: 초기 구현 (잘못된 방법)
```diff
+ const span = getConsecutiveSpan(cls, day, periodIndex);
+ if (shouldSkipCell(cls, day, periodIndex)) return null;
+ style={{ minHeight: span > 1 ? `${span * 80}px` : undefined }}
```
**문제**: `<div>`만 병합, `<td>`는 여전히 각 행마다 생성

### Commit 2: 올바른 구현
```diff
+ const shouldSkipThisCell = cellClasses.some((cls: TimetableClass) =>
+     shouldSkipCell(cls, day, periodIndex)
+ );
+ if (shouldSkipThisCell) return null;
+
+ const maxSpan = Math.max(...cellClasses.map((cls: TimetableClass) =>
+     getConsecutiveSpan(cls, day, periodIndex)
+ ));
+
+ <td rowSpan={maxSpan > 1 ? maxSpan : undefined}>
```
**해결**: `<td>` 자체에 rowSpan 적용, 병합된 셀은 렌더링 안 함

---

## 향후 개선 사항

### 선택적 개선 (Optional)
- [ ] 학생 리스트 스크롤 영역 높이 동적 조정
  ```tsx
  <div className="flex-1 p-1" style={{
      maxHeight: span > 1 ? `${span * 100}px` : '150px'
  }}>
  ```
- [ ] 병합된 카드 시각적 구분 (border, shadow 강화)
- [ ] 교시 범위 라벨 표시 (예: "1-2 ~ 2-2")

### 필수 개선 (Required)
- [x] TypeScript 타입 힌트 추가 (`cls: TimetableClass`)
- [x] 테이블 정렬 검증
- [x] 드래그 앤 드롭 호환성 확인

---

## 결론

**방안 A (rowspan)** 구현 완료.

### 성과
- ✅ 완벽한 테이블 셀 병합 구현
- ✅ 중복 카드 표시 문제 해결
- ✅ 깔끔한 UI/UX 제공
- ✅ 기존 드래그 앤 드롭 기능 유지

### 교훈
1. **HTML 구조 이해 중요**: `<td>` vs `<div>` 병합 차이
2. **점진적 디버깅**: 초기 구현 → 문제 발견 → 정확한 수정
3. **테이블 rowspan 주의**: 각 행의 셀 개수가 정확히 맞아야 함

---

---

## ✅ 추가 구현: 유효성 검사 (2025-12-30 Update)

### 1. 연속 교시 검사
- **문제**: 중간에 빈 교시가 있는 경우 (예: 1-1, 2-1) 시각적 불연속성 발생
- **해결**: `checkConsecutiveSchedule` 함수 추가
- **로직**: 선택된 교시들의 인덱스를 정렬하여 차이가 1인지 확인
- **결과**: `handleAddClass`, `handleUpdateClass`에서 생성/수정 전 검증

### 2. 중복 생성 방지
- **문제**: 동일한 수업(과목, 강사, 수업명) 생성 시 덮어쓰기 문제
- **해결**: ID(`과목_강사_수업명`) 기반 중복 체크
- **결과**: 이미 존재하면 경고창 표시 및 생성 차단
- **참고**: 동명이인(수업명 같으나 강사 다름)은 ID가 다르므로 정상 생성됨

### 3. 수업 수정 기능
- **기능**: 기존 수업의 시간표 및 교실 수정 가능
- **UI**: 상세 모달에 '수정 모드' 토글 추가

---

*Updated: 2025-12-30*
*Implementation: Claude Sonnet 4.5*
