# 키워드 색상 버그 검증 보고서

> **검증 일시**: 2025-12-31
> **검증 대상**: `components/Timetable/English/EnglishClassTab.tsx`
> **검증 방법**: 실제 코드 라인별 확인

---

## 🔍 검증 결과: ❌ **버그 존재 확인**

키워드 색상 기능이 **부분적으로만 작동**하고 있습니다.

---

## 📊 상세 분석

### ✅ 정상 작동 영역

#### ClassCard 헤더 (Line 876-883)
**위치**: `EnglishClassTab.tsx` Line 876-883

```typescript
// ✅ 키워드 색상 정상 작동
const matchedKw = classKeywords.find(kw => classInfo.name?.includes(kw.keyword));
return (
    <div
        className="p-2 text-center font-bold text-sm border-b border-gray-300..."
        style={matchedKw ?
            { backgroundColor: matchedKw.bgColor, color: matchedKw.textColor } :
            { backgroundColor: '#EFF6FF', color: '#1F2937' }
        }
    >
```

**상태**: ✅ **정상 작동**
- ClassCard의 헤더 부분(수업명 표시 영역)에서는 키워드 색상이 정상 적용됨
- `classKeywords` 배열을 받아서 매칭 후 색상 적용
- 예: "PL초2" 수업 → "PL" 키워드 매칭 → 빨간 배경 적용

---

### ❌ 미작동 영역

#### MiniGridRow (통합뷰 그리드) (Line 1177-1254)

##### 1️⃣ Props 정의 (Line 1177-1183)
```typescript
// ❌ 문제: className, classKeywords 파라미터 없음
const MiniGridRow: React.FC<{
    period: typeof EN_PERIODS[number],
    scheduleMap: Record<string, Record<string, ScheduleCell>>,
    weekendShift: number,
    teachersData: Teacher[],
    displayDays: string[]
    // ❌ className: string 누락
    // ❌ classKeywords: ClassKeywordColor[] 누락
}> = ({ period, scheduleMap, weekendShift, teachersData, displayDays }) => {
```

**상태**: ❌ **미구현**

---

##### 2️⃣ Props 전달 (Line 989-998)
```typescript
// ❌ 문제: className, classKeywords를 MiniGridRow에 전달하지 않음
{classInfo.visiblePeriods.map(p => (
    <MiniGridRow
        key={p.id}
        period={p}
        scheduleMap={classInfo.scheduleMap}
        weekendShift={classInfo.weekendShift}
        teachersData={teachersData}
        displayDays={classInfo.finalDays}
        // ❌ className={classInfo.name} 누락
        // ❌ classKeywords={classKeywords} 누락
    />
))}
```

**상태**: ❌ **미구현**

**참고**: Line 724에서 ClassCard에는 `classKeywords={classKeywords}`를 전달하고 있음
```typescript
// Line 724: ClassCard에는 전달됨 (이것은 헤더용)
<ClassCard
    classInfo={cls}
    mode={mode}
    isHidden={isHiddenClass(cls.name)}
    onToggleHidden={() => toggleHidden(cls.name)}
    teachersData={teachersData}
    classKeywords={classKeywords}  // ✅ ClassCard에는 전달
    ...
/>
```

---

##### 3️⃣ 렌더링 로직 (Line 1220-1250)
```typescript
// ❌ 문제: 키워드 매칭 로직 없음, teacher 기반 색상만 적용
const cell = scheduleMap[effectivePeriodId]?.[day];

// Get style based on teacher
let teacherStyle = {};
if (cell?.teacher) {
    const colors = getTeacherColor(cell.teacher, teachersData);
    // If underline is enabled, override color with blue
    if (cell.underline) {
        teacherStyle = { backgroundColor: colors.bg, color: '#2563eb', fontWeight: 600 };
    } else {
        teacherStyle = { backgroundColor: colors.bg, color: colors.text, fontWeight: 600 };
    }
}

return (
    <div
        key={day}
        className="flex-1 border-r border-gray-100 last:border-r-0..."
        style={teacherStyle}  // ❌ teacher 색상만 적용, 키워드 색상 없음
        title={cell?.teacher || ''}  // ❌ teacher만 표시
    >
        {cell ? (
            <span className={`leading-tight truncate w-full ${cell.underline ? 'underline italic' : ''}`}>
                {cell.teacher}  // ❌ teacher만 표시, className 없음
            </span>
        ) : (
            <span className="text-gray-200">-</span>
        )}
    </div>
);
```

**상태**: ❌ **미구현**

**문제점**:
1. `const matchedKw = classKeywords.find(...)` 코드 없음
2. `const finalStyle = matchedKw ? {...} : teacherStyle` 로직 없음
3. `title`에 className 포함 안됨
4. `<div>` 내부에 className 표시 없음 (teacher만 표시)

---

## 🎯 영향 분석

### 사용자가 보는 화면

#### ✅ ClassCard 헤더 (정상 작동)
```
┌─────────────────────────────┐
│   PL초2  ← 빨간색 배경 ✅   │
│   (키워드 색상 적용됨)       │
├─────────────────────────────┤
│  통합뷰 그리드...           │
└─────────────────────────────┘
```

#### ❌ MiniGridRow 통합뷰 그리드 (미작동)
```
통합뷰 그리드:
───────────────────────────────
시간   │  월     │  화     │  수
───────────────────────────────
14:20  │ 김선생  │ 박선생  │ 이선생  ← teacher 색상만 적용 ❌
~15:00 │         │         │          (키워드 색상 없음)
───────────────────────────────

예상 결과 (수정 후):
───────────────────────────────
시간   │   월      │   화       │   수
───────────────────────────────
14:20  │ PL초2     │ 고1수학    │ PL중2     ← 수업명 + 키워드 색상 ✅
~15:00 │ (김선생)  │ (박선생)   │ (이선생)  ← teacher 작게
───────────────────────────────
```

---

## 📋 수정 필요 사항

### FINAL_FIX_INSTRUCTIONS.md의 3개 수정사항 모두 미완료

#### ❌ 수정 1: MiniGridRow Props 추가
- **위치**: Line 1177-1183
- **필요 작업**: `className: string`, `classKeywords: ClassKeywordColor[]` 파라미터 추가

#### ❌ 수정 2: Props 전달
- **위치**: Line 989-998
- **필요 작업**: `className={classInfo.name}`, `classKeywords={classKeywords}` 추가

#### ❌ 수정 3: 렌더링 로직 구현
- **위치**: Line 1220-1250
- **필요 작업**:
  - 키워드 매칭 로직 추가
  - finalStyle 계산 로직 추가
  - className 표시 추가
  - title에 className 포함

---

## 🔴 결론

### 버그 상태: ❌ **미수정 (0/3 완료)**

| 구분 | ClassCard 헤더 | MiniGridRow 그리드 |
|------|----------------|-------------------|
| 키워드 색상 | ✅ 정상 작동 | ❌ 미작동 |
| className 표시 | ✅ 표시됨 | ❌ 미표시 (teacher만) |
| 구현 상태 | 완료 | 미완료 |

### 원인
- ClassCard 컴포넌트 내부(헤더)에서는 `classKeywords`를 받아서 사용
- 하지만 MiniGridRow 컴포넌트에는 `classKeywords`를 전달하지 않음
- MiniGridRow 내부에도 키워드 매칭 로직이 없음

### 사용자 경험
- **ClassCard 헤더**: "PL초2" → 빨간 배경 ✅
- **통합뷰 그리드**: "PL초2" → teacher 색상만, 키워드 무시 ❌

### 해결 방법
[FINAL_FIX_INSTRUCTIONS.md](FINAL_FIX_INSTRUCTIONS.md)의 3개 수정사항 적용 필요
- **예상 소요 시간**: 3-5분
- **위험도**: 낮음
- **영향 범위**: EnglishClassTab 통합뷰만

---

## 🚀 다음 단계

### Option A: 즉시 수정
1. [FINAL_FIX_INSTRUCTIONS.md](FINAL_FIX_INSTRUCTIONS.md) 열기
2. Phase 1-3 체크리스트 따라 수정
3. 빌드 및 테스트

### Option B: code-fixer 에이전트 사용
```
"FINAL_FIX_INSTRUCTIONS.md의 3개 수정사항을 code-fixer 에이전트로 자동 적용"
```

---

*검증 완료: 2025-12-31*
*검증자: Claude Sonnet 4.5*
*검증 방법: 실제 코드 라인별 확인 (Line 1177-1254, 876-883, 989-998)*
